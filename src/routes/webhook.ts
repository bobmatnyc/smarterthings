/**
 * Webhook Handler - SmartThings event webhooks with HMAC verification
 *
 * Design Decision: Fast acknowledgment with async processing
 * Rationale: SmartThings requires webhook response < 3 seconds.
 * Immediately enqueue events to message queue and return 200 OK.
 *
 * Architecture:
 * - POST /webhook/smartthings endpoint
 * - HMAC-SHA256 signature verification (SMARTTHINGS_CLIENT_SECRET)
 * - Lifecycle event handling (PING, CONFIRMATION, EVENT)
 * - Fast acknowledgment (< 100ms)
 * - Async event processing via message queue
 *
 * Security:
 * - HMAC signature validation prevents unauthorized webhooks
 * - Rejects requests with invalid or missing signatures (401)
 * - Rate limiting recommended in production (100 req/min)
 *
 * Performance:
 * - Acknowledgment time: < 100ms (signature + enqueue)
 * - Processing time: Async (does not block webhook response)
 * - Capacity: 100+ req/sec
 *
 * SmartThings Lifecycle Events:
 * - PING: Health check (respond with 200 OK)
 * - CONFIRMATION: Webhook registration (respond with challenge)
 * - EVENT: Device events (enqueue for processing)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { environment } from '../config/environment.js';
import type { MessageQueue, SmartHomeEvent, EventId } from '../queue/MessageQueue.js';
import type { EventStore } from '../storage/event-store.js';

/**
 * SmartThings webhook lifecycle types
 */
const SmartThingsLifecycle = z.enum(['PING', 'CONFIRMATION', 'EVENT', 'UNINSTALL']);

/**
 * Webhook request schema validation
 */
const WebhookRequestSchema = z.object({
  lifecycle: SmartThingsLifecycle,
  // PING lifecycle (health check)
  pingData: z
    .object({
      challenge: z.string(),
    })
    .optional(),
  // CONFIRMATION lifecycle (webhook registration)
  confirmationData: z
    .object({
      appId: z.string(),
      confirmationUrl: z.string().url(),
    })
    .optional(),
  // EVENT lifecycle (device events)
  eventData: z
    .object({
      installedApp: z.object({
        installedAppId: z.string(),
        locationId: z.string(),
      }),
      events: z.array(
        z.object({
          eventId: z.string(),
          locationId: z.string(),
          deviceId: z.string().optional(),
          componentId: z.string().optional(),
          capability: z.string().optional(),
          attribute: z.string().optional(),
          value: z.unknown(),
          valueType: z.string().optional(),
          stateChange: z.boolean().optional(),
          eventTime: z.string().optional(),
        })
      ),
    })
    .optional(),
});

type WebhookRequest = z.infer<typeof WebhookRequestSchema>;

/**
 * Verify HMAC signature
 *
 * SmartThings sends signature in X-ST-HMAC header.
 * Signature is HMAC-SHA256 of request body using CLIENT_SECRET.
 *
 * @param signature - Signature from header
 * @param body - Raw request body string
 * @param secret - HMAC secret key
 * @returns True if signature is valid
 */
