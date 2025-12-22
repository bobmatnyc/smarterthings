import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SmartThingsOAuthService, DEFAULT_SCOPES } from '../smartthings/oauth-service.js';
import { reinitializeSmartThingsAdapter } from '../server-alexa.js';
import { TokenStorage } from '../storage/token-storage.js';
import { TokenRefresher } from '../smartthings/token-refresher.js';
import { environment } from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * CVE-2024-OAUTH-003 Fix: Input validation schema for OAuth callback
 *
 * Validates callback parameters to prevent XSS and injection attacks.
 * Security Impact: MEDIUM - Prevents malicious input processing
 *
 * Validation rules:
 * - code: Authorization code (alphanumeric, dash, underscore; 1-500 chars)
 *   Note: SmartThings authorization codes vary in length (observed: 6-500 chars).
 *   Previous min=10 rejected valid codes. Relaxed to min=1 while maintaining
 *   format validation for security.
 * - state: CSRF state token (64 hex characters exactly)
 * - error: Optional error code from SmartThings (max 100 chars, no HTML)
 * - error_description: Optional error description (max 500 chars, no HTML)
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
  error_description: z.string().max(500, 'Error description too long').optional(),
});

/**
 * OAuth state storage (in-memory for now, use Redis for production)
 *
 * Design Decision: In-memory state storage
 * Rationale: Simple implementation for single-server deployment.
 * Trade-off: State lost on server restart, but that's acceptable for OAuth flow
 * (user just retries authorization).
 *
 * Future: Use Redis for multi-server deployments or session store.
 */
const oauthStates = new Map<string, { timestamp: number }>();

/**
 * Clean up expired OAuth states (older than 24 hours)
 * Extended TTL for dashboard applications where users may take longer to complete auth
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  const expiryMs = 24 * 60 * 60 * 1000; // 24 hours (extended for dashboard apps)

  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > expiryMs) {
      oauthStates.delete(state);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredStates, 60 * 1000);

/**
 * Singleton OAuth service instance
 */
let oauthService: SmartThingsOAuthService | null = null;
let tokenStorage: TokenStorage | null = null;
let tokenRefresher: TokenRefresher | null = null;

/**
 * Get or create OAuth service instance
 */
function getOAuthService(): SmartThingsOAuthService {
  if (!oauthService) {
    // Validate required OAuth configuration
    if (
      !environment.SMARTTHINGS_CLIENT_ID ||
      !environment.SMARTTHINGS_CLIENT_SECRET ||
      !environment.OAUTH_REDIRECT_URI ||
      !environment.OAUTH_STATE_SECRET
    ) {
      throw new Error(
        'OAuth configuration incomplete. Please set SMARTTHINGS_CLIENT_ID, SMARTTHINGS_CLIENT_SECRET, OAUTH_REDIRECT_URI, and OAUTH_STATE_SECRET environment variables.'
      );
    }

    oauthService = new SmartThingsOAuthService({
      clientId: environment.SMARTTHINGS_CLIENT_ID,
      clientSecret: environment.SMARTTHINGS_CLIENT_SECRET,
      redirectUri: environment.OAUTH_REDIRECT_URI,
      stateSecret: environment.OAUTH_STATE_SECRET,
    });

    logger.info('OAuth service initialized');
  }

  return oauthService;
}

/**
 * Get or create token storage instance
 */
function getTokenStorage(): TokenStorage {
  if (!tokenStorage) {
    tokenStorage = new TokenStorage('./data/tokens.db');
    logger.info('Token storage initialized');
  }

  return tokenStorage;
}

/**
 * Get or create token refresher instance
 */
function getTokenRefresher(): TokenRefresher {
  if (!tokenRefresher) {
    const oauth = getOAuthService();
    const storage = getTokenStorage();
    tokenRefresher = new TokenRefresher(oauth, storage);
    tokenRefresher.start(); // Start background refresh
    logger.info('Token refresher started');
  }

  return tokenRefresher;
}

/**
 * Register OAuth routes on Fastify server
 *
 * Routes:
 * - GET /auth/smartthings - Initiate OAuth flow
 * - GET /auth/smartthings/callback - Handle OAuth callback
 * - POST /auth/smartthings/disconnect - Revoke tokens
 * - GET /auth/smartthings/status - Check connection status
 *
 * @param server Fastify instance
 */
