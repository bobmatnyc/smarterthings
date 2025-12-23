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
export async function registerDashboardRoutes(
  server: FastifyInstance,
  dashboardService: DashboardService
): Promise<void> {
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

  logger.info('[Dashboard API] Routes registered:');
  logger.info('  GET /api/dashboard/summary');
}
