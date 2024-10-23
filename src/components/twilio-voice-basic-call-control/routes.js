import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';

const router = Router();
const { accountSid, apiKeySid, apiKeySecret } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

router.post('/conferences/:conferenceSid/participants/:callSid', async (req, res) => {
  const { hold } = req.body;
  const { callSid, conferenceSid } = req.params;

  // Update a Participant resource
  // https://www.twilio.com/docs/voice/api/conference-participant-resource#update-a-participant-resource
  await client
    .conferences(conferenceSid)
    .participants(callSid)
    .update({ hold });

  res.sendStatus(200);
});

export default router;
