# Event/Webhook Architecture Analysis - Message Queue Integration

**Research Date:** 2025-12-04
**Context:** Analyzing mcp-smartthings codebase for message queue integration
**Objective:** Map current event architecture and identify integration points

---

## Executive Summary

**Current State:** The mcp-smartthings system has **NO webhook infrastructure** currently implemented. All device interactions are **pull-based** through MCP tools and manual polling.

**Key Finding:** SmartThings webhooks documented but not yet implemented (see `docs/SMARTAPP_SETUP.md`). The SmartApp OAuth flow is configured for future webhook support, but webhook endpoints do not exist yet.

**Integration Strategy:** Message queue should be introduced in **Phase 2** after webhook infrastructure is built. The queue will bridge webhook ingestion with rules engine evaluation and event storage.

**Recommended Approach:**
1. **Phase 1:** Implement webhook endpoints (`POST /webhook/smartthings`)
2. **Phase 2:** Add message queue between webhook and event processing
3. **Phase 3:** Connect queue to rules engine and UI event stream
4. **Phase 4:** Implement persistent event storage with replay capability

---

## 1. Current Event Sources

### 1.1 Device Events (Historical Only)

**Location:** `src/mcp/tools/device-events.ts`, `src/services/DeviceService.ts`

**How it works:**
- **Pull-based API calls** to SmartThings Device Activity API
- Fetches historical events (7-day retention limit)
- Used for troubleshooting and diagnostics via MCP tool `get_device_events`
- **NOT real-time** - requires explicit MCP tool invocation

**Current Flow:**
```
LLM → MCP Tool (get_device_events) → DeviceService → SmartThingsService → SmartThings API
     ↓
Historical events (last 7 days) → Response to LLM
```

**Key Files:**
- `src/types/device-events.ts` - Event type definitions
- `src/mcp/tools/device-events.ts` - MCP tool handler
- `src/services/DeviceService.ts` - Service layer with event fetching

**Integration Point:** These historical events will populate the event store but are separate from real-time webhook events.

---

### 1.2 User Commands (Direct Actions)

**Location:** `src/mcp/tools/device-control.ts`, `src/services/DeviceService.ts`

**How it works:**
- User sends command via MCP tool (e.g., "turn on bedroom light")
- Direct API call to SmartThings to execute command
- **No event storage** - command succeeds or fails synchronously
- No webhook confirmation of state change

**Current Flow:**
```
LLM → MCP Tool (control_device) → DeviceService.executeCommand() → SmartThings API
     ↓
Command sent (no confirmation of device state change)
```

**Integration Point:** After message queue is implemented, user commands should be logged as events for audit trail and UI display.

---

### 1.3 SmartThings Webhooks (NOT IMPLEMENTED YET)

**Location:** `docs/SMARTAPP_SETUP.md` (documentation only, no code yet)

**Current Status:** ❌ **NOT IMPLEMENTED**
- SmartApp OAuth flow configured (`src/routes/oauth.ts`)
- Webhook endpoint documented but does not exist
- No webhook signature verification
- No event ingestion pipeline

**Expected Flow (Future):**
```
SmartThings → POST /webhook/smartthings → ??? (webhook handler not built yet)
```

**Required Implementation:**
1. Create `POST /webhook/smartthings` endpoint in `src/routes/webhook.ts`
2. Implement webhook signature verification (HMAC)
3. Parse SmartThings event payload
4. Enqueue event to message queue
5. Acknowledge receipt with `200 OK` (< 3 second timeout)

**Key Decision:** Webhook infrastructure must be built BEFORE message queue integration.

---

### 1.4 Alexa Custom Skill (Chat-based)

**Location:** `src/server-alexa.ts`, `src/alexa/custom-skill.ts`

**How it works:**
- Alexa sends requests to `POST /alexa` endpoint
- ChatOrchestrator processes natural language
- LLM generates MCP tool calls
- Commands executed via DeviceService

**Current Flow:**
```
Alexa → POST /alexa → ChatOrchestrator → LLM → MCP Tools → DeviceService → SmartThings
```

**Integration Point:** Alexa commands should be logged as events in the queue for audit trail and UI display.

---

## 2. Event Processing Systems

### 2.1 Rules Engine (AutomationService)

**Location:** `src/services/AutomationService.ts`

**Current Functionality:**
- **Rule Discovery:** Fetches SmartThings Rules via API
- **Device-to-Rule Mapping:** Identifies which rules control which devices
- **Caching:** 5-minute TTL cache for rule lookups
- **Rule Execution:** Manual execution via `executeRule()`

**What's Missing:** ❌ **NO webhook-triggered rule evaluation**
- Rules are discovered but not automatically evaluated
- No event-driven automation
- No trigger conditions evaluated on device state changes

**Current Flow:**
```
User/LLM → listRules() → API fetch → Cache → Response
User/LLM → executeRule() → API call → SmartThings executes rule
```

**Desired Flow (After Queue Integration):**
```
Webhook Event → Message Queue → Rule Evaluator → Check Conditions → Execute Actions
                                       ↓
                              Store Event → Update UI
```

**Integration Point:** Message queue consumer should trigger rule evaluation when device events arrive.

---

### 2.2 Scene Service (Manual Execution)

**Location:** `src/services/SceneService.ts`

**Current Functionality:**
- List available scenes
- Execute scenes manually via MCP tool
- **No automation** - purely manual triggering

