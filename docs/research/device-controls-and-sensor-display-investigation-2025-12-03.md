# Device Controls and Sensor Display Investigation

**Date:** 2025-12-03
**Research Focus:** Two critical UI issues with device controls and sensor data display
**Priority:** HIGH - Blocking basic device interaction functionality

---

## Executive Summary

**Issue 1: Switch Controls Not Working**
**Root Cause:** Device state data (switch on/off, dimmer level) is not being fetched or populated in the UnifiedDevice objects returned by `/api/devices`. The frontend SwitchControl and DimmerControl components attempt to read `device.platformSpecific?.state` which is undefined.

**Issue 2: Sensor Data Not Displayed**
**Root Cause:** DeviceCard component only renders controls for actuator capabilities (SWITCH, DIMMER) and shows "No controls available" for sensor-only devices. There is no code path to display sensor attribute values (temperature, humidity, motion, illuminance).

**Impact:**
- Switch controls appear but don't reflect actual device state (always show "Off")
- User cannot see current device status before toggling
- All sensor devices show "No controls available" message
- Zooz 4-in-1 sensor and similar devices provide zero value to users
- Core smart home monitoring functionality is broken

---

## Issue 1: Switch Controls Not Working

### Symptoms

User reports switch controls "don't work" (specifics unknown). Investigation reveals:
1. Switch toggle buttons render correctly
2. API calls are being made when toggling (`POST /api/devices/:id/on`, `/api/devices/:id/off`)
3. **Device state is not displayed** - switches always show "Off" regardless of actual state
4. Controls cannot show current state because state data is missing

### Architecture Analysis

#### Current Data Flow

```
Frontend Request
    ↓
GET /api/devices
    ↓
ToolExecutor.listDevices()
    ↓
handleListDevices() → deviceService.listDevices()
    ↓
smartThingsService.listDevices()
    ↓
Returns: DeviceInfo[] (NO STATE DATA)
    ↓
Frontend receives devices WITHOUT current state
```

#### Where State is Available

State data exists in SmartThings API but is accessed through a separate endpoint:

```typescript
// Separate call required for each device:
GET /api/devices/:deviceId/status
    ↓
Returns: DeviceStatus with component state
    ↓
status.components.main.switch.switch.value = "on" | "off"
status.components.main.switchLevel.level.value = 0-100
```

### Code Locations

**Frontend Components:**

1. **SwitchControl.svelte** (`web/src/lib/components/devices/controls/SwitchControl.svelte`)
   - Lines 28-35: Attempts to read `device.platformSpecific?.state.switch`
   - **Problem:** `platformSpecific.state` is always undefined
   - Fallback: Defaults to `false` (always shows "Off")

2. **DimmerControl.svelte** (`web/src/lib/components/devices/controls/DimmerControl.svelte`)
   - Lines 31-42: Attempts to read `device.platformSpecific?.state.switch` and `state.level`
   - **Problem:** Same as SwitchControl - no state data available
   - Fallback: Defaults to off + 100% brightness

3. **DeviceCard.svelte** (`web/src/lib/components/devices/DeviceCard.svelte`)
   - Lines 45-58: Determines which control to render (dimmer, switch, or none)
   - **Problem:** Shows control UI but with incorrect state

**Backend API:**

1. **server-alexa.ts** (`src/server-alexa.ts`)
   - Line 295: `GET /api/devices` endpoint
   - Returns devices from `executor.listDevices()` without status enrichment
   - Line 433: `GET /api/devices/:deviceId/status` endpoint exists but not called by frontend during list

2. **device-query.ts** (`src/mcp/tools/device-query.ts`)
   - Line 72: `deviceService.listDevices(roomId)` returns `DeviceInfo[]`
   - No status/state data included

3. **DeviceService.ts** (`src/services/DeviceService.ts`)
   - Line 100: `listDevices()` returns `DeviceInfo[]` (no state)
   - Line 129: `getDeviceStatus()` returns `DeviceStatus` (has state) but requires separate call per device

**Type Definitions:**

1. **unified-device.ts** (`src/types/unified-device.ts`)
   - UnifiedDevice interface does NOT include a `state` field
   - Only has: id, platform, name, capabilities, online, lastSeen, platformSpecific
   - `platformSpecific` is type `Record<string, unknown>` but never populated with state

