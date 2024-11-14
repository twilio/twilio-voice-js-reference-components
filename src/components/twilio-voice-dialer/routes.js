import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import {
  getToken,
  postConferenceEvents,
  postTwiml,
} from '../../common/routes.js';

const router = Router();
const { authToken } = config;

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => getToken({ req, res }));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), (req, res) =>
  postTwiml({
    req,
    res,
    caller: {
      label: 'caller',
      maxParticipants: 2,
      endConferenceOnExit: true,
      componentUrl: 'twilio-voice-dialer',
    },
    callee: { label: 'callee' },
  })
);

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) =>
  postConferenceEvents({ req, res })
);

export default router;
