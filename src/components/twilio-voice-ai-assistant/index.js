import { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import config from '../../config.js';

const { openaiApiKey } = config;
const sessions = new Map();
const SYSTEM_PROMPT = 'You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.';

const init = (server) => {
  const wss = new WebSocketServer({ server });

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
};

export default init;
