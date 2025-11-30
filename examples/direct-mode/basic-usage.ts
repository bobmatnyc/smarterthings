/**
 * Direct Mode API - Basic Usage Example
 *
 * Demonstrates fundamental Direct Mode operations including:
 * - Service initialization
 * - Device discovery and control
 * - Scene execution
 * - Error handling
 * - Resource cleanup
 *
 * Usage:
 *   SMARTTHINGS_TOKEN=your-token-here ts-node examples/direct-mode/basic-usage.ts
 */

import { createToolExecutor, isSuccess, isError } from '../../src/direct/index.js';
import { ServiceContainer } from '../../src/services/ServiceContainer.js';
import { SmartThingsService } from '../../src/lib/smartthings-client.js';
import type { DeviceId, SceneId } from '../../src/types/smartthings.js';

/**
 * Main example function.
 */
async function main() {
  console.log('=== Direct Mode API - Basic Usage Example ===\n');

  // Validate environment
  const token = process.env.SMARTTHINGS_TOKEN;
  if (!token) {
    console.error('Error: SMARTTHINGS_TOKEN environment variable required');
    process.exit(1);
  }

  // Step 1: Initialize SmartThings service
  console.log('1. Initializing SmartThings service...');
  const smartThingsService = new SmartThingsService({ token });

  // Step 2: Create service container
  console.log('2. Creating service container...');
  const container = new ServiceContainer(smartThingsService);

  try {
    // Step 3: Initialize (loads devices, rooms, locations into cache)
    console.log('3. Initializing service container...');
    await container.initialize();
    console.log('   ✓ Container initialized\n');

    // Step 4: Create Direct Mode executor
    console.log('4. Creating Direct Mode executor...');
    const executor = createToolExecutor(container);
    console.log('   ✓ Executor created\n');

    // Step 5: List all devices
    console.log('5. Listing all devices...');
    const allDevices = await executor.listDevices();

    if (isSuccess(allDevices)) {
      console.log(`   ✓ Found ${allDevices.data.length} devices`);

      // Display first 5 devices
      const preview = allDevices.data.slice(0, 5);
      preview.forEach((device: any) => {
        console.log(`   - ${device.name} (${device.deviceId})`);
        console.log(`     Type: ${device.type || 'Unknown'}`);
        console.log(`     Capabilities: ${device.capabilities?.join(', ') || 'None'}`);
      });

      if (allDevices.data.length > 5) {
        console.log(`   ... and ${allDevices.data.length - 5} more`);
      }
      console.log();
    } else {
      console.error('   ✗ Failed to list devices:', allDevices.error.message);
      console.log();
    }

    // Step 6: Filter devices by capability
    console.log('6. Filtering devices by capability (switch)...');
    const switches = await executor.listDevices({ capability: 'switch' });

    if (isSuccess(switches)) {
      console.log(`   ✓ Found ${switches.data.length} switch devices`);
      switches.data.slice(0, 3).forEach((device: any) => {
        console.log(`   - ${device.name}`);
      });
      console.log();
    } else {
      console.error('   ✗ Failed to filter devices:', switches.error.message);
      console.log();
    }

    // Step 7: Get system information
    console.log('7. Getting system information...');
    const systemInfo = await executor.getSystemInfo();

    if (isSuccess(systemInfo)) {
      console.log('   ✓ System information retrieved');
      console.log(`   - Server: ${systemInfo.data.name}`);
      console.log(`   - Version: ${systemInfo.data.version}`);
      console.log(`   - Transport: ${systemInfo.data.transport}`);
      console.log();
    } else {
      console.error('   ✗ Failed to get system info:', systemInfo.error.message);
      console.log();
    }

    // Step 8: Test connection
    console.log('8. Testing SmartThings API connection...');
    const connectionTest = await executor.testConnection();

    if (isSuccess(connectionTest)) {
      console.log('   ✓ Connection test successful');
      console.log(`   - Status: ${connectionTest.data.status}`);
      console.log(`   - Latency: ${connectionTest.data.latency}ms`);
      console.log();
    } else {
      console.error('   ✗ Connection test failed:', connectionTest.error.message);
      console.log();
    }

    // Step 9: List rooms
    console.log('9. Listing all rooms...');
    const rooms = await executor.listRooms();

    if (isSuccess(rooms)) {
      console.log(`   ✓ Found ${rooms.data.length} rooms`);
      rooms.data.slice(0, 5).forEach((room: any) => {
        console.log(`   - ${room.name} (${room.roomId})`);
      });
      console.log();
    } else {
      console.error('   ✗ Failed to list rooms:', rooms.error.message);
      console.log();
    }

    // Step 10: List scenes
    console.log('10. Listing all scenes...');
    const scenes = await executor.listScenes();

    if (isSuccess(scenes)) {
      console.log(`   ✓ Found ${scenes.data.length} scenes`);
      scenes.data.slice(0, 5).forEach((scene: any) => {
        console.log(`   - ${scene.name} (${scene.sceneId})`);
      });
      console.log();
    } else {
      console.error('   ✗ Failed to list scenes:', scenes.error.message);
      console.log();
    }

    // Step 11: Demonstrate device control (with safety check)
    console.log('11. Device control example (optional)...');
    if (isSuccess(switches) && switches.data.length > 0) {
      const firstSwitch = switches.data[0];
      console.log(`   Found switch device: ${firstSwitch.name}`);
      console.log('   NOTE: Uncomment the code below to actually control the device');
      console.log();

      /*
      // Uncomment to actually control a device:
      const deviceId = firstSwitch.deviceId as DeviceId;

      console.log('   Turning device ON...');
      const onResult = await executor.turnOnDevice(deviceId);
      if (isSuccess(onResult)) {
        console.log('   ✓ Device turned on');
      }

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('   Turning device OFF...');
      const offResult = await executor.turnOffDevice(deviceId);
      if (isSuccess(offResult)) {
        console.log('   ✓ Device turned off');
      }
      */
    } else {
      console.log('   No switch devices available for control demo');
      console.log();
    }

    // Step 12: Demonstrate error handling
    console.log('12. Error handling example...');
    const invalidDeviceId = 'invalid-device-id' as DeviceId;
    const errorResult = await executor.getDeviceStatus(invalidDeviceId);

    if (isError(errorResult)) {
      console.log('   ✓ Error handling working correctly');
      console.log(`   - Error Code: ${errorResult.error.code}`);
      console.log(`   - Error Message: ${errorResult.error.message}`);
      console.log();
    } else {
      console.log('   ✗ Expected error but got success (unexpected)');
      console.log();
    }

    console.log('=== Example Complete ===');
    console.log('\nKey Takeaways:');
    console.log('1. Initialize ServiceContainer once and reuse');
    console.log('2. Use isSuccess() and isError() type guards');
    console.log('3. All operations return DirectResult<T>');
    console.log('4. Type-safe API with branded types (DeviceId, etc.)');
    console.log('5. Always cleanup with container.dispose()');

  } catch (error) {
    console.error('\n!!! Unexpected error:', error);
    throw error;
  } finally {
    // Step 13: Cleanup
    console.log('\n13. Cleaning up...');
    await container.dispose();
    console.log('   ✓ Container disposed');
  }
}

// Run example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