2. **deviceInfoToUnified.ts** (`src/services/transformers/deviceInfoToUnified.ts`)
   - Line 238-242: `platformSpecific` only populated with type, components, locationId, roomId
   - **Missing:** Device state data is never added to platformSpecific

### Root Cause

**The UnifiedDevice model separates device metadata from device state:**
- `/api/devices` returns device metadata (capabilities, room, name) via `DeviceInfo`
- Device state requires separate `/api/devices/:id/status` calls via `DeviceStatus`
- Frontend never fetches status, so controls have no state to display

**Design flaw:** No mechanism to enrich device list with current state in bulk.

### Fix Options

#### Option A: Enrich Device List with Status (Recommended)

**Approach:** Fetch status for all devices during list operation and populate `platformSpecific.state`

**Implementation:**
```typescript
// In DeviceService.listDevices()
async listDevices(roomId?: RoomId): Promise<UnifiedDevice[]> {
  const deviceInfos = await this.smartThingsService.listDevices(roomId);

  // Fetch status for all devices in parallel
  const devicesWithStatus = await Promise.all(
    deviceInfos.map(async (info) => {
      try {
        const status = await this.smartThingsService.getDeviceStatus(info.deviceId);
        const unified = toUnifiedDevice(info, status);

        // Extract state from status components
        const state = extractDeviceState(status);
        return {
          ...unified,
          platformSpecific: {
            ...unified.platformSpecific,
            state, // { switch: "on", level: 50, temperature: 72, ... }
          },
        };
      } catch (error) {
        // Log error but don't fail entire list
        return toUnifiedDevice(info);
      }
    })
  );

  return devicesWithStatus;
}

// Helper to extract relevant state attributes
function extractDeviceState(status: DeviceStatus): Record<string, any> {
  const state: Record<string, any> = {};
  const main = status.components?.main;

  if (!main) return state;

  // Extract common attributes
  if (main.switch?.switch?.value) state.switch = main.switch.switch.value;
  if (main.switchLevel?.level?.value !== undefined) state.level = main.switchLevel.level.value;
  if (main.temperatureMeasurement?.temperature?.value !== undefined) {
    state.temperature = main.temperatureMeasurement.temperature.value;
  }
  if (main.relativeHumidityMeasurement?.humidity?.value !== undefined) {
    state.humidity = main.relativeHumidityMeasurement.humidity.value;
  }
  if (main.motionSensor?.motion?.value) state.motion = main.motionSensor.motion.value;
  if (main.illuminanceMeasurement?.illuminance?.value !== undefined) {
    state.illuminance = main.illuminanceMeasurement.illuminance.value;
  }

  return state;
}
```

**Pros:**
- Controls display correct state immediately
- Single API call to frontend
- Fixes sensor display issue simultaneously (state includes sensor data)

**Cons:**
- Performance impact: N status API calls to SmartThings (can be parallelized)
- Increased latency for device list (~200-500ms for 20-50 devices)

**Mitigation:**
- Implement in-memory caching with 10-second TTL
- Use Promise.all() for parallel fetching
- Consider pagination for large device lists

#### Option B: SSE State Updates (Alternative)

**Approach:** Use existing SSE endpoint (`/api/devices/events`) to push state updates after initial load

**Implementation:**
1. Frontend loads devices without state (fast initial render)
2. Subscribe to SSE stream
3. Backend broadcasts initial state for all devices
4. Controls update reactively via Svelte runes

**Pros:**
- Fast initial page load
- Real-time state updates already work
- Minimal backend changes

**Cons:**
- Controls show unknown state briefly
- More complex frontend logic
- Still need to fetch initial state somehow

#### Option C: Lazy State Loading (Not Recommended)

**Approach:** Fetch state on-demand when user interacts with control

**Pros:**
- Minimal backend changes
- No performance impact on list

**Cons:**
- Poor UX - controls show incorrect state
- Extra API calls on interaction
- Doesn't solve sensor display problem

### Recommended Fix: Option A (Enrich Device List)

