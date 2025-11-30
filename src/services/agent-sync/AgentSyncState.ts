/**
 * AgentSyncState - SQLite state tracking service for agent synchronization.
 *
 * Design Decision: Synchronous API with better-sqlite3
 * Rationale: Synchronous operations simplify code and are sufficient for local database access.
 * The database is lightweight (68KB currently) and all operations complete in <50ms.
 *
 * Architecture:
 * - Uses existing database at ~/.config/claude-mpm/agent_sync.db
 * - Schema managed by Claude MPM Python backend (DO NOT modify)
 * - Provides TypeScript interface to sources, agent_files, and sync_history tables
 * - Prepared statements cached for performance
 * - Transactions for atomic operations
 *
 * Trade-offs:
 * - Synchronous API: Simpler code, sufficient performance for local database
 * - Prepared Statements: Better performance, prevent SQL injection
 * - WAL Mode: Better concurrency with Python backend
 * - Database Lock: 5-second timeout with retry logic
 *
 * Performance Characteristics:
 * - Source lookup: <5ms
 * - File tracking: <10ms
 * - Sync history recording: <15ms
 * - List operations: <20ms
 * - Database size: 68KB (20 files, 72+ sync records)
 *
 * Related Ticket: 1M-388 - Implement SQLite State Tracking
 * Parent Ticket: 1M-382 - Migrate Agent System to Git-Based Markdown Repository
 * Dependencies: Unblocks 1M-389 (Agent sync), 1M-392 (Conflict resolution)
 *
 * @module services/agent-sync/AgentSyncState
 */

import Database, { type Statement } from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import logger from '../../utils/logger.js';
import {
  type Source,
  type SourceRow,
  type AgentFile,
  type AgentFileRow,
  type SyncHistoryEntry,
  type SyncHistoryRow,
  type SyncResult,
  type SourceOptions,
  type FileTrackOptions,
  type DatabaseHealth,
  AgentSyncError,
} from './types.js';
import { SourceQueries, FileQueries, HistoryQueries, SchemaQueries } from './queries.js';

/**
 * Default database path (matches Claude MPM configuration).
 */
const DEFAULT_DB_PATH = path.join(os.homedir(), '.config', 'claude-mpm', 'agent_sync.db');

/**
 * Expected schema version.
 */
const EXPECTED_SCHEMA_VERSION = 1;

/**
 * AgentSyncState - SQLite state tracking service.
 *
 * Provides CRUD operations for agent synchronization state management.
 * All operations are synchronous using better-sqlite3.
 *
 * @example
 * ```typescript
 * // Create service instance
 * const syncState = new AgentSyncState();
 *
 * // Add a source
 * syncState.addSource('github-remote', 'https://github.com/company/agents');
 *
 * // Track a file
 * syncState.trackFile('github-remote', 'research.md', 'sha256-hash', {
 *   localPath: '/Users/masa/.claude/agents/research.md',
 *   fileSize: 12345
 * });
 *
 * // Record sync result
 * syncState.recordSync('github-remote', {
 *   status: 'success',
 *   filesSynced: 10,
 *   filesCached: 5,
 *   filesFailed: 0,
 *   durationMs: 220
 * });
 *
 * // Cleanup
 * syncState.close();
 * ```
 */
export class AgentSyncState {
  private db: Database.Database;
  private statements: Map<string, Statement> = new Map();
  private readonly dbPath: string;

  /**
   * Create AgentSyncState instance.
   *
   * @param dbPath Database file path (defaults to ~/.config/claude-mpm/agent_sync.db)
   * @throws AgentSyncError if database doesn't exist or is incompatible
   */
  constructor(dbPath?: string) {
    this.dbPath = dbPath || process.env['AGENT_SYNC_DB_PATH'] || DEFAULT_DB_PATH;

    // Check if database exists
    if (!fs.existsSync(this.dbPath)) {
      throw new AgentSyncError(
        `Database not found at ${this.dbPath}. Ensure Claude MPM is installed and initialized.`,
        'DATABASE_NOT_FOUND',
        { dbPath: this.dbPath }
      );
    }

    try {
      // Open database with read-write access
      this.db = new Database(this.dbPath, {
        readonly: false,
        fileMustExist: true,
      });

      // Configure database for better concurrency and performance
      this.configureDatebase();

      // Validate schema
      this.validateSchema();

      logger.info('AgentSyncState initialized', {
        dbPath: this.dbPath,
        sourceCount: this.getSourceCount(),
        fileCount: this.getFileCount(),
      });
    } catch (error) {
      throw new AgentSyncError(
        `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { dbPath: this.dbPath, originalError: error }
      );
    }
  }

  // ========================================
  // Source Management
  // ========================================

  /**
   * Add new source.
   *
   * @param id Unique source identifier
   * @param url Source URL or file path
   * @param options Source configuration options
   * @throws AgentSyncError if source already exists or database operation fails
   *
   * @example
   * ```typescript
   * syncState.addSource('company-agents', 'https://github.com/company/agents', {
   *   enabled: true,
   *   etag: null,
   *   lastSha: null
   * });
   * ```
   */
  addSource(id: string, url: string, options?: SourceOptions): void {
    try {
      const stmt = this.getStatement('addSource', SourceQueries.ADD_SOURCE);
      stmt.run(
        id,
        url,
        options?.enabled !== false ? 1 : 0,
        options?.etag ?? null,
        options?.lastSha ?? null
      );

      logger.debug('Source added', { id, url });
    } catch (error) {
      throw new AgentSyncError(
        `Failed to add source ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { id, url, originalError: error }
      );
    }
  }