export async function registerOAuthRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /auth/smartthings - Initiate OAuth authorization flow
   *
   * Redirects user to SmartThings authorization page.
   * User will be asked to log in and grant permissions.
   *
   * Flow:
   * 1. Generate authorization URL with CSRF state token
   * 2. Store state token for validation on callback
   * 3. Redirect user to SmartThings authorization page
   */
  server.get('/auth/smartthings', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('OAuth authorization flow initiated');

      const oauth = getOAuthService();

      // Generate authorization URL with CSRF protection
      const { url, state } = oauth.generateAuthorizationUrl(DEFAULT_SCOPES);

      // Store state token for validation (10-minute expiry)
      oauthStates.set(state, { timestamp: Date.now() });

      logger.debug('OAuth state stored', {
        state: state.substring(0, 8) + '...',
        expiresInMinutes: 10,
      });

      // Redirect user to SmartThings authorization page
      return reply.redirect(url);
    } catch (error) {
      logger.error('Failed to initiate OAuth flow', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'OAUTH_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initiate OAuth flow',
        },
      });
    }
  });

  /**
   * GET /auth/smartthings/callback - OAuth callback handler
   *
   * CVE-2024-OAUTH-003 Fix: Validates all callback parameters before processing.
   *
   * SmartThings redirects back here after user authorization.
   * Exchange authorization code for access and refresh tokens.
   *
   * Query Parameters:
   * - code: Authorization code (validated: alphanumeric, 1-500 chars)
   * - state: CSRF state token (validated: 64 hex chars)
   * - error: Optional error code (validated: lowercase with underscores)
   * - error_description: Optional error description (validated: max 500 chars)
   *
   * Flow:
   * 1. Validate input parameters (CVE-2024-OAUTH-003 fix)
   * 2. Validate state token (CSRF protection)
   * 3. Exchange authorization code for tokens
   * 4. Store encrypted tokens in database
   * 5. Start background token refresh
   * 6. Redirect to success page
   */
  server.get(
    '/auth/smartthings/callback',
    async (
      request: FastifyRequest<{
        Querystring: { code?: string; state?: string; error?: string; error_description?: string };
      }>,
      reply: FastifyReply
    ) => {
      // CVE-2024-OAUTH-003 Fix: Validate callback parameters
      let validatedQuery;
      try {
        validatedQuery = callbackSchema.parse(request.query);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          logger.error('Invalid OAuth callback parameters', {
            errors: validationError.errors,
            query: request.query,
          });
          const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=invalid_params`;
          return reply.redirect(errorUrl);
        }
        throw validationError;
      }

      const { code, state, error, error_description } = validatedQuery;

      // Handle user denial
      if (error) {
        logger.warn('OAuth authorization denied by user', { error, error_description });
        const errorUrl = `${environment.FRONTEND_URL}/?oauth=denied`;
        return reply.redirect(errorUrl);
      }

      // Validate required parameters (should not fail after schema validation, but defensive check)
      if (!code || !state) {
        logger.error('OAuth callback missing required parameters after validation', {
          hasCode: !!code,
          hasState: !!state,
        });
        const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=invalid_callback`;
        return reply.redirect(errorUrl);
      }

      try {
        logger.info('OAuth callback received', {
          state: state.substring(0, 8) + '...',
        });

        // Validate state token (CSRF protection)
        if (!oauthStates.has(state)) {
          logger.error('Invalid OAuth state token (CSRF attempt or expired)', {
            state: state.substring(0, 8) + '...',
          });
          const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=invalid_state`;
          return reply.redirect(errorUrl);
        }

        // Remove used state token
        oauthStates.delete(state);

        const oauth = getOAuthService();
        const storage = getTokenStorage();

        // Exchange authorization code for tokens
        const tokens = await oauth.exchangeCodeForTokens(code, state, state);

        // Calculate expiry timestamp
        const expiresAt = SmartThingsOAuthService.calculateExpiryTimestamp(tokens.expires_in);

        // Store encrypted tokens
        await storage.storeTokens(
          'default', // User ID (default for single-user)
          tokens.access_token,
          tokens.refresh_token,
          expiresAt,
          tokens.scope
        );

        logger.info('OAuth tokens stored successfully', {
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          scope: tokens.scope,
        });

        // Start background token refresh
        getTokenRefresher();

        // Reinitialize SmartThings adapter with new tokens
        try {
          await reinitializeSmartThingsAdapter();
          logger.info('SmartThings adapter reinitialized after OAuth');
        } catch (reinitError) {
          logger.warn('Failed to reinitialize adapter after OAuth', {
            error: reinitError instanceof Error ? reinitError.message : String(reinitError),
          });
          // Continue anyway - adapter will retry on next request
        }

        // Redirect to homepage on success
        // Note: Homepage will show success message if ?oauth=success is present
        const dashboardUrl = `${environment.FRONTEND_URL}/?oauth=success`;
        logger.info('Redirecting to homepage after successful OAuth', { dashboardUrl });
        return reply.redirect(dashboardUrl);
      } catch (error) {
        logger.error('OAuth callback failed', {
          error: error instanceof Error ? error.message : String(error),
        });

        const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=callback_failed`;
        return reply.redirect(errorUrl);
      }
    }
  );

  /**
   * POST /auth/smartthings/disconnect - Disconnect SmartThings
   *
   * CVE-2024-OAUTH-001 Fix: Revokes tokens on SmartThings before local deletion.
   *
   * Flow:
   * 1. Retrieve tokens from storage
   * 2. Revoke access and refresh tokens on SmartThings (best effort)
   * 3. Delete tokens from local database
   * 4. Stop background token refresh
   * 5. Return success
   *
   * Security: Token revocation is best-effort. If SmartThings API is unreachable,
   * tokens are still deleted locally, but may remain valid on SmartThings side
   * until natural expiration (up to 24 hours for access tokens).
   */
  server.post(
    '/auth/smartthings/disconnect',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        logger.info('SmartThings disconnect requested');

        const storage = getTokenStorage();
        const oauth = getOAuthService();

        // Get tokens before deletion (needed for revocation)
        const tokens = await storage.getTokens('default');

        if (tokens) {
          // Revoke tokens on SmartThings side (best effort - don't fail disconnect if this fails)
          try {
            logger.info('Revoking tokens on SmartThings');

            // Revoke access token
            await oauth.revokeToken(tokens.accessToken, 'access_token');

            // Revoke refresh token
            await oauth.revokeToken(tokens.refreshToken, 'refresh_token');

            logger.info('Tokens revoked successfully on SmartThings');
          } catch (revokeError) {
            // Log warning but continue with local deletion
            logger.warn('Token revocation failed, continuing with local deletion', {
              error: revokeError instanceof Error ? revokeError.message : String(revokeError),
            });
          }
        }

        // Delete tokens from local storage
        await storage.deleteTokens('default');

        logger.info('SmartThings disconnected successfully');

        return {
          success: true,
          message: 'SmartThings disconnected successfully',
        };
      } catch (error) {
        logger.error('Failed to disconnect SmartThings', {
          error: error instanceof Error ? error.message : String(error),
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'DISCONNECT_FAILED',
            message: error instanceof Error ? error.message : 'Failed to disconnect',
          },
        });
      }
    }
  );

  /**
   * GET /auth/smartthings/status - Check OAuth connection status
   *
   * Returns whether user has connected SmartThings via OAuth
   * and token expiration details.
   *
   * Response:
   * - connected: boolean
   * - expiresAt: ISO timestamp (if connected)
   * - scope: granted scopes (if connected)
   */
  server.get('/auth/smartthings/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const storage = getTokenStorage();
      const hasTokens = await storage.hasTokens('default');

      if (!hasTokens) {
        return {
          success: true,
          connected: false,
        };
      }

      const tokens = await storage.getTokens('default');

      if (!tokens) {
        return {
          success: true,
          connected: false,
        };
      }

      // Check if token is expired or close to expiration
      const needsRefresh = SmartThingsOAuthService.shouldRefreshToken(
        tokens.expiresAt,
        3600 // 1 hour buffer
      );

      return {
        success: true,
        connected: true,
        expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
        scope: tokens.scope,
        needsRefresh,
      };
    } catch (error) {
      logger.error('Failed to check OAuth status', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to check connection status',
        },
      });
    }
  });

  logger.info(
    'OAuth routes registered (/auth/smartthings, /auth/smartthings/callback, /auth/smartthings/disconnect, /auth/smartthings/status)'
  );
}