**Rationale:**
1. **Correctness:** Users need to see current state before interacting
2. **Performance:** Acceptable with caching (10s TTL) + parallelization
3. **Completeness:** Solves both switch controls AND sensor display
4. **Simplicity:** Frontend requires zero changes

**Performance Target:**
- Current: ~50-100ms for device list (no state)
- With enrichment: ~300-600ms for 20 devices (parallel status fetches)
- With caching: ~50-100ms after first load (cache hit)

---

## Issue 2: Sensor Data Not Displayed

### Symptoms

Zooz 4-in-1 sensor shows "No controls available" instead of displaying:
- Motion status (active/inactive)
- Temperature reading (°F)
- Humidity percentage
- Illuminance level (lux)

### Current Rendering Logic

**DeviceCard.svelte** (lines 45-58):

```typescript
let controlType = $derived.by(() => {
  // Priority 1: Dimmer (includes level control)
  if (hasCapability('dimmer' as DeviceCapability)) {
    return 'dimmer';
  }

  // Priority 2: Switch (basic on/off)
  if (hasCapability('switch' as DeviceCapability)) {
    return 'switch';
  }

  // No controllable capability found
  return null;
});
```

**Result:** Sensors with only read-only capabilities (motionSensor, temperatureMeasurement, etc.) return `null` and trigger "No controls available" message (line 155-157).

### Problem Analysis

**Fundamental issue:** DeviceCard component conflates "controls" (actuators) with "display" (sensors).

**Capability Classification:**

1. **Actuator Capabilities** (have commands):
   - SWITCH: on(), off()
   - DIMMER: setLevel(0-100)
   - THERMOSTAT: setHeatingSetpoint(), setCoolingSetpoint()

2. **Sensor Capabilities** (read-only attributes):
   - MOTION_SENSOR: motion (active/inactive)
   - TEMPERATURE_SENSOR: temperature (value + unit)
   - HUMIDITY_SENSOR: humidity (0-100%)
   - ILLUMINANCE_SENSOR: illuminance (lux)

**Current logic only handles #1, ignores #2.**

### Device Data Structure

**Zooz 4-in-1 Sensor Example:**

```typescript
{
  id: "smartthings:abc-123-def",
  name: "Zooz 4-in-1 Sensor",
  capabilities: [
    "motionSensor",
    "temperatureMeasurement",
    "relativeHumidityMeasurement",
    "illuminanceMeasurement",
    "battery"
  ],
  platformSpecific: {
    state: { // ← This would be populated with Option A fix
      motion: "active",
      temperature: 72.5,
      humidity: 45,
      illuminance: 850,
      battery: 95
    }
  }
}
```

### Fix Requirements

#### 1. Create Sensor Display Components

**SensorReadings.svelte** (new component):

```svelte
<script lang="ts">
  import type { UnifiedDevice } from '$types';

  interface Props {
    device: UnifiedDevice;
  }

  let { device }: Props = $props();

  // Extract sensor readings from platformSpecific.state
  const state = device.platformSpecific?.state as any;

  // Map capabilities to sensor readings
  const readings = $derived.by(() => {
    const data: Array<{ label: string; value: string; icon: string }> = [];

    if (device.capabilities.includes('temperatureSensor') && state?.temperature !== undefined) {
      data.push({
        label: 'Temperature',
        value: `${state.temperature}°F`,
        icon: '🌡️'
      });
    }

    if (device.capabilities.includes('humiditySensor') && state?.humidity !== undefined) {
      data.push({
        label: 'Humidity',
        value: `${state.humidity}%`,
        icon: '💧'
      });
    }

    if (device.capabilities.includes('motionSensor') && state?.motion) {
      data.push({
        label: 'Motion',
        value: state.motion === 'active' ? 'Detected' : 'Clear',
        icon: '🏃'
      });
    }

    if (device.capabilities.includes('illuminanceSensor') && state?.illuminance !== undefined) {
      data.push({
        label: 'Light Level',
        value: `${state.illuminance} lux`,
        icon: '💡'
      });
    }

    if (device.capabilities.includes('battery') && state?.battery !== undefined) {
      data.push({
        label: 'Battery',
        value: `${state.battery}%`,
        icon: '🔋'
      });
    }

    return data;
  });
</script>

<div class="space-y-2">
  {#each readings as reading}
    <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-surface-700 rounded">
      <div class="flex items-center gap-2">
        <span class="text-xl" aria-hidden="true">{reading.icon}</span>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {reading.label}
        </span>
      </div>
      <span class="text-sm font-semibold text-gray-900 dark:text-white">
        {reading.value}
      </span>
    </div>
  {/each}
</div>
```

