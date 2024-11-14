import crypto from 'crypto';
import Twilio from 'twilio';
import config from '../config.js';
import { isPhoneNumber } from './utils.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const {
  appSid,
  accountSid,
  apiKeySid,
  apiKeySecret,
  callerId,
  callbackBaseURL,
  defaultIdentity,
} = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

export const getToken = ({ req, res }) => {
  const identity = req.query.identity || defaultIdentity;
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: Boolean(identity),
  });

  token.addGrant(voiceGrant);
  res.send({ token: token.toJwt() });
};

export const postTwiml = ({ req, res, caller, callee }) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial();

  // Generates 1:1 conference
  const roomName = `conference-${crypto.randomUUID()}`;
  let recipient = req.body.recipient || defaultIdentity;
  recipient = isPhoneNumber(recipient) ? recipient : 'client:' + recipient;

  // The caller creates the conference
  dial.conference(
    {
      // Label to identify this participant
      participantLabel: `${
        isPhoneNumber(req.body.From) ? 'number' : 'client'
      }-${caller.label}`,
      maxParticipants: caller.maxParticipants,
      startConferenceOnEnter: true,
      endConferenceOnExit: caller.endConferenceOnExit,
      statusCallback: `${callbackBaseURL}/${caller.componentUrl}/conference-events`,
      statusCallbackEvent: 'join, leave, mute, hold',
    },
    roomName
  );

  // Add the callee to the conference
  client.conferences(roomName).participants.create({
    // Label to identify this participant
    label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-${callee.label}`,
    from: callerId,
    to: recipient,
    endConferenceOnExit: true,
  });

  res.header('Content-Type', 'text/xml').status(200).send(twiml.toString());
};

export const postConferenceEvents = async ({ req, res }) => {
  const {
    CallSid,
    ConferenceSid,
    Hold,
    Muted,
    ParticipantLabel,
    StatusCallbackEvent,
  } = req.body;

  if (
    StatusCallbackEvent === 'participant-join' ||
    'participant-mute' ||
    'participant-unmute' ||
    'participant-hold' ||
    'participant-unhold' ||
    'participant-leave'
  ) {
    const participants = await client
      .conferences(ConferenceSid)
      .participants.list();

    const isParticipantLeave = StatusCallbackEvent === 'participant-leave';

    // Send the conference sid and the other participants' callSids to any client leg.
    // The sids will be used to update the participant resource such as putting it on hold.
    participants.forEach((currentParticipant) => {
      if (currentParticipant.label.split('-')[0] === 'client') {
        participants
          .filter((p) => p.callSid !== currentParticipant.callSid)
          .forEach(async (otherParticipant) => {
            await client
              .calls(currentParticipant.callSid)
              .userDefinedMessages.create({
                content: JSON.stringify({
                  conferenceSid: ConferenceSid,
                  callSid: isParticipantLeave
                    ? CallSid
                    : otherParticipant.callSid,
                  label: isParticipantLeave
                    ? ParticipantLabel
                    : otherParticipant.label,
                  muted: isParticipantLeave ? Muted : otherParticipant.muted,
                  hold: isParticipantLeave ? Hold : otherParticipant.hold,
                  remove: isParticipantLeave ? true : false,
                }),
              });
          });
      }
    });
  }

  res.sendStatus(200);
};
