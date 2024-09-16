import { Router } from 'express';
import crypto from 'crypto';
import Twilio from 'twilio';
import config from '../../config.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const router = Router();
const { appSid, accountSid, apiKeySid, apiKeySecret, callerId, callbackBaseURL } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

router.get('/token', (req, res) => {
  const identity = req.query.identity;
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity, ttl: 3600 });
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: Boolean(identity),
  });

  token.addGrant(voiceGrant);
  res.send({ token: token.toJwt() });
});

router.post('/twiml', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  
  // Generates 1:1 conference
  const roomName = `conference-${crypto.randomUUID()}`;

  let recipient = req.body.recipient;
  recipient = /^[\d\+\-\(\) ]+$/.test(recipient) ? recipient : 'client:' + recipient;

  // The caller creates the conference
  dial.conference({
    participantLabel: 'caller',
    maxParticipants: 2,
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
    statusCallback: `${callbackBaseURL}/twilio-voice-dialer/conference-events`,
    statusCallbackEvent: 'join',
  }, roomName);

  // Add the callee to the conference
  client.conferences(roomName).participants.create({
    from: callerId,
    to: recipient,
    label: 'callee',
    endConferenceOnExit: true,
  });

  res
    .header('Content-Type', 'text/xml')
    .status(200)
    .send(twiml.toString());
});

router.post('/conference-events', async (req, res) => {
  const { CallSid, ConferenceSid: conferenceSid, StatusCallbackEvent } = req.body;

  // When the caller joins, send back the conferenceSid to be used
  // for conference management during the call
  if (StatusCallbackEvent === 'participant-join') {
    const participant = await client
      .conferences(conferenceSid)
      .participants(CallSid)
      .fetch();

    if (participant.label === 'caller') {
      await client
        .calls(participant.callSid)
        .userDefinedMessages
        .create({content: JSON.stringify({ conferenceSid })});
    }
  }

  res.sendStatus(200);
});

export default router;
