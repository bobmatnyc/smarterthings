/**
 * Dashboard API Routes - Status summaries and dashboard data
 *
 * Design Decision: Dedicated dashboard endpoints for kiosk mode
 * Rationale: Separate from events API to focus on presentation layer.
 * Provides LLM-generated summaries optimized for status displays.
 *
 * Architecture:
 * - GET /api/dashboard/summary - LLM summary of recent activity
 * - DashboardService handles caching and LLM calls
 * - 30-second cache minimizes API costs
 *
 * Performance:
 * - Cache hit: <10ms
 * - Cache miss: 1-2s (LLM latency)
 * - Target: <100ms for cached responses
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger.js';
import type { DashboardService } from '../services/dashboard-service.js';

/**
 * Register dashboard API routes
 *
 * @param server - Fastify instance
 * @param dashboardService - Dashboard service for summaries
 */
export function registerDashboardRoutes(
  server: FastifyInstance,
  dashboardService: DashboardService
): void {
  /**
   * GET /api/dashboard/summary - Get LLM summary of recent home activity
   *
   * Returns:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "summary": "Living room light turned on, front door unlocked...",
   *     "eventCount": 25,
   *     "highlights": ["Living room light", "Front door"],
   *     "timestamp": "2025-12-23T12:34:56.789Z"
   *   }
   * }
   * ```
   *
   * Performance:
   * - Cached: <10ms
   * - Fresh: 1-2s (LLM call)
   *
   * Errors:
   * - 500: LLM service failure (returns fallback summary)
   */
  server.get('/api/dashboard/summary', async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      logger.debug('[Dashboard API] GET /api/dashboard/summary');

      // Generate summary (uses cache if available)
      const summary = await dashboardService.generateSummary();

      const duration = Date.now() - startTime;

      logger.info('[Dashboard API] Summary generated', {
        eventCount: summary.eventCount,
        cached: duration < 100, // Heuristic: <100ms likely cache hit
        duration,
      });

      return reply.send({
        success: true,
        data: summary,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Dashboard API] GET /api/dashboard/summary failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate summary',
        },
      });
    }
  });

  /**
   * POST /api/dashboard/analyze-event - Analyze events for alerts
   *
   * Request Body:
   * ```json
   * {
   *   "events": [
   *     {
   *       "type": "device_event",
   *       "source": "smartthings",
   *       "deviceName": "Front Door",
   *       "eventType": "contact",
   *       "value": { "contact": "open" },
   *       "timestamp": "2025-12-23T12:34:56.789Z"
   *     }
   *   ]
   * }
   * ```
   *
   * Returns:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "alerts": [
   *       {
   *         "alert": true,
   *         "priority": "warning",
   *         "message": "Front door opened unexpectedly",
   *         "category": "security"
   *       }
   *     ]
   *   }
   * }
   * ```
   *
   * Performance:
   * - LLM call: 1-2s
   * - Empty events: <10ms
   *
   * Errors:
   * - 400: Invalid request body
   * - 500: LLM service failure (returns empty alerts)
   */
  server.post(
    '/api/dashboard/analyze-event',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        logger.debug('[Dashboard API] POST /api/dashboard/analyze-event');

        // Parse request body
        const body = request.body as {
          events?: Array<{
            type: string;
            source: string;
            deviceName?: string;
            deviceId?: string;
            eventType?: string;
            value?: unknown;
            timestamp: string;
          }>;
        };

        if (!body || !Array.isArray(body.events)) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Request body must contain "events" array',
            },
          });
        }

        // Analyze events for alerts
        const alerts = await dashboardService.analyzeEvents(body.events);

        const duration = Date.now() - startTime;

        logger.info('[Dashboard API] Alerts analyzed', {
          eventCount: body.events.length,
          alertCount: alerts.length,
          duration,
        });

        return reply.send({
          success: true,
          data: {
            alerts,
          },
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[Dashboard API] POST /api/dashboard/analyze-event failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to analyze events',
          },
        });
      }
    }
  );

  logger.info('[Dashboard API] Routes registered:');
  logger.info('  GET /api/dashboard/summary');
  logger.info('  POST /api/dashboard/analyze-event');
}
