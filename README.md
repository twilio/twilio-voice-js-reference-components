## Twilio Voice JavaScript Reference Components

Twilio Voice JavaScript Reference Components leverages [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) to showcase integrated backend and frontend implementations for common Twilio Voice use cases. Please visit the official [developer documentation](https://www.twilio.com/docs/voice/sdks/javascript/reference-components) for more details.

## Use cases

The reference components demonstrate several common Twilio Voice use cases. These use cases include:

- Dialer
  - Place outgoing calls
  - Receive incoming calls
- Basic Call Control (uses Conference)
  - Perform cold or warm transfers
  - Add or remove participants from a call
  - Hold and Resume a call
  - Mute and Unmute a call
- Monitoring (uses Conference)
  - Observe call progress
  - Track conference call status
  - View quality metrics
  - Receive warnings
  - View errors
- Emergency Conference (uses Conference)
  - Make emergency calls (933/911) with security agent escalation
  - Pass emergency location metadata (GPS coordinates, address, etc.)
  - Track emergency parameters through conference lifecycle
  - Multi-party conference with caller, emergency provider, and security agent
- Voice AI Conversation
  - Place an outbound call and connect to an agent
  - Provide a Websocket server to interface with Conversation Relay
  - Basic OpenAI integration

## Installation

1. Clone the [Twilio Voice JavaScript Reference Components](https://github.com/twilio/twilio-voice-js-reference-components) GitHub repository.

```bash
git clone https://github.com/twilio/twilio-voice-js-reference-components.git
```

2. Install the dependencies.

```bash
npm install
```

3. Copy `example.env` to `.env`, then supply the required values. For details about each variable, see the [quickstart](https://www.twilio.com/docs/voice/sdks/javascript/get-started).

```bash
cp example.env .env
```

4. In the Twilio Console, open your **TwiML App** settings and set **Voice Request URL** to the endpoint for the component you want to test:

```text
https://yourdomain/twilio-voice-dialer/twiml
https://yourdomain/twilio-voice-basic-call-control/twiml
https://yourdomain/twilio-voice-monitoring/twiml
https://yourdomain/twilio-voice-emergency/twiml
https://yourdomain/twilio-voice-ai-conversation/twiml
```

## Run the project locally

1. Start the local server under the `twilio-voice-js-reference-components` folder.

```bash
npm start
```

2. Open a browser and navigate to a component URL.

- Dialer: [http://localhost:3030/twilio-voice-dialer?identity=bob](http://localhost:3030/twilio-voice-dialer?identity=bob).
- Basic Call Control: [http://localhost:3030/twilio-voice-basic-call-control?identity=bob](http://localhost:3030/twilio-voice-basic-call-control?identity=bob).
- Monitoring: [http://localhost:3030/twilio-voice-monitoring?identity=bob](http://localhost:3030/twilio-voice-monitoring?identity=bob).
- Emergency Conference: [http://localhost:3030/test-emergency-call.html](http://localhost:3030/test-emergency-call.html)
- Voice AI Conversation: [http://localhost:3030/twilio-voice-ai-conversation?identity=bob](http://localhost:3030/twilio-voice-ai-conversation?identity=bob).

## Emergency Conference

Make emergency calls (933/911) with simultaneous connection to security agents and location metadata.

### How Emergency Details Are Passed

#### 1. Client Side - Pass emergency parameters via `device.connect()`

```javascript
const call = await device.connect({
  params: {
    To: '+1933',                          // Emergency number
    Agent: 'bob',                         // Security agent
    emergencyCallerPosition: '41.10 39.8', // GPS coordinates
    emergencyCallerLocation: 'Floor 3 Cubicle 2',
    emergencyName: 'Twilio Inc',
    emergencyAddress: '101 Spear Drive',
    emergencyZipCode: '94105',
    emergencyCity: 'San Francisco',
    emergencyState: 'CA',
    emergencyCountry: 'USA'
  }
});
```

#### 2. Server Side - Extract parameters in TwiML handler

Parameters are received in `req.body` at your TwiML endpoint (`/twilio-voice-emergency/twiml`):

```javascript
const emergencyParams = {
  emergencyCallerPosition: req.body.emergencyCallerPosition,
  emergencyCallerLocation: req.body.emergencyCallerLocation,
  emergencyName: req.body.emergencyName,
  emergencyAddress: req.body.emergencyAddress,
  emergencyZipCode: req.body.emergencyZipCode,
  emergencyCity: req.body.emergencyCity,
  emergencyState: req.body.emergencyState,
  emergencyCountry: req.body.emergencyCountry,
};
```

#### 3. Pass to Emergency Participant API Call

Emergency details must be passed when creating the emergency provider participant:

```javascript
const emergencyNumber = req.body.To; // e.g., '+1933'

client.conferences(roomName).participants.create({
  beep: 'false',
  from: callerId,
  to: emergencyNumber,
  label: 'emergency-provider',
  // Pass emergency parameters to the emergency provider
  emergencyCallerPosition: emergencyParams.emergencyCallerPosition,
  emergencyCallerLocation: emergencyParams.emergencyCallerLocation,
  emergencyName: emergencyParams.emergencyName,
  emergencyAddress: emergencyParams.emergencyAddress,
  emergencyZipCode: emergencyParams.emergencyZipCode,
  emergencyCity: emergencyParams.emergencyCity,
  emergencyState: emergencyParams.emergencyState,
  emergencyCountry: emergencyParams.emergencyCountry,
});
```

**Note:** In `src/common/routes.js` (lines 203-211), these parameters are currently commented out. Uncomment them to pass emergency details to the participant creation API.

### Quick Test

1. Start server: `npm start`
2. Open [http://localhost:3030/test-emergency-call.html](http://localhost:3030/test-emergency-call.html)
3. Click "Initialize Device"
4. Fill emergency details (pre-filled with examples)
5. Click "Make Emergency Call"
6. Check server console for emergency parameter logs

### Configuration

Set TwiML App Voice Request URL in Twilio Console:
```
https://yourdomain/twilio-voice-emergency/twiml
```