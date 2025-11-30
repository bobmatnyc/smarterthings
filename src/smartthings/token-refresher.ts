import { SmartThingsOAuthService } from './oauth-service.js';
import { TokenStorage } from '../storage/token-storage.js';
import { logger } from '../logger.js';

/**
 * Background token refresh service.
 *
 * Automatically refreshes OAuth access tokens before they expire.
 * Runs as a background process with configurable check interval.
 *
 * Design Decision: Proactive refresh at 1 hour before expiration
 * Rationale: Prevents token expiration during active use, allows time for retry on failure.
 *
 * Trade-offs:
 * - Frequency: More frequent checks vs. less resource usage
 * - Buffer time: Earlier refresh vs. risk of expiration
 *
 * Retry Strategy:
 * - 3 attempts with exponential backoff (30s, 60s, 120s)
 * - If all attempts fail, log error and wait for next check interval
 */
export class TokenRefresher {
  private oauthService: SmartThingsOAuthService;
  private tokenStorage: TokenStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number;
  private refreshBufferSeconds: number;

  constructor(
    oauthService: SmartThingsOAuthService,
    tokenStorage: TokenStorage,
    checkIntervalMinutes: number = 60, // Check every hour by default
    refreshBufferSeconds: number = 3600 // Refresh 1 hour before expiration
  ) {
    this.oauthService = oauthService;
    this.tokenStorage = tokenStorage;
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
    this.refreshBufferSeconds = refreshBufferSeconds;

    logger.info('Token refresher initialized', {
      checkIntervalMinutes,
      refreshBufferSeconds,
    });
  }

  /**
   * Start automatic token refresh.
   *
   * Checks token expiration at regular intervals and refreshes proactively.
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Token refresher already running');
      return;
    }

    logger.info('Starting token refresher', {
      checkIntervalMs: this.checkIntervalMs,
      refreshBufferSeconds: this.refreshBufferSeconds,
    });

    // Run initial check immediately
    this.checkAndRefresh('default').catch((error) => {
      logger.error('Initial token refresh check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndRefresh('default').catch((error) => {
        logger.error('Periodic token refresh check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.checkIntervalMs);
  }

  /**
   * Stop automatic token refresh.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Token refresher stopped');
    }
  }

  /**
   * Check token expiration and refresh if needed.
   *
   * @param userId - User identifier (default: 'default' for single-user)
   */
  private async checkAndRefresh(userId: string): Promise<void> {
    // Check if user has tokens
    const hasTokens = await this.tokenStorage.hasTokens(userId);
    if (!hasTokens) {
      logger.debug('No tokens to refresh', { userId });
      return;
    }

    // Get current tokens
    const tokens = await this.tokenStorage.getTokens(userId);
    if (!tokens) {
      logger.debug('No tokens found for user', { userId });
      return;
    }

    // Check if token needs refresh
    const shouldRefresh = SmartThingsOAuthService.shouldRefreshToken(
      tokens.expiresAt,
      this.refreshBufferSeconds
    );

    if (!shouldRefresh) {
      const timeUntilExpiry = tokens.expiresAt - Math.floor(Date.now() / 1000);
      logger.debug('Token does not need refresh yet', {
        userId,
        expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
        secondsUntilExpiry: timeUntilExpiry,
      });
      return;
    }

    // Token needs refresh
    logger.info('Token needs refresh', {
      userId,
      expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
    });

    // Attempt refresh with retry logic
    await this.refreshWithRetry(userId, tokens.refreshToken);
  }

  /**
   * Refresh token with exponential backoff retry.
   *
   * @param userId - User identifier
   * @param refreshToken - Refresh token to use
   * @param attempt - Current attempt number (1-based)
   */
  private async refreshWithRetry(
    userId: string,
    refreshToken: string,
    attempt: number = 1
  ): Promise<void> {
    const maxAttempts = 3;
    const baseDelayMs = 30000; // 30 seconds

    try {
      // Attempt token refresh
      const newTokens = await this.oauthService.refreshAccessToken(refreshToken);

      // Calculate new expiry timestamp
      const expiresAt = SmartThingsOAuthService.calculateExpiryTimestamp(
        newTokens.expires_in
      );

      // Store refreshed tokens
      await this.tokenStorage.storeTokens(
        userId,
        newTokens.access_token,
        newTokens.refresh_token,
        expiresAt,
        newTokens.scope
      );

      logger.info('Token refresh successful', {
        userId,
        attempt,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (attempt >= maxAttempts) {
        logger.error('Token refresh failed after max attempts', {
          userId,
          attempts: maxAttempts,
          error: errorMessage,
        });
        return;
      }

      // Calculate exponential backoff delay
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);

      logger.warn('Token refresh attempt failed, will retry', {
        userId,
        attempt,
        maxAttempts,
        retryInSeconds: delayMs / 1000,
        error: errorMessage,
      });

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Retry with incremented attempt
      await this.refreshWithRetry(userId, refreshToken, attempt + 1);
    }
  }

  /**
   * Manually trigger token refresh (for testing or immediate needs).
   *
   * @param userId - User identifier (default: 'default' for single-user)
   */
  async manualRefresh(userId: string = 'default'): Promise<void> {
    logger.info('Manual token refresh triggered', { userId });
    await this.checkAndRefresh(userId);
  }
}