#### 2. Update DeviceCard Rendering Logic

**DeviceCard.svelte** modifications:

```svelte
<script lang="ts">
  import SwitchControl from './controls/SwitchControl.svelte';
  import DimmerControl from './controls/DimmerControl.svelte';
  import SensorReadings from './controls/SensorReadings.svelte'; // NEW

  // Determine display type (not just "control" type)
  let displayType = $derived.by(() => {
    // Priority 1: Dimmer
    if (hasCapability('dimmer' as DeviceCapability)) {
      return 'dimmer';
    }

    // Priority 2: Switch
    if (hasCapability('switch' as DeviceCapability)) {
      return 'switch';
    }

    // Priority 3: Sensor readings (NEW)
    const sensorCapabilities = [
      'temperatureSensor',
      'humiditySensor',
      'motionSensor',
      'illuminanceSensor',
      'contactSensor',
      'battery'
    ];

    const hasSensorData = sensorCapabilities.some(cap =>
      hasCapability(cap as DeviceCapability)
    );

    if (hasSensorData) {
      return 'sensor';
    }

    // No displayable data
    return null;
  });
</script>

<!-- Controls/Display Section -->
<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
  {#if displayType === 'dimmer'}
    <DimmerControl {device} />
  {:else if displayType === 'switch'}
    <SwitchControl {device} />
  {:else if displayType === 'sensor'}
    <SensorReadings {device} />
  {:else}
    <div class="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
      No controls or sensors available
    </div>
  {/if}
</div>
```

#### 3. Handle Hybrid Devices

Some devices have both actuators AND sensors (e.g., smart thermostat with temperature sensor, motion-detecting light switch).

**Enhanced rendering strategy:**

```svelte
let hasControls = $derived.by(() => {
  return hasCapability('dimmer') || hasCapability('switch');
});

let hasSensors = $derived.by(() => {
  const sensorCaps = ['temperatureSensor', 'humiditySensor', /* ... */];
  return sensorCaps.some(cap => hasCapability(cap as DeviceCapability));
});
```

**Render both if present:**

```svelte
<div class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
  <!-- Controls Section -->
  {#if displayType === 'dimmer'}
    <DimmerControl {device} />
  {:else if displayType === 'switch'}
    <SwitchControl {device} />
  {/if}

  <!-- Sensor Readings Section -->
  {#if hasSensors}
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Sensors
      </h4>
      <SensorReadings {device} />
    </div>
  {/if}

  <!-- Empty State -->
  {#if !hasControls && !hasSensors}
    <div class="text-sm text-gray-500 text-center py-2">
      No controls or sensors available
    </div>
  {/if}
</div>
```

### Recommended Fix Steps

1. **Phase 1: Backend** - Implement Option A (enrich device list with state)
2. **Phase 2: Frontend** - Create SensorReadings component
3. **Phase 3: Integration** - Update DeviceCard to handle sensor display
4. **Phase 4: Polish** - Handle hybrid devices with both controls and sensors

---

## Data Flow Diagrams

### Current (Broken) Flow

```
Frontend Request: GET /api/devices
    ↓
Backend: ToolExecutor.listDevices()
    ↓
DeviceService.listDevices(roomId)
    ↓
SmartThingsService.listDevices(roomId)
    ↓
SmartThings API: GET /devices
    ↓
Returns: DeviceInfo[] (metadata only, NO STATE)
    ↓
Transform: toUnifiedDevice(deviceInfo)
    ↓
UnifiedDevice {
  capabilities: ["switch", "switchLevel"],
  platformSpecific: {
    type: "...",
    components: [...],
    // ❌ NO STATE FIELD
  }
}
    ↓
Frontend DeviceCard renders SwitchControl
    ↓
SwitchControl reads device.platformSpecific?.state
    ↓
❌ Returns undefined → defaults to "Off"
```

