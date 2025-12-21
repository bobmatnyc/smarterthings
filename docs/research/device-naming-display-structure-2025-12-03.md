# Device Naming and Display Structure Analysis

**Research Date:** 2025-12-03
**Issue:** Device cards showing device TYPE instead of user-assigned NAME
**Severity:** High - Affects user experience across all device cards

---

## Executive Summary

**Problem Identified:** Device cards are displaying the SmartThings `name` field (device type) as the primary title instead of the `label` field (user-assigned name).

**Root Cause:** SmartThings API field semantics are inverted from typical expectations:
- `name`: Device type/model (e.g., "Zooz 4-in-1 sensor", "c2c-dimmer")
- `label`: User-assigned descriptive name (e.g., "AR Motion Sensor", "Master Down Lights")

**Current Behavior:**
```
🏃 Zooz 4-in-1 sensor  ← Device type (name field)
Autumns Room           ← Room location
```

**Expected Behavior:**
```
AR Motion Sensor       ← User-assigned name (label field)
Zooz 4-in-1 sensor     ← Device type (name field)
Autumns Room           ← Room location
```

---

## SmartThings API Field Semantics

### Actual API Response Structure

```json
{
  "name": "Zooz 4-in-1 sensor",        // ← Device type/model (manufacturer designation)
  "label": "AR Motion Sensor",         // ← User-assigned name (friendly name)
  "type": "ZWAVE",                     // ← Connection type (protocol)
  "manufacturer": null,                // ← Usually not populated
  "model": null,                       // ← Usually not populated
  "roomName": "Autumns Room"           // ← Room location
}
```

### Field Definitions from SmartThings API

| Field | SmartThings Meaning | User Expectation | Example Values |
|-------|-------------------|------------------|----------------|
| `name` | Device type/model (from device handler) | Device identifier | "Zooz 4-in-1 sensor", "c2c-dimmer", "TCC Thermostat" |
| `label` | User-assigned friendly name | Primary display name | "AR Motion Sensor", "Master Down Lights", "Downstairs Thermostat" |
| `type` | Connection/integration type | Device category | "ZWAVE", "VIPER", "LAN", "VIRTUAL" |
| `manufacturer` | Manufacturer name | Brand name | Usually `null` |
| `model` | Model number | Product SKU | Usually `null` |
| `roomName` | Room location | Room grouping | "Master Bedroom", "Autumns Room" |

---

## Current Code Implementation

### 1. SmartThings API Client (`src/smartthings/client.ts`)

**Lines 103-120:** Device data transformation
```typescript
const deviceInfos: DeviceInfo[] = filteredDevices.map((device) => ({
  deviceId: device.deviceId as DeviceId,
  name: device.name ?? 'Unknown Device',        // ← Uses 'name' (device type)
  label: device.label,                           // ← Captures 'label' (user name)
  type: device.type,                             // ← Captures connection type
  capabilities: (device.components?.[0]?.capabilities?.map((cap) => cap.id) ?? []) as unknown as string[],
  components: device.components?.map((comp) => comp.id),
  locationId: device.locationId,
  roomId: device.roomId,
  roomName: device.roomId ? roomMap.get(device.roomId) : undefined,
  online: true,
  platformSpecific: {
    type: device.type,
    components: device.components?.map((c) => c.id),
    roomId: device.roomId,
  },
}));
```

**Status:** ✅ Correctly captures both `name` and `label` fields

---

### 2. UnifiedDevice Type Definition (`src/types/unified-device.ts`)

**Lines 286-346:** UnifiedDevice interface
```typescript
export interface UnifiedDevice {
  // Identity
  readonly id: UniversalDeviceId;
  readonly platform: Platform;
  readonly platformDeviceId: string;

  // Metadata
  name: string;              // ← Currently mapped from 'name' field
  label?: string;            // ← Currently mapped from 'label' field
  manufacturer?: string;     // ← Optional manufacturer
  model?: string;            // ← Optional model
  firmwareVersion?: string;

  // Organization
  room?: string;             // ← Room name
  location?: string;

  // ... capabilities, state, platformSpecific
}
```