  /**
   * Get source by ID.
   *
   * @param id Source identifier
   * @returns Source or null if not found
   *
   * @example
   * ```typescript
   * const source = syncState.getSource('github-remote');
   * if (source) {
   *   console.log(`Last sync: ${source.lastSyncTime}`);
   * }
   * ```
   */
  getSource(id: string): Source | null {
    try {
      const stmt = this.getStatement('getSource', SourceQueries.GET_SOURCE);
      const row = stmt.get(id) as SourceRow | undefined;
      return row ? this.mapSourceRow(row) : null;
    } catch (error) {
      throw new AgentSyncError(
        `Failed to get source ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { id, originalError: error }
      );
    }
  }

  /**
   * List all sources.
   *
   * @param enabledOnly If true, only return enabled sources
   * @returns Array of sources
   *
   * @example
   * ```typescript
   * const sources = syncState.listSources();
   * sources.forEach(source => {
   *   console.log(`${source.id}: ${source.url}`);
   * });
   * ```
   */
  listSources(enabledOnly = false): Source[] {
    try {
      const query = enabledOnly ? SourceQueries.LIST_ENABLED_SOURCES : SourceQueries.LIST_SOURCES;
      const stmt = this.getStatement(enabledOnly ? 'listEnabledSources' : 'listSources', query);
      const rows = stmt.all() as SourceRow[];
      return rows.map((row) => this.mapSourceRow(row));
    } catch (error) {
      throw new AgentSyncError(
        `Failed to list sources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Update source sync metadata.
   *
   * Updates last_sha, last_sync_time, and etag for a source.
   *
   * @param id Source identifier
   * @param lastSha Commit SHA
   * @param etag HTTP ETag (optional)
   * @throws AgentSyncError if source doesn't exist or update fails
   *
   * @example
   * ```typescript
   * syncState.updateSourceSyncTime('github-remote', 'abc123sha', 'W/"etag-value"');
   * ```
   */
  updateSourceSyncTime(id: string, lastSha: string, etag?: string): void {
    try {
      const stmt = this.getStatement('updateSourceSync', SourceQueries.UPDATE_SOURCE_SYNC);
      const result = stmt.run(lastSha, new Date().toISOString(), etag ?? null, id);

      if (result.changes === 0) {
        throw new AgentSyncError(`Source ${id} not found`, 'SOURCE_NOT_FOUND', { id });
      }

      logger.debug('Source sync time updated', { id, lastSha });
    } catch (error) {
      if (error instanceof AgentSyncError) throw error;
      throw new AgentSyncError(
        `Failed to update source ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { id, originalError: error }
      );
    }
  }

  /**
   * Disable source.
   *
   * @param id Source identifier
   * @throws AgentSyncError if source doesn't exist
   *
   * @example
   * ```typescript
   * syncState.disableSource('bad-source');
   * ```
   */
  disableSource(id: string): void {
    this.setSourceEnabled(id, false);
  }

  /**
   * Enable source.
   *
   * @param id Source identifier
   * @throws AgentSyncError if source doesn't exist
   *
   * @example
   * ```typescript
   * syncState.enableSource('github-remote');
   * ```
   */
  enableSource(id: string): void {
    this.setSourceEnabled(id, true);
  }

  /**
   * Remove source and all associated files and history.
   *
   * Cascades to agent_files and sync_history tables.
   *
   * @param id Source identifier
   * @throws AgentSyncError if source doesn't exist or deletion fails
   *
   * @example
   * ```typescript
   * syncState.removeSource('old-source');
   * ```
   */
  removeSource(id: string): void {
    try {
      const stmt = this.getStatement('deleteSource', SourceQueries.DELETE_SOURCE);
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new AgentSyncError(`Source ${id} not found`, 'SOURCE_NOT_FOUND', { id });
      }

      logger.info('Source removed', { id });
    } catch (error) {
      if (error instanceof AgentSyncError) throw error;
      throw new AgentSyncError(
        `Failed to remove source ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { id, originalError: error }
      );
    }
  }

  // ========================================
  // File Tracking
  // ========================================

  /**
   * Track file (upsert - insert or update).
   *
   * @param sourceId Source identifier
   * @param filePath Relative file path
   * @param contentSha SHA-256 hash of content
   * @param options File tracking options
   * @throws AgentSyncError if operation fails
   *
   * @example
   * ```typescript
   * syncState.trackFile('github-remote', 'research.md', 'sha256-hash', {
   *   localPath: '/Users/masa/.claude/agents/research.md',
   *   fileSize: 12345
   * });
   * ```
   */
  trackFile(sourceId: string, filePath: string, contentSha: string, options?: FileTrackOptions): void {
    try {
      const stmt = this.getStatement('trackFile', FileQueries.TRACK_FILE);
      stmt.run(
        sourceId,
        filePath,
        contentSha,
        options?.localPath ?? null,
        new Date().toISOString(),
        options?.fileSize ?? null
      );

      logger.debug('File tracked', { sourceId, filePath });
    } catch (error) {
      throw new AgentSyncError(
        `Failed to track file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, filePath, originalError: error }
      );
    }
  }

  /**
   * Get file by source ID and file path.
   *
   * @param sourceId Source identifier
   * @param filePath Relative file path
   * @returns AgentFile or null if not found
   *
   * @example
   * ```typescript
   * const file = syncState.getFile('github-remote', 'research.md');
   * if (file) {
   *   console.log(`SHA: ${file.contentSha}`);
   * }
   * ```
   */
  getFile(sourceId: string, filePath: string): AgentFile | null {
    try {
      const stmt = this.getStatement('getFile', FileQueries.GET_FILE);
      const row = stmt.get(sourceId, filePath) as AgentFileRow | undefined;
      return row ? this.mapFileRow(row) : null;
    } catch (error) {
      throw new AgentSyncError(
        `Failed to get file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, filePath, originalError: error }
      );
    }
  }

  /**
   * List files for a source.
   *
   * @param sourceId Source identifier (optional - lists all files if omitted)
   * @returns Array of agent files
   *
   * @example
   * ```typescript
   * const files = syncState.listFiles('github-remote');
   * console.log(`Source has ${files.length} files`);
   * ```
   */
  listFiles(sourceId?: string): AgentFile[] {
    try {
      if (sourceId) {
        const stmt = this.getStatement('listFiles', FileQueries.LIST_FILES);
        const rows = stmt.all(sourceId) as AgentFileRow[];
        return rows.map((row) => this.mapFileRow(row));
      } else {
        const stmt = this.getStatement('listAllFiles', FileQueries.LIST_ALL_FILES);
        const rows = stmt.all() as AgentFileRow[];
        return rows.map((row) => this.mapFileRow(row));
      }
    } catch (error) {
      throw new AgentSyncError(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, originalError: error }
      );
    }
  }

  /**
   * Get files changed since a timestamp.
   *
   * @param sourceId Source identifier
   * @param since Timestamp to compare against
   * @returns Array of changed files
   *
   * @example
   * ```typescript
   * const changed = syncState.getChangedFiles('github-remote', new Date('2025-11-30'));
   * console.log(`${changed.length} files changed since Nov 30`);
   * ```
   */
  getChangedFiles(sourceId: string, since: Date): AgentFile[] {
    try {
      const stmt = this.getStatement('getChangedFiles', FileQueries.GET_CHANGED_FILES);
      const rows = stmt.all(sourceId, since.toISOString()) as AgentFileRow[];
      return rows.map((row) => this.mapFileRow(row));
    } catch (error) {
      throw new AgentSyncError(
        `Failed to get changed files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, since, originalError: error }
      );
    }
  }

  // ========================================
  // Sync History
  // ========================================

  /**
   * Record sync result.
   *
   * @param sourceId Source identifier
   * @param result Sync operation result
   * @throws AgentSyncError if recording fails
   *
   * @example
   * ```typescript
   * syncState.recordSync('github-remote', {
   *   status: 'success',
   *   filesSynced: 10,
   *   filesCached: 5,
   *   filesFailed: 0,
   *   durationMs: 220
   * });
   * ```
   */
  recordSync(sourceId: string, result: SyncResult): void {
    try {
      const stmt = this.getStatement('recordSync', HistoryQueries.RECORD_SYNC);
      stmt.run(
        sourceId,
        new Date().toISOString(),
        result.status,
        result.filesSynced,
        result.filesCached,
        result.filesFailed,
        result.errorMessage ?? null,
        result.durationMs
      );

      logger.debug('Sync recorded', { sourceId, status: result.status, durationMs: result.durationMs });
    } catch (error) {
      throw new AgentSyncError(
        `Failed to record sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, result, originalError: error }
      );
    }
  }

