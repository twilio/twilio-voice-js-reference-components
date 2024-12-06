## Twilio Voice JavaScript Reference Components

Twilio Voice JavaScript Reference Components leverages [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) to showcase integrated backend and frontend implementations for common Twilio Voice use cases. Please visit the official [developer documentation](https://www.twilio.com/docs/voice/sdks/javascript/reference-components) for more details.

## Installation

1. Clone the [Twilio Voice JavaScript Reference Components](https://github.com/twilio/twilio-voice-js-reference-components) GitHub repository.

```bash
git clone https://github.com/twilio/twilio-voice-js-reference-components.git
```

2. Create a `.env` file and initialize the following environment variables under the `twilio-voice-js-reference-components` folder. Go through the [quickstarts](https://www.twilio.com/docs/voice/sdks/javascript/get-started) for more information about these variables.

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
APP_SID=APxxxxxxxxxxxxxx

# Twilio auth token
AUTH_TOKEN=xxxxxxxxxxxxxx

# Caller ID
CALLER_ID=+11234567890

# Callback base URL
CALLBACK_BASE_URL=https://foo.ngrok.dev

# Default identity to use
DEFAULT_IDENTITY=alice
```

3. Install the dependencies.

```bash
npm install
```

## Run the project locally

1. Start the local server under the `twilio-voice-js-reference-components` folder.

```bash
npm start
```

2. Access the following components under the following urls.

- Dialer related components, access [http://localhost:3030/twilio-voice-dialer](http://localhost:3030/twilio-voice-dialer).
- Call control related components, access [http://localhost:3030/twilio-voice-basic-call-control](http://localhost:3030/twilio-voice-basic-call-control).
