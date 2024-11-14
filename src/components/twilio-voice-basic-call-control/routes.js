import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import { isPhoneNumber } from '../../common/utils.js';
import { getToken, postConferenceEvents, postTwiml } from '../../common/routes.js';

const router = Router();
const { accountSid, apiKeySid, apiKeySecret, authToken, callerId } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => getToken({ req, res }));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), (req, res) =>
  postTwiml({
    req,
    res,
    caller: {
      label: 'agent1',
      // 3 participants needed for warm transfer: agent1, agent2, and customer.
      maxParticipants: 3,
      // Allow agent1 to drop from call, while agent2 and customer continue call.
      endConferenceOnExit: false,
      componentUrl: 'twilio-voice-basic-call-control',
    },
    callee: { label: 'customer' },
  })
);

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => 
  postConferenceEvents({ req, res })
);

router.post('/conferences/:conferenceSid/participants/:callSid', async (req, res) => {
  const { callSid, conferenceSid } = req.params;

  // Update a Participant resource
  // https://www.twilio.com/docs/voice/api/conference-participant-resource#update-a-participant-resource
  await client
    .conferences(conferenceSid)
    .participants(callSid)
    .update(req.body);

  res.sendStatus(200);
});

router.post('/conferences/:conferenceSid/participants/add/:recipient', async (req, res) => {
  const { conferenceSid } = req.params;
  let recipient = req.params.recipient;
  recipient = isPhoneNumber(recipient) ? recipient : 'client:' + recipient;

  // Add agent2 to the conference
  await client.conferences(conferenceSid).participants.create({
    label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-agent2`,
    from: callerId,
    to: recipient,
    endConferenceOnExit: true,
  });

  res.sendStatus(200);
});

export default router;
