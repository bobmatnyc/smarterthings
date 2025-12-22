/**
 * Subscription Management Routes
 *
 * API endpoints for managing SmartThings event subscriptions.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService, DEFAULT_SUBSCRIPTIONS } from '../smartthings/subscription-service.js';
import logger from '../utils/logger.js';

export async function subscriptionRoutes(
  fastify: FastifyInstance,
  options: { subscriptionService: SubscriptionService }
): Promise<void> {
  const { subscriptionService } = options;

  // List all subscriptions
  fastify.get('/api/subscriptions', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const subscriptions = await subscriptionService.listSubscriptions();
      return { success: true, data: { count: subscriptions.length, subscriptions } };
    } catch (error: any) {
      logger.error('Failed to list subscriptions', { error });
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to list subscriptions',
      });
    }
  });

  // Create default subscriptions (motion, contact, switch, etc.)
  fastify.post(
    '/api/subscriptions/defaults',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const results = await subscriptionService.subscribeToDefaults();
        return {
          success: true,
          data: results,
          message: `Subscribed to ${results.success.length} capabilities`,
        };
      } catch (error: any) {
        logger.error('Failed to create default subscriptions', { error });
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to create subscriptions',
        });
      }
    }
  );

  // Subscribe to a specific capability
  fastify.post(
    '/api/subscriptions',
    async (
      request: FastifyRequest<{ Body: { capability: string; attribute?: string; name?: string } }>,
      reply: FastifyReply
    ) => {
      const { capability, attribute, name } = request.body || {};

      if (!capability) {
        return reply.status(400).send({ success: false, error: 'capability is required' });
      }

      try {
        const subscription = await subscriptionService.subscribeToCapability({
          capability,
          attribute,
          subscriptionName: name || `${capability}-events`,
        });
        return { success: true, data: subscription };
      } catch (error: any) {
        logger.error('Failed to create subscription', { capability, error });
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to create subscription',
        });
      }
    }
  );

  // Delete all subscriptions
  fastify.delete('/api/subscriptions', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deleted = await subscriptionService.deleteAllSubscriptions();
      return { success: true, data: { deleted } };
    } catch (error: any) {
      logger.error('Failed to delete subscriptions', { error });
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to delete subscriptions',
      });
    }
  });

  // Get available capabilities for subscription
  fastify.get('/api/subscriptions/capabilities', async () => {
    return {
      success: true,
      data: {
        defaults: DEFAULT_SUBSCRIPTIONS,
        description:
          'These are the default capabilities that can be subscribed to for real-time events',
      },
    };
  });
}
