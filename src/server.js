import Twilio from 'twilio';
import bodyParser from 'body-parser';
import express from 'express';
import { readdirSync } from 'fs'
import http from 'http';
import path from 'path';
import config from './config.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const app = express();
const server = http.createServer(app);
const { port, appSid, accountSid, apiKeySid, apiKeySecret, callerId } = config;
const client = Twilio(apiKeySid, apiKeySecret, { accountSid });
const componentsDir = path.join(process.cwd(), 'src/components');

// Serve the public folder of each component
readdirSync(componentsDir, { withFileTypes: true }).filter(item => item.isDirectory())
  .forEach(({ name }) => app.use(`/${name}`, express.static(path.join(componentsDir, name, 'public'))));

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  next();
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
