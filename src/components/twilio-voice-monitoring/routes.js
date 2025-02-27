import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import {
  tokenHandler,
  conferenceEventsHandler,
  twimlHandler,
} from '../../common/routes.js';

const router = Router();
const {
  accountSid,
  apiKeySecret,
  apiKeySid,
  authToken
} = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });
const componentUrl = 'twilio-voice-monitoring';
let callerCallSid;

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => tokenHandler(req, res));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), (req, res) =>
  twimlHandler(
    req,
    res,
    componentUrl,
    {
      callerLabel: 'agent',
      calleeLabel: 'customer',
      calleeStatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackEvent: 'start, end, join, leave, mute, hold, modify, speaker, announcement',
    }
  )
);

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  const {
    ConferenceSid,
  } = req.body;
  const participants = await client
    .conferences(ConferenceSid)
    .participants.list();
  // The caller is the first participant to enter the conference
  if (participants.length === 1) {
    callerCallSid = participants[0].callSid;
  }

  conferenceEventsHandler(
    req,
    res,
    componentUrl
  )
});

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/call-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  const {
    Called,
    CallSid,
    CallStatus,
  } = req.body;
  const caller = await client.calls(callerCallSid).fetch();
  if (caller?.status !== 'completed') {
    // Send callee progress/status to caller
    await client
      .calls(callerCallSid)
      .userDefinedMessages
      .create({
        content: JSON.stringify({
          callSid: CallSid,
          category: 'call-status',
          label: Called,
          statusCallbackEvent: CallStatus,
        }),
    });
  }
});

export default router;
