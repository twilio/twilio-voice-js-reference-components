import crypto from 'crypto';
import Twilio from 'twilio';
import config from '../config.js';
import { isPhoneNumber } from './utils.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const {
  accountSid,
  appSid,
  apiKeySecret,
  apiKeySid,
  callbackBaseUrl,
  callerId,
  defaultIdentity,
} = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

/**
 * Generate a Twilio access token for the component.
 */
export const tokenHandler = (req, res) => {
  const identity = req.query.identity || defaultIdentity;
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });
  const voiceGrant = new VoiceGrant({
    incomingAllow: Boolean(identity),
    outgoingApplicationSid: appSid,
  });

  token.addGrant(voiceGrant);
  res.send({ token: token.toJwt() });
};

/**
 * Handler for the TwiML App Webhook, set in the User's Twilio Console.
 */
export const twimlHandler = async (req, res, componentUrl, options = {}) => {
  const {
    calleeStatusCallbackEvent = [],
    calleeLabel = 'callee',
    callerLabel = 'caller',
    endConferenceOnExit = true,
    maxParticipants = 2,
    statusCallbackEvent = '',
  } = options;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();

  // Generates 1:1 conference
  const roomName = `conference-${crypto.randomUUID()}`;
  let recipient = req.body.recipient || defaultIdentity;
  recipient = isPhoneNumber(recipient) ? recipient : 'client:' + recipient;

  // The caller creates the conference
  dial.conference(
    {
      beep: 'false',
      endConferenceOnExit,
      maxParticipants,
      // Label to identify this participant
      participantLabel: `${
        isPhoneNumber(req.body.From) ? 'number' : 'client'
      }-${callerLabel}`,
      startConferenceOnEnter: true,
      statusCallback: `https://${callbackBaseUrl}/${componentUrl}/conference-events`,
      statusCallbackEvent,
      waitUrl: '',
    },
    roomName
  );

  // Respond with the TwiML first so the caller joins and creates the conference
  // with the statusCallback configured above. If the callee were added first,
  // the REST API would create the conference without a status callback and no
  // conference events would ever be delivered.
  res.header('Content-Type', 'text/xml').status(200).send(twiml.toString());

  // Add the callee to the conference
  try {
    await client.conferences(roomName).participants.create({
      beep: 'false',
      endConferenceOnExit: true,
      from: callerId,
      // Label to identify this participant
      label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-${calleeLabel}`,
      // Callee's progress/status
      // https://www.twilio.com/docs/voice/api/conference-participant-resource#request-body-parameters
      statusCallback:
        calleeStatusCallbackEvent.length > 0
          ? `https://${callbackBaseUrl}/${componentUrl}/call-events`
          : '',
      statusCallbackEvent: calleeStatusCallbackEvent,
      to: recipient,
    });
  } catch (error) {
    // The TwiML response was already sent, so the caller is in an empty
    // conference and the failure can only be surfaced via these logs.
    console.error(`Failed to add callee to conference ${roomName}:`, error.message, {
      status: error.status,
      code: error.code,
    });
  }
};

/**
 * Handler for the Twilio Conference statusCallback.
 */
export const conferenceEventsHandler = async (req, res, componentUrl, options = {}) => {
  const {
    CallSid,
    ConferenceSid,
    Hold,
    Muted,
    ParticipantLabel,
    StatusCallbackEvent,
  } = req.body;
  const {
    statusCallbackEvents = [],
  } = options;

  let shouldSendMessage;
  switch (componentUrl) {
    case 'twilio-voice-dialer':
      shouldSendMessage = false;
      break;
    case 'twilio-voice-basic-call-control':
      shouldSendMessage = statusCallbackEvents.includes(StatusCallbackEvent);
      break;
    case 'twilio-voice-monitoring':
      shouldSendMessage = true;
      break;
    default:
      shouldSendMessage = false;
  }

  if (shouldSendMessage) {
    try {
      const participants = await client
        .conferences(ConferenceSid)
        .participants.list();

      // Send the conference sid and the other participants' callSids to any client leg.
      // The sids will be used to update the participant resource such as putting it on hold.
      const clientParticipants = participants.filter(
        (participant) => participant.label?.split('-')[0] === 'client'
      );

      // Collect every message to send so we can await them and surface failures
      // instead of firing async callbacks inside forEach (unhandled rejections).
      const messages = [];
      clientParticipants.forEach((currentParticipant) => {
        // When the StatusCallbackEvent is 'participant-leave', the req.body contains data
        // from the participant that left the conference. Send the callSid and data of the
        // participant that left the conference to all current client legs.
        if (StatusCallbackEvent === 'participant-leave') {
          messages.push({
            callSid: currentParticipant.callSid,
            content: {
              callSid: CallSid,
              category: 'conference-status',
              conferenceSid: ConferenceSid,
              hold: Hold,
              label: ParticipantLabel,
              muted: Muted,
              remove: true,
              statusCallbackEvent: StatusCallbackEvent,
            },
          });
        } else {
          participants
            .filter((participant) => participant.callSid !== currentParticipant.callSid)
            .forEach((otherParticipant) => {
              messages.push({
                callSid: currentParticipant.callSid,
                content: {
                  callSid: otherParticipant.callSid,
                  category: 'conference-status',
                  conferenceSid: ConferenceSid,
                  hold: otherParticipant.hold,
                  label: otherParticipant.label,
                  muted: otherParticipant.muted,
                  remove: false,
                  statusCallbackEvent: StatusCallbackEvent,
                },
              });
            });
        }
      });

      const results = await Promise.allSettled(
        messages.map(({ callSid, content }) =>
          client.calls(callSid).userDefinedMessages.create({
            content: JSON.stringify(content),
          })
        )
      );
      results
        .filter((result) => result.status === 'rejected')
        .forEach((result) =>
          console.error('Failed to send conference-status message:', result.reason)
        );
    } catch (error) {
      // Log only the error summary, not the full Twilio error object, which can
      // carry account SIDs, API response bodies, or PII into log aggregators.
      console.error(
        `Failed to handle conference event for ${ConferenceSid}:`,
        error.message,
        { status: error.status, code: error.code }
      );
    }
  }

  res.sendStatus(200);
};
