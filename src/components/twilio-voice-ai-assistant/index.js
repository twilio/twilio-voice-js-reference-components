import WebSocket, { WebSocketServer } from 'ws';
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
      model: 'gpt-4o-mini',
      messages,
    });
    return completion.choices[0].message.content;
  }

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    function broadcastLog(content) {
      const message = JSON.stringify({ type: 'log', content });
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
    broadcastLog('WebSocket connection established');

    ws.on('message', async (data) => {
      const message = JSON.parse(data);
      switch (message.type) {
        case 'setup':
          const callSid = message.callSid;
          broadcastLog(`Setup for call: ${callSid}`);
          ws.callSid = callSid;
          sessions.set(callSid, [{ role: 'system', content: SYSTEM_PROMPT }]);
          break;
        case 'prompt':
          broadcastLog(`Processing prompt: ${message.voicePrompt}`);
          const conversation = sessions.get(ws.callSid);
          conversation.push({ role: 'user', content: message.voicePrompt });

          const response = await aiResponse(conversation);
          conversation.push({ role: 'assistant', content: response });

          ws.send(
            JSON.stringify({
              type: 'text',
              token: response,
              last: true,
            })
          );
          broadcastLog(`Sent response: ${response}`);
          break;
        case 'interrupt':
          broadcastLog('Handling interruption.');
          break;
        default:
          broadcastLog(`Unknown message type received: ${message.type}`);
          break;
      }
    });

    ws.on('close', () => {
      broadcastLog('WebSocket connection closed');
    });
  });
};

export default init;
