/**
 * Unit tests for error hierarchy.
 *
 * Tests:
 * - Error metadata (isRetryable, severity)
 * - Error subclass behavior
 * - Retry delay calculation
 * - Rate limit aware retry
 * - Error context builder
 */

import { describe, it, expect } from 'vitest';
import {
  AuthenticationError,
  DeviceNotFoundError,
  CapabilityNotSupportedError,
  InvalidCommandError,
  DeviceOfflineError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  CommandExecutionError,
  NotSupportedError,
  ConfigurationError,
  StateSyncError,
  isDeviceError,
  isRetryableError,
  getRetryDelay,
  ErrorContextBuilder,
} from '../errors.js';

describe('Error Hierarchy', () => {
  describe('AuthenticationError', () => {
    it('should not be retryable', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.isRetryable).toBe(false);
    });

    it('should have high severity', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.severity).toBe('high');
    });

    it('should include context', () => {
      const error = new AuthenticationError('Invalid token', {
        platform: 'smartthings',
      });
      expect(error.context).toEqual({ platform: 'smartthings' });
    });

    it('should have correct error code', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('DeviceNotFoundError', () => {
    it('should not be retryable', () => {
      const error = new DeviceNotFoundError('device-123');
      expect(error.isRetryable).toBe(false);
    });

    it('should have medium severity', () => {
      const error = new DeviceNotFoundError('device-123');
      expect(error.severity).toBe('medium');
    });

    it('should include deviceId in context', () => {
      const error = new DeviceNotFoundError('device-123');
      expect(error.context?.['deviceId']).toBe('device-123');
    });
  });

  describe('CapabilityNotSupportedError', () => {
    it('should not be retryable', () => {
      const error = new CapabilityNotSupportedError('Device lacks capability');
      expect(error.isRetryable).toBe(false);
    });

    it('should have low severity', () => {
      const error = new CapabilityNotSupportedError('Device lacks capability');
      expect(error.severity).toBe('low');
    });
  });

  describe('InvalidCommandError', () => {
    it('should not be retryable', () => {
      const error = new InvalidCommandError('Invalid command parameters');
      expect(error.isRetryable).toBe(false);
    });

    it('should have low severity', () => {
      const error = new InvalidCommandError('Invalid command parameters');
      expect(error.severity).toBe('low');
    });
  });

  describe('DeviceOfflineError', () => {
    it('should be retryable', () => {
      const error = new DeviceOfflineError('device-123');
      expect(error.isRetryable).toBe(true);
    });

    it('should have medium severity', () => {
      const error = new DeviceOfflineError('device-123');
      expect(error.severity).toBe('medium');
    });
  });

  describe('NetworkError', () => {
    it('should be retryable', () => {
      const error = new NetworkError('Connection timeout');
      expect(error.isRetryable).toBe(true);
    });

    it('should have medium severity', () => {
      const error = new NetworkError('Connection timeout');
      expect(error.severity).toBe('medium');
    });
  });

  describe('RateLimitError', () => {
    it('should be retryable', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.isRetryable).toBe(true);
    });

    it('should have medium severity', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.severity).toBe('medium');
    });

    it('should store retryAfter field', () => {
      const error = new RateLimitError('Too many requests', 30);
      expect(error.retryAfter).toBe(30);
    });

    it('should include retryAfter in context', () => {
      const error = new RateLimitError('Too many requests', 30);
      expect(error.context?.['retryAfter']).toBe(30);
    });
  });

  describe('TimeoutError', () => {
    it('should be retryable', () => {
      const error = new TimeoutError('Operation timeout');
      expect(error.isRetryable).toBe(true);
    });

    it('should have medium severity', () => {
      const error = new TimeoutError('Operation timeout');
      expect(error.severity).toBe('medium');
    });
  });

  describe('CommandExecutionError', () => {
    it('should check context for retryability', () => {
      const retryableError = new CommandExecutionError('Temporary error', {
        platformErrorCode: 'TEMPORARY_ERROR',
      });
      expect(retryableError.isRetryable).toBe(true);

      const nonRetryableError = new CommandExecutionError('Permanent error', {
        platformErrorCode: 'PERMANENT_ERROR',
      });
      expect(nonRetryableError.isRetryable).toBe(false);
    });

    it('should have medium severity', () => {
      const error = new CommandExecutionError('Command failed');
      expect(error.severity).toBe('medium');
    });
  });

  describe('NotSupportedError', () => {
    it('should not be retryable', () => {
      const error = new NotSupportedError('scenes', 'lutron');
      expect(error.isRetryable).toBe(false);
    });

    it('should have low severity', () => {
      const error = new NotSupportedError('scenes', 'lutron');
      expect(error.severity).toBe('low');
    });

    it('should include feature and platform in context', () => {
      const error = new NotSupportedError('scenes', 'lutron');
      expect(error.context?.['feature']).toBe('scenes');
      expect(error.context?.['platform']).toBe('lutron');
    });
  });

  describe('ConfigurationError', () => {
    it('should not be retryable', () => {
      const error = new ConfigurationError('Missing API key');
      expect(error.isRetryable).toBe(false);
    });

    it('should have high severity', () => {
      const error = new ConfigurationError('Missing API key');
      expect(error.severity).toBe('high');
    });
  });

  describe('StateSyncError', () => {
    it('should be retryable', () => {
      const error = new StateSyncError('State inconsistency');
      expect(error.isRetryable).toBe(true);
    });

    it('should have low severity', () => {
      const error = new StateSyncError('State inconsistency');
      expect(error.severity).toBe('low');
    });
  });

  describe('isDeviceError type guard', () => {
    it('should identify DeviceError instances', () => {
      const error = new NetworkError('Test');
      expect(isDeviceError(error)).toBe(true);
    });

    it('should reject non-DeviceError instances', () => {
      const error = new Error('Regular error');
      expect(isDeviceError(error)).toBe(false);
      expect(isDeviceError(null)).toBe(false);
      expect(isDeviceError(undefined)).toBe(false);
      expect(isDeviceError('string')).toBe(false);
    });
  });

  describe('isRetryableError type guard', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new NetworkError('Test'))).toBe(true);
      expect(isRetryableError(new TimeoutError('Test'))).toBe(true);
      expect(isRetryableError(new RateLimitError('Test'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(new AuthenticationError('Test'))).toBe(false);
      expect(isRetryableError(new DeviceNotFoundError('device'))).toBe(false);
      expect(isRetryableError(new InvalidCommandError('Test'))).toBe(false);
    });

    it('should reject non-DeviceError instances', () => {
      expect(isRetryableError(new Error('Regular error'))).toBe(false);
      expect(isRetryableError(null)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return 0 for non-retryable errors', () => {
      const error = new AuthenticationError('Test');
      expect(getRetryDelay(error, 1)).toBe(0);
    });

    it('should use retryAfter for RateLimitError', () => {
      const error = new RateLimitError('Test', 30);
      const delay = getRetryDelay(error, 1);
      expect(delay).toBe(30000); // 30 seconds in milliseconds
    });

    it('should use exponential backoff for retryable errors', () => {
      const error = new NetworkError('Test');

      // Attempt 1: ~1s (1000ms ±20%)
      const delay1 = getRetryDelay(error, 1);
      expect(delay1).toBeGreaterThanOrEqual(800);
      expect(delay1).toBeLessThanOrEqual(1200);

      // Attempt 2: ~2s (2000ms ±20%)
      const delay2 = getRetryDelay(error, 2);
      expect(delay2).toBeGreaterThanOrEqual(1600);
      expect(delay2).toBeLessThanOrEqual(2400);

      // Attempt 3: ~4s (4000ms ±20%)
      const delay3 = getRetryDelay(error, 3);
      expect(delay3).toBeGreaterThanOrEqual(3200);
      expect(delay3).toBeLessThanOrEqual(4800);
    });

    it('should cap at maximum delay', () => {
      const error = new NetworkError('Test');

      // Attempt 10: Should be capped at 16000ms
      const delay = getRetryDelay(error, 10);
      expect(delay).toBeLessThanOrEqual(19200); // 16000 + 20% jitter
    });

    it('should include jitter to prevent thundering herd', () => {
      const error = new NetworkError('Test');

      // Generate multiple delays and verify they're not identical
      const delays = Array.from({ length: 10 }, () => getRetryDelay(error, 1));
      const uniqueDelays = new Set(delays);

      // With jitter, we should get some variation
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('ErrorContextBuilder', () => {
    it('should build context with device ID', () => {
      const context = new ErrorContextBuilder().withDeviceId('device-123').build();

      expect(context['deviceId']).toBe('device-123');
    });

    it('should build context with platform', () => {
      const context = new ErrorContextBuilder().withPlatform('smartthings').build();

      expect(context['platform']).toBe('smartthings');
    });

    it('should build context with command', () => {
      const command = { capability: 'switch', command: 'on' };
      const context = new ErrorContextBuilder().withCommand(command).build();

      expect(context['command']).toEqual(command);
    });

    it('should build context with platform error code', () => {
      const context = new ErrorContextBuilder().withPlatformErrorCode('TIMEOUT').build();

      expect(context['platformErrorCode']).toBe('TIMEOUT');
    });

    it('should build context with HTTP status', () => {
      const context = new ErrorContextBuilder().withHttpStatus(429).build();

      expect(context['httpStatus']).toBe(429);
    });

    it('should build context with custom fields', () => {
      const context = new ErrorContextBuilder()
        .with('retryCount', 3)
        .with('timestamp', '2025-11-26T00:00:00Z')
        .build();

      expect(context['retryCount']).toBe(3);
      expect(context['timestamp']).toBe('2025-11-26T00:00:00Z');
    });

    it('should chain all builder methods', () => {
      const context = new ErrorContextBuilder()
        .withDeviceId('device-123')
        .withPlatform('smartthings')
        .withHttpStatus(500)
        .with('custom', 'value')
        .build();

      expect(context['deviceId']).toBe('device-123');
      expect(context['platform']).toBe('smartthings');
      expect(context['httpStatus']).toBe(500);
      expect(context['custom']).toBe('value');
    });
  });

  describe('Error toJSON serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new NetworkError('Connection failed', {
        host: 'api.example.com',
        port: 443,
      });

      const json = error.toJSON();

      expect(json['name']).toBe('NetworkError');
      expect(json['message']).toBe('Connection failed');
      expect(json['code']).toBe('NETWORK_ERROR');
      expect(json['isRetryable']).toBe(true);
      expect(json['severity']).toBe('medium');
      expect(json['context']).toEqual({ host: 'api.example.com', port: 443 });
      expect(json['stack']).toBeDefined();
    });
  });

  describe('Error immutability', () => {
    it('should not allow modification of isRetryable', () => {
      const error = new NetworkError('Test');

      expect(() => {
        // @ts-expect-error - Testing immutability
        error.isRetryable = false;
      }).toThrow();
    });

    it('should not allow modification of severity', () => {
      const error = new NetworkError('Test');

      expect(() => {
        // @ts-expect-error - Testing immutability
        error.severity = 'critical';
      }).toThrow();
    });
  });
});
