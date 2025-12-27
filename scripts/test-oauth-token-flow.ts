#!/usr/bin/env ts-node
/**
 * Test OAuth token flow from storage to API call.
 *
 * This script tests:
 * 1. Token retrieval from database
 * 2. Token decryption
 * 3. OAuthTokenAuthenticator initialization
 * 4. authenticate() method output
 * 5. SmartThings API call with OAuth token
 *
 * Usage: ts-node scripts/test-oauth-token-flow.ts
 */

import { getTokenStorage } from '../src/storage/token-storage.js';
import { OAuthTokenAuthenticator } from '../src/smartthings/oauth-authenticator.js';
import { SmartThingsOAuthService } from '../src/smartthings/oauth-service.js';
import { environment } from '../src/config/environment.js';
import { SmartThingsClient } from '@smartthings/core-sdk';

async function testOAuthTokenFlow() {
  console.log('=== OAuth Token Flow Test ===\n');

  // Step 1: Get tokens from storage
  console.log('Step 1: Retrieving tokens from database...');
  const tokenStorage = getTokenStorage();
  const tokens = tokenStorage.getTokens('default');

  if (!tokens) {
    console.error('❌ No tokens found in storage');
    process.exit(1);
  }

  console.log('✅ Tokens retrieved successfully');
  console.log('  - Access token length:', tokens.accessToken.length);
  console.log('  - Refresh token length:', tokens.refreshToken.length);
  console.log('  - Expires at:', new Date(tokens.expiresAt * 1000).toISOString());
  console.log('  - Scope:', tokens.scope);
  console.log('  - Token preview:', tokens.accessToken.substring(0, 20) + '...');

  // Step 2: Create OAuth authenticator
  console.log('\nStep 2: Creating OAuth authenticator...');
  try {
    const oauthService = new SmartThingsOAuthService({
      clientId: environment.SMARTTHINGS_CLIENT_ID!,
      clientSecret: environment.SMARTTHINGS_CLIENT_SECRET!,
      redirectUri: environment.OAUTH_REDIRECT_URI || '',
      stateSecret: environment.OAUTH_STATE_SECRET || '',
    });

    const authenticator = new OAuthTokenAuthenticator(tokenStorage, oauthService, 'default');
    console.log('✅ OAuth authenticator created');

    // Step 3: Call authenticate() to get headers
    console.log('\nStep 3: Calling authenticate() to get headers...');
    const headers = await authenticator.authenticate();
    console.log('✅ authenticate() returned headers:');
    console.log('  - Headers:', JSON.stringify(headers, null, 2));

    // Step 4: Verify Authorization header format
    console.log('\nStep 4: Verifying Authorization header...');
    if (!headers.Authorization) {
      console.error('❌ Missing Authorization header!');
      process.exit(1);
    }

    if (!headers.Authorization.startsWith('Bearer ')) {
      console.error('❌ Authorization header does not start with "Bearer "!');
      console.log('  - Actual value:', headers.Authorization);
      process.exit(1);
    }

    const bearerToken = headers.Authorization.substring(7); // Remove "Bearer " prefix
    console.log('✅ Authorization header format is correct');
    console.log('  - Bearer token preview:', bearerToken.substring(0, 20) + '...');
    console.log('  - Bearer token length:', bearerToken.length);

    // Step 5: Compare with stored token
    console.log('\nStep 5: Comparing bearer token with stored token...');
    if (bearerToken !== tokens.accessToken) {
      console.error('❌ Bearer token does NOT match stored access token!');
      console.log('  - Expected:', tokens.accessToken.substring(0, 20) + '...');
      console.log('  - Got:', bearerToken.substring(0, 20) + '...');
      process.exit(1);
    }
    console.log('✅ Bearer token matches stored access token');

    // Step 6: Test actual API call
    console.log('\nStep 6: Testing SmartThings API call...');
    const client = new SmartThingsClient(authenticator);

    try {
      const locations = await client.locations.list();
      console.log('✅ API call successful!');
      console.log('  - Locations retrieved:', locations.length);
      locations.forEach((loc) => {
        console.log(`    - ${loc.name} (${loc.locationId})`);
      });
    } catch (error: any) {
      console.error('❌ API call failed!');
      console.error('  - Error:', error.message);
      if (error.response) {
        console.error('  - Status:', error.response.status);
        console.error('  - Status text:', error.response.statusText);
        console.error('  - Response data:', JSON.stringify(error.response.data, null, 2));
      }
      process.exit(1);
    }

    console.log('\n=== All tests passed! ✅ ===');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

testOAuthTokenFlow();
