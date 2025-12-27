#!/usr/bin/env node

/**
 * Test OAuth token with SmartThings SDK
 *
 * Usage: node scripts/test-oauth-api-call.js
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { SmartThingsClient, BearerTokenAuthenticator } from '@smartthings/core-sdk';

// Load environment
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!TOKEN_ENCRYPTION_KEY) {
  console.error('TOKEN_ENCRYPTION_KEY not set in environment');
  process.exit(1);
}

// Derive encryption key
const encryptionKey = crypto.scryptSync(
  TOKEN_ENCRYPTION_KEY,
  'smartthings-mcp-salt',
  32
);

// Open database
const db = new Database('./data/tokens.db');

// Get encrypted token
const row = db.prepare('SELECT * FROM oauth_tokens WHERE user_id = ?').get('default');

if (!row) {
  console.error('No tokens found for user "default"');
  db.close();
  process.exit(1);
}

// Decrypt access token
function decryptToken(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

const accessToken = decryptToken(
  row.access_token_encrypted,
  row.access_token_iv,
  row.access_token_auth_tag
);

console.log('Decrypted token:', accessToken.substring(0, 20) + '...');
console.log('Token length:', accessToken.length);

// Create SmartThings client with decrypted token
const client = new SmartThingsClient(new BearerTokenAuthenticator(accessToken));

console.log('\nTesting SmartThings SDK client...');

try {
  // Test locations API
  console.log('\n1. Testing locations.list()...');
  const locations = await client.locations.list();
  console.log('  SUCCESS - Locations:', locations.length);
  locations.forEach(loc => console.log(`    - ${loc.name} (${loc.locationId})`));

  // Test rooms API (using first location)
  if (locations.length > 0) {
    const locationId = locations[0].locationId;
    console.log(`\n2. Testing rooms.list(${locationId})...`);
    const rooms = await client.rooms.list(locationId);
    console.log('  SUCCESS - Rooms:', rooms.length);
    rooms.forEach(room => console.log(`    - ${room.name} (${room.roomId})`));
  }

  // Test devices API
  console.log('\n3. Testing devices.list()...');
  const devices = await client.devices.list();
  console.log('  SUCCESS - Devices:', devices.length);
  devices.slice(0, 5).forEach(device => console.log(`    - ${device.label || device.name} (${device.deviceId})`));

  console.log('\n✅ All tests passed! OAuth token is working correctly.');

  db.close();
} catch (error) {
  console.error('\n❌ API call failed:', error.message);
  console.error('\nFull error:', error);
  db.close();
  process.exit(1);
}
