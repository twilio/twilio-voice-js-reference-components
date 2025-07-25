## Twilio Voice JavaScript Reference Components

Twilio Voice JavaScript Reference Components leverages [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) to showcase integrated backend and frontend implementations for common Twilio Voice use cases. Please visit the official [developer documentation](https://www.twilio.com/docs/voice/sdks/javascript/reference-components) for more details.

## Use cases

The reference components demonstrate several common Twilio Voice use cases. These use cases include:

- Dialer Component
  - Make outgoing calls
  - Receive incoming calls
- Basic Call Control Component (leveraging Conference)
  - Perform cold and warm transfers
  - Add or remove participants from a call
  - Hold and Resume a call
  - Mute and Unmute a call
- Monitoring calls (leveraging Conference)
  - Callee call progress
  - Conference call status
  - Quality metrics
  - Warnings
  - Errors

## Installation

1. Clone the [Twilio Voice JavaScript Reference Components](https://github.com/twilio/twilio-voice-js-reference-components) GitHub repository.

```bash
git clone https://github.com/twilio/twilio-voice-js-reference-components.git
```

2. Install the dependencies.

```bash
npm install
```

3. Create a `.env` file and populate the following environment variables under the `twilio-voice-js-reference-components` folder. Go through the [quickstarts](https://www.twilio.com/docs/voice/sdks/javascript/get-started) for more information about these variables.

```bash
# Port number to run the server on
PORT=3030

# Twilio account sid
ACCOUNT_SID=ACxxxxxxxxxxxxxx

# Twilio API key
API_KEY_SID=SKxxxxxxxxxxxxxx

# Twilio API secret
API_KEY_SECRET=xxxxxxxxxxxxxx

# Twilio TwiML App sid where the Voice Request URL is set to
# https://yourdomain/twilio-voice-dialer/twiml
# See more info about TwiML set up by visiting https://www.twilio.com/docs/voice/sdks/javascript#twiml-applications
APP_SID=APxxxxxxxxxxxxxx

# Twilio auth token
AUTH_TOKEN=xxxxxxxxxxxxxx

# Caller ID
CALLER_ID=+11234567890

# If developing locally and running the Reference Components locally, consider using a tool like ngrok to proxy the server endpoints. Once proxied, change CALLBACK_BASE_URL to the ngrok URL endpoints.
# See more info about ngrok by visiting https://ngrok.com.
CALLBACK_BASE_URL=https://foo.ngrok.dev

# Default identity to use
DEFAULT_IDENTITY=alice
```

## Run the project locally

1. Start the local server under the `twilio-voice-js-reference-components` folder.

```bash
npm start
```

2. Access the following components under the following URLs.

- Dialer related components, access [http://localhost:3030/twilio-voice-dialer?identity=bob](http://localhost:3030/twilio-voice-dialer?identity=bob).
- Call control related components, access [http://localhost:3030/twilio-voice-basic-call-control?identity=bob](http://localhost:3030/twilio-voice-basic-call-control?identity=bob).
- Monitoring related components, access [http://localhost:3030/twilio-voice-monitoring?identity=bob](http://localhost:3030/twilio-voice-monitoring?identity=bob).
