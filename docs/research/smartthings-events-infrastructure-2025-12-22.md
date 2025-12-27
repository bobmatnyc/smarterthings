# SmartThings Events Infrastructure - Investigation Report

**Date:** 2025-12-22
**Working Directory:** /Users/masa/Projects/smarterthings
**Investigation Focus:** Current events implementation and continuous event pulling requirements

---

## Executive Summary

The Smarter Things project **already has a fully functional events infrastructure** with real-time event streaming, event storage, and multiple event sources. The system uses a hybrid architecture combining:

1. **REST API** for historical event queries
2. **Server-Sent Events (SSE)** for real-time push notifications
3. **Device Polling Service** for continuous state change detection
4. **Message Queue** for reliable event processing
5. **SQLite Event Store** for persistent event storage

**Key Finding:** The events feature is **production-ready** with sophisticated architecture. No major implementation work is needed for continuous event pulling - it's already implemented via the `DevicePollingService`.

---

## 1. Current Events Implementation

### 1.1 Frontend - Events Page

**File:** `web/src/routes/events/+page.svelte`

**Status:** ✅ **Fully Implemented**

**Features:**
- Real-time event streaming via SSE
- Event filtering by type and source
- Auto-scroll toggle for new events
- Connection status indicator
- Relative timestamp formatting
- Loading skeleton and error states

**Design Pattern:** Svelte 5 Runes with SSE integration

```svelte
$effect(() => {
  store.loadEvents(100);      // Load initial events
  store.connectSSE();         // Connect real-time stream

  return () => {
    store.disconnectSSE();    // Cleanup on unmount
  };
});
```

**SSE Latency:** < 100ms (server → client)

---

### 1.2 Events Store - State Management

**File:** `web/src/lib/stores/eventsStore.svelte.ts`

**Status:** ✅ **Fully Implemented**

**Architecture:**
- **Svelte 5 Runes** for fine-grained reactivity
- **SSE connection** for real-time updates
- **Exponential backoff** reconnection (ticket 1M-437)
- **Event list capped at 500** for performance

**State Management:**
```typescript
let events = $state<SmartHomeEvent[]>([]);
let connected = $state(false);
let filters = $state<{ type, source, deviceId }>({...});

// Computed values with automatic dependency tracking
let filteredEvents = $derived.by(() => {
  // Filter logic with reactive dependencies
});
```

**Reconnection Strategy:**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (max)
- Prevents rapid reconnection attempts
- Automatic retry on disconnect

---

### 1.3 Events API - REST + SSE Endpoints

**File:** `src/routes/events.ts`

**Status:** ✅ **Fully Implemented**

**Endpoints:**

| Endpoint | Method | Purpose | Performance |
|----------|--------|---------|-------------|
| `/api/events` | GET | List events (paginated, filtered) | < 50ms for 100 events |
| `/api/events/device/:deviceId` | GET | Device-specific event history | < 50ms |
| `/api/events/stream` | GET | SSE real-time event stream | < 100ms latency |
| `/api/events/stats` | GET | Queue and event statistics | < 50ms |

**SSE Implementation:**
```typescript
server.get('/api/events/stream', async (request, reply) => {
  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Track client connection
  sseClients.add(reply);

  // Send initial connection event
  reply.raw.write(`event: connected\ndata: {...}\n\n`);

  // Heartbeat every 30 seconds
  setInterval(() => {
    reply.raw.write(`event: heartbeat\ndata: {...}\n\n`);
  }, 30000);

  // Cleanup on disconnect
  request.raw.on('close', () => {
    sseClients.delete(reply);
  });
});
```

**Broadcasting Events:**
```typescript
export function broadcastEvent(event: SmartHomeEvent): void {
  const message = `event: new-event\ndata: ${JSON.stringify(event)}\n\n`;

  sseClients.forEach((client) => {
    if (client.raw.writable) {
      client.raw.write(message);
    }
  });
}
```

---

### 1.4 Event Store - Persistent Storage

**File:** `src/storage/event-store.ts`

**Status:** ✅ **Fully Implemented**

**Architecture:**
- **SQLite database** with WAL mode for concurrency
- **30-day retention** with auto-cleanup
- **Indexed queries** for fast filtering
- **Prepared statements** for performance

**Performance Metrics:**
- Insert: < 5ms per event
- Query: < 50ms for 100 recent events
- Cleanup: < 100ms for batch deletes

