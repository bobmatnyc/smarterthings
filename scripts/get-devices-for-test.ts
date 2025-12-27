#!/usr/bin/env tsx
/**
 * Get devices for rule testing
 */

import { SmartThingsAdapter } from '../src/platforms/smartthings/adapter.js';
import { getOAuthTokens } from '../src/smartthings/oauth-service.js';

async function main() {
  try {
    // Get OAuth tokens
    const tokens = await getOAuthTokens();

    if (!tokens?.accessToken) {
      console.error('No OAuth tokens available. Please authenticate first.');
      process.exit(1);
    }

    // Initialize adapter
    const adapter = new SmartThingsAdapter(tokens.accessToken);

    // Get all devices
    const devices = await adapter.getDevices();

    // Filter for guest room and downstairs
    const guestDevices = devices.filter(d =>
      d.roomName?.toLowerCase().includes('guest') ||
      d.roomName?.toLowerCase().includes('downstairs')
    );

    console.log('\n=== AVAILABLE DEVICES ===\n');
    console.log('Total devices:', devices.length);
    console.log('Guest/Downstairs devices:', guestDevices.length);

    console.log('\n=== GUEST ROOM / DOWNSTAIRS DEVICES ===\n');
    guestDevices.forEach(device => {
      console.log(`Device: ${device.name}`);
      console.log(`  ID: ${device.id}`);
      console.log(`  Room: ${device.roomName}`);
      console.log(`  Type: ${device.type}`);
      console.log(`  Capabilities:`, device.capabilities.map(c => c.capability).join(', '));
      console.log('');
    });

    // Export as JSON for easy use
    const deviceData = guestDevices.map(d => ({
      id: d.id,
      name: d.name,
      roomName: d.roomName,
      type: d.type,
      capabilities: d.capabilities.map(c => c.capability)
    }));

    console.log('\n=== JSON DATA ===\n');
    console.log(JSON.stringify(deviceData, null, 2));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
