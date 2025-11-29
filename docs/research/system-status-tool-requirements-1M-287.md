# System Status Tool Requirements Analysis

**Ticket**: 1M-287 - Phase 3.2: Build get_system_status MCP tool
**Priority**: High
**Research Date**: 2025-11-29
**Target File**: `src/mcp/tools/system-status.ts`

## Executive Summary

This research analyzes existing MCP tool patterns and data source interfaces to guide implementation of the `get_system_status` tool. The tool must aggregate data from 4 sources (DeviceRegistry, PatternDetector, SemanticIndex, Event history) in parallel, apply scope filtering (room, capability, severity), and deliver comprehensive system status reports in <500ms.

**Key Findings**:
- MCP tools follow consistent structure: Zod schema → handler → response format
- ServiceContainer provides dependency injection for all services
- PatternDetector is already integrated and battle-tested (1M-286)
- Parallel data aggregation patterns exist in `export_diagnostics` tool
- Response format standards balance human readability with structured data

**Recommendation**: Follow `diagnostics.ts` patterns (especially `export_diagnostics` and `get_system_info`) as architectural template, extend with PatternDetector integration and advanced filtering.

---

## 1. MCP Tool Structure Patterns

### 1.1 Standard Tool Architecture

**Evidence**: Examined `src/mcp/tools/diagnostics.ts` (966 lines), `system.ts`, `device-events.ts`

All MCP tools follow this structure:

```typescript
// 1. INPUT SCHEMA (Zod validation)
const getSystemStatusSchema = z.object({
  roomName: z.string().optional(),
  capability: z.string().optional(),
  minSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

// 2. HANDLER FUNCTION
export async function handleGetSystemStatus(input: McpToolInput): Promise<CallToolResult> {
  try {
    // Validate input
    const { roomName, capability, minSeverity } = getSystemStatusSchema.parse(input);

    // Business logic with services
    const deviceService = serviceContainer.getDeviceService();
    const patternDetector = serviceContainer.getPatternDetector();

    // Parallel data aggregation
    const [devices, patterns, indexStats] = await Promise.all([
      deviceService.listDevices(roomId),
      // ... pattern detection
      // ... semantic index health
    ]);

    // Format response
    return createMcpResponse(message, data);
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

// 3. TOOL EXPORT
export const systemStatusTools = {
  get_system_status: {
    description: 'Generate comprehensive system status report...',
    inputSchema: {
      type: 'object',
      properties: { /* Zod schema as JSON Schema */ },
      required: [],
    },
    handler: handleGetSystemStatus,
  },
};
```

### 1.2 Tool Registration Pattern

**Evidence**: `src/server.ts` lines 50-147

```typescript
// In server.ts:
import { systemStatusTools, initializeSystemStatusTools } from './mcp/tools/system-status.js';

export function createMcpServer(): Server {
  const serviceContainer = new ServiceContainer(smartThingsService);

  // Initialize tool with ServiceContainer (dependency injection)
  initializeSystemStatusTools(serviceContainer);

  // Combine all tools
  const allTools = {
    ...deviceControlTools,
    ...diagnosticTools,
    ...systemStatusTools, // Add new tool
  };

  // Auto-registration via ListToolsRequestSchema and CallToolRequestSchema
}
```

**Pattern**:
1. Create tool module with handler and export
2. Create `initializeXxxTools(container)` function for DI
3. Import and initialize in `server.ts`
4. Add to `allTools` object
5. MCP SDK auto-registers via request handlers

---

## 2. Data Source Interfaces

### 2.1 DeviceRegistry (Device Summaries)

**File**: `src/abstract/DeviceRegistry.ts`