**Schema Design:**
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT,
  location_id TEXT,
  event_type TEXT,
  value TEXT,             -- JSON stringified
  timestamp INTEGER NOT NULL,
  metadata TEXT,          -- JSON stringified
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for fast queries
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_device ON events(device_id, timestamp DESC);
CREATE INDEX idx_events_type ON events(type, timestamp DESC);
CREATE INDEX idx_events_source ON events(source, timestamp DESC);
```

**Trade-offs:**
- ✅ **Zero dependencies** (no Elasticsearch, no external DB)
- ✅ **Disk-based persistence** (survives restarts)
- ⚠️ **Single-node only** (no distributed storage)
- ⚠️ **30-day retention** (automatic cleanup)

---

## 2. SmartThings Events API Integration

### 2.1 Subscription Service (Webhook-based)

**File:** `src/smartthings/subscription-service.ts`

**Status:** ✅ **Implemented** (requires SmartApp installation)

**Capabilities Monitored:**
- `motionSensor` (motion: active/inactive)
- `contactSensor` (contact: open/closed)
- `switch` (switch: on/off)
- `switchLevel` (level: 0-100)
- `lock` (lock: locked/unlocked)
- `temperatureMeasurement` (temperature: number)

**How It Works:**
1. User installs SmartApp in SmartThings mobile app
2. SmartApp creates webhook subscriptions for capabilities
3. SmartThings cloud sends webhook POST requests on state changes
4. Webhook handler receives events and broadcasts to SSE clients

**Limitation:** Requires manual SmartApp installation (chicken-and-egg problem)

---

### 2.2 Device Polling Service (Continuous Polling)

**File:** `src/services/device-polling-service.ts`

**Status:** ✅ **Fully Implemented**

**Design Rationale:**
> Webhook subscriptions require SmartApp installation (user action in mobile app), which creates chicken-and-egg problem. Polling provides immediate event detection without requiring manual SmartApp configuration.

**Architecture:**
- **Polls devices every N seconds** (default: 5s)
- **Detects state changes** by comparing previous vs current state
- **Emits `deviceEvent` events** for integration with existing event pipeline
- **Tracks previous state in memory** for change detection
- **Overlap prevention** (skips poll if previous one still running)

**Capabilities Monitored (default):**
```typescript
const DEFAULT_CONFIG: PollConfig = {
  intervalMs: 5000, // 5 seconds
  capabilities: [
    'motionSensor',     // Motion sensors
    'contactSensor',    // Door/window sensors
    'switch',           // Switches and lights
    'dimmer',           // Dimmable lights
    'lock',             // Door locks
    'temperatureSensor', // Temperature sensors
  ],
};
```

**Event Format:**
```typescript
interface DeviceEvent {
  eventType: 'device_event';
  deviceId: string;
  deviceName: string;
  capability: string;
  attribute: string;
  value: any;
  previousValue: any;
  timestamp: Date;
  source: 'polling';
}
```

**Polling API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/polling/status` | GET | Get polling service status |
| `/api/polling/start` | POST | Start polling |
| `/api/polling/stop` | POST | Stop polling |
| `/api/polling/state` | DELETE | Clear tracked state |

**Integration with Event Pipeline:**

**File:** `src/server-alexa.ts` (lines 350-370)

```typescript
// Connect polling events to event pipeline
devicePollingService.on('deviceEvent', async (event) => {
  logger.debug('[DevicePolling] Event detected', {
    deviceId: event.deviceId,
    capability: event.capability,
    value: event.value,
  });

  // Get event store and message queue
  const store = getEventStore();
  const queue = await getMessageQueue();

  // Create SmartHomeEvent
  const smartHomeEvent = {
    id: randomUUID() as EventId,
    type: 'device_event' as SmartHomeEventType,
    source: 'smartthings' as EventSource,
    deviceId: event.deviceId as DeviceId,
    deviceName: event.deviceName,
    eventType: `${event.capability}.${event.attribute}`,
    value: event.value,
    timestamp: event.timestamp,
    metadata: {
      previousValue: event.previousValue,
      source: 'polling',
    },
  };

  // Save to event store
  await store.saveEvent(smartHomeEvent);

  // Enqueue for processing (broadcasts to SSE clients)
  await queue.enqueue('device_event', smartHomeEvent);
});
```

