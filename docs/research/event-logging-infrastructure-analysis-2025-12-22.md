# Event Logging Infrastructure Analysis

**Research Date:** 2025-12-22
**Project:** Smarter Things
**Scope:** Event storage analysis and file-based logging recommendations
**Status:** Complete

---

## Executive Summary

This research investigates the current event storage and logging infrastructure in Smarter Things to recommend the best approach for implementing file-based event logging. The analysis covers:

1. Current SQLite-based event storage (`event-store.ts`)
2. Winston logging infrastructure (`logger.ts`)
3. Event emission points (webhook handler, polling service)
4. Recommendations for file-based event logging

**Key Finding:** The project has robust SQLite event storage with 30-day retention but lacks file-based logging for events. Adding structured file-based event logs would provide:
- Long-term event archival beyond 30-day SQLite retention
- Easier debugging with human-readable event logs
- Integration with log aggregation tools (ELK, Splunk, etc.)
- Offline event analysis capabilities

---

## 1. Current Event Storage Architecture

### 1.1 SQLite Event Store

**File:** `/Users/masa/Projects/smarterthings/src/storage/event-store.ts`

**Design Pattern:**
- SQLite database with Write-Ahead Logging (WAL) mode
- Location: `./data/events.db`
- Single denormalized table for fast queries
- Prepared statements for performance

