# Battery Capability Investigation - Smarter Things Codebase

**Date:** December 22, 2025
**Researcher:** Claude (Opus 4.5)
**Objective:** Investigate how battery capability and low battery devices are handled in the Smarter Things codebase

---

## Executive Summary

The Smarter Things codebase has **full battery capability support** with existing infrastructure for:
- ✅ Battery capability enumeration (`DeviceCapability.BATTERY`)
- ✅ SmartThings API integration for battery level retrieval
- ✅ Device state enrichment with battery readings
- ✅ Frontend display component (`SensorReadings.svelte`)
- ✅ Capability filtering in device store

**Key Finding:** All necessary components exist to build a battery-focused view. No new infrastructure required - only UI composition and filtering logic.

---

## 1. Battery Capability Definition

### Type System

**Location:** `src/types/unified-device.ts`

```typescript
export enum DeviceCapability {
  // ... other capabilities
  BATTERY = 'battery',
  // ... more capabilities
}
```

**Documentation:** `src/types/capabilities.ts:651-665`

```typescript
/**
 * Battery Capability - Battery level monitoring
 *
 * - SmartThings: 'battery' capability
 * - Tuya: 'battery_percentage' function code
 *
 * Common use: Battery-powered sensors, locks, cameras
 * Attributes: battery
 */
export interface BatteryCapability {
  readonly type: DeviceCapability.BATTERY;
  readonly attributes: {
    battery: number; // Battery level 0-100%
  };
}
```

### SmartThings Capability Mapping

**Location:** `src/types/capability-registry.ts:598-599`

```typescript
{
  platformCapability: 'battery',
  unifiedCapability: DeviceCapability.BATTERY,
}
```

**Location:** `src/platforms/smartthings/SmartThingsAdapter.ts:736`

```typescript
private readonly CAPABILITY_TO_UNIFIED: Record<string, DeviceCapability> = {
  // ... other mappings
  battery: DeviceCapability.BATTERY,
  // ... more mappings
};
```

---

## 2. Battery Level Retrieval from SmartThings API

### Device State Enrichment (Ticket 1M-604)

**Location:** `src/services/transformers/deviceInfoToUnified.ts:417`

Battery state is extracted during device transformation:

```typescript
// Extract battery level from device status
if (main['battery']?.['battery']?.value !== undefined) {
  state.battery = Number(main['battery']['battery'].value);
}
```

**Process Flow:**

```
SmartThings API (DeviceStatus)
  └─> deviceInfoToUnified.ts (transformer)
      └─> Extract state.battery from status.components.main['battery']['battery'].value
          └─> Store in platformSpecific.state.battery
              └─> Available to frontend via UnifiedDevice
```

### SmartThings Client

**Location:** `src/smartthings/client.ts:103`

```typescript
// Battery extraction in SmartThings client
state.battery = Number(main['battery']['battery'].value);
```

### Device State Structure

**Location:** `src/types/smartthings.ts:90-112`

```typescript
/**
 * Device state snapshot
 *
 * Example:
 * {
 *   switch: 'on',
 *   level: 75,
 *   battery: 95,
 *   temperature: 72.5
 * }
 */
export interface DeviceState {
  // ... other properties
  battery?: number; // Battery level 0-100%
  // ... more properties
}
```

---

## 3. Frontend Display Components

### SensorReadings Component

**Location:** `web/src/lib/components/devices/SensorReadings.svelte:160-166`

Battery display is already implemented:

```svelte
<!-- Battery -->
{#if state?.battery !== undefined}
  <div class="sensor-item flex items-center gap-2 text-sm">
    <span class="sensor-icon" role="img" aria-label="Battery">🔋</span>
    <span class="sensor-label text-surface-600-300-token">Battery:</span>
    <span class="sensor-value font-medium">{formatBattery(state.battery)}</span>
  </div>
{/if}
```

**Formatting Function:**

```typescript
function formatBattery(battery: number | undefined): string {
  if (battery === undefined) return '--';
  return `${Math.round(battery)}%`;
}
```

### DeviceCard Integration

**Location:** `web/src/lib/components/devices/DeviceCard.svelte:25,163`

SensorReadings component is used for sensor-only devices:

```svelte
<script>
  import SensorReadings from './SensorReadings.svelte';
</script>

<!-- For devices without switch/dimmer controls -->
{:else}
  <SensorReadings {device} />
{/if}
```

**Display Logic:**
- Devices with `DIMMER` capability → DimmerControl
- Devices with `SWITCH` capability → SwitchControl
- All other devices (including battery sensors) → SensorReadings

