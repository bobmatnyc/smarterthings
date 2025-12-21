#!/usr/bin/env node

/**
 * Fastify server for Alexa integration (Custom Skill + Smart Home)
 *
 * Design Decision: Dual API support - Custom Skill and Smart Home Skill
 * Rationale: Custom Skill provides conversational AI with LLM integration for
 * natural language queries, while Smart Home Skill provides fast direct device
 * control with predefined commands.
 *
 * API Endpoints:
 * - POST /alexa: Custom Skill (conversational AI with ChatOrchestrator)
 * - POST /alexa-smarthome: Smart Home Skill (direct device control)
 * - GET /health: Health check endpoint
 * - GET /: API information
 *
 * Coexistence Strategy:
 * - This Fastify server runs on port 3000 for Alexa endpoints
 * - Existing Express SSE transport can run on different port if needed
 * - Both servers use same SmartThings service (singleton)
 * - Future: Consider merging or using Fastify for all HTTP transport
 *
 * Architecture:
 * - Single Fastify instance handles all Alexa traffic
 * - Middleware: CORS, Helmet (security), Alexa verification
 * - Routes: /alexa, /alexa-smarthome, /health, /
 * - Error handling: Centralized error handler with Alexa format
 *
 * Custom Skill Flow:
 * User → Alexa → /alexa → ChatOrchestrator → LLM + MCP → SmartThings
 * Latency: 2-5s (LLM processing)
 *
 * Smart Home Flow:
 * User → Alexa → /alexa-smarthome → Direct API → SmartThings
 * Latency: <500ms (direct control)
 *
 * Security (MANDATORY):
 * - Helmet: Security headers (XSS, CSP, etc.)
 * - CORS: Configured for Alexa service origins
 * - Alexa verification: Signature + timestamp validation
 * - Rate limiting: Future consideration
 *
 * Performance Targets:
 * - Custom Skill: <5s response time (LLM latency)
 * - Smart Home: <500ms response time (p95), <1000ms (p99)
 * - Handle 100+ requests/sec
 * - Session management with 30-minute timeout
 *
 * Deployment:
 * - ngrok tunnel: smarty.ngrok-free.app → localhost:3000
 * - HTTPS handled by ngrok (certificate management)
 * - Environment: NODE_ENV=production for performance optimizations
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { environment } from './config/environment.js';
import { verifyAlexaRequest } from './alexa/verification.js';
import { handleAlexaDirective } from './alexa/handlers.js';
import { isAlexaDirective, isCustomSkillRequest } from './alexa/types.js';
import { handleCustomSkillRequest } from './alexa/custom-skill.js';
import logger from './utils/logger.js';
import { ToolExecutor } from './direct/ToolExecutor.js';
import { ServiceContainer } from './services/ServiceContainer.js';
import { smartThingsService } from './smartthings/client.js';
import type { DeviceId, SceneId } from './types/smartthings.js';
import { McpClient } from './mcp/client.js';
import { LlmService } from './services/llm.js';
import { ChatOrchestrator } from './services/chat-orchestrator.js';
import { registerOAuthRoutes } from './routes/oauth.js';
import { SmartThingsAdapter } from './platforms/smartthings/SmartThingsAdapter.js';
import { MessageQueue } from './queue/MessageQueue.js';
import { EventStore } from './storage/event-store.js';
import { getTokenStorage } from './storage/token-storage.js';
import { registerWebhookRoutes } from './routes/webhook.js';
import { registerEventsRoutes, broadcastEvent } from './routes/events.js';
import { ConfigurationError } from './types/errors.js';

/**
 * Server port (configurable via environment)
 */
const PORT = process.env['ALEXA_SERVER_PORT']
  ? parseInt(process.env['ALEXA_SERVER_PORT'], 10)
  : 3000;

/**
 * Server host (0.0.0.0 for external access, 127.0.0.1 for local only)
 */
const HOST = process.env['ALEXA_SERVER_HOST'] || '0.0.0.0';

/**
 * SmartThingsAdapter instance for automation operations
 *
 * Design Decision: Lazy initialization with OAuth support
 * Rationale: Adapter may not have valid credentials at startup (chicken-and-egg problem).
 * OAuth routes must be available BEFORE adapter initialization to allow user authentication.
 *
 * Initialization Strategy:
 * 1. Server starts and OAuth routes become available
 * 2. User authenticates via /auth/smartthings
 * 3. Adapter initializes on first API request (if credentials available)
 * 4. API endpoints return 503 if adapter not initialized
 */
let smartThingsAdapter: SmartThingsAdapter | null = null;

/**
 * ServiceContainer instance for device operations
 * Initialized lazily when adapter is available
 */
let serviceContainer: ServiceContainer | null = null;

/**
 * Singleton ToolExecutor instance for device operations
 */
let toolExecutor: ToolExecutor | null = null;

/**
 * Get or create ToolExecutor instance.
 *
 * @throws {ConfigurationError} If SmartThings adapter not initialized
 */
function getToolExecutor(): ToolExecutor {
  if (!serviceContainer) {
    throw new ConfigurationError('SmartThings not configured. Please authenticate via /auth/smartthings', {
      hint: 'Visit /auth/smartthings to connect your SmartThings account',
    });
  }

  if (!toolExecutor) {
    toolExecutor = new ToolExecutor(serviceContainer);
  }
  return toolExecutor;
}