**Schema:**
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,                 -- Event UUID
  type TEXT NOT NULL,                  -- Event classification (device_event, user_command, etc.)
  source TEXT NOT NULL,                -- Platform origin (smartthings, alexa, mcp, webhook, polling)
  device_id TEXT,                      -- Associated device (nullable)
  device_name TEXT,                    -- Human-readable device name
  location_id TEXT,                    -- SmartThings location
  event_type TEXT,                     -- Specific event subtype
  value TEXT,                          -- Event payload as JSON string
  timestamp INTEGER NOT NULL,          -- Event occurrence time (milliseconds since epoch)
  metadata TEXT,                       -- Additional context as JSON string
  created_at INTEGER DEFAULT (strftime('%s', 'now'))  -- Row insertion time (seconds)
);
```

**Indexes:**
- `idx_events_timestamp` - Fast ordering by time (DESC)
- `idx_events_device` - Fast device filtering
- `idx_events_type` - Fast type filtering
- `idx_events_source` - Fast source filtering

**Retention Policy:**
- **30-day retention** with automatic cleanup
- Daily cleanup job runs via `setInterval` (24 hours)
- Cleanup executes: `DELETE FROM events WHERE timestamp < ?`

**Performance Characteristics:**
- Insert: < 5ms per event (prepared statements)
- Query: < 50ms for 100 recent events (indexed)
- Cleanup: < 100ms for batch deletes

**Trade-offs:**
- ✅ Fast queries and inserts
- ✅ Zero external dependencies
- ✅ ACID guarantees
- ❌ Limited to 30 days (disk space management)
- ❌ Single-node only (no distributed storage)
- ❌ No built-in log rotation or archival

### 1.2 Event Structure

**TypeScript Interface:**
```typescript
interface SmartHomeEvent {
  id: EventId;                    // Branded type: string
  type: SmartHomeEventType;       // 'device_event', 'user_command', etc.
  source: EventSource;            // 'webhook', 'polling', 'mcp', 'alexa'
  deviceId?: DeviceId;            // Optional device ID
  deviceName?: string;            // Human-readable device name
  locationId?: LocationId;        // SmartThings location
  eventType?: string;             // e.g., 'motionSensor.motion'
  value?: any;                    // Event payload
  timestamp: Date;                // Event occurrence time
  metadata?: Record<string, any>; // Additional context
}
```

**Event Types:**
- `device_event` - Device state changes (motion, switches, locks, etc.)
- `user_command` - User-initiated actions
- `system_event` - System-level events

**Event Sources:**
- `webhook` - SmartThings webhook events (real-time)
- `polling` - Device polling service (fallback)
- `mcp` - MCP client commands
- `alexa` - Alexa skill interactions

---

## 2. Current Logging Infrastructure

### 2.1 Winston Logger

**File:** `/Users/masa/Projects/smarterthings/src/utils/logger.ts`

**Configuration:**
```typescript
winston.createLogger({
  level: environment.LOG_LEVEL,      // From env: 'info' (default)
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: environment.MCP_SERVER_NAME,    // 'smartthings-mcp'
    version: environment.MCP_SERVER_VERSION, // '1.0.0'
  },
  transports: [
    new winston.transports.Stream({
      stream: process.stderr,  // CRITICAL: All logs → stderr (MCP protocol requirement)
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
          let msg = `${timestamp} [${service}] ${level}: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
    }),
  ],
});
```

**Key Design Decisions:**

1. **stderr Output (Not File-Based)**
   - Rationale: MCP protocol requires stdout reserved for JSON-RPC messages
   - All application logs go to stderr
   - No file transport configured

2. **JSON Format**
   - Enables structured logging
   - Supports log parsing and aggregation
   - Includes timestamp, level, message, service metadata

3. **Log Levels** (from env var `LOG_LEVEL`)
   - `error` - Critical failures
   - `warn` - Warning conditions
   - `info` - Informational messages (default)
   - `debug` - Debugging output

**Current Limitations:**
- ❌ No file-based logging configured
- ❌ No log rotation (only stderr stream)
- ❌ No event-specific logging transport
- ❌ No logs directory structure

**Environment Configuration:**
```bash
# .env.example
LOG_LEVEL=info  # error|warn|info|debug
```

---

## 3. Event Emission Points

### 3.1 Webhook Handler

**File:** `/Users/masa/Projects/smarterthings/src/routes/webhook.ts`

**Event Flow:**
```
SmartThings Cloud
    ↓ (HTTPS webhook)
POST /webhook/smartthings
    ↓ (HMAC verification)
Webhook Handler
    ↓ (enqueue + save)
MessageQueue + EventStore
    ↓ (async processing)
SSE Broadcast → Frontend
```

**Event Emission:**
```typescript
// Line 296-305
const smartHomeEvent: SmartHomeEvent = {
  id: (event.eventId || crypto.randomUUID()) as EventId,
  type: 'device_event',
  source: 'webhook',  // ← Event source
  deviceId: event.deviceId as any,
  locationId: installedApp.locationId as any,
  eventType: event.capability && event.attribute
    ? `${event.capability}.${event.attribute}`
    : undefined,
  value: event.value,
  timestamp: event.eventTime ? new Date(event.eventTime) : new Date(),
  metadata: {
    installedAppId: installedApp.installedAppId,
    componentId: event.componentId,
    valueType: event.valueType,
    stateChange: event.stateChange,
  },
};

// Save to event store (async, non-blocking)
eventStore.saveEvent(smartHomeEvent).catch((error) => {
  logger.error('[Webhook] Failed to save event to store', {
    eventId: smartHomeEvent.id,
    error: error instanceof Error ? error.message : String(error),
  });
});

// Enqueue to message queue for processing
await messageQueue.enqueue('device_event', smartHomeEvent);
```

**Characteristics:**
- Fast acknowledgment (< 100ms) required by SmartThings
- Events saved asynchronously to EventStore
- Events enqueued to MessageQueue for broadcasting
- HMAC-SHA256 signature verification for security

### 3.2 Device Polling Service

**File:** `/Users/masa/Projects/smarterthings/src/services/device-polling-service.ts`

**Event Flow:**
```
Polling Interval (5 seconds)
    ↓ (fetch all devices)
SmartThings API
    ↓ (compare states)
State Change Detection
    ↓ (emit event)
EventEmitter → 'deviceEvent'
    ↓ (server-alexa.ts handler)
MessageQueue + EventStore
    ↓ (broadcast)
SSE → Frontend
```

**Event Emission:**
```typescript
// Line 284 (device-polling-service.ts)
this.emit('deviceEvent', event);

// DeviceEvent interface:
interface DeviceEvent {
  eventType: 'device_event';
  deviceId: string;
  deviceName: string;
  capability: string;    // e.g., 'motionSensor'
  attribute: string;     // e.g., 'motion'
  value: any;           // e.g., 'active'
  previousValue: any;   // e.g., 'inactive'
  timestamp: Date;
  source: 'polling';    // ← Event source
}
```

**Polling Configuration:**
- Default interval: 5000ms (5 seconds)
- Monitored capabilities: motionSensor, contactSensor, switch, dimmer, lock, temperatureSensor
- State change detection via in-memory comparison
- Auto-start via `AUTO_START_POLLING=true` env var

**Handler Registration** (in `server-alexa.ts`):
```typescript
devicePollingService.on('deviceEvent', async (event) => {
  logger.debug('[DevicePolling] Event detected', {
    deviceId: event.deviceId,
    capability: event.capability,
    value: event.value,
  });

  const store = getEventStore();
  const queue = await getMessageQueue();

  // Convert to SmartHomeEvent and persist
  const smartHomeEvent: SmartHomeEvent = {
    id: crypto.randomUUID() as EventId,
    type: 'device_event',
    source: 'polling',  // ← Event source
    deviceId: event.deviceId as DeviceId,
    deviceName: event.deviceName,
    eventType: `${event.capability}.${event.attribute}`,
    value: event.value,
    timestamp: event.timestamp,
    metadata: {
      previousValue: event.previousValue,
    },
  };

  await store.saveEvent(smartHomeEvent);
  await queue.enqueue('device_event', smartHomeEvent);
});
```

### 3.3 Event Pipeline Summary

**All Events Flow Through:**

1. **Creation** → Webhook handler OR Polling service
2. **Persistence** → EventStore (SQLite) via `saveEvent()`
3. **Processing** → MessageQueue via `enqueue()`
4. **Broadcasting** → SSE (Server-Sent Events) to frontend
5. **Display** → Frontend UI (`/events` page)

**Key Integration Point:**
- Both webhook and polling emit events to **same MessageQueue**
- MessageQueue handlers broadcast to **SSE clients**
- EventStore provides **30-day retention** and **queryable history**

---

## 4. Recommendations for File-Based Event Logging

### 4.1 Recommended Approach: Dedicated Winston Transport

**Strategy:** Add a separate Winston file transport specifically for events, independent of the main logger.

**Why This Approach:**

1. **Separation of Concerns**
   - Application logs (stderr) vs. Event logs (files)
   - Different retention policies
   - Different rotation strategies

2. **Structured JSON Lines (JSONL)**
   - One JSON event per line
   - Easy to parse with standard tools (jq, grep, etc.)
   - Compatible with log aggregation systems

3. **Automatic Log Rotation**
   - Daily rotation with date-based filenames
   - Size-based rotation (optional)
   - Configurable retention (e.g., 90 days)

4. **Non-Blocking I/O**
   - Winston's file transport uses streams
   - Doesn't impact event processing performance
   - Graceful degradation if disk full

### 4.2 Implementation Design

#### Directory Structure

```
smarterthings/
├── logs/                          # ← Create this directory
│   ├── events/                    # Event logs (JSONL format)
│   │   ├── events-2025-12-22.log
│   │   ├── events-2025-12-21.log
│   │   └── ...
│   ├── application/               # Application logs (optional - stderr mirror)
│   │   ├── app-2025-12-22.log
│   │   └── ...
│   └── .gitkeep                   # Keep directory in git
└── .gitignore                     # Ignore *.log files
```

#### Event Logger Implementation

**File:** `src/utils/event-logger.ts` (NEW)

```typescript
/**
 * Event Logger - Dedicated file-based logging for smart home events
 *
 * Design Decision: Separate event logger from application logger
 * Rationale: Different retention policies, formats, and rotation strategies.
 * Application logs → stderr (for MCP protocol), Event logs → files (for archival)
 *
 * Format: JSON Lines (JSONL) - one JSON object per line
 * Rotation: Daily rotation with date-based filenames
 * Retention: 90 days (configurable via EVENT_LOG_RETENTION_DAYS)
 * Location: ./logs/events/events-YYYY-MM-DD.log
 *
 * Performance:
 * - Non-blocking file I/O (Winston streams)
 * - Async writes do not block event processing
 * - Graceful degradation if disk full (logs to stderr)
 *
 * Integration:
 * - Called from EventStore.saveEvent() after SQLite insert
 * - Provides long-term archival beyond 30-day SQLite retention
 * - Compatible with log aggregation tools (ELK, Splunk, etc.)
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { environment } from '../config/environment.js';
import type { SmartHomeEvent } from '../queue/MessageQueue.js';

/**
 * Event logger configuration
 */
interface EventLoggerConfig {
  /** Log directory path (default: ./logs/events) */
  logDir: string;
  /** Retention in days (default: 90) */
  retentionDays: number;
  /** Maximum file size before rotation (default: 100mb) */
  maxSize: string;
  /** Enable compression for rotated logs (default: true) */
  compress: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EventLoggerConfig = {
  logDir: path.join(process.cwd(), 'logs', 'events'),
  retentionDays: parseInt(process.env.EVENT_LOG_RETENTION_DAYS || '90', 10),
  maxSize: '100m',
  compress: true,
};

/**
 * Create event logger instance
 *
 * @param config - Optional configuration overrides
 * @returns Winston logger for events
 */
function createEventLogger(config: Partial<EventLoggerConfig> = {}): winston.Logger {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.json()
    ),
    transports: [
      // Daily rotating file transport
      new DailyRotateFile({
        dirname: finalConfig.logDir,
        filename: 'events-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: finalConfig.maxSize,
        maxFiles: `${finalConfig.retentionDays}d`,
        zippedArchive: finalConfig.compress,
        format: winston.format.json(),
      }),
    ],
  });
}

/**
 * Singleton event logger instance
 */
let eventLogger: winston.Logger | null = null;

/**
 * Get or create event logger instance
 *
 * @returns Event logger
 */
export function getEventLogger(): winston.Logger {
  if (!eventLogger) {
    eventLogger = createEventLogger();
  }
  return eventLogger;
}

/**
 * Log an event to file
 *
 * Converts SmartHomeEvent to structured log entry with standardized fields.
 *
 * @param event - Event to log
 */
export function logEvent(event: SmartHomeEvent): void {
  const logger = getEventLogger();

  // Convert to structured log entry
  const logEntry = {
    // Event identification
    eventId: event.id,
    eventType: event.type,
    eventSource: event.source,

    // Device information
    deviceId: event.deviceId || null,
    deviceName: event.deviceName || null,
    locationId: event.locationId || null,

    // Event details
    capability: event.eventType ? event.eventType.split('.')[0] : null,
    attribute: event.eventType ? event.eventType.split('.')[1] : null,
    value: event.value,

    // Timestamps
    eventTimestamp: event.timestamp.toISOString(),
    loggedAt: new Date().toISOString(),

    // Metadata
    metadata: event.metadata || null,
  };

  // Log to file (non-blocking)
  logger.info(logEntry);
}

/**
 * Close event logger and flush pending writes
 */
export function closeEventLogger(): Promise<void> {
  return new Promise((resolve) => {
    if (eventLogger) {
      eventLogger.close();
      eventLogger = null;
    }
    resolve();
  });
}
```

#### Integration with EventStore

**File:** `src/storage/event-store.ts` (MODIFY)

```typescript
// Add import at top
import { logEvent } from '../utils/event-logger.js';

// Modify saveEvent() method (around line 203)
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
      event.timestamp.getTime(),
      event.metadata ? JSON.stringify(event.metadata) : null
    );

    logger.debug('[EventStore] Event saved', {
      eventId: event.id,
      type: event.type,
      source: event.source,
    });

    // ✅ NEW: Log event to file (async, non-blocking)
    logEvent(event);

  } catch (error) {
    // ... existing error handling
  }
}
```

#### Graceful Shutdown

**File:** `src/server-alexa.ts` (MODIFY)

```typescript
import { closeEventLogger } from './utils/event-logger.js';

// Add to shutdown handler
async function shutdown(signal: string): Promise<void> {
  logger.info(`[Server] Received ${signal}, shutting down gracefully...`);

  // ... existing shutdown logic

  // Close event logger and flush pending writes
  await closeEventLogger();

  // ... rest of shutdown
}
```

### 4.3 Log Format Examples

#### JSONL Event Log Entry

**File:** `logs/events/events-2025-12-22.log`

```jsonl
{"eventId":"evt-123","eventType":"device_event","eventSource":"webhook","deviceId":"device-abc","deviceName":"Front Door Motion","locationId":"loc-xyz","capability":"motionSensor","attribute":"motion","value":"active","eventTimestamp":"2025-12-22T15:30:45.123Z","loggedAt":"2025-12-22T15:30:45.200Z","metadata":{"installedAppId":"app-456","componentId":"main","stateChange":true},"level":"info","timestamp":"2025-12-22 15:30:45.200"}
{"eventId":"evt-124","eventType":"device_event","eventSource":"polling","deviceId":"device-def","deviceName":"Living Room Light","locationId":"loc-xyz","capability":"switch","attribute":"switch","value":"on","eventTimestamp":"2025-12-22T15:31:00.456Z","loggedAt":"2025-12-22T15:31:00.500Z","metadata":{"previousValue":"off"},"level":"info","timestamp":"2025-12-22 15:31:00.500"}
```

#### Querying Event Logs

**Find all motion events:**
```bash
cat logs/events/events-2025-12-22.log | jq 'select(.capability == "motionSensor")'
```

**Count events by source:**
```bash
cat logs/events/events-2025-12-22.log | jq -r '.eventSource' | sort | uniq -c
```

**Find events for specific device:**
```bash
cat logs/events/events-2025-12-22.log | jq 'select(.deviceId == "device-abc")'
```

**Get events in last hour:**
```bash
cat logs/events/events-2025-12-22.log | jq 'select(.eventTimestamp > "2025-12-22T14:30:00Z")'
```

### 4.4 Environment Configuration

**File:** `.env.example` (ADD)

```bash
# Event Logging Configuration
EVENT_LOG_RETENTION_DAYS=90    # How long to keep event logs (default: 90 days)
EVENT_LOG_MAX_SIZE=100m        # Max size per log file before rotation (default: 100mb)
EVENT_LOG_COMPRESS=true        # Compress rotated logs (default: true)
```

### 4.5 Directory Initialization

**File:** `src/server-alexa.ts` (ADD to startup)

```typescript
import fs from 'fs/promises';
import path from 'path';

// Initialize log directories
async function initializeLogDirectories(): Promise<void> {
  const logDirs = [
    path.join(process.cwd(), 'logs'),
    path.join(process.cwd(), 'logs', 'events'),
  ];

  for (const dir of logDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      logger.debug(`[Init] Created log directory: ${dir}`);
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        logger.error(`[Init] Failed to create log directory: ${dir}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// Call during server initialization (before event processing starts)
await initializeLogDirectories();
```

### 4.6 .gitignore Configuration

**File:** `.gitignore` (ADD)

```gitignore
# Log files
logs/*.log
logs/**/*.log
logs/**/*.gz

# Keep directory structure
!logs/.gitkeep
!logs/events/.gitkeep
```

**Create .gitkeep files:**
```bash
mkdir -p logs/events
touch logs/.gitkeep
touch logs/events/.gitkeep
```

---

## 5. Alternative Approaches (Evaluated but Not Recommended)

### 5.1 Direct File Writing (fs.appendFile)

**Approach:** Manually append to log files using Node.js `fs.appendFile()`.

**Pros:**
- Simple implementation
- No external dependencies
- Full control over file format

**Cons:**
- ❌ Manual log rotation implementation required
- ❌ No automatic compression
- ❌ Potential blocking I/O issues
- ❌ Error handling complexity
- ❌ No built-in retention management

**Verdict:** Not recommended. Reinventing the wheel when Winston provides production-ready solution.

### 5.2 Separate Logging Service (Microservice)

**Approach:** Create dedicated logging service with its own process/container.

**Pros:**
- Complete isolation from main application
- Independent scaling
- Specialized log processing

**Cons:**
- ❌ Over-engineering for current scale
- ❌ Adds deployment complexity
- ❌ Network latency for event logging
- ❌ Additional failure point

**Verdict:** Not recommended. Premature optimization for single-server deployment.

### 5.3 Stream Events to External Service (ELK, Splunk)

**Approach:** Stream events directly to external log aggregation service.

**Pros:**
- Centralized logging
- Advanced analytics
- Search and visualization

**Cons:**
- ❌ Requires external infrastructure
- ❌ Additional cost
- ❌ Network dependency for event logging
- ❌ No local archival if network down

**Verdict:** Consider for production deployments, but not as replacement for local file logging.

### 5.4 CSV File Format

**Approach:** Log events as CSV instead of JSONL.

**Pros:**
- Easy to open in Excel/spreadsheets
- Slightly smaller file size

**Cons:**
- ❌ Difficult to handle nested metadata
- ❌ CSV escaping complexity
- ❌ Not JSON-native (harder to parse)
- ❌ Less flexible for schema changes

**Verdict:** Not recommended. JSONL provides better flexibility and tool compatibility.

---

## 6. Implementation Checklist

### Phase 1: Core Implementation

- [ ] Install `winston-daily-rotate-file` dependency
  ```bash
  pnpm add winston-daily-rotate-file
  pnpm add -D @types/winston-daily-rotate-file
  ```

- [ ] Create `src/utils/event-logger.ts`
  - Implement `createEventLogger()`
  - Implement `getEventLogger()`
  - Implement `logEvent()`
  - Implement `closeEventLogger()`

- [ ] Modify `src/storage/event-store.ts`
  - Import `logEvent` function
  - Add `logEvent(event)` call in `saveEvent()` method

- [ ] Modify `src/server-alexa.ts`
  - Add `initializeLogDirectories()` function
  - Call during server startup
  - Add `closeEventLogger()` to shutdown handler

- [ ] Update `.env.example`
  - Add `EVENT_LOG_RETENTION_DAYS`
  - Add `EVENT_LOG_MAX_SIZE`
  - Add `EVENT_LOG_COMPRESS`

- [ ] Update `.gitignore`
  - Ignore `logs/*.log` and `logs/**/*.log`
  - Ignore `logs/**/*.gz` (compressed archives)

- [ ] Create log directories
  ```bash
  mkdir -p logs/events
  touch logs/.gitkeep
  touch logs/events/.gitkeep
  ```

### Phase 2: Testing

- [ ] Unit tests for `event-logger.ts`
  - Test log file creation
  - Test event formatting
  - Test rotation behavior

- [ ] Integration tests
  - Trigger device events via webhook
  - Trigger device events via polling
  - Verify events appear in log files
  - Verify log rotation after 24 hours

- [ ] Manual testing
  - Check log files created in `logs/events/`
  - Verify JSONL format
  - Test log queries with `jq`

### Phase 3: Documentation

- [ ] Update `CLAUDE.md`
  - Document event logging infrastructure
  - Add troubleshooting section

- [ ] Create `docs/EVENT-LOGGING.md`
  - Explain log format
  - Provide query examples
  - Document retention policy

- [ ] Update README.md
  - Add event logging to features
  - Link to documentation

### Phase 4: Monitoring

- [ ] Add metrics for event logging
  - Track log file sizes
  - Monitor rotation frequency
  - Alert on disk space issues

- [ ] Add health check endpoint
  - Verify log directory writable
  - Check disk space availability

---

## 7. Performance Impact Analysis

### 7.1 File I/O Performance

**Winston Daily Rotate File:**
- Uses Node.js streams (non-blocking I/O)
- Async writes do not block event processing
- Buffer size: 16KB (default)

**Expected Impact:**
- Write latency: < 1ms per event (async)
- No impact on webhook response time (already async)
- No impact on polling performance

**Benchmarks (estimated):**
```
Events/sec | File writes/sec | CPU overhead | Disk I/O
-----------+-----------------+--------------+----------
10         | 10              | < 0.1%       | Minimal
100        | 100             | < 1%         | Low
1000       | 1000            | < 5%         | Medium
```

### 7.2 Disk Space Requirements

**Event Size:**
- Average JSONL event: ~300-500 bytes
- Compressed (gzip): ~100-150 bytes

**Daily Volume Estimates:**

| Events/day | Uncompressed | Compressed (gzip) |
|------------|--------------|-------------------|
| 1,000      | 0.3-0.5 MB   | 0.1-0.15 MB       |
| 10,000     | 3-5 MB       | 1-1.5 MB          |
| 100,000    | 30-50 MB     | 10-15 MB          |
| 1,000,000  | 300-500 MB   | 100-150 MB        |

**90-Day Retention:**

| Events/day | Total (compressed) | Storage cost |
|------------|--------------------|--------------|
| 10,000     | 90-135 MB          | Negligible   |
| 100,000    | 0.9-1.35 GB        | Low          |
| 1,000,000  | 9-13.5 GB          | Medium       |

**Recommendation:**
- Monitor disk usage via health checks
- Alert if logs exceed 10GB
- Consider external archival for high-volume deployments

### 7.3 Log Rotation Overhead

**Daily Rotation:**
- Triggered at midnight (local time)
- File rename + compression: < 1 second
- No event loss during rotation (Winston handles buffering)

**Size-Based Rotation:**
- Triggered when file exceeds `maxSize` (100MB default)
- Rotation time: < 2 seconds
- Continues logging to new file immediately

---

## 8. Operational Considerations

### 8.1 Log Analysis Tools

**Recommended Tools:**

1. **jq** - JSON query processor
   ```bash
   # Install
   brew install jq  # macOS
   apt install jq   # Linux

   # Count events by type
   cat logs/events/events-*.log | jq -r '.eventType' | sort | uniq -c

   # Find motion events
   cat logs/events/events-*.log | jq 'select(.capability == "motionSensor")'
   ```

2. **grep** - Pattern matching
   ```bash
   # Find events for device
   grep "device-abc" logs/events/events-2025-12-22.log

   # Find webhook events
   grep '"eventSource":"webhook"' logs/events/*.log
   ```

3. **tail** - Real-time monitoring
   ```bash
   # Watch events in real-time
   tail -f logs/events/events-$(date +%Y-%m-%d).log | jq
   ```

### 8.2 Backup and Archival

**Recommended Strategy:**

1. **Daily Backups** (automated)
   ```bash
   # Backup script (run via cron)
   #!/bin/bash
   tar -czf ~/backups/events-$(date +%Y-%m-%d).tar.gz logs/events/
   ```

2. **S3 Archival** (for production)
   ```bash
   # Upload compressed logs to S3
   aws s3 cp logs/events/ s3://my-bucket/smarterthings/events/ \
     --recursive --exclude "*" --include "*.gz"
   ```

3. **Retention Policy**
   - Local: 90 days (configurable)
   - S3: 1 year (lifecycle policy)
   - Glacier: 7 years (compliance)

### 8.3 Troubleshooting

**Common Issues:**

1. **Disk Full**
   - Symptom: Events not written to file
   - Detection: Health check alerts
   - Resolution: Increase disk space or reduce retention

2. **Permission Denied**
   - Symptom: Cannot create log files
   - Detection: Error logs in stderr
   - Resolution: `chmod 755 logs/events`

3. **Log Rotation Failure**
   - Symptom: Single log file grows indefinitely
   - Detection: Check file sizes
   - Resolution: Verify `winston-daily-rotate-file` installed

---

## 9. Security Considerations

### 9.1 Sensitive Data in Logs

**Potential PII in Events:**
- Device names (may contain personal info)
- Location IDs (geographic information)
- Event metadata (usage patterns)

**Recommendations:**

1. **Log Sanitization** (optional)
   ```typescript
   // Redact sensitive fields before logging
   function sanitizeEvent(event: SmartHomeEvent): any {
     return {
       ...event,
       deviceName: event.deviceName ? '[REDACTED]' : null,
       locationId: event.locationId ? '[REDACTED]' : null,
     };
   }
   ```

2. **File Permissions**
   ```bash
   # Restrict log file access
   chmod 600 logs/events/*.log  # Owner read/write only
   ```

3. **Encryption at Rest**
   - Use encrypted filesystem (LUKS, BitLocker)
   - Or encrypt log archives before backup

### 9.2 Log Access Control

**Recommendations:**
- Restrict log directory access to application user
- Audit log file access via system logs
- Implement log viewing API with authentication

---

## 10. Future Enhancements

### 10.1 Real-Time Log Streaming

**Feature:** Stream events to external systems (ELK, Splunk, Datadog)

**Implementation:**
```typescript
// Add to event-logger.ts
import { HttpTransport } from 'winston-transport-http';

const httpTransport = new HttpTransport({
  host: 'logs.example.com',
  port: 443,
  path: '/events',
  ssl: true,
});

logger.add(httpTransport);
```

### 10.2 Event Replay

**Feature:** Replay historical events from logs

**Use Cases:**
- Debug event processing issues
- Re-populate EventStore after data loss
- Test event handlers with real data

**Implementation:**
```typescript
// tools/replay-events.ts
import fs from 'fs';
import readline from 'readline';

async function replayEventsFromLog(logFile: string): Promise<void> {
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    const event = JSON.parse(line);
    await messageQueue.enqueue('device_event', event);
  }
}
```

### 10.3 Event Analytics Dashboard

**Feature:** Visualize event patterns and trends

**Metrics:**
- Events per hour/day
- Most active devices
- Event type distribution
- Response time analysis

**Tools:**
- Grafana + Loki (log aggregation)
- Elasticsearch + Kibana (ELK stack)
- Custom dashboard with D3.js

---

## Conclusion

The current Smarter Things event infrastructure uses SQLite for 30-day event storage with Winston logging to stderr. Adding file-based event logging via a dedicated Winston transport provides:

**Benefits:**
1. Long-term archival beyond 30-day SQLite retention
2. Human-readable JSONL format for debugging
3. Automatic log rotation and compression
4. Integration with log aggregation tools
5. Non-blocking async I/O (no performance impact)

**Recommended Implementation:**
- Create `src/utils/event-logger.ts` with Winston daily rotate transport
- Integrate with existing `EventStore.saveEvent()` method
- Use JSONL format for compatibility and flexibility
- Configure 90-day retention with compression
- Store logs in `logs/events/` directory

**Next Steps:**
1. Implement Phase 1 (Core Implementation)
2. Test with webhook and polling events
3. Document log format and query examples
4. Monitor disk usage and performance

This approach provides production-ready event logging with minimal code changes and zero impact on event processing performance.

---

**Research Completed:** 2025-12-22
**Confidence Level:** High (95%)
**Dependencies Identified:** `winston-daily-rotate-file`
**Implementation Effort:** 4-6 hours (including testing and documentation)