---

## 4. Device Filtering Infrastructure

### API Client

**Location:** `web/src/lib/api/client.ts:13-27`

API supports capability filtering:

```typescript
async getDevices(filters?: {
  room?: string;
  capability?: string; // ✅ Can filter by 'battery'
}): Promise<DirectResult<{ count: number; devices: UnifiedDevice[] }>> {
  const params = new URLSearchParams();
  if (filters?.room) params.append('room', filters.room);
  if (filters?.capability) params.append('capability', filters.capability);

  const url = params.toString()
    ? `${this.baseUrl}/devices?${params.toString()}`
    : `${this.baseUrl}/devices`;

  const response = await fetch(url);
  return response.json();
}
```

### Device Store Filtering

**Location:** `web/src/lib/stores/deviceStore.svelte.ts:124-129`

Capability filtering is implemented:

```typescript
// Filter by selected capabilities (device must have ALL)
if (selectedCapabilities.length > 0) {
  result = result.filter((d) =>
    selectedCapabilities.every((cap) => d.capabilities.includes(cap as DeviceCapability))
  );
}
```

**Available Filter Actions:**

```typescript
export function setSelectedCapabilities(capabilities: string[]): void {
  selectedCapabilities = capabilities;
}
```

**Usage Example:**

```typescript
import { getDeviceStore } from '$lib/stores/deviceStore.svelte';

const store = getDeviceStore();

// Filter to battery devices only
store.setSelectedCapabilities(['battery']);

// Access filtered devices
const batteryDevices = store.filteredDevices;
```

---

## 5. Navigation Structure

### SubNav Component

**Location:** `web/src/lib/components/layout/SubNav.svelte:36-41`

Current navigation structure:

```typescript
const navItems: NavItem[] = [
  { label: 'Rooms', href: '/', icon: 'home' },
  { label: 'Devices', href: '/devices', icon: 'devices' },
  { label: 'Scenes', href: '/automations', icon: 'automation' },
  { label: 'Events', href: '/events', icon: 'events' }
];
```

**Pattern:** Each nav item maps to a top-level route (`/automations`, `/events`, etc.)

### Existing Top-Level Views

**Location:** `web/src/routes/*/+page.svelte`

```
web/src/routes/
├── automations/+page.svelte   # Scenes grid view
├── devices/+page.svelte       # Device list with filters
├── events/+page.svelte        # Event stream view
├── rooms/+page.svelte         # Room cards view
├── rules/+page.svelte         # Rules management
├── installedapps/+page.svelte # Installed apps
└── auth/+page.svelte          # OAuth authentication
```

### Automations/Scenes Pattern

**Location:** `web/src/routes/automations/+page.svelte`

Simple container pattern for top-level views:

```svelte
<script lang="ts">
  /**
   * Scenes Page
   *
   * Features:
   * - Grid view of all scenes (SmartThings routines)
   * - Execute scenes on-demand
   * - Visual status indicators
   * - Loading states and error handling
   *
   * Architecture:
   * - Uses scenesStore for state management
   * - ScenesGrid component for layout
   * - SceneCard components for individual scenes
   * - Svelte 5 Runes for reactive state
   */

  import AutomationsGrid from '$lib/components/automations/AutomationsGrid.svelte';
</script>

<svelte:head>
  <title>Scenes - Smarter Things</title>
  <meta name="description" content="Manage and execute your smart home scenes" />
</svelte:head>

<AutomationsGrid />
```

**Pattern Breakdown:**
1. **Page-level component** (`+page.svelte`) - lightweight wrapper
2. **Grid/Container component** (e.g., `AutomationsGrid.svelte`) - layout and data loading
3. **Card component** (e.g., `SceneCard.svelte`) - individual item display
4. **Store** (e.g., `automationStore.svelte.ts`) - Svelte 5 Runes-based state

---

## 6. Implementation Patterns to Follow

### Pattern 1: Existing Device View Structure

**Location:** `web/src/routes/devices/+page.svelte`

The devices page uses a container pattern with filters:

```svelte
<script>
  import DeviceListContainer from '$lib/components/devices/DeviceListContainer.svelte';
</script>

<DeviceListContainer />
```

**Container Component Structure:**
- Filter UI (search, room, capability dropdowns)
- Device grid/list display
- Loading states
- Error handling
- Stats display (total, online, offline counts)

### Pattern 2: Svelte 5 Runes Store Pattern

