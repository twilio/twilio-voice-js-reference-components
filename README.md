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
- Voice AI Conversation
  - Place an outbound call and connect to an agent
  - Provide a Websocket server to interface with Conversation Relay
  - Basic OpenAI integration
- Noise Cancellation
  - Denoise the outgoing microphone audio with RNNoise
  - Denoise the incoming call audio with RNNoise
  - Toggle each direction independently during a call

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

4. Expose your local server to the public internet so Twilio can reach it for webhooks. If you run the components locally, use a tunneling service such as [ngrok](https://ngrok.com/).

```bash
ngrok http 3030
```

Copy the forwarding host that ngrok prints (e.g. `abc123.ngrok-free.app`) and set it as `CALLBACK_BASE_URL` in your `.env` — **without** the `https://` scheme, since the code prepends `https://` / `wss://` itself. If you changed `PORT`, tunnel to that port instead of `3030`.

5. In the Twilio Console, open your **TwiML App** settings and set **Voice Request URL** to the endpoint for the component you want to test, using your public host from step 4 in place of `yourdomain`:

```text
https://yourdomain/twilio-voice-dialer/twiml
https://yourdomain/twilio-voice-basic-call-control/twiml
https://yourdomain/twilio-voice-monitoring/twiml
https://yourdomain/twilio-voice-ai-conversation/twiml
https://yourdomain/twilio-voice-noise-cancellation/twiml
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
- Voice AI Conversation: [http://localhost:3030/twilio-voice-ai-conversation?identity=bob](http://localhost:3030/twilio-voice-ai-conversation?identity=bob).
- Noise Cancellation: [http://localhost:3030/twilio-voice-noise-cancellation?identity=bob](http://localhost:3030/twilio-voice-noise-cancellation?identity=bob).