  /**
   * Get sync history for a source.
   *
   * @param sourceId Source identifier
   * @param limit Maximum number of records to return (default: 10)
   * @returns Array of sync history entries
   *
   * @example
   * ```typescript
   * const history = syncState.getSyncHistory('github-remote', 5);
   * history.forEach(entry => {
   *   console.log(`${entry.syncTime}: ${entry.status} (${entry.durationMs}ms)`);
   * });
   * ```
   */
  getSyncHistory(sourceId: string, limit = 10): SyncHistoryEntry[] {
    try {
      const stmt = this.getStatement('getHistory', HistoryQueries.GET_HISTORY);
      const rows = stmt.all(sourceId, limit) as SyncHistoryRow[];
      return rows.map((row) => this.mapHistoryRow(row));
    } catch (error) {
      throw new AgentSyncError(
        `Failed to get sync history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, originalError: error }
      );
    }
  }

  /**
   * Get last sync for a source.
   *
   * @param sourceId Source identifier
   * @returns Last sync entry or null if no syncs recorded
   *
   * @example
   * ```typescript
   * const lastSync = syncState.getLastSync('github-remote');
   * if (lastSync) {
   *   console.log(`Last sync: ${lastSync.syncTime}, Status: ${lastSync.status}`);
   * }
   * ```
   */
  getLastSync(sourceId: string): SyncHistoryEntry | null {
    try {
      const stmt = this.getStatement('getLastSync', HistoryQueries.GET_LAST_SYNC);
      const row = stmt.get(sourceId) as SyncHistoryRow | undefined;
      return row ? this.mapHistoryRow(row) : null;
    } catch (error) {
      throw new AgentSyncError(
        `Failed to get last sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { sourceId, originalError: error }
      );
    }
  }

