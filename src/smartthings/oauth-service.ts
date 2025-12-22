import crypto from 'crypto';
import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * SmartThings OAuth2 Service
 *
 * Implements OAuth2 authorization code flow for SmartThings API access.
 * Handles authorization URL generation, token exchange, and token refresh.
 *
 * Design Decision: OAuth2 over Personal Access Tokens (PAT)
 * Rationale: SmartThings PAT tokens now expire every 24 hours (changed Dec 2024).
 * OAuth2 provides automatic token refresh via refresh tokens, eliminating manual daily updates.
 *
 * Security:
 * - HTTPS required for all OAuth operations
 * - CSRF protection via state parameter
 * - Tokens should be encrypted at rest (handled by TokenStorage layer)
 *
 * References:
 * - https://developer.smartthings.com/docs/connected-services/oauth-integrations
 * - https://oauth.net/2/
 */

// OAuth endpoints
const SMARTTHINGS_OAUTH_BASE = 'https://api.smartthings.com/oauth';
const AUTHORIZE_ENDPOINT = `${SMARTTHINGS_OAUTH_BASE}/authorize`;
const TOKEN_ENDPOINT = `${SMARTTHINGS_OAUTH_BASE}/token`;

/**
 * OAuth token response from SmartThings
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  refresh_token: string;
  expires_in: number; // Seconds until access token expires (typically 86400 = 24 hours)
  scope: string; // Space-separated list of granted scopes
}

/**
 * OAuth configuration from environment variables
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string; // Secret for generating/validating CSRF state tokens
}

/**
 * OAuth service for SmartThings API
 */