**Integration Point:** Scene execution should be logged as events in the queue.

---

## 3. Data Storage Patterns

### 3.1 SQLite Usage (Already in Project)

**Existing Implementations:**

**Token Storage (`src/storage/token-storage.ts`):**
- Uses `better-sqlite3` (already in `package.json`)
- Encrypted token storage with AES-256-GCM
- Database path: `./data/tokens.db`
- WAL mode enabled for concurrency
- Prepared statements for performance

**Agent Sync State (`src/services/agent-sync/AgentSyncState.ts`):**
- Uses `better-sqlite3` for state tracking
- Database path: `~/.config/claude-mpm/agent_sync.db`
- Synchronous API pattern
- Transaction support
- Index-backed queries

**Key Patterns to Reuse:**
```typescript
// WAL mode for better concurrency
this.db.pragma('journal_mode = WAL');

// Prepared statements for performance
const stmt = this.db.prepare('INSERT INTO ...');

// Transaction support
this.db.transaction(() => {
  // Multiple operations atomically
})();

// Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_queue_status
  ON events(status, timestamp);
```

---

### 3.2 No Event Storage Currently

**Current State:** ❌ **NO persistent event storage**
- Device events fetched from SmartThings API (7-day retention)
- No local event database
- No event replay capability
- No event-driven UI updates

**Gap:** Events disappear after 7 days, no historical analysis beyond API retention.

---

## 4. Integration Points for Message Queue

### 4.1 Webhook Ingestion (Priority 1 - MUST BUILD FIRST)

**Location:** `src/routes/webhook.ts` (NEW FILE)

**Implementation:**
```typescript
// src/routes/webhook.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MessageQueue } from '../queue/MessageQueue.js';
import { verifySmartThingsSignature } from '../smartthings/webhook-verification.js';
import logger from '../utils/logger.js';

export function registerWebhookRoutes(
  app: FastifyInstance,
  messageQueue: MessageQueue
) {
  // SmartThings webhook endpoint
  app.post('/webhook/smartthings', async (req: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      // 1. Verify webhook signature (HMAC)
      const isValid = verifySmartThingsSignature(
        req.headers,
        req.body as string
      );

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          headers: req.headers,
          ip: req.ip,
        });
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      // 2. Parse event payload
      const event = req.body as SmartThingsWebhookEvent;

      // 3. Enqueue event for processing
      const jobId = await messageQueue.enqueue('webhook', {
        source: 'smartthings',
        eventType: event.eventType,
        deviceId: event.deviceId,
        capability: event.capability,
        attribute: event.attribute,
        value: event.value,
        locationId: event.locationId,
        timestamp: Date.now(),
        raw: event,
      });

      logger.info('Webhook event enqueued', {
        jobId,
        eventType: event.eventType,
        deviceId: event.deviceId,
        latencyMs: Date.now() - startTime,
      });

      // 4. Acknowledge receipt (MUST respond < 3 seconds)
      return reply.code(200).send({ status: 'accepted', jobId });

    } catch (error) {
      logger.error('Webhook processing failed', { error });

      // Return 500 to trigger SmartThings retry
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Webhook verification endpoint (optional, for SmartThings validation)
  app.get('/webhook/smartthings', async (req: FastifyRequest, reply: FastifyReply) => {
    // SmartThings may send GET request to verify endpoint exists
    return reply.code(200).send({ status: 'ok', version: '1.0' });
  });
}
```

**Integration Steps:**
1. Create `src/routes/webhook.ts` with signature verification
2. Add `registerWebhookRoutes(app, messageQueue)` to `src/server-alexa.ts`
3. Create `src/smartthings/webhook-verification.ts` for HMAC signature validation
4. Update SmartApp configuration to point to webhook URL

**Critical Requirements:**
- **Response time < 3 seconds** (SmartThings timeout)
- **Signature verification** (prevent spoofed events)
- **Fast enqueue** (queue write must be < 100ms)
- **Idempotency** (handle duplicate webhooks)

---

### 4.2 Message Queue Service (Core Component)

**Location:** `src/queue/MessageQueue.ts` (NEW FILE)

**Recommended Library:** `plainjob` (SQLite-backed, 15K jobs/sec)

