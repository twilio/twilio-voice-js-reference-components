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
export const twimlHandler = (req, res, componentUrl, options = {}) => {
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
      statusCallback: `${callbackBaseUrl}/${componentUrl}/conference-events`,
      statusCallbackEvent,
      waitUrl: '',
    },
    roomName
  );

  // Add the callee to the conference
  client.conferences(roomName).participants.create({
    beep: 'false',
    endConferenceOnExit: true,
    from: callerId,
    // Label to identify this participant
    label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-${calleeLabel}`,
    // Callee's progress/status
    // https://www.twilio.com/docs/voice/api/conference-participant-resource#request-body-parameters
    statusCallback:
      calleeStatusCallbackEvent.length > 0
        ? `${callbackBaseUrl}/${componentUrl}/call-events`
        : '',
    statusCallbackEvent: calleeStatusCallbackEvent,
    to: recipient,
  });

  res.header('Content-Type', 'text/xml').status(200).send(twiml.toString());
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
    const participants = await client
      .conferences(ConferenceSid)
      .participants.list();

    // Send the conference sid and the other participants' callSids to any client leg.
    // The sids will be used to update the participant resource such as putting it on hold.
    participants.forEach(async (currentParticipant) => {
      if (currentParticipant.label.split('-')[0] === 'client') {
        // When the StatusCallbackEvent is 'participant-leave', the req.body contains data
        // from the participant that left the conference. Send the callSid and data of the
        // participant that left the conference to all current client legs.
        if (StatusCallbackEvent === 'participant-leave') {
          await client
            .calls(currentParticipant.callSid)
            .userDefinedMessages
            .create({
              content: JSON.stringify({
                callSid: CallSid,
                category: 'conference-status',
                conferenceSid: ConferenceSid,
                hold: Hold,
                label: ParticipantLabel,
                muted: Muted,
                remove: true,
                statusCallbackEvent: StatusCallbackEvent,
              }),
            });
        } else {
          participants
            .filter((p) => p.callSid !== currentParticipant.callSid)
            .forEach(async (otherParticipant) => {
              await client
                .calls(currentParticipant.callSid)
                .userDefinedMessages
                .create({
                  content: JSON.stringify({
                    callSid: otherParticipant.callSid,
                    category: 'conference-status',
                    conferenceSid: ConferenceSid,
                    hold: otherParticipant.hold,
                    label: otherParticipant.label,
                    muted: otherParticipant.muted,
                    remove: false,
                    statusCallbackEvent: StatusCallbackEvent,
                  }),
                });
            });
        }
      }
    });
  }

  res.sendStatus(200);
};
