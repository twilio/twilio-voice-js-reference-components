import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';

const router = Router();
const { accountSid, apiKeySid, apiKeySecret } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

router.post('/conferences/:conferenceSid', async (req, res) => {
  // With 1:1 conference call, the caller can put the callee on hold
  const { hold } = req.body;
  const conference = client.conferences(req.params.conferenceSid);

  (await conference.participants.list())
  .forEach(async ({ callSid, label }) => {
    if (label === 'callee') {
      await conference.participants(callSid).update({ hold });
    }
  });

  res.sendStatus(200);
});

export default router;