**Key Methods**:
```typescript
class DeviceRegistry {
  // Get all devices (O(1) lookup per device)
  getAllDevices(): UnifiedDevice[]

  // Filter by room (O(1) room lookup + O(n) iteration)
  queryDevices(filter: DeviceFilter): UnifiedDevice[]

  // Statistics (cached, O(1))
  getStats(): RegistryStats {
    return {
      deviceCount,
      roomCount,
      platformCount,
      devicesPerRoom: Map<string, number>,
      devicesPerPlatform: Map<Platform, number>,
      devicesPerCapability: Map<DeviceCapability, number>
    }
  }
}
```

**Performance**:
- Full device list: <10ms for 200 devices
- Filtered queries: <5ms with room/capability filters
- Stats: <1ms (cached)

**Usage Pattern**:
```typescript
const deviceService = serviceContainer.getDeviceService();
const devices = await deviceService.listDevices(roomId); // Returns DeviceInfo[]

// DeviceInfo type:
interface DeviceInfo {
  deviceId: DeviceId;
  name: string;
  type?: string;
  capabilities?: string[];
  roomName?: string;
  locationId: string;
}
```

### 2.2 PatternDetector (NEW from 1M-286)

**File**: `src/services/PatternDetector.ts` (554 lines)

**Key Methods**:
```typescript
class PatternDetector {
  // Detect all patterns in parallel
  async detectAll(deviceId: DeviceId, events: DeviceEvent[]): Promise<PatternDetectionResult>

  // Individual detection algorithms (private)
  private async detectConnectivityGaps(events: DeviceEvent[]): Promise<DetectedPattern[]>
  private async detectAutomationConflicts(events: DeviceEvent[]): Promise<DetectedPattern[]>
  private async detectEventAnomalies(events: DeviceEvent[]): Promise<DetectedPattern[]>
  private async detectBatteryDegradation(deviceId: DeviceId): Promise<DetectedPattern[]>
}

// Result structure:
interface PatternDetectionResult {
  patterns: DetectedPattern[];         // Sorted by severity + score
  executionTimeMs: number;            // Performance tracking
  eventsAnalyzed: number;
  allAlgorithmsSucceeded: boolean;
  errors?: string[];                  // Graceful degradation
}

interface DetectedPattern {
  type: 'connectivity_gap' | 'automation_conflict' | 'event_anomaly' | 'battery_degradation' | 'normal';
  description: string;                // Human-readable
  occurrences: number;
  confidence: number;                 // 0.0-1.0
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;                      // 0.0-1.0 impact score
  deviceId?: DeviceId;
}
```

**Performance**:
- All algorithms parallel: <100ms for 100 events
- Target: <500ms total (within budget)
- Graceful degradation via `Promise.allSettled`

**Usage Pattern**:
```typescript
const patternDetector = serviceContainer.getPatternDetector();
const result = await patternDetector.detectAll(deviceId, events);

// Filter by severity
const criticalPatterns = result.patterns.filter(p => p.severity === 'critical');
```

### 2.3 SemanticIndex (Index Health)

**File**: `src/services/SemanticIndex.ts` (874 lines)

**Key Methods**:
```typescript
class SemanticIndex {
  // Health check API
  async getStats(): Promise<IndexStats>

  // Search (for device discovery)
  async searchDevices(query: string, options?: SearchOptions): Promise<DeviceSearchResult[]>
}

interface IndexStats {
  totalDevices: number;
  lastSync?: string;              // ISO timestamp
  collectionName: string;
  embeddingModel: string;
  healthy: boolean;               // ChromaDB connection status
}
```

**Performance**:
- Stats query: <5ms (no network call)
- Search: <100ms for 200 devices

**Usage Pattern**:
```typescript
const semanticIndex = serviceContainer.getSemanticIndex(); // If available
const stats = await semanticIndex.getStats();

// Check health
if (!stats.healthy) {
  // Report degraded semantic search
}
```

### 2.4 Event History (System-wide Issues)

**File**: `src/mcp/tools/device-events.ts`

