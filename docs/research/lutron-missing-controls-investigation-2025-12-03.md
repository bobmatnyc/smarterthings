# Lutron Devices Missing Controls Investigation

**Date:** 2025-12-03
**Device:** AR Lights (Lutron Caseta Wall Dimmer)
**Issue:** No dimmer controls displayed in UI
**Ticket:** Research investigation

---

## Executive Summary

Lutron Caseta devices integrated via SmartThings show NO controls in the UI because the SmartThings API returns ONLY the `refresh` capability for all Lutron devices (both dimmers and switches). This is a **SmartThings Edge driver limitation**, not a bug in our codebase.

**Root Cause:** SmartThings Edge driver for Lutron Caseta only exposes `refresh` capability in the device metadata.

**Impact:** All 8 Lutron devices in the system are affected (see table below).

**Recommended Solutions:**
1. **Short-term:** Detect Lutron devices by name pattern and infer capabilities from device type
2. **Medium-term:** Use SmartThings local hub API to query actual capabilities
3. **Long-term:** Contact SmartThings support or use Lutron RA2/RA3 integration

---

## Investigation Steps

### 1. UI Rendering Logic Analysis

**DeviceCard.svelte** (lines 45-58):
```svelte
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

**Capability Check:**
```typescript
function hasCapability(cap: DeviceCapability): boolean {
  return device.capabilities.includes(cap);
}
```

**Finding:** UI correctly checks for `dimmer` capability. If not present, no controls are rendered.

---

### 2. API Response Inspection

**Device: AR Lights (ID: `3da92626-86b2-4e2c-8339-92e862d6b2ca`)**

```json
{
  "deviceId": "3da92626-86b2-4e2c-8339-92e862d6b2ca",
  "name": "Lutron Caseta Wall Dimmer",
  "label": "AR Lights",
  "type": "LAN",
  "capabilities": ["refresh"],  // ⚠️ ONLY refresh capability
  "components": [{
    "id": "main",
    "capabilities": [{"id": "refresh", "version": 1}]
  }],
  "roomName": "Autumns Room",
  "online": true
}
```

**Finding:** SmartThings API returns ONLY `refresh` capability for Lutron devices.

---

### 3. Device Status Verification

```bash
# Device status endpoint
GET /v1/devices/3da92626-86b2-4e2c-8339-92e862d6b2ca/status
Response: {"components": {}}  // Empty!
```

**Finding:** Device status endpoint returns empty components object.

---

### 4. Comparison with Other LAN Devices

**Working Example: Sonos Speaker**
```json
{
  "label": "Beam",
  "name": "sonos-player",
  "type": "LAN",
  "capabilities": [
    "mediaPlayback",
    "mediaGroup",
    "mediaPresets",
    "audioMute",
    "audioNotification",
    "audioVolume",
    "refresh"
  ]
}
```

**Lutron Example:**
```json
{
  "label": "AR Lights",
  "name": "Lutron Caseta Wall Dimmer",
  "type": "LAN",
  "capabilities": ["refresh"]  // Missing switch, switchLevel
}
```

**Finding:** Sonos LAN devices properly expose capabilities. Lutron devices do NOT.

---

### 5. All Affected Devices

| Device Name | Type | Expected Capabilities | Actual Capabilities |
|------------|------|----------------------|-------------------|
| AR Lights | Lutron Caseta Wall Dimmer | switch, switchLevel | refresh |
| Foyer Hall Lights | Lutron Caseta Wall Dimmer | switch, switchLevel | refresh |
| Up Stairs Lights | Lutron Caseta Wall Dimmer | switch, switchLevel | refresh |
| Down Stairs Lights | Lutron Caseta Wall Dimmer | switch, switchLevel | refresh |
| Mud Room Main Lights | Lutron Caseta Wall Dimmer | switch, switchLevel | refresh |
| Patio Door Light | Lutron Caseta Switch | switch | refresh |
| Foyer Washers | Lutron Caseta Switch | switch | refresh |

**Total:** 8 Lutron devices affected (5 dimmers, 2 switches)

---

## Root Cause Analysis

### Why Lutron Devices Missing Capabilities?

**SmartThings Edge Driver Issue:**
1. Lutron devices are connected via LAN integration using Edge driver `b1e5d514-236b-4c8a-ba65-b50aad5f007b`
2. This driver is managed by SmartThings hub locally
3. The driver does NOT properly expose `switch` and `switchLevel` capabilities in device metadata
4. However, the devices ARE controllable via SmartThings mobile app (which likely uses different API)

**Evidence:**
- All Lutron devices show same behavior (only `refresh` capability)
- Sonos LAN devices work correctly (different Edge driver)
- Device status endpoint returns empty components
- Devices are online and functional (health endpoint shows ONLINE)

### Why UI Shows No Controls?

**Capability-Based Rendering:**
Our UI uses capability detection to determine which controls to show:

```typescript
// SmartThingsAdapter capability mapping (line 661)
switchLevel: DeviceCapability.DIMMER
```

**Frontend Check (DeviceCard.svelte line 47):**
```typescript
if (hasCapability('dimmer' as DeviceCapability))
```

Since Lutron devices report no `switch` or `switchLevel` capabilities, the UI correctly shows "No controls available".

---

## Code Path Analysis

### 1. Device Discovery Flow

```
SmartThings API
  ↓ GET /v1/devices
