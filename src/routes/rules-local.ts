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
import type {
  CreateRuleRequest,
  UpdateRuleRequest,
  RuleExecutionContext,
} from '../rules/types.js';
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
  server.get<{ Params: { id: string } }>(
    '/api/rules/local/:id',
    async (request, reply) => {
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
    }
  );

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
  server.post<{ Body: CreateRuleRequest }>(
    '/api/rules/local',
    async (request, reply) => {
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
    }
  );

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
  server.delete<{ Params: { id: string } }>(
    '/api/rules/local/:id',
    async (request, reply) => {
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
    }
  );

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
  server.post<{ Params: { id: string } }>(
    '/api/rules/local/:id/enable',
    async (request, reply) => {
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
    }
  );

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

  logger.info('[Rules API] Routes registered:');
  logger.info('  GET    /api/rules/local');
  logger.info('  GET    /api/rules/local/:id');
  logger.info('  POST   /api/rules/local');
  logger.info('  POST   /api/rules/local/generate');
  logger.info('  PATCH  /api/rules/local/:id');
  logger.info('  DELETE /api/rules/local/:id');
  logger.info('  POST   /api/rules/local/:id/execute');
  logger.info('  POST   /api/rules/local/:id/enable');
  logger.info('  POST   /api/rules/local/:id/disable');
}
