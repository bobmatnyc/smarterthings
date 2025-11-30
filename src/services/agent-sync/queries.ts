/**
 * SQL query builders for AgentSyncState service.
 *
 * Provides type-safe SQL queries with prepared statement support.
 * All queries are designed for better-sqlite3 synchronous API.
 *
 * Related Ticket: 1M-388 - Implement SQLite State Tracking
 * Database: ~/.config/claude-mpm/agent_sync.db
 *
 * @module services/agent-sync/queries
 */

/**
 * Source management queries.
 */
export const SourceQueries = {
  /**
   * Get source by ID.
   */
  GET_SOURCE: `
    SELECT
      id,
      url,
      last_sha,
      last_sync_time,
      etag,
      enabled,
      created_at,
      updated_at
    FROM sources
    WHERE id = ?
  `,

  /**
   * List all sources.
   */
  LIST_SOURCES: `
    SELECT
      id,
      url,
      last_sha,
      last_sync_time,
      etag,
      enabled,
      created_at,
      updated_at
    FROM sources
    ORDER BY created_at DESC
  `,

  /**
   * List enabled sources only.
   */
  LIST_ENABLED_SOURCES: `
    SELECT
      id,
      url,
      last_sha,
      last_sync_time,
      etag,
      enabled,
      created_at,
      updated_at
    FROM sources
    WHERE enabled = 1
    ORDER BY created_at DESC
  `,

  /**
   * Add new source.
   */
  ADD_SOURCE: `
    INSERT INTO sources (
      id,
      url,
      enabled,
      etag,
      last_sha,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `,

  /**
   * Update source sync metadata.
   */
  UPDATE_SOURCE_SYNC: `
    UPDATE sources
    SET
      last_sha = ?,
      last_sync_time = ?,
      etag = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  /**
   * Update source enabled status.
   */
  UPDATE_SOURCE_ENABLED: `
    UPDATE sources
    SET
      enabled = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  /**
   * Delete source (cascades to agent_files and sync_history).
   */
  DELETE_SOURCE: `
    DELETE FROM sources
    WHERE id = ?
  `,

  /**
   * Count sources.
   */
  COUNT_SOURCES: `
    SELECT COUNT(*) as count
    FROM sources
  `,
} as const;

/**
 * Agent file tracking queries.
 */
export const FileQueries = {
  /**
   * Get file by source ID and file path.
   */
  GET_FILE: `
    SELECT
      source_id,
      file_path,
      content_sha,
      local_path,
      synced_at,
      file_size
    FROM agent_files
    WHERE source_id = ? AND file_path = ?
  `,

  /**
   * List all files for a source.
   */
  LIST_FILES: `
    SELECT
      source_id,
      file_path,
      content_sha,
      local_path,
      synced_at,
      file_size
    FROM agent_files
    WHERE source_id = ?
    ORDER BY file_path ASC
  `,

  /**
   * List all files (across all sources).
   */
  LIST_ALL_FILES: `
    SELECT
      source_id,
      file_path,
      content_sha,
      local_path,
      synced_at,
      file_size
    FROM agent_files
    ORDER BY source_id ASC, file_path ASC
  `,

  /**
   * Track file (upsert - insert or update).
   */
  TRACK_FILE: `
    INSERT INTO agent_files (
      source_id,
      file_path,
      content_sha,
      local_path,
      synced_at,
      file_size
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, file_path)
    DO UPDATE SET
      content_sha = excluded.content_sha,
      local_path = excluded.local_path,
      synced_at = excluded.synced_at,
      file_size = excluded.file_size
  `,

  /**
   * Delete file.
   */
  DELETE_FILE: `
    DELETE FROM agent_files
    WHERE source_id = ? AND file_path = ?
  `,

  /**
   * Delete all files for a source.
   */
  DELETE_SOURCE_FILES: `
    DELETE FROM agent_files
    WHERE source_id = ?
  `,

  /**
   * Count files for a source.
   */
  COUNT_FILES: `
    SELECT COUNT(*) as count
    FROM agent_files
    WHERE source_id = ?
  `,

  /**
   * Count all files.
   */
  COUNT_ALL_FILES: `
    SELECT COUNT(*) as count
    FROM agent_files
  `,

  /**
   * Get files changed since a timestamp.
   */
  GET_CHANGED_FILES: `
    SELECT
      source_id,
      file_path,
      content_sha,
      local_path,
      synced_at,
      file_size
    FROM agent_files
    WHERE source_id = ? AND synced_at > ?
    ORDER BY synced_at DESC
  `,
} as const;