**Key Methods**:
```typescript
// Via DeviceService
interface IDeviceService {
  async getDeviceEvents(
    deviceId: DeviceId,
    options: DeviceEventOptions
  ): Promise<DeviceEventResult>
}

interface DeviceEventOptions {
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  capabilities?: string[];
  attributes?: string[];
}

interface DeviceEventResult {
  events: DeviceEvent[];
  metadata: {
    totalCount: number;
    hasMore: boolean;
    dateRange: {
      earliest: string;
      latest: string;
      durationMs: number;
    };
    gapDetected: boolean;         // Connectivity issues
    largestGapMs: number;
    gaps: EventGap[];
    reachedRetentionLimit: boolean;
  };
}
```

**Performance**:
- Single device query: 50-200ms (SmartThings API)
- Multiple devices: Must parallelize with `Promise.allSettled`

**Usage Pattern**:
```typescript
const deviceService = serviceContainer.getDeviceService();

// Query recent events for all devices (parallel)
const eventQueries = devices.map(device =>
  deviceService.getDeviceEvents(device.deviceId, {
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h
    limit: 50
  }).catch(error => ({ error, deviceId: device.deviceId })) // Graceful degradation
);

const eventResults = await Promise.all(eventQueries);

// Extract system-wide issues
const allGaps = eventResults
  .filter(r => !r.error && r.metadata.gapDetected)
  .map(r => ({ deviceId: r.events[0].deviceId, gaps: r.metadata.gaps }));
```

---

## 3. Parallel Data Aggregation Patterns

### 3.1 Reference Implementation: `export_diagnostics`

**File**: `src/mcp/tools/diagnostics.ts` lines 696-828

**Pattern** (3-phase aggregation):

```typescript
async function handleExportDiagnostics(input: McpToolInput): Promise<CallToolResult> {
  const startTime = Date.now();

  // PHASE 1: Core system data (parallel)
  const [locations, devices, rooms] = await Promise.all([
    locationService.listLocations(),
    deviceService.listDevices(),
    locationService.listRooms(),
  ]);

  // PHASE 2: Device health (parallel with graceful degradation)
  const sampleDevices = devices.slice(0, maxDevices); // Sample to avoid timeout
  const healthChecks = sampleDevices.map(async (device) => {
    try {
      const status = await deviceService.getDeviceStatus(device.deviceId);
      return { deviceId: device.deviceId, /* ... health data */ };
    } catch (error) {
      return { deviceId: device.deviceId, healthStatus: 'error', error: error.message };
    }
  });

  const healthResults = await Promise.allSettled(healthChecks);

  // PHASE 3: Aggregate and format
  const report = {
    generatedAt: new Date().toISOString(),
    server: { /* metadata */ },
    smartthings: { /* counts */ },
    deviceHealth: healthResults.filter(r => r.status === 'fulfilled').map(r => r.value),
    // ...
  };

  const executionTime = Date.now() - startTime;
  return createMcpResponse(message, report);
}
```

**Key Insights**:
1. **Sampling**: Use `devices.slice(0, maxDevices)` to prevent timeout
2. **Graceful Degradation**: Use `Promise.allSettled` to get partial results
3. **Error Handling**: Catch individual failures, don't fail entire operation
4. **Performance Tracking**: Include `executionTimeMs` in response
5. **Structured + Human**: Return both formatted message and structured data

### 3.2 Latency Budget for get_system_status

**Target**: <500ms total

**Breakdown**:
```
Phase 1: Core Data (parallel)          ~50-100ms
- listDevices()                         ~30ms
- listRooms()                          ~20ms
- getStats() (cached)                   ~5ms

Phase 2: Pattern Detection (parallel)  ~100-200ms
- detectAll() per device (sample)       ~100ms each
- Run 5 devices in parallel            ~100ms total (with concurrency limit)

Phase 3: Event Queries (parallel)      ~100-150ms
- getDeviceEvents() per device         ~50ms each
- Run 5 devices in parallel            ~100ms total (sampled)

Phase 4: Semantic Index Health          ~5-10ms
- getStats() (no network)              ~5ms

Phase 5: Aggregation & Formatting       ~10-20ms
- Filter by severity                    ~5ms
- Group by room/capability             ~5ms
- Format response                      ~5ms

Total Estimated:                       ~265-480ms ✅ (within budget)
```

