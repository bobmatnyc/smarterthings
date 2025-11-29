# PatternDetector Implementation Research

**Ticket:** 1M-286 - Phase 3.1: Implement PatternDetector service
**Research Date:** 2025-11-29
**Target File:** `src/services/PatternDetector.ts`
**Performance Target:** <500ms total execution

---

## Executive Summary

This research analyzes existing diagnostic code patterns in the mcp-smartthings codebase to guide implementation of the PatternDetector service. Key findings:

1. **Existing pattern detection algorithms** in DiagnosticWorkflow provide a foundation (rapid changes, automation triggers, connectivity gaps)
2. **Parallel execution with Promise.allSettled** ensures <500ms performance while maintaining robustness
3. **Caching infrastructure** (AutomationService) demonstrates patterns for <10ms cache hits
4. **DeviceRegistry multi-dimensional indexing** enables O(1) device lookups by status
5. **Event data structures** (DeviceEvent) provide rich temporal analysis capabilities

**Recommended Approach:** Extract and enhance DiagnosticWorkflow's pattern detection into a standalone service with additional battery degradation algorithm.

---

## 1. DiagnosticWorkflow Analysis

### 1.1 Current Pattern Detection Implementation

**Location:** `src/services/DiagnosticWorkflow.ts` (lines 992-1216)

#### Existing Pattern Detection Hook

```typescript
// Line 331: Called during issue_diagnosis intent
tasks.push(this.detectPatterns(toDeviceId(device.id)));
```

**Current Architecture:**
- Pattern detection is **embedded** in DiagnosticWorkflow
- Returns `IssuePattern[]` data structure
- Integrated via parallel task execution (Promise.allSettled)
- Performance: <100ms for 100 events

#### IssuePattern Interface (Lines 74-86)

```typescript
export interface IssuePattern {
  /** Pattern type */
  type: 'rapid_changes' | 'repeated_failures' | 'connectivity_gap' | 'automation_trigger' | 'normal';

  /** Human-readable description */
  description: string;

  /** Number of occurrences */
  occurrences: number;

  /** Confidence score (0-1) */
  confidence: number;
}
```

**Key Insight:** This interface should be **reused** by PatternDetector for consistency.

### 1.2 Existing Detection Algorithms

#### Algorithm 1: Rapid State Changes (Lines 1071-1116)

```typescript
private detectRapidChanges(events: DeviceEvent[]): IssuePattern | null {
  // Filter to state-change events only
  const stateEvents = events.filter(e => ['switch', 'lock', 'contact'].includes(e.attribute));

  // Sort by epoch timestamp
  const sorted = [...stateEvents].sort((a, b) => a.epoch - b.epoch);

  // Calculate time gaps between consecutive state changes
  const rapidChanges: Array<{ gapMs: number; isAutomation: boolean }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const gapMs = curr.epoch - prev.epoch;

    // Only count if state changed AND gap < 10s
    if (prev.value !== curr.value && gapMs < 10000) {
      rapidChanges.push({
        gapMs,
        isAutomation: gapMs < 5000  // <5s = likely automation
      });
    }
  }

  // Calculate confidence
  const automationTriggers = rapidChanges.filter(c => c.isAutomation).length;
  const confidence = automationTriggers > 0 ? 0.95 : 0.85;

  return {
    type: 'rapid_changes',
    description: `Detected ${rapidChanges.length} rapid state changes`,
    occurrences: rapidChanges.length,
    confidence
  };
}
```

**Time Complexity:** O(n log n) for sorting
**Performance:** <50ms for 100 events

**Pattern Detection Thresholds:**
- **Rapid change:** 5-10s gap (85% confidence)
- **Automation trigger:** <5s gap (95% confidence)
- **Normal:** >10s gap (not flagged)

#### Algorithm 2: Automation Triggers (Lines 1131-1177)

```typescript
private detectAutomationTriggers(events: DeviceEvent[]): IssuePattern | null {
  const stateEvents = events.filter(e => e.attribute === 'switch');
  const sorted = [...stateEvents].sort((a, b) => a.epoch - b.epoch);

  // Look for "immediate re-trigger" pattern (OFF→ON within 5s)
  const reTriggers: Array<{ gapMs: number; hour: number }> = [];

  for (let i = 1; i < sorted.length; i++) {
    if (prev.value === 'off' && curr.value === 'on') {
      const gapMs = curr.epoch - prev.epoch;
      if (gapMs < 5000) {
        reTriggers.push({
          gapMs,
          hour: new Date(curr.time).getHours()
        });
      }
    }
  }

  // Check for odd-hour activity (automation indicator)
  const oddHourEvents = reTriggers.filter(t => t.hour >= 1 && t.hour <= 5);
  const confidence = oddHourEvents.length > 0 ? 0.98 : 0.95;

  return {
    type: 'rapid_changes',
    description: `Detected automation: ${reTriggers.length} immediate re-triggers`,
    occurrences: reTriggers.length,
    confidence
  };
}
```

