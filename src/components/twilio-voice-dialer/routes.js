import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const router = Router();
const { appSid, accountSid, apiKeySid, apiKeySecret, callerId } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

router.get('/token', (req, res) => {
  const identity = req.query.identity;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: !!identity,
  });

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity, ttl: 3600 });

  token.addGrant(voiceGrant);

  res.send({ token: token.toJwt() });
});

router.post('/twiml', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  const roomName = 'My Conference';

  let recipient = req.body.recipient;
  recipient = /^[\d\+\-\(\) ]+$/.test(recipient) ? recipient : 'client:' + recipient;

  client.conferences(roomName).participants.create({ from: callerId, to: recipient });
  dial.conference(roomName, {
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
  });

  res
    .header('Content-Type', 'text/xml')
    .status(200)
    .send(twiml.toString());
});

export default router;