**Optimization Strategy**:
- Sample devices (max 10-20) to stay under 500ms
- Use `Promise.all` for independent operations
- Use `Promise.allSettled` for device-specific operations (graceful degradation)
- Cache expensive operations where possible
- Return partial results if individual operations fail

---

## 4. Report Structure Specification

### 4.1 Response Format (Following MCP Standards)

**Evidence**: All tools use `createMcpResponse(message, data)` pattern

```typescript
interface SystemStatusReport {
  // Human-readable summary (LLM-friendly)
  message: string;

  // Structured data
  data: {
    generatedAt: string;                // ISO timestamp
    executionTimeMs: number;            // Performance tracking

    // 1. Device Summary
    devices: {
      total: number;
      online: number;
      offline: number;
      byRoom: Record<string, number>;
      byCapability: Record<string, number>;
    };

    // 2. Connectivity Status
    connectivity: {
      healthyDevices: number;
      degradedDevices: number;
      criticalDevices: number;
      gaps: Array<{
        deviceId: string;
        deviceName: string;
        gapDuration: string;           // "2h 15m"
        severity: 'low' | 'medium' | 'high' | 'critical';
      }>;
    };

    // 3. Battery Status
    battery: {
      critical: number;                  // <10%
      low: number;                       // <20%
      devices: Array<{
        deviceId: string;
        deviceName: string;
        level: number;
        severity: 'critical' | 'high';
      }>;
    };

    // 4. Automation Issues (from PatternDetector)
    automation: {
      conflicts: number;
      anomalies: number;
      patterns: DetectedPattern[];       // Filtered by severity
    };

    // 5. Anomalies (aggregated)
    anomalies: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      details: DetectedPattern[];        // Top N by score
    };

    // 6. Semantic Index Health
    semanticSearch: {
      available: boolean;
      healthy: boolean;
      indexedDevices: number;
      lastSync?: string;
    };

    // Metadata
    appliedFilters: {
      room?: string;
      capability?: string;
      minSeverity?: string;
    };
    samplingUsed: boolean;               // True if limited to N devices
    devicesSampled?: number;
  };
}
```

### 4.2 Markdown Format (Alternative)

Similar to `export_diagnostics` markdown output:

```markdown
# SmartThings System Status Report

**Generated:** 2025-11-29T10:30:00Z
**Execution Time:** 345ms

## Device Summary
- **Total Devices:** 45
- **Online:** 42 (93%)
- **Offline:** 3 (7%)

### By Room
- Living Room: 12 devices
- Bedroom: 8 devices
- Kitchen: 6 devices

## Connectivity Status
⚠️ **3 devices with connectivity issues**

**Critical Issues:**
- Motion Sensor (Bedroom) - Offline for 12h
- Door Lock (Front Door) - Gap: 24h (critical)

## Battery Status
🔋 **2 devices need battery replacement**

- Contact Sensor (Window) - 8% (critical)
- Motion Sensor (Hallway) - 15% (low)

## Automation Patterns
🔄 **5 automation conflicts detected**

- Living Room Light - Rapid state changes (10 events in 30s)
- Thermostat - Automation re-trigger loop (high severity)

## Anomalies
🚨 **2 critical, 3 high priority issues**

1. **Event Storm** - Garage Door Sensor (critical)
   - >20 events in 1 minute
   - Confidence: 95%

2. **Repeated Failures** - Smart Plug (high)
   - "switch" failed 5 times
   - Confidence: 90%

## Semantic Search Status
✅ **Healthy** - 45 devices indexed, last sync 5 minutes ago
```

