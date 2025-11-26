/**
 * Alexa request verification middleware
 *
 * Design Decision: Mandatory signature and timestamp verification
 * Rationale: Amazon requires all non-Lambda skills to verify request authenticity
 * to prevent unauthorized device control. Signature verification validates the
 * request came from Amazon, timestamp validation prevents replay attacks.
 *
 * Security Requirements (MANDATORY):
 * 1. Signature Verification: Validate request signature using Amazon's certificate
 * 2. Timestamp Validation: Reject requests older than 150 seconds
 * 3. Certificate Validation: Verify SSL certificate chain
 *
 * Error Handling:
 * - Invalid signature: 400 Bad Request (reject immediately)
 * - Expired timestamp: 400 Bad Request (reject immediately)
 * - Missing headers: 400 Bad Request (malformed request)
 * - Certificate validation failure: 400 Bad Request
 *
 * Performance:
 * - Verification adds ~50-100ms latency (certificate download cached)
 * - Critical path: Must complete before processing directive
 * - Trade-off: Security vs. latency (security wins, Alexa requires <1s total)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
// @ts-ignore - alexa-verifier has no type definitions
import verifier from 'alexa-verifier';
import logger from '../utils/logger.js';
import { isAlexaDirective } from './types.js';

/**
 * Maximum allowed age for Alexa requests (150 seconds per Amazon requirements)
 */
const MAX_REQUEST_AGE_MS = 150 * 1000;

/**
 * Verify Alexa request signature and timestamp
 *
 * This middleware MUST be applied to all /alexa endpoints to ensure security.
 * It validates that the request:
 * 1. Came from Amazon (signature verification)
 * 2. Is recent (timestamp < 150 seconds old)
 * 3. Has valid certificate chain
 *
 * @param request Fastify request object
 * @param reply Fastify reply object
 * @throws Error if verification fails (handled by Fastify error handler)
 */
export async function verifyAlexaRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();

  try {
    // Extract verification headers
    const certUrl = request.headers['signaturecertchainurl'] as string | undefined;
    const signature = request.headers['signature'] as string | undefined;

    // Validate required headers
    if (!certUrl || !signature) {
      logger.error('Missing required Alexa verification headers', {
        hasCertUrl: !!certUrl,
        hasSignature: !!signature,
      });
      reply.code(400).send({
        error: 'Missing required headers (signaturecertchainurl, signature)',
      });
      return;
    }

    // Get raw body for signature verification
    // Note: Fastify's JSON parser already consumed the body, so we need to reconstruct it
    const rawBody = JSON.stringify(request.body);

    // Verify signature using alexa-verifier
    await new Promise<void>((resolve, reject) => {
      verifier(certUrl, signature, rawBody, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    logger.debug('Alexa signature verification passed', {
      certUrl,
      duration: Date.now() - startTime,
    });

    // Verify timestamp
    await verifyTimestamp(request.body);

    logger.info('Alexa request verification completed', {
      duration: Date.now() - startTime,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Alexa request verification failed', {
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    reply.code(400).send({
      error: 'Request verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Verify request timestamp is within acceptable range
 *
 * Amazon requires requests to be no older than 150 seconds to prevent
 * replay attacks. This function extracts the timestamp from the Alexa
 * directive and validates its age.
 *
 * @param body Request body (Alexa directive)
 * @throws Error if timestamp is missing or too old
 */
async function verifyTimestamp(body: unknown): Promise<void> {
  // Validate body structure
  if (!isAlexaDirective(body)) {
    throw new Error('Invalid Alexa directive structure');
  }

  // Extract timestamp from directive header
  const timestamp = (body.directive.header as unknown as { timestamp?: string }).timestamp;

  if (!timestamp) {
    throw new Error('Missing timestamp in directive header');
  }

  // Parse timestamp
  const requestTime = new Date(timestamp).getTime();

  if (isNaN(requestTime)) {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }

  // Calculate age
  const currentTime = Date.now();
  const ageMs = Math.abs(currentTime - requestTime);

  // Validate age
  if (ageMs > MAX_REQUEST_AGE_MS) {
    throw new Error(
      `Request timestamp too old: ${ageMs / 1000}s (max: ${MAX_REQUEST_AGE_MS / 1000}s)`
    );
  }

  logger.debug('Timestamp verification passed', {
    timestamp,
    ageMs,
    maxAgeMs: MAX_REQUEST_AGE_MS,
  });
}

/**
 * Optional: Skip verification for development/testing
 *
 * DO NOT USE IN PRODUCTION. This function allows bypassing signature
 * verification for local testing with mock Alexa requests.
 *
 * Usage: Set environment variable ALEXA_SKIP_VERIFICATION=true
 *
 * Security Warning: NEVER enable this in production. Skipping verification
 * allows anyone to send requests to your endpoint and control devices.
 */
export async function verifyAlexaRequestDev(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const skipVerification = process.env['ALEXA_SKIP_VERIFICATION'] === 'true';

  if (skipVerification) {
    logger.warn('⚠️  Alexa verification SKIPPED (development mode)', {
      nodeEnv: process.env['NODE_ENV'],
    });
    return;
  }

  return verifyAlexaRequest(request, reply);
}
