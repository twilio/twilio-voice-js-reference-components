import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import {
  tokenHandler,
  conferenceEventsHandler,
  twimlHandler,
} from '../../common/routes.js';

const router = Router();
const { authToken } = config;

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => tokenHandler(req, res));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken),
  (req, res) => 
    twimlHandler(req, res, {
      callerLabel: 'caller',
      calleeLabel: 'callee',
      maxParticipants: 2,
      endConferenceOnExit: true,
      componentUrl: 'twilio-voice-monitoring',
      statusCallbackEvent: 'start, end, join, leave, mute, hold, modify, speaker, announcement',
    })
);

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) =>
  conferenceEventsHandler(
    req,
    res,
    {
      componentUrl: 'twilio-voice-monitoring'
    }
  )
);

export default router;
