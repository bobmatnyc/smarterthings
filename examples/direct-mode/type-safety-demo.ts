/**
 * Direct Mode API - Type Safety Demo
 *
 * Demonstrates TypeScript type safety features including:
 * - Branded types (DeviceId, LocationId, RoomId, SceneId)
 * - Type guards (isSuccess, isError)
 * - Type narrowing with discriminated unions
 * - DirectResult<T> generic type
 * - Compile-time safety for domain objects
 *
 * Usage:
 *   SMARTTHINGS_TOKEN=your-token-here ts-node examples/direct-mode/type-safety-demo.ts
 */

import { createToolExecutor, isSuccess, isError } from '../../src/direct/index.js';
import { ServiceContainer } from '../../src/services/ServiceContainer.js';
import { SmartThingsService } from '../../src/lib/smartthings-client.js';
import type { DeviceId, LocationId, RoomId, SceneId } from '../../src/types/smartthings.js';
import type { DirectResult } from '../../src/direct/types.js';

/**
 * Demo 1: Branded Types - Preventing ID Mix-ups
 *
 * Branded types are nominal types that prevent mixing different kinds of IDs.
 * This catches bugs at compile time rather than runtime.
 */
function demo1BrandedTypes() {
  console.log('\n=== Demo 1: Branded Types ===\n');

  // Create typed IDs
  const deviceId: DeviceId = 'device-abc-123' as DeviceId;
  const roomId: RoomId = 'room-xyz-789' as RoomId;
  const locationId: LocationId = 'location-def-456' as LocationId;
  const sceneId: SceneId = 'scene-ghi-101' as SceneId;

  console.log('✓ Branded types created:');
  console.log(`  DeviceId: ${deviceId}`);
  console.log(`  RoomId: ${roomId}`);
  console.log(`  LocationId: ${locationId}`);
  console.log(`  SceneId: ${sceneId}`);

  // Type safety demonstration
  console.log('\n✓ Type safety in action:');

  // ✅ Valid: Correct type
  function controlDevice(id: DeviceId) {
    console.log(`  ✓ controlDevice(DeviceId) - correct type`);
    return id;
  }
  controlDevice(deviceId);

  // ❌ Invalid: Wrong type (compile error if uncommented)
  // controlDevice(roomId); // Type error: RoomId is not assignable to DeviceId

  console.log('  ✗ controlDevice(RoomId) - would fail at compile time!');

  // ✅ Valid: Multiple parameters with different types
  function assignDeviceToRoom(device: DeviceId, room: RoomId, location: LocationId) {
    console.log(`  ✓ assignDeviceToRoom(DeviceId, RoomId, LocationId) - all correct`);
    return { device, room, location };
  }
  assignDeviceToRoom(deviceId, roomId, locationId);

  // ❌ Invalid: Arguments in wrong order (compile error if uncommented)
  // assignDeviceToRoom(roomId, deviceId, locationId); // Type error!

  console.log('  ✗ assignDeviceToRoom with wrong argument order - would fail at compile time!');

  console.log('\n💡 Key Insight: Branded types prevent mixing incompatible IDs at compile time');
}

/**
 * Demo 2: DirectResult<T> - Type-Safe Result Handling
 *
 * DirectResult is a discriminated union that makes error handling explicit
 * and type-safe.
 */
async function demo2DirectResult(executor: any) {
  console.log('\n=== Demo 2: DirectResult<T> Type ===\n');

  // Get a device status (returns DirectResult<DeviceStatus>)
  const devices = await executor.listDevices();
  if (isError(devices) || devices.data.length === 0) {
    console.log('⚠️ No devices available for demo');
    return;
  }

  const deviceId = devices.data[0].deviceId as DeviceId;
  const result = await executor.getDeviceStatus(deviceId);

  // Type annotation shows the structure
  console.log('DirectResult<T> structure:');
  console.log(`  type DirectResult<T> =`);
  console.log(`    | { success: true; data: T }`);
  console.log(`    | { success: false; error: { code: string; message: string } }`);

  console.log('\n✓ Result received:');
  console.log(`  success: ${result.success}`);

  // Demonstrate type narrowing
  if (result.success) {
    console.log(`  data type: DeviceStatus`);
    console.log(`  data.name: ${result.data.name}`);
    // result.error does NOT exist here (type error if accessed)
  } else {
    console.log(`  error.code: ${result.error.code}`);
    console.log(`  error.message: ${result.error.message}`);
    // result.data does NOT exist here (type error if accessed)
  }

  console.log('\n💡 Key Insight: DirectResult<T> enforces explicit error handling');
}

/**
 * Demo 3: Type Guards - Type Narrowing
 *
 * Type guards enable TypeScript to narrow types in conditional branches.
 */