**Key Pattern:** OFF→ON within 5s indicates automation re-trigger
**Confidence Boosters:**
- Odd-hour events (1-5 AM): +3% confidence (98% total)
- Multiple occurrences: Strong automation evidence

#### Algorithm 3: Connectivity Gaps (Lines 1192-1216)

```typescript
private detectConnectivityIssues(events: DeviceEvent[]): IssuePattern | null {
  // Reuse existing detectEventGaps() function with 1-hour threshold
  const gaps = detectEventGaps(events, 60 * 60 * 1000);

  // Filter to likely connectivity issues
  const connectivityGaps = gaps.filter(g => g.likelyConnectivityIssue);

  // Find largest gap for description
  const largestGap = gaps.reduce((max, gap) =>
    gap.durationMs > max.durationMs ? gap : max
  );

  return {
    type: 'connectivity_gap',
    description: `Found ${connectivityGaps.length} connectivity gaps (largest: ${largestGap.durationText})`,
    occurrences: connectivityGaps.length,
    confidence: 0.8
  };
}
```

**Reuses Utility:** `detectEventGaps()` from `device-events.ts` (line 435)
**Threshold:** Gaps >1 hour suggest connectivity issues
**Confidence:** 0.8 (80%) - Lower due to possible legitimate inactivity

### 1.3 Integration with DeviceService

**Event Retrieval Pattern (Lines 919-938):**

```typescript
private async getRecentEvents(
  deviceId: DeviceId,
  limit: number
): Promise<{ type: string; value: DeviceEvent[] }> {
  try {
    const result = await this.deviceService.getDeviceEvents(deviceId, {
      deviceId,
      limit,
      includeMetadata: false  // Minimize overhead
    });

    return {
      type: 'events',
      value: result.events
    };
  } catch (error) {
    logger.error('Failed to get recent events', { deviceId, error });
    throw error;
  }
}
```

**Key Patterns:**
1. Type-tagged return values (`{ type: 'events', value: [...] }`)
2. `includeMetadata: false` for performance
3. Error logging with context
4. Throws errors up to Promise.allSettled handler

---

## 2. DeviceRegistry Data Access Patterns

### 2.1 Available Query Methods

**Location:** `src/abstract/DeviceRegistry.ts`

#### Device Lookup Methods

```typescript
// O(1) exact ID lookup
getDevice(deviceId: UniversalDeviceId): UnifiedDevice | undefined

// Multi-criteria filtering with indices
findDevices(filter: DeviceFilter): UnifiedDevice[]

// Room-based queries
getDevicesInRoom(room: string): UnifiedDevice[]

// Get all devices (unfiltered)
getAllDevices(): UnifiedDevice[]
```

#### DeviceFilter Interface (src/types/registry.ts)

```typescript
export interface DeviceFilter {
  roomId?: string;
  platform?: Platform;
  capability?: DeviceCapability;
  online?: boolean;          // ⭐ Key for offline detection
  namePattern?: RegExp;
}
```

**Critical for PatternDetector:** The `online?: boolean` filter enables efficient offline device queries.

### 2.2 Multi-Dimensional Indexing

**Index Types:**
- Primary: `deviceId → device` (O(1))
- Name: `name → deviceId` (O(1))
- Room: `room → Set<deviceId>` (O(1) + O(n) iteration)
- Platform: `platform → Set<deviceId>` (O(1) + O(n) iteration)
- Capability: `capability → Set<deviceId>` (O(1) + O(n) iteration)

**Performance Characteristics:**
- <10ms lookup for 200+ devices
- <1ms for exact ID lookups
- <5ms for fuzzy name resolution

### 2.3 Battery Level Access Pattern

**From DiagnosticWorkflow.ts (Lines 849-899):**

