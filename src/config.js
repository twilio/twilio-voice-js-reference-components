
const port = parseInt(process.env.PORT, 10) || 3030;
const appSid = process.env.APP_SID;
const accountSid = process.env.ACCOUNT_SID;
const apiKeySid = process.env.API_KEY_SID;
const apiKeySecret = process.env.API_KEY_SECRET;
const callerId = process.env.CALLER_ID;
const callbackBaseURL = process.env.CALLBACK_BASE_URL;
const defaultIdentity = process.env.DEFAULT_IDENTITY;

if (!appSid || !accountSid || !apiKeySid || !apiKeySecret || !callerId || !callbackBaseURL || !defaultIdentity) {
  throw new Error('Missing environment variables.');
}

const config = { port, appSid, accountSid, apiKeySid, apiKeySecret, callerId, callbackBaseURL, defaultIdentity };

export default config;