**Location:** `web/src/lib/stores/deviceStore.svelte.ts`

State management pattern:

```typescript
// State primitives
let deviceMap = $state<Map<DeviceId, UnifiedDevice>>(new Map());
let searchQuery = $state('');
let selectedCapabilities = $state<string[]>([]);

// Derived computed values
let devices = $derived(Array.from(deviceMap.values()));
let filteredDevices = $derived.by(() => {
  let result = devices;
  // Apply filters...
  return result;
});

// Actions
export async function loadDevices(): Promise<void> {
  // API call and state update
}

// Export store interface
export function getDeviceStore() {
  return {
    get devices() { return devices; },
    get filteredDevices() { return filteredDevices; },
    loadDevices,
    // ... other getters and actions
  };
}
```

### Pattern 3: Component Hierarchy

**Recommended Structure for Battery View:**

```
web/src/routes/battery/+page.svelte          # Route wrapper
  └─> BatteryGrid.svelte                     # Container component
      ├─> BatteryFilter.svelte               # Filter UI (optional)
      │   └─> Low Battery Toggle
      │   └─> Room Filter
      │   └─> Sort Options (by level)
      └─> BatteryDeviceCard.svelte           # Individual device card
          ├─> Battery Icon (visual indicator)
          ├─> Battery Level (percentage)
          ├─> Device Name
          ├─> Room
          └─> Low Battery Warning (conditional)
```

**Alternative: Reuse Existing Components**

```
web/src/routes/battery/+page.svelte
  └─> Use DeviceListContainer with:
      - Pre-filtered capability: ['battery']
      - Custom sorting (by battery level)
      - Custom view mode (battery-focused)
```

---

## 7. Battery Device Examples

### Test Devices with Battery Capability

**Location:** `tests/fixtures/device-list.json`

Several test devices have battery capability:

```typescript
// Example: Motion Sensor (has BATTERY capability)
{
  capabilities: [
    DeviceCapability.MOTION_SENSOR,
    DeviceCapability.BATTERY
  ],
  platformSpecific: {
    state: {
      motion: 'inactive',
      battery: 85 // ✅ Battery level available
    }
  }
}

// Example: Contact Sensor (has BATTERY capability)
{
  capabilities: [
    DeviceCapability.CONTACT_SENSOR,
    DeviceCapability.BATTERY
  ],
  platformSpecific: {
    state: {
      contact: 'closed',
      battery: 20 // ✅ Low battery example
    }
  }
}
```

### Test Coverage

**Location:** `src/types/__tests__/unified-device.test.ts:201,306,464,539`

Battery capability is tested in multiple scenarios:

```typescript
// Battery capability detection
expect(hasCapability(mockDevice, DeviceCapability.BATTERY)).toBe(true);

// Battery in capability lists
expect(capabilities).toContain(DeviceCapability.BATTERY);

// Multi-capability devices with battery
capabilities: [DeviceCapability.MOTION_SENSOR, DeviceCapability.BATTERY]
```

---

## 8. Recommendations for Battery View Implementation

### Option A: Dedicated Battery Route (Recommended)

**Pros:**
- Focused user experience for battery monitoring
- Can add battery-specific features (low battery alerts, history)
- Clear navigation intent
- Follows established pattern (Scenes, Events, etc.)

**Implementation:**

```
1. Create route: web/src/routes/battery/+page.svelte
2. Create component: web/src/lib/components/battery/BatteryGrid.svelte
3. Add to SubNav navigation items
4. Reuse existing DeviceCard/SensorReadings components
5. Use existing deviceStore with capability filter
```

**Navigation Addition:**

```typescript
// web/src/lib/components/layout/SubNav.svelte
const navItems: NavItem[] = [
  { label: 'Rooms', href: '/', icon: 'home' },
  { label: 'Devices', href: '/devices', icon: 'devices' },
  { label: 'Battery', href: '/battery', icon: 'battery' }, // ✅ Add this
  { label: 'Scenes', href: '/automations', icon: 'automation' },
  { label: 'Events', href: '/events', icon: 'events' }
];
```

### Option B: Filter Enhancement on Devices Page

**Pros:**
- No new routes required
- Existing filtering infrastructure
- Minimal code changes

**Cons:**
- Less discoverable
- Competes with other device filters
- No battery-specific UI optimizations

**Implementation:**

```typescript
// Add battery quick filter button
<button onclick={() => store.setSelectedCapabilities(['battery'])}>
  🔋 Battery Devices
</button>

// Add low battery filter
<button onclick={() => filterLowBattery()}>
  ⚠️ Low Battery (<20%)
</button>
```

