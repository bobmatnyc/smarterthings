/**
 * Event Logger - File-based event logging with daily rotation
 *
 * Design Decision: Winston with daily rotation for event archival
 * Rationale: JSON Lines format for efficient parsing, 90-day retention
 * for compliance and debugging, separate from main application logs.
 *
 * Architecture:
 * - Daily log files: logs/events/events-YYYY-MM-DD.log
 * - JSON Lines format (one event per line)
 * - 90-day retention with automatic cleanup
 * - 20MB max file size before rotation
 * - Compressed archives for older files
 *
 * Performance:
 * - Async writes (non-blocking)
 * - Buffered I/O
 * - Minimal overhead (~1ms per event)
 *
 * Trade-offs:
 * - File-based: Simple vs. centralized logging (e.g., ELK stack)
 * - 90-day retention: Balances compliance needs vs. disk space
 * - Compressed archives: Saves space vs. immediate readability
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

/**
 * Event log transport with daily rotation
 *
 * Configuration:
 * - filename: events-%DATE%.log (DATE = YYYY-MM-DD)
 * - dirname: logs/events/
 * - maxSize: 20MB per file
 * - maxFiles: 90 days
 * - zippedArchive: true (compress old files)
 */
const eventTransport = new DailyRotateFile({
  filename: 'events-%DATE%.log',
  dirname: path.join(process.cwd(), 'logs', 'events'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  zippedArchive: true,
});

/**
 * Event logger instance
 *
 * Separate logger from main application logger to:
 * - Isolate event logs for analysis
 * - Allow different retention policies
 * - Enable independent log rotation
 */
export const eventLogger = winston.createLogger({
  level: 'info',
  transports: [eventTransport],
});

/**
 * Log event to file
 *
 * @param event - Event data to log
 *
 * Format: JSON Lines (one event per line)
 * Example output:
 * ```json
 * {"type":"device_event","source":"smartthings","deviceId":"abc123","deviceName":"Living Room Light","value":{"switch":"on"},"timestamp":"2025-12-22T10:30:00.000Z","level":"info","message":"event"}
 * ```
 *
 * Usage:
 * ```typescript
 * logEvent({
 *   type: 'device_event',
 *   source: 'smartthings',
 *   deviceId: 'abc123',
 *   deviceName: 'Living Room Light',
 *   value: { switch: 'on' },
 *   timestamp: new Date(),
 * });
 * ```
 */
export function logEvent(event: {
  type: string;
  source: string;
  deviceId?: string;
  deviceName?: string;
  value: unknown;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
}): void {
  eventLogger.info('event', {
    ...event,
    timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
  });
}