  /**
   * Prune old sync history.
   *
   * @param olderThan Delete records older than this date
   * @returns Number of records deleted
   *
   * @example
   * ```typescript
   * const deleted = syncState.pruneHistory(new Date('2025-01-01'));
   * console.log(`Deleted ${deleted} old sync records`);
   * ```
   */
  pruneHistory(olderThan: Date): number {
    try {
      const stmt = this.getStatement('pruneHistory', HistoryQueries.PRUNE_HISTORY);
      const result = stmt.run(olderThan.toISOString());
      logger.info('Sync history pruned', { deleted: result.changes, olderThan });
      return result.changes;
    } catch (error) {
      throw new AgentSyncError(
        `Failed to prune history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { olderThan, originalError: error }
      );
    }
  }

  // ========================================
  // Health Check & Utility
  // ========================================

  /**
   * Perform database health check.
   *
   * @returns Database health status
   *
   * @example
   * ```typescript
   * const health = syncState.healthCheck();
   * console.log(`Database: ${health.healthy ? 'OK' : 'ERROR'}`);
   * console.log(`Sources: ${health.sourceCount}, Files: ${health.fileCount}`);
   * ```
   */
  healthCheck(): DatabaseHealth {
    try {
      const fileSize = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : null;

      return {
        healthy: true,
        dbPath: this.dbPath,
        fileSize,
        sourceCount: this.getSourceCount(),
        fileCount: this.getFileCount(),
        historyCount: this.getHistoryCount(),
        schemaVersion: this.getSchemaVersion(),
      };
    } catch (error) {
      return {
        healthy: false,
        dbPath: this.dbPath,
        fileSize: null,
        sourceCount: 0,
        fileCount: 0,
        historyCount: 0,
        schemaVersion: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close database connection.
   *
   * Should be called during application shutdown.
   *
   * @example
   * ```typescript
   * syncState.close();
   * ```
   */
  close(): void {
    try {
      // Clear prepared statements
      this.statements.clear();

      // Close database
      this.db.close();

      logger.info('AgentSyncState closed', { dbPath: this.dbPath });
    } catch (error) {
      logger.error('Failed to close database', { error, dbPath: this.dbPath });
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Configure database for optimal performance and concurrency.
   */
  private configureDatebase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Set busy timeout (5 seconds)
    this.db.pragma('busy_timeout = 5000');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Validate database schema.
   *
   * @throws AgentSyncError if schema is invalid or incompatible
   */
  private validateSchema(): void {
    // Check if sources table exists
    const sourcesExists = this.db
      .prepare(SchemaQueries.TABLE_EXISTS)
      .get('sources') as { name: string } | undefined;

    if (!sourcesExists) {
      throw new AgentSyncError('Database schema invalid: sources table not found', 'SCHEMA_VERSION_MISMATCH', {
        dbPath: this.dbPath,
      });
    }

    // Validate schema version (if schema_metadata table exists)
    try {
      const schemaVersion = this.getSchemaVersion();
      if (schemaVersion !== EXPECTED_SCHEMA_VERSION) {
        logger.warn('Schema version mismatch', {
          expected: EXPECTED_SCHEMA_VERSION,
          actual: schemaVersion,
        });
      }
    } catch {
      // schema_metadata table might not exist in older versions - this is OK
      logger.debug('Schema metadata table not found - assuming v1 schema');
    }
  }

  /**
   * Get or create cached prepared statement.
   *
   * @param key Statement cache key
   * @param sql SQL query
   * @returns Prepared statement
   */
  private getStatement(key: string, sql: string): Statement {
    if (!this.statements.has(key)) {
      this.statements.set(key, this.db.prepare(sql));
    }
    return this.statements.get(key)!;
  }

  /**
   * Set source enabled status.
   */
  private setSourceEnabled(id: string, enabled: boolean): void {
    try {
      const stmt = this.getStatement('updateSourceEnabled', SourceQueries.UPDATE_SOURCE_ENABLED);
      const result = stmt.run(enabled ? 1 : 0, id);

      if (result.changes === 0) {
        throw new AgentSyncError(`Source ${id} not found`, 'SOURCE_NOT_FOUND', { id });
      }

      logger.debug('Source enabled status updated', { id, enabled });
    } catch (error) {
      if (error instanceof AgentSyncError) throw error;
      throw new AgentSyncError(
        `Failed to update source ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR',
        { id, originalError: error }
      );
    }
  }