```typescript
private async getDeviceHealth(deviceId: DeviceId): Promise<{ type: string; value: DeviceHealthData }> {
  const device = this.deviceRegistry.getDevice(toUniversalId(deviceId));
  const status = await this.deviceService.getDeviceStatus(deviceId);

  // Extract battery level - support both formats:
  // 1. Root-level: status.battery (test mocks)
  // 2. Component format: status.components.main.battery.battery.value (actual API)
  let batteryLevel: number | undefined;

  if (typeof statusAny.battery === 'number') {
    batteryLevel = statusAny.battery;
  } else {
    const mainComponent = status.components?.['main'];
    const batteryComponent = mainComponent?.['battery'];
    const batteryAttribute = batteryComponent?.['battery'];
    if (batteryAttribute && typeof batteryAttribute.value === 'number') {
      batteryLevel = batteryAttribute.value;
    }
  }

  return {
    type: 'health',
    value: {
      status: online ? 'online' : 'offline',
      batteryLevel,
      online,
      lastActivity: device?.lastSeen?.toISOString(),
      currentState: status.components?.['main']
    }
  };
}
```

**Key Insight:** Battery data requires API call to `getDeviceStatus()` - not available in DeviceRegistry alone.

### 2.4 Device Health Data Structure

```typescript
export interface DeviceHealthData {
  status: 'online' | 'offline' | 'warning';
  batteryLevel?: number;
  online: boolean;
  lastActivity?: string;
  currentState?: Record<string, unknown>;
}
```

**Usage in Pattern Detection:**
- `online: false` → triggers connectivity gap analysis
- `batteryLevel < 20` → triggers low battery recommendations
- `lastActivity` → used for staleness detection

---

## 3. SmartThings API Integration Patterns

### 3.1 Retry and Error Handling

**Location:** `src/smartthings/client.ts` (Lines 70-112)

```typescript
async listDevices(roomId?: RoomId): Promise<DeviceInfo[]> {
  logger.debug('Fetching device list', { roomId });

  const devices = await retryWithBackoff(async () => {
    return await this.client.devices.list();
  });

  // Filter by room if specified
  const filteredDevices = roomId
    ? devices.filter(device => device.roomId === roomId)
    : devices;

  // Fetch room names in parallel
  const roomMap = new Map<string, string>();
  const roomIds = [...new Set(filteredDevices.map(d => d.roomId).filter(Boolean))];

  for (const rid of roomIds) {
    try {
      const room = await retryWithBackoff(async () => {
        return await this.client.rooms.get(rid as string);
      });
      if (room.roomId) {
        roomMap.set(room.roomId, room.name ?? 'Unknown Room');
      }
    } catch (error) {
      logger.warn('Failed to fetch room name', { roomId: rid, error });
    }
  }

  logger.info('Devices retrieved', { count: deviceInfos.length });
  return deviceInfos;
}
```

**Patterns:**
1. **Wrap all API calls** with `retryWithBackoff()`
2. **Graceful degradation** on non-critical failures (room names)
3. **Structured logging** with operation context
4. **Performance logging** for monitoring

### 3.2 Rate Limiting Strategy

**From retry utility:**
- Exponential backoff: 100ms → 200ms → 400ms → 800ms
- Max retries: 3 attempts
- Jitter: ±20% to prevent thundering herd
- Only retries on network errors (not auth errors)

### 3.3 Event History Query Pattern

**From DeviceService.ts (Lines 283-312):**

```typescript
async getDeviceEvents(
  deviceId: DeviceId,
  options: DeviceEventServiceOptions = {}
): Promise<DeviceEventResult> {
  try {
    logger.debug('DeviceService.getDeviceEvents', { deviceId, options });

    // Merge deviceId into options for SmartThingsService
    const fullOptions: DeviceEventOptions = { ...options, deviceId };
    const result = await this.smartThingsService.getDeviceEvents(deviceId, fullOptions);

    logger.info('Device events retrieved', {
      deviceId,
      eventCount: result.events.length,
      hasMore: result.metadata.hasMore,
      gapDetected: result.metadata.gapDetected
    });

    return result;
  } catch (error) {
    const serviceError = ErrorHandler.transformApiError(
      error as Error,
      'DeviceService',
      'getDeviceEvents',
      { deviceId, options }
    );

    ErrorHandler.logError(serviceError, { operation: 'getDeviceEvents' });
    throw serviceError;
  }
}
```

**Key Patterns:**
1. Metadata-rich responses (`hasMore`, `gapDetected`)
2. Error transformation for consistent error handling
3. Structured logging at operation boundaries
4. Options merging pattern

### 3.4 DeviceEvent Data Structure

**Location:** `src/types/device-events.ts` (Lines 30-78)

