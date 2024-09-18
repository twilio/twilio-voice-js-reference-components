import { Router } from 'express';
import crypto from 'crypto';
import Twilio from 'twilio';
import config from '../../config.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const router = Router();
const { appSid, accountSid, apiKeySid, apiKeySecret, callerId, callbackBaseURL, defaultIdentity } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

const isPhoneNumber = (recipient) => /^[\d\+\-\(\) ]+$/.test(recipient);

router.get('/token', (req, res) => {
  const identity = req.query.identity || defaultIdentity;
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
  let recipient = req.body.recipient || defaultIdentity;
  recipient = isPhoneNumber(recipient) ? recipient : 'client:' + recipient;

  // The caller creates the conference
  dial.conference({
    // Label to identify this participant
    participantLabel: `${isPhoneNumber(req.body.From) ? 'number' : 'client'}-caller`,
    maxParticipants: 2,
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
    statusCallback: `${callbackBaseURL}/twilio-voice-dialer/conference-events`,
    statusCallbackEvent: 'join',
  }, roomName);

  // Add the callee to the conference
  client.conferences(roomName).participants.create({
    // Label to identify this participant
    label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-callee`,
    from: callerId,
    to: recipient,
    endConferenceOnExit: true,
  });

  res
    .header('Content-Type', 'text/xml')
    .status(200)
    .send(twiml.toString());
});

router.post('/conference-events', async (req, res) => {
  const { ConferenceSid, StatusCallbackEvent } = req.body;

  if (StatusCallbackEvent === 'participant-join') {
    const participants = await client.conferences(ConferenceSid).participants.list();

    // Send the conference sid and the other participants' callSids to any client leg.
    // The sids will be used to update the participant resource such as putting it on hold.
    participants.forEach((currentParticipant) => {
      if (currentParticipant.label.split('-')[0] === 'client') {
        participants.filter((p) => p.callSid !== currentParticipant.callSid).forEach(async (otherParticipant) => {
          await client
            .calls(currentParticipant.callSid)
            .userDefinedMessages
            .create({content: JSON.stringify({
              conferenceSid: ConferenceSid,
              callSid: otherParticipant.callSid,
            })});
        });
      }
    });
  }

  res.sendStatus(200);
});

export default router;
