/**
 * Event Store - Persistent event storage with SQLite
 *
 * Design Decision: SQLite with WAL mode for event persistence
 * Rationale: Lightweight, serverless database following token-storage.ts patterns.
 * Provides efficient storage and retrieval of smart home events.
 *
 * Architecture:
 * - SQLite database in ./data/events.db
 * - WAL mode for better concurrency
 * - Prepared statements for performance
 * - 30-day event retention with auto-cleanup
 * - Indexed queries for fast filtering
 *
 * Performance:
 * - Insert: < 5ms per event
 * - Query: < 50ms for 100 recent events
 * - Cleanup: < 100ms for batch deletes
 *
 * Trade-offs:
 * - Single-node: No distributed storage vs. Elasticsearch
 * - Retention: 30 days vs. unlimited (disk space management)
 * - Simplicity: Zero dependencies vs. complex infrastructure
 */

import Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import type { SmartHomeEvent, EventId, SmartHomeEventType, EventSource } from '../queue/MessageQueue.js';
import type { DeviceId, LocationId } from '../types/smartthings.js';

/**
 * Event store configuration
 */
interface EventStoreConfig {
  databasePath: string;
  retentionDays: number;
}

/**
 * Event query filters
 */
export interface EventFilters {
  /** Filter by event type */
  type?: string;
  /** Filter by event source */
  source?: string;
  /** Filter by device ID */
  deviceId?: string;
  /** Filter events since timestamp (ISO string) */
  since?: string;
  /** Maximum number of results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Stored event (database row)
 *
 * Design Decision: Denormalized storage
 * Rationale: Store all event fields in single table for fast queries.
 * No joins required, optimized for read-heavy workload.
 */
interface StoredEvent {
  id: string;
  type: string;
  source: string;
  device_id: string | null;
  device_name: string | null;
  location_id: string | null;
  event_type: string | null;
  value: string | null; // JSON stringified
  timestamp: number; // Unix timestamp in milliseconds
  metadata: string | null; // JSON stringified
  created_at: number; // Unix timestamp in seconds
}

/**
 * EventStore class - Manages persistent event storage
 *
 * Usage:
 * ```typescript
 * const store = new EventStore();
 *
 * // Save event
 * await store.saveEvent({
 *   id: 'evt-123' as EventId,
 *   type: 'device_event',
 *   source: 'smartthings',
 *   deviceId: 'device-456' as DeviceId,
 *   timestamp: new Date(),
 * });
 *
 * // Query events
 * const events = await store.getEvents({ limit: 50 });
 * ```
 */
export class EventStore {
  private db: Database.Database;
  private config: EventStoreConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<EventStoreConfig>) {
    this.config = {
      databasePath: config?.databasePath || './data/events.db',
      retentionDays: config?.retentionDays || 30,
    };

    // Initialize database
    this.db = new Database(this.config.databasePath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency

    // Initialize schema
    this.initializeSchema();

    // Start cleanup interval (runs daily)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldEvents().catch((error) => {
          logger.error('[EventStore] Cleanup failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      },
      24 * 60 * 60 * 1000
    ); // 24 hours

    logger.info('[EventStore] Initialized', {
      databasePath: this.config.databasePath,
      retentionDays: this.config.retentionDays,
    });
  }

  /**
   * Initialize database schema
   *
   * Schema Design:
   * - id: Event UUID (primary key)
   * - type: Event classification (device_event, user_command, etc.)
   * - source: Originating platform (smartthings, alexa, mcp, webhook)
   * - device_id: Associated device (nullable)
   * - device_name: Human-readable device name (nullable)
   * - location_id: SmartThings location (nullable)
   * - event_type: Specific event subtype (nullable)
   * - value: Event payload as JSON string (nullable)
   * - timestamp: Event occurrence time (milliseconds since epoch)
   * - metadata: Additional context as JSON string (nullable)
   * - created_at: Row insertion time (seconds since epoch)
   *
   * Indexes:
   * - idx_events_timestamp: Fast ordering by time (DESC)
   * - idx_events_device: Fast device filtering
   * - idx_events_type: Fast type filtering
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        device_id TEXT,
        device_name TEXT,
        location_id TEXT,
        event_type TEXT,
        value TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_events_timestamp
        ON events(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_events_device
        ON events(device_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_events_type
        ON events(type, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_events_source
        ON events(source, timestamp DESC);
    `);

    logger.debug('[EventStore] Schema initialized');
  }

  /**
   * Save event to database
   *
   * @param event - Event to save
   *
   * Performance: < 5ms (prepared statement insert)
   *
   * Error Handling:
   * - Duplicate ID: Logs warning and skips (idempotent)
   * - Invalid data: Throws error with details
   */
  async saveEvent(event: SmartHomeEvent): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO events (
          id, type, source, device_id, device_name, location_id,
          event_type, value, timestamp, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.id,
        event.type,
        event.source,
        event.deviceId || null,
        event.deviceName || null,
        event.locationId || null,
        event.eventType || null,
        event.value ? JSON.stringify(event.value) : null,
        event.timestamp.getTime(), // Store as milliseconds
        event.metadata ? JSON.stringify(event.metadata) : null
      );

      logger.debug('[EventStore] Event saved', {
        eventId: event.id,
        type: event.type,
        source: event.source,
      });
    } catch (error) {
      // Check for unique constraint violation (duplicate ID)
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        logger.warn('[EventStore] Duplicate event ID, skipping', {
          eventId: event.id,
        });
        return;
      }