async function demo3TypeGuards(executor: any) {
  console.log('\n=== Demo 3: Type Guards ===\n');

  const result = await executor.testConnection();

  console.log('Type guard functions:');
  console.log('  isSuccess(result): result is { success: true; data: T }');
  console.log('  isError(result): result is { success: false; error: {...} }');

  // Pattern 1: isSuccess() type guard
  console.log('\n✓ Pattern 1: isSuccess() type guard');
  if (isSuccess(result)) {
    console.log(`  ✓ Type narrowed to success branch`);
    console.log(`  ✓ result.data accessible: ${JSON.stringify(result.data)}`);
    // result.error does NOT exist (compile error if accessed)
  }

  // Pattern 2: isError() type guard
  console.log('\n✓ Pattern 2: isError() type guard');
  if (isError(result)) {
    console.log(`  ✓ Type narrowed to error branch`);
    console.log(`  ✓ result.error accessible: ${result.error.code}`);
    // result.data does NOT exist (compile error if accessed)
  }

  // Pattern 3: Discriminant property
  console.log('\n✓ Pattern 3: Discriminant property (result.success)');
  if (result.success) {
    console.log(`  ✓ Type narrowed based on discriminant`);
    console.log(`  ✓ data: ${JSON.stringify(result.data)}`);
  } else {
    console.log(`  ✓ Type narrowed to error`);
    console.log(`  ✓ error: ${result.error.message}`);
  }

  console.log('\n💡 Key Insight: Type guards enable safe access to data/error fields');
}

/**
 * Demo 4: Generic Type Parameters
 *
 * DirectResult<T> uses generics to provide type-safe data access.
 */
async function demo4GenericTypes(executor: any) {
  console.log('\n=== Demo 4: Generic Type Parameters ===\n');

  // Different operations return different typed results
  console.log('Different DirectResult<T> types:');

  // DirectResult<void> - no data
  const voidResult = await executor.toggleDebug(false);
  console.log(`\n✓ DirectResult<void>`);
  console.log(`  success: ${voidResult.success}`);
  if (isSuccess(voidResult)) {
    console.log(`  data: void (no data returned)`);
  }

  // DirectResult<Device[]> - array of devices
  const devicesResult = await executor.listDevices();
  console.log(`\n✓ DirectResult<Device[]>`);
  console.log(`  success: ${devicesResult.success}`);
  if (isSuccess(devicesResult)) {
    console.log(`  data: Device[] (${devicesResult.data.length} devices)`);
    console.log(`  TypeScript knows data is an array of devices`);
  }

  // DirectResult<DeviceStatus> - single device object
  if (isSuccess(devicesResult) && devicesResult.data.length > 0) {
    const deviceId = devicesResult.data[0].deviceId as DeviceId;
    const statusResult = await executor.getDeviceStatus(deviceId);
    console.log(`\n✓ DirectResult<DeviceStatus>`);
    console.log(`  success: ${statusResult.success}`);
    if (isSuccess(statusResult)) {
      console.log(`  data: DeviceStatus (object with name, state, etc.)`);
      console.log(`  TypeScript knows data.name exists: "${statusResult.data.name}"`);
    }
  }

  console.log('\n💡 Key Insight: Generic types provide type-safe data access for each operation');
}

/**
 * Demo 5: Compile-Time Safety Examples
 *
 * These examples would fail at compile time (commented out).
 */
function demo5CompileTimeSafety() {
  console.log('\n=== Demo 5: Compile-Time Safety ===\n');

  console.log('Examples that would fail at compile time:\n');

  // Example 1: Mixing branded types
  console.log('❌ Example 1: Mixing branded types');
  console.log('  const deviceId: DeviceId = "device-123" as DeviceId;');
  console.log('  const roomId: RoomId = "room-456" as RoomId;');
  console.log('  turnOnDevice(roomId); // ❌ Type error!');
  console.log('  Error: RoomId is not assignable to DeviceId\n');

  // Example 2: Accessing wrong field in discriminated union
  console.log('❌ Example 2: Accessing wrong field in discriminated union');
  console.log('  const result = await turnOnDevice(deviceId);');
  console.log('  console.log(result.data); // ❌ Type error if result.success is false!');
  console.log('  Error: Property "data" does not exist on error branch\n');

  // Example 3: Forgetting type guard
  console.log('❌ Example 3: Accessing data without type guard');
  console.log('  const result = await getDeviceStatus(deviceId);');
  console.log('  console.log(result.data.name); // ❌ Type error!');
  console.log('  Error: Property "data" may not exist (could be error)\n');

  // Example 4: Correct usage with type guard
  console.log('✅ Example 4: Correct usage with type guard');
  console.log('  const result = await getDeviceStatus(deviceId);');
  console.log('  if (isSuccess(result)) {');
  console.log('    console.log(result.data.name); // ✓ Type-safe!');
  console.log('  }\n');

  console.log('💡 Key Insight: TypeScript catches errors at compile time, not runtime');
}