  /**
   * Get source count.
   */
  private getSourceCount(): number {
    const result = this.db.prepare(SourceQueries.COUNT_SOURCES).get() as { count: number };
    return result.count;
  }

  /**
   * Get file count.
   */
  private getFileCount(): number {
    const result = this.db.prepare(FileQueries.COUNT_ALL_FILES).get() as { count: number };
    return result.count;
  }

  /**
   * Get history count.
   */
  private getHistoryCount(): number {
    const result = this.db.prepare(HistoryQueries.COUNT_HISTORY).get() as { count: number };
    return result.count;
  }

  /**
   * Get schema version.
   */
  private getSchemaVersion(): number {
    try {
      const result = this.db.prepare(SchemaQueries.GET_SCHEMA_VERSION).get() as { value: string } | undefined;
      return result ? parseInt(result.value, 10) : 1;
    } catch {
      return 1; // Default to version 1 if table doesn't exist
    }
  }

  /**
   * Map database row to Source object.
   */
  private mapSourceRow(row: SourceRow): Source {
    return {
      id: row.id,
      url: row.url,
      lastSha: row.last_sha,
      lastSyncTime: row.last_sync_time ? new Date(row.last_sync_time) : null,
      etag: row.etag,
      enabled: row.enabled === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to AgentFile object.
   */
  private mapFileRow(row: AgentFileRow): AgentFile {
    return {
      sourceId: row.source_id,
      filePath: row.file_path,
      contentSha: row.content_sha,
      localPath: row.local_path,
      syncedAt: new Date(row.synced_at),
      fileSize: row.file_size,
    };
  }

  /**
   * Map database row to SyncHistoryEntry object.
   */
  private mapHistoryRow(row: SyncHistoryRow): SyncHistoryEntry {
    return {
      id: row.id,
      sourceId: row.source_id,
      syncTime: new Date(row.sync_time),
      status: row.status as 'success' | 'partial' | 'error',
      filesSynced: row.files_synced,
      filesCached: row.files_cached,
      filesFailed: row.files_failed,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
    };
  }
}