---

## 5. Filtering Implementation Patterns

### 5.1 Room Filtering

**Pattern** (from `device-query.ts`):

```typescript
// Step 1: Resolve room name to room ID
const locationService = serviceContainer.getLocationService();
const room = await locationService.findRoomByName(roomName);

// Step 2: Filter devices
const devices = await deviceService.listDevices(room.roomId);

// Step 3: Apply to all downstream queries
const patterns = await Promise.all(
  devices.map(device => patternDetector.detectAll(device.deviceId, events))
);
```

### 5.2 Capability Filtering

```typescript
// Filter devices by capability
const filteredDevices = devices.filter(device =>
  device.capabilities?.includes(capability)
);

// Only analyze filtered devices
const results = await Promise.all(
  filteredDevices.map(device => /* ... */)
);
```

### 5.3 Severity Filtering

```typescript
// After pattern detection, filter by minimum severity
const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
const minSeverityValue = severityOrder[minSeverity || 'low'];

const filteredPatterns = allPatterns.filter(pattern =>
  severityOrder[pattern.severity] >= minSeverityValue
);
```

---

## 6. Performance Optimization Strategy

### 6.1 Sampling Strategy

**Pattern** (from `export_diagnostics`):

```typescript
const maxDevices = options.maxDevices ?? 10; // Default: sample 10 devices
const sampleDevices = devices.slice(0, maxDevices);

// Indicate sampling in response
return {
  data: { /* ... */ },
  samplingUsed: devices.length > maxDevices,
  devicesSampled: sampleDevices.length,
  totalDevices: devices.length,
};
```

### 6.2 Parallel Execution with Limits

```typescript
// Limit concurrent operations to prevent overwhelming API
const CONCURRENCY_LIMIT = 5;

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  limit: number
): Promise<any[]> {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }
  return results;
}

// Usage
const healthResults = await processBatch(
  devices,
  async (device) => deviceService.getDeviceStatus(device.deviceId),
  CONCURRENCY_LIMIT
);
```

### 6.3 Caching Strategy

```typescript
// Cache DeviceRegistry stats (already cached internally)
const stats = deviceRegistry.getStats(); // <1ms

// Cache pattern detection results (future enhancement)
const cacheKey = `patterns:${deviceId}:${Date.now() - 5*60*1000}`; // 5min TTL
```

---

## 7. Error Handling Patterns

### 7.1 Graceful Degradation

**Pattern** (from `PatternDetector`):

```typescript
async function detectAll(deviceId: DeviceId, events: DeviceEvent[]): Promise<PatternDetectionResult> {
  const errors: string[] = [];

  // Run all algorithms, collect errors
  const results = await Promise.allSettled([
    this.detectConnectivityGaps(events),
    this.detectAutomationConflicts(events),
    this.detectEventAnomalies(events),
    this.detectBatteryDegradation(deviceId),
  ]);

  // Collect successful results
  const patterns: DetectedPattern[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      patterns.push(...result.value);
    } else if (result.status === 'rejected') {
      errors.push(result.reason.message);
    }
  }

  return {
    patterns,
    allAlgorithmsSucceeded: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### 7.2 Error Classification

**Pattern** (from all tools):

```typescript
try {
  // Tool logic
} catch (error) {
  const errorCode = classifyError(error); // Maps to MCP error codes
  return createMcpError(error, errorCode);
}

