# Device Polling Service: trackedDevices=0 Bug Analysis

**Date:** 2025-12-22
**Investigator:** Research Agent
**Severity:** Medium (Polling works, but tracking metrics are incorrect)
**Status:** Root cause identified

## Problem Statement

DevicePollingService shows `trackedDevices: 0` in status endpoint despite:
- Polling running successfully (pollCount incrementing)
- Device data showing valid state: `Master Down Lights: ['switch', 'dimmer'] state={'switch': 'off', 'level': 90}`
- No errors in polling logic

## Root Cause Analysis

### The Core Mismatch

**Issue:** Device capabilities are **DeviceCapability enum values**, but polling service checks for **string capability names**.

**Location:** `src/services/device-polling-service.ts:305-308`

```typescript
private extractState(device: UnifiedDevice, capability: string): DeviceState | null {
  // Check if device has this capability
  const hasCapability = device.capabilities.some((cap) => {
    // Convert DeviceCapability enum to string for comparison
    return String(cap).toLowerCase() === capability.toLowerCase();
  });
```

### What's Actually Happening

1. **Device capabilities array contains:**
   ```typescript
   device.capabilities = [
     DeviceCapability.SWITCH,   // Enum value: 'switch'
     DeviceCapability.DIMMER     // Enum value: 'dimmer'
   ]
   ```

2. **Polling config monitors these strings:**
   ```typescript
   capabilities: [
     'motionSensor',
     'contactSensor',
     'switch',           // ✅ Matches
     'dimmer',           // ✅ Matches
     'lock',
     'temperatureSensor',
   ]
   ```

3. **The comparison works correctly:**
   ```typescript
   String(DeviceCapability.SWITCH).toLowerCase() === 'switch'.toLowerCase()
   // Returns: true ✅
   ```

4. **BUT the state extraction fails:**
   ```typescript
   // Line 336: Extract state from platformSpecific.state
   const state = device.platformSpecific?.['state'] as Record<string, any> | undefined;
   if (!state || typeof state !== 'object') {
     return null; // ❌ FAILS HERE - No state available
   }
   ```

### The Real Problem: Missing State Data

**Root Cause:** `device.platformSpecific.state` is **undefined** when devices come from `SmartThingsAdapter.listDevices()`.

**Why?**
- `SmartThingsAdapter.listDevices()` calls `this.mapDeviceToUnified(device)` (line 341)
- `mapDeviceToUnified()` creates UnifiedDevice from SmartThings Device object (line 1300)
- **Device object from SmartThings SDK does NOT include status/state data**
- `platformSpecific` only contains: `type`, `components`, `roomId` (line 1322-1326)
- **No state field is populated**

```typescript
// SmartThingsAdapter.mapDeviceToUnified (line 1300-1327)
private mapDeviceToUnified(device: Device): UnifiedDevice {
  return {
    // ... other fields
    platformSpecific: {
      type: device.type,
      components: device.components?.map((c) => c.id),
      roomId: device.roomId,
      // ❌ NO STATE FIELD
    },
  };
}
```

### Comparison: Web API vs Adapter

**Web API (`/api/devices`):**
- Uses `SmartThingsClient.listDevices()` (src/smartthings/client.ts)
- **Fetches device status in parallel** (ticket 1M-604)
- Extracts state with `extractDeviceState(status)` helper
- **Populates `platformSpecific.state`** ✅

```typescript
// src/smartthings/client.ts (listDevices method)
const deviceInfosWithState = await Promise.all(
  filteredDevices.map(async (device) => {
    try {
      const status = await this.getDeviceStatus(device.deviceId);
      const state = extractDeviceState(status);  // ✅ Extracts state
      return {
        ...device,
        platformSpecific: {
          ...device.platformSpecific,
          state,  // ✅ Adds state to platformSpecific
        },
      };
    } catch (error) {
      return device;  // Fallback: return without state
    }
  })
);
```

**SmartThingsAdapter (`adapter.listDevices()`):**
- Uses SmartThings SDK `this.client!.devices.list()` (line 334)
- **Does NOT fetch device status**
- Maps Device → UnifiedDevice without state
- **`platformSpecific.state` is undefined** ❌

