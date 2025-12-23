import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { environment } from '../config/environment.js';
import logger from '../utils/logger.js';
import { getEventStore } from '../storage/event-store.js';
import { MessageQueue } from '../queue/MessageQueue.js';
import { getTokenStorage } from '../storage/token-storage.js';
import { DashboardService } from '../services/dashboard-service.js';
import { LlmService } from '../services/llm.js';
import type { ServiceContainer } from '../services/ServiceContainer.js';
import { SmartThingsOAuthService, DEFAULT_SCOPES } from '../smartthings/oauth-service.js';
import { reinitializeSmartThingsAdapter } from '../server-alexa.js';
import { TokenStorage } from '../storage/token-storage.js';
import { TokenRefresher } from '../smartthings/token-refresher.js';

// Module-level ServiceContainer instance (injected during initialization)
let serviceContainer: ServiceContainer | null = null;

/**
 * Initialize HTTP transport with ServiceContainer.
 * Must be called before starting the transport.
 */
export function initializeHttpTransport(container: ServiceContainer): void {
  serviceContainer = container;
}

/**
 * CVE-2024-OAUTH-003 Fix: Input validation schema for OAuth callback
 *
 * Validates callback parameters to prevent XSS and injection attacks.
 * Security Impact: MEDIUM - Prevents malicious input processing
 *
 * Validation rules:
 * - code: Authorization code (alphanumeric, dash, underscore; 1-500 chars)
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
function getOAuthTokenStorage(): TokenStorage {
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
    const storage = getOAuthTokenStorage();
    tokenRefresher = new TokenRefresher(oauth, storage);
    tokenRefresher.start(); // Start background refresh
    logger.info('Token refresher started');
  }

  return tokenRefresher;
}

/**
 * HTTP transport with Server-Sent Events (SSE) for MCP server.
 *
 * Design Decision: SSE for web-based clients
 * Rationale: HTTP transport enables web-based MCP clients and remote access.
 * SSE provides bidirectional communication over HTTP.
 *
 * Usage: Suitable for web applications and remote clients
 *
 * Performance: SSE maintains persistent connections, efficient for real-time updates
 */