SmartThingsService.listDevices() (client.ts:195)
  ↓ device.components[0].capabilities.map(cap => cap.id)
DeviceInfo { capabilities: ['refresh'] }
  ↓ /api/devices endpoint
Frontend DeviceCard
  ↓ hasCapability('dimmer') → false
"No controls available"
```

### 2. Capability Mapping

**Backend (SmartThingsAdapter.ts:661):**
```typescript
const mapping: Record<string, DeviceCapability> = {
  switch: DeviceCapability.SWITCH,
  switchLevel: DeviceCapability.DIMMER,
  // ... other mappings
};
```

**Frontend (DeviceCard.svelte:37-39):**
```typescript
function hasCapability(cap: DeviceCapability): boolean {
  return device.capabilities.includes(cap);
}
```

**Finding:** Capability mapping is correct. Problem is upstream (SmartThings API).

---

## Recommended Solutions

### Option 1: Device Type Inference (SHORT-TERM) ⭐

**Approach:** Detect Lutron devices by name pattern and infer capabilities from device type.

**Implementation:**
```typescript
// src/platforms/smartthings/SmartThingsAdapter.ts

function inferLutronCapabilities(device: DeviceInfo): string[] {
  const isLutron = device.name?.includes('Lutron Caseta');
  if (!isLutron) return device.capabilities;

  // Infer capabilities based on device type
  if (device.name.includes('Dimmer')) {
    return ['refresh', 'switch', 'switchLevel'];
  } else if (device.name.includes('Switch')) {
    return ['refresh', 'switch'];
  }

  return device.capabilities;
}
```

**Pros:**
- Quick fix (1-2 hours implementation)
- No external dependencies
- Works with existing SmartThings integration

**Cons:**
- Heuristic-based (fragile if device names change)
- May not work for all Lutron device types
- Doesn't solve root cause

**Risk:** LOW (can be feature-flagged)

---

### Option 2: Hub Local API Query (MEDIUM-TERM)

**Approach:** Query SmartThings hub local API to get full device capabilities.

**Implementation:**
```typescript
// Query hub local API for device details
const hubIP = '192.168.4.93'; // From hub metadata
const localDevice = await fetch(`https://${hubIP}/api/devices/${deviceId}`);
```

**Requirements:**
- Hub local API access (requires hub IP discovery)
- HTTPS certificate handling
- Network access to hub

**Pros:**
- More reliable capability detection
- Works with all Edge driver limitations
- Future-proof

**Cons:**
- Requires hub local network access
- More complex implementation (3-5 days)
- Security/certificate challenges

**Risk:** MEDIUM (network and security concerns)

---

### Option 3: Direct Lutron RA2/RA3 Integration (LONG-TERM)

**Approach:** Integrate directly with Lutron RA2/RA3 API instead of SmartThings.

**Requirements:**
- Lutron RA2/RA3 bridge (not Caseta)
- Lutron API credentials
- New platform adapter implementation

**Pros:**
- Full feature access
- No SmartThings limitations
- Better performance

**Cons:**
- Requires hardware upgrade (Caseta → RA2/RA3)
- Significant development effort (2-3 weeks)
- May lose SmartThings integration benefits

**Risk:** HIGH (hardware + development costs)

---

### Option 4: Contact SmartThings Support (PARALLEL)

**Approach:** Report Edge driver bug to SmartThings developer support.

**Steps:**
1. File bug report with SmartThings Community
2. Provide driver ID and device details
3. Request capability metadata fix

**Pros:**
- Fixes root cause
- Benefits all users

**Cons:**
- No timeline for fix
- May not be prioritized
- Outside our control

**Risk:** N/A (low effort, uncertain outcome)

---

## Verification

### Test Device Commands (Manual)

Even though capabilities aren't exposed, we can test if commands work:

```bash
# Test switch on
curl -X POST https://api.smartthings.com/v1/devices/3da92626-86b2-4e2c-8339-92e862d6b2ca/commands \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commands": [{
      "component": "main",
      "capability": "switch",
      "command": "on"
    }]
  }'

