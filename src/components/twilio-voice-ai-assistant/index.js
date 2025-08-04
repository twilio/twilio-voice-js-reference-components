import WebSocket, { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import config from '../../config.js';
import Twilio from 'twilio';

const { authToken, callbackBaseUrl, openaiApiKey } = config;
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

  const checkCRelayConnection = (headers) => 
    Twilio.validateRequest(
      authToken,
      headers['x-twilio-signature'],
      `wss://${callbackBaseUrl}/websocket`,
      {}
    );

  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    const headers = req.headers;
    
    // Validate incoming Twilio requests
    // https://www.twilio.com/docs/voice/conversationrelay/onboarding#websocket-security-with-signature-validation
    const isCRelayConnection = checkCRelayConnection(headers);

    // This broadcast method is only called from the message handler
    // of the CRelay WebSocket connection.
    function broadcastToBrowserClients(content) {
      const message = JSON.stringify({ type: 'log', content });
      // Iterate through all WebSocket connections and ignore the CRelay connection
      // since we're not sending logs to it.
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }

    function handleMessage() {
      ws.on('message', async (data) => {
        const message = JSON.parse(data);
        switch (message.type) {
          case 'setup':
            const callSid = message.callSid;
            broadcastToBrowserClients(`Setup for call: ${callSid}`);
            ws.callSid = callSid;
            sessions.set(callSid, [{ role: 'system', content: SYSTEM_PROMPT }]);
            break;
          case 'prompt':
            broadcastToBrowserClients(`Processing prompt: ${message.voicePrompt}`);
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
            broadcastToBrowserClients(`Sent response: ${response}`);
            break;
          case 'interrupt':
            broadcastToBrowserClients('Handling interruption.');
            break;
          default:
            broadcastToBrowserClients(`Unknown message type received: ${message.type}`);
            break;
        }
      });
    }

    function handleClose() {
      ws.on('close', () => {
        broadcastToBrowserClients('CRelay WebSocket connection closed');
        console.log('CRelay WebSocket connection closed');
      });
    }

    if (isCRelayConnection) {
      broadcastToBrowserClients('CRelay WebSocket connection established');
      console.log('CRelay WebSocket connection established');
      handleMessage();
      handleClose();
    } else {
      console.log('Browser WebSocket connection established');
      // This is the browser client. This is where you add your own authentication.
      ws.on('close', () => {
        console.log('Browser WebSocket connection closed');
      });
    }
  });
};

export default init;