export class SmartThingsOAuthService {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Generate authorization URL for user to grant access.
   *
   * Flow:
   * 1. User clicks "Connect SmartThings" button
   * 2. App redirects to this URL
   * 3. User logs in to SmartThings and grants permissions
   * 4. SmartThings redirects back to redirectUri with authorization code
   *
   * @param scopes - OAuth scopes to request (e.g., ['r:devices:*', 'x:devices:*'])
   * @returns Authorization URL and state token (store state for CSRF validation)
   */
  generateAuthorizationUrl(scopes: string[]): { url: string; state: string } {
    // Generate cryptographically secure state token for CSRF protection
    const state = this.generateStateToken();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state,
    });

    const url = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;

    logger.info('Generated OAuth authorization URL', {
      scopes,
      redirectUri: this.config.redirectUri,
    });

    return { url, state };
  }

  /**
   * Exchange authorization code for access and refresh tokens.
   *
   * Called after user authorizes and is redirected back with code parameter.
   *
   * @param code - Authorization code from callback URL
   * @param state - State token from callback URL (for CSRF validation)
   * @param expectedState - Expected state token (from session/cookie)
   * @returns OAuth tokens (access_token, refresh_token, expires_in, scope)
   * @throws Error if state validation fails or token exchange fails
   */
  async exchangeCodeForTokens(
    code: string,
    state: string,
    expectedState: string
  ): Promise<OAuthTokenResponse> {
    // CSRF protection: validate state parameter
    if (state !== expectedState) {
      logger.error('OAuth state mismatch (CSRF attempt detected)', {
        received: state,
        expected: expectedState,
      });
      throw new Error('Invalid state parameter (CSRF validation failed)');
    }

    // Prepare Basic Auth header: Base64(client_id:client_secret)
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64'
    );

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    try {
      logger.info('Exchanging authorization code for tokens');

      const response = await axios.post<OAuthTokenResponse>(TOKEN_ENDPOINT, params.toString(), {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      logger.info('Successfully obtained OAuth tokens', {
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('OAuth token exchange failed', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw new Error(
          `Failed to exchange authorization code: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token.
   *
   * Should be called proactively before access token expires (e.g., at 23 hours).
   *
   * @param refreshToken - Refresh token from previous token response
   * @returns New OAuth tokens (access_token, refresh_token, expires_in, scope)
   * @throws Error if refresh fails (user must re-authorize)
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64'
    );

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    try {
      logger.info('Refreshing access token');

      const response = await axios.post<OAuthTokenResponse>(TOKEN_ENDPOINT, params.toString(), {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      logger.info('Successfully refreshed access token', {
        expiresIn: response.data.expires_in,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Token refresh failed', {
          status: error.response?.status,
          data: error.response?.data,
        });

        // Common error: refresh token expired or revoked
        if (error.response?.status === 401 || error.response?.status === 400) {
          throw new Error('Refresh token expired or revoked. User must re-authorize.');
        }

        throw new Error(
          `Failed to refresh access token: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Revoke OAuth token (access or refresh token).
   *
   * CVE-2024-OAUTH-001 Fix: Implements token revocation on SmartThings side.
   * This ensures tokens cannot be used after user disconnects, preventing
   * orphaned tokens from remaining valid for up to 24 hours.
   *
   * Security Impact: HIGH - Enables immediate token invalidation
   * CVSS Score: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
   *
   * @param token - Token to revoke (access_token or refresh_token)
   * @param tokenTypeHint - Hint for token type ('access_token' or 'refresh_token')
   * @throws Error if revocation fails (non-critical, doesn't block disconnect)
   */
  async revokeToken(
    token: string,
    tokenTypeHint: 'access_token' | 'refresh_token' = 'access_token'
  ): Promise<void> {
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64'
    );

    const params = new URLSearchParams({
      token,
      token_type_hint: tokenTypeHint,
    });

    try {
      logger.info('Revoking OAuth token', { tokenTypeHint });

      await axios.post(`${SMARTTHINGS_OAUTH_BASE}/revoke`, params.toString(), {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      logger.info('Token revoked successfully', { tokenTypeHint });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 404 means token doesn't exist (already revoked or invalid) - not an error
        if (error.response?.status === 404) {
          logger.info('Token already revoked or invalid', { tokenTypeHint });
          return;
        }

        logger.warn('Token revocation failed (non-blocking)', {
          status: error.response?.status,
          data: error.response?.data,
          tokenTypeHint,
        });

        // Don't throw - revocation failure shouldn't block disconnect
        // User can still remove tokens locally for immediate effect
      } else {
        logger.error('Token revocation error', {
          error: error instanceof Error ? error.message : String(error),
          tokenTypeHint,
        });
      }
    }
  }

  /**
   * Generate cryptographically secure state token for CSRF protection.
   *
   * State token should be:
   * - Stored in session/cookie before redirecting to authorization URL
   * - Validated when user is redirected back with authorization code
   *
   * @returns Random hex string (32 bytes = 64 hex characters)
   */
  private generateStateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculate Unix timestamp when token will expire.
   *
   * @param expiresIn - Seconds until expiration (from token response)
   * @returns Unix timestamp (seconds since epoch)
   */
  static calculateExpiryTimestamp(expiresIn: number): number {
    return Math.floor(Date.now() / 1000) + expiresIn;
  }

  /**
   * Check if token is expired or close to expiration.
   *
   * @param expiresAt - Unix timestamp when token expires
   * @param bufferSeconds - Refresh if expiring within this many seconds (default: 3600 = 1 hour)
   * @returns True if token should be refreshed
   */
  static shouldRefreshToken(expiresAt: number, bufferSeconds: number = 3600): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= expiresAt - bufferSeconds;
  }
}

/**
 * Default scopes for SmartThings OAuth
 *
 * Must match EXACTLY what's configured in SmartApp OAuth settings.
 * The $ suffix means "owned by the user" while * means "all devices".
 *
 * - r:devices:$ - Read user's own devices
 * - r:devices:* - Read all devices
 * - x:devices:$ - Execute commands on user's own devices
 * - x:devices:* - Execute commands on all devices
 * - r:locations:* - Read all locations (required for rooms)
 * - r:scenes:* - Read all scenes
 * - x:scenes:* - Execute scenes
 *
 * Note: SmartThings OAuth is strict about scope matching.
 * These must match the SmartApp configuration exactly.
 */
export const DEFAULT_SCOPES = [
  'r:devices:$',
  'r:devices:*',
  'x:devices:$',
  'x:devices:*',
  'r:locations:*',
  'r:scenes:*',    // READ scenes
  'x:scenes:*',    // EXECUTE scenes
  'r:rules:*',     // READ rules (automations)
  'w:rules:*',     // WRITE/modify rules
  'x:rules:*',     // EXECUTE rules
];
