#!/usr/bin/env node

/**
 * Minimal test script to debug SmartThings API 401 issue
 *
 * This script:
 * 1. Loads OAuth token from token storage
 * 2. Makes direct API call to SmartThings
 * 3. Logs the actual HTTP request being made
 * 4. Shows response or error
 */

import { SmartThingsClient, BearerTokenAuthenticator } from '@smartthings/core-sdk';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import axios from 'axios';

// ===== TOKEN DECRYPTION =====
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
if (!TOKEN_ENCRYPTION_KEY) {
  console.error('ERROR: TOKEN_ENCRYPTION_KEY environment variable is required');
  process.exit(1);
}

const encryptionKey = crypto.scryptSync(
  TOKEN_ENCRYPTION_KEY,
  'smartthings-mcp-salt',
  32
);

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

// ===== GET OAUTH TOKEN FROM DATABASE =====
const db = new Database('./data/tokens.db');
const row = db.prepare('SELECT * FROM oauth_tokens WHERE user_id = ?').get('default');

if (!row) {
  console.error('ERROR: No OAuth token found in database');
  console.error('Run OAuth flow first: visit http://localhost:5181/auth/smartthings');
  process.exit(1);
}

const accessToken = decryptToken(
  row.access_token_encrypted,
  row.access_token_iv,
  row.access_token_auth_tag
);

console.log('✅ OAuth Token Retrieved');
console.log(`   Expires: ${new Date(row.expires_at * 1000).toISOString()}`);
console.log(`   Scopes: ${row.scope}`);
console.log(`   Token (first 20 chars): ${accessToken.substring(0, 20)}...`);
console.log();

db.close();

// ===== TEST 1: DIRECT AXIOS CALL =====
console.log('🔍 TEST 1: Direct axios call to SmartThings API');
console.log('   URL: https://api.smartthings.com/v1/devices');
console.log();

try {
  const response = await axios.get('https://api.smartthings.com/v1/devices', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  console.log('✅ Direct axios call SUCCESS');
  console.log(`   Status: ${response.status}`);
  console.log(`   Devices found: ${response.data.items.length}`);
  console.log();
} catch (error) {
  console.log('❌ Direct axios call FAILED');
  if (error.response) {
    console.log(`   Status: ${error.response.status}`);
    console.log(`   Server: ${error.response.headers.server || 'Unknown'}`);
    console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
  } else {
    console.log(`   Error: ${error.message}`);
  }
  console.log();
}

// ===== TEST 2: SMARTTHINGS SDK =====
console.log('🔍 TEST 2: SmartThings SDK call');
console.log('   Using: @smartthings/core-sdk');
console.log();

// Add axios request interceptor to log all requests
axios.interceptors.request.use(request => {
  console.log('📤 HTTP Request:', {
    method: request.method?.toUpperCase(),
    url: request.url,
    baseURL: request.baseURL,
    fullURL: request.baseURL ? `${request.baseURL}${request.url}` : request.url,
    headers: {
      ...request.headers,
      Authorization: request.headers.Authorization ? '[REDACTED]' : undefined
    }
  });
  return request;
});

try {
  const client = new SmartThingsClient(new BearerTokenAuthenticator(accessToken));
  const devices = await client.devices.list();

  console.log('✅ SmartThings SDK call SUCCESS');
  console.log(`   Devices found: ${devices.length}`);
  console.log();
} catch (error) {
  console.log('❌ SmartThings SDK call FAILED');
  if (error.response) {
    console.log(`   Status: ${error.response.status}`);
    console.log(`   Server: ${error.response.headers?.server || 'Unknown'}`);
    console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
  } else {
    console.log(`   Error: ${error.message}`);
  }
  console.log();
}

console.log('✅ Test Complete');
