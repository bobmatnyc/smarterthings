/**
 * Unit tests for Direct Mode converters.
 *
 * Verifies bidirectional conversion between MCP CallToolResult and DirectResult<T>.
 * Tests all success/error paths and edge cases.
 *
 * Ticket: 1M-412 - Phase 4.2 QA Verification
 *
 * Coverage Requirements: 100%
 * - unwrapMcpResult: success, error with code, error without code, missing message
 * - wrapDirectResult: success, error
 */

import { describe, it, expect } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { unwrapMcpResult, wrapDirectResult } from '../../src/direct/converters.js';
import type { DirectResult } from '../../src/direct/types.js';

describe('converters', () => {
  describe('unwrapMcpResult', () => {
    it('should convert MCP success result to DirectResult success', () => {
      const mcpResult: CallToolResult = {
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
        data: { deviceId: 'test-123', status: 'on' },
      } as any;

      const directResult = unwrapMcpResult<{ deviceId: string; status: string }>(mcpResult);

      expect(directResult.success).toBe(true);
      if (directResult.success) {
        expect(directResult.data).toEqual({ deviceId: 'test-123', status: 'on' });
      }
    });

    it('should convert MCP error result with code to DirectResult error', () => {
      const mcpError: CallToolResult = {
        content: [{ type: 'text', text: 'Device not found' }],
        isError: true,
        code: 'DEVICE_NOT_FOUND',
        details: { deviceId: 'invalid-123' },
      } as any;

      const directResult = unwrapMcpResult<void>(mcpError);

      expect(directResult.success).toBe(false);
      if (!directResult.success) {
        expect(directResult.error.code).toBe('DEVICE_NOT_FOUND');
        expect(directResult.error.message).toBe('Device not found');
        expect(directResult.error.details).toEqual({ deviceId: 'invalid-123' });
      }
    });

    it('should use UNKNOWN_ERROR code when MCP error has no code', () => {
      const mcpError: CallToolResult = {
        content: [{ type: 'text', text: 'Something went wrong' }],
        isError: true,
      } as any;

      const directResult = unwrapMcpResult<void>(mcpError);

      expect(directResult.success).toBe(false);
      if (!directResult.success) {
        expect(directResult.error.code).toBe('UNKNOWN_ERROR');
        expect(directResult.error.message).toBe('Something went wrong');
        expect(directResult.error.details).toBeUndefined();
      }
    });

    it('should use "Unknown error" message when content is empty', () => {
      const mcpError: CallToolResult = {
        content: [],
        isError: true,
        code: 'INTERNAL_ERROR',
      } as any;

      const directResult = unwrapMcpResult<void>(mcpError);

      expect(directResult.success).toBe(false);
      if (!directResult.success) {
        expect(directResult.error.code).toBe('INTERNAL_ERROR');
        expect(directResult.error.message).toBe('Unknown error');
      }
    });

    it('should use "Unknown error" message when content has no text field', () => {
      const mcpError: CallToolResult = {
        content: [{ type: 'resource' }] as any,
        isError: true,
        code: 'PARSE_ERROR',
      } as any;

      const directResult = unwrapMcpResult<void>(mcpError);

      expect(directResult.success).toBe(false);
      if (!directResult.success) {
        expect(directResult.error.code).toBe('PARSE_ERROR');
        expect(directResult.error.message).toBe('Unknown error');
      }
    });

    it('should preserve undefined data for void operations', () => {
      const mcpResult: CallToolResult = {
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
        data: undefined,
      } as any;

      const directResult = unwrapMcpResult<void>(mcpResult);

      expect(directResult.success).toBe(true);
      if (directResult.success) {
        expect(directResult.data).toBeUndefined();
      }
    });

    it('should handle complex nested data structures', () => {
      const complexData = {
        devices: [
          { id: 'device-1', name: 'Light', status: { power: 'on', level: 75 } },
          { id: 'device-2', name: 'Switch', status: { power: 'off' } },
        ],
        metadata: {
          count: 2,
          timestamp: '2025-11-30T12:00:00Z',
        },
      };

      const mcpResult: CallToolResult = {
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
        data: complexData,
      } as any;

      const directResult = unwrapMcpResult<typeof complexData>(mcpResult);

      expect(directResult.success).toBe(true);
      if (directResult.success) {
        expect(directResult.data).toEqual(complexData);
        expect(directResult.data.devices).toHaveLength(2);
        expect(directResult.data.metadata.count).toBe(2);
      }
    });
  });

  describe('wrapDirectResult', () => {
    it('should convert DirectResult success to MCP success result', () => {
      const directResult: DirectResult<{ value: number }> = {
        success: true,
        data: { value: 42 },
      };

      const mcpResult = wrapDirectResult(directResult);

      expect(mcpResult.isError).toBe(false);
      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0]).toEqual({ type: 'text', text: 'Success' });
      expect((mcpResult as any).data).toEqual({ value: 42 });
    });

    it('should convert DirectResult error to MCP error result', () => {
      const directResult: DirectResult<void> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'deviceId' },
        },
      };

      const mcpResult = wrapDirectResult(directResult);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0]).toEqual({
        type: 'text',
        text: 'Error (VALIDATION_ERROR): Invalid input',
      });
      expect((mcpResult as any).code).toBe('VALIDATION_ERROR');
      expect((mcpResult as any).details).toEqual({ field: 'deviceId' });
    });

    it('should handle DirectResult success with undefined data', () => {
      const directResult: DirectResult<void> = {
        success: true,
        data: undefined,
      };

      const mcpResult = wrapDirectResult(directResult);

      expect(mcpResult.isError).toBe(false);
      expect((mcpResult as any).data).toBeUndefined();
    });

    it('should handle DirectResult error without details', () => {
      const directResult: DirectResult<void> = {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'Operation timed out',
        },
      };

      const mcpResult = wrapDirectResult(directResult);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0]).toEqual({
        type: 'text',
        text: 'Error (TIMEOUT): Operation timed out',
      });
      expect((mcpResult as any).code).toBe('TIMEOUT');
      expect((mcpResult as any).details).toBeUndefined();
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through wrap → unwrap cycle (success)', () => {
      const originalData = { id: 'test-123', value: [1, 2, 3] };
      const directResult: DirectResult<typeof originalData> = {
        success: true,
        data: originalData,
      };

      const mcpResult = wrapDirectResult(directResult);
      const unwrappedResult = unwrapMcpResult<typeof originalData>(mcpResult);

      expect(unwrappedResult.success).toBe(true);
      if (unwrappedResult.success) {
        expect(unwrappedResult.data).toEqual(originalData);
      }
    });

    it('should preserve error through wrap → unwrap cycle', () => {
      const directError: DirectResult<void> = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          details: { resource: 'device-xyz' },
        },
      };

      const mcpResult = wrapDirectResult(directError);
      const unwrappedResult = unwrapMcpResult<void>(mcpResult);

      expect(unwrappedResult.success).toBe(false);
      if (!unwrappedResult.success) {
        expect(unwrappedResult.error.code).toBe('NOT_FOUND');
        // Note: message format changes due to wrapping
        expect(unwrappedResult.error.message).toContain('NOT_FOUND');
        expect(unwrappedResult.error.message).toContain('Resource not found');
        expect(unwrappedResult.error.details).toEqual({ resource: 'device-xyz' });
      }
    });
  });
});
