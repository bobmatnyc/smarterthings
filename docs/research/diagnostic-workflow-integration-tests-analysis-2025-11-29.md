# DiagnosticWorkflow Integration Tests Analysis

**Research Date**: 2025-11-29
**Ticket**: 1M-311 - Add Integration Tests for End-to-End Diagnostic Workflow
**Researcher**: Claude (Research Agent)
**Status**: Pre-Implementation Analysis Complete

## Executive Summary

This analysis provides a comprehensive understanding of the DiagnosticWorkflow implementation and existing test patterns to support ticket 1M-311. The codebase has **excellent foundation** for integration testing:

- ✅ DiagnosticWorkflow fully implemented with clear service boundaries
- ✅ Existing integration test patterns using nock (3 test files already using it)
- ✅ Alcove device fixtures with realistic API responses (18 events, 6 devices)
- ✅ Test infrastructure ready with nock installed and configured
- ⚠️ **Gap**: No end-to-end integration tests per ticket requirements (no real API data simulation, no rate limit tests in workflow context)

**Key Finding**: The existing `alcove-diagnostic-workflow.test.ts` (621 lines) provides an excellent foundation, but ticket 1M-311 requires NEW integration tests that simulate REAL API behavior with nock mocking, not unit tests with service mocks.

---

## 1. DiagnosticWorkflow Structure

### File Location
**Implementation**: `/Users/masa/Projects/mcp-smartthings/src/services/DiagnosticWorkflow.ts`
**Lines**: 1,339 lines
**Exports**: `DiagnosticWorkflow` class + interfaces

### Key Methods

#### 1.1 Main Workflow Entry Point

```typescript
async executeDiagnosticWorkflow(
  classification: IntentClassification,
  userMessage: string
): Promise<DiagnosticReport>
```

**Workflow Steps**:
1. Resolve device reference (if present in classification)
2. Build data gathering plan based on intent type
3. Execute parallel data gathering (Promise.allSettled)
4. Populate diagnostic context from results
5. Generate rich context string for LLM injection
6. Create diagnostic report with recommendations

**Performance Target**: <500ms total workflow latency

#### 1.2 Device Resolution (Lines 784-841)

```typescript
private async resolveDevice(entities: any): Promise<UnifiedDevice | undefined>
```

**Resolution Priority**:
1. Exact deviceId match (O(1)) via DeviceRegistry
2. Semantic search by deviceName (O(log n)) via SemanticIndex
3. DeviceRegistry fuzzy match (O(n)) as fallback

#### 1.3 Data Gathering Methods (Private)

| Method | Purpose | API Endpoint Called |
|--------|---------|---------------------|
| `getDeviceHealth()` (849-892) | Get device health status | `getDeviceStatus()` |
| `getRecentEvents()` (901-923) | Retrieve device event history | `getDeviceEvents()` |
| `findSimilarDevices()` (932-961) | Find devices with similar capabilities | SemanticIndex search (no API) |
| `detectPatterns()` (977-1040) | Analyze event patterns | Uses cached events (no API) |
| `identifyControllingAutomations()` (1229-1286) | Find automations controlling device | `getDevice()` + AutomationService |
| `getSystemStatus()` (1293-1316) | Get system-wide device health | DeviceRegistry (no API) |

**Critical**: Only 3 methods make SmartThings API calls: `getDeviceHealth`, `getRecentEvents`, `identifyControllingAutomations`

#### 1.4 Pattern Detection Algorithms

```typescript
// Algorithm 1: Rapid state changes (Lines 1056-1101)
private detectRapidChanges(events: DeviceEvent[]): IssuePattern | null

// Algorithm 2: Automation triggers (Lines 1116-1162)
private detectAutomationTriggers(events: DeviceEvent[]): IssuePattern | null

// Algorithm 3: Connectivity gaps (Lines 1177-1201)
private detectConnectivityIssues(events: DeviceEvent[]): IssuePattern | null
```

**Pattern Types**:
- `rapid_changes`: State changes <10s apart (85% confidence)
- `automation_trigger`: OFF→ON within 5s (95% confidence, 98% if odd-hour)
- `connectivity_gap`: Event gaps >1 hour (80% confidence)
- `normal`: No unusual patterns (95% confidence)

#### 1.5 Data Gathering Plan (Lines 315-358)

**Intent-Based Data Collection**:

```typescript
switch (intent) {
  case 'device_health':
    - getDeviceHealth()
    - getRecentEvents(50)
    - findSimilarDevices(3)

  case 'issue_diagnosis':
    - getDeviceHealth()
    - getRecentEvents(100)
    - detectPatterns()
    - findSimilarDevices(3)
    - identifyControllingAutomations() // if ServiceContainer available

  case 'discovery':
    - findSimilarDevices(10)

  case 'system_status':
    - getSystemStatus()

  case 'mode_management':
  case 'normal_query':
    - No diagnostic data gathered
}
```

