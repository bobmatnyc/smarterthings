/**
 * Local Rules Engine API - REST endpoints for CRUD operations
 *
 * Design Decision: Local-first rules execution
 * Rationale: Execute rules locally for faster response times and offline capability.
 * Falls back to SmartThings cloud rules when cloud sync is enabled.
 *
 * Architecture:
 * - GET /api/rules/local - List all local rules
 * - GET /api/rules/local/:id - Get single rule
 * - POST /api/rules/local - Create new rule
 * - PATCH /api/rules/local/:id - Update rule
 * - DELETE /api/rules/local/:id - Delete rule
 * - POST /api/rules/local/:id/execute - Manually execute rule
 * - POST /api/rules/local/:id/enable - Enable rule
 * - POST /api/rules/local/:id/disable - Disable rule
 *
 * Performance:
 * - List query: < 10ms for 100 rules (in-memory)
 * - Rule execution: < 100ms for simple actions
 * - Validation: < 5ms using Zod schemas
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { getRulesStorage, initializeRulesStorage } from '../rules/storage.js';
import { executeRule, setSmartThingsAdapter } from '../rules/executor.js';
import type { CreateRuleRequest, UpdateRuleRequest, RuleExecutionContext } from '../rules/types.js';
import { createRuleId } from '../rules/types.js';

/**
 * Validation schemas
 */
const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(50),
  triggers: z.array(z.any()).min(1), // TODO: Add strict trigger validation
  conditions: z.array(z.any()).optional(),
  actions: z.array(z.any()).min(1), // TODO: Add strict action validation
});

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
  triggers: z.array(z.any()).min(1).optional(),
  conditions: z.array(z.any()).optional(),
  actions: z.array(z.any()).min(1).optional(),
});

/**
 * Set SmartThings adapter for rule execution
 */
export function setAdapterForRules(adapter: any): void {
  setSmartThingsAdapter(adapter);
  logger.info('[Rules API] SmartThings adapter configured');
}

/**
 * Register local rules API routes
 *
 * @param server - Fastify instance
 * @param adapter - SmartThings adapter (optional, can be set later)
 */