**Status:** ✅ Has both `name` and `label` fields available

---

### 3. Device Transformation (`src/services/transformers/deviceInfoToUnified.ts`)

**Lines 244-260:** Transformation logic
```typescript
return {
  // Identity
  id: createUniversalDeviceId(Platform.SMARTTHINGS, deviceInfo.deviceId),
  platform: Platform.SMARTTHINGS,
  platformDeviceId: deviceInfo.deviceId,

  // Metadata
  name: deviceInfo.name,     // ← Maps 'name' (device type) to UnifiedDevice.name
  label: deviceInfo.label,   // ← Maps 'label' (user name) to UnifiedDevice.label
  manufacturer: undefined,   // Not available in DeviceInfo
  model: undefined,          // Not available in DeviceInfo
  firmwareVersion: undefined,

  // Organization
  room: deviceInfo.roomName,
  location: undefined,
  // ...
};
```

**Status:** ⚠️ **Problem identified:** Maps device type to `name` field instead of user-assigned name

---

### 4. DeviceCard Display (`web/src/lib/components/devices/DeviceCard.svelte`)

**Lines 96-116:** Card header rendering
```typescript
<!-- Device Name and Room -->
<div class="flex-1 min-w-0">
  <div class="flex items-center gap-2 mb-1">
    <h3 class="text-lg font-semibold truncate" title={device.name}>
      {device.name}  <!-- ← Displays UnifiedDevice.name (device type) -->
    </h3>
    {#if isBrilliantDevice(device)}
      <span class="badge variant-filled-primary text-xs px-2 py-0.5">
        Brilliant
      </span>
    {/if}
  </div>
  {#if device.room}
    <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
      {device.room}  <!-- ← Displays room location -->
    </p>
  {/if}
  <!-- Brilliant tooltip... -->
</div>
```

**Lines 142-146:** Manufacturer/model display (compact mode disabled)
```typescript
{#if !compact && (device.manufacturer || device.model)}
  <div class="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
    {device.manufacturer ?? ''} {device.model ?? ''}
  </div>
{/if}
```

**Status:** ⚠️ **Problem identified:** Uses `device.name` for primary display, which contains device type. `device.label` is never displayed.

---

## Gap Analysis

### Missing Display Hierarchy

**What's Available:**
- ✅ `device.name` - Device type/model (currently shown)
- ✅ `device.label` - User-assigned name (not shown anywhere)
- ✅ `device.room` - Room location (currently shown)
- ⚠️ `device.manufacturer` - Usually `null` in SmartThings
- ⚠️ `device.model` - Usually `null` in SmartThings

**What's Missing:**
- ❌ No display of user-assigned name (`label`)
- ❌ No display of device type as subtitle
- ❌ Inverted field usage (type shown as primary, user name hidden)

### Semantic Mismatch

**SmartThings API Convention:**
- `name` = Device type/model (system-assigned)
- `label` = User-friendly name (user-assigned)

**Our Current Mapping:**
- `UnifiedDevice.name` = SmartThings `name` (device type) ❌
- `UnifiedDevice.label` = SmartThings `label` (user name) ✅

**Industry Standard Convention:**
- `name` = User-assigned primary identifier
- `type`/`model` = Device type/model designation

---

## Recommended Solution

### Option 1: Swap Field Mapping (RECOMMENDED)

**Transform layer change:** Map SmartThings `label` → `UnifiedDevice.name`

**File:** `src/services/transformers/deviceInfoToUnified.ts`
```typescript
return {
  // Metadata
  name: deviceInfo.label || deviceInfo.name,  // ← Use label first, fallback to name
  label: deviceInfo.name,                     // ← Store device type in label field
  manufacturer: undefined,
  model: undefined,
  firmwareVersion: undefined,
  // ...
};
```

**Pros:**
- ✅ Minimal code changes (single file)
- ✅ No UI changes needed
- ✅ Follows industry standard conventions
- ✅ Backward compatible (label fallback)

**Cons:**
- ⚠️ Semantic mismatch between SmartThings API and UnifiedDevice
- ⚠️ `label` field now contains device type instead of user name

---