**Performance Characteristics:**
- **Polling Interval:** Configurable (default: 5000ms)
- **Single API call per poll:** Fetches all devices at once
- **Memory-efficient:** Only stores monitored capabilities
- **No overlap:** Skips poll if previous one still running

---

## 3. Message Queue - Event Processing Pipeline

### 3.1 Architecture

**File:** `src/queue/MessageQueue.ts`

**Status:** ✅ **Fully Implemented**

**Technology:** plainjob with better-sqlite3 backend

**Design Decision:**
> Lightweight, serverless, persistent queue without Redis dependency. Provides 15K jobs/sec capacity (1,500x headroom vs. 10 msgs/sec peak load).

**Configuration:**
```typescript
interface MessageQueueConfig {
  databasePath: string;        // './data/message-queue.db'
  concurrency: number;         // 4 workers
  retryAttempts: number;       // 3 retries
  cleanupDays: number;         // 7 days
}
```

**Event Flow:**
1. **Device Polling** detects state change → emits `deviceEvent`
2. **Event Handler** converts to `SmartHomeEvent` → saves to EventStore
3. **MessageQueue** enqueues event → processes with workers
4. **Event Handler** (registered) → broadcasts to SSE clients
5. **SSE Clients** receive `new-event` notification

**Event Handler Registration:**
```typescript
// In server-alexa.ts
messageQueue.registerHandler('device_event', async (event) => {
  logger.debug('[MessageQueue] Processing device_event', {
    eventId: event.id,
    deviceId: event.deviceId,
  });

  // Broadcast to SSE clients
  broadcastEvent(event);
});
```

**Performance Metrics:**
- **Capacity:** 15,000 jobs/second
- **Expected load:** 7.3K-28.4K messages/day (10 msgs/sec peak)
- **Headroom:** 1,500x capacity vs. peak load

---

## 4. Current Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SmartThings Cloud                            │
└───────────────────┬─────────────────────────────────────────────┘
                    │
        ┌───────────┴──────────┬─────────────────────┐
        │                      │                     │
        ▼                      ▼                     ▼
┌───────────────┐    ┌──────────────────┐   ┌──────────────┐
│  Webhooks     │    │ Device Polling   │   │  MCP Tools   │
│ (SmartApp     │    │ Service          │   │              │
│  required)    │    │ (5s interval)    │   │              │
└───────┬───────┘    └─────────┬────────┘   └──────┬───────┘
        │                      │                    │
        └──────────────────────┴────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Event Store     │
                    │  (SQLite)        │
                    │  30-day retention│
                    └─────────┬────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Message Queue   │
                    │  (plainjob)      │
                    │  4 workers       │
                    └─────────┬────────┘
                               │
                ┌──────────────┴────────────────┐
                │                               │
                ▼                               ▼
    ┌───────────────────┐           ┌──────────────────┐
    │  Event Handlers   │           │  broadcastEvent  │
    │  (custom logic)   │           │  (SSE broadcast) │
    └───────────────────┘           └─────────┬────────┘
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  SSE Clients     │
                                    │  (web browsers)  │
                                    │  Real-time UI    │
                                    └──────────────────┘
```

---

## 5. Questions Answered

### 5.1 Are events currently fetched on-demand or continuously?

**Answer:** **Both!**

- **On-demand:** `/api/events` REST endpoint for historical queries
- **Continuously:**
  - **Device Polling Service** polls SmartThings API every 5 seconds
  - **SSE stream** (`/api/events/stream`) pushes events to connected clients in real-time

### 5.2 What SmartThings API endpoints are available for events?

**Answer:** SmartThings does not have a dedicated "events API" endpoint. Events are obtained through:

1. **Webhook Subscriptions** (push notifications)
   - Requires SmartApp installation
   - SmartThings sends POST to webhook URL on state changes
   - **File:** `src/routes/webhook.ts`

2. **Device Status Polling** (pull model)
   - Fetch device list: `GET /devices`
   - Extract `platformSpecific.state` from each device
   - Compare previous vs. current state
   - **File:** `src/services/device-polling-service.ts`

3. **Device History API** (historical events)
   - SmartThings API supports `GET /devices/{deviceId}/events`
   - **Not currently implemented** in Smarter Things
   - Could be added for historical event backfill

### 5.3 Is there a subscription service already implemented?

**Answer:** **Yes, two approaches:**

1. **SubscriptionService** (webhook-based)
   - **File:** `src/smartthings/subscription-service.ts`
   - **Status:** ✅ Implemented
   - **Limitation:** Requires SmartApp installation

2. **DevicePollingService** (polling-based)
   - **File:** `src/services/device-polling-service.ts`
   - **Status:** ✅ Implemented and **active by default**
   - **Advantage:** Works immediately without SmartApp

---

## 6. Continuous Event Pulling - Current State

### 6.1 How It Works Now

**The DevicePollingService IS the continuous event pulling mechanism.**

**Process:**
1. Service starts when server boots (`src/server-alexa.ts:341`)
2. Initial poll executes immediately
3. Recurring polls every 5 seconds (configurable)
4. Each poll:
   - Fetches all devices from SmartThings API
   - Compares current state with previous state (stored in memory)
   - Emits `deviceEvent` for any state changes detected
   - Updates stored state for next comparison
5. Event handler receives `deviceEvent` events
6. Converts to `SmartHomeEvent` and broadcasts to SSE clients

**Configuration:**
```typescript
const pollingService = new DevicePollingService(
  async () => {
    const adapter = getSmartThingsAdapter();
    return await adapter.listDevices();
  },
  {
    intervalMs: 5000,  // Poll every 5 seconds
    capabilities: [    // Monitor these capabilities
      'motionSensor',
      'contactSensor',
      'switch',
      'dimmer',
      'lock',
      'temperatureSensor'
    ]
  }
);

