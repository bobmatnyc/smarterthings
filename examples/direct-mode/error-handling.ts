/**
 * Direct Mode API - Error Handling Example
 *
 * Demonstrates comprehensive error handling patterns including:
 * - Type guard usage (isSuccess, isError)
 * - Error code interpretation
 * - Retry logic with exponential backoff
 * - Graceful degradation
 * - Error logging and debugging
 *
 * Usage:
 *   SMARTTHINGS_TOKEN=your-token-here ts-node examples/direct-mode/error-handling.ts
 */

import { createToolExecutor, isSuccess, isError } from '../../src/direct/index.js';
import { ServiceContainer } from '../../src/services/ServiceContainer.js';
import { SmartThingsService } from '../../src/lib/smartthings-client.js';
import type { DeviceId } from '../../src/types/smartthings.js';
import type { DirectResult } from '../../src/direct/types.js';

/**
 * Example 1: Basic error handling with type guards.
 */
async function basicErrorHandling(executor: any, deviceId: DeviceId) {
  console.log('\n--- Example 1: Basic Error Handling ---');

  const result = await executor.getDeviceStatus(deviceId);

  // Pattern 1: Discriminant check
  if (result.success) {
    console.log('✓ Success (discriminant):', result.data.name);
  } else {
    console.error('✗ Error (discriminant):', result.error.code, result.error.message);
  }

  // Pattern 2: isSuccess() type guard
  if (isSuccess(result)) {
    console.log('✓ Success (isSuccess):', result.data.name);
  }

  // Pattern 3: isError() type guard
  if (isError(result)) {
    console.error('✗ Error (isError):', result.error.code);
  }

  // Pattern 4: Early return
  if (isError(result)) {
    console.error('✗ Early return pattern:', result.error.message);
    return; // Exit early on error
  }
  console.log('✓ Continuing with success path:', result.data.name);
}

/**
 * Example 2: Error code handling and recovery.
 */
async function errorCodeHandling(executor: any, deviceId: DeviceId) {
  console.log('\n--- Example 2: Error Code Handling ---');

  const result = await executor.turnOnDevice(deviceId);

  if (isError(result)) {
    // Handle different error codes
    switch (result.error.code) {
      case 'DEVICE_NOT_FOUND':
        console.error('Device not found. Possible causes:');
        console.error('- Device UUID is incorrect');
        console.error('- Device was removed from SmartThings');
        console.error('- PAT token lacks access to this device');
        break;

      case 'CAPABILITY_NOT_SUPPORTED':
        console.error('Device does not support required capability');
        console.error('Check device capabilities before attempting control');
        break;

      case 'API_ERROR':
        console.error('SmartThings API error occurred');
        console.error('Consider retry with exponential backoff');
        if (result.error.details) {
          console.error('Details:', result.error.details);
        }
        break;

      case 'TIMEOUT':
        console.error('Request timed out');
        console.error('SmartThings API may be slow or unreachable');
        break;

      case 'UNAUTHORIZED':
        console.error('Authentication failed');
        console.error('Verify SMARTTHINGS_TOKEN is valid and not expired');
        break;

      default:
        console.error('Unexpected error:', result.error.code);
        console.error('Message:', result.error.message);
    }
  } else {
    console.log('✓ Device control successful');
  }
}

/**
 * Example 3: Retry logic with exponential backoff.
 */
