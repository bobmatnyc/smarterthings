/**
 * Direct Mode API - Automation Example
 *
 * Demonstrates comprehensive automation workflows including:
 * - Template discovery and selection
 * - Automation configuration validation
 * - Rule creation with proper device validation
 * - Automation testing before deployment
 * - Rule updates and lifecycle management
 * - Manual execution and monitoring
 *
 * Usage:
 *   SMARTTHINGS_TOKEN=your-token-here ts-node examples/direct-mode/automation-example.ts
 */

import { createToolExecutor, isSuccess, isError } from '../../src/direct/index.js';
import { ServiceContainer } from '../../src/services/ServiceContainer.js';
import { SmartThingsService } from '../../src/lib/smartthings-client.js';
import type { LocationId, DeviceId } from '../../src/types/smartthings.js';
import type { AutomationConfig, AutomationTemplate } from '../../src/types/automation.js';

/**
 * Step 1: Discover available automation templates.
 */
async function discoverTemplates(executor: any) {
  console.log('\n=== Step 1: Discover Automation Templates ===');

  const result = await executor.getAutomationTemplate();

  if (isSuccess(result)) {
    console.log('✓ Available templates:\n');

    // Result contains template metadata
    const templates = result.data;

    if (Array.isArray(templates)) {
      templates.forEach((template: any) => {
        console.log(`- ${template.id}: ${template.name}`);
        console.log(`  Description: ${template.description}`);
        console.log(`  Use case: ${template.useCase || 'General automation'}`);
        console.log();
      });
    } else {
      console.log('Templates:', templates);
    }

    console.log('Common templates:');
    console.log('- motion_lights: Motion-activated lighting');
    console.log('- door_notification: Door/window alerts');
    console.log('- temperature_control: Temperature-based HVAC');
    console.log('- scheduled_action: Time-based actions');
    console.log('- sunrise_sunset: Sunrise/sunset triggers');
    console.log('- battery_alert: Low battery notifications');
  } else {
    console.error('✗ Failed to get templates:', result.error.message);
  }
}

/**
 * Step 2: Find suitable devices for automation.
 */
async function findDevicesForAutomation(executor: any): Promise<{
  motionSensor?: any;
  light?: any;
  locationId?: LocationId;
}> {
  console.log('\n=== Step 2: Find Devices for Automation ===');

  const devices: any = {};

  // Find motion sensor
  console.log('Looking for motion sensor...');
  const motionSensors = await executor.listDevices({ capability: 'motionSensor' });
  if (isSuccess(motionSensors) && motionSensors.data.length > 0) {
    devices.motionSensor = motionSensors.data[0];
    console.log(`✓ Found motion sensor: ${devices.motionSensor.name}`);
  } else {
    console.log('✗ No motion sensors found');
  }

  // Find switch/light
  console.log('Looking for switch/light...');
  const switches = await executor.listDevices({ capability: 'switch' });
  if (isSuccess(switches) && switches.data.length > 0) {
    devices.light = switches.data[0];
    console.log(`✓ Found switch: ${devices.light.name}`);
  } else {
    console.log('✗ No switches found');
  }

  // Get location
  console.log('Getting location...');
  const locations = await executor.listLocations();
  if (isSuccess(locations) && locations.data.length > 0) {
    devices.locationId = locations.data[0].locationId as LocationId;
    console.log(`✓ Found location: ${locations.data[0].name}`);
  } else {
    console.log('✗ No locations found');
  }

  return devices;
}

/**
 * Step 3: Validate automation configuration.
 */
