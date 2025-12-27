#!/usr/bin/env node

/**
 * Debug script to decrypt OAuth token and test SmartThings API
 *
 * Usage: node scripts/debug-oauth-token.js
 */

import crypto from 'crypto';
import Database from 'better-sqlite3';

// Load environment
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'test-secret-key-for-development-only-do-not-use-in-production';

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
  process.exit(1);
}

console.log('Token metadata:');
console.log('  Created:', new Date(row.created_at * 1000).toISOString());
console.log('  Expires:', new Date(row.expires_at * 1000).toISOString());
console.log('  Scope:', row.scope);
console.log('  Encrypted token length:', row.access_token_encrypted.length);
console.log('  IV length:', row.access_token_iv.length);
console.log('  Auth tag length:', row.access_token_auth_tag.length);

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

try {
  const accessToken = decryptToken(
    row.access_token_encrypted,
    row.access_token_iv,
    row.access_token_auth_tag
  );

  console.log('\nDecrypted access token:');
  console.log('  Length:', accessToken.length);
  console.log('  Prefix:', accessToken.substring(0, 20) + '...');
  console.log('  Format:', /^[A-Za-z0-9-_]+$/.test(accessToken) ? 'Valid (alphanumeric+dash)' : 'INVALID');

  // Test the token with SmartThings API
  console.log('\nTesting token with SmartThings API...');

  const response = await fetch('https://api.smartthings.com/v1/locations', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  console.log('  Status:', response.status, response.statusText);
  console.log('  Headers:', Object.fromEntries(response.headers.entries()));

  if (response.ok) {
    const data = await response.json();
    console.log('  Locations:', data.items?.length || 0);
    console.log('  SUCCESS - Token is valid!');
  } else {
    const text = await response.text();
    console.log('  Response body:', text.substring(0, 500));
    console.log('  FAILED - Token is invalid or missing scopes');
  }

  db.close();
} catch (error) {
  console.error('\nDecryption failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