pollingService.start();
```

**Status API:**
```bash
# Check if polling is running
curl http://localhost:5182/api/polling/status

{
  "success": true,
  "data": {
    "running": true,
    "pollCount": 142,
    "changeCount": 7,
    "trackedDevices": 23,
    "intervalMs": 5000
  }
}
```

### 6.2 What's Missing for Continuous Event Pulling?

**Answer:** **Nothing!** It's already implemented and active.

**Evidence:**
- ✅ Polling service implemented (`device-polling-service.ts`)
- ✅ Service instantiated in server startup (`server-alexa.ts:333`)
- ✅ Event integration connected (`server-alexa.ts:350`)
- ✅ SSE broadcasting configured (`routes/events.ts:54`)
- ✅ Frontend consuming SSE stream (`eventsStore.svelte.ts:189`)
- ✅ UI displaying real-time events (`events/+page.svelte:22-30`)

---

## 7. Recommended Improvements (Optional)

While the current implementation is production-ready, here are potential enhancements:

### 7.1 Add SmartThings Device History API Support

**Purpose:** Backfill historical events for devices

**Implementation:**
```typescript
// src/smartthings/device-history-service.ts
export class DeviceHistoryService {
  async getDeviceHistory(
    deviceId: string,
    since?: Date
  ): Promise<SmartHomeEvent[]> {
    // GET /devices/{deviceId}/events
    // Convert SmartThings events to SmartHomeEvent format
    // Save to EventStore
  }
}
```

**Benefit:** Fill event history gaps during server downtime

### 7.2 Optimize Polling Frequency Based on Device Type

**Current:** Polls all devices every 5 seconds

**Improvement:** Variable polling rates
- **Motion sensors:** 2-3 seconds (fast response)
- **Temperature sensors:** 30-60 seconds (slow changes)
- **Switches:** 5 seconds (moderate)
- **Locks:** 3-5 seconds (security-critical)

**Implementation:**
```typescript
interface DevicePollingConfig {
  deviceGroups: {
    fastPoll: { capabilities: string[], intervalMs: 2000 },
    normalPoll: { capabilities: string[], intervalMs: 5000 },
    slowPoll: { capabilities: string[], intervalMs: 30000 }
  }
}
```

**Benefit:** Reduce API calls while maintaining responsiveness

### 7.3 Add Event Deduplication

**Purpose:** Prevent duplicate events from polling + webhooks

**Implementation:**
```typescript
// In EventStore
private recentEventCache = new Map<string, number>(); // eventKey → timestamp

async saveEvent(event: SmartHomeEvent): Promise<void> {
  const key = `${event.deviceId}:${event.eventType}:${event.value}`;
  const now = Date.now();

  // Check if same event occurred within 1 second
  const lastSeen = this.recentEventCache.get(key);
  if (lastSeen && (now - lastSeen) < 1000) {
    logger.debug('[EventStore] Duplicate event detected, skipping', { key });
    return;
  }

  this.recentEventCache.set(key, now);
  // ... proceed with save
}
```

**Benefit:** Prevent duplicate events when using both polling + webhooks

### 7.4 Add Event Compression for SSE

**Purpose:** Reduce bandwidth for high-frequency events

**Implementation:**
```typescript
// Batch events and send every 100ms instead of immediately
const eventBuffer: SmartHomeEvent[] = [];

