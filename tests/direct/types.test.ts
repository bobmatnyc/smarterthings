/**
 * Unit tests for Direct Mode type guards.
 *
 * Verifies type narrowing and runtime behavior of isSuccess() and isError().
 * Tests TypeScript type inference with discriminated unions.
 *
 * Ticket: 1M-412 - Phase 4.2 QA Verification
 *
 * Coverage Requirements: 100%
 * - isSuccess: true and false cases with type narrowing
 * - isError: true and false cases with type narrowing
 */

import { describe, it, expect } from 'vitest';
import { isSuccess, isError } from '../../src/direct/types.js';
import type { DirectResult } from '../../src/direct/types.js';

describe('types', () => {
  describe('isSuccess', () => {
    it('should return true for success result', () => {
      const result: DirectResult<string> = {
        success: true,
        data: 'test-value',
      };

      expect(isSuccess(result)).toBe(true);
    });

    it('should return false for error result', () => {
      const result: DirectResult<string> = {
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
      };

      expect(isSuccess(result)).toBe(false);
    });

    it('should narrow type to success result when true', () => {
      const result: DirectResult<{ value: number }> = {
        success: true,
        data: { value: 42 },
      };

      if (isSuccess(result)) {
        // TypeScript should infer result.data exists
        expect(result.data.value).toBe(42);
        // @ts-expect-error error should not exist on success type
        expect(result.error).toBeUndefined();
      } else {
        throw new Error('Should not reach here');
      }
    });

    it('should work with void data type', () => {
      const result: DirectResult<void> = {
        success: true,
        data: undefined,
      };

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should work with complex nested data types', () => {
      type ComplexData = {
        devices: Array<{ id: string; status: { power: string } }>;
        metadata: { count: number };
      };

      const result: DirectResult<ComplexData> = {
        success: true,
        data: {
          devices: [
            { id: 'device-1', status: { power: 'on' } },
            { id: 'device-2', status: { power: 'off' } },
          ],
          metadata: { count: 2 },
        },
      };

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.devices).toHaveLength(2);
        expect(result.data.metadata.count).toBe(2);
      }
    });
  });

  describe('isError', () => {
    it('should return true for error result', () => {
      const result: DirectResult<string> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      };

      expect(isError(result)).toBe(true);
    });

    it('should return false for success result', () => {
      const result: DirectResult<string> = {
        success: true,
        data: 'test-value',
      };

      expect(isError(result)).toBe(false);
    });

    it('should narrow type to error result when true', () => {
      const result: DirectResult<{ value: number }> = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          details: { resourceId: 'test-123' },
        },
      };

      if (isError(result)) {
        // TypeScript should infer result.error exists
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('Resource not found');
        expect(result.error.details).toEqual({ resourceId: 'test-123' });
        // @ts-expect-error data should not exist on error type
        expect(result.data).toBeUndefined();
      } else {
        throw new Error('Should not reach here');
      }
    });

    it('should work with error without details field', () => {
      const result: DirectResult<void> = {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Operation timed out',
        },
      };

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.message).toBe('Operation timed out');
        expect(result.error.details).toBeUndefined();
      }
    });

    it('should work with complex error details', () => {
      const result: DirectResult<string> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Multiple validation errors',
          details: {
            fields: [
              { name: 'deviceId', error: 'Required' },
              { name: 'capability', error: 'Invalid format' },
            ],
            timestamp: '2025-11-30T12:00:00Z',
          },
        },
      };

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        const details = result.error.details as any;
        expect(details.fields).toHaveLength(2);
        expect(details.timestamp).toBeDefined();
      }
    });
  });

  describe('type guard mutual exclusivity', () => {
    it('isSuccess and isError should be mutually exclusive', () => {
      const successResult: DirectResult<number> = {
        success: true,
        data: 123,
      };

      expect(isSuccess(successResult)).toBe(true);
      expect(isError(successResult)).toBe(false);

      const errorResult: DirectResult<number> = {
        success: false,
        error: {
          code: 'ERROR',
          message: 'Error',
        },
      };

      expect(isSuccess(errorResult)).toBe(false);
      expect(isError(errorResult)).toBe(true);
    });

    it('should enable exhaustive type checking with if-else', () => {
      const result: DirectResult<string> = {
        success: true,
        data: 'test',
      };

      let handled = false;

      if (isSuccess(result)) {
        expect(result.data).toBe('test');
        handled = true;
      } else if (isError(result)) {
        // This branch should not execute
        throw new Error('Should not reach error branch');
      }

      expect(handled).toBe(true);
    });

    it('should work with early return pattern', () => {
      function processResult(result: DirectResult<number>): number {
        if (isError(result)) {
          throw new Error(result.error.message);
        }
        // TypeScript knows result is success here
        return result.data * 2;
      }

      const successResult: DirectResult<number> = {
        success: true,
        data: 21,
      };

      expect(processResult(successResult)).toBe(42);

      const errorResult: DirectResult<number> = {
        success: false,
        error: {
          code: 'ERROR',
          message: 'Calculation failed',
        },
      };

      expect(() => processResult(errorResult)).toThrow('Calculation failed');
    });
  });

  describe('type inference with generics', () => {
    it('should preserve generic type parameter in success case', () => {
      type Device = { id: string; name: string };

      const result: DirectResult<Device> = {
        success: true,
        data: { id: 'device-1', name: 'Light' },
      };

      if (isSuccess(result)) {
        // TypeScript should know result.data is Device
        const deviceId: string = result.data.id;
        const deviceName: string = result.data.name;
        expect(deviceId).toBe('device-1');
        expect(deviceName).toBe('Light');
      }
    });

    it('should work with union types', () => {
      type StringOrNumber = string | number;

      const stringResult: DirectResult<StringOrNumber> = {
        success: true,
        data: 'test',
      };

      const numberResult: DirectResult<StringOrNumber> = {
        success: true,
        data: 42,
      };

      if (isSuccess(stringResult)) {
        expect(typeof stringResult.data).toBe('string');
      }

      if (isSuccess(numberResult)) {
        expect(typeof numberResult.data).toBe('number');
      }
    });

    it('should work with array types', () => {
      const result: DirectResult<string[]> = {
        success: true,
        data: ['a', 'b', 'c'],
      };

      if (isSuccess(result)) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data).toHaveLength(3);
        expect(result.data[0]).toBe('a');
      }
    });

    it('should work with Promise types', async () => {
      async function asyncOperation(): Promise<DirectResult<number>> {
        return {
          success: true,
          data: 42,
        };
      }

      const result = await asyncOperation();

      if (isSuccess(result)) {
        expect(result.data).toBe(42);
      }
    });
  });
});