### Fixed Flow (Option A)

```
Frontend Request: GET /api/devices
    ↓
Backend: ToolExecutor.listDevices()
    ↓
DeviceService.listDevices(roomId)
    ↓
For each device:
  ├─ SmartThingsService.listDevices(roomId) → DeviceInfo
  └─ SmartThingsService.getDeviceStatus(deviceId) → DeviceStatus
    ↓
Merge: toUnifiedDevice(deviceInfo, status) + extractDeviceState(status)
    ↓
UnifiedDevice {
  capabilities: ["switch", "switchLevel"],
  platformSpecific: {
    type: "...",
    components: [...],
    state: {               // ✅ STATE POPULATED
      switch: "on",
      level: 75
    }
  }
}
    ↓
Frontend DeviceCard renders SwitchControl
    ↓
SwitchControl reads device.platformSpecific?.state.switch
    ↓
✅ Returns "on" → displays correct state
```

---

## Key Findings Summary

### Switch Controls

| Finding | Details |
|---------|---------|
| **Root Cause** | Device state not fetched/populated in UnifiedDevice objects |
| **Impact** | Controls always show "Off" state regardless of actual device state |
| **Files Affected** | `DeviceService.ts`, `deviceInfoToUnified.ts`, `SwitchControl.svelte`, `DimmerControl.svelte` |
| **Fix Complexity** | Medium - requires backend changes to enrich device list with status |
| **User Impact** | HIGH - basic device control appears broken |

### Sensor Display

| Finding | Details |
|---------|---------|
| **Root Cause** | DeviceCard only renders actuator controls, no code path for sensor display |
| **Impact** | All sensor-only devices show "No controls available" |
| **Files Affected** | `DeviceCard.svelte` |
| **Fix Complexity** | Low - new SensorReadings component + conditional rendering |
| **User Impact** | HIGH - monitoring devices provide zero value |

### Combined Fix Benefits

Implementing **Option A** (enrich device list) solves both issues:
1. ✅ Populates state for switch/dimmer controls
2. ✅ Provides sensor attribute data for display
3. ✅ Single backend implementation fixes frontend comprehensively
4. ✅ No breaking changes to existing code

---

## Code Locations Reference

### Backend Files

- **`src/services/DeviceService.ts`** - Line 100: `listDevices()` method needs state enrichment
- **`src/services/transformers/deviceInfoToUnified.ts`** - Line 227: `toUnifiedDevice()` needs state parameter
- **`src/types/unified-device.ts`** - UnifiedDevice interface (state added to platformSpecific)
- **`src/server-alexa.ts`** - Line 295: `/api/devices` endpoint (calls DeviceService.listDevices)

### Frontend Files

- **`web/src/lib/components/devices/DeviceCard.svelte`** - Lines 45-58: Control type logic, Line 149-159: Rendering
- **`web/src/lib/components/devices/controls/SwitchControl.svelte`** - Lines 28-35: State extraction
- **`web/src/lib/components/devices/controls/DimmerControl.svelte`** - Lines 31-42: State extraction
- **`web/src/lib/components/devices/controls/SensorReadings.svelte`** - NEW FILE NEEDED

### Type Definitions

- **`src/types/smartthings.ts`** - `DeviceInfo` (no state) vs `DeviceStatus` (has state)
- **`src/types/unified-device.ts`** - `UnifiedDevice` interface, `platformSpecific` field

---

## Testing Recommendations

### Manual Testing Checklist

**After implementing fixes:**

1. **Switch Control Testing**
   - [ ] Load device list - switches show correct on/off state
   - [ ] Toggle switch on - UI updates immediately (optimistic)
   - [ ] Verify API call succeeds (Network tab)
   - [ ] Reload page - switch state persists correctly
   - [ ] Test offline device - shows "Offline" message
   - [ ] Test error case - rollback to previous state

2. **Dimmer Control Testing**
   - [ ] Load device list - dimmers show correct level
   - [ ] Adjust brightness slider - debounced API call
   - [ ] Toggle on/off - brightness value preserved
   - [ ] Reload page - state persists
   - [ ] Test boundary values (0%, 100%)

