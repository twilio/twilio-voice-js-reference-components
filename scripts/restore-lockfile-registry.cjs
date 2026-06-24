#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const isYarn = fs.existsSync(path.join(__dirname, '..', 'yarn.lock'));
const lockfileName = isYarn ? 'yarn.lock' : 'package-lock.json';
const lockfile = path.join(__dirname, '..', lockfileName);
const publicRegistry = isYarn ? 'https://registry.yarnpkg.com' : 'https://registry.npmjs.org';

if (!fs.existsSync(lockfile)) {
  process.exit(0);
}

const original = fs.readFileSync(lockfile, 'utf8');
const updated = original.replace(
  /https:\/\/[^/]+\/artifactory\/api\/npm\/[^/]+(\/[^\s"]+)/g,
  `${publicRegistry}$1`,
);

if (updated !== original) {
  fs.writeFileSync(lockfile, updated, 'utf8');
}