export async function registerLocalRulesRoutes(
  server: FastifyInstance,
  adapter?: any
): Promise<void> {
  // Initialize storage
  await initializeRulesStorage();
  logger.info('[Rules API] Storage initialized');

  // Set adapter if provided
  if (adapter) {
    setAdapterForRules(adapter);
  }

  /**
   * GET /api/rules/local - List all local rules
   *
   * Query Parameters: None
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "rules": [...],
   *     "count": 5,
   *     "enabledCount": 3
   *   }
   * }
   * ```
   */
  server.get('/api/rules/local', async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      const storage = getRulesStorage();
      const rules = storage.getAll();
      const enabledCount = rules.filter((r) => r.enabled).length;

      const duration = Date.now() - startTime;

      logger.debug('[Rules API] GET /api/rules/local', {
        count: rules.length,
        enabledCount,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          rules,
          count: rules.length,
          enabledCount,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Rules API] GET /api/rules/local failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list rules',
        },
      });
    }
  });

  /**
   * GET /api/rules/local/:id - Get single rule
   *
   * Path Parameters:
   * - id: Rule ID
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...rule }
   * }
   * ```
   */
  server.get<{ Params: { id: string } }>('/api/rules/local/:id', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { id } = request.params;
      const storage = getRulesStorage();
      const rule = storage.get(createRuleId(id));

      if (!rule) {
        logger.warn('[Rules API] Rule not found', { ruleId: id });
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Rule not found',
          },
        });
      }

      const duration = Date.now() - startTime;

      logger.debug('[Rules API] GET /api/rules/local/:id', {
        ruleId: id,
        duration,
      });

      return reply.send({
        success: true,
        data: rule,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Rules API] GET /api/rules/local/:id failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get rule',
        },
      });
    }
  });

  /**
   * POST /api/rules/local - Create new rule
   *
   * Body: CreateRuleRequest (validated with Zod)
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...createdRule }
   * }
   * ```
   */
  server.post<{ Body: CreateRuleRequest }>('/api/rules/local', async (request, reply) => {
    const startTime = Date.now();

    try {
      // Validate request body
      const validatedBody = CreateRuleSchema.parse(request.body);

      const storage = getRulesStorage();
      const rule = await storage.create(validatedBody, 'user');

      const duration = Date.now() - startTime;

      logger.info('[Rules API] Created rule', {
        ruleId: rule.id,
        ruleName: rule.name,
        duration,
      });

      return reply.code(201).send({
        success: true,
        data: rule,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        logger.warn('[Rules API] Validation error', {
          errors: error.errors,
          duration,
        });

        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid rule data',
            details: error.errors,
          },
        });
      }

      logger.error('[Rules API] POST /api/rules/local failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create rule',
        },
      });
    }
  });

  /**
   * PATCH /api/rules/local/:id - Update rule
   *
   * Path Parameters:
   * - id: Rule ID
   *
   * Body: UpdateRuleRequest (validated with Zod)
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...updatedRule }
   * }
   * ```
   */
  server.patch<{ Params: { id: string }; Body: UpdateRuleRequest }>(
    '/api/rules/local/:id',
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { id } = request.params;

        // Validate request body
        const validatedBody = UpdateRuleSchema.parse(request.body);

        const storage = getRulesStorage();
        const updated = await storage.update(createRuleId(id), validatedBody as UpdateRuleRequest);

        if (!updated) {
          logger.warn('[Rules API] Rule not found for update', { ruleId: id });
          return reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Rule not found',
            },
          });
        }

        const duration = Date.now() - startTime;

        logger.info('[Rules API] Updated rule', {
          ruleId: id,
          ruleName: updated.name,
          duration,
        });

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          logger.warn('[Rules API] Validation error', {
            errors: error.errors,
            duration,
          });

          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid rule data',
              details: error.errors,
            },
          });
        }

        logger.error('[Rules API] PATCH /api/rules/local/:id failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update rule',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/rules/local/:id - Delete rule
   *
   * Path Parameters:
   * - id: Rule ID
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "message": "Rule deleted"
   * }
   * ```
   */
  server.delete<{ Params: { id: string } }>('/api/rules/local/:id', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { id } = request.params;
      const storage = getRulesStorage();
      const deleted = await storage.delete(createRuleId(id));

      if (!deleted) {
        logger.warn('[Rules API] Rule not found for deletion', { ruleId: id });
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Rule not found',
          },
        });
      }

      const duration = Date.now() - startTime;

      logger.info('[Rules API] Deleted rule', {
        ruleId: id,
        duration,
      });

      return reply.send({
        success: true,
        message: 'Rule deleted',
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Rules API] DELETE /api/rules/local/:id failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete rule',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/:id/execute - Manually execute rule
   *
   * Path Parameters:
   * - id: Rule ID
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...executionResult }
   * }
   * ```
   */
  server.post<{ Params: { id: string } }>(
    '/api/rules/local/:id/execute',
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { id } = request.params;
        const storage = getRulesStorage();
        const rule = storage.get(createRuleId(id));

        if (!rule) {
          logger.warn('[Rules API] Rule not found for execution', { ruleId: id });
          return reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Rule not found',
            },
          });
        }

        const context: RuleExecutionContext = {
          triggeredBy: 'manual',
          variables: {},
        };

        const result = await executeRule(rule, context);

        const duration = Date.now() - startTime;

        logger.info('[Rules API] Executed rule', {
          ruleId: id,
          ruleName: rule.name,
          success: result.success,
          actionsExecuted: result.actionsExecuted,
          duration,
        });

        return reply.send({
          success: result.success,
          data: result,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[Rules API] POST /api/rules/local/:id/execute failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to execute rule',
          },
        });
      }
    }
  );

  /**
   * POST /api/rules/local/:id/enable - Enable rule
   *
   * Path Parameters:
   * - id: Rule ID
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...updatedRule }
   * }
   * ```
   */
  server.post<{ Params: { id: string } }>('/api/rules/local/:id/enable', async (request, reply) => {
    const startTime = Date.now();

    try {
      const { id } = request.params;
      const storage = getRulesStorage();
      const updated = await storage.setEnabled(createRuleId(id), true);

      if (!updated) {
        logger.warn('[Rules API] Rule not found for enable', { ruleId: id });
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Rule not found',
          },
        });
      }

      const duration = Date.now() - startTime;

      logger.info('[Rules API] Enabled rule', {
        ruleId: id,
        ruleName: updated.name,
        duration,
      });

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Rules API] POST /api/rules/local/:id/enable failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to enable rule',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/:id/disable - Disable rule
   *
   * Path Parameters:
   * - id: Rule ID
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...updatedRule }
   * }
   * ```
   */
  server.post<{ Params: { id: string } }>(
    '/api/rules/local/:id/disable',
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { id } = request.params;
        const storage = getRulesStorage();
        const updated = await storage.setEnabled(createRuleId(id), false);

        if (!updated) {
          logger.warn('[Rules API] Rule not found for disable', { ruleId: id });
          return reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Rule not found',
            },
          });
        }

        const duration = Date.now() - startTime;

        logger.info('[Rules API] Disabled rule', {
          ruleId: id,
          ruleName: updated.name,
          duration,
        });

        return reply.send({
          success: true,
          data: updated,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[Rules API] POST /api/rules/local/:id/disable failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to disable rule',
          },
        });
      }
    }
  );

  /**
   * POST /api/rules/local/generate - Generate rule from natural language
   *
   * Body:
   * - prompt: string (required) - Natural language description
   * - devices: DeviceInfo[] (optional) - Available devices for context
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": { ...generatedRule }
   * }
   * ```
   */
  server.post<{ Body: { prompt: string; devices?: any[] } }>(
    '/api/rules/local/generate',
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { prompt, devices } = request.body;

        if (!prompt || typeof prompt !== 'string') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Prompt is required and must be a string',
            },
          });
        }

        logger.info('[Rules API] Generating rule from prompt', {
          prompt: prompt.substring(0, 100),
          deviceCount: devices?.length || 0,
        });

        // Import generator (lazy load)
        const { generateRuleFromPrompt } = await import('../rules/generator.js');

        // Get LLM client if available (from environment)
        let llmClient = null;
        if (process.env['OPENROUTER_API_KEY']) {
          const OpenAI = (await import('openai')).default;
          llmClient = new OpenAI({
            apiKey: process.env['OPENROUTER_API_KEY'],
            baseURL: 'https://openrouter.ai/api/v1',
          });
        }

        // Generate rule
        const rule = await generateRuleFromPrompt({
          prompt,
          availableDevices: devices,
          llmClient,
        });

        if (!rule) {
          logger.warn('[Rules API] Failed to generate rule');
          return reply.code(500).send({
            success: false,
            error: {
              code: 'GENERATION_FAILED',
              message: 'Failed to generate rule from prompt',
            },
          });
        }

        const duration = Date.now() - startTime;

        logger.info('[Rules API] Generated rule', {
          ruleName: rule.name,
          duration,
        });

        return reply.send({
          success: true,
          data: rule,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[Rules API] POST /api/rules/local/generate failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to generate rule',
          },
        });
      }
    }
  );

  /**
   * GET /api/rules/local/conflicts - Check for rule conflicts
   *
   * Analyzes all enabled rules to detect potential conflicts where multiple
   * rules target the same device with opposing or duplicate commands.
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "conflicts": [
   *       {
   *         "deviceId": "abc123",
   *         "deviceName": "Living Room Light",
   *         "rules": [...],
   *         "severity": "warning",
   *         "message": "Multiple rules send opposing commands (on/off) to device",
   *         "conflictType": "opposing_commands"
   *       }
   *     ],
   *     "count": 1,
   *     "hasConflicts": true
   *   }
   * }
   * ```
   */
  server.get('/api/rules/local/conflicts', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { detectConflicts } = await import('../rules/conflict-detector.js');
      const conflicts = detectConflicts();

      const duration = Date.now() - startTime;

      logger.debug('[Rules API] GET /api/rules/local/conflicts', {
        conflictCount: conflicts.length,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          conflicts,
          count: conflicts.length,
          hasConflicts: conflicts.length > 0,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Rules API] GET /api/rules/local/conflicts failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect conflicts',
        },
      });
    }
  });

  /**
   * GET /api/rules/local/history - Get rule execution history
   *
   * Returns statistics and recent execution history for all rules.
   * Includes event listener stats and per-rule execution counts.
   *
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "stats": {
   *       "initialized": true,
   *       "enabled": true,
   *       "connected": true,
   *       "processedEvents": 42,
   *       "rulesTriggered": 15,
   *       "rulesFailed": 2
   *     },
   *     "recentExecutions": [
   *       {
   *         "ruleId": "rule-123",
   *         "ruleName": "Turn on lights at sunset",
   *         "lastExecutedAt": "2024-01-15T18:30:00Z",
   *         "executionCount": 5
   *       }
   *     ]
   *   }
   * }
   * ```
   */
  server.get('/api/rules/local/history', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { getRulesEventListener } = await import('../rules/event-listener.js');
      const listener = getRulesEventListener();
      const stats = listener.getStats();
      const storage = getRulesStorage();

      // Get recent executions from rules (basic tracking)
      const rules = storage.getAll();
      const recentExecutions = rules
        .filter((r) => r.lastExecutedAt)
        .map((r) => ({
          ruleId: r.id,
          ruleName: r.name,
          lastExecutedAt: r.lastExecutedAt,
          executionCount: r.executionCount,
          enabled: r.enabled,
          priority: r.priority,
        }))
        .sort((a, b) => {
          const dateA = new Date(a.lastExecutedAt!).getTime();
          const dateB = new Date(b.lastExecutedAt!).getTime();
          return dateB - dateA;
        })
        .slice(0, 50);

      const duration = Date.now() - startTime;

      logger.debug('[Rules API] GET /api/rules/local/history', {
        executionCount: recentExecutions.length,
        duration,
      });

      return reply.send({
        success: true,
        data: {
          stats,
          recentExecutions,
          totalRules: rules.length,
          rulesWithExecutions: recentExecutions.length,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('[Rules API] GET /api/rules/local/history failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get execution history',
        },
      });
    }
  });

  // =========================================================================
  // Phase 2: Advanced Trigger Endpoints
  // =========================================================================

  /**
   * GET /api/rules/local/scheduler - Get scheduler status and jobs
   *
   * Returns information about the rules scheduler including:
   * - Scheduler status (initialized, enabled)
   * - List of scheduled jobs (time, cron, astronomical triggers)
   * - Execution statistics
   */
  server.get('/api/rules/local/scheduler', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { getRulesScheduler } = await import('../rules/scheduler.js');
      const scheduler = getRulesScheduler();

      const stats = scheduler.getStats();
      const jobs = scheduler.getScheduledJobs();

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          stats,
          scheduledJobs: jobs,
          jobCount: jobs.length,
        },
        duration,
      });
    } catch (error) {
      logger.error('[Rules API] GET /api/rules/local/scheduler failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get scheduler status',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/scheduler/enable - Enable scheduler
   */
  server.post('/api/rules/local/scheduler/enable', async (_request, reply) => {
    try {
      const { getRulesScheduler } = await import('../rules/scheduler.js');
      const scheduler = getRulesScheduler();
      scheduler.setEnabled(true);

      return reply.send({
        success: true,
        message: 'Scheduler enabled',
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to enable scheduler',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/scheduler/disable - Disable scheduler
   */
  server.post('/api/rules/local/scheduler/disable', async (_request, reply) => {
    try {
      const { getRulesScheduler } = await import('../rules/scheduler.js');
      const scheduler = getRulesScheduler();
      scheduler.setEnabled(false);

      return reply.send({
        success: true,
        message: 'Scheduler disabled',
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to disable scheduler',
        },
      });
    }
  });

  /**
   * GET /api/rules/local/astronomical - Get astronomical times
   *
   * Returns today's sunrise, sunset, and other solar times based on location.
   */
  server.get('/api/rules/local/astronomical', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { getAstronomicalCalculator } = await import('../rules/astronomical.js');
      const astro = getAstronomicalCalculator();

      const summary = astro.getTodaysSummary();

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          ...summary,
          hasLocation: summary.location !== null,
          formattedTimes: summary.times
            ? {
                sunrise: summary.times.sunrise.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                sunset: summary.times.sunset.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                dawn: summary.times.dawn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                dusk: summary.times.dusk.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              }
            : null,
        },
        duration,
      });
    } catch (error) {
      logger.error('[Rules API] GET /api/rules/local/astronomical failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get astronomical times',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/astronomical/location - Set location for astronomical calculations
   *
   * Body:
   * - latitude: number (required)
   * - longitude: number (required)
   * - name: string (optional)
   * - timezone: string (optional)
   */
  server.post<{
    Body: { latitude: number; longitude: number; name?: string; timezone?: string };
  }>('/api/rules/local/astronomical/location', async (request, reply) => {
    try {
      const { latitude, longitude, name, timezone } = request.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Latitude and longitude are required numbers',
          },
        });
      }

      const { getAstronomicalCalculator } = await import('../rules/astronomical.js');
      const astro = getAstronomicalCalculator();

      astro.setLocation({
        latitude,
        longitude,
        name,
        timezone,
      });

      // Also refresh scheduler for astronomical triggers
      const { getRulesScheduler } = await import('../rules/scheduler.js');
      const scheduler = getRulesScheduler();
      const storage = getRulesStorage();
      const rules = storage.getEnabled();

      for (const rule of rules) {
        const hasAstro = rule.triggers.some((t) => t.type === 'astronomical');
        if (hasAstro) {
          scheduler.rescheduleRule(rule);
        }
      }

      return reply.send({
        success: true,
        message: `Location set to ${name || `${latitude}, ${longitude}`}`,
        data: astro.getTodaysSummary(),
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set location',
        },
      });
    }
  });

  /**
   * GET /api/rules/local/duration - Get duration tracker status
   *
   * Returns tracked device states and pending duration triggers.
   */
  server.get('/api/rules/local/duration', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { getDurationTracker } = await import('../rules/duration-tracker.js');
      const tracker = getDurationTracker();

      const stats = tracker.getStats();
      const trackedStates = tracker.getTrackedStates();

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          stats,
          trackedStates,
        },
        duration,
      });
    } catch (error) {
      logger.error('[Rules API] GET /api/rules/local/duration failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get duration tracker status',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/:id/check-conditions - Check rule conditions
   *
   * Evaluates the conditions of a rule without executing it.
   * Useful for debugging and testing conditions.
   */
  server.post<{ Params: { id: string } }>(
    '/api/rules/local/:id/check-conditions',
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { id } = request.params;
        const storage = getRulesStorage();
        const rule = storage.get(createRuleId(id));

        if (!rule) {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Rule not found',
            },
          });
        }

        if (!rule.conditions || rule.conditions.length === 0) {
          return reply.send({
            success: true,
            data: {
              hasConditions: false,
              result: { satisfied: true, reason: 'No conditions defined' },
            },
          });
        }

        const { getConditionEvaluator } = await import('../rules/condition-evaluator.js');
        const evaluator = getConditionEvaluator();
        const result = await evaluator.evaluateAll(rule.conditions);

        const duration = Date.now() - startTime;

        return reply.send({
          success: true,
          data: {
            hasConditions: true,
            conditionCount: rule.conditions.length,
            result,
          },
          duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('[Rules API] POST /api/rules/local/:id/check-conditions failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to check conditions',
          },
        });
      }
    }
  );

  // =========================================================================
  // Phase 4: Event Analyzer and Pattern-Based Suggestions
  // =========================================================================

  /**
   * GET /api/rules/local/analyzer - Get event analyzer status and stats
   *
   * Returns information about the event analyzer including:
   * - Number of events recorded
   * - Patterns detected
   * - Suggestions generated
   */
  server.get('/api/rules/local/analyzer', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { getEventAnalyzer } = await import('../rules/event-analyzer.js');
      const analyzer = getEventAnalyzer();

      const stats = analyzer.getStats();
      const eventCount = analyzer.getEvents().length;

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          stats,
          eventCount,
          maxEvents: 10000, // From analyzer config
        },
        duration,
      });
    } catch (error) {
      logger.error('[Rules API] GET /api/rules/local/analyzer failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get analyzer status',
        },
      });
    }
  });

  /**
   * GET /api/rules/local/patterns - Get detected patterns from device events
   *
   * Analyzes recorded device events to find patterns including:
   * - Time patterns: Devices used at consistent times
   * - Correlations: Device A triggers after device B
   *
   * Query Parameters:
   * - minOccurrences: Minimum occurrences to consider a pattern (default: 3)
   * - toleranceMinutes: Time tolerance for time patterns (default: 15)
   */
  server.get('/api/rules/local/patterns', async (_request, reply) => {
    const startTime = Date.now();

    try {
      const { getDetectedPatterns, describePattern } = await import('../rules/generator.js');
      const patterns = getDetectedPatterns();

      // Add human-readable descriptions
      const timePatterns = patterns.timePatterns.map((p) => ({
        ...p,
        description: describePattern(p),
      }));

      const correlations = patterns.correlations.map((p) => ({
        ...p,
        description: describePattern(p),
      }));

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          timePatterns,
          correlations,
          stats: patterns.stats,
          totalPatterns: timePatterns.length + correlations.length,
        },
        duration,
      });
    } catch (error) {
      logger.error('[Rules API] GET /api/rules/local/patterns failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect patterns',
        },
      });
    }
  });

  /**
   * GET /api/rules/local/suggestions - Get rule suggestions based on detected patterns
   *
   * Returns automation suggestions generated from device event patterns.
   *
   * Query Parameters:
   * - minConfidence: Minimum confidence threshold 0-1 (default: 0.3)
   * - maxSuggestions: Maximum number of suggestions (default: 10)
   * - includeTimePatterns: Include time-based patterns (default: true)
   * - includeCorrelations: Include correlation patterns (default: true)
   */
  server.get<{
    Querystring: {
      minConfidence?: string;
      maxSuggestions?: string;
      includeTimePatterns?: string;
      includeCorrelations?: string;
    };
  }>('/api/rules/local/suggestions', async (request, reply) => {
    const startTime = Date.now();

    try {
      const minConfidence = parseFloat(request.query.minConfidence || '0.3');
      const maxSuggestions = parseInt(request.query.maxSuggestions || '10', 10);
      const includeTimePatterns = request.query.includeTimePatterns !== 'false';
      const includeCorrelations = request.query.includeCorrelations !== 'false';

      const { getPatternBasedSuggestions, describePattern } = await import('../rules/generator.js');

      const suggestions = getPatternBasedSuggestions({
        minConfidence,
        maxSuggestions,
        includeTimePatterns,
        includeCorrelations,
      });

      // Format suggestions for API response
      const formattedSuggestions = suggestions.map((s) => ({
        patternType: s.pattern.type,
        patternDescription: describePattern(s.pattern),
        confidence: s.pattern.confidence,
        occurrences: s.pattern.occurrences,
        description: s.description,
        reasoning: s.reasoning,
        suggestedRule: s.suggestedRule,
      }));

      const duration = Date.now() - startTime;

      return reply.send({
        success: true,
        data: {
          suggestions: formattedSuggestions,
          count: formattedSuggestions.length,
        },
        duration,
      });
    } catch (error) {
      logger.error('[Rules API] GET /api/rules/local/suggestions failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get suggestions',
        },
      });
    }
  });

  /**
   * POST /api/rules/local/suggestions/:index/accept - Accept a suggestion and create rule
   *
   * Creates a rule from a pattern suggestion. The rule starts disabled for review.
   *
   * Path Parameters:
   * - index: Index of the suggestion to accept (0-based)
   *
   * Body (optional):
   * - enabled: Whether to enable the rule immediately (default: false)
   * - name: Override the suggested rule name
   * - description: Override the suggested rule description
   */
  server.post<{
    Params: { index: string };
    Body: { enabled?: boolean; name?: string; description?: string };
  }>('/api/rules/local/suggestions/:index/accept', async (request, reply) => {
    const startTime = Date.now();

    try {
      const index = parseInt(request.params.index, 10);
      const { enabled = false, name, description } = request.body || {};

      const { getPatternBasedSuggestions } = await import('../rules/generator.js');
      const suggestions = getPatternBasedSuggestions();

      if (index < 0 || index >= suggestions.length) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_INDEX',
            message: `Invalid suggestion index. Available: 0-${suggestions.length - 1}`,
          },
        });
      }

      const suggestion = suggestions[index];
      if (!suggestion) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Suggestion not found',
          },
        });
      }

      // Create rule from suggestion with optional overrides
      const ruleRequest = {
        ...suggestion.suggestedRule,
        enabled,
        name: name || suggestion.suggestedRule.name,
        description: description || suggestion.suggestedRule.description,
      };

      const storage = getRulesStorage();
      const createdRule = await storage.create(ruleRequest);

      const duration = Date.now() - startTime;

      logger.info('[Rules API] Created rule from suggestion', {
        ruleId: createdRule.id,
        ruleName: createdRule.name,
        patternType: suggestion.pattern.type,
        confidence: suggestion.pattern.confidence,
        duration,
      });

      return reply.code(201).send({
        success: true,
        data: createdRule,
        message: `Rule "${createdRule.name}" created from pattern suggestion`,
      });
    } catch (error) {
      logger.error('[Rules API] POST /api/rules/local/suggestions/:index/accept failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to accept suggestion',
        },
      });
    }
  });

  /**
   * DELETE /api/rules/local/analyzer/events - Clear recorded events
   *
   * Clears all recorded device events from the analyzer.
   * Use after patterns have been reviewed or for testing.
   */
  server.delete('/api/rules/local/analyzer/events', async (_request, reply) => {
    try {
      const { clearAnalyzerEvents, getAnalyzerStats } = await import('../rules/generator.js');

      const beforeStats = getAnalyzerStats();
      clearAnalyzerEvents();
      const afterStats = getAnalyzerStats();

      return reply.send({
        success: true,
        message: 'Event analyzer cleared',
        data: {
          beforeClear: beforeStats,
          afterClear: afterStats,
        },
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to clear analyzer events',
        },
      });
    }
  });

  logger.info('[Rules API] Routes registered:');
  logger.info('  GET    /api/rules/local');
  logger.info('  GET    /api/rules/local/:id');
  logger.info('  GET    /api/rules/local/conflicts');
  logger.info('  GET    /api/rules/local/history');
  logger.info('  GET    /api/rules/local/scheduler');
  logger.info('  GET    /api/rules/local/astronomical');
  logger.info('  GET    /api/rules/local/duration');
  logger.info('  GET    /api/rules/local/analyzer');
  logger.info('  GET    /api/rules/local/patterns');
  logger.info('  GET    /api/rules/local/suggestions');
  logger.info('  POST   /api/rules/local');
  logger.info('  POST   /api/rules/local/generate');
  logger.info('  POST   /api/rules/local/scheduler/enable');
  logger.info('  POST   /api/rules/local/scheduler/disable');
  logger.info('  POST   /api/rules/local/astronomical/location');
  logger.info('  POST   /api/rules/local/suggestions/:index/accept');
  logger.info('  DELETE /api/rules/local/analyzer/events');
  logger.info('  PATCH  /api/rules/local/:id');
  logger.info('  DELETE /api/rules/local/:id');
  logger.info('  POST   /api/rules/local/:id/execute');
  logger.info('  POST   /api/rules/local/:id/enable');
  logger.info('  POST   /api/rules/local/:id/disable');
  logger.info('  POST   /api/rules/local/:id/check-conditions');
}