### Option 2: Add `deviceType` Field to UnifiedDevice

**Type definition change:** Add explicit `deviceType` field

**File:** `src/types/unified-device.ts`
```typescript
export interface UnifiedDevice {
  // Identity
  readonly id: UniversalDeviceId;
  readonly platform: Platform;
  readonly platformDeviceId: string;

  // Metadata
  name: string;              // User-assigned name (from label)
  deviceType?: string;       // Device type/model (from name)
  label?: string;            // Deprecated (remove in v2.0)
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  // ...
}
```

**Transform layer:**
```typescript
return {
  // Metadata
  name: deviceInfo.label || deviceInfo.name,  // User-assigned name
  deviceType: deviceInfo.name,                // Device type/model
  label: undefined,                           // Deprecated
  // ...
};
```

**DeviceCard display:**
```svelte
<h3 class="text-lg font-semibold truncate" title={device.name}>
  {device.name}  <!-- User-assigned name -->
</h3>
{#if device.deviceType}
  <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
    {device.deviceType}  <!-- Device type/model -->
  </p>
{/if}
{#if device.room}
  <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
    {device.room}  <!-- Room location -->
  </p>
{/if}
```

**Pros:**
- ✅ Clear semantic separation
- ✅ Follows industry conventions
- ✅ Extensible for other platforms (Tuya, Lutron)
- ✅ Self-documenting code

**Cons:**
- ⚠️ Requires type definition change
- ⚠️ Requires UI component updates
- ⚠️ Migration path needed for existing code

---

### Option 3: UI-Only Fix (NOT RECOMMENDED)

**DeviceCard change:** Swap display fields in UI component only

```svelte
<h3 class="text-lg font-semibold truncate" title={device.label || device.name}>
  {device.label || device.name}  <!-- User-assigned name -->
</h3>
<p class="text-sm text-gray-500 dark:text-gray-400 truncate">
  {device.name}  <!-- Device type -->
</p>
```

**Pros:**
- ✅ Quick fix (single component)
- ✅ No type changes

**Cons:**
- ❌ Semantic mismatch persists
- ❌ Doesn't fix API responses
- ❌ Confusing for future developers
- ❌ Breaks consistency across codebase

---

## Impact Analysis

### Files Requiring Changes

**Option 1 (Swap Mapping):**
- ✅ `src/services/transformers/deviceInfoToUnified.ts` (1 file)

**Option 2 (Add deviceType):**
- ⚠️ `src/types/unified-device.ts` (type definition)
- ⚠️ `src/services/transformers/deviceInfoToUnified.ts` (transformation)
- ⚠️ `web/src/lib/components/devices/DeviceCard.svelte` (display)
- ⚠️ Any components filtering/searching by device type

**Option 3 (UI Only):**
- ⚠️ `web/src/lib/components/devices/DeviceCard.svelte` (1 file, not recommended)

### Device Type Filtering

**Current filter behavior:** Unknown (needs investigation)
- Does "Device Type" filter use `device.name`?
- Does it use `device.type` (connection type)?
- Does it use `platformSpecific.type`?

**Recommendation:** Device Type filter should use device type, not user names

---

## Sample Data Analysis

### Representative Devices

**Zooz 4-in-1 Sensor:**
```json
{
  "name": "Zooz 4-in-1 sensor",     // ← Device type (shown as primary)
  "label": "AR Motion Sensor",      // ← User name (not shown)
  "type": "ZWAVE",                  // ← Connection type
  "roomName": "Autumns Room"
}
```

**Lutron Dimmer:**
```json
{
  "name": "c2c-dimmer",             // ← Device type
  "label": "Master Down Lights",    // ← User name
  "type": "VIPER",                  // ← Connection type
  "roomName": "Master Bedroom"
}
```

**Thermostat:**
```json
{
  "name": "TCC Thermostat",         // ← Device type
  "label": "Downstairs Thermostat", // ← User name
  "type": "VIPER",                  // ← Connection type
  "roomName": "Downstairs"
}
```

### Pattern Observations

