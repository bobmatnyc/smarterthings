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
      service: 'mcp-smartthings-alexa',
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
        health: 'GET /health',
      },
      documentation: 'https://github.com/bobmatnyc/mcp-smartthings',
    };
  });

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

  logger.info('Routes registered (/alexa, /alexa-smarthome, /health, /)');
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