// classifyError maps:
// - Zod validation errors → INVALID_PARAMS (-32602)
// - Network errors → INTERNAL_ERROR (-32603)
// - Not found → Custom error with context
```

---

## 8. Test Coverage Recommendations

### 8.1 Unit Tests (Similar to `device-events.test.ts`)

```typescript
describe('handleGetSystemStatus', () => {
  describe('Input Validation', () => {
    it('should accept optional filters', async () => { /* ... */ });
    it('should validate severity enum', async () => { /* ... */ });
    it('should validate room name', async () => { /* ... */ });
  });

  describe('Data Aggregation', () => {
    it('should aggregate from all 4 data sources', async () => { /* ... */ });
    it('should handle PatternDetector errors gracefully', async () => { /* ... */ });
    it('should sample devices when exceeding limit', async () => { /* ... */ });
  });

  describe('Filtering', () => {
    it('should filter by room', async () => { /* ... */ });
    it('should filter by capability', async () => { /* ... */ });
    it('should filter by minimum severity', async () => { /* ... */ });
    it('should combine multiple filters', async () => { /* ... */ });
  });

  describe('Performance', () => {
    it('should complete in <500ms', async () => { /* ... */ });
    it('should use parallel execution', async () => { /* ... */ });
    it('should handle 200+ devices with sampling', async () => { /* ... */ });
  });
});
```

### 8.2 Integration Tests

```typescript
describe('get_system_status integration', () => {
  it('should generate complete report with real services', async () => {
    const result = await handleGetSystemStatus({});

    expect(result.isError).toBe(false);
    expect(result.data.devices).toBeDefined();
    expect(result.data.connectivity).toBeDefined();
    expect(result.data.battery).toBeDefined();
    expect(result.data.automation).toBeDefined();
    expect(result.data.executionTimeMs).toBeLessThan(500);
  });
});
```

---

## 9. Implementation Roadmap

### Phase 1: Core Implementation (1M-287)
1. Create `src/mcp/tools/system-status.ts`
2. Define input schema with Zod (room, capability, severity filters)
3. Implement core handler with 4 data sources
4. Add parallel aggregation with `Promise.allSettled`
5. Implement sampling strategy (max 10-20 devices)
6. Format response (markdown + structured data)
7. Add to tool exports and server registration

### Phase 2: Testing
1. Write unit tests (input validation, filtering, performance)
2. Write integration tests (end-to-end with real services)
3. Performance benchmarking (<500ms target)

### Phase 3: Integration with Diagnostic Flow (1M-288)
1. Call `get_system_status` from DiagnosticWorkflow
2. Use patterns for priority ordering
3. Display in CLI with severity indicators

---

## 10. Code Template (Starter)

```typescript
/**
 * System Status Tool - Comprehensive system health reporting.
 *
 * Related Ticket: 1M-287 - Phase 3.2: Build get_system_status MCP tool
 *
 * Architecture: Aggregates data from 4 sources in parallel
 * - DeviceRegistry: Device summaries and statistics
 * - PatternDetector: Behavioral patterns and anomalies (1M-286)
 * - SemanticIndex: Search index health status
 * - Event History: System-wide connectivity issues
 *
 * Performance Target: <500ms total execution time
 * - Parallel data fetching: ~100-200ms
 * - Pattern detection: ~100-200ms
 * - Aggregation: ~20-50ms
 * - Formatting: ~10-20ms
 *
 * Filtering: Supports scope filtering by room, capability, severity
 */

import { z } from 'zod';
import { createMcpResponse } from '../../types/mcp.js';
import { createMcpError, classifyError } from '../../utils/error-handler.js';
import type { McpToolInput } from '../../types/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceContainer } from '../../services/ServiceContainer.js';
import type { PatternSeverity, DetectedPattern } from '../../services/PatternDetector.js';
import logger from '../../utils/logger.js';

// Service container instance (injected during initialization)
let serviceContainer: ServiceContainer;

// ============================================================================
// Input Schema
// ============================================================================

const getSystemStatusSchema = z.object({
  roomName: z
    .string()
    .optional()
    .describe('Filter devices by room name (case-insensitive)'),

  capability: z
    .string()
    .optional()
    .describe('Filter devices by capability (e.g., "switch", "lock")'),

  minSeverity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .optional()
    .describe('Minimum severity threshold for issues (default: low)'),

  maxDevices: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .describe('Maximum devices to analyze for performance (default: 10, max: 50)'),

  format: z
    .enum(['json', 'markdown'])
    .default('markdown')
    .describe('Output format (default: markdown)'),
});

