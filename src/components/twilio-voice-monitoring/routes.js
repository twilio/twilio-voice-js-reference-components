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
// Maps each callee's callSid to the caller (agent) callSid so the /call-events
// webhook can route callee status updates to the correct caller leg. Keyed per
// call rather than a single shared value so concurrent calls don't clobber it.
const calleeToCaller = new Map();

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
      statusCallbackEvent: 'start end join leave mute hold modify speaker announcement',
    }
  )
);

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  // Build the callee -> caller mapping so /call-events can route callee status
  // updates to the caller leg. The caller is labeled 'client-agent' (see twimlHandler).
  try {
    const { ConferenceSid } = req.body;
    const participants = await client
      .conferences(ConferenceSid)
      .participants
      .list();
    const caller = participants.find(
      (participant) => participant.label?.endsWith('-agent')
    );
    if (caller) {
      participants
        .filter((participant) => participant.callSid !== caller.callSid)
        .forEach((callee) => calleeToCaller.set(callee.callSid, caller.callSid));
    }
  } catch (error) {
    console.error('Failed to map callee to caller in conference-events:', error);
  }

  return conferenceEventsHandler(
    req,
    res,
    componentUrl
  );
});

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/call-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  const {
    Called,
    CallSid,
    CallStatus,
  } = req.body;
  try {
    const callerCallSid = calleeToCaller.get(CallSid);
    // The caller may not be mapped yet for very early callee events (e.g. the
    // first 'initiated'/'ringing' before /conference-events has run).
    if (callerCallSid) {
      const caller = await client.calls(callerCallSid).fetch();
      if (caller?.status !== 'completed') {
        // Send callee progress/status to caller
        await client
          .calls(callerCallSid)
          .userDefinedMessages
          .create({
            content: JSON.stringify({
              callSid: CallSid,
              category: 'callee-call-status',
              label: Called,
              statusCallbackEvent: CallStatus,
            }),
          });
      }
      // Once the callee call reaches any terminal status, drop the mapping to
      // avoid leaking entries for calls that never reach 'completed'.
      if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
        calleeToCaller.delete(CallSid);
      }
    }
  } catch (error) {
    console.error(`Failed to relay callee status for ${CallSid}:`, error);
  }
  res.sendStatus(200);
});

export default router;
