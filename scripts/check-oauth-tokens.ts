#!/usr/bin/env tsx

/**
 * Script to check OAuth tokens and test SmartThings API access
 *
 * Usage:
 *   tsx scripts/check-oauth-tokens.ts
 */

import { getTokenStorage } from '../src/storage/token-storage.js';
import { SmartThingsClient, BearerTokenAuthenticator } from '@smartthings/core-sdk';

async function main() {
  console.log('🔍 Checking OAuth tokens...\n');

  const storage = getTokenStorage();
  const tokens = storage.getTokens('default');

  if (!tokens) {
    console.log('❌ No OAuth tokens found');
    console.log('   You need to authenticate via /auth/smartthings');
    return;
  }

  console.log('✅ OAuth tokens found');
  console.log(`   Access token: ${tokens.accessToken.substring(0, 20)}...`);
  console.log(`   Refresh token: ${tokens.refreshToken ? tokens.refreshToken.substring(0, 20) + '...' : 'none'}`);
  console.log(`   Expires at: ${tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : 'unknown'}`);
  console.log();

  // Test API access with OAuth token
  console.log('🔍 Testing API access with OAuth token...\n');

  const client = new SmartThingsClient(new BearerTokenAuthenticator(tokens.accessToken));

  try {
    // Test 1: List locations
    console.log('Test 1: Listing locations...');
    const locations = await client.locations.list();
    console.log(`✅ Success: Found ${locations.length} locations`);
    if (locations.length > 0) {
      console.log(`   First location: ${locations[0].name} (${locations[0].locationId})`);
    }
    console.log();

    // Test 2: List installed apps
    console.log('Test 2: Listing installed apps (no filter)...');
    try {
      const allApps = await client.installedApps.list({});
      console.log(`✅ Success: Found ${allApps.length} total installed apps`);

      if (allApps.length > 0) {
        allApps.forEach((app, index) => {
          console.log(`   ${index + 1}. ${app.displayName || 'Unnamed'}`);
          console.log(`      ID: ${app.installedAppId}`);
          console.log(`      Status: ${app.installedAppStatus}`);
          console.log(`      Type: ${app.installedAppType}`);
        });
      } else {
        console.log('   ⚠️  No installed apps found');
        console.log('   You need to create and install a SmartApp');
        console.log('   See: docs/SMARTAPP_SETUP.md');
      }
      console.log();

      // Test 3: List authorized apps only
      console.log('Test 3: Listing AUTHORIZED installed apps...');
      const authorizedApps = await client.installedApps.list({
        installedAppStatus: 'AUTHORIZED',
      });
      console.log(`✅ Success: Found ${authorizedApps.length} AUTHORIZED apps`);

      if (authorizedApps.length > 0) {
        console.log('\n💡 These apps can be used for subscriptions:');
        authorizedApps.forEach(app => {
          console.log(`   - ${app.displayName}: ${app.installedAppId}`);
        });
      } else if (allApps.length > 0) {
        console.log('   ⚠️  Found apps but none are AUTHORIZED');
        console.log('   Current statuses:');
        allApps.forEach(app => {
          console.log(`   - ${app.displayName}: ${app.installedAppStatus}`);
        });
      }

    } catch (error) {
      console.log(`❌ Failed to list installed apps`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log('\n   This likely means:');
      console.log('   1. OAuth token lacks required scopes');
      console.log('   2. Or you need to install a SmartApp first');
      console.log('\n   Required OAuth scopes:');
      console.log('   - r:installedapps:*');
      console.log('   - See: docs/SMARTAPP_SETUP.md for setup instructions');
    }

  } catch (error) {
    console.log(`❌ API test failed`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main();
