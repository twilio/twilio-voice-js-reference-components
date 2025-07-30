import bodyParser from 'body-parser';
import config from './config.js';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { readdirSync } from 'fs'

const app = express();
const server = http.createServer(app);
const componentsDir = path.join(process.cwd(), 'src/components');
const { port } = config;

// Serve the public folder of each component
readdirSync(componentsDir, { withFileTypes: true })
  .filter(item => item.isDirectory())
  .forEach(async ({ name }) => {
    app.use(`/${name}`, express.static(path.join(componentsDir, name, 'public')));
    app.use(`/${name}`, (await import(path.join(componentsDir, name, 'routes.js'))).default);

    const indexPath = path.join(componentsDir, name, 'index.js');
    if (fs.existsSync(indexPath)) {
      const indexModule = await import(indexPath);
      indexModule.default(server);
    }
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

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
