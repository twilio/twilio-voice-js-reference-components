import bodyParser from 'body-parser';
import express from 'express';
import { readdirSync } from 'fs'
import http from 'http';
import path from 'path';
import config from './config.js';
import { WebSocketServer } from 'ws';
import OpenAI from 'openai';

const app = express();
const server = http.createServer(app);
const componentsDir = path.join(process.cwd(), 'src/components');
const { port, openaiApiKey } = config;
const wss = new WebSocketServer({ server });
const sessions = new Map();
const SYSTEM_PROMPT = 'You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.';

// Serve the public folder of each component
readdirSync(componentsDir, { withFileTypes: true })
  .filter(item => item.isDirectory())
  .forEach(async ({ name }) => {
    app.use(`/${name}`, express.static(path.join(componentsDir, name, 'public')));
    app.use(`/${name}`, (await import(path.join(componentsDir, name, 'routes.js'))).default);
  });

// Serve the SDK
app.use('/', express.static(path.join(process.cwd(), 'node_modules/@twilio/voice-sdk/dist')));

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// LLM
const openai = new OpenAI({ apiKey: openaiApiKey });
async function aiResponse(messages) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });
  return completion.choices[0].message.content;
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  ws.on('message', async (data) => {
    const message = JSON.parse(data);
    switch (message.type) {
      case 'setup':
        const callSid = message.callSid;
        console.log("Setup for call:", callSid);
        ws.callSid = callSid;
        sessions.set(callSid, [{ role: "system", content: SYSTEM_PROMPT }]);
        break;
      case 'prompt':
        console.log("Processing prompt:", message.voicePrompt);
        const conversation = sessions.get(ws.callSid);
        conversation.push({ role: "user", content: message.voicePrompt });

        const response = await aiResponse(conversation);
        conversation.push({ role: "assistant", content: response });

        ws.send(
          JSON.stringify({
            type: "text",
            token: response,
            last: true,
          })
        );
        console.log("Sent response:", response);
        break;
      case "interrupt":
        console.log("Handling interruption.");
        break;
      default:
        console.warn("Unknown message type received:", message.type);
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
