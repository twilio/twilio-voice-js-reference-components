import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import { isPhoneNumber } from '../../common/utils.js';
import {
  tokenHandler,
  conferenceEventsHandler,
  twimlHandler,
} from '../../common/routes.js';

const router = Router();
const { accountSid, apiKeySid, apiKeySecret, authToken, callerId } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });
const componentUrl = 'twilio-voice-basic-call-control'; 

// Add your own authentication mechanism here to make sure this endpoint is only accessible to authorized users.
router.get('/token', (req, res) => tokenHandler(req, res));

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({ protocol: 'https' }, authToken), async (req, res) => {
  try {
    await twimlHandler(req, res, componentUrl, {
      callerLabel: 'agent1',
      calleeLabel: 'customer',
      // 3 participants needed for warm transfer: agent1, agent2, and customer.
      maxParticipants: 3,
      // Allow agent1 to drop from call, while agent2 and customer continue call.
      endConferenceOnExit: false,
      statusCallbackEvent: 'join leave mute hold',
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
router.post('/conference-events', Twilio.webhook({ protocol: 'https' }, authToken), (req, res) =>
  conferenceEventsHandler(
    req,
    res,
    componentUrl,
    {
      statusCallbackEvents: [
        'participant-join',
        'participant-mute',
        'participant-unmute',
        'participant-hold',
        'participant-unhold',
        'participant-leave',
      ],
    }
  )
);

router.post('/conferences/:conferenceSid/participants', async (req, res) => {
  const { conferenceSid } = req.params;
  let to = req.body.to;
  to = isPhoneNumber(to) ? to : 'client:' + to;

  try {
    // Add agent2 to the conference
    await client.conferences(conferenceSid).participants.create({
      label: `${isPhoneNumber(to) ? 'number' : 'client'}-agent2`,
      from: callerId,
      to,
      endConferenceOnExit: true,
    });
    res.sendStatus(200);
  } catch (error) {
    console.error(`Failed to add participant to conference ${conferenceSid}:`, error);
    res.status(500).send({ error: 'Failed to add participant to conference' });
  }
});

router.post('/conferences/:conferenceSid/participants/:callSid', async (req, res) => {
  const { callSid, conferenceSid } = req.params;

  // Whitelist only the fields the UI controls. Passing req.body straight to
  // update() would forward arbitrary Participant resource fields (e.g.
  // coaching, callSidToCoach), letting anyone with a valid token set sensitive
  // params. https://www.twilio.com/docs/voice/api/conference-participant-resource#update-a-participant-resource
  const update = {};
  if ('hold' in req.body) update.hold = req.body.hold;
  if ('muted' in req.body) update.muted = req.body.muted;

  try {
    // Update a Participant resource
    await client
      .conferences(conferenceSid)
      .participants(callSid)
      .update(update);
    res.sendStatus(200);
  } catch (error) {
    console.error(`Failed to update participant ${callSid} in conference ${conferenceSid}:`, error);
    res.status(500).send({ error: 'Failed to update conference participant' });
  }
});

router.delete('/conferences/:conferenceSid/participants/:callSid', async (req, res) => {
  const { callSid, conferenceSid } = req.params;

  try {
    // Delete a Participant resource
    // https://www.twilio.com/docs/voice/api/conference-participant-resource#delete-a-participant-resource
    await client
      .conferences(conferenceSid)
      .participants(callSid)
      .remove();
    res.sendStatus(200);
  } catch (error) {
    console.error(`Failed to remove participant ${callSid} from conference ${conferenceSid}:`, error);
    res.status(500).send({ error: 'Failed to remove conference participant' });
  }
});

export default router;