async function retryWithBackoff<T>(
  operation: () => Promise<DirectResult<T>>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<DirectResult<T>> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`  Attempt ${attempt}/${maxAttempts}...`);

    const result = await operation();

    if (isSuccess(result)) {
      console.log('  ✓ Operation succeeded');
      return result;
    }

    lastError = result.error;

    // Don't retry on certain error codes
    const nonRetryableCodes = [
      'DEVICE_NOT_FOUND',
      'CAPABILITY_NOT_SUPPORTED',
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
    ];

    if (nonRetryableCodes.includes(result.error.code)) {
      console.log(`  ✗ Non-retryable error: ${result.error.code}`);
      return result;
    }

    // Exponential backoff
    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`  ⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.log(`  ✗ All ${maxAttempts} attempts failed`);
  return {
    success: false,
    error: lastError,
  };
}

/**
 * Example 4: Batch operations with partial failure handling.
 */
async function batchOperationsWithErrorHandling(executor: any, deviceIds: DeviceId[]) {
  console.log('\n--- Example 4: Batch Operations with Error Handling ---');

  console.log(`Processing ${deviceIds.length} devices...`);

  // Execute all operations in parallel
  const results = await Promise.all(
    deviceIds.map(async (deviceId) => {
      const result = await executor.getDeviceStatus(deviceId);
      return { deviceId, result };
    })
  );

  // Separate successes and failures
  const successes = results.filter(({ result }) => isSuccess(result));
  const failures = results.filter(({ result }) => isError(result));

  console.log(`\n✓ Successes: ${successes.length}`);
  successes.forEach(({ deviceId, result }) => {
    if (isSuccess(result)) {
      console.log(`  - ${result.data.name} (${deviceId})`);
    }
  });

  console.log(`\n✗ Failures: ${failures.length}`);
  failures.forEach(({ deviceId, result }) => {
    if (isError(result)) {
      console.log(`  - ${deviceId}: [${result.error.code}] ${result.error.message}`);
    }
  });

  // Calculate success rate
  const successRate = (successes.length / results.length) * 100;
  console.log(`\nSuccess rate: ${successRate.toFixed(1)}%`);

  // Determine if operation is acceptable
  if (successRate < 50) {
    console.error('⚠️ Success rate below 50% - investigate system issues');
  } else if (successRate < 90) {
    console.warn('⚠️ Some operations failed - review error logs');
  } else {
    console.log('✓ Acceptable success rate');
  }
}

/**
 * Example 5: Graceful degradation pattern.
 */
async function gracefulDegradation(executor: any) {
  console.log('\n--- Example 5: Graceful Degradation ---');

  // Try to get device list
  console.log('Attempting to get full device list...');
  const devicesResult = await executor.listDevices();

  let devices: any[] = [];

  if (isSuccess(devicesResult)) {
    console.log(`✓ Got ${devicesResult.data.length} devices`);
    devices = devicesResult.data;
  } else {
    console.error('✗ Failed to get device list:', devicesResult.error.message);
    console.log('Attempting fallback: get cached devices...');

    // Fallback 1: Try to get from cache (example - not actually implemented)
    console.log('✗ Cache unavailable (example)');

    // Fallback 2: Use empty list and continue with degraded functionality
    console.log('⚠️ Continuing with empty device list (degraded mode)');
    devices = [];
  }

  // Continue processing with whatever we have
  console.log(`\nProcessing with ${devices.length} devices`);

  if (devices.length === 0) {
    console.log('⚠️ No devices available - limited functionality');
    return;
  }

  // Process available devices
  console.log('✓ Normal operation with available devices');
}

/**
 * Example 6: Structured error logging.
 */
function logError(error: { code: string; message: string; details?: unknown }) {
  console.log('\n--- Example 6: Structured Error Logging ---');

  const errorLog = {
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    details: error.details,
    severity: getSeverity(error.code),
    retryable: isRetryable(error.code),
  };

  console.log('Error log entry:');
  console.log(JSON.stringify(errorLog, null, 2));
}

function getSeverity(code: string): 'critical' | 'error' | 'warning' {
  const criticalCodes = ['UNAUTHORIZED', 'SERVICE_UNAVAILABLE'];
  const warningCodes = ['TIMEOUT', 'API_ERROR'];

  if (criticalCodes.includes(code)) return 'critical';
  if (warningCodes.includes(code)) return 'warning';
  return 'error';
}

function isRetryable(code: string): boolean {
  const nonRetryableCodes = [
    'DEVICE_NOT_FOUND',
    'CAPABILITY_NOT_SUPPORTED',
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
  ];
  return !nonRetryableCodes.includes(code);
}

/**
 * Main example function.
 */
async function main() {
  console.log('=== Direct Mode API - Error Handling Example ===');

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

    // Get a valid device for examples
    const devices = await executor.listDevices();
    let validDeviceId: DeviceId | null = null;

    if (isSuccess(devices) && devices.data.length > 0) {
      validDeviceId = devices.data[0].deviceId as DeviceId;
    }

    // Example 1: Basic error handling
    if (validDeviceId) {
      await basicErrorHandling(executor, validDeviceId);
    }

    // Example 2: Error code handling (intentional error)
    const invalidId = 'invalid-device-id' as DeviceId;
    await errorCodeHandling(executor, invalidId);

    // Example 3: Retry logic
    console.log('\n--- Example 3: Retry Logic ---');
    const retryResult = await retryWithBackoff(
      () => executor.testConnection(),
      3,
      500
    );
    if (isSuccess(retryResult)) {
      console.log('✓ Retry successful');
    }

    // Example 4: Batch operations
    if (isSuccess(devices) && devices.data.length >= 3) {
      const sampleIds = devices.data.slice(0, 3).map((d: any) => d.deviceId as DeviceId);
      // Add one invalid ID to demonstrate error handling
      sampleIds.push('invalid-id' as DeviceId);
      await batchOperationsWithErrorHandling(executor, sampleIds);
    }

    // Example 5: Graceful degradation
    await gracefulDegradation(executor);

    // Example 6: Structured logging
    logError({
      code: 'DEVICE_NOT_FOUND',
      message: 'Device abc-123 not found in SmartThings account',
      details: { deviceId: 'abc-123', timestamp: Date.now() },
    });

    console.log('\n=== Error Handling Example Complete ===');
    console.log('\nKey Patterns:');
    console.log('1. Use type guards (isSuccess, isError) for type-safe handling');
    console.log('2. Handle different error codes appropriately');
    console.log('3. Implement retry logic for transient errors');
    console.log('4. Handle partial failures in batch operations');
    console.log('5. Implement graceful degradation when possible');
    console.log('6. Use structured logging for error tracking');

  } finally {
    await container.dispose();
  }
}

// Run example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