/**
 * Singleton ChatOrchestrator instance for chat API
 */
let chatOrchestrator: ChatOrchestrator | null = null;

/**
 * Singleton MessageQueue instance for event processing
 */
let messageQueue: MessageQueue | null = null;

/**
 * Singleton EventStore instance for event persistence
 */
let eventStore: EventStore | null = null;

/**
 * Get or create ChatOrchestrator instance.
 *
 * Lazily initializes MCP client, LLM service, and orchestrator.
 * Orchestrator initialization is async, so must be awaited on first use.
 *
 * @returns Promise resolving to initialized ChatOrchestrator
 */
async function getChatOrchestrator(): Promise<ChatOrchestrator> {
  if (!chatOrchestrator) {
    // Validate environment variables
    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required for chat functionality');
    }

    // Create MCP client
    const mcpClient = new McpClient();

    // Create LLM service
    const llmService = new LlmService({ apiKey });

    // Create orchestrator
    chatOrchestrator = new ChatOrchestrator(mcpClient, llmService);

    // Initialize orchestrator (spawns MCP server, fetches tools)
    await chatOrchestrator.initialize();

    logger.info('Chat orchestrator initialized successfully');
  }

  return chatOrchestrator;
}

/**
 * Get or create MessageQueue instance.
 *
 * Lazily initializes message queue with event store integration.
 *
 * @returns Promise resolving to initialized MessageQueue
 */
async function getMessageQueue(): Promise<MessageQueue> {
  if (!messageQueue) {
    messageQueue = new MessageQueue();

    // Register event handler for device_event type
    messageQueue.registerHandler('device_event', async (event) => {
      logger.debug('[MessageQueue] Processing device_event', {
        eventId: event.id,
        deviceId: event.deviceId,
      });

      // Broadcast to SSE clients
      broadcastEvent(event);
    });

    // Initialize queue (starts workers)
    await messageQueue.initialize();

    logger.info('[MessageQueue] Initialized and started');
  }

  return messageQueue;
}

/**
 * Get or create EventStore instance.
 *
 * @returns EventStore instance
 */
function getEventStore(): EventStore {
  if (!eventStore) {
    eventStore = new EventStore();
    logger.info('[EventStore] Initialized');
  }

  return eventStore;
}

/**
 * SSE client tracking for device event broadcasting
 */
const sseClients = new Set<FastifyReply>();

/**
 * Broadcast device state change to all SSE clients
 */
function broadcastDeviceStateChange(deviceId: string, state: any): void {
  const event = {
    type: 'device-state',
    deviceId,
    timestamp: new Date().toISOString(),
    state,
  };

  const message = `event: device-state\ndata: ${JSON.stringify(event)}\n\n`;

  let broadcastCount = 0;
  sseClients.forEach((client) => {
    if (client.raw.writable) {
      client.raw.write(message);
      broadcastCount++;
    }
  });

  logger.debug(`[SSE] Broadcast device-state to ${broadcastCount} clients`, {
    deviceId,
  });
}

/**
 * Create and configure Fastify server
 *
 * Configuration:
 * - Logger: Disabled (use Winston logger instead)
 * - Body limit: 1MB (Alexa requests are small)
 * - Request timeout: 10 seconds (Alexa requires <1s, but allow buffer)
 * - Keep-alive timeout: 5 seconds
 *
 * @returns Configured Fastify instance
 */
function createFastifyServer(): FastifyInstance {
  const server = Fastify({
    logger: false, // Use Winston logger
    bodyLimit: 1048576, // 1MB
    requestTimeout: 10000, // 10 seconds
    keepAliveTimeout: 5000, // 5 seconds
    disableRequestLogging: true, // Use custom logging
  });

  return server;
}

/**
 * Register security plugins
 *
 * Helmet: Sets security headers
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: SAMEORIGIN
 * - X-XSS-Protection: 1; mode=block
 * - Strict-Transport-Security (HSTS)
 *
 * CORS: Allow Alexa service origins
 * - Future: Restrict to specific origins in production
 *
 * @param server Fastify instance
 */
async function registerSecurityPlugins(server: FastifyInstance): Promise<void> {
  // Register Helmet for security headers
  await server.register(helmet, {
    contentSecurityPolicy: false, // Disable CSP for API endpoints
    crossOriginEmbedderPolicy: false,
  });

  // Register CORS
  await server.register(cors, {
    origin: true, // Allow all origins (Alexa service IP varies)
    methods: ['POST', 'GET'],
    credentials: false,
  });

  logger.info('Security plugins registered (Helmet, CORS)');
}

/**
 * Register routes
 *
 * Routes:
 * - POST /alexa: Main Alexa directive endpoint (with verification)
 * - GET /health: Health check endpoint
 * - GET /: Root endpoint (informational)
 * - OAuth routes: Registered FIRST to enable authentication before adapter init
 *
 * @param server Fastify instance
 */