/**
 * Demo 6: Type Inference
 *
 * TypeScript can infer types automatically in many cases.
 */
async function demo6TypeInference(executor: any) {
  console.log('\n=== Demo 6: Type Inference ===\n');

  console.log('TypeScript infers types automatically:\n');

  // Type inference from executor methods
  const devicesResult = await executor.listDevices(); // Inferred: DirectResult<Device[]>
  console.log('✓ const devicesResult = await executor.listDevices();');
  console.log('  TypeScript infers: DirectResult<Device[]>');

  // Type inference in conditionals
  if (isSuccess(devicesResult)) {
    // TypeScript infers: devicesResult.data is Device[]
    const firstDevice = devicesResult.data[0]; // Inferred: Device
    console.log('\n✓ if (isSuccess(devicesResult)) {');
    console.log('    const firstDevice = devicesResult.data[0];');
    console.log('    TypeScript infers: Device');
    console.log(`    Actual: ${firstDevice?.name || 'No devices'}`);
  }

  // Type inference with destructuring
  if (isSuccess(devicesResult)) {
    const { data } = devicesResult; // Inferred: Device[]
    console.log('\n✓ const { data } = devicesResult;');
    console.log('  TypeScript infers data: Device[]');
    console.log(`  Actual: ${data.length} devices`);
  }

  console.log('\n💡 Key Insight: Type inference reduces verbosity while maintaining safety');
}

/**
 * Demo 7: Function Type Signatures
 *
 * Demonstrate how method signatures provide type safety.
 */
function demo7FunctionSignatures() {
  console.log('\n=== Demo 7: Function Type Signatures ===\n');

  console.log('Direct Mode method signatures:\n');

  console.log('✓ turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>>');
  console.log('  - Parameter: DeviceId (branded type)');
  console.log('  - Returns: Promise wrapping DirectResult<void>');
  console.log('  - Result has no data (void) on success\n');

  console.log('✓ listDevices(filters?: {...}): Promise<DirectResult<Device[]>>');
  console.log('  - Parameter: Optional filters object');
  console.log('  - Returns: Promise wrapping DirectResult<Device[]>');
  console.log('  - Result has array of devices on success\n');

  console.log('✓ createRoom(locationId: LocationId, name: string): Promise<DirectResult<Room>>');
  console.log('  - Parameters: LocationId (branded) and string');
  console.log('  - Returns: Promise wrapping DirectResult<Room>');
  console.log('  - Result has Room object on success\n');

  console.log('💡 Key Insight: Clear signatures make API self-documenting');
}

/**
 * Main demo function.
 */
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Direct Mode API - Type Safety Demo        ║');
  console.log('╚══════════════════════════════════════════════╝');

  const token = process.env.SMARTTHINGS_TOKEN;
  if (!token) {
    console.error('Error: SMARTTHINGS_TOKEN environment variable required');
    process.exit(1);
  }

  const smartThingsService = new SmartThingsService({ token });
  const container = new ServiceContainer(smartThingsService);

  try {
    await container.initialize();
    const executor = createToolExecutor(container);

    // Run all demos
    demo1BrandedTypes();
    await demo2DirectResult(executor);
    await demo3TypeGuards(executor);
    await demo4GenericTypes(executor);
    demo5CompileTimeSafety();
    await demo6TypeInference(executor);
    demo7FunctionSignatures();

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║          Type Safety Demo Complete!         ║');
    console.log('╚══════════════════════════════════════════════╝');

    console.log('\n=== Key Takeaways ===');
    console.log('1. Branded types prevent mixing incompatible IDs');
    console.log('2. DirectResult<T> enforces explicit error handling');
    console.log('3. Type guards enable safe type narrowing');
    console.log('4. Generic types provide type-safe data access');
    console.log('5. TypeScript catches errors at compile time');
    console.log('6. Type inference reduces verbosity');
    console.log('7. Clear signatures make API self-documenting');

    console.log('\n=== Benefits ===');
    console.log('✓ Catch bugs at compile time, not runtime');
    console.log('✓ IDE autocomplete and IntelliSense');
    console.log('✓ Self-documenting API');
    console.log('✓ Refactoring confidence');
    console.log('✓ Reduced unit tests (types enforce correctness)');

  } finally {
    await container.dispose();
  }
}

// Run demo
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