**Key Design Decision**: Promise.allSettled for parallel data gathering (graceful degradation on partial failures)

### Dependencies

```typescript
constructor(
  semanticIndex: SemanticIndex,
  deviceService: IDeviceService,
  deviceRegistry: DeviceRegistry,
  serviceContainer?: ServiceContainer  // Optional for automation identification
)
```

**Interfaces**:
- `IDeviceService`: Methods → `getDeviceStatus()`, `getDeviceEvents()`, `getDevice()`
- `SemanticIndex`: Methods → `searchDevices()`
- `DeviceRegistry`: Methods → `getDevice()`, `getAllDevices()`, `resolveDevice()`
- `ServiceContainer`: Methods → `getAutomationService()`

---

## 2. Existing Test Coverage

### 2.1 Unit Tests

**File**: `/Users/masa/Projects/mcp-smartthings/src/services/__tests__/DiagnosticWorkflow.test.ts`
**Lines**: ~200 lines (first 100 lines shown)

**Test Coverage**:
```typescript
describe('DiagnosticWorkflow', () => {
  describe('Device Resolution', () => {
    ✅ 'should resolve device by exact ID'
    ✅ 'should resolve device by semantic search'
    // More resolution tests...
  });

  describe('Data Gathering Plans', () => {
    // 5 tests for different intent types
  });

  describe('Context Population', () => {
    // 3 tests for Promise.allSettled handling
  });

  describe('Report Generation', () => {
    // 4 tests for formatting and recommendations
  });
});
```

**Test Pattern**: Mock all dependencies (SemanticIndex, DeviceService, DeviceRegistry) with vitest `vi.fn()`

**Coverage**: ~15+ tests covering:
- Device resolution (3 tests)
- Data gathering plans (5 tests)
- Context population (3 tests)
- Report generation (4 tests)

### 2.2 Pattern Detection Tests

**File**: `/Users/masa/Projects/mcp-smartthings/src/services/__tests__/DiagnosticWorkflow.patterns.test.ts`
**Purpose**: Test pattern detection algorithms in isolation

### 2.3 Evidence-Based Tests

**File**: `/Users/masa/Projects/mcp-smartthings/src/services/__tests__/DiagnosticWorkflow.evidence.test.ts`
**Purpose**: Test evidence-based recommendation generation

### 2.4 Integration Tests (Current)

**File**: `/Users/masa/Projects/mcp-smartthings/src/services/__tests__/DiagnosticWorkflow.integration.test.ts`
**Lines**: ~100 lines (first 100 shown)
**Status**: `describe.skipIf(process.env['CI'] === 'true')` - **SKIPPED IN CI**

**Test Approach**:
- ⚠️ Makes **REAL** SmartThings API calls (requires `SMARTTHINGS_PAT`)
- ⚠️ Requires `OPENROUTER_API_KEY` for LLM service
- ⚠️ **NOT** using nock - actual network requests
- ⚠️ Timeout: 30,000ms (30 seconds)

**Setup**:
```typescript
beforeAll(async () => {
  const smartThingsService = new SmartThingsService(); // Real service
  const llmService = new LlmService({ apiKey }); // Real LLM

  // Load real devices from SmartThings
  const devices = await deviceService.listDevices();
  // ... populate registry and semantic index
});
```

**Critical Gap**: These tests are **READ-ONLY** but make **real API calls**, not suitable for CI/CD.

### 2.5 Alcove Integration Test

**File**: `/Users/masa/Projects/mcp-smartthings/tests/integration/alcove-diagnostic-workflow.test.ts`
**Lines**: 621 lines
**Status**: ✅ USES NOCK (Best reference for 1M-311)

**Test Approach** (Per Ticket 1M-311 Requirements):
- ✅ Mock SmartThings API with nock for realistic HTTP simulation
- ✅ Mock ChromaDB to avoid indexing issues
- ✅ Use actual Alcove fixtures with 18 device events
- ✅ Validate diagnostic workflow service logic
- ✅ Test pattern detection algorithms

**Nock Setup Pattern**:
```typescript
import nock from 'nock';

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com';

beforeAll(async () => {
  // Mock ChromaDB first (before importing services)
  vi.mock('chromadb', () => ({
    ChromaClient: vi.fn(() => mockClient)
  }));

  // Initialize services (no API calls yet)
  const smartThingsService = new SmartThingsService();
  // ... other services
});

afterEach(() => {
  if (!nock.isDone()) {
    console.log('Pending nock mocks:', nock.pendingMocks());
  }
  nock.cleanAll();
});

it('TC-1.1: should resolve Alcove device', async () => {
  // Mock device list endpoint
  nock(SMARTTHINGS_API_BASE)
    .persist()
    .get('/v1/devices')
    .reply(200, deviceListFixture);

  // Mock device detail endpoint
  nock(SMARTTHINGS_API_BASE)
    .persist()
    .get(/^\/devices\/[^\/]+$/)
    .reply(200, alcoveDeviceFixture);

  // Mock events endpoint
  nock(SMARTTHINGS_API_BASE)
    .persist()
    .get(/^\/devices\/[^\/]+\/events$/)
    .query(true)
    .reply(200, alcoveEventsFixture);

  // Test diagnostic workflow
  const report = await workflow.executeDiagnosticWorkflow(classification, 'check alcove');

  expect(report.diagnosticContext.device).toBeDefined();
  expect(report.diagnosticContext.recentEvents).toHaveLength(18);
});
```

