import crypto from 'crypto';
import Twilio from 'twilio';
import config from '../config.js';
import { isPhoneNumber } from './utils.js'; 
import { Threads } from 'openai/resources/beta.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const {
  accountSid,
  appSid,
  apiKeySecret,
  apiKeySid,
  callbackBaseUrl,
  callerId,
  defaultIdentity,
} = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });

/**
 * Generate a Twilio access token for the component.
 */
export const tokenHandler = (req, res) => {
  const identity = req.query.identity || defaultIdentity;
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });
  const voiceGrant = new VoiceGrant({
    incomingAllow: Boolean(identity),
    outgoingApplicationSid: appSid,
  });

  token.addGrant(voiceGrant);
  res.send({ token: token.toJwt() });
};

/**
 * Handler for the TwiML App Webhook, set in the User's Twilio Console.
 */
export const twimlHandler = (req, res, componentUrl, options = {}) => {
  console.log('=== TwiML Handler Called ===');
  console.log('Request Method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('Request Query:', JSON.stringify(req.query, null, 2));
  console.log('Request Headers:', JSON.stringify(req.headers, null, 2)); 

  const {
    calleeStatusCallbackEvent = [],
    calleeLabel = 'callee',
    callerLabel = 'caller',
    endConferenceOnExit = true,
    maxParticipants = 4,
    statusCallbackEvent = '',
  } = options;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();

  // Extract emergency parameters from request body
  const emergencyParams = {
    emergencyCallerPosition: req.body.emergencyCallerPosition || req.query.emergencyCallerPosition,
    emergencyCallerLocation: req.body.emergencyCallerLocation || req.query.emergencyCallerLocation,
    emergencyName: req.body.emergencyName || req.query.emergencyName,
    emergencyAddress: req.body.emergencyAddress || req.query.emergencyAddress,
    emergencyZipCode: req.body.emergencyZipCode || req.query.emergencyZipCode,
    emergencyCity: req.body.emergencyCity || req.query.emergencyCity,
    emergencyState: req.body.emergencyState || req.query.emergencyState,
    emergencyCountry: req.body.emergencyCountry || req.query.emergencyCountry,
  };

  // Log emergency parameters for monitoring/alerting
  if (emergencyParams.emergencyCallerPosition) {
    console.log('Emergency call initiated:', emergencyParams);
  }

  // Generates 1:1 conference
  const roomName = `conference-${crypto.randomUUID()}`;
  // Extract recipient from custom params (passed via device.connect({params: {recipient}}))
  console.log('🔍 Extracting recipient:');
  console.log('  ALL req.body keys:', Object.keys(req.body));
  console.log('  ALL req.body values:', req.body);
  console.log('  req.body.recipient:', req.body.recipient);
  console.log('  req.query.recipient:', req.query.recipient);
  console.log('  req.body.To:', req.body.To);
  console.log('  defaultIdentity:', defaultIdentity);

  // Custom params from device.connect are sent directly in req.body
  // Check multiple possible field names: recipient (regular calls), Agent (emergency calls), or To
  let recipient = req.body.recipient || req.body.Agent || req.query.recipient || defaultIdentity;
  console.log('  FINAL recipient (before formatting):', recipient);
  recipient = isPhoneNumber(recipient) ? recipient : 'client:' + recipient;
  console.log('  FINAL recipient (after formatting):', recipient);

  // Build statusCallback URL with emergency parameters
  const statusCallbackUrl = new URL(`https://${callbackBaseUrl}/${componentUrl}/conference-events`);
  console.log("Printing Emergency details:", emergencyParams);

  if (emergencyParams.emergencyCallerPosition) {
    statusCallbackUrl.searchParams.append('emergencyCallerPosition', emergencyParams.emergencyCallerPosition);
  }
  if (emergencyParams.emergencyCallerLocation) {
    statusCallbackUrl.searchParams.append('emergencyCallerLocation', emergencyParams.emergencyCallerLocation);
  }
  if (emergencyParams.emergencyName) {
    statusCallbackUrl.searchParams.append('emergencyName', emergencyParams.emergencyName);
  }
  if (emergencyParams.emergencyAddress) {
    statusCallbackUrl.searchParams.append('emergencyAddress', emergencyParams.emergencyAddress);
  }
  if (emergencyParams.emergencyZipCode) {
    statusCallbackUrl.searchParams.append('emergencyZipCode', emergencyParams.emergencyZipCode);
  }
  if (emergencyParams.emergencyCity) {
    statusCallbackUrl.searchParams.append('emergencyCity', emergencyParams.emergencyCity);
  }
  if (emergencyParams.emergencyState) {
    statusCallbackUrl.searchParams.append('emergencyState', emergencyParams.emergencyState);
  }
  if (emergencyParams.emergencyCountry) {
    statusCallbackUrl.searchParams.append('emergencyCountry', emergencyParams.emergencyCountry);
  }

  // The caller creates the conference
  dial.conference(
    {
      beep: 'false',
      endConferenceOnExit,
      maxParticipants,
      // Label to identify this participant
      participantLabel: `${
        isPhoneNumber(req.body.From) ? 'number' : 'client'
      }-${callerLabel}`,
      startConferenceOnEnter: true,
      statusCallback: statusCallbackUrl.toString(),
      statusCallbackEvent,
      waitUrl: '',
    },
    roomName
  );

  // Add the callee to the conference
  console.log('=== Conference Participant Debug ===');
  console.log('Room Name:', roomName);
  console.log('Recipient (raw):', req.query.recipient || req.body.recipient || defaultIdentity);
  console.log('Recipient (formatted):', recipient);
  console.log('Caller ID (from):', callerId);
  console.log('Is Phone Number:', isPhoneNumber(recipient));
  console.log('Participant Label:', `${isPhoneNumber(recipient) ? 'number' : 'client'}-${calleeLabel}`);
  console.log('Status Callback URL:', calleeStatusCallbackEvent.length > 0 ? `https://${callbackBaseUrl}/${componentUrl}/call-events` : 'NONE');
  console.log('Status Callback Events:', calleeStatusCallbackEvent);
  console.log('=====================================');
 
  // Add the Agent (security personnel) to the conference
  client.conferences(roomName).participants.create({
    beep: 'false',
    endConferenceOnExit: false,
    startConferenceOnEnter: true,
    from: callerId,
    // Label to identify this participant
    label: `${isPhoneNumber(recipient) ? 'number' : 'client'}-agent`,
    // Callee's progress/status
    // https://www.twilio.com/docs/voice/api/conference-participant-resource#request-body-parameters
    statusCallback:
      calleeStatusCallbackEvent.length > 0
        ? `https://${callbackBaseUrl}/${componentUrl}/call-events`
        : '',
    statusCallbackEvent: calleeStatusCallbackEvent,
    to: recipient,
  })
  .then((participant) => {
    console.log('✅ Agent participant created successfully:', {
      callSid: participant.callSid,
      label: participant.label,
      status: participant.status,
      to: recipient,
    });
  })
  .catch((error) => {
    console.error('❌ Failed to create agent participant:', {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      details: error.details,
    });
  });



  // Add the Emergency provider (933/911) to the conference
  const emergencyNumber = req.body.To;
  if (emergencyNumber && (emergencyNumber.includes('933') || emergencyNumber.includes('911'))) {
    console.log('📞 Adding emergency provider to conference:', emergencyNumber);
    client.conferences(roomName).participants.create({
      beep: 'false',
      endConferenceOnExit: false,
      startConferenceOnEnter: true,
      from: callerId,
      label: 'emergency-provider',
      to: emergencyNumber,
      // add emergencyParams here 
      // emergencyCallerPosition: emergencyParams.emergencyCallerPosition,
      // emergencyCallerLocation: emergencyParams.emergencyCallerLocation,
      // emergencyName: emergencyParams.emergencyName,
      // emergencyAddress: emergencyParams.emergencyAddress,
      // emergencyZipCode: emergencyParams.emergencyZipCode,
      // emergencyCity: emergencyParams.emergencyCity,
      // emergencyState: emergencyParams.emergencyState,
      // emergencyCountry: emergencyParams.emergencyCountry,
    })
    .then((participant) => {
      console.log('✅ Emergency provider participant created successfully:', {
        callSid: participant.callSid,
        label: participant.label,
        status: participant.status,
        to: emergencyNumber,
      });
    })
    .catch((error) => {
      console.error('❌ Failed to create emergency provider participant:', {
        message: error.message,
        code: error.code,
        moreInfo: error.moreInfo,
        details: error.details,
        emergencyNumber: emergencyNumber,
      });
    });
  }

  res.header('Content-Type', 'text/xml').status(200).send(twiml.toString());
};

/**
 * Handler for the Twilio Conference statusCallback.
 */
export const conferenceEventsHandler = async (req, res, componentUrl, options = {}) => {
  const {
    CallSid,
    ConferenceSid,
    Hold,
    Muted,
    ParticipantLabel,
    StatusCallbackEvent,
  } = req.body;
  const {
    statusCallbackEvents = [],
  } = options;

  // Extract emergency parameters from query string if present
  const emergencyParams = {
    emergencyCallerPosition: req.query.emergencyCallerPosition,
    emergencyCallerLocation: req.query.emergencyCallerLocation,
    emergencyName: req.query.emergencyName,
    emergencyAddress: req.query.emergencyAddress,
    emergencyZipCode: req.query.emergencyZipCode,
    emergencyCity: req.query.emergencyCity,
    emergencyState: req.query.emergencyState,
    emergencyCountry: req.query.emergencyCountry,
  };

  // Log emergency conference events
  if (emergencyParams.emergencyCallerPosition) {
    console.log(`Emergency conference event: ${StatusCallbackEvent}`, {
      conferenceSid: ConferenceSid,
      ...emergencyParams,
    });
  }

  let shouldSendMessage;
  switch (componentUrl) {
    case 'twilio-voice-dialer':
      shouldSendMessage = false;
      break;
    case 'twilio-voice-basic-call-control':
      shouldSendMessage = statusCallbackEvents.includes(StatusCallbackEvent);
      break;
    case 'twilio-voice-monitoring':
      shouldSendMessage = true;
      break;
    default:
      shouldSendMessage = false;
  }

  if (shouldSendMessage) {
    const participants = await client
      .conferences(ConferenceSid)
      .participants.list();

    // Send the conference sid and the other participants' callSids to any client leg.
    // The sids will be used to update the participant resource such as putting it on hold.
    participants.forEach(async (currentParticipant) => {
      if (currentParticipant.label.split('-')[0] === 'client') {
        // When the StatusCallbackEvent is 'participant-leave', the req.body contains data
        // from the participant that left the conference. Send the callSid and data of the
        // participant that left the conference to all current client legs.
        if (StatusCallbackEvent === 'participant-leave') {
          await client
            .calls(currentParticipant.callSid)
            .userDefinedMessages
            .create({
              content: JSON.stringify({
                callSid: CallSid,
                category: 'conference-status',
                conferenceSid: ConferenceSid,
                hold: Hold,
                label: ParticipantLabel,
                muted: Muted,
                remove: true,
                statusCallbackEvent: StatusCallbackEvent,
              }),
            });
        } else {
          participants
            .filter((p) => p.callSid !== currentParticipant.callSid)
            .forEach(async (otherParticipant) => {
              await client
                .calls(currentParticipant.callSid)
                .userDefinedMessages
                .create({
                  content: JSON.stringify({
                    callSid: otherParticipant.callSid,
                    category: 'conference-status',
                    conferenceSid: ConferenceSid,
                    hold: otherParticipant.hold,
                    label: otherParticipant.label,
                    muted: otherParticipant.muted,
                    remove: false,
                    statusCallbackEvent: StatusCallbackEvent,
                  }),
                });
            });
        }
      }
    });
  }

  res.sendStatus(200);
};