```typescript
// SmartThingsAdapter.listDevices (line 323-364)
async listDevices(filters?: DeviceFilters): Promise<UnifiedDevice[]> {
  const devices = await retryWithBackoff(async () => {
    return await this.client!.devices.list();  // ❌ Only returns device metadata
  });

  let unifiedDevices = devices.map((device) =>
    this.mapDeviceToUnified(device)  // ❌ No status fetching
  );

  return unifiedDevices;
}
```

## Evidence Chain

### 1. Device Capabilities Are Correctly Populated

From SmartThingsAdapter (line 1336-1355):
```typescript
private extractDeviceCapabilities(device: Device): DeviceCapability[] {
  const capabilities = new Set<DeviceCapability>();

  // Extract capabilities from all components
  for (const component of device.components || []) {
    for (const cap of component.capabilities || []) {
      const unifiedCap = this.mapPlatformCapability(cap.id);
      if (unifiedCap) {
        capabilities.add(unifiedCap);  // ✅ Adds DeviceCapability enum
      }
    }
  }

  return Array.from(capabilities);
}
```

**Result:** `device.capabilities = [DeviceCapability.SWITCH, DeviceCapability.DIMMER]`

### 2. Polling Config Matches Capability Names

From DevicePollingService (line 92-102):
```typescript
const DEFAULT_CONFIG: PollConfig = {
  intervalMs: 5000,
  capabilities: [
    'motionSensor',
    'contactSensor',
    'switch',           // ✅ Matches DeviceCapability.SWITCH
    'dimmer',           // ✅ Matches DeviceCapability.DIMMER
    'lock',
    'temperatureSensor',
  ],
};
```

### 3. Capability Check Passes

From DevicePollingService.extractState (line 305-308):
```typescript
const hasCapability = device.capabilities.some((cap) => {
  return String(cap).toLowerCase() === capability.toLowerCase();
});

if (!hasCapability) {
  return null;  // ✅ Does NOT return here - capability found
}
```

### 4. State Extraction Fails

From DevicePollingService.extractState (line 336-339):
```typescript
const state = device.platformSpecific?.['state'] as Record<string, any> | undefined;
if (!state || typeof state !== 'object') {
  return null; // ❌ RETURNS HERE - state is undefined
}
```

**Debug Output Would Show:**
```
device.platformSpecific = {
  type: 'VIPER',
  components: ['main'],
  roomId: 'abc-123'
  // state: undefined ❌
}
```

### 5. No Devices Get Tracked

From DevicePollingService.checkDeviceState (line 253-256):
```typescript
const currentState = this.extractState(device, capName);
if (!currentState) {
  continue; // ❌ Skips tracking - no state available
}

// Never reaches this point:
const key = `${device.platformDeviceId}:${capName}`;
this.previousStates.set(key, currentState);  // ❌ Never executes
```

**Result:** `this.previousStates.size === 0` → `trackedDevices: 0`

## Why Polling Still Works

Polling appears to work because:
1. `pollCount` increments on every cycle (line 199)
2. Devices are fetched successfully (line 202)
3. No errors are thrown (silent skip when state unavailable)
4. Logs show "Poll cycle complete (no changes)" (line 227-230)

**But:**
- No state changes are ever detected (no state to compare)
- No events are emitted (changeCount stays at 0)
- Tracking metrics are misleading (trackedDevices: 0)

## Architecture Mismatch

### Two Different Data Flows

**Flow 1: Web API → Frontend**
```
Frontend GET /api/devices
    ↓
DeviceRouter.listDevices()
    ↓
SmartThingsClient.listDevices()
    ↓ Fetch devices.list()
    ↓ Fetch status for each device (parallel)
    ↓ extractDeviceState(status)
    ↓
Returns DeviceInfo[] WITH state ✅
    ↓
platformSpecific.state = { switch: 'off', level: 90 }
```

**Flow 2: Polling Service**
```
DevicePollingService.poll()
    ↓
SmartThingsAdapter.listDevices()
    ↓
SmartThings SDK: devices.list()
    ↓
mapDeviceToUnified(device)
    ↓
Returns UnifiedDevice[] WITHOUT state ❌
    ↓
platformSpecific.state = undefined
```