// ============================================================================
// Type Definitions
// ============================================================================

interface SystemStatusReport {
  generatedAt: string;
  executionTimeMs: number;
  devices: { /* ... */ };
  connectivity: { /* ... */ };
  battery: { /* ... */ };
  automation: { /* ... */ };
  anomalies: { /* ... */ };
  semanticSearch: { /* ... */ };
  appliedFilters: { /* ... */ };
  samplingUsed: boolean;
}

// ============================================================================
// Handler
// ============================================================================

export async function handleGetSystemStatus(input: McpToolInput): Promise<CallToolResult> {
  const startTime = Date.now();

  try {
    const { roomName, capability, minSeverity, maxDevices, format } =
      getSystemStatusSchema.parse(input);

    logger.info('Generating system status report', {
      roomName, capability, minSeverity, maxDevices
    });

    // Step 1: Get services
    const deviceService = serviceContainer.getDeviceService();
    const locationService = serviceContainer.getLocationService();
    const patternDetector = serviceContainer.getPatternDetector();

    // Step 2: Resolve filters (room name → room ID)
    let roomId;
    if (roomName) {
      const room = await locationService.findRoomByName(roomName);
      roomId = room.roomId;
    }

    // Step 3: Fetch core data (parallel)
    const [devices, rooms] = await Promise.all([
      deviceService.listDevices(roomId),
      locationService.listRooms(),
    ]);

    // Step 4: Apply capability filter
    const filteredDevices = capability
      ? devices.filter(d => d.capabilities?.includes(capability))
      : devices;

    // Step 5: Sample devices for performance
    const sampleDevices = filteredDevices.slice(0, maxDevices);

    // Step 6: Aggregate data (parallel with graceful degradation)
    // TODO: Implement parallel data fetching from all 4 sources
    // - Device health checks
    // - Pattern detection (PatternDetector.detectAll)
    // - Event history queries
    // - Semantic index stats

    // Step 7: Filter by severity
    // TODO: Filter patterns by minSeverity

    // Step 8: Format response
    const report: SystemStatusReport = {
      generatedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      devices: { /* ... */ },
      connectivity: { /* ... */ },
      battery: { /* ... */ },
      automation: { /* ... */ },
      anomalies: { /* ... */ },
      semanticSearch: { /* ... */ },
      appliedFilters: { roomName, capability, minSeverity },
      samplingUsed: filteredDevices.length > maxDevices,
    };

    // Step 9: Format output
    const output = format === 'json'
      ? JSON.stringify(report, null, 2)
      : generateMarkdownReport(report);

    return createMcpResponse(`System status report generated`, {
      format,
      summary: { /* ... */ },
      report: format === 'json' ? report : undefined,
      markdown: format === 'markdown' ? output : undefined,
    });

  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateMarkdownReport(report: SystemStatusReport): string {
  // TODO: Generate markdown format similar to export_diagnostics
  return `# System Status Report\n...`;
}

// ============================================================================
// Tool Exports
// ============================================================================

export function initializeSystemStatusTools(container: ServiceContainer): void {
  serviceContainer = container;
}

export const systemStatusTools = {
  get_system_status: {
    description:
      'Generate comprehensive system status report with device summaries, connectivity status, ' +
      'battery levels, automation patterns, anomalies, and semantic index health. ' +
      'Supports filtering by room, capability, and severity threshold. ' +
      'Report includes actionable insights for system maintenance.',
    inputSchema: {
      type: 'object',
      properties: {
        roomName: {
          type: 'string',
          description: 'Filter devices by room name (case-insensitive)',
        },
        capability: {
          type: 'string',
          description: 'Filter devices by capability (e.g., "switch", "lock")',
        },
        minSeverity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Minimum severity threshold (default: low)',
        },
        maxDevices: {
          type: 'number',
          description: 'Maximum devices to analyze (default: 10, max: 50)',
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          description: 'Output format (default: markdown)',
        },
      },
      required: [],
    },
    handler: handleGetSystemStatus,
  },
};
```

---

## 11. Integration Points with 1M-288

**Ticket 1M-288**: Integrate get_system_status into DiagnosticWorkflow

**Integration Pattern**:

```typescript
// In DiagnosticWorkflow.ts
class DiagnosticWorkflow {
  async runDiagnostics(deviceId: DeviceId): Promise<DiagnosticReport> {
    // Step 1: Get system status
    const systemStatus = await this.getSystemStatus();

    // Step 2: Use patterns for prioritization
    const criticalDevices = systemStatus.anomalies.details
      .filter(p => p.severity === 'critical')
      .map(p => p.deviceId);

    // Step 3: Run targeted diagnostics on critical devices first
    const results = await this.runDeviceDiagnostics(criticalDevices);

    return {
      systemStatus,
      deviceDiagnostics: results,
      recommendations: this.generateRecommendations(systemStatus, results),
    };
  }

  private async getSystemStatus(): Promise<SystemStatusReport> {
    // Call get_system_status tool via MCP or directly via handler
    const result = await handleGetSystemStatus({
      minSeverity: 'medium', // Only show actionable issues
    });
    return result.data as SystemStatusReport;
  }
}
```

---

## 12. References

**Source Files Analyzed**:
1. `src/mcp/tools/diagnostics.ts` (966 lines) - Tool structure, parallel aggregation patterns
2. `src/mcp/tools/system.ts` (89 lines) - Simple tool pattern
3. `src/mcp/tools/device-events.ts` (457+ lines) - Event query patterns, time range handling
4. `src/services/PatternDetector.ts` (554 lines) - Pattern detection algorithms, performance benchmarks
5. `src/services/SemanticIndex.ts` (874 lines) - Index health checks, search patterns
6. `src/abstract/DeviceRegistry.ts` (150+ lines) - Device querying, statistics
7. `src/services/ServiceContainer.ts` (200+ lines) - Dependency injection patterns
8. `src/server.ts` (148 lines) - Tool registration and MCP handler setup

**Related Tickets**:
- 1M-286: PatternDetector service (dependency)
- 1M-288: Integrate system status into DiagnosticWorkflow (consumer)

**Performance Benchmarks**:
- `export_diagnostics` with 10 devices: ~200-300ms
- `PatternDetector.detectAll`: <100ms per device
- `DeviceService.getDeviceEvents`: 50-200ms per device
- Target for `get_system_status`: <500ms with 10-20 devices

---

## 13. Next Steps

**Implementation Priority**:
1. ✅ Research complete (this document)
2. ⏭️ Create `system-status.ts` with core handler (1M-287)
3. ⏭️ Implement parallel aggregation from 4 data sources
4. ⏭️ Add filtering logic (room, capability, severity)
5. ⏭️ Write unit tests (input validation, filtering, performance)
6. ⏭️ Write integration tests (end-to-end with real services)
7. ⏭️ Performance optimization (<500ms target)
8. ⏭️ Register tool in `server.ts`
9. ⏭️ Integration with DiagnosticWorkflow (1M-288)

**Questions for PM/Implementation**:
- Should semantic index be optional (graceful degradation if ChromaDB unavailable)?
- Should we support CSV export format in addition to JSON/markdown?
- What should be the default severity threshold (low vs medium)?
- Should we cache system status reports (TTL: 1-5 minutes)?

---

**Research Completed**: 2025-11-29
**Ready for Implementation**: ✅ Yes
**Estimated Implementation Time**: 8-12 hours (handler + tests)
**Performance Confidence**: High (patterns proven in existing tools)