**Key Observations**:
- ✅ Uses `.persist()` for reusable mocks across multiple API calls
- ✅ Uses regex patterns to match any device ID: `/^\/devices\/[^\/]+$/`
- ✅ Uses `.query(true)` to accept any query parameters
- ✅ Validates nock mocks were consumed with `nock.isDone()`
- ✅ ChromaDB mocked to avoid vector indexing overhead

**Coverage Gaps (Per Ticket 1M-311)**:
- ❌ No rate limit handling tests (429 errors)
- ❌ No retry logic validation
- ❌ No error recovery scenarios
- ❌ Only tests "happy path" (all API calls succeed)

---

## 3. SmartThings API Integration Points

### 3.1 SmartThingsService API Methods

**File**: `/Users/masa/Projects/mcp-smartthings/src/smartthings/client.ts`
**Class**: `SmartThingsService implements ISmartThingsService`

**API Methods Used by DiagnosticWorkflow**:

| Method | API Endpoint | Purpose |
|--------|--------------|---------|
| `listDevices(roomId?)` | `GET /v1/devices` | List all devices (filtered by room) |
| `getDevice(deviceId)` | `GET /v1/devices/{deviceId}` | Get device details (used by automation identification) |
| `getDeviceStatus(deviceId)` | `GET /v1/devices/{deviceId}/status` | Get current device state |
| `getDeviceEvents(deviceId, options)` | `GET /v1/devices/{deviceId}/events` | Get device event history |

**Rate Limit Handling**: All methods wrapped with `retryWithBackoff()` from `/Users/masa/Projects/mcp-smartthings/src/utils/retry.ts`

### 3.2 API Response Structures

#### 3.2.1 Device List Response

**Endpoint**: `GET /v1/devices`

```json
{
  "items": [
    {
      "deviceId": "alcove-bedroom-light-001",
      "name": "Alcove Bedroom Light",
      "label": "Alcove Bedroom Light",
      "deviceManufacturerCode": "ZWAVE-001",
      "locationId": "location-home-001",
      "roomId": "room-bedroom-001",
      "components": [
        {
          "id": "main",
          "capabilities": [
            {"id": "switch", "version": 1},
            {"id": "healthCheck", "version": 1}
          ]
        }
      ],
      "type": "DTH"
    }
  ]
}
```

**Fixture**: `/Users/masa/Projects/mcp-smartthings/tests/fixtures/device-list.json` (6 devices)

#### 3.2.2 Device Status Response

**Endpoint**: `GET /v1/devices/{deviceId}/status`

```json
{
  "components": {
    "main": {
      "switch": {
        "switch": {
          "value": "on",
          "timestamp": "2025-11-29T10:00:00Z"
        }
      },
      "battery": {
        "battery": {
          "value": 85,
          "unit": "%"
        }
      }
    }
  }
}
```

**Note**: Battery extraction supports both root-level (`status.battery`) and component-level (`status.components.main.battery.battery.value`)

#### 3.2.3 Device Events Response

**Endpoint**: `GET /v1/devices/{deviceId}/events?limit=100`

```json
[
  {
    "deviceId": "alcove-bedroom-light-001",
    "deviceName": "Alcove Bedroom Light",
    "locationId": "location-home-001",
    "locationName": "Home",
    "time": "2025-11-28T22:00:00.000Z",
    "epoch": 1732834800000,
    "component": "main",
    "componentLabel": "Main",
    "capability": "switch",
    "attribute": "switch",
    "value": "on",
    "text": "Switch turned on",
    "hash": "event-hash-001"
  }
]
```

**Fixture**: `/Users/masa/Projects/mcp-smartthings/tests/fixtures/alcove-events.json` (18 events)

**Event Patterns in Fixture**:
1. **Automation Pattern**: 5 daily ON events at 10pm (Nov 23-28)
2. **Rapid Changes**: 6 state changes in 11 minutes (Nov 25 14:30-14:41)
3. **Normal Usage**: Random daytime events

### 3.3 Universal Device ID Handling

**Critical**: SmartThingsService supports both formats:
- Platform ID: `"alcove-bedroom-light-001"` (SmartThings UUID)
- Universal ID: `"smartthings:alcove-bedroom-light-001"` (cross-platform format)

