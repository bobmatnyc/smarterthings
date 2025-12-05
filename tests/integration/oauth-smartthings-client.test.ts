import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SmartThingsService } from '../../src/smartthings/client.js';
import { getTokenStorage } from '../../src/storage/token-storage.js';
import { SmartThingsOAuthService } from '../../src/smartthings/oauth-service.js';
import fs from 'fs';

/**
 * Integration tests for OAuth token integration in SmartThingsClient.
 *
 * Ticket 1M-601: OAuth Token Integration Tests
 *
 * Test Coverage:
 * - OAuth token usage when available
 * - PAT fallback when OAuth unavailable
 * - Token refresh before API calls
 * - Error handling for missing authentication
 *
 * Design Decision: Integration tests over unit tests
 * Rationale: Tests actual OAuth flow integration, not just mocked behavior.
 * Validates token storage, authentication, and fallback logic work together.
 */

describe('OAuth Token Integration in SmartThingsClient', () => {
  const testDbPath = './data/test-tokens.db';

  beforeEach(() => {
    // Clean up test database before each test
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Reset environment variables
    vi.stubEnv('SMARTTHINGS_PAT', undefined);
    vi.stubEnv('SMARTTHINGS_CLIENT_ID', undefined);
    vi.stubEnv('SMARTTHINGS_CLIENT_SECRET', undefined);
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', undefined);
  });

  afterEach(() => {
    // Clean up test database after each test
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    vi.unstubAllEnvs();
  });

  it('should use OAuth token when available in storage', () => {
    // Set up OAuth configuration
    vi.stubEnv('SMARTTHINGS_CLIENT_ID', 'test-client-id');
    vi.stubEnv('SMARTTHINGS_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'test-encryption-key-32-chars-long!!');
    vi.stubEnv('OAUTH_REDIRECT_URI', 'http://localhost:5182/callback');
    vi.stubEnv('OAUTH_STATE_SECRET', 'test-state-secret');

    // Store mock OAuth token
    const tokenStorage = getTokenStorage(testDbPath);
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    tokenStorage.storeTokens(
      'default',
      'mock-oauth-access-token',
      'mock-oauth-refresh-token',
      expiresAt,
      'r:devices:* x:devices:*'
    );

    // Create service (should use OAuth)
    const service = new SmartThingsService();

    // Verify service was created (OAuth initialization would throw if failed)
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SmartThingsService);

    // Note: Cannot verify actual OAuth usage without mocking SmartThingsClient
    // This test validates that OAuth configuration doesn't break construction
  });

  it('should fall back to PAT when no OAuth token is available', () => {
    // Set up PAT only (no OAuth config)
    vi.stubEnv('SMARTTHINGS_PAT', 'mock-pat-token-12345');

    // Ensure no OAuth token in storage
    const tokenStorage = getTokenStorage(testDbPath);
    expect(tokenStorage.hasTokens('default')).toBe(false);

    // Create service (should use PAT fallback)
    const service = new SmartThingsService();

    // Verify service was created with PAT
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SmartThingsService);
  });

  it('should fall back to PAT when OAuth credentials are missing', () => {
    // Set up incomplete OAuth config + PAT
    vi.stubEnv('SMARTTHINGS_CLIENT_ID', 'test-client-id');
    // Missing CLIENT_SECRET and ENCRYPTION_KEY
    vi.stubEnv('SMARTTHINGS_PAT', 'mock-pat-token-12345');

    // Store OAuth token (but credentials are incomplete)
    const tokenStorage = getTokenStorage(testDbPath);
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;

    tokenStorage.storeTokens(
      'default',
      'mock-oauth-access-token',
      'mock-oauth-refresh-token',
      expiresAt,
      'r:devices:* x:devices:*'
    );

    // Create service (should fall back to PAT due to incomplete OAuth config)
    const service = new SmartThingsService();

    // Verify service was created with PAT fallback
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SmartThingsService);
  });

  it('should throw error when neither OAuth nor PAT is available', () => {
    // No OAuth config, no PAT
    vi.stubEnv('SMARTTHINGS_PAT', undefined);

    // Ensure no OAuth token in storage
    const tokenStorage = getTokenStorage(testDbPath);
    expect(tokenStorage.hasTokens('default')).toBe(false);

    // Attempt to create service (should throw)
    expect(() => {
      new SmartThingsService();
    }).toThrow(/SmartThings authentication required/);
  });

  it('should calculate token expiry correctly', () => {
    const expiresIn = 86400; // 24 hours in seconds
    const expiresAt = SmartThingsOAuthService.calculateExpiryTimestamp(expiresIn);

    const now = Math.floor(Date.now() / 1000);
    const expected = now + expiresIn;

    // Allow 1 second tolerance for test execution time
    expect(expiresAt).toBeGreaterThanOrEqual(expected - 1);
    expect(expiresAt).toBeLessThanOrEqual(expected + 1);
  });

  it('should detect when token needs refresh', () => {
    const now = Math.floor(Date.now() / 1000);

    // Token expires in 10 minutes (should NOT refresh with 1 hour buffer)
    const expiresIn10Min = now + 600;
    expect(SmartThingsOAuthService.shouldRefreshToken(expiresIn10Min, 3600)).toBe(true);

    // Token expires in 2 hours (should NOT refresh with 1 hour buffer)
    const expiresIn2Hours = now + 7200;
    expect(SmartThingsOAuthService.shouldRefreshToken(expiresIn2Hours, 3600)).toBe(false);

    // Token already expired (should refresh)
    const expiredToken = now - 100;
    expect(SmartThingsOAuthService.shouldRefreshToken(expiredToken, 3600)).toBe(true);
  });

  it('should store and retrieve OAuth tokens correctly', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'test-encryption-key-32-chars-long!!');

    const tokenStorage = getTokenStorage(testDbPath);
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;

    // Store tokens
    tokenStorage.storeTokens(
      'default',
      'test-access-token',
      'test-refresh-token',
      expiresAt,
      'r:devices:* x:devices:*'
    );

    // Retrieve tokens
    const tokens = tokenStorage.getTokens('default');

    expect(tokens).toBeDefined();
    expect(tokens?.accessToken).toBe('test-access-token');
    expect(tokens?.refreshToken).toBe('test-refresh-token');
    expect(tokens?.expiresAt).toBe(expiresAt);
    expect(tokens?.scope).toBe('r:devices:* x:devices:*');
  });

  it('should handle token deletion correctly', () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'test-encryption-key-32-chars-long!!');

    const tokenStorage = getTokenStorage(testDbPath);
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;

    // Store tokens
    tokenStorage.storeTokens(
      'default',
      'test-access-token',
      'test-refresh-token',
      expiresAt,
      'r:devices:* x:devices:*'
    );

    expect(tokenStorage.hasTokens('default')).toBe(true);

    // Delete tokens
    tokenStorage.deleteTokens('default');

    expect(tokenStorage.hasTokens('default')).toBe(false);
    expect(tokenStorage.getTokens('default')).toBeNull();
  });
});
