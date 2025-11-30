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
import type { DeviceId } from './types/smartthings.js';
import { McpClient } from './mcp/client.js';
import { LlmService } from './services/llm.js';
import { ChatOrchestrator } from './services/chat-orchestrator.js';

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
 * ServiceContainer instance for device operations
 * Initialized once with the singleton SmartThingsService
 */
const serviceContainer = new ServiceContainer(smartThingsService);

/**
 * Singleton ToolExecutor instance for device operations
 */
let toolExecutor: ToolExecutor | null = null;

function getToolExecutor(): ToolExecutor {
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
 *
 * @param server Fastify instance
 */
async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'healthy',
      service: 'mcp-smarterthings-alexa',
      version: environment.MCP_SERVER_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
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
        deviceControl: 'POST /api/devices/:id/on|off - Control devices',
        deviceStatus: 'GET /api/devices/:id/status - Get device status',
        deviceEvents: 'GET /api/devices/events - SSE real-time updates',
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
      }

      // Error case
      logger.error('Failed to turn on device', {
        deviceId,
        error: result.error.message,
        duration,
      });
      return reply.code(500).send(result);
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
      }

      // Error case
      logger.error('Failed to turn off device', {
        deviceId,
        error: result.error.message,
        duration,
      });
      return reply.code(500).send(result);
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
      }

      // Error case
      logger.error('Failed to get device status', {
        deviceId,
        error: result.error.message,
        duration,
      });
      return reply.code(404).send(result);
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

  logger.info('Routes registered (/alexa, /alexa-smarthome, /api/chat, /api/devices/*, /health, /)');
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
 * Start Fastify server
 *
 * Startup sequence:
 * 1. Create Fastify instance
 * 2. Register plugins (security)
 * 3. Register routes
 * 4. Register error handlers
 * 5. Start listening on port
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
    // Create server
    const server = createFastifyServer();

    // Register plugins
    await registerSecurityPlugins(server);

    // Register routes
    await registerRoutes(server);

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
      await server.close();
      logger.info('Server closed');
      process.exit(0);
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