**Implementation** (Lines 124-127 in client.ts):
```typescript
async getDeviceStatus(deviceId: DeviceId): Promise<DeviceStatus> {
  // Extract platform-specific ID if universal ID provided
  const platformDeviceId = isUniversalDeviceId(deviceId)
    ? parseUniversalDeviceId(deviceId).platformDeviceId
    : deviceId;

  return await this.client.devices.getStatus(platformDeviceId);
}
```

**Pattern Applied To**:
- `getDeviceStatus()`
- `getDevice()`
- `getDeviceEvents()`
- `executeCommand()`

---

## 4. Test Infrastructure

### 4.1 Fixtures Directory

**Location**: `/Users/masa/Projects/mcp-smartthings/tests/fixtures/`

**Files**:
```
fixtures/
├── README.md (239 lines) - Excellent documentation
├── alcove-device.json (1.3 KB) - Single device detail
├── alcove-events.json (7.5 KB) - 18 events with patterns
└── device-list.json (6.7 KB) - 6 devices
```

**Fixture Quality**:
- ✅ Valid JSON syntax
- ✅ Matches SmartThings API structure exactly
- ✅ Contains diagnostic-worthy patterns (automation, rapid changes)
- ✅ Ready for nock mocking
- ✅ Comprehensive documentation in README.md

**Fixture Coverage**:
- 6 diverse devices (switch, thermostat, lock, motion, contact, dimmer)
- 18 events spanning 6 days
- 2 distinct diagnostic patterns (automation + rapid changes)
- Full device metadata (manufacturer, Z-Wave, capabilities)

### 4.2 Nock Usage Patterns

**Installation**: ✅ nock v14.0.10 installed (found in package.json and node_modules)

**Existing Test Files Using Nock**:
1. `/Users/masa/Projects/mcp-smartthings/tests/integration/alcove-diagnostic-workflow.test.ts` (621 lines)
2. `/Users/masa/Projects/mcp-smartthings/tests/integration/rate-limit-handling.test.ts` (80+ lines)
3. `/Users/masa/Projects/mcp-smartthings/tests/integration/api-response-validation.test.ts`

**Common Pattern** (from rate-limit-handling.test.ts):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com';