async function validateAutomation(
  executor: any,
  template: AutomationTemplate,
  triggerDevice: any,
  actionDevice: any
) {
  console.log('\n=== Step 3: Validate Automation Configuration ===');

  console.log(`Template: ${template}`);
  console.log(`Trigger Device: ${triggerDevice.name} (${triggerDevice.deviceId})`);
  console.log(`Action Device: ${actionDevice.name} (${actionDevice.deviceId})`);

  // Validate trigger device capabilities
  console.log('\nValidating trigger device capabilities...');
  const triggerCaps = await executor.getDeviceCapabilities(triggerDevice.deviceId);
  if (isSuccess(triggerCaps)) {
    const hasMotion = triggerCaps.data.some((cap: any) =>
      cap.id === 'motionSensor' || cap.id === 'contactSensor'
    );
    if (hasMotion) {
      console.log('✓ Trigger device has required capability');
    } else {
      console.log('✗ Trigger device missing required capability');
      return false;
    }
  }

  // Validate action device capabilities
  console.log('Validating action device capabilities...');
  const actionCaps = await executor.getDeviceCapabilities(actionDevice.deviceId);
  if (isSuccess(actionCaps)) {
    const hasSwitch = actionCaps.data.some((cap: any) => cap.id === 'switch');
    if (hasSwitch) {
      console.log('✓ Action device has required capability');
    } else {
      console.log('✗ Action device missing required capability');
      return false;
    }
  }

  // Test automation configuration (dry run)
  console.log('\nTesting automation configuration (dry run)...');
  const testResult = await executor.testAutomation({
    template,
    triggerDeviceId: triggerDevice.deviceId,
    actionDeviceId: actionDevice.deviceId,
  });

  if (isSuccess(testResult)) {
    console.log('✓ Automation configuration is valid');
    return true;
  } else {
    console.error('✗ Automation validation failed:', testResult.error.message);
    return false;
  }
}

/**
 * Step 4: Create automation rule.
 */
async function createMotionLightsAutomation(
  executor: any,
  locationId: LocationId,
  motionSensor: any,
  light: any
): Promise<string | null> {
  console.log('\n=== Step 4: Create Motion Lights Automation ===');

  const config: AutomationConfig = {
    name: 'Motion Activated Lights (Example)',
    locationId,
    template: 'motion_lights',
    trigger: {
      deviceId: motionSensor.deviceId,
      capability: 'motionSensor',
      attribute: 'motion',
      value: 'active',
    },
    action: {
      deviceId: light.deviceId,
      capability: 'switch',
      command: 'on',
    },
    delaySeconds: 0, // Optional: delay before action
  };

  console.log('Creating automation with config:');
  console.log(JSON.stringify(config, null, 2));

  const result = await executor.createAutomation(config);

  if (isSuccess(result)) {
    console.log('\n✓ Automation created successfully!');
    console.log(`Rule ID: ${result.data.ruleId}`);
    console.log(`Rule Name: ${result.data.name || config.name}`);
    return result.data.ruleId;
  } else {
    console.error('\n✗ Failed to create automation:', result.error.message);
    if (result.error.details) {
      console.error('Details:', result.error.details);
    }
    return null;
  }
}

/**
 * Step 5: Update automation rule.
 */
async function updateAutomationName(
  executor: any,
  ruleId: string,
  locationId: LocationId,
  newName: string
) {
  console.log('\n=== Step 5: Update Automation ===');

  console.log(`Updating rule ${ruleId} name to: "${newName}"`);

  const result = await executor.updateAutomation(ruleId, locationId, {
    name: newName,
  });

  if (isSuccess(result)) {
    console.log('✓ Automation updated successfully');
    return true;
  } else {
    console.error('✗ Failed to update automation:', result.error.message);
    return false;
  }
}

/**
 * Step 6: Execute automation manually.
 */
async function executeAutomationManually(
  executor: any,
  ruleId: string,
  locationId: LocationId
) {
  console.log('\n=== Step 6: Execute Automation Manually ===');

  console.log(`Executing automation ${ruleId}...`);

  const result = await executor.executeAutomation(ruleId, locationId);

  if (isSuccess(result)) {
    console.log('✓ Automation executed successfully');
    console.log('Execution details:', result.data);
    return true;
  } else {
    console.error('✗ Failed to execute automation:', result.error.message);
    return false;
  }
}

