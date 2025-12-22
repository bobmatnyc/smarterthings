/**
 * Polling API Routes
 *
 * REST endpoints for managing device polling service.
 *
 * Design Decision: Manual polling control
 * Rationale: Allow users to start/stop polling based on their needs.
 * Polling may not be necessary if webhooks are configured, or users may
 * want to disable polling to reduce API calls.
 *
 * Routes:
 * - GET /api/polling/status - Get polling service status
 * - POST /api/polling/start - Start polling
 * - POST /api/polling/stop - Stop polling
 * - DELETE /api/polling/state - Clear tracked state
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import logger from '../utils/logger.js';
import type { DevicePollingService } from '../services/device-polling-service.js';

/**
 * Start polling request schema
 */
const StartPollingSchema = z.object({
  intervalMs: z.number().int().min(1000).max(60000).optional(),
});

type StartPollingRequest = z.infer<typeof StartPollingSchema>;

/**
 * Register polling API routes
 *
 * @param server - Fastify instance
 * @param getPollingService - Getter function for device polling service instance
 */
export async function registerPollingRoutes(
  server: FastifyInstance,
  getPollingService: () => DevicePollingService | null
): Promise<void> {
  /**
   * GET /api/polling/status - Get polling service status
   *
   * Returns current status including:
   * - running: Whether polling is active
   * - pollCount: Total number of polls executed
   * - changeCount: Total number of state changes detected
   * - trackedDevices: Number of devices being monitored
   * - intervalMs: Current polling interval
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "running": true,
   *     "pollCount": 42,
   *     "changeCount": 5,
   *     "trackedDevices": 15,
   *     "intervalMs": 5000
   *   }
   * }
   * ```
   */
  server.get('/api/polling/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pollingService = getPollingService();
      if (!pollingService) {
        return reply.code(503).send({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Polling service not initialized',
          },
        });
      }

      const status = pollingService.getStatus();

      logger.debug('[Polling API] GET /api/polling/status', { status });

      return reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('[Polling API] GET /api/polling/status failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get polling status',
        },
      });
    }
  });

  /**
   * POST /api/polling/start - Start polling service
   *
   * Starts the polling service if not already running.
   * Optional request body can override polling interval.
   *
   * Request Body (optional):
   * ```json
   * {
   *   "intervalMs": 5000
   * }
   * ```
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "message": "Polling started",
   *     "intervalMs": 5000
   *   }
   * }
   * ```
   */
  server.post(
    '/api/polling/start',
    async (
      request: FastifyRequest<{ Body: StartPollingRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const pollingService = getPollingService();
        if (!pollingService) {
          return reply.code(503).send({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Polling service not initialized',
            },
          });
        }

        // Validate request body if provided
        if (request.body) {
          StartPollingSchema.parse(request.body);
        }

        const currentStatus = pollingService.getStatus();

        if (currentStatus.running) {
          logger.warn('[Polling API] POST /api/polling/start - Already running');
          return reply.code(400).send({
            success: false,
            error: {
              code: 'ALREADY_RUNNING',
              message: 'Polling service is already running',
            },
          });
        }

        // Start polling
        pollingService.start();

        const newStatus = pollingService.getStatus();

        logger.info('[Polling API] Polling service started', {
          intervalMs: newStatus.intervalMs,
        });

        return reply.send({
          success: true,
          data: {
            message: 'Polling started',
            intervalMs: newStatus.intervalMs,
          },
        });
      } catch (error) {
        logger.error('[Polling API] POST /api/polling/start failed', {
          error: error instanceof Error ? error.message : String(error),
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to start polling',
          },
        });
      }
    }
  );

  /**
   * POST /api/polling/stop - Stop polling service
   *
   * Stops the polling service if currently running.
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "message": "Polling stopped",
   *     "totalPolls": 42,
   *     "totalChanges": 5
   *   }
   * }
   * ```
   */
  server.post('/api/polling/stop', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pollingService = getPollingService();
      if (!pollingService) {
        return reply.code(503).send({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Polling service not initialized',
          },
        });
      }

      const currentStatus = pollingService.getStatus();

      if (!currentStatus.running) {
        logger.warn('[Polling API] POST /api/polling/stop - Not running');
        return reply.code(400).send({
          success: false,
          error: {
            code: 'NOT_RUNNING',
            message: 'Polling service is not running',
          },
        });
      }

      // Stop polling
      pollingService.stop();

      const finalStatus = pollingService.getStatus();

      logger.info('[Polling API] Polling service stopped', {
        totalPolls: finalStatus.pollCount,
        totalChanges: finalStatus.changeCount,
      });

      return reply.send({
        success: true,
        data: {
          message: 'Polling stopped',
          totalPolls: finalStatus.pollCount,
          totalChanges: finalStatus.changeCount,
        },
      });
    } catch (error) {
      logger.error('[Polling API] POST /api/polling/stop failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to stop polling',
        },
      });
    }
  });

  /**
   * DELETE /api/polling/state - Clear tracked state
   *
   * Clears all tracked device states. Useful for resetting change detection
   * or after device list changes.
   *
   * Note: This does not stop polling. State will be rebuilt on next poll cycle.
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "message": "State cleared"
   *   }
   * }
   * ```
   */
  server.delete('/api/polling/state', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pollingService = getPollingService();
      if (!pollingService) {
        return reply.code(503).send({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Polling service not initialized',
          },
        });
      }

      pollingService.clearState();

      logger.info('[Polling API] Polling state cleared');

      return reply.send({
        success: true,
        data: {
          message: 'State cleared',
        },
      });
    } catch (error) {
      logger.error('[Polling API] DELETE /api/polling/state failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to clear state',
        },
      });
    }
  });

  logger.info('[Polling API] Routes registered:');
  logger.info('  GET    /api/polling/status');
  logger.info('  POST   /api/polling/start');
  logger.info('  POST   /api/polling/stop');
  logger.info('  DELETE /api/polling/state');
}
