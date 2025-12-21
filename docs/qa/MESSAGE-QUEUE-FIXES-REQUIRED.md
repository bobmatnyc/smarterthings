# Message Queue & Events UI - Required Fixes

**Status:** 🔴 **DEPLOYMENT BLOCKED**
**Priority:** CRITICAL
**Estimated Effort:** 7-11 hours

---

## 🚨 Critical Blocker: Incorrect plainjob Usage

### Problem

`src/queue/MessageQueue.ts` attempts to instantiate `Job` as a class, but plainjob doesn't export a `Job` class.

**Current Code (WRONG):**
```typescript
import { Job } from 'plainjob';  // ❌ Job is a TYPE, not a class
const job = new Job();           // ❌ ERROR: Cannot instantiate type
```

**Error:**
```
src/queue/MessageQueue.ts(26,1): error TS6133: 'Job' is declared but its value is never read.
src/queue/MessageQueue.ts(32,17): error TS2693: 'Job' only refers to a type, but is being used as a value here.
```

### Solution

Use `defineQueue()` and `defineWorker()` functions per plainjob documentation.

**Correct Implementation:**

```typescript
import { defineQueue, defineWorker, better, type Queue, type Worker } from 'plainjob';
import Database from 'better-sqlite3';
import { resolve } from 'path';
import logger from '../utils/logger.js';
import type { DeviceId, LocationId } from '../types/smartthings.js';

// Custom logger adapter for plainjob
const plainjobLogger = {
  error: (msg: string, ...meta: unknown[]) => logger.error(`[plainjob] ${msg}`, meta),
  warn: (msg: string, ...meta: unknown[]) => logger.warn(`[plainjob] ${msg}`, meta),
  info: (msg: string, ...meta: unknown[]) => logger.info(`[plainjob] ${msg}`, meta),
  debug: (msg: string, ...meta: unknown[]) => logger.debug(`[plainjob] ${msg}`, meta),
};

export class MessageQueue {
  private config: MessageQueueConfig;
  private queue?: Queue;
  private workers: Map<SmartHomeEventType, Worker>;
  private handlers: Map<SmartHomeEventType, EventHandler>;
  private initialized: boolean;
  private db?: Database.Database;

  constructor(config?: Partial<MessageQueueConfig>) {
    this.config = {
      databasePath: config?.databasePath || resolve('./data/message-queue.db'),
      concurrency: config?.concurrency || 4,
      retryAttempts: config?.retryAttempts || 3,
      cleanupDays: config?.cleanupDays || 7,
    };

    this.workers = new Map();
    this.handlers = new Map();
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[MessageQueue] Already initialized');
      return;
    }

    try {
      logger.info('[MessageQueue] Initializing queue', {
        databasePath: this.config.databasePath,
        concurrency: this.config.concurrency,
      });

      // Create SQLite connection
      this.db = new Database(this.config.databasePath);
      const connection = better(this.db);

      // Define queue
      this.queue = defineQueue({
        connection,
        logger: plainjobLogger,
        timeout: 30 * 60 * 1000, // 30 minutes
        removeDoneJobsOlderThan: this.config.cleanupDays * 24 * 60 * 60 * 1000,
        removeFailedJobsOlderThan: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Start workers for registered handlers
      for (const [eventType, handler] of this.handlers.entries()) {
        await this.startWorker(eventType, handler);
      }

      this.initialized = true;

      logger.info('[MessageQueue] Initialized successfully', {
        handlers: Array.from(this.handlers.keys()),
      });
    } catch (error) {
      logger.error('[MessageQueue] Initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async startWorker(
    eventType: SmartHomeEventType,
    handler: EventHandler
  ): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const worker = defineWorker(
      eventType,
      async (job) => {
        logger.debug(`[MessageQueue] Processing ${eventType}`, {
          jobId: job.id,
        });

        try {
          // Parse event data
          const event = JSON.parse(job.data) as SmartHomeEvent;
          await handler(event);

          logger.debug(`[MessageQueue] Completed ${eventType}`, {
            jobId: job.id,
            eventId: event.id,
          });
        } catch (error) {
          logger.error(`[MessageQueue] Handler failed for ${eventType}`, {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error; // Re-throw to mark job as failed
        }
      },
      {
        queue: this.queue,
        pollIntervall: 1000, // Poll every second
        logger: plainjobLogger,
        onCompleted: (job) => {
          logger.debug(`[MessageQueue] Job completed`, { jobId: job.id, type: job.type });
        },
        onFailed: (job, error) => {
          logger.error(`[MessageQueue] Job failed`, { jobId: job.id, type: job.type, error });
        },
      }
    );

    // Start worker
    worker.start().catch((error) => {
      logger.error(`[MessageQueue] Worker crashed for ${eventType}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this.workers.set(eventType, worker);

    logger.info(`[MessageQueue] Worker started for ${eventType}`);
  }

  registerHandler(eventType: SmartHomeEventType, handler: EventHandler): void {
    if (this.handlers.has(eventType)) {
      logger.warn(`[MessageQueue] Overwriting handler for ${eventType}`);
    }

    this.handlers.set(eventType, handler);

    logger.debug(`[MessageQueue] Handler registered for ${eventType}`);

    // If already initialized, start worker immediately
    if (this.initialized && this.queue) {
      this.startWorker(eventType, handler).catch((error) => {
        logger.error(`[MessageQueue] Failed to start worker for ${eventType}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  async enqueue(eventType: SmartHomeEventType, event: SmartHomeEvent): Promise<void> {
    if (!this.initialized || !this.queue) {
      throw new Error('MessageQueue not initialized. Call initialize() first.');
    }

    try {
      logger.debug(`[MessageQueue] Enqueuing ${eventType}`, {
        eventId: event.id,
        deviceId: event.deviceId,
      });

      // Add job to queue
      this.queue.add(eventType, event);

      logger.debug(`[MessageQueue] Enqueued ${eventType}`, {
        eventId: event.id,
      });
    } catch (error) {
      logger.error(`[MessageQueue] Failed to enqueue ${eventType}`, {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getStats(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.initialized || !this.queue) {
      throw new Error('MessageQueue not initialized');
    }

    try {
      // Count jobs by status
      const pending = this.queue.countJobs({ status: 0 }); // JobStatus.Pending
      const active = this.queue.countJobs({ status: 1 }); // JobStatus.Processing
      const completed = this.queue.countJobs({ status: 2 }); // JobStatus.Done
      const failed = this.queue.countJobs({ status: 3 }); // JobStatus.Failed

      return { pending, active, completed, failed };
    } catch (error) {
      logger.error('[MessageQueue] Failed to get stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) {
      logger.warn('[MessageQueue] Not initialized, skipping close');
      return;
    }

    logger.info('[MessageQueue] Closing queue');

    try {
      // Stop all workers gracefully
      const stopPromises = Array.from(this.workers.values()).map((worker) => worker.stop());
      await Promise.all(stopPromises);

      // Close queue
      if (this.queue) {
        this.queue.close();
        this.queue = undefined;
      }

      // Close database
      if (this.db) {
        this.db.close();
        this.db = undefined;
      }

      this.initialized = false;
      this.workers.clear();

      logger.info('[MessageQueue] Closed successfully');
    } catch (error) {
      logger.error('[MessageQueue] Close failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
let queueInstance: MessageQueue | null = null;

export function getMessageQueue(): MessageQueue {
  if (!queueInstance) {
    queueInstance = new MessageQueue();
  }
  return queueInstance;
}
```

**Effort:** 4-6 hours (complete rewrite)

---

## 🔧 Fix #2: Branded Type Conversions

### Problem

`src/storage/event-store.ts:321-332` returns `string | undefined` but needs `DeviceId | undefined`.

**Current Code:**
```typescript
const events: SmartHomeEvent[] = rows.map((row) => ({
  id: row.id as EventId,
  type: row.type as any,               // ⚠️ Unsafe
  source: row.source as any,           // ⚠️ Unsafe
  deviceId: row.device_id || undefined,     // ❌ Type error
  locationId: row.location_id || undefined, // ❌ Type error
  // ...
}));
```

**Error:**
```
src/storage/event-store.ts(321,13): error TS2322: Type 'string | undefined' is not assignable to type 'DeviceId | undefined'.
```

### Solution

Cast strings to branded types after null check:

```typescript
const events: SmartHomeEvent[] = rows.map((row) => ({
  id: row.id as EventId,
  type: row.type as SmartHomeEventType,  // ✅ Proper enum cast
  source: row.source as EventSource,     // ✅ Proper enum cast
  deviceId: row.device_id ? (row.device_id as DeviceId) : undefined,  // ✅ Fixed
  deviceName: row.device_name || undefined,
  locationId: row.location_id ? (row.location_id as LocationId) : undefined,  // ✅ Fixed
  eventType: row.event_type || undefined,
  value: row.value ? JSON.parse(row.value) : undefined,
  timestamp: new Date(row.timestamp),
  metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
}));
```

**Effort:** 15-30 minutes

---

## 🔧 Fix #3: Update server-alexa.ts Initialization

### Problem

Current initialization code expects old API:

```typescript
const queue = await getMessageQueue();  // ❌ Returns MessageQueue, not initialized
await registerEventsRoutes(server, store, queue);
```

### Solution

Initialize queue before passing to routes:

```typescript
try {
  // Get queue instance
  const queue = getMessageQueue();

  // Initialize queue (async)
  await queue.initialize();

  // Get event store
  const store = getEventStore();

  // Register routes
  await registerEventsRoutes(server, store, queue);

  logger.info('Events API routes registered successfully');
} catch (error) {
  logger.error('Failed to register events API routes', {
    error: error instanceof Error ? error.message : String(error),
  });
  // Don't fail server startup - events API is optional
}
```

**Effort:** 15 minutes

---

## 📋 Testing Checklist

After fixes are applied:

### Build Verification
- [ ] `pnpm run typecheck` passes (0 errors)
- [ ] `pnpm run build` succeeds
- [ ] `dist/queue/MessageQueue.js` exists
- [ ] `dist/storage/event-store.js` exists
- [ ] `dist/routes/events.js` exists

### Backend API Tests
- [ ] `curl http://localhost:5182/api/events` returns 200 (empty array initially)
- [ ] `curl http://localhost:5182/api/events/stats` returns queue stats
- [ ] `curl -N http://localhost:5182/api/events/stream` establishes SSE connection
- [ ] Database files created: `./data/message-queue.db`, `./data/events.db`

### Functional Tests
- [ ] Enqueue test event via code
- [ ] Event appears in database
- [ ] Event appears in `/api/events` endpoint
- [ ] SSE pushes event to connected clients

### Frontend Tests
- [ ] Navigate to http://localhost:5181/events (page loads)
- [ ] "Events" navigation link visible and functional
- [ ] Empty state displayed when no events
- [ ] Create event → appears in UI automatically (SSE)
- [ ] Filters work (Type, Source dropdowns)

### Integration Tests
- [ ] Execute device command → event logged
- [ ] Execute automation → event logged
- [ ] Webhook POST → event queued and processed

---

## 🚀 Deployment Steps

1. **Fix MessageQueue.ts** (Priority: CRITICAL)
   - Replace entire file with correct implementation
   - Update imports and exports
   - Test queue initialization with simple script

2. **Fix event-store.ts** (Priority: CRITICAL)
   - Update branded type conversions (lines 321-332)
   - Verify TypeScript compilation

3. **Fix server-alexa.ts** (Priority: HIGH)
   - Update queue initialization code
   - Test server startup

4. **Build & Verify** (Priority: HIGH)
   - Run `pnpm run typecheck`
   - Run `pnpm run build`
   - Verify dist files created

5. **Test Backend APIs** (Priority: HIGH)
   - Restart servers
   - Test all `/api/events/*` endpoints
   - Verify database creation

6. **Test Frontend UI** (Priority: MEDIUM)
   - Navigate to Events page
   - Test SSE connection
   - Test filters and pagination

7. **Integration Testing** (Priority: MEDIUM)
   - Test end-to-end event flow
   - Verify webhook processing
   - Test device command logging

---

## 📊 Estimated Timeline

| Task | Effort | Priority |
|------|--------|----------|
| Fix MessageQueue.ts | 4-6 hours | 🔴 CRITICAL |
| Fix event-store.ts | 30 min | 🔴 CRITICAL |
| Fix server-alexa.ts | 15 min | 🟡 HIGH |
| Build & verify | 30 min | 🟡 HIGH |
| Backend API tests | 1 hour | 🟡 HIGH |
| Frontend UI tests | 1 hour | 🟢 MEDIUM |
| Integration tests | 1-2 hours | 🟢 MEDIUM |
| **TOTAL** | **7-11 hours** | |

---

## 🎯 Success Criteria

- ✅ TypeScript compilation passes (0 errors)
- ✅ All API endpoints return 2xx status codes
- ✅ Database files created and schema valid
- ✅ SSE real-time updates work
- ✅ Events page UI functional
- ✅ Filters and pagination work
- ✅ Integration points functional (device commands, automations)

---

## 📚 Reference Documentation

- **plainjob GitHub:** https://github.com/kiliman/plainjob
- **plainjob Examples:** https://github.com/kiliman/plainjob/tree/main/examples
- **better-sqlite3 Docs:** https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- **Branded Types Pattern:** https://basarat.gitbook.io/typescript/main-1/nominaltyping

---

**Document Created:** December 4, 2025
**Status:** 🔴 BLOCKED - AWAITING FIXES