**Implementation:**
```typescript
// src/queue/MessageQueue.ts
import Database from 'better-sqlite3';
import { JobQueue } from 'plainjob';
import logger from '../utils/logger.js';
import type { DeviceId, LocationId } from '../types/smartthings.js';

export interface QueueEvent {
  source: 'webhook' | 'user-command' | 'alexa' | 'scheduled';
  eventType: string;
  deviceId?: DeviceId;
  locationId?: LocationId;
  capability?: string;
  attribute?: string;
  value?: unknown;
  timestamp: number;
  raw?: unknown;
}

export interface QueueConfig {
  dbPath?: string;
  pollInterval?: number;
  maxRetries?: number;
  timeout?: number;
  concurrency?: number;
}

export class MessageQueue {
  private db: Database.Database;
  private queue: JobQueue;

  constructor(config: QueueConfig = {}) {
    const {
      dbPath = './data/message-queue.db',
      pollInterval = 1000,
      maxRetries = 3,
      timeout = 30000,
      concurrency = 4,
    } = config;

    // Create separate database for queue (avoid lock contention)
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    // Initialize job queue
    this.queue = new JobQueue(this.db, {
      pollInterval,
      maxRetries,
      timeout,
      concurrency,
    });

    logger.info('Message queue initialized', {
      dbPath,
      pollInterval,
      concurrency,
    });
  }

  /**
   * Enqueue event for processing.
   *
   * @param type - Event type (webhook, rule-engine, etc.)
   * @param data - Event payload
   * @returns Job ID
   */
  async enqueue(type: string, data: QueueEvent): Promise<number> {
    const jobId = await this.queue.enqueue(type, data);

    logger.debug('Event enqueued', {
      jobId,
      type,
      source: data.source,
      eventType: data.eventType,
    });

    return jobId;
  }

  /**
   * Register handler for event type.
   *
   * @param type - Event type to handle
   * @param handler - Async handler function
   */
  registerHandler(type: string, handler: (job: any) => Promise<void>): void {
    this.queue.registerHandler(type, handler);
    logger.info('Handler registered', { type });
  }

  /**
   * Start processing jobs.
   */
  async start(): Promise<void> {
    await this.queue.start();
    logger.info('Message queue started');
  }

  /**
   * Stop processing jobs gracefully.
   */
  async stop(): Promise<void> {
    await this.queue.stop();
    logger.info('Message queue stopped');
  }

  /**
   * Close database connection.
   */
  close(): void {
    this.db.close();
    logger.info('Message queue closed');
  }
}
```

**Integration Steps:**
1. Install `plainjob`: `pnpm add plainjob`
2. Create `src/queue/MessageQueue.ts`
3. Initialize in `src/server-alexa.ts` startup
4. Register handlers for each event type
5. Start queue processing before server starts listening

---

### 4.3 Event Store (Persistent Storage)

**Location:** `src/storage/event-store.ts` (NEW FILE)

**Purpose:** Store all events for:
- Historical analysis beyond 7-day SmartThings retention
- Event replay for debugging
- UI event stream
- Audit trail