describe('Rate Limit Tests', () => {
  beforeEach(() => {
    nock.cleanAll(); // Clear all interceptors
  });

  afterEach(() => {
    if (!nock.isDone()) {
      console.log('Pending nock mocks:', nock.pendingMocks());
    }
    nock.cleanAll();
  });

  it('should retry on 429', async () => {
    // First request: 429 error
    nock(SMARTTHINGS_API_BASE)
      .get('/devices')
      .reply(429,
        { error: 'Too Many Requests' },
        { 'Retry-After': '1' }
      );

    // Second request: Success
    nock(SMARTTHINGS_API_BASE)
      .get('/devices')
      .reply(200, { items: [] });

    // Test code...
  });
});
```

**Rate Limit Handling** (from retry.ts utility):
- Exponential backoff: 1s, 2s, 4s delays
- Respects `Retry-After` header from 429 responses
- Max retries: 3 attempts
- Throws `RateLimitError` after max retries

### 4.3 ChromaDB Mocking Pattern

**Issue**: SemanticIndex uses ChromaDB for vector search, which requires:
- ChromaDB server running
- Indexing overhead
- External dependency

**Solution** (from alcove-diagnostic-workflow.test.ts):
```typescript
vi.mock('chromadb', () => {
  const mockCollection = {
    add: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockImplementation(async ({ queryTexts, nResults }) => {
      if (queryTexts?.[0]?.toLowerCase().includes('alcove')) {
        return {
          ids: [['smartthings:alcove-bedroom-light-001']],
          distances: [[0.15]], // High similarity
          metadatas: [[{
            name: 'Bedroom Alcove Light',
            label: 'Alcove Bedroom Light',
            platform: 'smartthings',
            online: true,
          }]],
          documents: [['Alcove Bedroom Light, bedroom, switchable light']],
        };
      }
      return { ids: [[]], distances: [[]], metadatas: [[]], documents: [[]] };
    }),
  };

  const mockClient = {
    getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection),
  };

  return { ChromaClient: vi.fn(() => mockClient) };
});
```

**Benefits**:
- ✅ No ChromaDB server required
- ✅ Deterministic search results
- ✅ Fast test execution
- ✅ Query-based response logic (supports multiple search terms)

### 4.4 Test Helper Utilities

**Retry Logic**: `/Users/masa/Projects/mcp-smartthings/src/utils/retry.ts`
- `retryWithBackoff()`: Exponential backoff with 429 handling
- `RateLimitError`: Custom error for max retries exceeded

**Type Utilities**: `/Users/masa/Projects/mcp-smartthings/src/types/`
- `device-events.ts`: `createDeviceEvent()`, `detectEventGaps()`, `parseTimeRange()`
- `unified-device.ts`: `parseUniversalDeviceId()`, `isUniversalDeviceId()`

**Test Fixtures**: Already documented in Section 4.1

---

## 5. Coverage Gaps (Per Ticket 1M-311)

### What's Currently Tested

✅ **Unit Tests** (DiagnosticWorkflow.test.ts):
- Device resolution (exact ID, semantic search, fuzzy match)
- Data gathering plans for each intent type
- Context population with Promise.allSettled
- Report generation and formatting
- Pattern detection algorithms (separate file)
- Evidence-based recommendations (separate file)

✅ **Alcove Integration Test** (alcove-diagnostic-workflow.test.ts):
- Device resolution via semantic search with nock
- Event retrieval with fixtures
- Pattern detection (automation, rapid changes)
- ChromaDB mocking

✅ **Rate Limit Test** (rate-limit-handling.test.ts):
- 429 retry logic
- Retry-After header handling

### What's Missing (Per 1M-311 Acceptance Criteria)

❌ **End-to-End Integration Tests**:
- No test simulating complete workflow: device resolution → event retrieval → pattern detection → recommendations
- No test validating parallel data gathering (Promise.allSettled) with real API mocking
- No test for partial failures (e.g., getDeviceHealth succeeds but getRecentEvents fails)

❌ **Real API Data Simulation**:
- Current unit tests use mocks (`vi.fn()`) not realistic HTTP responses
- No tests validating API response parsing edge cases (missing fields, null values)
- No tests for different device types (thermostat vs switch vs lock)

❌ **Rate Limit Handling in Workflow Context**:
- Rate limit tests exist for SmartThingsService, but NOT for DiagnosticWorkflow
- No test for: "What happens if getDeviceEvents returns 429 during workflow execution?"
- No test for: "Does workflow continue with partial data if one API call fails?"

❌ **Error Recovery Scenarios**:
- No test for device not found (404)
- No test for network errors (ECONNREFUSED)
- No test for malformed API responses
- No test for Promise.allSettled graceful degradation

❌ **Automation Identification Tests**:
- `identifyControllingAutomations()` calls AutomationService but no integration test
- No test for: "Does workflow gracefully handle AutomationService unavailable?"

---

## 6. Recommended File Structure for 1M-311

### New Files to Create

#### 6.1 Primary Integration Test File

```
tests/integration/diagnostic-workflow-end-to-end.test.ts
```

**Purpose**: End-to-end integration tests for DiagnosticWorkflow with nock API mocking

**Test Cases** (TC-3 per ticket):
1. **TC-3.1**: Device health check workflow
   - Mock: GET /v1/devices/{id}/status
   - Mock: GET /v1/devices/{id}/events?limit=50
   - Mock: SemanticIndex.searchDevices (ChromaDB mock)
   - Validate: DiagnosticReport with health data and events

2. **TC-3.2**: Issue diagnosis workflow with automation detection
   - Mock: GET /v1/devices/{id}/status
   - Mock: GET /v1/devices/{id}/events?limit=100
   - Mock: GET /v1/devices/{id} (for locationId extraction)
   - Mock: AutomationService.findRulesForDevice
   - Validate: Pattern detection (rapid_changes or automation_trigger)
   - Validate: Identified automations in report

3. **TC-3.3**: System status workflow
   - Mock: DeviceRegistry.getAllDevices (no API, uses in-memory data)
   - Validate: System health summary (total, healthy, critical counts)

4. **TC-3.4**: Partial failure handling (Promise.allSettled test)
   - Mock: GET /v1/devices/{id}/status → 200 OK
   - Mock: GET /v1/devices/{id}/events → 500 Internal Server Error
   - Validate: Report generated with health data but NO events
   - Validate: Recommendations still provided based on available data

5. **TC-3.5**: Rate limit during workflow execution
   - Mock: GET /v1/devices/{id}/status → 200 OK
   - Mock: GET /v1/devices/{id}/events → 429 (first attempt)
   - Mock: GET /v1/devices/{id}/events → 200 OK (retry)
   - Validate: Workflow completes successfully after retry
   - Validate: Total time respects Retry-After delay

#### 6.2 Additional Fixtures (Optional)

```
tests/fixtures/thermostat-events.json
tests/fixtures/lock-events.json
tests/fixtures/motion-sensor-events.json
```

**Purpose**: Test different device types (currently only alcove switch events exist)

**Priority**: LOW (can reuse alcove-events.json for initial tests)

### Files to Modify

#### 6.3 Extend Existing Alcove Test

```
tests/integration/alcove-diagnostic-workflow.test.ts
```

**Changes Needed**:
- Add TC-1.4: Automation identification test (currently missing)
- Add TC-1.5: Rate limit handling during event retrieval
- Add TC-1.6: Partial failure test (health succeeds, events fail)

**Rationale**: This file already has excellent nock setup, can extend it

#### 6.4 Update Fixtures README

```
tests/fixtures/README.md
```

**Changes Needed**:
- Document new fixtures (if created)
- Add section: "Integration Test Coverage Matrix"
- Reference ticket 1M-311

---

## 7. Implementation Recommendations

### 7.1 Test Organization Strategy

**Option 1: Single Comprehensive File** (RECOMMENDED)
```
tests/integration/diagnostic-workflow-end-to-end.test.ts (new)
- TC-3.1: Device health workflow
- TC-3.2: Issue diagnosis with automation
- TC-3.3: System status workflow
- TC-3.4: Partial failure handling
- TC-3.5: Rate limit during workflow
- TC-3.6: Device not found (404)
- TC-3.7: Network error recovery
```

**Pros**:
- All workflow integration tests in one place
- Easy to reuse nock setup patterns
- Matches existing test file sizes (alcove test is 621 lines)

**Cons**:
- Large file (estimated 400-500 lines)

**Option 2: Split by Scenario Type**
```
tests/integration/diagnostic-workflow-happy-path.test.ts (new)
tests/integration/diagnostic-workflow-error-handling.test.ts (new)
tests/integration/diagnostic-workflow-rate-limits.test.ts (new)
```

**Pros**:
- Smaller, focused files
- Easy to run specific scenario types

**Cons**:
- More files to maintain
- Duplicate nock setup code
- Harder to find "all workflow tests"

**Recommendation**: Use **Option 1** (single file) to match existing pattern (alcove test is 621 lines)

### 7.2 Nock Setup Pattern

**Recommended Base Pattern**:
```typescript
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import nock from 'nock';

