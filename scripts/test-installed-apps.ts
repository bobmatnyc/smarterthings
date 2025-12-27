#!/usr/bin/env tsx

/**
 * Script to list all installed SmartApps (with and without status filter)
 *
 * Usage:
 *   tsx scripts/test-installed-apps.ts
 *
 * Purpose:
 *   - Diagnose why no installed apps are being found
 *   - Check if apps exist but with different status
 *   - Provide guidance on SmartApp setup
 */

import { SmartThingsClient, BearerTokenAuthenticator, InstalledAppStatus } from '@smartthings/core-sdk';
import { config } from 'dotenv';

// Load environment variables
config();

const token = process.env.SMARTTHINGS_PAT;
if (!token) {
  console.error('❌ SMARTTHINGS_PAT not set in environment');
  process.exit(1);
}

const client = new SmartThingsClient(new BearerTokenAuthenticator(token));

async function main() {
  try {
    console.log('🔍 Fetching ALL installed apps (no status filter)...\n');

    // List without status filter
    const allApps = await client.installedApps.list({});

    console.log(`📊 Total installed apps: ${allApps.length}\n`);

    if (allApps.length === 0) {
      console.log('⚠️  No installed apps found. You need to install a SmartApp first.\n');
      console.log('📝 Setup Instructions:\n');
      console.log('1. Go to SmartThings Developer Workspace:');
      console.log('   https://smartthings.developer.samsung.com/workspace/projects\n');
      console.log('2. Create a new project or use existing one');
      console.log('3. Create a SmartApp with required scopes:');
      console.log('   - r:devices:*');
      console.log('   - x:devices:*');
      console.log('   - r:locations:*\n');
      console.log('4. Install the SmartApp to your location');
      console.log('5. Authorize it with the required scopes\n');
      console.log('See: docs/SMARTAPP_SETUP.md for detailed instructions');
      return;
    }

    console.log('═══════════════════════════════════════════════════════\n');

    allApps.forEach((app, index) => {
      console.log(`📱 App ${index + 1}`);
      console.log(`   ID: ${app.installedAppId}`);
      console.log(`   Name: ${app.displayName || 'Unnamed App'}`);
      console.log(`   Type: ${app.installedAppType}`);
      console.log(`   Status: ${app.installedAppStatus} ${app.installedAppStatus === InstalledAppStatus.AUTHORIZED ? '✅' : '⚠️'}`);
      console.log(`   Location: ${app.locationId}`);
      console.log(`   Classifications: ${app.classifications?.join(', ') || 'None'}`);
      console.log(`   Created: ${app.createdDate}`);
      console.log(`   Updated: ${app.lastUpdatedDate}`);
      console.log();
    });

    console.log('═══════════════════════════════════════════════════════\n');

    // Now test with AUTHORIZED filter (what the app uses)
    console.log('🔍 Fetching AUTHORIZED installed apps only...\n');
    const authorizedApps = await client.installedApps.list({
      installedAppStatus: InstalledAppStatus.AUTHORIZED,
    });

    console.log(`📊 AUTHORIZED apps: ${authorizedApps.length}\n`);

    if (authorizedApps.length === 0 && allApps.length > 0) {
      console.log('⚠️  WARNING: Found apps but none are AUTHORIZED!');
      console.log('   You need to authorize your SmartApp before it can be used for subscriptions.\n');
      console.log('   Current app statuses:');
      allApps.forEach(app => {
        console.log(`   - ${app.displayName}: ${app.installedAppStatus}`);
      });
    } else if (authorizedApps.length > 0) {
      console.log('✅ Found authorized apps that can be used for subscriptions:');
      authorizedApps.forEach(app => {
        console.log(`   - ${app.displayName} (${app.installedAppId})`);
      });
      console.log('\n💡 Use this installedAppId for subscription setup.');
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

main();