/**
 * Step 7: Delete automation (cleanup).
 */
async function deleteAutomation(
  executor: any,
  ruleId: string,
  locationId: LocationId
) {
  console.log('\n=== Step 7: Delete Automation (Cleanup) ===');

  console.log(`Deleting automation ${ruleId}...`);

  const result = await executor.deleteAutomation(ruleId, locationId);

  if (isSuccess(result)) {
    console.log('✓ Automation deleted successfully');
    return true;
  } else {
    console.error('✗ Failed to delete automation:', result.error.message);
    return false;
  }
}

/**
 * Complete automation workflow example.
 */
async function completeAutomationWorkflow(executor: any) {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Complete Automation Workflow Example      ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Step 1: Discover templates
  await discoverTemplates(executor);

  // Step 2: Find devices
  const devices = await findDevicesForAutomation(executor);

  if (!devices.motionSensor || !devices.light || !devices.locationId) {
    console.error('\n✗ Missing required devices or location');
    console.log('This example requires:');
    console.log('- A device with motionSensor capability');
    console.log('- A device with switch capability');
    console.log('- A valid location');
    return;
  }

  // Step 3: Validate configuration
  const isValid = await validateAutomation(
    executor,
    'motion_lights',
    devices.motionSensor,
    devices.light
  );

  if (!isValid) {
    console.error('\n✗ Automation validation failed - stopping workflow');
    return;
  }

  // Step 4: Create automation
  const ruleId = await createMotionLightsAutomation(
    executor,
    devices.locationId,
    devices.motionSensor,
    devices.light
  );

  if (!ruleId) {
    console.error('\n✗ Failed to create automation - stopping workflow');
    return;
  }

  // Step 5: Update automation (optional)
  await updateAutomationName(
    executor,
    ruleId,
    devices.locationId,
    'Motion Lights (Updated Example)'
  );

  // Step 6: Execute manually (optional - uncomment to actually execute)
  console.log('\nNOTE: Manual execution commented out for safety');
  console.log('Uncomment executeAutomationManually() to test execution');
  // await executeAutomationManually(executor, ruleId, devices.locationId);

  // Step 7: Cleanup (delete automation)
  console.log('\nNOTE: Cleanup commented out for inspection');
  console.log('Uncomment deleteAutomation() to remove the automation');
  console.log(`To manually delete, use rule ID: ${ruleId}`);
  // await deleteAutomation(executor, ruleId, devices.locationId);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║          Workflow Complete!                  ║');
  console.log('╚══════════════════════════════════════════════╝');
}

/**
 * Main example function.
 */
async function main() {
  console.log('=== Direct Mode API - Automation Example ===');

  const token = process.env.SMARTTHINGS_TOKEN;
  if (!token) {
    console.error('Error: SMARTTHINGS_TOKEN environment variable required');
    process.exit(1);
  }

  const smartThingsService = new SmartThingsService({ token });
  const container = new ServiceContainer(smartThingsService);

  try {
    console.log('\nInitializing service container...');
    await container.initialize();
    console.log('✓ Container initialized');

    const executor = createToolExecutor(container);
    console.log('✓ Executor created');

    // Run complete workflow
    await completeAutomationWorkflow(executor);

    console.log('\n=== Example Complete ===');
    console.log('\nKey Takeaways:');
    console.log('1. Discover available templates with getAutomationTemplate()');
    console.log('2. Validate device capabilities before creating automation');
    console.log('3. Test automation config with testAutomation() (dry run)');
    console.log('4. Create automation with proper type-safe config');
    console.log('5. Update, execute, and delete automations as needed');
    console.log('6. Always validate before deployment');

  } finally {
    console.log('\nCleaning up...');
    await container.dispose();
    console.log('✓ Container disposed');
  }
}

// Run example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
