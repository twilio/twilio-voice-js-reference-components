## Twilio Voice JavaScript Reference Components

Twilio Voice JavaScript Reference Components leverages [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) to showcase integrated backend and frontend implementations for common Twilio Voice use cases. Please visit the official [developer documentation](https://www.twilio.com/docs/voice/sdks/javascript/reference-components) for more details.

## Use cases

The reference components demonstrate several common Twilio Voice use cases. These use cases include:

- Dialer
  - Make outgoing calls
  - Receive incoming calls
- Basic Call Control (leveraging Conference)
  - Perform cold and warm transfers
  - Add or remove participants from a call
  - Hold and Resume a call
  - Mute and Unmute a call
- Monitoring (leveraging Conference)
  - Callee call progress
  - Conference call status
  - Quality metrics
  - Warnings
  - Errors
- Voice AI Assistant
  - Make outgoing call to connect with an agent
  - Websocket server
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

3. Create a `.env` file from the `example.env` file. Go through the [quickstarts](https://www.twilio.com/docs/voice/sdks/javascript/get-started) for more information about these variables.

```bash
cp example.env .env
```

4. In the Twilio Console, navigate to your `TwiML App` settings and set the `Voice Request URL` to the URL endpoint of your desired component. Options:

```bash
https://yourdomain/twilio-voice-dialer/twiml
https://yourdomain/twilio-voice-basic-call-control/twiml
https://yourdomain/twilio-voice-monitoring/twiml
https://yourdomain/twilio-voice-ai-assistant/twiml
```

## Run the project locally

1. Start the local server under the `twilio-voice-js-reference-components` folder.

```bash
npm start
```

- Note: if you're using `bash/zsh` format your `.env` like so:

```bash
export ACCOUNT_SID=ACxxxxxxxxxxxxxx
```

- Then, under the `twilio-voice-js-reference-components` folder run:

```bash
source .env && npm start
```

- Note: running `source .env` will cause environment variables to persist in your shell session, and will be available to all processes afterwards.

2. Access the following components under the following URLs.

- Dialer, access [http://localhost:3030/twilio-voice-dialer?identity=bob](http://localhost:3030/twilio-voice-dialer?identity=bob).
- Basic Call Control, access [http://localhost:3030/twilio-voice-basic-call-control?identity=bob](http://localhost:3030/twilio-voice-basic-call-control?identity=bob).
- Monitoring, access [http://localhost:3030/twilio-voice-monitoring?identity=bob](http://localhost:3030/twilio-voice-monitoring?identity=bob).
- Voice AI Assistant, access [http://localhost:3030/twilio-voice-ai-assistant?identity=bob](http://localhost:3030/twilio-voice-ai-assistant?identity=bob).