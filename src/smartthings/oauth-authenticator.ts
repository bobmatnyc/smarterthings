import { BearerTokenAuthenticator } from '@smartthings/core-sdk';
import type { TokenStorage } from '../storage/token-storage.js';
import { SmartThingsOAuthService } from './oauth-service.js';
import logger from '../utils/logger.js';

/**
 * OAuth token authenticator with automatic refresh.
 *
 * Design Decision: Extends BearerTokenAuthenticator for OAuth integration
 * Rationale: Reuses SmartThings SDK authentication while adding OAuth token refresh.
 * Automatically refreshes expired tokens before API calls to prevent failures.
 *
 * Security:
 * - Tokens stored encrypted via TokenStorage layer
 * - Automatic refresh 5 minutes before expiration
 * - Thread-safe refresh (single refresh at a time)
 *
 * Performance:
 * - Token refresh only when needed (< 5 min to expiry)
 * - Cached token used for all API calls
 * - Minimal overhead (~1ms for expiry check)
 *
 * Error Handling:
 * - Refresh failure: Logs error, throws to trigger re-authentication flow
 * - Token missing: Throws error with clear message
 * - Race conditions: Mutex prevents concurrent refresh attempts
 *
 * Trade-offs:
 * - Simplicity: Automatic refresh vs. manual token management
 * - Timing: 5-minute buffer vs. risk of expiration during long operations
 * - Coupling: Depends on TokenStorage and OAuthService
 *
 * @module smartthings/oauth-authenticator
 */
export class OAuthTokenAuthenticator extends BearerTokenAuthenticator {
  private tokenStorage: TokenStorage;
  private oauthService: SmartThingsOAuthService;
  private userId: string;
  private refreshInProgress: Promise<void> | null = null;

  /**
   * Create OAuth token authenticator.
   *
   * @param tokenStorage - Token storage instance for reading/writing tokens
   * @param oauthService - OAuth service for token refresh
   * @param userId - User identifier (default: 'default' for single-user)
   * @throws Error if no OAuth token available in storage
   */
  constructor(
    tokenStorage: TokenStorage,
    oauthService: SmartThingsOAuthService,
    userId: string = 'default'
  ) {
    // Get initial token from storage (synchronous)
    const initialToken = tokenStorage.getTokens(userId);
    if (!initialToken) {
      throw new Error(
        'No OAuth token available. Please authenticate via /auth/smartthings'
      );
    }

    // Initialize parent with access token
    super(initialToken.accessToken);

    this.tokenStorage = tokenStorage;
    this.oauthService = oauthService;
    this.userId = userId;

    logger.debug('OAuth authenticator initialized', {
      userId,
      expiresAt: new Date(initialToken.expiresAt * 1000).toISOString(),
    });
  }

  /**
   * Authenticate request with OAuth token.
   *
   * Overrides BearerTokenAuthenticator.authenticate() to check token expiration
   * and refresh automatically before API calls.
   *
   * Flow:
   * 1. Check if token expires in < 5 minutes
   * 2. If yes, refresh token (with mutex protection)
   * 3. Update internal token reference
   * 4. Call parent authenticate() with fresh token
   *
   * @returns HTTP headers with Bearer token
   * @throws Error if token refresh fails
   */
  async authenticate(): Promise<any> {
    // Check if token needs refresh (synchronous check)
    const tokens = this.tokenStorage.getTokens(this.userId);

    if (!tokens) {
      throw new Error(
        'OAuth token not found in storage. Please re-authenticate.'
      );
    }

    // Check if token expires in < 5 minutes (300 seconds)
    const shouldRefresh = SmartThingsOAuthService.shouldRefreshToken(
      tokens.expiresAt,
      300 // 5 minutes buffer
    );

    if (shouldRefresh) {
      // Mutex: Wait if refresh already in progress
      if (this.refreshInProgress) {
        logger.debug('Waiting for ongoing token refresh', { userId: this.userId });
        await this.refreshInProgress;
      } else {
        // Start new refresh (protected by mutex)
        this.refreshInProgress = this.refreshToken();
        try {
          await this.refreshInProgress;
        } finally {
          this.refreshInProgress = null;
        }
      }

      // Get fresh token after refresh (synchronous)
      const refreshedTokens = this.tokenStorage.getTokens(this.userId);
      if (!refreshedTokens) {
        throw new Error('Token refresh failed. Please re-authenticate.');
      }

      // Update internal token reference for parent class
      this.token = refreshedTokens.accessToken;

      logger.debug('Using refreshed token for API call', {
        userId: this.userId,
        expiresAt: new Date(refreshedTokens.expiresAt * 1000).toISOString(),
      });
    }

    // Call parent authenticate() with current token
    return super.authenticate();
  }

  /**
   * Refresh OAuth token using refresh token.
   *
   * Called automatically when token is about to expire.
   * Updates TokenStorage with new access and refresh tokens.
   *
   * @throws Error if refresh fails
   */
  private async refreshToken(): Promise<void> {
    logger.info('Refreshing OAuth token', { userId: this.userId });

    const tokens = this.tokenStorage.getTokens(this.userId);
    if (!tokens) {
      throw new Error('No tokens to refresh');
    }

    try {
      // Call SmartThings OAuth API to refresh
      const newTokens = await this.oauthService.refreshAccessToken(
        tokens.refreshToken
      );

      // Calculate new expiry timestamp
      const expiresAt = SmartThingsOAuthService.calculateExpiryTimestamp(
        newTokens.expires_in
      );

      // Store refreshed tokens (synchronous)
      this.tokenStorage.storeTokens(
        this.userId,
        newTokens.access_token,
        newTokens.refresh_token,
        expiresAt,
        newTokens.scope
      );

      logger.info('OAuth token refreshed successfully', {
        userId: this.userId,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      });
    } catch (error) {
      logger.error('OAuth token refresh failed', {
        userId: this.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}. Please re-authenticate.`
      );
    }
  }

  /**
   * Manually trigger token refresh (for testing or immediate needs).
   *
   * @returns Promise that resolves when refresh completes
   */
  async forceRefresh(): Promise<void> {
    await this.refreshToken();
  }
}
