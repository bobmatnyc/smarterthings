import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { environment } from '../config/environment.js';
import logger from '../utils/logger.js';
import { getEventStore } from '../storage/event-store.js';
import { MessageQueue } from '../queue/MessageQueue.js';
import { getTokenStorage } from '../storage/token-storage.js';

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
      origin: ['http://localhost:5181', 'http://localhost:5182', 'http://127.0.0.1:5181', 'http://127.0.0.1:5182'],
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

  // SSE device events endpoint
  const sseClients = new Set<express.Response>();

  app.get('/api/events/stream', (_req, res) => {
    logger.info('New SSE device events connection');

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
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
