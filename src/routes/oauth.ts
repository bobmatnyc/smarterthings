import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SmartThingsOAuthService, DEFAULT_SCOPES } from '../smartthings/oauth-service.js';
import { TokenStorage } from '../storage/token-storage.js';
import { TokenRefresher } from '../smartthings/token-refresher.js';
import { environment } from '../config/environment.js';
import { logger } from '../logger.js';

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
 * Clean up expired OAuth states (older than 10 minutes)
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  const expiryMs = 10 * 60 * 1000; // 10 minutes

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
  server.get('/auth/smartthings', async (request: FastifyRequest, reply: FastifyReply) => {
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
      return reply.redirect(302, url);
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
   * SmartThings redirects back here after user authorization.
   * Exchange authorization code for access and refresh tokens.
   *
   * Query Parameters:
   * - code: Authorization code
   * - state: CSRF state token
   *
   * Flow:
   * 1. Validate state token (CSRF protection)
   * 2. Exchange authorization code for tokens
   * 3. Store encrypted tokens in database
   * 4. Start background token refresh
   * 5. Redirect to success page
   */
  server.get(
    '/auth/smartthings/callback',
    async (
      request: FastifyRequest<{
        Querystring: { code?: string; state?: string; error?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { code, state, error } = request.query;

      // Handle user denial
      if (error) {
        logger.warn('OAuth authorization denied by user', { error });
        return reply.code(400).send({
          success: false,
          error: {
            code: 'OAUTH_DENIED',
            message: 'User denied authorization',
          },
        });
      }

      // Validate required parameters
      if (!code || !state) {
        logger.error('OAuth callback missing required parameters', {
          hasCode: !!code,
          hasState: !!state,
        });
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_CALLBACK',
            message: 'Missing authorization code or state parameter',
          },
        });
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
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_STATE',
              message: 'Invalid state parameter (expired or CSRF attempt)',
            },
          });
        }

        // Remove used state token
        oauthStates.delete(state);

        const oauth = getOAuthService();
        const storage = getTokenStorage();

        // Exchange authorization code for tokens
        const tokens = await oauth.exchangeCodeForTokens(code, state, state);

        // Calculate expiry timestamp
        const expiresAt = SmartThingsOAuthService.calculateExpiryTimestamp(
          tokens.expires_in
        );

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

        // Redirect to success page (or return JSON for API clients)
        return reply.send({
          success: true,
          message: 'SmartThings connected successfully',
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          scope: tokens.scope,
        });
      } catch (error) {
        logger.error('OAuth callback failed', {
          error: error instanceof Error ? error.message : String(error),
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'OAUTH_CALLBACK_FAILED',
            message: error instanceof Error ? error.message : 'Failed to complete OAuth flow',
          },
        });
      }
    }
  );

  /**
   * POST /auth/smartthings/disconnect - Disconnect SmartThings
   *
   * Deletes stored tokens (user must re-authorize to reconnect).
   *
   * Flow:
   * 1. Delete tokens from database
   * 2. Stop background token refresh
   * 3. Return success
   */
  server.post('/auth/smartthings/disconnect', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('SmartThings disconnect requested');

      const storage = getTokenStorage();
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
  });

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
  server.get('/auth/smartthings/status', async (request: FastifyRequest, reply: FastifyReply) => {
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

  logger.info('OAuth routes registered (/auth/smartthings, /auth/smartthings/callback, /auth/smartthings/disconnect, /auth/smartthings/status)');
}