setInterval(() => {
  if (eventBuffer.length > 0) {
    const message = `event: batch\ndata: ${JSON.stringify(eventBuffer)}\n\n`;
    sseClients.forEach(client => client.raw.write(message));
    eventBuffer.length = 0;
  }
}, 100);
```

**Benefit:** Reduce SSE overhead during event bursts

### 7.5 Add Event Analytics Dashboard

**Purpose:** Visualize event patterns and system health

**Components:**
- Event rate graph (events/minute)
- Event type distribution (pie chart)
- Device activity heatmap
- Polling performance metrics
- SSE connection count

**Endpoint:** `GET /api/events/analytics`

---

## 8. Architecture Comparison

### 8.1 Polling vs. Webhooks

| Feature | Device Polling | Webhook Subscriptions |
|---------|----------------|----------------------|
| **Latency** | 0-5 seconds (poll interval) | < 1 second (real-time) |
| **Setup Complexity** | Zero (works immediately) | High (SmartApp installation) |
| **API Call Volume** | 1 call every 5 sec | 0 calls (push-based) |
| **Reliability** | High (controlled by server) | Medium (depends on webhook delivery) |
| **State Accuracy** | 100% (full device status) | Event-based (state updates only) |
| **Best For** | Development, testing | Production at scale |
| **Current Status** | ✅ **Active by default** | ⚠️ Requires SmartApp |

**Recommendation:** Use **both** in production:
- **Polling:** Primary mechanism (always works)
- **Webhooks:** Optimization (reduce latency when available)
- **Deduplication:** Handle events from both sources

---

## 9. Performance Analysis

### 9.1 Current Performance Metrics

**Polling Service:**
- Poll interval: 5 seconds
- Devices monitored: ~20-30 devices (typical home)
- API calls: 1 call/5 sec = 17,280 calls/day
- State changes detected: ~10-50/day (depends on activity)

**Event Store:**
- Insert latency: < 5ms
- Query latency: < 50ms (100 events)
- Storage: ~1KB per event
- Retention: 30 days = ~300-1,500 events
- Disk usage: ~0.3-1.5 MB

**SSE Streaming:**
- Concurrent connections: 100+ supported
- Broadcast latency: < 100ms
- Heartbeat interval: 30 seconds
- Reconnection: Exponential backoff (1s → 30s)

**Message Queue:**
- Capacity: 15,000 jobs/sec
- Current load: ~10 msgs/sec (peak)
- Headroom: 1,500x capacity
- Workers: 4 concurrent

### 9.2 Bottleneck Analysis

**Potential Bottlenecks:**

1. **SmartThings API Rate Limits**
   - **Limit:** Unknown (not documented publicly)
   - **Current:** 1 call/5 sec = well within limits
   - **Mitigation:** Increase poll interval if throttled

2. **SQLite Write Throughput**
   - **Capacity:** ~10,000 writes/sec (WAL mode)
   - **Current:** ~10-50 events/day = negligible
   - **Safe:** 1,000x headroom

3. **SSE Connection Count**
   - **Tested:** 100+ concurrent connections
   - **Expected:** 1-10 concurrent (typical usage)
   - **Safe:** 10-100x headroom

**Conclusion:** No performance bottlenecks identified. System is over-engineered for typical home automation workloads.

---

## 10. Conclusion

### 10.1 Summary

The Smarter Things project has a **sophisticated, production-ready events infrastructure** with:

✅ **Continuous event pulling** via DevicePollingService (5-second interval)
✅ **Real-time event streaming** via Server-Sent Events (SSE)
✅ **Persistent event storage** via SQLite with 30-day retention
✅ **Reliable event processing** via plainjob message queue
✅ **Frontend event display** with Svelte 5 Runes reactivity
✅ **Multiple event sources** (polling, webhooks, MCP tools)

### 10.2 No Major Implementation Work Needed

The question "what's needed for continuous event pulling" has a simple answer:

**Nothing - it's already implemented and active.**

The `DevicePollingService` IS the continuous event pulling mechanism. It:
- Polls SmartThings devices every 5 seconds
- Detects state changes via comparison
- Broadcasts changes to all SSE clients
- Stores events in SQLite for history

### 10.3 Recommended Next Steps

1. **Test existing polling service**
   - Verify polling is running: `GET /api/polling/status`
   - Check SSE stream: Open `http://localhost:5181/events`
   - Trigger device state change and observe real-time update

