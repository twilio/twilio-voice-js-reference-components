import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import {
  tokenHandler,
} from '../../common/routes.js';

const VoiceResponse = Twilio.twiml.VoiceResponse;

const router = Router();
const { authToken, callbackBaseUrl } = config;

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => tokenHandler(req, res));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), (req, res) => {
  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  
  connect.conversationRelay({
    url: `wss://${callbackBaseUrl}/websocket`,
    welcomeGreeting: 'Hi! I am a Javascript S D K voice assistant powered by Twilio and Open A I . Ask me anything!'
  });

  res.header('Content-Type', 'text/xml').status(200).send(twiml.toString());
});

export default router;