```typescript
export interface DeviceEvent {
  deviceId: DeviceId;
  deviceName?: string;
  locationId: LocationId;
  time: string;              // ISO-8601 timestamp
  epoch: number;             // Unix epoch (milliseconds)
  component: string;
  capability: CapabilityName;
  attribute: string;
  value: unknown;            // Requires runtime validation
  unit?: string;
  text?: string;
}
```

**Critical Fields for Pattern Detection:**
- `epoch`: Used for time-based calculations (gaps, rapid changes)
- `attribute`: Filtered for state-change events ('switch', 'lock', 'contact')
- `value`: Compared between events to detect actual state changes

---

## 4. Caching and Performance Patterns

### 4.1 AutomationService Caching Strategy

**Location:** `src/services/AutomationService.ts` (Lines 88-103)

```typescript
interface CachedLocationRules {
  locationId: LocationId;
  rules: Rule[];
  deviceIndex: Map<DeviceId, RuleMatch[]>;  // Pre-computed index
  cachedAt: number;
  ttl: number;
}
```

**Cache Implementation:**

```typescript
async findRulesForDevice(deviceId: DeviceId, locationId: LocationId): Promise<RuleMatch[]> {
  // Check cache first
  const cached = this.cache.get(locationId);
  if (cached && Date.now() - cached.cachedAt < cached.ttl) {
    const matches = cached.deviceIndex.get(deviceId);
    if (matches) {
      logger.debug('Returning cached rule matches', { deviceId, count: matches.length });
      return matches;
    }
    return [];  // Cache hit but no matches
  }

  // Fetch and update cache
  const rules = await this.listRules(locationId);
  const updatedCache = this.cache.get(locationId);
  return updatedCache?.deviceIndex.get(deviceId) ?? [];
}
```

**Performance Characteristics:**
- **Cache hit:** O(1) hash map lookup, <10ms
- **Cache miss:** O(R×A) where R=rules, A=actions per rule, ~100-500ms
- **TTL:** 5 minutes (configurable via `AUTOMATION_CACHE_TTL_MS`)
- **Memory:** ~100KB per location (negligible)

**Key Pattern:** Pre-compute indices during cache population for O(1) lookups.

### 4.2 Parallel Execution with Promise.allSettled

**Location:** `src/services/DiagnosticWorkflow.ts` (Lines 283-301)

```typescript
async executeDiagnosticWorkflow(
  classification: IntentClassification,
  _userMessage: string
): Promise<DiagnosticReport> {
  const startTime = Date.now();
  const context: DiagnosticContext = { intent: classification };

  // Step 1: Resolve device reference
  if (classification.entities.deviceName || classification.entities.deviceId) {
    try {
      context.device = await this.resolveDevice(classification.entities);
    } catch (error) {
      logger.warn('Failed to resolve device reference', { error });
    }
  }

  // Step 2: Build data gathering plan
  const dataGatheringTasks = this.buildDataGatheringPlan(
    classification.intent,
    context.device
  );

  // Step 3: Execute parallel data gathering
  const results = await Promise.allSettled(dataGatheringTasks);

  // Step 4: Populate context from results
  this.populateContext(context, results);

  // Step 5: Generate diagnostic report
  const report = this.compileDiagnosticReport(context);

  const elapsed = Date.now() - startTime;
  logger.info('Diagnostic workflow completed', { elapsedMs: elapsed });

  return report;
}
```

**Design Rationale (Lines 18, 363-408):**
> "Use Promise.allSettled for partial success. If 3/4 data sources succeed, use those 3. Don't fail entire workflow because one API call failed."

**Result Handling:**

```typescript
private populateContext(context: DiagnosticContext, results: PromiseSettledResult<any>[]): void {
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const data = result.value;

      switch (data.type) {
        case 'health': context.healthData = data.value; break;
        case 'events': context.recentEvents = data.value; break;
        case 'patterns': context.relatedIssues = data.value; break;
        // ... other types
      }
    } else {
      logger.warn('Data gathering task failed', { reason: result.reason });
    }
  }
}
```

**Performance Impact:**
- **Parallel:** ~400ms for 4 concurrent tasks
- **Serial:** ~2000ms (5x slower)
- **Partial failure:** Workflow continues with available data

### 4.3 Type-Tagged Results Pattern

**Consistent across DiagnosticWorkflow:**

```typescript
// Health data
return { type: 'health', value: DeviceHealthData };

// Event history
return { type: 'events', value: DeviceEvent[] };

// Similar devices
return { type: 'similar', value: DeviceSearchResult[] };

// Pattern detection
return { type: 'patterns', value: IssuePattern[] };
```

