/**
 * Unit tests for OAuth callback validation schema
 *
 * Tests the Zod schema that validates OAuth callback parameters
 * to ensure it accepts valid SmartThings authorization codes of varying lengths.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * OAuth callback validation schema (extracted for testing)
 *
 * This is a copy of the schema from src/routes/oauth.ts for unit testing.
 * Keep in sync with production schema.
 */
const callbackSchema = z.object({
  code: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid authorization code format')
    .min(1, 'Authorization code too short')
    .max(500, 'Authorization code too long')
    .optional(),
  state: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'Invalid state token format')
    .length(64, 'State token must be 64 hex characters')
    .optional(),
  error: z
    .string()
    .max(100, 'Error code too long')
    .regex(/^[a-z_]+$/, 'Invalid error code format')
    .optional(),
  error_description: z
    .string()
    .max(500, 'Error description too long')
    .optional(),
});

describe('OAuth Callback Validation Schema', () => {
  describe('Authorization Code Validation', () => {
    it('should accept 6-character SmartThings code (regression test)', () => {
      const result = callbackSchema.safeParse({
        code: '3VBxcn',
        state: 'e015d6256edab83bc66a1925c2e272cdb7bea0627fbe558600a221be56b575bf',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('3VBxcn');
      }
    });

    it('should accept varying authorization code lengths', () => {
      const validCodes = [
        '1a', // 2 chars
        'abc123', // 6 chars
        'a1b2c3d4e5f6g7h8', // 16 chars
        'a'.repeat(100), // 100 chars
        'a'.repeat(500), // 500 chars (max)
      ];

      const validState = 'a'.repeat(64);

      validCodes.forEach((code) => {
        const result = callbackSchema.safeParse({ code, state: validState });
        expect(result.success).toBe(true);
      });
    });

    it('should reject empty authorization code', () => {
      const result = callbackSchema.safeParse({
        code: '',
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Empty string fails regex validation before length check
        expect(result.error.errors[0].message).toContain('Invalid authorization code format');
      }
    });

    it('should reject authorization code exceeding max length', () => {
      const result = callbackSchema.safeParse({
        code: 'a'.repeat(501), // Over max
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('too long');
      }
    });

    it('should reject authorization code with invalid characters', () => {
      const invalidCodes = [
        'abc@123', // @ symbol
        'code with spaces',
        'code<script>',
        'code;DROP TABLE',
        'code\ninjection',
      ];

      const validState = 'a'.repeat(64);

      invalidCodes.forEach((code) => {
        const result = callbackSchema.safeParse({ code, state: validState });
        expect(result.success).toBe(false);
      });
    });

    it('should accept authorization code with allowed special characters', () => {
      const validCodes = [
        'abc-123',
        'abc_123',
        'ABC-xyz_789',
      ];

      const validState = 'a'.repeat(64);

      validCodes.forEach((code) => {
        const result = callbackSchema.safeParse({ code, state: validState });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('State Token Validation', () => {
    it('should accept valid 64-character hex state token', () => {
      const result = callbackSchema.safeParse({
        code: 'valid_code',
        state: 'e015d6256edab83bc66a1925c2e272cdb7bea0627fbe558600a221be56b575bf',
      });

      expect(result.success).toBe(true);
    });

    it('should reject state token with invalid length', () => {
      const result = callbackSchema.safeParse({
        code: 'valid_code',
        state: 'a'.repeat(63), // Too short
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // 63 chars fails regex validation before length check (regex requires exactly 64)
        expect(result.error.errors[0].message).toContain('Invalid state token format');
      }
    });

    it('should reject state token with non-hex characters', () => {
      const result = callbackSchema.safeParse({
        code: 'valid_code',
        state: 'g'.repeat(64), // 'g' is not hex
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('format');
      }
    });

    it('should reject state token with uppercase hex characters', () => {
      const result = callbackSchema.safeParse({
        code: 'valid_code',
        state: 'A'.repeat(64), // Uppercase not allowed
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Error Parameter Validation', () => {
    it('should accept valid error code', () => {
      const result = callbackSchema.safeParse({
        error: 'access_denied',
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(true);
    });

    it('should reject error code with invalid characters', () => {
      const result = callbackSchema.safeParse({
        error: 'ACCESS_DENIED', // Uppercase not allowed
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(false);
    });

    it('should accept error description with spaces', () => {
      const result = callbackSchema.safeParse({
        error: 'access_denied',
        error_description: 'User denied access to the application',
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(true);
    });

    it('should reject error description exceeding max length', () => {
      const result = callbackSchema.safeParse({
        error: 'error',
        error_description: 'a'.repeat(501), // Over max
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('too long');
      }
    });
  });

  describe('Optional Parameters', () => {
    it('should accept callback with only code and state', () => {
      const result = callbackSchema.safeParse({
        code: 'valid_code',
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(true);
    });

    it('should accept callback with only error parameters', () => {
      const result = callbackSchema.safeParse({
        error: 'access_denied',
        error_description: 'User denied access',
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(true);
    });

    it('should accept callback with only state', () => {
      const result = callbackSchema.safeParse({
        state: 'a'.repeat(64),
      });

      expect(result.success).toBe(true);
    });
  });
});
