
const port = parseInt(process.env.PORT, 10) || 3030;
const appSid = process.env.APP_SID;
const accountSid = process.env.ACCOUNT_SID;
const apiKeySid = process.env.API_KEY_SID;
const apiKeySecret = process.env.API_KEY_SECRET;
const callerId = process.env.CALLER_ID;

if (!appSid || !accountSid || !apiKeySid || !apiKeySecret || !callerId) {
  throw new Error('Missing environment variables.');
}

const config = { port, appSid, accountSid, apiKeySid, apiKeySecret, callerId };

export default config;