**Benefits:**
1. Type-safe result discrimination
2. Clear data provenance in logs
3. Enables generic result handling in `populateContext()`

---

## 5. Integration Points for PatternDetector

### 5.1 DiagnosticWorkflow Integration

**Current Call Site (Line 331):**

```typescript
case 'issue_diagnosis':
  if (device) {
    tasks.push(this.getDeviceHealth(toDeviceId(device.id)));
    tasks.push(this.getRecentEvents(toDeviceId(device.id), 100));
    tasks.push(this.detectPatterns(toDeviceId(device.id)));  // ⬅️ Replace with PatternDetector
    tasks.push(this.findSimilarDevices(device.id, 3));

    if (this.serviceContainer) {
      tasks.push(this.identifyControllingAutomations(device.id));
    }
  }
  break;
```

**Proposed Integration:**

```typescript
case 'issue_diagnosis':
  if (device) {
    tasks.push(this.getDeviceHealth(toDeviceId(device.id)));
    tasks.push(this.getRecentEvents(toDeviceId(device.id), 100));

    // Replace inline pattern detection with PatternDetector service
    if (this.serviceContainer) {
      const patternDetector = this.serviceContainer.getPatternDetector();
      tasks.push(this.runPatternDetection(device.id, patternDetector));
    }

    tasks.push(this.findSimilarDevices(device.id, 3));
    tasks.push(this.identifyControllingAutomations(device.id));
  }
  break;

// New method
private async runPatternDetection(
  deviceId: UniversalDeviceId,
  patternDetector: PatternDetector
): Promise<{ type: string; value: IssuePattern[] }> {
  try {
    const patterns = await patternDetector.detectPatterns(
      toDeviceId(deviceId),
      { includeSystemWide: false }
    );

    return {
      type: 'patterns',
      value: patterns
    };
  } catch (error) {
    logger.warn('Pattern detection failed', { deviceId, error });
    return { type: 'patterns', value: [] };
  }
}
```

### 5.2 ServiceContainer Registration

**Location:** `src/services/ServiceContainer.ts`

**Current Pattern:**

```typescript
export class ServiceContainer {
  private automationService?: AutomationService;

  getAutomationService(): AutomationService {
    if (!this.automationService) {
      throw new Error('AutomationService not initialized');
    }
    return this.automationService;
  }
}
```

**Add PatternDetector:**

```typescript
export class ServiceContainer {
  private patternDetector?: PatternDetector;

  getPatternDetector(): PatternDetector {
    if (!this.patternDetector) {
      // Lazy initialization with dependencies
      this.patternDetector = new PatternDetector(
        this.deviceService,
        this.deviceRegistry
      );
    }
    return this.patternDetector;
  }
}
```

### 5.3 Data Flow Diagram

```
User Query → DiagnosticWorkflow
              ↓
         buildDataGatheringPlan()
              ↓
      [Task 1: getDeviceHealth]
      [Task 2: getRecentEvents] ─────┐
      [Task 3: PatternDetector] ←────┤
      [Task 4: findSimilarDevices]   │
      [Task 5: AutomationService]    │
              ↓                       │
    Promise.allSettled(tasks)        │
              ↓                       │
      populateContext()               │
              ↓                       │
      DiagnosticReport                │
                                     │
PatternDetector.detectPatterns()  ←──┘
    ↓
  [Algorithm 1: Connectivity Gaps]
  [Algorithm 2: Automation Conflicts]
  [Algorithm 3: Battery Degradation]   ← NEW
  [Algorithm 4: Event Anomalies]       ← NEW
    ↓
  IssuePattern[] (scored & sorted)
```

---

## 6. Recommended Pattern Data Structure

### 6.1 Enhanced Pattern Interface

**Extend existing IssuePattern:**

```typescript
export interface Pattern {
  /** Pattern type identifier */
  type: 'connectivity_gap' | 'automation_conflict' | 'battery_degradation' | 'event_anomaly' | 'normal';

  /** Human-readable description */
  description: string;

  /** Severity classification */
  severity: 'critical' | 'warning' | 'info';

  /** Confidence score (0-1) */
  confidence: number;

  /** Number of occurrences */
  occurrences: number;

  /** Affected device IDs */
  affectedDevices: DeviceId[];

  /** Supporting evidence */
  evidence: {
    /** Time range of pattern */
    timeRange?: { start: string; end: string };

    /** Specific events supporting pattern */
    events?: DeviceEvent[];

    /** Metrics supporting pattern */
    metrics?: Record<string, number>;
  };

  /** Recommended actions */
  recommendations?: string[];

  /** Detection timestamp */
  detectedAt: string;
}
```

