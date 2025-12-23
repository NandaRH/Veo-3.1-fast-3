#!/usr/bin/env node
// Simple RSA keypair generator (PEM) for activation workflow
// Writes to ./license/public_key.pem and ./license/private_key.pem by default

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const outDir = path.resolve(process.cwd(), 'license');
fs.mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const pubPath = path.join(outDir, 'public_key.pem');
const privPath = path.join(outDir, 'private_key.pem');

fs.writeFileSync(pubPath, publicKey, 'utf8');
fs.writeFileSync(privPath, privateKey, 'utf8');

console.log('Generated RSA keypair:');
console.log(' Public:', pubPath);
console.log(' Private:', privPath);