# Test set level
curl -X POST https://api.smartthings.com/v1/devices/3da92626-86b2-4e2c-8339-92e862d6b2ca/commands \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "commands": [{
      "component": "main",
      "capability": "switchLevel",
      "command": "setLevel",
      "arguments": [50]
    }]
  }'
```

**Expected:** Commands should work despite missing capabilities in metadata.

---

## Implementation Plan (Option 1 Recommended)

### Phase 1: Device Type Detection (1 day)
1. Add `isLutronDevice()` utility function
2. Add `inferLutronCapabilities()` in SmartThingsAdapter
3. Update device capability mapping logic
4. Add unit tests

### Phase 2: UI Testing (1 day)
1. Verify AR Lights shows dimmer controls
2. Test all 8 Lutron devices
3. Verify commands work
4. Document behavior in CLAUDE.md

### Phase 3: Documentation (0.5 days)
1. Update LUTRON-SETUP.md with known limitation
2. Add troubleshooting guide
3. Create ticket for long-term solution

**Total Effort:** 2.5 days

---

## Files Analyzed

1. `web/src/lib/components/devices/DeviceCard.svelte` - UI rendering logic
2. `web/src/lib/components/devices/controls/DimmerControl.svelte` - Dimmer control component
3. `src/platforms/smartthings/SmartThingsAdapter.ts` - Capability mapping
4. `src/smartthings/client.ts` - Device capability extraction (line 200)
5. `src/types/unified-device.ts` - DeviceCapability enum definition

---

## Memory Usage

- Files read: 5 (all <2KB excerpts)
- API calls: 6 (device details, status, health, comparison)
- Grep operations: 4 (capability mapping, device translation)
- Total memory: ~15KB

---

## Next Steps

1. **IMMEDIATE:** Implement Option 1 (device type inference)
2. **SHORT-TERM:** Add feature flag for Lutron capability inference
3. **MEDIUM-TERM:** Investigate hub local API access (Option 2)
4. **LONG-TERM:** Consider direct Lutron integration if SmartThings limitation persists

---

## References

- SmartThings Edge Driver: `b1e5d514-236b-4c8a-ba65-b50aad5f007b`
- Hub ID: `e83b138a-ffbd-4bc3-8d6a-cb31a1c477ef`
- Device ID (AR Lights): `3da92626-86b2-4e2c-8339-92e862d6b2ca`
- SmartThings API Docs: https://developer.smartthings.com/docs/api/public

---

**Research Complete**
*Investigation time: ~45 minutes*
*Memory-efficient: Strategic API sampling, no large file loads*