**Backward Compatibility:**
- `IssuePattern` can be mapped to `Pattern` for existing code
- DiagnosticWorkflow continues to use `IssuePattern` interface
- PatternDetector returns `Pattern[]` internally, converts to `IssuePattern[]` for compatibility

### 6.2 Detection Algorithm Signatures

```typescript
class PatternDetector {
  /**
   * Detect connectivity gaps in device event history.
   *
   * Algorithm: Analyzes event timeline for gaps >1 hour.
   * Performance: O(n log n) for sorting, <20ms for 100 events
   */
  private detectConnectivityGaps(
    deviceId: DeviceId,
    events: DeviceEvent[]
  ): Pattern | null;

  /**
   * Detect automation conflicts (rapid re-triggers).
   *
   * Algorithm: Identifies OFF→ON within 5s patterns.
   * Performance: O(n log n) for sorting, <40ms for 100 events
   */
  private detectAutomationConflicts(
    deviceId: DeviceId,
    events: DeviceEvent[],
    automations?: RuleMatch[]
  ): Pattern | null;

  /**
   * Detect battery degradation trends.
   *
   * Algorithm: Analyzes battery level history for rapid decline.
   * Performance: O(n) linear scan, <10ms for 100 data points
   */
  private detectBatteryDegradation(
    deviceId: DeviceId,
    healthData: DeviceHealthData,
    historicalData?: BatteryHistoryPoint[]
  ): Pattern | null;

  /**
   * Detect event anomalies (unusual activity patterns).
   *
   * Algorithm: Statistical analysis of event frequency/timing.
   * Performance: O(n) for frequency analysis, <30ms for 100 events
   */
  private detectEventAnomalies(
    deviceId: DeviceId,
    events: DeviceEvent[]
  ): Pattern | null;
}
```

---

## 7. Performance Optimization Strategies

### 7.1 Parallel Execution Budget

**Target:** <500ms total execution
**Allocation:**
- Device health query: 100ms (API call)
- Event history query: 150ms (API call)
- Pattern detection: 100ms (4 algorithms × 25ms each)
- Automation lookup: 50ms (cached)
- Result aggregation: 50ms
- **Buffer:** 50ms

**Implementation:**

```typescript
async detectPatterns(
  deviceId: DeviceId,
  options: PatternDetectionOptions = {}
): Promise<Pattern[]> {
  const startTime = Date.now();

  // Parallel data gathering
  const [healthResult, eventsResult, automationsResult] = await Promise.allSettled([
    this.deviceService.getDeviceStatus(deviceId),
    this.deviceService.getDeviceEvents(deviceId, { limit: 100, includeMetadata: false }),
    this.getAutomations(deviceId)
  ]);

  // Extract data
  const health = healthResult.status === 'fulfilled' ? healthResult.value : undefined;
  const events = eventsResult.status === 'fulfilled' ? eventsResult.value.events : [];
  const automations = automationsResult.status === 'fulfilled' ? automationsResult.value : [];

  // Parallel pattern detection (all algorithms can run independently)
  const patternResults = await Promise.allSettled([
    Promise.resolve(this.detectConnectivityGaps(deviceId, events)),
    Promise.resolve(this.detectAutomationConflicts(deviceId, events, automations)),
    Promise.resolve(this.detectBatteryDegradation(deviceId, health)),
    Promise.resolve(this.detectEventAnomalies(deviceId, events))
  ]);

  // Collect successful detections
  const patterns: Pattern[] = [];
  for (const result of patternResults) {
    if (result.status === 'fulfilled' && result.value) {
      patterns.push(result.value);
    }
  }

  // Sort by severity and confidence
  patterns.sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.confidence - a.confidence;
  });

  const elapsed = Date.now() - startTime;
  logger.info('Pattern detection completed', {
    deviceId,
    patternsDetected: patterns.length,
    elapsedMs: elapsed
  });

  return patterns;
}
```

### 7.2 Caching Strategy

**Event History Cache:**
```typescript
private eventCache: Map<DeviceId, {
  events: DeviceEvent[];
  cachedAt: number;
  ttl: number;
}> = new Map();

private readonly EVENT_CACHE_TTL = 60_000; // 1 minute
```

**Rationale:**
- DiagnosticWorkflow already fetches events for `issue_diagnosis`
- Avoid duplicate API calls if multiple pattern detectors need same data
- Short TTL (1 min) ensures fresh data for diagnostics