### Option C: Dashboard Widget

**Pros:**
- Persistent visibility
- Quick battery health overview
- Can show critical low battery alerts

**Cons:**
- Requires dashboard infrastructure
- More complex implementation

---

## 9. Key Implementation Insights

### No New Infrastructure Required

All necessary components exist:
- ✅ Battery capability enumeration
- ✅ SmartThings API integration
- ✅ State enrichment (ticket 1M-604)
- ✅ Frontend display (SensorReadings.svelte)
- ✅ Filtering infrastructure
- ✅ Store management (deviceStore.svelte.ts)

### Existing Patterns to Reuse

1. **Route Pattern:** Follow `automations/+page.svelte` structure
2. **Grid Pattern:** Follow `AutomationsGrid.svelte` layout
3. **Card Pattern:** Reuse `DeviceCard.svelte` with `SensorReadings.svelte`
4. **Store Pattern:** Use existing `deviceStore` with capability filter
5. **Navigation Pattern:** Add to `SubNav.svelte` like Events/Scenes

### Svelte 5 Runes Best Practices

From existing codebase:
- Use `$state` for reactive primitives
- Use `$derived` for computed values
- Use `$derived.by()` for complex computations
- Export stores as functions returning getter objects
- Prefer fine-grained reactivity over global state

### Low Battery Threshold

**Recommendation:** Use 20% as low battery threshold (common industry standard)

**Implementation:**

```typescript
// In BatteryGrid or deviceStore
const LOW_BATTERY_THRESHOLD = 20;

let lowBatteryDevices = $derived.by(() => {
  return devices.filter(d => {
    const battery = d.platformSpecific?.state?.battery;
    return battery !== undefined && battery < LOW_BATTERY_THRESHOLD;
  });
});
```

---

## 10. Next Steps

### Minimal Viable Implementation (1-2 hours)

1. **Create route:** `web/src/routes/battery/+page.svelte`
2. **Create grid component:** `web/src/lib/components/battery/BatteryGrid.svelte`
3. **Filter devices:** Use `deviceStore.setSelectedCapabilities(['battery'])`
4. **Display cards:** Reuse existing `DeviceCard.svelte`
5. **Add navigation:** Update `SubNav.svelte` with battery icon

### Enhanced Implementation (3-5 hours)

1. **Custom battery card:** Create `BatteryDeviceCard.svelte` with:
   - Visual battery level indicator (progress bar)
   - Color-coded warnings (red <20%, yellow <50%, green ≥50%)
   - Last update timestamp
2. **Sorting options:**
   - By battery level (ascending/descending)
   - By room
   - By device name
3. **Low battery alerts:**
   - Badge count in navigation
   - Visual warning banner
4. **Battery statistics:**
   - Total battery devices
   - Low battery count
   - Average battery level

### Advanced Features (Future)

1. **Battery history tracking:** Store historical battery levels for trend analysis
2. **Predictive alerts:** Estimate battery replacement time based on drain rate
3. **Notification system:** Push alerts when battery drops below threshold
4. **Battery replacement tracker:** Log battery replacement dates and costs
5. **CSV export:** Export battery device list with levels for reporting

---

## 11. Code Examples

### Example: Minimal Battery Page