3. **Sensor Display Testing**
   - [ ] Zooz 4-in-1 sensor shows all readings (temp, humidity, motion, illuminance)
   - [ ] Values update when sensor state changes (SSE integration)
   - [ ] Battery level displays correctly
   - [ ] Motion sensor shows "Detected" vs "Clear"
   - [ ] Temperature displays with correct unit (°F or °C)

4. **Hybrid Device Testing**
   - [ ] Smart thermostat shows both controls AND temperature sensor
   - [ ] Motion-detecting light switch shows both switch AND motion
   - [ ] Sections render in correct order (controls first, then sensors)

### Automated Testing

**Unit Tests Needed:**

```typescript
// src/services/__tests__/DeviceService.enrichment.test.ts
describe('DeviceService.listDevices with state enrichment', () => {
  it('should populate platformSpecific.state for switch devices', async () => {
    const devices = await deviceService.listDevices();
    const switchDevice = devices.find(d => d.capabilities.includes('switch'));

    expect(switchDevice.platformSpecific?.state).toBeDefined();
    expect(switchDevice.platformSpecific?.state.switch).toMatch(/on|off/);
  });

  it('should populate sensor readings for multi-sensor devices', async () => {
    const devices = await deviceService.listDevices();
    const sensor = devices.find(d => d.capabilities.includes('temperatureSensor'));

    expect(sensor.platformSpecific?.state?.temperature).toBeDefined();
    expect(typeof sensor.platformSpecific?.state?.temperature).toBe('number');
  });
});
```

**Integration Tests:**

```typescript
// tests/integration/device-state-api.test.ts
describe('GET /api/devices with state', () => {
  it('should return devices with current state populated', async () => {
    const response = await fetch('http://localhost:5182/api/devices');
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    const switchDevice = result.data.find(d => d.capabilities.includes('switch'));
    expect(switchDevice.platformSpecific.state.switch).toBeDefined();
  });
});
```

**E2E Tests (Playwright):**

```typescript
// tests/e2e/device-controls.spec.ts
test('switch controls display correct state and toggle', async ({ page }) => {
  await page.goto('http://localhost:5181');

  // Wait for devices to load
  await page.waitForSelector('[data-testid="device-card"]');

  // Find a switch device
  const switchCard = page.locator('[data-testid="device-card"]').filter({
    has: page.locator('button:has-text("On"), button:has-text("Off")')
  }).first();

  // Verify initial state is displayed (not always "Off")
  const button = switchCard.locator('button').first();
  const initialState = await button.textContent();
  expect(['On', 'Off']).toContain(initialState?.trim());

  // Toggle switch
  await button.click();

  // Verify optimistic update
  await expect(button).toHaveText(initialState === 'On' ? 'Off' : 'On');
});
```

---

## Performance Considerations

### State Enrichment Impact

**Baseline (Current):**
- Device list API: ~50-100ms
- No status fetches
- Total: ~50-100ms

**With State Enrichment (No Cache):**
- Device list API: ~50-100ms
- Status fetches: 20 devices × ~50ms (parallel) = ~300ms
- Total: ~350-400ms
- **Increase: 3-4x slower**