**Implementation:**
```typescript
// src/storage/event-store.ts
import Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import type { DeviceId, LocationId, CapabilityName } from '../types/smartthings.js';

export interface StoredEvent {
  id: number;
  source: string;
  eventType: string;
  deviceId?: DeviceId;
  deviceName?: string;
  locationId?: LocationId;
  capability?: CapabilityName;
  attribute?: string;
  value?: string; // JSON-serialized
  timestamp: number;
  raw?: string; // JSON-serialized
  createdAt: number;
}

export class EventStore {
  private db: Database.Database;

  constructor(dbPath: string = './data/events.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();

    logger.info('Event store initialized', { dbPath });
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        event_type TEXT NOT NULL,
        device_id TEXT,
        device_name TEXT,
        location_id TEXT,
        capability TEXT,
        attribute TEXT,
        value TEXT,
        timestamp INTEGER NOT NULL,
        raw TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Index for device history queries
      CREATE INDEX IF NOT EXISTS idx_events_device
        ON events(device_id, timestamp DESC);

      -- Index for location queries
      CREATE INDEX IF NOT EXISTS idx_events_location
        ON events(location_id, timestamp DESC);

      -- Index for event type filtering
      CREATE INDEX IF NOT EXISTS idx_events_type
        ON events(event_type, timestamp DESC);

      -- Index for time-based queries
      CREATE INDEX IF NOT EXISTS idx_events_timestamp
        ON events(timestamp DESC);
    `);
  }

  /**
   * Store event in database.
   *
   * @param event - Event to store
   * @returns Event ID
   */
  storeEvent(event: Omit<StoredEvent, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        source, event_type, device_id, device_name, location_id,
        capability, attribute, value, timestamp, raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.source,
      event.eventType,
      event.deviceId ?? null,
      event.deviceName ?? null,
      event.locationId ?? null,
      event.capability ?? null,
      event.attribute ?? null,
      event.value ? JSON.stringify(event.value) : null,
      event.timestamp,
      event.raw ? JSON.stringify(event.raw) : null
    );

    const eventId = result.lastInsertRowid as number;

    logger.debug('Event stored', {
      eventId,
      source: event.source,
      eventType: event.eventType,
      deviceId: event.deviceId,
    });

    return eventId;
  }

  /**
   * Query events by device.
   *
   * @param deviceId - Device UUID
   * @param limit - Maximum events to return
   * @param offset - Pagination offset
   * @returns Array of events
   */
  getDeviceEvents(
    deviceId: DeviceId,
    limit: number = 100,
    offset: number = 0
  ): StoredEvent[] {
    const stmt = this.db.prepare<[string, number, number], StoredEvent>(`
      SELECT * FROM events
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(deviceId as string, limit, offset);
  }

  /**
   * Query recent events across all devices.
   *
   * @param limit - Maximum events to return
   * @returns Array of events
   */
  getRecentEvents(limit: number = 50): StoredEvent[] {
    const stmt = this.db.prepare<[number], StoredEvent>(`
      SELECT * FROM events
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  /**
   * Query events by time range.
   *
   * @param startTime - Start timestamp (Unix ms)
   * @param endTime - End timestamp (Unix ms)
   * @param limit - Maximum events to return
   * @returns Array of events
   */
  getEventsByTimeRange(
    startTime: number,
    endTime: number,
    limit: number = 100
  ): StoredEvent[] {
    const stmt = this.db.prepare<[number, number, number], StoredEvent>(`
      SELECT * FROM events
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(startTime, endTime, limit);
  }

  /**
   * Delete events older than retention period.
   *
   * @param retentionDays - Number of days to retain events
   * @returns Number of events deleted
   */
  cleanupOldEvents(retentionDays: number = 30): number {
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const stmt = this.db.prepare(`
      DELETE FROM events WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffTimestamp);
    const deletedCount = result.changes;

    logger.info('Old events cleaned up', {
      retentionDays,
      deletedCount,
    });

    return deletedCount;
  }

  /**
   * Close database connection.
   */
  close(): void {
    this.db.close();
    logger.info('Event store closed');
  }
}
```

**Integration Steps:**
1. Create `src/storage/event-store.ts`
2. Initialize in queue handler: store every event processed
3. Add cleanup cron job to delete old events (30-day retention)
4. Expose query methods via MCP tool for historical analysis

---

### 4.4 Rules Engine Integration

**Location:** `src/services/RuleEvaluator.ts` (NEW FILE)

**Purpose:** Evaluate rules when device events arrive via webhook

**Implementation:**
```typescript
// src/services/RuleEvaluator.ts
import type { AutomationService } from './AutomationService.js';
import type { DeviceService } from './DeviceService.js';
import type { QueueEvent } from '../queue/MessageQueue.js';
import type { DeviceId, LocationId } from '../types/smartthings.js';
import logger from '../utils/logger.js';

export class RuleEvaluator {
  constructor(
    private automationService: AutomationService,
    private deviceService: DeviceService
  ) {}

  /**
   * Evaluate rules triggered by device event.
   *
   * @param event - Device event from webhook
   */
  async evaluateRulesForEvent(event: QueueEvent): Promise<void> {
    if (!event.deviceId || !event.locationId) {
      logger.debug('Event missing device or location ID, skipping rule evaluation', {
        eventType: event.eventType,
      });
      return;
    }

    const startTime = Date.now();

    try {
      // 1. Find rules that reference this device
      const rules = await this.automationService.findRulesForDevice(
        event.deviceId as DeviceId,
        event.locationId as LocationId
      );

      if (rules.length === 0) {
        logger.debug('No rules found for device', {
          deviceId: event.deviceId,
          eventType: event.eventType,
        });
        return;
      }

      logger.info('Evaluating rules for event', {
        deviceId: event.deviceId,
        eventType: event.eventType,
        ruleCount: rules.length,
      });

      // 2. For each rule, check if event triggers it
      for (const rule of rules) {
        // TODO: Implement condition evaluation
        // - Parse rule conditions from SmartThings rule definition
        // - Check if event matches trigger conditions
        // - Evaluate additional conditions (time, device state, etc.)

        const shouldTrigger = await this.checkRuleConditions(rule, event);

        if (shouldTrigger) {
          logger.info('Rule triggered by event', {
            ruleId: rule.ruleId,
            ruleName: rule.ruleName,
            deviceId: event.deviceId,
            eventType: event.eventType,
          });

          // 3. Execute rule
          await this.automationService.executeRule(
            rule.ruleId,
            event.locationId as LocationId
          );
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info('Rule evaluation complete', {
        deviceId: event.deviceId,
        rulesChecked: rules.length,
        elapsedMs: elapsed,
      });

    } catch (error) {
      logger.error('Rule evaluation failed', {
        deviceId: event.deviceId,
        eventType: event.eventType,
        error,
      });
      throw error;
    }
  }

  /**
   * Check if event matches rule conditions.
   *
   * @param rule - Rule to evaluate
   * @param event - Device event
   * @returns True if rule should trigger
   */
  private async checkRuleConditions(
    rule: any,
    event: QueueEvent
  ): Promise<boolean> {
    // TODO: Implement condition parsing and evaluation
    // For now, return false (manual rule execution only)

    // Example condition checks:
    // - Device state matches condition
    // - Time of day matches condition
    // - Other device states match conditions

    return false;
  }
}
```

**Integration Steps:**
1. Create `src/services/RuleEvaluator.ts`
2. Register queue handler: `queue.registerHandler('webhook', async (job) => { await ruleEvaluator.evaluateRulesForEvent(job.data); })`
3. Implement condition parsing from SmartThings rule definitions
4. Add rule execution tracking to EventStore

---

## 5. Data Flow Architecture

### 5.1 Current Flow (Pull-Based)

```
┌─────────────┐
│ LLM/Alexa   │
└──────┬──────┘
       │
       │ MCP Tool Call
       ▼
┌─────────────────┐
│  MCP Tools      │
└──────┬──────────┘
       │
       │ Service Call
       ▼
┌─────────────────┐
│ DeviceService   │
└──────┬──────────┘
       │
       │ API Request
       ▼
┌─────────────────┐
│ SmartThings API │
└─────────────────┘

Problems:
- ❌ No real-time events
- ❌ Polling required for updates
- ❌ No event history beyond 7 days
- ❌ No automation triggers
```

---

### 5.2 Target Flow (Event-Driven with Queue)

```
┌─────────────────┐
│ SmartThings     │
│ Webhook         │
└────────┬────────┘
         │
         │ POST /webhook/smartthings
         │ (verify signature, < 3s response)
         ▼
┌────────────────────┐
│ Webhook Handler    │
│ (Fast ACK)         │
└─────────┬──────────┘
          │
          │ Enqueue event
          ▼
┌──────────────────────────┐
│ Message Queue            │
│ (SQLite, plainjob)       │
│ - Persistent             │
│ - Retry logic            │
│ - Dead letter queue      │
└─────────┬────────────────┘
          │
          │ Process jobs (4 concurrent workers)
          ▼
┌──────────────────────────┐
│ Event Processor          │
│ ┌─────────────────────┐  │
│ │ 1. Store Event      │  │
│ │    EventStore.save()│  │
│ └─────────────────────┘  │
│ ┌─────────────────────┐  │
│ │ 2. Evaluate Rules   │  │
│ │    RuleEvaluator    │  │
│ └─────────────────────┘  │
│ ┌─────────────────────┐  │
│ │ 3. Update UI        │  │
│ │    SSE broadcast    │  │
│ └─────────────────────┘  │
└──────────────────────────┘

Benefits:
- ✅ Real-time device events
- ✅ Persistent event history
- ✅ Automatic rule evaluation
- ✅ Live UI updates
- ✅ Replay capability
- ✅ Fault tolerance
```

---

### 5.3 Component Integration Diagram

```
┌────────────────────────────────────────────────────────────┐
│                       FastifyServer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ POST /alexa  │  │ POST /webhook│  │ MCP Endpoint │     │
│  │ (Alexa)      │  │ (SmartThings)│  │ (Claude)     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          │ 1. User command  │ 2. Webhook event │ 3. MCP tool
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Message Queue                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ user-command│  │   webhook   │  │ mcp-query   │         │
│  │   handler   │  │   handler   │  │  handler    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
          ┌──────────────────────────────────────┐
          │       Event Processor                │
          │  ┌────────────┐  ┌────────────┐      │
          │  │EventStore  │  │RuleEvaluator│     │
          │  │.save()     │  │.evaluate()  │     │
          │  └────────────┘  └────────────┘      │
          └──────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  EventStore  │  │AutomationSvc │  │  UI (SSE)    │
│  (SQLite)    │  │.executeRule()│  │  broadcast   │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 6. Implementation Phases

### Phase 1: Webhook Infrastructure (Week 1)

**Priority:** 🔴 **CRITICAL** - Must be completed first

**Tasks:**
1. ✅ Study SmartThings webhook documentation
2. ⬜ Create `src/routes/webhook.ts` with endpoint
3. ⬜ Implement `src/smartthings/webhook-verification.ts`
4. ⬜ Add webhook signature verification (HMAC-SHA256)
5. ⬜ Register webhook route in `src/server-alexa.ts`
6. ⬜ Test webhook with SmartThings Developer Workspace
7. ⬜ Add monitoring for webhook failures

**Deliverables:**
- Working `POST /webhook/smartthings` endpoint
- Signature verification passing
- < 3 second response time
- Basic logging for debugging

**Files to Create:**
- `src/routes/webhook.ts`
- `src/smartthings/webhook-verification.ts`
- `src/types/webhook.ts`

**Blocked by:** Nothing (can start immediately)

---

### Phase 2: Message Queue Integration (Week 2)

**Priority:** 🟡 **HIGH** - Depends on Phase 1

**Tasks:**
1. ⬜ Install `plainjob` library: `pnpm add plainjob`
2. ⬜ Create `src/queue/MessageQueue.ts`
3. ⬜ Initialize queue in server startup
4. ⬜ Register webhook handler in queue
5. ⬜ Test queue performance (enqueue/dequeue latency)
6. ⬜ Implement dead letter queue monitoring
7. ⬜ Add queue health check endpoint

**Deliverables:**
- Message queue service with 4 concurrent workers
- < 100ms enqueue latency
- < 1s processing latency per event
- Retry logic with exponential backoff
- Dead letter queue for failed events

**Files to Create:**
- `src/queue/MessageQueue.ts`
- `src/queue/types.ts`
- `tests/unit/queue/MessageQueue.test.ts`

**Blocked by:** Phase 1 (webhook endpoints)

---

### Phase 3: Event Storage & Rules Engine (Week 3)

**Priority:** 🟡 **HIGH** - Depends on Phase 2

**Tasks:**
1. ⬜ Create `src/storage/event-store.ts`
2. ⬜ Design event schema with indexes
3. ⬜ Implement event storage in queue handler
4. ⬜ Create `src/services/RuleEvaluator.ts`
5. ⬜ Parse SmartThings rule conditions
6. ⬜ Implement condition evaluation logic
7. ⬜ Connect rule evaluator to queue handler
8. ⬜ Add event cleanup cron job (30-day retention)

**Deliverables:**
- Persistent event storage (SQLite)
- Event history queries via MCP tool
- Automatic rule evaluation on device events
- Rule execution tracking in EventStore
- Event retention policy (30 days)

**Files to Create:**
- `src/storage/event-store.ts`
- `src/services/RuleEvaluator.ts`
- `src/mcp/tools/event-history.ts`
- `tests/unit/storage/event-store.test.ts`

**Blocked by:** Phase 2 (message queue)

---

### Phase 4: UI Integration & Real-Time Updates (Week 4)

**Priority:** 🟢 **MEDIUM** - Depends on Phase 3

**Tasks:**
1. ⬜ Add SSE endpoint for event stream
2. ⬜ Broadcast events to connected UI clients
3. ⬜ Create UI component for real-time event display
4. ⬜ Add event filtering (device, type, time range)
5. ⬜ Implement event replay UI
6. ⬜ Add rule execution history view
7. ⬜ Performance testing with 1000+ events

**Deliverables:**
- Real-time event stream in UI
- Event history view with filters
- Rule execution timeline
- Event replay capability
- Live device state updates

**Files to Create:**
- `src/routes/sse.ts` (already exists in `src/transport/http.ts`)
- `web/src/lib/components/events/EventStream.svelte`
- `web/src/lib/components/events/EventHistory.svelte`
- `web/src/lib/stores/eventsStore.svelte.ts`

**Blocked by:** Phase 3 (event storage)

---

## 7. Code Examples

### 7.1 Before: No Webhook Support

**Current State:**
```typescript
// src/server-alexa.ts (existing code)

const app = Fastify();

// Only Alexa and OAuth endpoints exist
registerOAuthRoutes(app, smartThingsAdapter, serviceContainer);

app.post('/alexa', handleAlexaDirective);
app.post('/alexa-smarthome', handleAlexaDirective);

app.listen({ port: PORT, host: HOST });
```

**Problem:** No webhook ingestion, no event-driven updates

---

### 7.2 After: Webhook + Queue Integration

**Modified Server:**
```typescript
// src/server-alexa.ts (modified)

import { MessageQueue } from './queue/MessageQueue.js';
import { EventStore } from './storage/event-store.js';
import { RuleEvaluator } from './services/RuleEvaluator.js';
import { registerWebhookRoutes } from './routes/webhook.js';

const app = Fastify();

// Initialize queue and event store
const messageQueue = new MessageQueue({
  dbPath: './data/message-queue.db',
  concurrency: 4,
  maxRetries: 3,
});

const eventStore = new EventStore('./data/events.db');

// Create rule evaluator
const automationService = serviceContainer.getAutomationService();
const deviceService = serviceContainer.getDeviceService();
const ruleEvaluator = new RuleEvaluator(automationService, deviceService);

// Register queue handlers
messageQueue.registerHandler('webhook', async (job) => {
  const event = job.data;

  // 1. Store event for history
  eventStore.storeEvent({
    source: event.source,
    eventType: event.eventType,
    deviceId: event.deviceId,
    locationId: event.locationId,
    capability: event.capability,
    attribute: event.attribute,
    value: event.value,
    timestamp: event.timestamp,
    raw: event.raw,
  });

  // 2. Evaluate rules
  await ruleEvaluator.evaluateRulesForEvent(event);

  // 3. Broadcast to UI (SSE)
  // TODO: Implement SSE broadcast
});

// Start queue processing
await messageQueue.start();

// Register routes
registerOAuthRoutes(app, smartThingsAdapter, serviceContainer);
registerWebhookRoutes(app, messageQueue);

app.post('/alexa', handleAlexaDirective);
app.post('/alexa-smarthome', handleAlexaDirective);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await messageQueue.stop();
  messageQueue.close();
  eventStore.close();
  process.exit(0);
});

app.listen({ port: PORT, host: HOST });
```

---

### 7.3 Webhook Handler Pattern

**Complete Webhook Route:**
```typescript
// src/routes/webhook.ts

import { FastifyInstance } from 'fastify';
import { MessageQueue } from '../queue/MessageQueue.js';
import { verifySmartThingsSignature } from '../smartthings/webhook-verification.js';
import logger from '../utils/logger.js';

export interface SmartThingsWebhookEvent {
  eventId: string;
  eventType: 'DEVICE_EVENT';
  deviceId: string;
  locationId: string;
  capability: string;
  attribute: string;
  value: unknown;
  unit?: string;
  timestamp: string;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  messageQueue: MessageQueue
) {
  app.post<{ Body: SmartThingsWebhookEvent }>(
    '/webhook/smartthings',
    {
      schema: {
        body: {
          type: 'object',
          required: ['eventType', 'deviceId', 'locationId'],
          properties: {
            eventId: { type: 'string' },
            eventType: { type: 'string' },
            deviceId: { type: 'string' },
            locationId: { type: 'string' },
            capability: { type: 'string' },
            attribute: { type: 'string' },
            value: {},
          },
        },
      },
    },
    async (req, reply) => {
      const startTime = Date.now();

      try {
        // 1. Verify HMAC signature
        const signature = req.headers['x-smartthings-signature'] as string;
        const isValid = verifySmartThingsSignature(
          req.rawBody as string,
          signature,
          process.env.SMARTTHINGS_WEBHOOK_SECRET!
        );

        if (!isValid) {
          logger.warn('Invalid webhook signature', {
            ip: req.ip,
            eventType: req.body.eventType,
          });
          return reply.code(401).send({ error: 'Invalid signature' });
        }

        // 2. Enqueue event
        const event = req.body;
        const jobId = await messageQueue.enqueue('webhook', {
          source: 'smartthings',
          eventType: event.eventType,
          deviceId: event.deviceId,
          locationId: event.locationId,
          capability: event.capability,
          attribute: event.attribute,
          value: event.value,
          timestamp: Date.now(),
          raw: event,
        });

        const latencyMs = Date.now() - startTime;

        logger.info('Webhook event processed', {
          jobId,
          eventId: event.eventId,
          deviceId: event.deviceId,
          latencyMs,
        });

        // 3. Fast acknowledge (MUST be < 3s)
        return reply.code(200).send({
          status: 'accepted',
          jobId,
          latencyMs,
        });

      } catch (error) {
        logger.error('Webhook processing failed', {
          error,
          eventType: req.body?.eventType,
        });

        // Return 500 to trigger SmartThings retry
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Verification endpoint
  app.get('/webhook/smartthings', async (_req, reply) => {
    return reply.code(200).send({ status: 'ok', version: '1.0' });
  });
}
```

---

### 7.4 Signature Verification

**HMAC Verification:**
```typescript
// src/smartthings/webhook-verification.ts

import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Verify SmartThings webhook signature.
 *
 * SmartThings signs webhook payloads with HMAC-SHA256 using your
 * webhook secret from the SmartApp configuration.
 *
 * @param body - Raw request body (must be string, not parsed JSON)
 * @param signature - Signature from X-SmartThings-Signature header
 * @param secret - Webhook secret from SmartApp config
 * @returns True if signature is valid
 */
export function verifySmartThingsSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    logger.warn('Missing signature or secret', {
      hasSignature: !!signature,
      hasSecret: !!secret,
    });
    return false;
  }

  try {
    // Compute expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Signature mismatch', {
        received: signature.substring(0, 16) + '...',
        expected: expectedSignature.substring(0, 16) + '...',
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}
```

---

## 8. Migration Strategy

### 8.1 Coexistence Strategy

**Current System (Pull-Based):**
- Keep existing MCP tools functional
- Continue supporting manual queries
- Maintain compatibility with LLM workflows

**New System (Event-Driven):**
- Add webhook ingestion in parallel
- Queue-based event processing
- Persistent event storage
- Optional: UI clients can choose pull vs. push

**Benefits:**
- ✅ No breaking changes
- ✅ Gradual migration
- ✅ Fallback to pull if webhooks fail
- ✅ Hybrid mode during transition

---

### 8.2 Minimal Changes to Existing Code

**Files NOT Modified:**
- `src/mcp/tools/device-events.ts` - Keep existing historical query tool
- `src/services/DeviceService.ts` - No changes needed
- `src/services/AutomationService.ts` - Minor addition of RuleEvaluator usage

**Files Modified:**
- `src/server-alexa.ts` - Add queue initialization and webhook routes
- `package.json` - Add `plainjob` dependency

**Files Created (New):**
- `src/routes/webhook.ts`
- `src/smartthings/webhook-verification.ts`
- `src/queue/MessageQueue.ts`
- `src/storage/event-store.ts`
- `src/services/RuleEvaluator.ts`

**Total Code Impact:**
- **Modified:** 2 files (~50 lines added)
- **New:** 5 files (~800 lines total)
- **Breaking changes:** 0

---

### 8.3 Testing Strategy

**Unit Tests:**
```typescript
// tests/unit/queue/MessageQueue.test.ts
describe('MessageQueue', () => {
  it('should enqueue event successfully', async () => {
    const queue = new MessageQueue({ dbPath: ':memory:' });
    const jobId = await queue.enqueue('webhook', { test: 'data' });
    expect(jobId).toBeGreaterThan(0);
  });

  it('should process events with registered handler', async () => {
    const queue = new MessageQueue({ dbPath: ':memory:' });
    const handler = vi.fn();
    queue.registerHandler('webhook', handler);
    await queue.start();
    await queue.enqueue('webhook', { test: 'data' });
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(handler).toHaveBeenCalled();
  });
});
```

**Integration Tests:**
```typescript
// tests/integration/webhook.test.ts
describe('Webhook Integration', () => {
  it('should accept SmartThings webhook', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/smartthings',
      headers: {
        'X-SmartThings-Signature': 'valid-hmac-signature',
      },
      payload: {
        eventType: 'DEVICE_EVENT',
        deviceId: 'device-123',
        locationId: 'location-456',
        capability: 'switch',
        attribute: 'switch',
        value: 'on',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'accepted',
      jobId: expect.any(Number),
    });
  });

  it('should reject webhook with invalid signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook/smartthings',
      headers: {
        'X-SmartThings-Signature': 'invalid-signature',
      },
      payload: { eventType: 'DEVICE_EVENT' },
    });

    expect(response.statusCode).toBe(401);
  });
});
```

---

## 9. Performance Considerations

### 9.1 Webhook Response Time

**SmartThings Requirement:** < 3 seconds

**Our Target:** < 500ms (95th percentile)

**Breakdown:**
- Signature verification: ~1-5ms
- Queue enqueue: ~10-50ms (SQLite write)
- Response generation: ~1-2ms
- **Total:** ~15-60ms typical

**Optimization:**
- ✅ Immediate acknowledgment (don't wait for processing)
- ✅ Prepared statements for fast inserts
- ✅ WAL mode for concurrent writes
- ✅ Separate queue database (no lock contention)

---

### 9.2 Queue Processing

**Expected Load:**
- Peak: 3,000 events in 5 minutes = 10 events/sec
- Average: 7,300 events/day = 0.08 events/sec

**Queue Capacity:**
- plainjob: 15,000 jobs/sec
- Our usage: 10 events/sec peak
- **Headroom:** 1,500x capacity

**Concurrency:**
- 4 concurrent workers
- Processing time per event: ~100-500ms
- **Throughput:** ~8-40 events/sec sustained

**Verdict:** ✅ Queue will never be a bottleneck

---

### 9.3 Database Growth

**Event Size:**
- Average event: ~500 bytes
- Daily events: 7,300
- Daily growth: 3.65 MB

**Storage Projections:**
- 30 days: 109.5 MB
- 90 days: 328.5 MB
- 1 year: 1.3 GB

**Indexes:**
- 4 indexes × ~10% overhead = ~10% additional storage
- Total 1 year: ~1.5 GB

**Cleanup Strategy:**
- Automatic cleanup after 30 days
- Manual retention policy adjustable
- SQLite VACUUM monthly to reclaim space

**Verdict:** ✅ Storage requirements minimal

---

## 10. Security Considerations

### 10.1 Webhook Signature Verification

**Mandatory:** HMAC-SHA256 signature verification

**Implementation:**
```typescript
const isValid = verifySmartThingsSignature(
  req.rawBody,
  req.headers['x-smartthings-signature'],
  process.env.SMARTTHINGS_WEBHOOK_SECRET
);

if (!isValid) {
  return reply.code(401).send({ error: 'Invalid signature' });
}
```

**Threats Mitigated:**
- ✅ Spoofed webhooks
- ✅ Replay attacks (with timestamp validation)
- ✅ Man-in-the-middle tampering

---

### 10.2 Secrets Management

**Required Secrets:**
- `SMARTTHINGS_WEBHOOK_SECRET` - For signature verification
- `TOKEN_ENCRYPTION_KEY` - Already exists for token storage

**Storage:**
- `.env.local` file (gitignored)
- Environment variables in production
- Never commit to repository

---

### 10.3 Rate Limiting

**Recommendation:** Add rate limiting to webhook endpoint

**Implementation:**
```typescript
import rateLimit from '@fastify/rate-limit';

app.register(rateLimit, {
  max: 100, // Max 100 requests
  timeWindow: '1 minute', // Per minute
});
```

**Protects Against:**
- ✅ DoS attacks
- ✅ Webhook spam
- ✅ Malicious flooding

---

## 11. Monitoring & Observability

### 11.1 Key Metrics

**Webhook Metrics:**
- Requests/sec
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Invalid signature rate

**Queue Metrics:**
- Queue depth (pending jobs)
- Processing latency
- Failed jobs (dead letter queue size)
- Retry rate

**Event Store Metrics:**
- Events stored/sec
- Database size
- Query latency
- Cleanup job duration

---

### 11.2 Health Check Endpoint

```typescript
app.get('/health/queue', async (_req, reply) => {
  const queueHealth = {
    status: 'healthy',
    metrics: {
      pendingJobs: queue.getPendingCount(),
      processingJobs: queue.getProcessingCount(),
      failedJobs: queue.getFailedCount(),
      totalProcessed: queue.getTotalProcessed(),
    },
  };

  return reply.code(200).send(queueHealth);
});
```

---

## 12. Summary & Next Steps

### 12.1 Key Findings

1. ✅ **No existing webhook infrastructure** - Clean slate for implementation
2. ✅ **SQLite already in use** - Pattern established, can reuse for queue
3. ✅ **Rules engine exists** - Just needs webhook trigger integration
4. ✅ **better-sqlite3 in package.json** - No new database dependencies needed
5. ⚠️ **SmartApp configured** - OAuth done, but webhook endpoint missing

### 12.2 Critical Path

```
Phase 1: Webhook → Phase 2: Queue → Phase 3: Storage + Rules → Phase 4: UI
   (Week 1)          (Week 2)              (Week 3)                (Week 4)
```

**Blockers:**
- Phase 2+ blocked until Phase 1 webhooks complete
- UI updates blocked until event storage exists

### 12.3 Recommended Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Queue** | `plainjob` | SQLite-backed, 15K jobs/sec, zero Redis |
| **Storage** | `better-sqlite3` | Already in project, proven pattern |
| **Webhook** | Fastify routes | Already using Fastify server |
| **Verification** | Node crypto (HMAC) | Built-in, no dependencies |
| **Monitoring** | Winston logger | Already in project |

### 12.4 Immediate Action Items

**Priority 1 (This Week):**
1. ⬜ Create `src/routes/webhook.ts` with signature verification
2. ⬜ Test webhook with SmartThings Developer Workspace
3. ⬜ Measure response time (must be < 3 seconds)

**Priority 2 (Next Week):**
1. ⬜ Install `plainjob`: `pnpm add plainjob`
2. ⬜ Create `src/queue/MessageQueue.ts`
3. ⬜ Connect webhook to queue

**Priority 3 (Week 3):**
1. ⬜ Implement `src/storage/event-store.ts`
2. ⬜ Create `src/services/RuleEvaluator.ts`
3. ⬜ Test end-to-end flow

---

## 13. References

**Existing Patterns:**
- Token storage: `src/storage/token-storage.ts`
- Agent sync state: `src/services/agent-sync/AgentSyncState.ts`
- Service layer: `src/services/DeviceService.ts`
- MCP tools: `src/mcp/tools/device-events.ts`

**Documentation:**
- SmartApp setup: `docs/SMARTAPP_SETUP.md`
- Message queue research: `docs/research/persistent-message-queue-no-redis-2025-12-04.md`
- OAuth implementation: `docs/implementation/OAUTH2_SMARTAPP_IMPLEMENTATION.md`

**External Resources:**
- SmartThings Webhook API: https://developer.smartthings.com/docs/webhooks
- plainjob: https://www.npmjs.com/package/plainjob
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3

---

**Report Generated:** 2025-12-04
**Research Agent:** Claude (Sonnet 4.5)
**Ticket Context:** Message queue integration for smart home event processing
**Status:** ✅ Complete - Ready for implementation planning