// Mock ChromaDB BEFORE importing services
vi.mock('chromadb', () => {
  // ... (reuse pattern from alcove test)
});

import { DiagnosticWorkflow } from '../../src/services/DiagnosticWorkflow.js';
// ... other imports

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com';

describe('TC-3: DiagnosticWorkflow End-to-End Integration Tests', () => {
  let workflow: DiagnosticWorkflow;
  let deviceService: DeviceService;
  // ... other services

  beforeAll(async () => {
    // Initialize services (no API calls)
    const smartThingsService = new SmartThingsService();
    deviceService = new DeviceService(smartThingsService);
    semanticIndex = new SemanticIndex();
    deviceRegistry = new DeviceRegistry();

    await semanticIndex.initialize();

    // Load fixtures into registry (no API calls)
    for (const device of deviceListFixture.items) {
      const unified = toUnifiedDevice(device);
      deviceRegistry.addDevice(unified);
      await semanticIndex.indexDevice(createDeviceMetadataDocument(unified));
    }

    workflow = new DiagnosticWorkflow(semanticIndex, deviceService, deviceRegistry);
  });

  afterEach(() => {
    if (!nock.isDone()) {
      console.log('Pending nock mocks:', nock.pendingMocks());
    }
    nock.cleanAll();
  });

  it('TC-3.1: should execute device health workflow', async () => {
    // Mock API endpoints
    nock(SMARTTHINGS_API_BASE)
      .get(/^\/devices\/[^\/]+$/)
      .reply(200, alcoveDeviceFixture);

    nock(SMARTTHINGS_API_BASE)
      .get(/^\/devices\/[^\/]+\/status$/)
      .reply(200, { components: { main: { switch: { switch: { value: 'on' } } } } });

    nock(SMARTTHINGS_API_BASE)
      .get(/^\/devices\/[^\/]+\/events$/)
      .query({ limit: 50 })
      .reply(200, alcoveEventsFixture.slice(0, 50));

    // Execute workflow
    const classification: IntentClassification = {
      intent: DiagnosticIntent.DEVICE_HEALTH,
      confidence: 0.95,
      entities: { deviceName: 'Alcove' },
      requiresDiagnostics: true,
    };

    const report = await workflow.executeDiagnosticWorkflow(classification, 'check alcove');

    // Validate report structure
    expect(report.diagnosticContext.device).toBeDefined();
    expect(report.diagnosticContext.healthData).toBeDefined();
    expect(report.diagnosticContext.healthData?.online).toBe(true);
    expect(report.diagnosticContext.recentEvents).toHaveLength(18);

    // Validate nock mocks consumed
    expect(nock.isDone()).toBe(true);
  });

  // More tests...
});
```

### 7.3 ChromaDB Mock Reuse

**Recommendation**: Extract ChromaDB mock to shared test helper

**New File**: `tests/helpers/chromadb-mock.ts`
```typescript
import { vi } from 'vitest';

