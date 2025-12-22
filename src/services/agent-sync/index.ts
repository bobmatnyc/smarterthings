/**
 * Agent synchronization state tracking service.
 *
 * Provides TypeScript/Node.js interface to SQLite database for agent sync state management.
 * Database managed by Claude MPM Python backend at ~/.config/claude-mpm/agent_sync.db
 *
 * Related Ticket: 1M-388 - Implement SQLite State Tracking
 * Parent Ticket: 1M-382 - Migrate Agent System to Git-Based Markdown Repository
 *
 * @module services/agent-sync
 */

// Main service class
export { AgentSyncState } from './AgentSyncState.js';

// Type definitions
export type {
  Source,
  SourceRow,
  AgentFile,
  AgentFileRow,
  SyncHistoryEntry,
  SyncHistoryRow,
  SyncStatus,
  SyncResult,
  SourceOptions,
  FileTrackOptions,
  DatabaseHealth,
  AgentSyncErrorCode,
} from './types.js';

// Error class
export { AgentSyncError } from './types.js';

// SQL queries (exported for testing and debugging)
export {
  SourceQueries,
  FileQueries,
  HistoryQueries,
  SchemaQueries,
  MaintenanceQueries,
} from './queries.js';