async function registerRoutes(server: FastifyInstance): Promise<void> {
  // ====================================================================
  // OAuth Routes (MUST be registered FIRST - before adapter initialization)
  // ====================================================================
  try {
    await registerOAuthRoutes(server);
    logger.info('OAuth routes registered successfully (available before SmartThings initialization)');
  } catch (error) {
    // OAuth routes are optional - if not configured, log warning but don't fail
    logger.warn('OAuth routes not registered (optional feature)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Health check endpoint
  server.get('/health', async () => {
    const adapterInitialized = smartThingsAdapter !== null && smartThingsAdapter.isInitialized();

    // Also check if OAuth tokens exist (user has authenticated even if adapter failed to init)
    const tokenStorage = getTokenStorage();
    const hasOAuthTokens = tokenStorage.hasTokens('default');

    // Consider "initialized" if either adapter works OR tokens exist
    const isConnected = adapterInitialized || hasOAuthTokens;

    return {
      status: 'healthy',
      service: 'mcp-smarterthings-alexa',
      version: environment.MCP_SERVER_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      smartthings: {
        initialized: isConnected,
        adapterReady: adapterInitialized,
        hasTokens: hasOAuthTokens,
        message: isConnected
          ? adapterInitialized
            ? 'SmartThings connected and ready'
            : 'SmartThings authenticated (adapter initializing...)'
          : 'SmartThings not configured - visit /auth/smartthings to connect',
      },
    };
  });

  // Root endpoint (informational)
  server.get('/', async () => {
    return {
      service: 'MCP SmartThings - Alexa Integration',
      version: environment.MCP_SERVER_VERSION,
      endpoints: {
        customSkill: 'POST /alexa - Custom Skill (conversational AI)',
        smartHome: 'POST /alexa-smarthome - Smart Home Skill (device control)',
        devices: 'GET /api/devices - List devices with filters',
        rooms: 'GET /api/rooms - List rooms with device counts',
        deviceControl: 'POST /api/devices/:id/on|off - Control devices',
        deviceStatus: 'GET /api/devices/:id/status - Get device status',
        deviceEvents: 'GET /api/devices/events - SSE real-time updates',
        automations: 'GET /api/automations - List scenes (manually run routines)',
        executeAutomation: 'POST /api/automations/:id/execute - Execute scene',
        rules: 'GET /api/rules - List rules (IF/THEN automations)',
        executeRule: 'POST /api/rules/:id/execute - Execute rule',
        chat: 'POST /api/chat - Chat with AI assistant',
        health: 'GET /health',
      },
      documentation: 'https://github.com/bobmatnyc/mcp-smarterthings',
    };
  });

  // ====================================================================
  // Device API Routes (for Web UI)
  // ====================================================================

  /**
   * GET /api/devices - List all devices with optional filters
   *
   * Query Parameters:
   * - room: Filter by room name
   * - capability: Filter by capability type
   *
   * Returns: DirectResult<UnifiedDevice[]>
   */
  server.get('/api/devices', async (request, reply) => {
    const startTime = Date.now();
    const { room, capability } = request.query as { room?: string; capability?: string };

    try {
      logger.debug('GET /api/devices', { room, capability });

      // Check if adapter is initialized
      if (!serviceContainer) {
        return reply.code(503).send({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'SmartThings not configured. Please authenticate via /auth/smartthings',
            hint: 'Visit /auth/smartthings to connect your SmartThings account',
          },
        });
      }

      const executor = getToolExecutor();
      const result = await executor.listDevices({
        roomName: room,
        capability,
      });

      const duration = Date.now() - startTime;
      logger.debug('Device list fetched', {
        success: result.success,
        count: result.success ? result.data.length : 0,
        duration,
      });

      if (result.success) {
        return result;
      } else {
        return reply.code(500).send(result);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error fetching device list', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * POST /api/devices/:deviceId/on - Turn device on
   */
  server.post('/api/devices/:deviceId/on', async (request, reply) => {
    const startTime = Date.now();
    const { deviceId } = request.params as { deviceId: string };

    try {
      logger.debug('POST /api/devices/:deviceId/on', { deviceId });

      const executor = getToolExecutor();
      const result = await executor.turnOnDevice(deviceId as DeviceId);

      const duration = Date.now() - startTime;

      if (result.success) {
        // Broadcast state change to SSE clients
        broadcastDeviceStateChange(deviceId, { switch: 'on' });

        logger.debug('Device turned on', { deviceId, duration });
        return { success: true, data: null };
      } else {
        // Error case
        logger.error('Failed to turn on device', {
          deviceId,
          error: result.error.message,
          duration,
        });
        return reply.code(500).send(result);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error turning on device', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * POST /api/devices/:deviceId/off - Turn device off
   */
  server.post('/api/devices/:deviceId/off', async (request, reply) => {
    const startTime = Date.now();
    const { deviceId } = request.params as { deviceId: string };

    try {
      logger.debug('POST /api/devices/:deviceId/off', { deviceId });

      const executor = getToolExecutor();
      const result = await executor.turnOffDevice(deviceId as DeviceId);

      const duration = Date.now() - startTime;

      if (result.success) {
        // Broadcast state change to SSE clients
        broadcastDeviceStateChange(deviceId, { switch: 'off' });

        logger.debug('Device turned off', { deviceId, duration });
        return { success: true, data: null };
      } else {
        // Error case
        logger.error('Failed to turn off device', {
          deviceId,
          error: result.error.message,
          duration,
        });
        return reply.code(500).send(result);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error turning off device', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * GET /api/devices/:deviceId/status - Get device status
   */
  server.get('/api/devices/:deviceId/status', async (request, reply) => {
    const startTime = Date.now();
    const { deviceId } = request.params as { deviceId: string };

    try {
      logger.debug('GET /api/devices/:deviceId/status', { deviceId });

      const executor = getToolExecutor();
      const result = await executor.getDeviceStatus(deviceId as DeviceId);

      const duration = Date.now() - startTime;

      if (result.success) {
        logger.debug('Device status fetched', { deviceId, duration });
        return result;
      } else {
        // Error case
        logger.error('Failed to get device status', {
          deviceId,
          error: result.error.message,
          duration,
        });
        return reply.code(404).send(result);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error getting device status', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * PUT /api/devices/:deviceId/level - Set device brightness level
   *
   * Sets the brightness level for dimmable devices (0-100%).
   * Requires switchLevel capability on the device.
   *
   * Request Body: { level: number } (0-100)
   * Returns: DirectResult<void>
   */
  server.put('/api/devices/:deviceId/level', async (request, reply) => {
    const startTime = Date.now();
    const { deviceId } = request.params as { deviceId: string };
    const { level } = request.body as { level: number };

    try {
      logger.info(`[API] PUT /api/devices/${deviceId}/level - Setting level to ${level}`);

      // Validate request
      if (!deviceId || deviceId.length < 10) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid device ID format',
          },
        });
      }

      if (typeof level !== 'number' || level < 0 || level > 100) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Level must be a number between 0 and 100',
          },
        });
      }

      // Get executor and set device level
      const executor = getToolExecutor();
      const result = await executor.setDeviceLevel(deviceId as DeviceId, level);

      const duration = Date.now() - startTime;

      if (result.success) {
        logger.info(`[API] Device ${deviceId} level set successfully to ${level}`, { duration });
        return reply.status(200).send({
          success: true,
          data: {
            deviceId,
            level,
          },
        });
      } else {
        // Handle specific error codes
        const errorCode = result.error.code;

        if (errorCode === 'DEVICE_NOT_FOUND' || errorCode === 'NOT_FOUND') {
          logger.error(`[API] Device ${deviceId} not found`, { duration });
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Device not found: ${deviceId}`,
            },
          });
        }

        if (errorCode === 'CAPABILITY_NOT_SUPPORTED' || errorCode === 'INVALID_LEVEL') {
          logger.error(`[API] Invalid request for device ${deviceId}`, {
            error: result.error.message,
            duration,
          });
          return reply.status(400).send({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: result.error.message,
            },
          });
        }

        // Generic error
        logger.error(`[API] Failed to set device ${deviceId} level`, {
          error: result.error.message,
          duration,
        });
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message,
          },
        });
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('[API] Error setting device level', {
        deviceId,
        level,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set device level',
        },
      });
    }
  });

  /**
   * GET /api/rooms - List all rooms with device counts
   *
   * Returns list of rooms from SmartThings with device count for each room.
   *
   * Returns: DirectResult<{ count: number; rooms: RoomInfo[] }>
   */
  server.get('/api/rooms', async (_request, reply) => {
    const startTime = Date.now();

    try {
      logger.debug('GET /api/rooms');

      const executor = getToolExecutor();
      const roomsResult = await executor.listRooms();

      if (!roomsResult.success) {
        logger.error('Failed to list rooms', {
          error: roomsResult.error.message,
        });
        return reply.code(500).send(roomsResult);
      }

      // Get all devices to calculate device counts per room
      const devicesResult = await executor.listDevices({});

      if (!devicesResult.success) {
        logger.error('Failed to list devices for room counts', {
          error: devicesResult.error.message,
        });
        // Continue with empty device list rather than failing completely
      }

      const rooms = roomsResult.data?.rooms || [];
      const devices = devicesResult.success && devicesResult.data?.devices
        ? devicesResult.data.devices
        : [];

      // Calculate device count for each room
      const roomDeviceCounts = new Map<string, number>();
      devices.forEach((device: any) => {
        const roomName = device.roomName || device.room;
        if (roomName) {
          roomDeviceCounts.set(roomName, (roomDeviceCounts.get(roomName) || 0) + 1);
        }
      });

      // Add device counts to rooms
      const roomsWithCounts = rooms.map((room: any) => ({
        roomId: room.roomId,
        name: room.name,
        locationId: room.locationId,
        deviceCount: roomDeviceCounts.get(room.name) || 0,
      }));

      const duration = Date.now() - startTime;
      logger.debug('Rooms fetched', { count: roomsWithCounts.length, duration });

      return {
        success: true,
        data: {
          count: roomsWithCounts.length,
          rooms: roomsWithCounts,
        },
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error getting rooms', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * GET /api/automations - List all automations (SmartThings Scenes)
   *
   * Returns all scenes (manually run routines) from SmartThings for the default location.
   * Note: Scenes are what appear as "Manually run routines" in the SmartThings app.
   *
   * Returns: DirectResult<SceneInfo[]>
   */
  server.get('/api/automations', async (_request, reply) => {
    const startTime = Date.now();

    try {
      logger.debug('GET /api/automations');

      const executor = getToolExecutor();
      // Fetch scenes (manually run routines)
      const result = await executor.listScenes();

      if (!result.success) {
        logger.error('Failed to fetch scenes', {
          error: result.error.message,
        });
        return reply.code(500).send(result);
      }

      const scenes = result.data || [];
      const duration = Date.now() - startTime;
      logger.debug('Scenes fetched', { count: scenes.length, duration });

      return {
        success: true,
        data: scenes,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error fetching scenes', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * POST /api/automations/:id/execute - Execute a scene
   *
   * Executes a scene (manually run routine) immediately.
   * Note: Scenes cannot be toggled enabled/disabled - they're always manually triggered.
   *
   * Returns: DirectResult<void>
   */
  server.post('/api/automations/:id/execute', async (request, reply) => {
    const startTime = Date.now();
    const { id } = request.params as { id: string };

    try {
      logger.info('Executing scene', { sceneId: id });

      const executor = getToolExecutor();
      const result = await executor.executeScene(id as SceneId);

      if (!result.success) {
        const duration = Date.now() - startTime;
        logger.error('Failed to execute scene', { sceneId: id, error: result.error, duration });
        return reply.code(500).send({
          success: false,
          error: result.error,
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Scene executed successfully', { sceneId: id, duration });

      return {
        success: true,
        data: result.data,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error executing scene', {
        sceneId: id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * GET /api/rules - List all rules
   *
   * Returns all SmartThings Rules (IF/THEN automations) for the default location.
   * Rules are modern automations with trigger conditions and actions.
   *
   * Returns: DirectResult<Rule[]>
   */
  server.get('/api/rules', async (_request, reply) => {
    try {
      logger.info('Fetching rules');

      // Get default location
      const executor = getToolExecutor();
      const locationsResult = await executor.listLocations();
      if (
        !locationsResult.success ||
        !locationsResult.data ||
        !locationsResult.data.locations ||
        locationsResult.data.locations.length === 0
      ) {
        return reply.status(500).send({
          success: false,
          error: 'No locations found',
        });
      }

      const locationId = locationsResult.data.locations[0].locationId;
      const result = await executor.listRules({ locationId });

      if (!result.success) {
        logger.error('Failed to fetch rules', { error: result.error });
        return reply.status(500).send({
          success: false,
          error: result.error || 'Failed to fetch rules',
        });
      }

      const rules = result.data || [];
      logger.info('Rules fetched', { count: rules.length });

      return reply.send({
        success: true,
        data: {
          count: rules.length,
          rules: rules,
        },
      });
    } catch (error) {
      logger.error('Error fetching rules', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * POST /api/rules/:id/execute - Execute a rule
   *
   * Manually executes a rule, bypassing trigger conditions.
   * Useful for testing rules or manual execution.
   *
   * Returns: DirectResult<any>
   */
  server.post('/api/rules/:id/execute', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      logger.info('Executing rule', { ruleId: id });

      const executor = getToolExecutor();
      const result = await executor.executeRule({ ruleId: id });

      if (!result.success) {
        logger.error('Failed to execute rule', { ruleId: id, error: result.error });
        return reply.status(500).send({
          success: false,
          error: result.error || 'Failed to execute rule',
        });
      }

      logger.info('Rule executed successfully', { ruleId: id });

      return reply.send({
        success: true,
        data: result.data,
      });
    } catch (error) {
      logger.error('Error executing rule', { error });
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * PATCH /api/rules/:id - Update a rule (enable/disable)
   *
   * Update rule properties, primarily for enabling/disabling rules.
   *
   * Request body: { enabled: boolean }
   * Returns: DirectResult<any>
   */
  server.patch('/api/rules/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { enabled } = request.body as { enabled: boolean };
      logger.info('Updating rule', { ruleId: id, enabled });

      const executor = getToolExecutor();

      // Get location
      const locationsResult = await executor.listLocations();
      if (!locationsResult.success || !locationsResult.data?.locations?.length) {
        return reply.status(500).send({
          success: false,
          error: 'No locations found',
        });
      }

      const locationId = locationsResult.data.locations[0].locationId;

      // Get current rule
      const rulesResult = await executor.listRules({ locationId });
      if (!rulesResult.success || !rulesResult.data) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch rules',
        });
      }

      const rule = rulesResult.data.find((r: any) => r.id === id);
      if (!rule) {
        return reply.status(404).send({
          success: false,
          error: 'Rule not found',
        });
      }

      // Update via AutomationService
      const automationService = executor['serviceContainer'].getAutomationService();
      const updatedRule = await automationService.updateRule(id, locationId, {
        ...rule,
        status: enabled ? 'Enabled' : 'Disabled',
      });

      logger.info('Rule updated successfully', { ruleId: id, enabled });

      return reply.send({
        success: true,
        data: updatedRule,
      });
    } catch (error) {
      logger.error('Error updating rule', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * DELETE /api/rules/:id - Delete a rule
   *
   * Permanently deletes a rule from the system.
   *
   * Returns: 204 No Content on success
   */
  server.delete('/api/rules/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      logger.info(`[API] DELETE /api/rules/${id} - Deleting rule`);

      // Validate rule ID format (UUID)
      if (!id || id.length < 10) {
        logger.warn(`[API] Invalid rule ID format: ${id}`);
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid rule ID format',
          statusCode: 400,
        });
      }

      // Get executor to access location
      const executor = getToolExecutor();

      // Get location
      const locationsResult = await executor.listLocations();
      if (!locationsResult.success || !locationsResult.data?.locations?.length) {
        logger.error('[API] No locations found');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'No locations found',
          statusCode: 500,
        });
      }

      const locationId = locationsResult.data.locations[0].locationId;

      // Get automation service
      const automationService = executor['serviceContainer'].getAutomationService();

      // Delete rule using service layer
      await automationService.deleteRule(id, locationId);

      logger.info(`[API] Rule ${id} deleted successfully`);

      // Return 204 No Content on success (REST best practice for DELETE)
      return reply.status(204).send();

    } catch (error) {
      logger.error('[API] Error deleting rule:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('404')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Rule not found: ${(request.params as { id: string }).id}`,
            statusCode: 404,
          });
        }

        if (error.message.includes('unauthorized') || error.message.includes('403')) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Not authorized to delete this rule',
            statusCode: 403,
          });
        }
      }

      // Generic error
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to delete rule',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /api/scenes/:id/execute - Execute a scene
   *
   * Manually executes a scene, activating all configured device states.
   *
   * Returns: DirectResult<void>
   */
  server.post('/api/scenes/:id/execute', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      logger.info('Executing scene', { sceneId: id });

      const executor = getToolExecutor();
      const result = await executor.executeScene(id as any); // SceneId branded type

      if (!result.success) {
        logger.error('Failed to execute scene', { sceneId: id, error: result.error });
        return reply.status(500).send({
          success: false,
          error: result.error || 'Failed to execute scene',
        });
      }

      logger.info('Scene executed successfully', { sceneId: id });

      return reply.send({
        success: true,
        data: { sceneId: id, executedAt: new Date().toISOString() },
      });
    } catch (error) {
      logger.error('Error executing scene', {
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * GET /api/installedapps - List installed SmartApps
   *
   * Returns list of installed SmartApps (legacy apps) for the default location.
   * These are read-only views of installed apps.
   *
   * Returns: { success: boolean, data: { count: number, installedApps: any[] } }
   */
  server.get('/api/installedapps', async (_request, reply) => {
    try {
      logger.info('Fetching installed apps');

      // Get default location
      const executor = getToolExecutor();
      const locationsResult = await executor.listLocations();
      if (!locationsResult.success || !locationsResult.data?.locations?.length) {
        return reply.status(500).send({
          success: false,
          error: 'No locations found',
        });
      }

      const locationId = locationsResult.data.locations[0].locationId;

      // Get SmartThingsService via service container
      const smartThingsService = executor['serviceContainer']['smartThingsService'];
      const installedApps = await smartThingsService.listInstalledApps(locationId);

      logger.info('Installed apps fetched', { count: installedApps.length });

      return reply.send({
        success: true,
        data: {
          count: installedApps.length,
          installedApps: installedApps,
        },
      });
    } catch (error) {
      logger.error('Error fetching installed apps', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  /**
   * GET /api/devices/events - SSE endpoint for real-time device updates
   *
   * Server-Sent Events (SSE) for broadcasting device state changes
   * to connected web clients.
   *
   * Events:
   * - connected: Initial connection acknowledgment
   * - heartbeat: Periodic heartbeat (every 30s)
   * - device-state: Device state change notification
   * - device-online: Device online status change
   */
  server.get('/api/devices/events', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info('[SSE] New client connection');

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Add client to tracking set
    sseClients.add(reply);

    // Send initial connection event
    const connectedEvent = {
      timestamp: new Date().toISOString(),
    };
    reply.raw.write(`event: connected\ndata: ${JSON.stringify(connectedEvent)}\n\n`);

    // Heartbeat interval (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      if (reply.raw.writable) {
        const heartbeat = {
          timestamp: new Date().toISOString(),
          connectedClients: sseClients.size,
        };
        reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify(heartbeat)}\n\n`);
      } else {
        clearInterval(heartbeatInterval);
        sseClients.delete(reply);
      }
    }, 30000);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      logger.info('[SSE] Client disconnected');
      clearInterval(heartbeatInterval);
      sseClients.delete(reply);
    });

    // Keep connection alive
    await new Promise(() => {
      // Connection stays open until client disconnects
    });
  });

  /**
   * POST /api/chat - Chat endpoint for conversational AI
   *
   * Integrates with ChatOrchestrator for natural language device control.
   *
   * Request Body:
   * - message: string (required) - User message
   * - mode: 'normal' | 'troubleshooting' (optional) - Chat mode
   *
   * Response (DirectResult pattern):
   * - success: true/false
   * - data: { message: string, mode: string } (on success)
   * - error: { code: string, message: string } (on failure)
   *
   * Mode Switching Commands:
   * - /troubleshoot - Switch to troubleshooting mode
   * - /normal - Switch to normal mode
   */
  server.post('/api/chat', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { message, mode } = request.body as {
        message: string;
        mode?: 'normal' | 'troubleshooting'
      };

      // Validate message
      if (!message || typeof message !== 'string') {
        const result = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Message is required and must be a string'
          }
        };
        return reply.code(400).send(result);
      }

      logger.debug('POST /api/chat', { message, mode });

      // Get or initialize orchestrator
      const orchestrator = await getChatOrchestrator();

      // Handle mode switching commands
      if (message.trim().toLowerCase() === '/troubleshoot') {
        await orchestrator.setMode('troubleshooting' as any);
        const result = {
          success: true,
          data: {
            message: 'Switched to troubleshooting mode. I\'ll help diagnose issues systematically using event history and web search.',
            mode: 'troubleshooting'
          }
        };

        const duration = Date.now() - startTime;
        logger.debug('Chat mode switched to troubleshooting', { duration });

        return reply.send(result);
      }

      if (message.trim().toLowerCase() === '/normal') {
        await orchestrator.setMode('normal' as any);
        const result = {
          success: true,
          data: {
            message: 'Switched to normal mode.',
            mode: 'normal'
          }
        };

        const duration = Date.now() - startTime;
        logger.debug('Chat mode switched to normal', { duration });

        return reply.send(result);
      }

      // Process message through orchestrator
      const response = await orchestrator.processMessage(message);
      const currentMode = orchestrator.getMode();

      const result = {
        success: true,
        data: {
          message: response,
          mode: currentMode
        }
      };

      const duration = Date.now() - startTime;
      logger.debug('Chat message processed', {
        messageLength: message.length,
        responseLength: response.length,
        mode: currentMode,
        duration
      });

      return reply.send(result);

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error('Error processing chat message', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      const result = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      return reply.code(500).send(result);
    }
  });

  // ====================================================================
  // Alexa API Routes
  // ====================================================================

  // Alexa Custom Skill endpoint (conversational AI with LLM)
  server.post(
    '/alexa',
    {
      preHandler: verifyAlexaRequest, // Verify signature and timestamp
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        // Validate request body structure for Custom Skill
        if (!isCustomSkillRequest(request.body)) {
          logger.error('Invalid Custom Skill request structure', {
            body: request.body,
          });
          return reply.code(400).send({
            error: 'Invalid Custom Skill request structure',
          });
        }

        // Log incoming request
        const customRequest = request.body;
        logger.info('Received Custom Skill request', {
          requestType: customRequest.request.type,
          requestId: customRequest.request.requestId,
          sessionId: customRequest.session?.sessionId,
        });

        // Handle Custom Skill request
        const response = await handleCustomSkillRequest(customRequest);

        // Log response
        const duration = Date.now() - startTime;
        logger.info('Custom Skill request handled successfully', {
          requestType: customRequest.request.type,
          duration,
          hasOutput: !!response.response.outputSpeech,
        });

        // Return response
        return response;
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error('Error handling Custom Skill request', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          duration,
        });

        // Return error response (500 Internal Server Error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Alexa Smart Home directive endpoint (device control)
  server.post(
    '/alexa-smarthome',
    {
      preHandler: verifyAlexaRequest, // Verify signature and timestamp
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        // Validate request body structure
        if (!isAlexaDirective(request.body)) {
          logger.error('Invalid Alexa directive structure', {
            body: request.body,
          });
          return reply.code(400).send({
            error: 'Invalid Alexa directive structure',
          });
        }

        // Log incoming directive
        const directive = request.body.directive;
        logger.info('Received Alexa Smart Home directive', {
          namespace: directive.header.namespace,
          name: directive.header.name,
          messageId: directive.header.messageId,
          endpointId: directive.endpoint?.endpointId,
        });

        // Handle directive
        const response = await handleAlexaDirective(request.body);

        // Log response
        const duration = Date.now() - startTime;
        logger.info('Smart Home directive handled successfully', {
          namespace: directive.header.namespace,
          name: directive.header.name,
          duration,
          responseNamespace: response.event.header.namespace,
          responseName: response.event.header.name,
        });

        // Return response
        return response;
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        logger.error('Error handling Smart Home directive', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          duration,
        });

        // Return error response (500 Internal Server Error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ====================================================================
  // Webhook Routes (for SmartThings event webhooks)
  // ====================================================================
  try {
    const queue = await getMessageQueue();
    const store = getEventStore();
    await registerWebhookRoutes(server, queue, store);
    logger.info('Webhook routes registered successfully');
  } catch (error) {
    logger.error('Failed to register webhook routes', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail server startup - webhooks are optional
  }

  // ====================================================================
  // Events API Routes (for event querying and SSE streaming)
  // ====================================================================
  try {
    const queue = await getMessageQueue();
    const store = getEventStore();
    await registerEventsRoutes(server, store, queue);
    logger.info('Events API routes registered successfully');
  } catch (error) {
    logger.error('Failed to register events API routes', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail server startup - events API is optional
  }

  logger.info('API Routes registered:');
  logger.info('  OAuth:   GET    /auth/smartthings (initiate OAuth flow)');
  logger.info('  OAuth:   GET    /auth/smartthings/callback (OAuth callback)');
  logger.info('  OAuth:   POST   /auth/smartthings/disconnect (disconnect account)');
  logger.info('  OAuth:   GET    /auth/smartthings/status (check connection)');
  logger.info('  Rules:   GET    /api/rules');
  logger.info('  Rules:   POST   /api/rules/:id/execute');
  logger.info('  Rules:   PATCH  /api/rules/:id');
  logger.info('  Rules:   DELETE /api/rules/:id');
  logger.info('  Devices: PUT    /api/devices/:deviceId/level');
  logger.info('  Events:  GET    /api/events');
  logger.info('  Events:  GET    /api/events/device/:deviceId');
  logger.info('  Events:  GET    /api/events/stream (SSE)');
  logger.info('  Webhook: POST   /webhook/smartthings');
  logger.info('Other routes: /alexa, /alexa-smarthome, /api/chat, /api/devices/*, /api/automations, /health, /');
}

/**
 * Register error handlers
 *
 * Handles:
 * - 404 Not Found
 * - 500 Internal Server Error
 * - Unhandled errors
 *
 * @param server Fastify instance
 */
function registerErrorHandlers(server: FastifyInstance): void {
  // 404 handler
  server.setNotFoundHandler((request, reply) => {
    logger.warn('Route not found', {
      method: request.method,
      url: request.url,
    });

    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // Global error handler
  server.setErrorHandler((error: Error, request, reply) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      method: request.method,
      url: request.url,
    });

    reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  });

  logger.info('Error handlers registered');
}

/**
 * Initialize SmartThings adapter if credentials are available.
 *
 * Design Decision: Optional initialization at startup
 * Rationale: If no valid credentials exist (PAT or OAuth), adapter initialization
 * will fail, but server should still start to provide OAuth authentication endpoints.
 *
 * Initialization Priority:
 * 1. Try OAuth tokens (from token storage)
 * 2. Try PAT (from environment)
 * 3. If both fail, log warning and continue (OAuth routes available for user auth)
 */
async function initializeSmartThingsAdapter(): Promise<void> {
  try {
    // Priority 1: Check for OAuth tokens in database
    const tokenStorage = getTokenStorage();
    const hasOAuthTokens = tokenStorage.hasTokens('default');

    if (hasOAuthTokens) {
      try {
        const tokens = tokenStorage.getTokens('default');

        if (tokens) {
          // Initialize adapter with OAuth access token
          smartThingsAdapter = new SmartThingsAdapter({
            token: tokens.accessToken,
          });

          await smartThingsAdapter.initialize();

          // Create service container
          serviceContainer = new ServiceContainer(smartThingsService, smartThingsAdapter);

          logger.info('SmartThings adapter initialized with OAuth tokens', {
            expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
            scope: tokens.scope,
          });
          return;
        }
      } catch (error) {
        logger.warn('Failed to retrieve or use OAuth tokens, falling back to PAT', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to PAT attempt
      }
    }

    // Priority 2: Fall back to PAT if no OAuth tokens
    if (!environment.SMARTTHINGS_PAT || environment.SMARTTHINGS_PAT.trim().length === 0) {
      logger.warn('No SmartThings credentials available (neither OAuth nor PAT)');
      logger.info('Users can authenticate via /auth/smartthings OAuth flow');
      return;
    }

    // Initialize with PAT
    smartThingsAdapter = new SmartThingsAdapter({
      token: environment.SMARTTHINGS_PAT,
    });

    await smartThingsAdapter.initialize();

    // Create service container
    serviceContainer = new ServiceContainer(smartThingsService, smartThingsAdapter);

    logger.info('SmartThings adapter initialized with PAT');
  } catch (error) {
    logger.warn('SmartThings adapter initialization failed', {
      error: error instanceof Error ? error.message : String(error),
      hint: 'Users can authenticate via /auth/smartthings',
    });

    // Reset adapter state
    smartThingsAdapter = null;
    serviceContainer = null;
  }
}

/**
 * Start Fastify server
 *
 * Startup sequence:
 * 1. Create Fastify instance
 * 2. Register plugins (security)
 * 3. Register routes (OAuth routes FIRST)
 * 4. Try to initialize SmartThings adapter (optional)
 * 5. Register error handlers
 * 6. Start listening on port
 *
 * Graceful Shutdown:
 * - SIGINT (Ctrl+C): Close server gracefully
 * - SIGTERM (kill): Close server gracefully
 *
 * @returns Promise that resolves when server is started
 */
export async function startAlexaServer(): Promise<FastifyInstance> {
  logger.info('Starting Alexa Fastify server', {
    port: PORT,
    host: HOST,
    nodeEnv: environment.NODE_ENV,
  });

  try {
    // Create server FIRST (before adapter initialization)
    const server = createFastifyServer();

    // Register plugins
    await registerSecurityPlugins(server);

    // Register routes (OAuth routes registered FIRST inside registerRoutes)
    await registerRoutes(server);

    // Try to initialize SmartThings adapter (optional - may fail if no credentials)
    await initializeSmartThingsAdapter();

    // Register error handlers
    registerErrorHandlers(server);

    // Start listening
    await server.listen({
      port: PORT,
      host: HOST,
    });

    logger.info('Alexa Fastify server started successfully', {
      port: PORT,
      host: HOST,
      url: `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`,
      ngrokUrl: 'https://smarty.ngrok-free.app',
    });

    // Log ngrok instructions
    logger.info('ngrok setup instructions:', {
      command: `ngrok http ${PORT} --subdomain=smarty`,
      config: 'Add to ~/.config/ngrok/ngrok.yml for static subdomain',
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      try {
        // Close message queue
        if (messageQueue) {
          await messageQueue.close();
          logger.info('Message queue closed');
        }

        // Close event store
        if (eventStore) {
          eventStore.close();
          logger.info('Event store closed');
        }

        // Close server
        await server.close();
        logger.info('Server closed');

        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (error: unknown) {
    logger.error('Failed to start Alexa server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Main entry point (if run directly)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  startAlexaServer().catch((error) => {
    logger.error('Fatal error starting server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