/**
 * Sync history queries.
 */
export const HistoryQueries = {
  /**
   * Record sync result.
   */
  RECORD_SYNC: `
    INSERT INTO sync_history (
      source_id,
      sync_time,
      status,
      files_synced,
      files_cached,
      files_failed,
      error_message,
      duration_ms
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,

  /**
   * Get sync history for a source.
   */
  GET_HISTORY: `
    SELECT
      id,
      source_id,
      sync_time,
      status,
      files_synced,
      files_cached,
      files_failed,
      error_message,
      duration_ms
    FROM sync_history
    WHERE source_id = ?
    ORDER BY sync_time DESC, id DESC
    LIMIT ?
  `,

  /**
   * Get last sync for a source.
   */
  GET_LAST_SYNC: `
    SELECT
      id,
      source_id,
      sync_time,
      status,
      files_synced,
      files_cached,
      files_failed,
      error_message,
      duration_ms
    FROM sync_history
    WHERE source_id = ?
    ORDER BY sync_time DESC, id DESC
    LIMIT 1
  `,

  /**
   * Get all sync history (across all sources).
   */
  GET_ALL_HISTORY: `
    SELECT
      id,
      source_id,
      sync_time,
      status,
      files_synced,
      files_cached,
      files_failed,
      error_message,
      duration_ms
    FROM sync_history
    ORDER BY sync_time DESC
    LIMIT ?
  `,

  /**
   * Prune old sync history.
   */
  PRUNE_HISTORY: `
    DELETE FROM sync_history
    WHERE sync_time < ?
  `,

  /**
   * Count sync history records.
   */
  COUNT_HISTORY: `
    SELECT COUNT(*) as count
    FROM sync_history
  `,

  /**
   * Count history for a source.
   */
  COUNT_SOURCE_HISTORY: `
    SELECT COUNT(*) as count
    FROM sync_history
    WHERE source_id = ?
  `,

  /**
   * Get sync statistics for a source.
   */
  GET_SYNC_STATS: `
    SELECT
      COUNT(*) as total_syncs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_syncs,
      AVG(duration_ms) as avg_duration_ms,
      MAX(sync_time) as last_sync_time
    FROM sync_history
    WHERE source_id = ?
  `,
} as const;

/**
 * Schema metadata queries.
 */
export const SchemaQueries = {
  /**
   * Get schema version.
   */
  GET_SCHEMA_VERSION: `
    SELECT value
    FROM schema_metadata
    WHERE key = 'schema_version'
  `,

  /**
   * Set schema version.
   */
  SET_SCHEMA_VERSION: `
    INSERT OR REPLACE INTO schema_metadata (key, value)
    VALUES ('schema_version', ?)
  `,

  /**
   * Check if sources table exists.
   */
  TABLE_EXISTS: `
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `,
} as const;

/**
 * Database maintenance queries.
 */
export const MaintenanceQueries = {
  /**
   * Enable WAL mode for better concurrency.
   */
  ENABLE_WAL: `PRAGMA journal_mode=WAL`,

  /**
   * Set busy timeout (milliseconds).
   */
  SET_BUSY_TIMEOUT: `PRAGMA busy_timeout = ?`,

  /**
   * Vacuum database to reclaim space.
   */
  VACUUM: `VACUUM`,

  /**
   * Analyze database for query optimization.
   */
  ANALYZE: `ANALYZE`,

  /**
   * Get database file size.
   */
  GET_PAGE_COUNT: `PRAGMA page_count`,
  GET_PAGE_SIZE: `PRAGMA page_size`,
} as const;