### Why They Differ

**SmartThingsClient (Web API):**
- Purpose: Provide rich data to frontend
- Performance: Acceptable latency (~300-500ms)
- State enrichment: Required for UI display
- Implementation: **Fetches status in parallel** (ticket 1M-604)

**SmartThingsAdapter (Polling):**
- Purpose: Platform abstraction layer
- Performance: Fast device enumeration
- State enrichment: **Not implemented**
- Implementation: Only calls `devices.list()` (metadata only)

## Impact Analysis

### Current Impact

**Functionality:**
- ❌ Device state changes are **NOT detected** by polling service
- ❌ No events emitted to SSE clients
- ❌ Real-time updates not working via polling
- ❌ Metrics are misleading (`trackedDevices: 0`)

**User Experience:**
- ✅ Frontend works (uses separate API with state enrichment)
- ❌ Real-time state updates require SSE/webhooks (polling fallback broken)
- ❌ Monitoring/debugging difficult (misleading metrics)

**System Health:**
- ❌ Polling service is effectively non-functional
- ✅ No crashes or errors (silent degradation)
- ❌ Wastes resources (polls but doesn't track)

### Severity Assessment

**Medium Severity** because:
- Frontend still works (uses different data path)
- No user-facing failures (yet)
- Polling was intended as fallback mechanism
- Metrics mislead operators

**Could become High Severity if:**
- SSE/webhook subscriptions fail
- Users expect real-time updates
- Monitoring alerts trigger incorrectly

## Solution Options

### Option 1: Enrich SmartThingsAdapter.listDevices() with State

**Approach:** Make adapter fetch status like SmartThingsClient does

**Implementation:**
```typescript
// In SmartThingsAdapter.listDevices()
async listDevices(filters?: DeviceFilters): Promise<UnifiedDevice[]> {
  const devices = await retryWithBackoff(async () => {
    return await this.client!.devices.list();
  });

  // NEW: Fetch status for all devices in parallel
  const devicesWithStatus = await Promise.all(
    devices.map(async (device) => {
      try {
        const status = await this.client!.devices.getStatus(device.deviceId);
        const state = this.extractState(status);  // Extract state

        return {
          ...this.mapDeviceToUnified(device),
          platformSpecific: {
            ...this.mapDeviceToUnified(device).platformSpecific,
            state,  // Add state
          },
        };
      } catch (error) {
        // Fallback: return without state
        return this.mapDeviceToUnified(device);
      }
    })
  );

  // Apply filters
  return this.applyFilters(devicesWithStatus, filters);
}
```

**Pros:**
- ✅ Consistent data across all paths
- ✅ Polling service works immediately
- ✅ No changes to polling service needed

**Cons:**
- ❌ Adds latency to adapter (300-500ms per poll cycle)
- ❌ Increases SmartThings API calls (~2x)
- ❌ Potential rate limiting issues
- ❌ Duplicates state extraction logic

**Performance Impact:**
- Before: ~50ms (devices.list() only)
- After: ~300-500ms (devices.list() + parallel status fetches)
- Rate limit concern: 60 devices × 12 polls/minute = 720 API calls/min

### Option 2: Add Dedicated State Fetching to Polling Service

**Approach:** Make polling service fetch state separately

**Implementation:**
```typescript
// In DevicePollingService.checkDeviceState()
private async checkDeviceState(device: UnifiedDevice): Promise<number> {
  let changesDetected = 0;

  // NEW: Fetch state if not present
  let deviceState = device.platformSpecific?.['state'] as Record<string, any> | undefined;

  if (!deviceState && this.fetchStateCallback) {
    try {
      deviceState = await this.fetchStateCallback(device.platformDeviceId);
    } catch (error) {
      logger.warn('[DevicePolling] Failed to fetch state', {
        deviceId: device.platformDeviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;  // Skip this device
    }
  }

  // Check each configured capability
  for (const capName of this.config.capabilities) {
    const currentState = this.extractStateFromRaw(deviceState, capName);
    if (!currentState) continue;

    // ... rest of change detection logic
  }

  return changesDetected;
}
```

**Pros:**
- ✅ Minimal adapter changes
- ✅ Polling service self-contained
- ✅ Can batch/optimize state fetches

**Cons:**
- ❌ Couples polling service to platform specifics
- ❌ Still increases API calls
- ❌ Adds complexity to polling service

**Performance Impact:**
- Similar to Option 1 (~300-500ms per cycle)
- Better control over batching/timing

### Option 3: Use Different Capability Check Strategy

**Approach:** Don't rely on state, use capabilities metadata for tracking

**Implementation:**
```typescript
private extractState(device: UnifiedDevice, capability: string): DeviceState | null {
  const hasCapability = device.capabilities.some((cap) => {
    return String(cap).toLowerCase() === capability.toLowerCase();
  });

  if (!hasCapability) {
    return null;
  }

  // NEW: Create placeholder state for tracking
  // Actual state will be fetched on-demand or from cache
  return {
    deviceId: device.platformDeviceId,
    deviceName: device.name,
    capability,
    attribute: this.getAttributeForCapability(capability),
    value: null,  // Placeholder - will fetch when needed
    timestamp: new Date(),
  };
}
```

**Pros:**
- ✅ No additional API calls during enumeration
- ✅ Tracks devices correctly
- ✅ Lazy state fetching on change detection

**Cons:**
- ❌ Complex change detection logic
- ❌ Still need state eventually
- ❌ May miss first state change

### Option 4: Hybrid Approach (Recommended)

**Approach:** Enrich adapter conditionally based on context

**Implementation:**
```typescript
// Add flag to adapter method
async listDevices(
  filters?: DeviceFilters,
  options?: { includeState?: boolean }
): Promise<UnifiedDevice[]> {
  const devices = await this.client!.devices.list();

  if (options?.includeState) {
    // Fetch state in parallel (same as SmartThingsClient)
    return await this.enrichWithState(devices);
  }

  // Fast path: metadata only
  return devices.map((d) => this.mapDeviceToUnified(d));
}
```

**Usage:**
```typescript
// Polling service (needs state)
new DevicePollingService(
  async () => await adapter.listDevices(undefined, { includeState: true }),
  { intervalMs: 5000 }
);

// Other callers (metadata only)
const devices = await adapter.listDevices();  // Fast
```

**Pros:**
- ✅ Flexible: Pay for state only when needed
- ✅ Backward compatible
- ✅ Clear API contract
- ✅ Consolidates state enrichment logic

**Cons:**
- ❌ API surface expansion
- ❌ Still increases API calls for polling

**Performance Impact:**
- Fast path: ~50ms (unchanged)
- With state: ~300-500ms (same as Option 1)
- Only polling service pays the cost

## Recommended Solution

**Option 4 (Hybrid Approach)** is recommended because:

1. **Flexibility:** Callers choose performance vs completeness
2. **Consolidation:** Single place for state enrichment logic
3. **Backward Compatibility:** Existing callers unaffected
4. **Clear Intent:** `includeState: true` makes performance cost explicit
5. **Future-Proof:** Easy to add caching/optimization later

### Implementation Plan

**Phase 1: Extract State Enrichment Helper**
1. Create shared `enrichDevicesWithState()` helper
2. Move state extraction logic from SmartThingsClient
3. Make reusable across adapter and client

**Phase 2: Add Optional State Enrichment to Adapter**
1. Add `options.includeState` parameter
2. Call shared helper when flag is true
3. Update adapter interface documentation

**Phase 3: Update Polling Service**
1. Pass `{ includeState: true }` in getDevices callback
2. Verify state extraction works
3. Add logging for tracked device count

**Phase 4: Add Caching (Future)**
1. Cache device state in adapter
2. TTL-based invalidation
3. Reduce redundant API calls

## Testing Recommendations

### Unit Tests

```typescript
describe('DevicePollingService', () => {
  it('should track devices with valid state', async () => {
    const mockDevices: UnifiedDevice[] = [
      {
        platformDeviceId: 'device-1',
        capabilities: [DeviceCapability.SWITCH],
        platformSpecific: {
          state: { switch: 'off' },  // ✅ State present
        },
      },
    ];

    const service = new DevicePollingService(
      async () => mockDevices,
      { intervalMs: 1000 }
    );

    service.start();
    await sleep(1500);  // Wait for first poll

    const status = service.getStatus();
    expect(status.trackedDevices).toBe(1);  // ✅ Should track
  });

  it('should NOT track devices without state', async () => {
    const mockDevices: UnifiedDevice[] = [
      {
        platformDeviceId: 'device-1',
        capabilities: [DeviceCapability.SWITCH],
        platformSpecific: {},  // ❌ No state
      },
    ];

    const service = new DevicePollingService(
      async () => mockDevices,
      { intervalMs: 1000 }
    );

    service.start();
    await sleep(1500);

    const status = service.getStatus();
    expect(status.trackedDevices).toBe(0);  // ❌ Should NOT track
  });
});
```

### Integration Tests

```typescript
describe('SmartThingsAdapter with state enrichment', () => {
  it('should include state when requested', async () => {
    const adapter = new SmartThingsAdapter(config);
    await adapter.initialize();

    const devices = await adapter.listDevices(undefined, { includeState: true });

    expect(devices.length).toBeGreaterThan(0);

    const lightDevice = devices.find((d) =>
      d.capabilities.includes(DeviceCapability.SWITCH)
    );

    expect(lightDevice?.platformSpecific?.state).toBeDefined();
    expect(lightDevice?.platformSpecific?.state?.switch).toMatch(/on|off/);
  });

  it('should omit state when not requested', async () => {
    const adapter = new SmartThingsAdapter(config);
    await adapter.initialize();

    const devices = await adapter.listDevices();  // No includeState

    const lightDevice = devices.find((d) =>
      d.capabilities.includes(DeviceCapability.SWITCH)
    );

    expect(lightDevice?.platformSpecific?.state).toBeUndefined();
  });
});
```

## Related Issues

### Ticket References

- **1M-604:** Device state enrichment in SmartThingsClient
  - Already implements parallel status fetching
  - Could be extracted into shared helper

### Similar Patterns in Codebase

**deviceInfoToUnified.ts (line 528):**
```typescript
const state = extractDeviceState(status);
if (state) platformSpecific['state'] = state;
```
- Already has state extraction logic
- Used by transformer layer
- Could be consolidated with SmartThingsClient version

**SmartThingsAdapter.getDeviceState() (line 413):**
```typescript
async getDeviceState(deviceId: string): Promise<DeviceState> {
  const status = await this.client!.devices.getStatus(platformDeviceId);
  return this.mapStatusToState(platformDeviceId, status);
}
```
- Fetches single device state
- Could be used as basis for batch enrichment

## Conclusion

**Root Cause:** `SmartThingsAdapter.listDevices()` does not populate `platformSpecific.state`, causing polling service to skip all devices.

**Immediate Fix:** Add optional state enrichment to adapter with `includeState` flag.

**Long-term Fix:** Consolidate state enrichment logic, add caching layer.

**Priority:** Medium - Does not affect primary user flows, but breaks real-time updates fallback.

## Appendix: Debug Commands

### Check Adapter Output
```typescript
const adapter = new SmartThingsAdapter(config);
await adapter.initialize();
const devices = await adapter.listDevices();

console.log('Device:', devices[0].name);
console.log('Capabilities:', devices[0].capabilities);
console.log('Platform Specific:', devices[0].platformSpecific);
// Expected: platformSpecific.state === undefined
```

### Check Polling Service
```typescript
const service = new DevicePollingService(
  async () => await adapter.listDevices(),
  { intervalMs: 5000 }
);

service.start();
await sleep(10000);

const status = service.getStatus();
console.log('Status:', status);
// Expected: trackedDevices === 0
```

### Check SmartThingsClient Output
```typescript
const client = new SmartThingsClient(config);
const deviceInfos = await client.listDevices();

console.log('Device:', deviceInfos[0].name);
console.log('Platform Specific:', deviceInfos[0].platformSpecific);
// Expected: platformSpecific.state === { switch: 'off', level: 90, ... }
```
