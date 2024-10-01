import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';

const router = Router();
const { accountSid, apiKeySid, apiKeySecret } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

router.post('/conferences/:conferenceSid/participants/:callSid', async (req, res) => {
  const { hold } = JSON.parse(req.body);
  const { callSid, conferenceSid } = req.params;

  await client
    .conferences(conferenceSid)
    .participants(callSid)
    .update({ hold });

  res.sendStatus(200);
});

export default router;
