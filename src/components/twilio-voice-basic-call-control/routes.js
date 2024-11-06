import { Router } from 'express';
import Twilio from 'twilio';
import config from '../../config.js';
import { isPhoneNumber } from '../../utils.js';

const VoiceResponse = Twilio.twiml.VoiceResponse;

const router = Router();
const { accountSid, apiKeySid, apiKeySecret, authToken, callerId, callbackBaseURL } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

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

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/twiml', Twilio.webhook({protocol: 'https'}, authToken), (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial();

  // Generates 1:1 conference
  const roomName = `conference-${crypto.randomUUID()}`;
  let recipient = req.body.recipient || defaultIdentity;
  recipient = isPhoneNumber(recipient) ? recipient : 'client:' + recipient;

  // The caller creates the conference
  dial.conference({
    // Caller is agent1
    participantLabel: `${isPhoneNumber(req.body.From) ? 'number' : 'client'}-agent1`,
    // Allow for extra agent needed for warm transfer
    maxParticipants: 3,
    startConferenceOnEnter: true,
    // Allow agent1 to leave call, and have agent2 maintain call with customer 
    endConferenceOnExit: false,
    statusCallback: `${callbackBaseURL}/twilio-voice-basic-call-control/conference-events`,
    statusCallbackEvent: 'join',
  }, roomName);

  // Add the customer to the conference
  client.conferences(roomName).participants.create({
    label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-customer`,
    from: callerId,
    to: recipient,
    endConferenceOnExit: true,
  });

  res
    .header('Content-Type', 'text/xml')
    .status(200)
    .send(twiml.toString());
});

// Validate incoming Twilio requests
// https://www.twilio.com/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests
router.post('/conference-events', Twilio.webhook({protocol: 'https'}, authToken), async (req, res) => {
  const { ConferenceSid, StatusCallbackEvent } = req.body;

  if (StatusCallbackEvent === 'participant-join') {
    const participants = await client.conferences(ConferenceSid).participants.list();

    // Send the conference sid and the other participants' callSids to any client leg.
    // The sids will be used to update the participant resource such as putting it on hold.
    participants.forEach((currentParticipant) => {
      if (currentParticipant.label.split('-')[0] === 'client') {
        participants.filter((p) => p.callSid !== currentParticipant.callSid).forEach(async (otherParticipant) => {
          await client
            .calls(currentParticipant.callSid)
            .userDefinedMessages
            .create({content: JSON.stringify({
              conferenceSid: ConferenceSid,
              callSid: otherParticipant.callSid,
              label: otherParticipant.label,
              muted: otherParticipant.muted,
              hold: otherParticipant.hold,
            })});
        });
      }
    });
  }

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
