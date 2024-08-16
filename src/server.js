import { default as Twilio } from 'twilio';
import { default as bodyParser } from 'body-parser';
import { default as express } from 'express';
import { default as http } from 'http';
import { default as path } from 'path';
import config from './config.js';

const AccessToken = Twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = Twilio.twiml.VoiceResponse;

const app = express();
const server = http.createServer(app);
const { port, appSid, accountSid, apiKey, apiSecret, callerId } = config;
const client = Twilio(apiKey, apiSecret, { accountSid });
const webDir = path.join(process.cwd(), 'src/public');

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', express.static(webDir));

app.use((req, res, next) => {
  console.log('Received request for: ' + req.url);
  next();
});

app.get('/token', (req, res) => {
  const identity = req.query.identity;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: !!identity,
  });

  const token = new AccessToken(accountSid, apiKey, apiSecret, { identity, ttl: 3600 });

  token.addGrant(voiceGrant);

  res.send({ token: token.toJwt() });
});

app.post('/twiml', (req, res) => {
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  const roomName = 'My Conference';

  let recipient = req.body.recipient;
  recipient = /^[\d\+\-\(\) ]+$/.test(recipient) ? recipient : 'client:' + recipient;

  client.conferences(roomName).participants.create({ from: callerId, to: recipient });
  dial.conference(roomName, {
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
  });

  res
    .header('Content-Type', 'text/xml')
    .status(200)
    .send(twiml.toString());
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
