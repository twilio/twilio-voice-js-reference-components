import express, { Router } from 'express';
import path from 'path';
import Twilio from 'twilio';
import config from '../../config.js';
import {
  tokenHandler,
  conferenceEventsHandler,
  twimlHandler,
} from '../../common/routes.js';

const router = Router();
const { authToken } = config;
const componentUrl = 'twilio-voice-noise-cancellation';

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => tokenHandler(req, res));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  try {
    await twimlHandler(req, res, componentUrl);
  } catch (error) {
    console.error('Failed to handle twiml:', error.message, {
      status: error.status,
      code: error.code,
    });
    if (!res.headersSent) res.sendStatus(500);
  }
});

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  try {
    await conferenceEventsHandler(req, res, componentUrl);
  } catch (error) {
    console.error('Failed to handle conference-events:', error.message, {
      status: error.status,
      code: error.code,
    });
    if (!res.headersSent) res.sendStatus(200);
  }
});

// Serve the RNNoise WASM + worklet assets from the package's dist folder.
router.use(
  '/web-noise-suppressor',
  express.static(
    path.join(process.cwd(), 'node_modules/@sapphi-red/web-noise-suppressor/dist')
  )
);

export default router;