```svelte
<!-- web/src/routes/battery/+page.svelte -->
<script lang="ts">
  /**
   * Battery Devices Page
   *
   * Displays all devices with battery capability, sorted by battery level.
   * Shows low battery warnings for devices below 20%.
   */

  import { onMount } from 'svelte';
  import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
  import DeviceCard from '$lib/components/devices/DeviceCard.svelte';

  const store = getDeviceStore();

  // Filter to battery devices only
  onMount(() => {
    store.setSelectedCapabilities(['battery']);
    store.loadDevices();
  });

  // Derived: Battery devices sorted by level (ascending)
  const batteryDevicesSorted = $derived.by(() => {
    return [...store.filteredDevices].sort((a, b) => {
      const levelA = a.platformSpecific?.state?.battery ?? 100;
      const levelB = b.platformSpecific?.state?.battery ?? 100;
      return levelA - levelB; // Low battery first
    });
  });

  // Low battery count
  const lowBatteryCount = $derived(
    batteryDevicesSorted.filter(d =>
      (d.platformSpecific?.state?.battery ?? 100) < 20
    ).length
  );
</script>

<svelte:head>
  <title>Battery Devices - Smarter Things</title>
  <meta name="description" content="Monitor battery levels across all devices" />
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-7xl">
  <!-- Header -->
  <header class="mb-6">
    <h1 class="text-3xl font-bold mb-2">🔋 Battery Devices</h1>
    <p class="text-surface-600-300-token">
      Monitor battery levels and get alerts for devices running low
    </p>
  </header>

  <!-- Stats -->
  <div class="stats-grid grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <div class="card p-4">
      <div class="text-2xl font-bold">{store.filteredDevices.length}</div>
      <div class="text-sm text-surface-600-300-token">Total Battery Devices</div>
    </div>

    <div class="card p-4 variant-soft-error">
      <div class="text-2xl font-bold">{lowBatteryCount}</div>
      <div class="text-sm">Low Battery (&lt;20%)</div>
    </div>

    <div class="card p-4">
      <div class="text-2xl font-bold">
        {Math.round(
          batteryDevicesSorted.reduce((sum, d) =>
            sum + (d.platformSpecific?.state?.battery ?? 100), 0
          ) / batteryDevicesSorted.length
        )}%
      </div>
      <div class="text-sm text-surface-600-300-token">Average Battery Level</div>
    </div>
  </div>

  <!-- Low Battery Warning -->
  {#if lowBatteryCount > 0}
    <div class="alert variant-filled-error mb-6" role="alert">
      <div class="alert-message">
        <strong>⚠️ {lowBatteryCount} device(s)</strong> have low battery and may need replacement soon.
      </div>
    </div>
  {/if}

  <!-- Loading State -->
  {#if store.loading}
    <div class="text-center py-12">
      <div class="text-lg text-surface-600-300-token">Loading battery devices...</div>
    </div>
  {:else if store.error}
    <div class="alert variant-filled-error" role="alert">
      <div class="alert-message">Error: {store.error}</div>
    </div>
  {:else}
    <!-- Device Grid -->
    <div class="device-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each batteryDevicesSorted as device (device.id)}
        <DeviceCard {device} />
      {/each}
    </div>

    {#if batteryDevicesSorted.length === 0}
      <div class="text-center py-12">
        <div class="text-lg text-surface-600-300-token">
          No battery-powered devices found.
        </div>
      </div>
    {/if}
  {/if}
</div>
```

### Example: Add Battery Icon to SubNav

```svelte
<!-- web/src/lib/components/layout/SubNav.svelte -->

<!-- Add to navItems array -->
const navItems: NavItem[] = [
  { label: 'Rooms', href: '/', icon: 'home' },
  { label: 'Devices', href: '/devices', icon: 'devices' },
  { label: 'Battery', href: '/battery', icon: 'battery' }, // ✅ NEW
  { label: 'Scenes', href: '/automations', icon: 'automation' },
  { label: 'Events', href: '/events', icon: 'events' }
];

<!-- Add battery icon CSS -->
<style>
  .nav-icon[data-icon='battery']::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='1' y='6' width='18' height='12' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='23' y1='13' x2='23' y2='11'%3E%3C/line%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='1' y='6' width='18' height='12' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='23' y1='13' x2='23' y2='11'%3E%3C/line%3E%3C/svg%3E");
  }
</style>
```

---

## 12. File Organization Compliance

All research documentation follows project standards:

- ✅ Research document in `docs/research/`
- ✅ Implementation guides in `docs/implementation/`
- ✅ QA reports in `docs/qa/`
- ✅ No documentation in root directory

**This Document:** `docs/research/battery-capability-investigation-2025-12-22.md`

---

## Conclusion

The Smarter Things codebase provides **complete infrastructure** for battery device management:

1. **Type System:** DeviceCapability.BATTERY enum with comprehensive documentation
2. **Data Flow:** SmartThings API → deviceInfoToUnified → platformSpecific.state.battery → frontend
3. **Display:** SensorReadings.svelte component with battery formatting
4. **Filtering:** deviceStore capability filtering with setSelectedCapabilities(['battery'])
5. **Patterns:** Established patterns from automations/events/devices pages to follow

**Implementation Complexity:** Low - primarily UI composition using existing components

**Recommended Approach:** Create `/battery` route following automations page pattern, reuse DeviceCard/SensorReadings components, add SubNav navigation item.

**Time Estimate:**
- Minimal implementation: 1-2 hours
- Enhanced implementation: 3-5 hours
- Advanced features: 8-12 hours

---

**Research Status:** Complete
**Next Action:** Implementation ticket creation or direct implementation based on priority
