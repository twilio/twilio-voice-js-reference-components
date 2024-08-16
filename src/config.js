
const port = parseInt(process.env.PORT, 10) || 3030;
const appSid = process.env.APP_SID;
const accountSid = process.env.ACCOUNT_SID;
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const callerId = process.env.CALLER_ID;

if (!appSid || !accountSid || !apiKey || !apiSecret || !callerId) {
  console.log('Missing environment variables.\n');
  process.exit();
}

const config = { port, appSid, accountSid, apiKey, apiSecret, callerId };

export default config;