**With State Enrichment + Caching (10s TTL):**
- First request: ~350-400ms (cache miss)
- Subsequent requests: ~50-100ms (cache hit)
- Cache hit rate: ~90% (assuming users don't refresh constantly)
- **Average: ~90-130ms**

### Optimization Strategies

1. **Parallel Status Fetches**
   ```typescript
   await Promise.all(devices.map(d => getDeviceStatus(d.id)));
   ```

2. **In-Memory Caching**
   ```typescript
   const stateCache = new Map<DeviceId, { state: any; timestamp: number }>();
   const CACHE_TTL = 10_000; // 10 seconds
   ```

3. **Pagination** (Future Enhancement)
   - Limit initial load to 20 devices
   - Lazy-load additional pages
   - Reduce initial latency

4. **Selective Enrichment**
   - Only enrich devices with actuator capabilities
   - Sensors can be enriched on-demand
   - Reduces status API calls by ~30-40%

---

## Next Steps

### Implementation Priority

**P0 - Critical (This Week):**
1. Implement backend state enrichment (Option A)
2. Add caching layer with 10s TTL
3. Test with production SmartThings account

**P1 - High (Next Week):**
1. Create SensorReadings component
2. Update DeviceCard rendering logic
3. Handle hybrid devices (controls + sensors)
4. Write unit + integration tests

**P2 - Medium (Sprint 1.3):**
1. Add E2E tests for device controls
2. Implement pagination for device list
3. Add loading skeletons during state fetch
4. Monitor performance metrics

**P3 - Low (Future):**
1. Add state change animations
2. Implement selective enrichment optimization
3. Add historical sensor data graphs
4. Support custom sensor display preferences

### Success Metrics

**Before Fix:**
- Switch controls: 0% show correct state (always "Off")
- Sensor devices: 0% display any data ("No controls available")
- User satisfaction: Blocked/frustrated

**After Fix:**
- Switch controls: 100% show correct state on load
- Sensor devices: 100% display readings
- Device list latency: <400ms (p95), <200ms with cache (p50)
- User satisfaction: Functional smart home control

---

## Questions for User

1. **Switch Control Failure Mode:** Can you describe what "doesn't work" means?
   - Do buttons not respond to clicks?
   - Do they trigger errors in console?
   - Do they toggle but have no effect on actual devices?
   - Or do they just show incorrect state?

2. **Performance Tolerance:** Is 300-400ms device list load time acceptable?
   - Alternative: Fast load with unknown state, then SSE updates
   - Trade-off: Initial UX vs. latency

3. **Sensor Display Priority:** Which sensors are most important?
   - Temperature/humidity/motion (Zooz 4-in-1)
   - Battery levels
   - Contact sensors (doors/windows)
   - Air quality sensors

4. **Hybrid Device UX:** For devices with both controls and sensors:
   - Show controls first, sensors below? (Recommended)
   - Show side-by-side?
   - Separate tabs?

---

## Appendix: Related Code Snippets

### UnifiedDevice Type (Current)

```typescript
export interface UnifiedDevice {
  // Identity
  readonly id: UniversalDeviceId;
  readonly platform: Platform;
  readonly platformDeviceId: string;

  // Metadata
  name: string;
  label?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;

  // Organization
  room?: string;
  location?: string;

  // Capabilities
  readonly capabilities: ReadonlyArray<DeviceCapability>;

  // State
  online: boolean;
  lastSeen?: Date;

  // Platform-specific (Escape Hatch)
  platformSpecific?: Record<string, unknown>;
}
```

### DeviceStatus Structure (SmartThings)

```typescript
interface DeviceStatus {
  components: {
    main: {
      switch?: {
        switch: { value: "on" | "off"; timestamp: string };
      };
      switchLevel?: {
        level: { value: number; unit: "percent"; timestamp: string };
      };
      temperatureMeasurement?: {
        temperature: { value: number; unit: "F" | "C"; timestamp: string };
      };
      relativeHumidityMeasurement?: {
        humidity: { value: number; unit: "percent"; timestamp: string };
      };
      motionSensor?: {
        motion: { value: "active" | "inactive"; timestamp: string };
      };
      illuminanceMeasurement?: {
        illuminance: { value: number; unit: "lux"; timestamp: string };
      };
      battery?: {
        battery: { value: number; unit: "percent"; timestamp: string };
      };
    };
  };
}
```

### Capability Classification

**Actuators (Commands Available):**
- switch → on(), off()
- dimmer (switchLevel) → setLevel(0-100)
- colorControl → setColor(hue, saturation)
- colorTemperature → setColorTemperature(kelvin)
- thermostat → setHeatingSetpoint(), setCoolingSetpoint()
- lock → lock(), unlock()

**Sensors (Read-Only Attributes):**
- temperatureSensor → temperature value
- humiditySensor → humidity percentage
- motionSensor → motion (active/inactive)
- contactSensor → contact (open/closed)
- illuminanceSensor → illuminance (lux)
- battery → battery percentage
- airQualitySensor → airQuality index
- occupancySensor → occupancy (occupied/unoccupied)

---

**End of Research Report**