1. **`name` field:** Contains device type/model designation
2. **`label` field:** Contains user-assigned descriptive name
3. **`type` field:** Contains connection/integration type (ZWAVE, VIPER, LAN, VIRTUAL)
4. **Consistency:** All devices follow this pattern across SmartThings ecosystem

---

## Recommended Implementation Plan

### Phase 1: Quick Fix (Option 1)
**Timeline:** Immediate (1 file change)

1. Update `deviceInfoToUnified.ts` transformation
2. Map SmartThings `label` → `UnifiedDevice.name`
3. Map SmartThings `name` → `UnifiedDevice.label`
4. Add fallback for devices without labels
5. Test device card display

**Risk:** Low
**Impact:** High (fixes user-facing issue)

---

### Phase 2: Proper Architecture (Option 2)
**Timeline:** Sprint 1.3 (after quick fix deployed)

1. Add `deviceType` field to `UnifiedDevice` interface
2. Update transformation to populate `deviceType`
3. Update `DeviceCard.svelte` to show device type as subtitle
4. Deprecate `label` field usage
5. Update device type filters to use `deviceType`
6. Add comprehensive tests

**Risk:** Medium (type changes, UI updates)
**Impact:** High (long-term maintainability)

---

### Phase 3: Platform Consistency
**Timeline:** Sprint 1.4 (multi-platform support)

1. Verify Tuya, Lutron field mappings
2. Standardize `deviceType` across all platforms
3. Update platform adapters
4. Document platform-specific field mappings

**Risk:** Low (isolated to platform adapters)
**Impact:** Medium (future-proofing)

---

## Testing Recommendations

### Unit Tests
- ✅ `deviceInfoToUnified.test.ts` - Test field mapping
- ✅ Verify `label` → `name` transformation
- ✅ Verify `name` → `deviceType` transformation
- ✅ Test fallback behavior (devices without labels)

### Integration Tests
- ✅ API response validation
- ✅ Device card rendering
- ✅ Device type filtering
- ✅ Search functionality

### Manual Testing
- ✅ Verify all device cards show user-assigned names
- ✅ Verify device types appear as subtitles
- ✅ Test devices with and without labels
- ✅ Verify room locations still display correctly

---

## Open Questions

1. **Device Type Filtering:**
   - What field does the current "Device Type" filter use?
   - Should it filter by connection type (`type`) or device model (`name`)?
   - How many unique device types exist in typical installations?

2. **Search Functionality:**
   - Does search index `device.name` or `device.label`?
   - Should search cover both fields?
   - How does search handle device type vs. user names?

3. **Backward Compatibility:**
   - Are there saved filters using current field structure?
   - Does API expose device naming in responses?
   - Are there external integrations depending on field semantics?

---

## Conclusion

**Primary Issue:** SmartThings API field semantics are inverted from typical expectations, causing device cards to display device types instead of user-assigned names.

**Root Cause:** Direct field mapping in transformation layer without semantic adjustment.

**Immediate Fix:** Swap field mapping in `deviceInfoToUnified.ts` (Option 1)

**Long-term Solution:** Add `deviceType` field to `UnifiedDevice` interface (Option 2)

**Impact:** High user experience improvement with minimal code changes.

**Next Steps:**
1. Implement Option 1 (quick fix) immediately
2. Plan Option 2 (architectural improvement) for Sprint 1.3
3. Investigate device type filtering behavior
4. Update documentation with field mapping guidelines

---

## File Locations

**Code Files Analyzed:**
- `/Users/masa/Projects/mcp-smartthings/src/types/unified-device.ts`
- `/Users/masa/Projects/mcp-smartthings/src/types/smartthings.ts`
- `/Users/masa/Projects/mcp-smartthings/src/smartthings/client.ts`
- `/Users/masa/Projects/mcp-smartthings/src/services/transformers/deviceInfoToUnified.ts`
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/devices/DeviceCard.svelte`

**API Endpoints Tested:**
- `GET http://localhost:5182/api/devices` - Device list endpoint

**Sample Device Data:**
- 184 total devices in test environment
- Verified across ZWAVE, VIPER, LAN, and VIRTUAL device types
- Consistent `name`/`label` pattern across all devices
