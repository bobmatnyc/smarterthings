/**
 * Type definitions for AgentSyncState service.
 *
 * These types map to the SQLite database schema at ~/.config/claude-mpm/agent_sync.db
 * Schema is defined and managed by Claude MPM Python backend.
 *
 * Related Ticket: 1M-388 - Implement SQLite State Tracking
 * Parent Ticket: 1M-382 - Migrate Agent System to Git-Based Markdown Repository
 *
 * @module services/agent-sync/types
 */

/**
 * Source - Represents an agent repository source.
 *
 * Maps to sources table in database.
 * Sources can be GitHub URLs, local file paths, or other agent repositories.
 */
export interface Source {
  /** Unique identifier for source */
  id: string;

  /** Source URL or file path */
  url: string;

  /** Last synced commit SHA (for git sources) */
  lastSha: string | null;

  /** Last sync timestamp (ISO 8601) */
  lastSyncTime: Date | null;

  /** HTTP ETag for cache validation */
  etag: string | null;

  /** Whether source is enabled (true) or disabled (false) */
  enabled: boolean;

  /** Source creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Database row format for sources table.
 *
 * Uses snake_case to match SQLite schema exactly.
 */
export interface SourceRow {
  id: string;
  url: string;
  last_sha: string | null;
  last_sync_time: string | null;
  etag: string | null;
  enabled: number; // SQLite stores boolean as 0/1
  created_at: string;
  updated_at: string;
}

/**
 * AgentFile - Represents a tracked agent file from a source.
 *
 * Maps to agent_files table in database.
 * Tracks per-file metadata and content hashes for change detection.
 */
export interface AgentFile {
  /** Source ID this file belongs to */
  sourceId: string;

  /** Relative file path (e.g., "research.md") */
  filePath: string;

  /** SHA-256 hash of file content */
  contentSha: string;

  /** Absolute path to cached local file */
  localPath: string | null;

  /** Last sync timestamp */
  syncedAt: Date;

  /** File size in bytes */
  fileSize: number | null;
}

/**
 * Database row format for agent_files table.
 *
 * Uses snake_case to match SQLite schema exactly.
 */
export interface AgentFileRow {
  source_id: string;
  file_path: string;
  content_sha: string;
  local_path: string | null;
  synced_at: string;
  file_size: number | null;
}

/**
 * SyncHistoryEntry - Represents a sync operation audit record.
 *
 * Maps to sync_history table in database.
 * Provides audit trail and performance metrics for sync operations.
 */
export interface SyncHistoryEntry {
  /** Auto-increment ID */
  id: number;

  /** Source ID that was synced */
  sourceId: string;

  /** Sync operation timestamp */
  syncTime: Date;

  /** Operation status */
  status: SyncStatus;

  /** Number of files downloaded */
  filesSynced: number;

  /** Number of cache hits */
  filesCached: number;

  /** Number of failed downloads */
  filesFailed: number;

  /** Error message if status is 'error' */
  errorMessage: string | null;

  /** Sync duration in milliseconds */
  durationMs: number | null;
}

/**
 * Database row format for sync_history table.
 *
 * Uses snake_case to match SQLite schema exactly.
 */
export interface SyncHistoryRow {
  id: number;
  source_id: string;
  sync_time: string;
  status: string;
  files_synced: number;
  files_cached: number;
  files_failed: number;
  error_message: string | null;
  duration_ms: number | null;
}

/**
 * Sync operation status.
 */
export type SyncStatus = 'success' | 'partial' | 'error';

/**
 * Sync result - Input for recording sync operations.
 *
 * Simplified interface for creating sync history records.
 */
export interface SyncResult {
  /** Operation status */
  status: SyncStatus;

  /** Number of files downloaded */
  filesSynced: number;

  /** Number of cache hits */
  filesCached: number;

  /** Number of failed downloads */
  filesFailed: number;

  /** Error message if status is 'error' */
  errorMessage?: string;

  /** Sync duration in milliseconds */
  durationMs: number;
}

/**
 * Options for adding a new source.
 */
export interface SourceOptions {
  /** Whether source is enabled */
  enabled?: boolean;

  /** Initial ETag value */
  etag?: string | null;

  /** Initial commit SHA */
  lastSha?: string | null;
}

/**
 * Options for tracking a file.
 */
export interface FileTrackOptions {
  /** Absolute path to cached local file */
  localPath?: string | null;

  /** File size in bytes */
  fileSize?: number | null;
}

/**
 * Database health check result.
 */
export interface DatabaseHealth {
  /** Whether database is accessible and schema is valid */
  healthy: boolean;

  /** Database file path */
  dbPath: string;

  /** Database file size in bytes */
  fileSize: number | null;

  /** Number of sources configured */
  sourceCount: number;

  /** Number of tracked files */
  fileCount: number;

  /** Number of sync history records */
  historyCount: number;

  /** Schema version */
  schemaVersion: number;

  /** Error message if unhealthy */
  errorMessage?: string;
}

/**
 * Custom error class for agent sync operations.
 */
export class AgentSyncError extends Error {
  constructor(
    message: string,
    public readonly code: AgentSyncErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentSyncError';
  }
}

/**
 * Error codes for agent sync operations.
 */
export type AgentSyncErrorCode =
  | 'DATABASE_ERROR' // Database operation failed
  | 'DATABASE_NOT_FOUND' // Database file doesn't exist
  | 'DATABASE_LOCKED' // Database is locked by another process
  | 'SCHEMA_VERSION_MISMATCH' // Schema version incompatible
  | 'SOURCE_NOT_FOUND' // Source doesn't exist
  | 'FILE_NOT_FOUND' // File doesn't exist
  | 'INVALID_INPUT' // Invalid input parameter
  | 'TRANSACTION_FAILED'; // Transaction rollback occurred
