/**
 * Unit tests for AgentSyncState service.
 *
 * Coverage Target: 85%+
 * Testing Strategy: Use temporary test databases for isolation
 *
 * Related Ticket: 1M-388 - Implement SQLite State Tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentSyncState, AgentSyncError } from '../../../../src/services/agent-sync/index.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';

describe('AgentSyncState', () => {
  let syncState: AgentSyncState;
  let testDbPath: string;

  beforeEach(() => {
    // Create temporary test database
    testDbPath = path.join(os.tmpdir(), `test-agent-sync-${Date.now()}.db`);

    // Initialize database with schema
    const db = new Database(testDbPath);

    // Create tables
    db.exec(`
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        last_sha TEXT,
        last_sync_time TEXT,
        etag TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE agent_files (
        source_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_sha TEXT NOT NULL,
        local_path TEXT,
        synced_at TEXT NOT NULL,
        file_size INTEGER,
        PRIMARY KEY (source_id, file_path),
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      );

      CREATE TABLE sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        sync_time TEXT NOT NULL,
        status TEXT NOT NULL,
        files_synced INTEGER DEFAULT 0,
        files_cached INTEGER DEFAULT 0,
        files_failed INTEGER DEFAULT 0,
        error_message TEXT,
        duration_ms INTEGER,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      );

      CREATE TABLE schema_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '1');

      CREATE INDEX idx_agent_files_source ON agent_files(source_id);
      CREATE INDEX idx_agent_files_path ON agent_files(file_path);
      CREATE INDEX idx_sync_history_source_time ON sync_history(source_id, sync_time DESC);
      CREATE INDEX idx_sync_history_status ON sync_history(status);
    `);

    db.close();

    // Create AgentSyncState instance
    syncState = new AgentSyncState(testDbPath);
  });

  afterEach(() => {
    // Close database connection
    syncState.close();

    // Delete test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Constructor', () => {
    it('should create instance with default database path', () => {
      expect(syncState).toBeDefined();
    });

    it('should throw error if database does not exist', () => {
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-db.db');
      expect(() => new AgentSyncState(nonExistentPath)).toThrow(AgentSyncError);
    });

    it('should throw DATABASE_NOT_FOUND error with correct code', () => {
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-db.db');
      try {
        new AgentSyncState(nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(AgentSyncError);
        expect((error as AgentSyncError).code).toBe('DATABASE_NOT_FOUND');
      }
    });
  });

  describe('Source Management', () => {
    describe('addSource', () => {
      it('should add source successfully', () => {
        syncState.addSource('test-source', 'https://example.com/agents');
        const source = syncState.getSource('test-source');

        expect(source).toBeDefined();
        expect(source?.id).toBe('test-source');
        expect(source?.url).toBe('https://example.com/agents');
        expect(source?.enabled).toBe(true);
        expect(source?.lastSha).toBeNull();
        expect(source?.lastSyncTime).toBeNull();
        expect(source?.etag).toBeNull();
      });

      it('should add source with options', () => {
        syncState.addSource('test-source', 'https://example.com/agents', {
          enabled: false,
          etag: 'W/"etag-value"',
          lastSha: 'abc123sha',
        });

        const source = syncState.getSource('test-source');
        expect(source?.enabled).toBe(false);
        expect(source?.etag).toBe('W/"etag-value"');
        expect(source?.lastSha).toBe('abc123sha');
      });

      it('should throw error if source already exists', () => {
        syncState.addSource('test-source', 'https://example.com/agents');
        expect(() => syncState.addSource('test-source', 'https://example.com/agents')).toThrow(AgentSyncError);
      });
    });

    describe('getSource', () => {
      it('should return null for non-existent source', () => {
        const source = syncState.getSource('non-existent');
        expect(source).toBeNull();
      });

      it('should return source by ID', () => {
        syncState.addSource('test-source', 'https://example.com/agents');
        const source = syncState.getSource('test-source');

        expect(source).toBeDefined();
        expect(source?.id).toBe('test-source');
      });
    });

    describe('listSources', () => {
      it('should return empty array when no sources exist', () => {
        const sources = syncState.listSources();
        expect(sources).toEqual([]);
      });

      it('should list all sources', () => {
        syncState.addSource('source1', 'https://example.com/1');
        syncState.addSource('source2', 'https://example.com/2');
        syncState.addSource('source3', 'https://example.com/3');

        const sources = syncState.listSources();
        expect(sources).toHaveLength(3);
        expect(sources.map((s) => s.id)).toContain('source1');
        expect(sources.map((s) => s.id)).toContain('source2');
        expect(sources.map((s) => s.id)).toContain('source3');
      });

      it('should list only enabled sources when enabledOnly=true', () => {
        syncState.addSource('enabled1', 'https://example.com/1', { enabled: true });
        syncState.addSource('disabled1', 'https://example.com/2', { enabled: false });
        syncState.addSource('enabled2', 'https://example.com/3', { enabled: true });

        const sources = syncState.listSources(true);
        expect(sources).toHaveLength(2);
        expect(sources.map((s) => s.id)).toContain('enabled1');
        expect(sources.map((s) => s.id)).toContain('enabled2');
        expect(sources.map((s) => s.id)).not.toContain('disabled1');
      });
    });

    describe('updateSourceSyncTime', () => {
      it('should update source sync metadata', () => {
        syncState.addSource('test-source', 'https://example.com/agents');

        syncState.updateSourceSyncTime('test-source', 'abc123sha', 'W/"etag-value"');

        const source = syncState.getSource('test-source');
        expect(source?.lastSha).toBe('abc123sha');
        expect(source?.etag).toBe('W/"etag-value"');
        expect(source?.lastSyncTime).not.toBeNull();
      });

      it('should throw error if source does not exist', () => {
        expect(() => syncState.updateSourceSyncTime('non-existent', 'abc123sha')).toThrow(AgentSyncError);
      });

      it('should throw SOURCE_NOT_FOUND error with correct code', () => {
        try {
          syncState.updateSourceSyncTime('non-existent', 'abc123sha');
        } catch (error) {
          expect(error).toBeInstanceOf(AgentSyncError);
          expect((error as AgentSyncError).code).toBe('SOURCE_NOT_FOUND');
        }
      });
    });

    describe('enableSource / disableSource', () => {
      it('should disable source', () => {
        syncState.addSource('test-source', 'https://example.com/agents');
        syncState.disableSource('test-source');

        const source = syncState.getSource('test-source');
        expect(source?.enabled).toBe(false);
      });

      it('should enable source', () => {
        syncState.addSource('test-source', 'https://example.com/agents', { enabled: false });
        syncState.enableSource('test-source');

        const source = syncState.getSource('test-source');
        expect(source?.enabled).toBe(true);
      });

      it('should throw error if source does not exist', () => {
        expect(() => syncState.disableSource('non-existent')).toThrow(AgentSyncError);
        expect(() => syncState.enableSource('non-existent')).toThrow(AgentSyncError);
      });
    });

    describe('removeSource', () => {
      it('should remove source', () => {
        syncState.addSource('test-source', 'https://example.com/agents');
        syncState.removeSource('test-source');

        const source = syncState.getSource('test-source');
        expect(source).toBeNull();
      });

      it('should cascade delete to agent_files and sync_history', () => {
        syncState.addSource('test-source', 'https://example.com/agents');
        syncState.trackFile('test-source', 'test.md', 'sha256-hash');
        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 1,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 100,
        });

        syncState.removeSource('test-source');

        expect(syncState.getFile('test-source', 'test.md')).toBeNull();
        expect(syncState.getSyncHistory('test-source')).toEqual([]);
      });

      it('should throw error if source does not exist', () => {
        expect(() => syncState.removeSource('non-existent')).toThrow(AgentSyncError);
      });
    });
  });

  describe('File Tracking', () => {
    beforeEach(() => {
      // Add test source
      syncState.addSource('test-source', 'https://example.com/agents');
    });

    describe('trackFile', () => {
      it('should track file successfully', () => {
        syncState.trackFile('test-source', 'research.md', 'sha256-hash', {
          localPath: '/tmp/research.md',
          fileSize: 12345,
        });

        const file = syncState.getFile('test-source', 'research.md');
        expect(file).toBeDefined();
        expect(file?.filePath).toBe('research.md');
        expect(file?.contentSha).toBe('sha256-hash');
        expect(file?.localPath).toBe('/tmp/research.md');
        expect(file?.fileSize).toBe(12345);
      });

      it('should track file without options', () => {
        syncState.trackFile('test-source', 'research.md', 'sha256-hash');

        const file = syncState.getFile('test-source', 'research.md');
        expect(file).toBeDefined();
        expect(file?.localPath).toBeNull();
        expect(file?.fileSize).toBeNull();
      });

      it('should update existing file (upsert)', () => {
        syncState.trackFile('test-source', 'research.md', 'sha256-old');
        syncState.trackFile('test-source', 'research.md', 'sha256-new');

        const file = syncState.getFile('test-source', 'research.md');
        expect(file?.contentSha).toBe('sha256-new');
      });
    });

    describe('getFile', () => {
      it('should return null for non-existent file', () => {
        const file = syncState.getFile('test-source', 'non-existent.md');
        expect(file).toBeNull();
      });

      it('should return file by source ID and path', () => {
        syncState.trackFile('test-source', 'research.md', 'sha256-hash');
        const file = syncState.getFile('test-source', 'research.md');

        expect(file).toBeDefined();
        expect(file?.filePath).toBe('research.md');
      });
    });

    describe('listFiles', () => {
      it('should return empty array when no files exist', () => {
        const files = syncState.listFiles('test-source');
        expect(files).toEqual([]);
      });

      it('should list files for a source', () => {
        syncState.trackFile('test-source', 'file1.md', 'sha1');
        syncState.trackFile('test-source', 'file2.md', 'sha2');
        syncState.trackFile('test-source', 'file3.md', 'sha3');

        const files = syncState.listFiles('test-source');
        expect(files).toHaveLength(3);
        expect(files.map((f) => f.filePath)).toContain('file1.md');
        expect(files.map((f) => f.filePath)).toContain('file2.md');
        expect(files.map((f) => f.filePath)).toContain('file3.md');
      });

      it('should list all files across sources when sourceId omitted', () => {
        syncState.addSource('source2', 'https://example.com/2');

        syncState.trackFile('test-source', 'file1.md', 'sha1');
        syncState.trackFile('source2', 'file2.md', 'sha2');

        const files = syncState.listFiles();
        expect(files).toHaveLength(2);
      });
    });

    describe('getChangedFiles', () => {
      it('should return files changed since timestamp', () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        syncState.trackFile('test-source', 'old-file.md', 'sha1');

        // Wait a bit to ensure timestamp difference
        const changedFiles = syncState.getChangedFiles('test-source', yesterday);
        expect(changedFiles).toHaveLength(1);
        expect(changedFiles[0].filePath).toBe('old-file.md');
      });

      it('should return empty array if no files changed', () => {
        const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
        syncState.trackFile('test-source', 'file.md', 'sha1');

        const changedFiles = syncState.getChangedFiles('test-source', future);
        expect(changedFiles).toEqual([]);
      });
    });
  });

  describe('Sync History', () => {
    beforeEach(() => {
      syncState.addSource('test-source', 'https://example.com/agents');
    });

    describe('recordSync', () => {
      it('should record sync result', () => {
        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 10,
          filesCached: 5,
          filesFailed: 0,
          durationMs: 220,
        });

        const history = syncState.getSyncHistory('test-source');
        expect(history).toHaveLength(1);
        expect(history[0].status).toBe('success');
        expect(history[0].filesSynced).toBe(10);
        expect(history[0].filesCached).toBe(5);
        expect(history[0].durationMs).toBe(220);
      });

      it('should record sync with error message', () => {
        syncState.recordSync('test-source', {
          status: 'error',
          filesSynced: 0,
          filesCached: 0,
          filesFailed: 10,
          errorMessage: 'Network error',
          durationMs: 100,
        });

        const history = syncState.getSyncHistory('test-source');
        expect(history[0].errorMessage).toBe('Network error');
      });
    });

    describe('getSyncHistory', () => {
      it('should return empty array when no history exists', () => {
        const history = syncState.getSyncHistory('test-source');
        expect(history).toEqual([]);
      });

      it('should return sync history with limit', () => {
        // Record multiple syncs
        for (let i = 0; i < 20; i++) {
          syncState.recordSync('test-source', {
            status: 'success',
            filesSynced: i,
            filesCached: 0,
            filesFailed: 0,
            durationMs: 100,
          });
        }

        const history = syncState.getSyncHistory('test-source', 5);
        expect(history).toHaveLength(5);
      });

      it('should return history in descending order (newest first)', () => {
        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 1,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 100,
        });

        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 2,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 200,
        });

        const history = syncState.getSyncHistory('test-source');
        expect(history[0].filesSynced).toBe(2); // Most recent first
        expect(history[1].filesSynced).toBe(1);
      });
    });

    describe('getLastSync', () => {
      it('should return null when no syncs exist', () => {
        const lastSync = syncState.getLastSync('test-source');
        expect(lastSync).toBeNull();
      });

      it('should return most recent sync', () => {
        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 1,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 100,
        });

        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 2,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 200,
        });

        const lastSync = syncState.getLastSync('test-source');
        expect(lastSync?.filesSynced).toBe(2);
      });
    });

    describe('pruneHistory', () => {
      it('should delete old sync records', () => {
        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 1,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 100,
        });

        const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const deleted = syncState.pruneHistory(future);

        expect(deleted).toBe(1);
        expect(syncState.getSyncHistory('test-source')).toEqual([]);
      });

      it('should not delete recent records', () => {
        syncState.recordSync('test-source', {
          status: 'success',
          filesSynced: 1,
          filesCached: 0,
          filesFailed: 0,
          durationMs: 100,
        });

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deleted = syncState.pruneHistory(yesterday);

        expect(deleted).toBe(0);
        expect(syncState.getSyncHistory('test-source')).toHaveLength(1);
      });
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', () => {
      const health = syncState.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.dbPath).toBe(testDbPath);
      expect(health.fileSize).toBeGreaterThan(0);
      expect(health.sourceCount).toBe(0);
      expect(health.fileCount).toBe(0);
      expect(health.historyCount).toBe(0);
      expect(health.schemaVersion).toBe(1);
    });

    it('should include counts after adding data', () => {
      syncState.addSource('test-source', 'https://example.com/agents');
      syncState.trackFile('test-source', 'file.md', 'sha1');
      syncState.recordSync('test-source', {
        status: 'success',
        filesSynced: 1,
        filesCached: 0,
        filesFailed: 0,
        durationMs: 100,
      });

      const health = syncState.healthCheck();
      expect(health.sourceCount).toBe(1);
      expect(health.fileCount).toBe(1);
      expect(health.historyCount).toBe(1);
    });
  });

  describe('Close', () => {
    it('should close database connection without error', () => {
      expect(() => syncState.close()).not.toThrow();
    });

    it('should be idempotent (safe to call multiple times)', () => {
      syncState.close();
      expect(() => syncState.close()).not.toThrow();
    });
  });
});
