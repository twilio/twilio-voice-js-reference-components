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
// Maps each callee's callSid to the caller (agent) callSid so /call-events can
// route callee status updates to the right caller leg. Entries carry a TTL so
// they can't leak if a terminal status never arrives.
// NOTE: process-local — in a multi-worker deployment the two webhooks can hit
// different workers and relays will drop. For production use Redis/Twilio Sync.
const CALLEE_MAPPING_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const calleeToCaller = new Map();

// Drop expired entries. Called on insert so the Map stays bounded without a timer.
function pruneCalleeMappings() {
  const now = Date.now();
  for (const [calleeCallSid, entry] of calleeToCaller) {
    if (entry.expiresAt <= now) calleeToCaller.delete(calleeCallSid);
  }
}

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => tokenHandler(req, res));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  try {
    await twimlHandler(req, res, componentUrl, {
      callerLabel: 'agent',
      calleeLabel: 'customer',
      calleeStatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackEvent: 'start end join leave mute hold modify speaker announcement',
    });
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
      pruneCalleeMappings();
      const expiresAt = Date.now() + CALLEE_MAPPING_TTL_MS;
      participants
        .filter((participant) => participant.callSid !== caller.callSid)
        .forEach((callee) =>
          calleeToCaller.set(callee.callSid, {
            callerCallSid: caller.callSid,
            expiresAt,
          })
        );
    }
  } catch (error) {
    console.error('Failed to map callee to caller in conference-events:', error.message, { status: error.status, code: error.code });
  }

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

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/call-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  const {
    Called,
    CallSid,
    CallStatus,
  } = req.body;
  try {
    const mapping = calleeToCaller.get(CallSid);
    // Early 'initiated'/'ringing' events are dropped: the callee isn't a
    // conference participant until it answers, so it isn't mapped yet. Showing
    // dialing progress would need buffering/replay, omitted for this reference.
    if (mapping) {
      const callerCallSid = mapping.callerCallSid;
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
    // Log only the error summary. The full Twilio error (and the callee CallSid)
    // can pull phone numbers from the call resource into log aggregators.
    console.error('Failed to relay callee status:', error.message, {
      status: error.status,
      code: error.code,
    });
  }
  res.sendStatus(200);
});

export default router;