export function setupChromaDBMock(deviceFixtures: any[]) {
  vi.mock('chromadb', () => {
    const mockCollection = {
      add: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation(async ({ queryTexts }) => {
        // Dynamic response based on query
        const query = queryTexts?.[0]?.toLowerCase() || '';

        const matchedDevice = deviceFixtures.find(device =>
          device.label.toLowerCase().includes(query) ||
          device.name.toLowerCase().includes(query)
        );

        if (matchedDevice) {
          return {
            ids: [[`smartthings:${matchedDevice.deviceId}`]],
            distances: [[0.15]],
            metadatas: [[{
              name: matchedDevice.name,
              label: matchedDevice.label,
              platform: 'smartthings',
              online: true,
            }]],
            documents: [[`${matchedDevice.label}, ${matchedDevice.roomName}`]],
          };
        }

        return { ids: [[]], distances: [[]], metadatas: [[]], documents: [[]] };
      }),
    };

    const mockClient = {
      getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection),
    };

    return { ChromaClient: vi.fn(() => mockClient) };
  });
}
```

**Usage**:
```typescript
import { setupChromaDBMock } from '../helpers/chromadb-mock.js';

setupChromaDBMock(deviceListFixture.items);
// Then import services...
```

**Benefit**: DRY (Don't Repeat Yourself) - reuse mock across multiple test files

### 7.4 Rate Limit Test Pattern

**Recommended Pattern** (from rate-limit-handling.test.ts):
```typescript
it('TC-3.5: should retry on 429 during event retrieval', async () => {
  const startTime = Date.now();

  // Mock device status: Success
  nock(SMARTTHINGS_API_BASE)
    .get(/^\/devices\/[^\/]+\/status$/)
    .reply(200, { components: { main: { switch: { switch: { value: 'on' } } } } });

  // Mock events: First attempt 429
  nock(SMARTTHINGS_API_BASE)
    .get(/^\/devices\/[^\/]+\/events$/)
    .query(true)
    .reply(429,
      { error: 'Too Many Requests' },
      { 'Retry-After': '1' }
    );

  // Mock events: Retry succeeds
  nock(SMARTTHINGS_API_BASE)
    .get(/^\/devices\/[^\/]+\/events$/)
    .query(true)
    .reply(200, alcoveEventsFixture);

  // Execute workflow
  const report = await workflow.executeDiagnosticWorkflow(classification, 'check alcove');

  const elapsed = Date.now() - startTime;

  // Validate retry occurred
  expect(report.diagnosticContext.recentEvents).toBeDefined();
  expect(report.diagnosticContext.recentEvents).toHaveLength(18);

  // Validate Retry-After delay respected (should be >= 1000ms)
  expect(elapsed).toBeGreaterThanOrEqual(1000);

  // Validate nock mocks consumed
  expect(nock.isDone()).toBe(true);
});
```

### 7.5 Partial Failure Test Pattern

**Recommended Pattern** (demonstrates Promise.allSettled graceful degradation):
```typescript
it('TC-3.4: should handle partial failures gracefully', async () => {
  // Mock device status: Success
  nock(SMARTTHINGS_API_BASE)
    .get(/^\/devices\/[^\/]+\/status$/)
    .reply(200, {
      components: {
        main: {
          switch: { switch: { value: 'on' } },
          battery: { battery: { value: 85 } }
        }
      }
    });

  // Mock events: Failure (500 Internal Server Error)
  nock(SMARTTHINGS_API_BASE)
    .get(/^\/devices\/[^\/]+\/events$/)
    .query(true)
    .reply(500, { error: 'Internal Server Error' });

  // Execute workflow
  const classification: IntentClassification = {
    intent: DiagnosticIntent.DEVICE_HEALTH,
    confidence: 0.95,
    entities: { deviceName: 'Alcove' },
    requiresDiagnostics: true,
  };

  const report = await workflow.executeDiagnosticWorkflow(classification, 'check alcove');

  // Validate partial data present
  expect(report.diagnosticContext.device).toBeDefined();
  expect(report.diagnosticContext.healthData).toBeDefined();
  expect(report.diagnosticContext.healthData?.online).toBe(true);
  expect(report.diagnosticContext.healthData?.batteryLevel).toBe(85);

  // Validate missing data handled gracefully
  expect(report.diagnosticContext.recentEvents).toBeUndefined();

  // Validate recommendations still provided
  expect(report.recommendations).toBeDefined();
  expect(report.recommendations.length).toBeGreaterThan(0);

  // Validate workflow did NOT throw error
  expect(report.summary).toContain('Diagnostic data gathered');

  // Validate nock mocks consumed
  expect(nock.isDone()).toBe(true);
});
```

---

## 8. Next Steps (Implementation Checklist)

### Phase 1: Setup (Estimated 30 minutes)

- [ ] Create `/Users/masa/Projects/mcp-smartthings/tests/integration/diagnostic-workflow-end-to-end.test.ts`
- [ ] Copy nock setup boilerplate from `alcove-diagnostic-workflow.test.ts`
- [ ] Import fixtures (alcove-device.json, alcove-events.json, device-list.json)
- [ ] Setup ChromaDB mock pattern
- [ ] Initialize services in `beforeAll()`

### Phase 2: Happy Path Tests (Estimated 2 hours)

- [ ] **TC-3.1**: Device health workflow
  - Mock: getDeviceStatus, getDeviceEvents(50), SemanticIndex
  - Validate: DiagnosticReport with health data and 50 events

- [ ] **TC-3.2**: Issue diagnosis workflow
  - Mock: getDeviceStatus, getDeviceEvents(100), getDevice, AutomationService
  - Validate: Pattern detection (rapid_changes or automation_trigger)
  - Validate: Recommendations include automation guidance

- [ ] **TC-3.3**: System status workflow
  - Use DeviceRegistry (no API mocks needed)
  - Validate: System health counts (total, healthy, critical)

### Phase 3: Error Handling Tests (Estimated 1.5 hours)

- [ ] **TC-3.4**: Partial failure (Promise.allSettled)
  - Mock: getDeviceStatus → 200, getDeviceEvents → 500
  - Validate: Report generated with partial data

- [ ] **TC-3.5**: Rate limit during workflow
  - Mock: getDeviceEvents → 429, then 200 on retry
  - Validate: Retry-After delay respected

- [ ] **TC-3.6**: Device not found (404)
  - Mock: getDeviceStatus → 404
  - Validate: Workflow handles gracefully (device undefined in context)

### Phase 4: Validation and Documentation (Estimated 30 minutes)

- [ ] Run tests: `npm test tests/integration/diagnostic-workflow-end-to-end.test.ts`
- [ ] Verify all nock mocks consumed (`nock.isDone()`)
- [ ] Add comments explaining each test scenario
- [ ] Update `/Users/masa/Projects/mcp-smartthings/tests/fixtures/README.md` to reference new tests
- [ ] Create PR with test coverage report

---

## 9. Success Criteria Validation

**Ticket 1M-311 Acceptance Criteria**:

✅ **Integration tests with nock API mocking**:
- Recommended file: `diagnostic-workflow-end-to-end.test.ts`
- Pattern: Nock setup from `alcove-diagnostic-workflow.test.ts` (proven to work)

✅ **Alcove device fixtures**:
- Existing fixtures ready: `alcove-device.json`, `alcove-events.json`, `device-list.json`
- 18 events with 2 diagnostic patterns (automation + rapid changes)

✅ **Rate limit handling**:
- Test TC-3.5: Mock 429 → retry → 200
- Validate Retry-After delay respected
- Reuse pattern from `rate-limit-handling.test.ts`

✅ **End-to-end workflow validation**:
- Tests TC-3.1, TC-3.2, TC-3.3 cover full workflow
- Device resolution → data gathering → pattern detection → recommendations

✅ **Error recovery scenarios**:
- Test TC-3.4: Partial failure (Promise.allSettled)
- Test TC-3.6: Device not found (404)
- Validates graceful degradation

---

## 10. Risk Assessment

### Low Risk
- ✅ Nock already installed and used successfully in 3 test files
- ✅ Fixtures already created and documented
- ✅ Test patterns proven to work (alcove test passes)
- ✅ ChromaDB mock pattern already established

### Medium Risk
- ⚠️ **Test file size**: Estimated 400-500 lines (acceptable, alcove test is 621 lines)
- ⚠️ **Rate limit timing**: Test execution time may vary (mitigate with timeout increase)
- ⚠️ **Nock regex patterns**: Ensure regex matches actual API paths (validate with logging)

### Mitigations
- Use `.persist()` for reusable mocks to reduce duplication
- Increase test timeout to 10,000ms (10 seconds) for rate limit tests
- Log nock pending mocks in `afterEach()` to catch unmatched requests
- Validate nock.isDone() in every test to ensure all mocks consumed

---

## 11. References

**Files Analyzed**:
- `/Users/masa/Projects/mcp-smartthings/src/services/DiagnosticWorkflow.ts` (1,339 lines)
- `/Users/masa/Projects/mcp-smartthings/src/services/__tests__/DiagnosticWorkflow.test.ts` (~200 lines)
- `/Users/masa/Projects/mcp-smartthings/tests/integration/alcove-diagnostic-workflow.test.ts` (621 lines)
- `/Users/masa/Projects/mcp-smartthings/tests/integration/rate-limit-handling.test.ts` (80+ lines)
- `/Users/masa/Projects/mcp-smartthings/tests/fixtures/README.md` (239 lines)
- `/Users/masa/Projects/mcp-smartthings/src/smartthings/client.ts` (150+ lines analyzed)

**Ticket Reference**: 1M-311 - Add Integration Tests for End-to-End Diagnostic Workflow

**Related Documentation**:
- SmartThings API: https://developer.smartthings.com/docs/api/public
- Nock Documentation: https://github.com/nock/nock
- Vitest Documentation: https://vitest.dev/

---

**End of Research Report**

**Next Action**: Proceed with Phase 1 (Setup) to create `diagnostic-workflow-end-to-end.test.ts` using recommended patterns from this analysis.