**Cache Key Strategy:**
```typescript
private getCacheKey(deviceId: DeviceId, limit: number): string {
  return `${deviceId}:${limit}`;
}
```

### 7.3 Algorithm Optimization

**Existing Optimizations (from DiagnosticWorkflow):**

1. **Pre-filter events by relevance:**
   ```typescript
   const stateEvents = events.filter(e =>
     ['switch', 'lock', 'contact'].includes(e.attribute)
   );
   ```

2. **Single sort for multiple analyses:**
   ```typescript
   const sorted = [...events].sort((a, b) => a.epoch - b.epoch);
   // Reuse sorted array for all algorithms
   ```

3. **Early termination:**
   ```typescript
   if (events.length < 2) {
     return null; // Need at least 2 events to calculate gaps
   }
   ```

4. **Incremental confidence calculation:**
   ```typescript
   const automationTriggers = rapidChanges.filter(c => c.isAutomation).length;
   const confidence = automationTriggers > 0 ? 0.95 : 0.85;
   ```

---

## 8. Implementation Recommendations

### 8.1 Phase 1: Extract Existing Algorithms

**Action Items:**
1. Create `src/services/PatternDetector.ts`
2. Copy existing algorithms from DiagnosticWorkflow:
   - `detectRapidChanges()` → `detectAutomationConflicts()`
   - `detectAutomationTriggers()` → merge into `detectAutomationConflicts()`
   - `detectConnectivityIssues()` → `detectConnectivityGaps()`
3. Adapt return types from `IssuePattern` to `Pattern`
4. Add dependency injection: `DeviceService`, `DeviceRegistry`

### 8.2 Phase 2: Add New Algorithms

**Battery Degradation Algorithm:**
```typescript
private detectBatteryDegradation(
  deviceId: DeviceId,
  healthData?: DeviceHealthData
): Pattern | null {
  if (!healthData?.batteryLevel) {
    return null; // No battery data available
  }

  const level = healthData.batteryLevel;

  // Critical: Battery <10%
  if (level < 10) {
    return {
      type: 'battery_degradation',
      severity: 'critical',
      description: `Battery critically low (${level}%) - device may stop functioning soon`,
      confidence: 0.98,
      occurrences: 1,
      affectedDevices: [deviceId],
      evidence: {
        metrics: { currentLevel: level, threshold: 10 }
      },
      recommendations: [
        'Replace battery immediately to prevent device offline',
        'Monitor device connectivity after battery replacement'
      ],
      detectedAt: new Date().toISOString()
    };
  }

  // Warning: Battery <20%
  if (level < 20) {
    return {
      type: 'battery_degradation',
      severity: 'warning',
      description: `Battery low (${level}%) - consider replacement soon`,
      confidence: 0.95,
      occurrences: 1,
      affectedDevices: [deviceId],
      evidence: {
        metrics: { currentLevel: level, threshold: 20 }
      },
      recommendations: [
        'Schedule battery replacement within next week',
        'Monitor for connectivity issues'
      ],
      detectedAt: new Date().toISOString()
    };
  }

  return null; // Battery level acceptable
}
```

**Event Anomaly Algorithm (Simple Version):**
```typescript
private detectEventAnomalies(
  deviceId: DeviceId,
  events: DeviceEvent[]
): Pattern | null {
  if (events.length < 10) {
    return null; // Need sufficient data for statistical analysis
  }

  // Calculate event frequency (events per hour)
  const timeSpan = events[0].epoch - events[events.length - 1].epoch;
  const hours = timeSpan / (60 * 60 * 1000);
  const frequency = events.length / hours;

  // Anomaly: >100 events per hour (potential spam/malfunction)
  if (frequency > 100) {
    return {
      type: 'event_anomaly',
      severity: 'warning',
      description: `Unusually high event frequency (${Math.round(frequency)} events/hour)`,
      confidence: 0.85,
      occurrences: events.length,
      affectedDevices: [deviceId],
      evidence: {
        metrics: { eventsPerHour: frequency, threshold: 100 },
        timeRange: {
          start: events[events.length - 1].time,
          end: events[0].time
        }
      },
      recommendations: [
        'Check device for malfunction or sensitivity issues',
        'Review device placement (motion sensors)',
        'Consider adjusting device settings to reduce noise'
      ],
      detectedAt: new Date().toISOString()
    };
  }

  return null;
}
```

### 8.3 Phase 3: Integration Testing