function verifyHmacSignature(
  signature: string | undefined,
  body: string,
  secret: string
): boolean {
  if (!signature) {
    logger.warn('[Webhook] Missing X-ST-HMAC header');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('[Webhook] Invalid HMAC signature', {
        receivedSignature: signature.substring(0, 16) + '...',
        expectedSignature: expectedSignature.substring(0, 16) + '...',
      });
    }

    return isValid;
  } catch (error) {
    logger.error('[Webhook] HMAC verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Register webhook routes
 *
 * @param server - Fastify instance
 * @param messageQueue - Message queue for event processing
 * @param eventStore - Event store for persistence
 */
export async function registerWebhookRoutes(
  server: FastifyInstance,
  messageQueue: MessageQueue,
  eventStore: EventStore
): Promise<void> {
  /**
   * POST /webhook/smartthings - SmartThings webhook endpoint
   *
   * Handles lifecycle events:
   * - PING: Health check (SmartThings validates webhook URL)
   * - CONFIRMATION: Webhook registration confirmation
   * - EVENT: Device events from SmartThings
   * - UNINSTALL: App uninstall notification
   *
   * Security:
   * - HMAC-SHA256 signature verification required
   * - Rejects invalid signatures with 401 Unauthorized
   *
   * Performance:
   * - Fast acknowledgment (< 100ms)
   * - Events enqueued asynchronously
   * - Response does not wait for processing
   */
  server.post(
    '/webhook/smartthings',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        // Get HMAC signature from header
        const signature = request.headers['x-st-hmac'] as string | undefined;

        // Get raw body for signature verification
        const rawBody = JSON.stringify(request.body);

        // Verify HMAC signature
        const clientSecret = environment.SMARTTHINGS_CLIENT_SECRET;
        if (!clientSecret) {
          logger.error('[Webhook] SMARTTHINGS_CLIENT_SECRET not configured');
          return reply.code(500).send({
            error: 'Webhook configuration error',
          });
        }

        const isValidSignature = verifyHmacSignature(signature, rawBody, clientSecret);
        if (!isValidSignature) {
          logger.warn('[Webhook] Rejected request with invalid signature');
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid HMAC signature',
          });
        }

        // Validate request body
        let webhookData: WebhookRequest;
        try {
          webhookData = WebhookRequestSchema.parse(request.body);
        } catch (validationError) {
          logger.error('[Webhook] Invalid request body', {
            error: validationError instanceof z.ZodError
              ? validationError.errors
              : String(validationError),
          });
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Invalid webhook payload',
          });
        }

        logger.debug('[Webhook] Received request', {
          lifecycle: webhookData.lifecycle,
        });

        // Handle lifecycle events
        switch (webhookData.lifecycle) {
          case 'PING': {
            // Health check - respond with challenge
            const challenge = webhookData.pingData?.challenge;
            if (!challenge) {
              return reply.code(400).send({
                error: 'Bad Request',
                message: 'Missing challenge in PING request',
              });
            }

            const duration = Date.now() - startTime;
            logger.info('[Webhook] PING received', { duration });

            return reply.code(200).send({
              statusCode: 200,
              pingData: {
                challenge,
              },
            });
          }

          case 'CONFIRMATION': {
            // Webhook registration - respond with confirmation URL
            const confirmationUrl = webhookData.confirmationData?.confirmationUrl;
            if (!confirmationUrl) {
              return reply.code(400).send({
                error: 'Bad Request',
                message: 'Missing confirmationUrl',
              });
            }

            const duration = Date.now() - startTime;
            logger.info('[Webhook] CONFIRMATION received', {
              appId: webhookData.confirmationData?.appId,
              duration,
            });

            // Return confirmation (SmartThings will verify via confirmationUrl)
            return reply.code(200).send({
              statusCode: 200,
              confirmationData: {
                targetUrl: confirmationUrl,
              },
            });
          }

          case 'EVENT': {
            // Device events - enqueue for async processing
            const eventData = webhookData.eventData;
            if (!eventData || !eventData.events || eventData.events.length === 0) {
              logger.warn('[Webhook] EVENT lifecycle with no events');
              return reply.code(200).send({
                statusCode: 200,
              });
            }

            const { installedApp, events } = eventData;

            logger.info('[Webhook] EVENT received', {
              eventCount: events.length,
              locationId: installedApp.locationId,
            });

            // Enqueue each event to message queue
            const enqueuePromises = events.map(async (event) => {
              const smartHomeEvent: SmartHomeEvent = {
                id: (event.eventId || crypto.randomUUID()) as EventId,
                type: 'device_event',
                source: 'webhook',
                deviceId: event.deviceId as any,
                locationId: installedApp.locationId as any,
                eventType: event.capability && event.attribute
                  ? `${event.capability}.${event.attribute}`
                  : undefined,
                value: event.value,
                timestamp: event.eventTime ? new Date(event.eventTime) : new Date(),
                metadata: {
                  installedAppId: installedApp.installedAppId,
                  componentId: event.componentId,
                  valueType: event.valueType,
                  stateChange: event.stateChange,
                },
              };

              // Save to event store (async, don't wait)
              eventStore.saveEvent(smartHomeEvent).catch((error) => {
                logger.error('[Webhook] Failed to save event to store', {
                  eventId: smartHomeEvent.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              });

              // Enqueue to message queue for processing
              await messageQueue.enqueue('device_event', smartHomeEvent);
            });

            // Wait for all events to be enqueued (fast operation < 50ms)
            await Promise.all(enqueuePromises);

            const duration = Date.now() - startTime;
            logger.info('[Webhook] Events enqueued', {
              count: events.length,
              duration,
            });

            // Return acknowledgment
            return reply.code(200).send({
              statusCode: 200,
            });
          }

          case 'UNINSTALL': {
            // App uninstall notification
            logger.info('[Webhook] UNINSTALL received');

            // No action required - just acknowledge
            return reply.code(200).send({
              statusCode: 200,
            });
          }

          default: {
            logger.warn('[Webhook] Unknown lifecycle type', {
              lifecycle: webhookData.lifecycle,
            });
            return reply.code(400).send({
              error: 'Bad Request',
              message: 'Unknown lifecycle type',
            });
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[Webhook] Request handling failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  logger.info('[Webhook] Routes registered: POST /webhook/smartthings');
}