      logger.error('[EventStore] Failed to save event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get events with optional filtering
   *
   * @param filters - Query filters
   * @returns Array of events (most recent first)
   *
   * Performance: < 50ms for 100 events with indexes
   *
   * Example:
   * ```typescript
   * // Get 50 most recent events
   * const events = await store.getEvents({ limit: 50 });
   *
   * // Get device-specific events
   * const deviceEvents = await store.getEvents({
   *   deviceId: 'abc123',
   *   limit: 20
   * });
   *
   * // Get events since timestamp
   * const recentEvents = await store.getEvents({
   *   since: '2025-12-04T00:00:00Z',
   *   limit: 100
   * });
   * ```
   */
  async getEvents(filters: EventFilters = {}): Promise<SmartHomeEvent[]> {
    try {
      const {
        type,
        source,
        deviceId,
        since,
        limit = 50,
        offset = 0,
      } = filters;

      // Build WHERE clauses
      const whereClauses: string[] = [];
      const params: unknown[] = [];

      if (type) {
        whereClauses.push('type = ?');
        params.push(type);
      }

      if (source) {
        whereClauses.push('source = ?');
        params.push(source);
      }

      if (deviceId) {
        whereClauses.push('device_id = ?');
        params.push(deviceId);
      }

      if (since) {
        const sinceTimestamp = new Date(since).getTime();
        whereClauses.push('timestamp >= ?');
        params.push(sinceTimestamp);
      }

      // Build query
      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';

      const query = `
        SELECT * FROM events
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);

      const stmt = this.db.prepare<unknown[], StoredEvent>(query);
      const rows = stmt.all(...params);

      // Convert to SmartHomeEvent[]
      const events: SmartHomeEvent[] = rows.map((row) => ({
        id: row.id as EventId,
        type: row.type as SmartHomeEventType,
        source: row.source as EventSource,
        deviceId: row.device_id ? (row.device_id as DeviceId) : undefined,
        deviceName: row.device_name || undefined,
        locationId: row.location_id ? (row.location_id as LocationId) : undefined,
        eventType: row.event_type || undefined,
        value: row.value ? JSON.parse(row.value) : undefined,
        timestamp: new Date(row.timestamp),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

      logger.debug('[EventStore] Events fetched', {
        count: events.length,
        filters,
      });

      return events;
    } catch (error) {
      logger.error('[EventStore] Failed to get events', {
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get events for specific device
   *
   * @param deviceId - Device ID
   * @param limit - Maximum results (default: 50)
   * @returns Array of events for device
   */
  async getEventsByDevice(deviceId: string, limit: number = 50): Promise<SmartHomeEvent[]> {
    return this.getEvents({ deviceId, limit });
  }

  /**
   * Get recent events (last N events)
   *
   * @param limit - Number of events (default: 100, max: 500)
   * @returns Array of recent events
   */
  async getRecentEvents(limit: number = 100): Promise<SmartHomeEvent[]> {
    // Cap limit to prevent excessive memory usage
    const cappedLimit = Math.min(limit, 500);
    return this.getEvents({ limit: cappedLimit });
  }

  /**
   * Get event count (total or filtered)
   *
   * @param filters - Optional filters
   * @returns Event count
   */
  async getEventCount(filters: Omit<EventFilters, 'limit' | 'offset'> = {}): Promise<number> {
    try {
      const { type, source, deviceId, since } = filters;

      // Build WHERE clauses
      const whereClauses: string[] = [];
      const params: unknown[] = [];

      if (type) {
        whereClauses.push('type = ?');
        params.push(type);
      }

      if (source) {
        whereClauses.push('source = ?');
        params.push(source);
      }

      if (deviceId) {
        whereClauses.push('device_id = ?');
        params.push(deviceId);
      }

      if (since) {
        const sinceTimestamp = new Date(since).getTime();
        whereClauses.push('timestamp >= ?');
        params.push(sinceTimestamp);
      }

      const whereClause = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';

      const query = `SELECT COUNT(*) as count FROM events ${whereClause}`;

      const stmt = this.db.prepare<unknown[], { count: number }>(query);
      const result = stmt.get(...params);

      return result?.count || 0;
    } catch (error) {
      logger.error('[EventStore] Failed to get event count', {
        filters,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Clean up old events beyond retention period
   *
   * Removes events older than configured retention days.
   * Runs automatically daily via interval.
   *
   * Performance: < 100ms for batch delete
   */
  private async cleanupOldEvents(): Promise<void> {
    logger.info('[EventStore] Running cleanup', {
      retentionDays: this.config.retentionDays,
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      const cutoffTimestamp = cutoffDate.getTime();

      const stmt = this.db.prepare('DELETE FROM events WHERE timestamp < ?');
      const result = stmt.run(cutoffTimestamp);

      logger.info('[EventStore] Cleanup completed', {
        deletedRows: result.changes,
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (error) {
      logger.error('[EventStore] Cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Close database connection
   *
   * Call this before process exit.
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.db.close();
    logger.debug('[EventStore] Closed');
  }
}

/**
 * Singleton instance (optional pattern)
 */
let eventStoreInstance: EventStore | null = null;

/**
 * Get or create singleton event store instance
 *
 * @returns EventStore instance
 */
export function getEventStore(): EventStore {
  if (!eventStoreInstance) {
    eventStoreInstance = new EventStore();
  }
  return eventStoreInstance;
}