export async function startHttpTransport(server: Server): Promise<void> {
  logger.info('Starting MCP server with HTTP/SSE transport', {
    port: environment.MCP_SERVER_PORT,
  });

  const app = express();

  // CORS middleware - Allow frontend (localhost:5181) to access backend
  app.use(
    cors({
      origin: [
        'http://localhost:5181',
        'http://localhost:5182',
        'http://127.0.0.1:5181',
        'http://127.0.0.1:5182',
      ],
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());

  // Initialize event infrastructure for SSE
  getEventStore(); // Initialize event store for SSE
  new MessageQueue(); // Initialize message queue for SSE

  // Health check endpoint
  app.get('/health', (_req, res) => {
    // Check SmartThings authentication status
    const tokenStorage = getTokenStorage();
    const hasOAuthToken = tokenStorage.hasTokens('default');
    const hasPAT = !!environment.SMARTTHINGS_PAT;
    const smartthingsInitialized = hasOAuthToken || hasPAT;

    res.json({
      status: 'healthy',
      service: environment.MCP_SERVER_NAME,
      version: environment.MCP_SERVER_VERSION,
      smartthings: {
        initialized: smartthingsInitialized,
        authMethod: hasOAuthToken ? 'oauth' : hasPAT ? 'pat' : 'none',
      },
    });
  });

  // Initialize Dashboard Service for LLM-powered summaries
  let dashboardService: DashboardService | null = null;
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (apiKey) {
    try {
      const llmService = new LlmService({
        apiKey,
        model: 'anthropic/claude-3-haiku-20240307', // Cost-effective model for summaries
      });
      const eventStore = getEventStore();
      dashboardService = new DashboardService(llmService, eventStore);
      logger.info('[DashboardService] Initialized successfully');
    } catch (error) {
      logger.warn('[DashboardService] Failed to initialize', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.warn('[DashboardService] OPENROUTER_API_KEY not set, dashboard summaries disabled');
  }

  // Dashboard API Routes
  if (dashboardService) {
    app.get('/api/dashboard/summary', async (_req, res) => {
      const startTime = Date.now();
      try {
        logger.debug('[Dashboard API] GET /api/dashboard/summary');
        const summary = await dashboardService!.generateSummary();
        const duration = Date.now() - startTime;

        logger.info('[Dashboard API] Summary generated', {
          eventCount: summary.eventCount,
          cached: duration < 100,
          duration,
        });

        res.json({
          success: true,
          data: summary,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[Dashboard API] GET /api/dashboard/summary failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to generate summary',
          },
        });
      }
    });

    logger.info('[Dashboard API] Routes registered: GET /api/dashboard/summary');
  }

  /**
   * GET /api/rooms - List all rooms with device counts
   *
   * Returns list of rooms from SmartThings with device count for each room.
   * Response: { success: true, data: { count: number, rooms: RoomInfo[] } }
   */
  app.get('/api/rooms', async (_req, res) => {
    const startTime = Date.now();

    try {
      logger.debug('[API] GET /api/rooms');

      if (!serviceContainer) {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'SmartThings not configured',
          },
        });
        return;
      }

      const deviceService = serviceContainer.getDeviceService();
      const locationService = serviceContainer.getLocationService();

      // Get all rooms
      const rooms = await locationService.listRooms();

      // Get all devices to calculate device counts per room
      const devices = await deviceService.listDevices();

      // Calculate device count for each room
      const roomDeviceCounts = new Map<string, number>();
      devices.forEach((device) => {
        const roomName = device.roomName;
        if (roomName) {
          roomDeviceCounts.set(roomName, (roomDeviceCounts.get(roomName) || 0) + 1);
        }
      });

      // Add device counts to rooms
      const roomsWithCounts = rooms.map((room) => ({
        roomId: room.roomId,
        name: room.name,
        locationId: room.locationId,
        deviceCount: roomDeviceCounts.get(room.name) || 0,
      }));

      const duration = Date.now() - startTime;
      logger.debug('[API] Rooms fetched', { count: roomsWithCounts.length, duration });

      res.json({
        success: true,
        data: {
          count: roomsWithCounts.length,
          rooms: roomsWithCounts,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[API] GET /api/rooms failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * GET /api/devices - List all devices with optional room filter
   *
   * Query Parameters:
   * - room: Filter by room name (optional)
   *
   * Response: { success: true, data: { count: number, devices: DeviceInfo[] } }
   */
  app.get('/api/devices', async (req, res) => {
    const startTime = Date.now();
    const { room } = req.query as { room?: string };

    try {
      logger.debug('[API] GET /api/devices', { room });

      if (!serviceContainer) {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'SmartThings not configured',
          },
        });
        return;
      }

      const deviceService = serviceContainer.getDeviceService();
      const locationService = serviceContainer.getLocationService();

      let roomId: string | undefined;

      // If room filter is specified, find the room
      if (room) {
        const roomInfo = await locationService.findRoomByName(room);
        roomId = roomInfo.roomId;
      }

      // Get devices (with optional room filter)
      // Cast roomId to RoomId type (branded string type)
      const devices = await deviceService.listDevices(roomId as import('../types/smartthings.js').RoomId | undefined);

      const duration = Date.now() - startTime;
      logger.debug('[API] Devices fetched', {
        success: true,
        count: devices.length,
        duration,
      });

      res.json({
        success: true,
        data: {
          count: devices.length,
          devices,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[API] GET /api/devices failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

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
  app.get('/auth/smartthings', async (_req, res) => {
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
      res.redirect(url);
    } catch (error) {
      logger.error('Failed to initiate OAuth flow', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
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
  app.get('/auth/smartthings/callback', async (req, res) => {
    // CVE-2024-OAUTH-003 Fix: Validate callback parameters
    let validatedQuery;
    try {
      validatedQuery = callbackSchema.parse(req.query);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        logger.error('Invalid OAuth callback parameters', {
          errors: validationError.errors,
          query: req.query,
        });
        const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=invalid_params`;
        res.redirect(errorUrl);
        return;
      }
      throw validationError;
    }

    const { code, state, error, error_description } = validatedQuery;

    // Handle user denial
    if (error) {
      logger.warn('OAuth authorization denied by user', { error, error_description });
      const errorUrl = `${environment.FRONTEND_URL}/?oauth=denied`;
      res.redirect(errorUrl);
      return;
    }

    // Validate required parameters (should not fail after schema validation, but defensive check)
    if (!code || !state) {
      logger.error('OAuth callback missing required parameters after validation', {
        hasCode: !!code,
        hasState: !!state,
      });
      const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=invalid_callback`;
      res.redirect(errorUrl);
      return;
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
        res.redirect(errorUrl);
        return;
      }

      // Remove used state token
      oauthStates.delete(state);

      const oauth = getOAuthService();
      const storage = getOAuthTokenStorage();

      // Exchange authorization code for tokens
      const tokens = await oauth.exchangeCodeForTokens(code, state, state);

      // Calculate expiry timestamp
      const expiresAt = SmartThingsOAuthService.calculateExpiryTimestamp(tokens.expires_in);

      // Store encrypted tokens
      storage.storeTokens(
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

      // Redirect to callback page with countdown to allow adapter initialization
      // The callback page shows a success message with a 3-second countdown before redirecting to dashboard
      // This prevents race condition where dashboard checks /health before adapter finishes initializing
      const callbackUrl = `${environment.FRONTEND_URL}/auth/callback?oauth=success`;
      logger.info('Redirecting to callback page after successful OAuth', { callbackUrl });
      res.redirect(callbackUrl);
    } catch (error) {
      logger.error('OAuth callback failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      const errorUrl = `${environment.FRONTEND_URL}/?oauth=error&reason=callback_failed`;
      res.redirect(errorUrl);
    }
  });

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
  app.post('/auth/smartthings/disconnect', async (_req, res) => {
    try {
      logger.info('SmartThings disconnect requested');

      const storage = getOAuthTokenStorage();
      const oauth = getOAuthService();

      // Get tokens before deletion (needed for revocation)
      const tokens = storage.getTokens('default');

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
      storage.deleteTokens('default');

      logger.info('SmartThings disconnected successfully');

      res.json({
        success: true,
        message: 'SmartThings disconnected successfully',
      });
    } catch (error) {
      logger.error('Failed to disconnect SmartThings', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
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
  app.get('/auth/smartthings/status', async (_req, res) => {
    try {
      const storage = getOAuthTokenStorage();
      const hasTokens = storage.hasTokens('default');

      if (!hasTokens) {
        res.json({
          success: true,
          connected: false,
        });
        return;
      }

      const tokens = storage.getTokens('default');

      if (!tokens) {
        res.json({
          success: true,
          connected: false,
        });
        return;
      }

      // Check if token is expired or close to expiration
      const needsRefresh = SmartThingsOAuthService.shouldRefreshToken(
        tokens.expiresAt,
        3600 // 1 hour buffer
      );

      res.json({
        success: true,
        connected: true,
        expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
        scope: tokens.scope,
        needsRefresh,
      });
    } catch (error) {
      logger.error('Failed to check OAuth status', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to check connection status',
        },
      });
    }
  });

  logger.info(
    'OAuth routes registered on Express: /auth/smartthings, /auth/smartthings/callback, /auth/smartthings/disconnect, /auth/smartthings/status'
  );

  // SSE device events endpoint
  const sseClients = new Set<express.Response>();

  app.get('/api/events/stream', (_req, res) => {
    logger.info('New SSE device events connection');

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Add client to set
    sseClients.add(res);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    // Remove client on disconnect
    _req.on('close', () => {
      logger.info('SSE device events connection closed');
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // SSE endpoint for MCP protocol
  app.get('/sse', async (req, res) => {
    logger.info('New SSE connection', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const transport = new SSEServerTransport('/message', res);
    await server.connect(transport);

    req.on('close', () => {
      logger.info('SSE connection closed');
    });
  });

  // POST endpoint for client messages
  app.post('/message', async (req, res) => {
    logger.debug('Received message', { body: req.body });
    // Message handling is done by the transport
    res.status(202).send();
  });

  // Error handling middleware
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Express error', { error: err.message, stack: err.stack });
      res.status(500).json({ error: 'Internal server error' });
    }
  );

  const httpServer = app.listen(environment.MCP_SERVER_PORT, () => {
    logger.info('HTTP server listening', {
      port: environment.MCP_SERVER_PORT,
      url: `http://localhost:${environment.MCP_SERVER_PORT}`,
    });
  });

  // Graceful shutdown
  const shutdown = (): void => {
    logger.info('Shutting down HTTP server');
    void server.close().finally(() => {
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