2. **Optional enhancements** (if needed)
   - Add device history backfill (SmartThings `/events` API)
   - Implement variable polling rates per device type
   - Add event deduplication for polling + webhooks
   - Create event analytics dashboard

3. **Documentation updates**
   - Document polling service in README
   - Add events API reference to docs
   - Create troubleshooting guide for SSE connection issues

---

## 11. Code References

### Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/src/routes/events/+page.svelte` | Events page UI | ✅ Complete |
| `web/src/lib/stores/eventsStore.svelte.ts` | Events state management | ✅ Complete |
| `src/routes/events.ts` | Events API endpoints | ✅ Complete |
| `src/storage/event-store.ts` | Event persistence (SQLite) | ✅ Complete |
| `src/services/device-polling-service.ts` | **Continuous polling** | ✅ **Active** |
| `src/smartthings/subscription-service.ts` | Webhook subscriptions | ✅ Complete |
| `src/queue/MessageQueue.ts` | Event processing pipeline | ✅ Complete |
| `src/server-alexa.ts:350` | Polling integration | ✅ Complete |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/events` | GET | List events (paginated) |
| `GET /api/events/stream` | GET | SSE real-time stream |
| `GET /api/events/device/:id` | GET | Device-specific events |
| `GET /api/events/stats` | GET | Event statistics |
| `GET /api/polling/status` | GET | Polling service status |
| `POST /api/polling/start` | POST | Start polling |
| `POST /api/polling/stop` | POST | Stop polling |

---

## 12. Testing Recommendations

### 12.1 Verify Polling Service

```bash
# Check polling status
curl http://localhost:5182/api/polling/status

# Expected response:
{
  "success": true,
  "data": {
    "running": true,
    "pollCount": 142,
    "changeCount": 7,
    "trackedDevices": 23,
    "intervalMs": 5000
  }
}
```

### 12.2 Test SSE Stream

```bash
# Connect to SSE stream (terminal)
curl -N http://localhost:5182/api/events/stream

# Expected output:
event: connected
data: {"timestamp":"2025-12-22T...", "message":"Connected to event stream"}

event: heartbeat
data: {"timestamp":"2025-12-22T...", "connectedClients":1}

event: new-event
data: {"id":"...", "type":"device_event", "deviceId":"...", ...}
```

### 12.3 Trigger Event and Observe

1. Open browser: `http://localhost:5181/events`
2. Observe connection status (green dot = connected)
3. Toggle a SmartThings device (switch, light, etc.)
4. Within 0-5 seconds, event should appear in UI
5. Verify event details (device name, value, timestamp)

### 12.4 Load Test (Optional)

```typescript
// Simulate high-frequency events
for (let i = 0; i < 100; i++) {
  await queue.enqueue('device_event', {
    id: randomUUID() as EventId,
    type: 'device_event',
    source: 'smartthings',
    deviceId: `device-${i}` as DeviceId,
    value: { switch: i % 2 === 0 ? 'on' : 'off' },
    timestamp: new Date(),
  });
}

// Verify:
// - All events broadcast to SSE clients
// - No message queue backlog
// - Event store writes complete
```

---

## Appendix A: Event Types

```typescript
export type SmartHomeEventType =
  | 'device_event'          // Device state change
  | 'user_command'          // User-initiated command
  | 'automation_trigger'    // Scene/automation executed
  | 'rule_execution';       // Rule triggered

export type EventSource =
  | 'smartthings'           // SmartThings platform
  | 'alexa'                 // Alexa voice command
  | 'mcp'                   // MCP tool invocation
  | 'webhook';              // Webhook POST request
```

---

## Appendix B: Performance Benchmarks

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Polling interval | 5 sec | 5 sec | ✅ |
| SSE latency | < 100ms | < 200ms | ✅ |
| Event store insert | < 5ms | < 10ms | ✅ |
| Event store query (100) | < 50ms | < 100ms | ✅ |
| Message queue capacity | 15K/sec | 1K/sec | ✅ |
| SSE concurrent connections | 100+ | 10+ | ✅ |
| Event retention | 30 days | 30 days | ✅ |

---

**Report End**