**Test Scenarios:**
1. **Performance Test:** Verify <500ms execution with mock data
2. **Partial Failure Test:** Ensure graceful handling when one algorithm fails
3. **Empty Data Test:** Handle devices with no event history
4. **Confidence Scoring Test:** Verify confidence thresholds are accurate
5. **Integration Test:** Verify DiagnosticWorkflow integration works end-to-end

---

## 9. Code References

### Key Files to Study

1. **`src/services/DiagnosticWorkflow.ts`** (Lines 992-1216)
   - Existing pattern detection algorithms
   - Parallel execution with Promise.allSettled
   - Result handling and error recovery

2. **`src/abstract/DeviceRegistry.ts`**
   - Multi-dimensional device indexing
   - Query patterns for offline devices
   - Performance characteristics

3. **`src/services/AutomationService.ts`**
   - Caching strategy (5-minute TTL)
   - Device-to-rules index building
   - Graceful API failure handling

4. **`src/types/device-events.ts`**
   - DeviceEvent structure
   - Event gap detection utility
   - Time range parsing

5. **`src/services/DeviceService.ts`**
   - API call patterns with retry
   - Error handling and logging
   - Metadata-rich responses

### Performance Benchmarks (from existing code)

- **Device resolution:** <100ms (semantic search)
- **Parallel data gathering:** <400ms (4 concurrent API calls)
- **Pattern detection (single):** <50ms (100 events)
- **Context formatting:** <50ms (string building)
- **Cache hit:** <10ms (O(1) hash lookup)
- **Cache miss:** <500ms (API call + index building)

---

## 10. Next Steps for Implementation

### Immediate Actions (Ticket 1M-286)

1. **Create PatternDetector Service:**
   - File: `src/services/PatternDetector.ts`
   - Dependencies: `DeviceService`, `DeviceRegistry`, `AutomationService` (optional)
   - Interface: Implement `detectPatterns(deviceId, options)` method

2. **Extract Existing Algorithms:**
   - Copy and adapt `detectRapidChanges()` → `detectAutomationConflicts()`
   - Copy and adapt `detectConnectivityIssues()` → `detectConnectivityGaps()`
   - Merge `detectAutomationTriggers()` into automation conflicts

3. **Implement New Algorithms:**
   - `detectBatteryDegradation()` - check battery levels <20%
   - `detectEventAnomalies()` - statistical frequency analysis

4. **Integrate with DiagnosticWorkflow:**
   - Replace inline `detectPatterns()` call
   - Update ServiceContainer with PatternDetector
   - Maintain backward compatibility with `IssuePattern` interface

5. **Performance Validation:**
   - Add performance logging
   - Verify <500ms total execution
   - Test with Promise.allSettled for parallel algorithms

### Success Criteria

✅ **Functional Requirements:**
- 4 detection algorithms implemented
- Pattern scoring and severity classification
- Integration with DeviceRegistry and SmartThings API

✅ **Performance Requirements:**
- <500ms total execution time
- <100ms per algorithm
- Graceful degradation on partial failures

✅ **Code Quality:**
- Follows existing code patterns (Promise.allSettled, type-tagged results)
- Proper error handling and logging
- Backward compatible with DiagnosticWorkflow

---

## Appendix: Pattern Detection Thresholds

### Connectivity Gaps
- **Info:** 30-60 min gap (likely legitimate inactivity)
- **Warning:** 1-6 hour gap (possible connectivity issue)
- **Critical:** >6 hour gap (definite connectivity failure)
- **Confidence:** 0.8 for warnings, 0.95 for critical

### Automation Conflicts
- **Warning:** 5-10s rapid changes (85% confidence)
- **Critical:** <5s re-triggers (95% confidence, 98% if odd-hour)
- **Pattern:** OFF→ON immediate re-trigger

### Battery Degradation
- **Warning:** <20% battery (95% confidence)
- **Critical:** <10% battery (98% confidence)
- **Info:** 20-40% battery (informational only)

### Event Anomalies
- **Info:** 10-50 events/hour (normal activity)
- **Warning:** 50-100 events/hour (elevated activity)
- **Critical:** >100 events/hour (possible malfunction)
- **Confidence:** 0.85 (statistical threshold)

---

**End of Research Report**

**Next Actions:**
1. Review findings with PM/team
2. Begin Phase 1 implementation (extract existing algorithms)
3. Create unit tests for each algorithm
4. Integrate with DiagnosticWorkflow
5. Validate performance targets

**Related Tickets:**
- 1M-286: Phase 3.1: Implement PatternDetector service (this research)
- Future: Phase 3.2: Enhance pattern scoring
- Future: Phase 3.3: Add historical trend analysis
