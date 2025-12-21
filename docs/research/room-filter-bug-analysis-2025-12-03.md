# Room Filter Bug - Root Cause Analysis

**Date:** 2025-12-03
**Researcher:** Research Agent
**Issue:** Room filtering broken when clicking room from breadcrumb or room selector

---

## Executive Summary

The room filtering system has a critical **data type mismatch** between navigation components and filtering logic. The breadcrumb and RoomCard components pass `roomId` (UUID), but the filtering logic in DeviceFilter and DeviceStore compares against `roomName` (string). This causes zero devices to match when filtering by room through navigation components.

**Impact:** Users cannot filter devices by room when clicking from the Rooms page or using breadcrumb navigation, severely degrading the core user experience.

**Root Cause:** Dual filtering system (room ID vs. room name) without proper coordination.

**Recommended Fix:** Normalize all room filtering to use room ID consistently across the application.

---

## Detailed Analysis

### 1. Data Flow Investigation

#### Navigation Entry Points

**RoomCard Component** (`web/src/lib/components/rooms/RoomCard.svelte`)
```svelte
<!-- Line 46: Navigates with room ID -->
<a href={`/devices?room=${room.roomId}`} class="card-link">
```
- **Passes:** `roomId` (UUID format, e.g., `"a1b2c3d4-5678-..."`)
- **URL:** `/devices?room=a1b2c3d4-5678-...`

**Devices Page Route** (`web/src/routes/devices/+page.svelte`)
```typescript
// Line 36: Reads room ID from URL
let roomId = $derived($page.url.searchParams.get('room'));

// Line 56: Applies room ID filter
$effect(() => {
  if (roomId) {
    deviceStore.setSelectedRoomId(roomId);
  } else {
    deviceStore.setSelectedRoomId(null);
  }
});
```
- **Reads:** Room ID from URL query parameter
- **Sets:** `selectedRoomId` in device store

#### Filter Components

**DeviceFilter Component** (`web/src/lib/components/devices/DeviceFilter.svelte`)
```typescript
// Lines 59-60: Initializes from URL
let searchQuery = $state(urlParams.get('search') || '');
let selectedRoom = $state<string | null>(urlParams.get('room') || null);

// Lines 102-106: Updates URL with selectedRoom
if (selectedRoom) {
  params.set('room', selectedRoom);
} else {
  params.delete('room');
}

// Lines 152-157: Room dropdown handler
function onRoomChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  selectedRoom = target.value || null;
  emitFilterChange();
  updateURL();
}
```

**Issue:** DeviceFilter uses `selectedRoom` (room name) from dropdown, but URL contains `roomId` when navigating from RoomCard!

**Lines 269-274: Room dropdown options**
```svelte
<select id="room-filter" class="select" value={selectedRoom ?? ''} onchange={onRoomChange}>
  <option value="">All Rooms</option>
  {#each rooms as room}
    <option value={room}>{room}</option>
  {/each}
</select>
```
- Dropdown uses `room` (room name strings like "Living Room", "Bedroom")
- URL parameter `?room=` could be either room ID or room name depending on entry point

### 2. Device Store Filtering Logic

**DeviceStore** (`web/src/lib/stores/deviceStore.svelte.ts`)

**Dual filtering system:**

```typescript
// Lines 45-47: Two separate room filters
let selectedRoom = $state<string | null>(null);      // Room name
let selectedRoomId = $state<string | null>(null);    // Room ID

// Lines 97-109: Filtering logic
let filteredDevices = $derived.by(() => {
  let result = devices;

  // Filter by selected room (name)
  if (selectedRoom) {
    result = result.filter((d) => d.room === selectedRoom);
  }

  // Filter by selected room ID (takes precedence over room name)
  if (selectedRoomId) {
    result = result.filter((d) => {
      // Check if device has roomId in platformSpecific
      const deviceRoomId = (d.platformSpecific as any)?.roomId;
      return deviceRoomId === selectedRoomId;
    });
  }

  return result;
});
```

**Critical Issue:** When `selectedRoomId` is set, it filters by `device.platformSpecific.roomId`, but when `selectedRoom` is set from DeviceFilter, it filters by `device.room` (room name).

### 3. Device Data Structure

**Device Type Definition** (`src/types/smartthings.ts`)

```typescript
// Lines 67-82: DeviceInfo interface
export interface DeviceInfo {
  deviceId: DeviceId;
  name: string;
  label?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  type?: string;
  capabilities?: string[];
  components?: string[];
  locationId?: string;
  roomId?: string;           // ← Room ID (UUID)
  roomName?: string;         // ← Room Name (human-readable)
  online?: boolean;
  platformSpecific?: Record<string, unknown>;
}
```

**Device store normalization** (`deviceStore.svelte.ts` lines 231-236):
```typescript
const normalizedDevice = {
  ...device,
  id: device.deviceId || device.id,
  room: device.roomName || device.room  // ← Stores room NAME, not ID!
};
```

**Device has both fields:**
- `device.room` = Room name (e.g., "Master Bedroom")
- `device.platformSpecific.roomId` = Room ID (e.g., "a1b2c3d4-...")

### 4. URL Persistence Implementation (Ticket 1M-533)

**DeviceFilter URL Persistence** (lines 23-24):
```typescript
// URL Parameters:
// - ?search={query} - Text search
// - ?room={roomName} - Room filter  ← Documentation says room NAME!
```

**But RoomCard navigation sets:**
```
?room={roomId}  ← Actually passes room ID!
```

**Mismatch:** URL persistence was designed for room names, but navigation components use room IDs.

---

## Root Cause Summary

### Primary Issue: Inconsistent Room Identifier Usage

1. **RoomCard navigation:** Passes `roomId` (UUID) in URL
2. **DeviceFilter initialization:** Reads URL param into `selectedRoom` variable
3. **DeviceFilter assumes:** URL contains room **name**, not room **ID**
4. **DeviceFilter emits:** Room value to parent as `selectedRoom`
5. **DeviceListContainer receives:** Room value as `selectedRoom`
6. **DeviceStore filters:** By `device.room` (room name) when `selectedRoom` is set
7. **Result:** No devices match because `device.room` contains "Master Bedroom" but filter contains "a1b2c3d4-..."

### Secondary Issue: Dual Filtering Paths Not Coordinated

The device store has two separate room filter paths:
- `selectedRoom` → filters by `device.room` (name)
- `selectedRoomId` → filters by `device.platformSpecific.roomId` (ID)

**Devices page route** calls `setSelectedRoomId(roomId)` ✅
**DeviceFilter component** calls `setSelectedRoom(roomName)` ❌

When URL contains room ID, DeviceFilter incorrectly treats it as a room name.

---

## Evidence: Code Flow Trace

### Scenario: User clicks "Master Bedroom" room card

**Step 1: Navigation**
```typescript
// RoomCard.svelte line 46
<a href={`/devices?room=a1b2c3d4-5678-...`}>
```
URL becomes: `/devices?room=a1b2c3d4-5678-...`

**Step 2: Devices Page Route**
```typescript
// devices/+page.svelte line 36
let roomId = $derived($page.url.searchParams.get('room'));
// roomId = "a1b2c3d4-5678-..."

// Line 56
deviceStore.setSelectedRoomId(roomId);
// ✅ Correctly sets selectedRoomId
```

**Step 3: DeviceFilter Initialization**
```typescript
// DeviceFilter.svelte line 60
let selectedRoom = $state<string | null>(urlParams.get('room') || null);
// selectedRoom = "a1b2c3d4-5678-..." (SHOULD BE NULL!)
```

**Step 4: Filter Emission**
```typescript
// DeviceFilter.svelte line 234-241 (effect on mount)
if (searchQuery || selectedRoom || selectedType || selectedManufacturer) {
  emitFilterChange();  // ← Called because selectedRoom is truthy
}

// Calls parent's onFilterChange with:
{
  selectedRoom: "a1b2c3d4-5678-...",  // ❌ Room ID, not room name!
  ...
}
```

**Step 5: DeviceListContainer**
```typescript
// DeviceListContainer.svelte line 135-140
onFilterChange={(filters) => {
  store.setSearchQuery(filters.searchQuery);
  store.setSelectedRoom(filters.selectedRoom);  // ❌ Sets room ID as room name!
  store.setSelectedType(filters.selectedType);
  ...
}}
```

**Step 6: DeviceStore Filtering**
```typescript
// deviceStore.svelte.ts lines 97-100
if (selectedRoom) {  // selectedRoom = "a1b2c3d4-5678-..."
  result = result.filter((d) => d.room === selectedRoom);
  // ❌ Compares "Master Bedroom" === "a1b2c3d4-5678-..."
  // NO MATCHES!
}

// Lines 103-109
if (selectedRoomId) {  // selectedRoomId = "a1b2c3d4-5678-..." (from route)
  result = result.filter((d) => {
    const deviceRoomId = (d.platformSpecific as any)?.roomId;
    return deviceRoomId === selectedRoomId;
    // ✅ This WOULD work, but...
  });
}
```

**Result:** Both filters applied! Devices must match BOTH room name AND room ID, causing zero results.

---

## Device Data Structure Verification

### Sample Device Object
```json
{
  "id": "device-123",
  "name": "Bedroom Light",
  "room": "Master Bedroom",           // ← Room NAME (human-readable)
  "platformSpecific": {
    "roomId": "a1b2c3d4-5678-...",    // ← Room ID (UUID)
    "state": { ... }
  }
}
```

**Available room fields:**
- `device.room` = Room name (string)
- `device.platformSpecific.roomId` = Room ID (UUID)
- Both are present on normalized devices

---

## Recommended Fix

### Option 1: Normalize to Room ID (Recommended)

**Rationale:**
- Room IDs are stable (UUIDs don't change)
- Room names can change (user renames room)
- Navigation already uses room IDs
- Backend already provides room IDs

**Changes Required:**

1. **DeviceFilter.svelte**
   - Rename `selectedRoom` → `selectedRoomId`
   - Change `rooms` prop to accept `Room[]` objects (not strings)
   - Update dropdown to use room IDs as values:
     ```svelte
     {#each rooms as room}
       <option value={room.roomId}>{room.name}</option>
     {/each}
     ```
   - Update URL parameter logic to use room ID

2. **DeviceListContainer.svelte**
   - Pass `Room[]` array instead of `string[]` for rooms
   - Update filter handler to call `setSelectedRoomId` instead of `setSelectedRoom`

3. **DeviceStore.svelte.ts**
   - Remove `selectedRoom` (room name filter)
   - Keep only `selectedRoomId` filter
   - Update filtering logic:
     ```typescript
     if (selectedRoomId) {
       result = result.filter((d) => {
         const deviceRoomId = (d.platformSpecific as any)?.roomId;
         return deviceRoomId === selectedRoomId;
       });
     }
     ```

4. **URL Persistence**
   - Update documentation: `?room={roomId}` (not room name)
   - Maintain backward compatibility if needed

### Option 2: Normalize to Room Name (Not Recommended)

**Issues with this approach:**
- Room names can change (breaks bookmarked URLs)
- Requires mapping room ID → room name on navigation
- Less stable identifiers
- More complex breadcrumb integration

---

## Files Requiring Modification

### Critical Path (Must Fix)

1. **`web/src/lib/components/devices/DeviceFilter.svelte`**
   - Change `selectedRoom` to `selectedRoomId`
   - Update `rooms` prop type from `string[]` to `Room[]`
   - Update dropdown to use room objects
   - Update URL parameter handling

2. **`web/src/lib/components/devices/DeviceListContainer.svelte`**
   - Change `rooms={store.availableRooms}` to pass Room objects
   - Update `onFilterChange` to call `setSelectedRoomId`

3. **`web/src/lib/stores/deviceStore.svelte.ts`**
   - Remove `selectedRoom` state variable
   - Remove `setSelectedRoom` action
   - Update `clearFilters()` to only clear `selectedRoomId`
   - Simplify filtering logic (single room filter)

### Secondary Updates (For Consistency)

4. **`web/src/lib/stores/deviceStore.svelte.ts`** (exports)
   - Add method to get available rooms as Room objects:
     ```typescript
     let availableRoomObjects = $derived.by(() => {
       const roomMap = new Map<string, Room>();
       devices.forEach((d) => {
         const roomId = (d.platformSpecific as any)?.roomId;
         const roomName = d.room;
         if (roomId && roomName) {
           roomMap.set(roomId, {
             roomId,
             name: roomName,
             locationId: d.locationId || '',
             deviceCount: 0  // Computed separately
           });
         }
       });
       return Array.from(roomMap.values()).sort((a, b) =>
         a.name.localeCompare(b.name)
       );
     });
     ```

5. **Documentation**
   - Update `DeviceFilter.svelte` header comments (lines 23-26)
   - Change `?room={roomName}` → `?room={roomId}`

---

## Test Scenarios

### Before Fix (Current Broken State)

**Test 1: Navigate from RoomCard**
```
1. Go to /rooms
2. Click "Master Bedroom" card
3. URL: /devices?room=a1b2c3d4-...
4. Result: ❌ No devices shown (zero matches)
5. Filter dropdown shows: "All Rooms" (incorrect)
```

**Test 2: Use Room Dropdown**
```
1. Go to /devices
2. Select "Master Bedroom" from dropdown
3. URL: /devices?room=Master%20Bedroom
4. Result: ✅ Devices shown correctly
5. Filter compares room names
```

**Test 3: Navigate from Breadcrumb**
```
1. Go to /devices?room=a1b2c3d4-...
2. Click breadcrumb "Show All Devices"
3. Click back button in browser
4. URL: /devices?room=a1b2c3d4-...
5. Result: ❌ No devices shown (zero matches)
```

### After Fix (Expected Behavior)

**Test 1: Navigate from RoomCard**
```
1. Go to /rooms
2. Click "Master Bedroom" card
3. URL: /devices?room=a1b2c3d4-...
4. Result: ✅ Devices in Master Bedroom shown
5. Filter dropdown shows: "Master Bedroom" (selected)
```

**Test 2: Use Room Dropdown**
```
1. Go to /devices
2. Select "Master Bedroom" from dropdown
3. URL: /devices?room=a1b2c3d4-...
4. Result: ✅ Devices shown correctly
5. Filter uses room ID consistently
```

**Test 3: Browser Back/Forward**
```
1. Go to /devices?room=a1b2c3d4-...
2. Clear filters (go to /devices)
3. Click back button
4. URL: /devices?room=a1b2c3d4-...
5. Result: ✅ Room filter restored, devices shown
```

**Test 4: Bookmarked URL**
```
1. Bookmark /devices?room=a1b2c3d4-...
2. Close browser
3. Open bookmark
4. Result: ✅ Devices in correct room shown
5. Filter dropdown shows correct room selected
```

**Test 5: Direct URL Entry**
```
1. Type /devices?room=a1b2c3d4-... in address bar
2. Press enter
3. Result: ✅ Room filter applied, devices shown
```

---

## Implementation Priority

### Phase 1: Critical Fix (Immediate)
- Fix room filtering to work from navigation
- Single room ID-based filter
- Estimated effort: 2-3 hours

### Phase 2: Enhancement (Follow-up)
- Improve room dropdown integration
- Better error handling for invalid room IDs
- Fallback for missing room data
- Estimated effort: 1-2 hours

### Phase 3: Testing (Validation)
- Manual testing of all navigation paths
- Add integration tests for room filtering
- Verify URL persistence
- Estimated effort: 1 hour

---

## Related Tickets

- **1M-533**: Device Filter URL Persistence (original implementation)
  - Designed for room names, not room IDs
  - Need to update documentation and implementation

- **1M-560**: Brilliant Grouped Controls
  - Uses room-based grouping
  - May be affected by room filtering changes

---

## Conclusion

The room filter bug is caused by a **fundamental data type mismatch** between navigation (uses room IDs) and filtering (expects room names). The device store has two separate room filters that operate independently, causing confusion and incorrect results.

**The fix is straightforward:** Normalize all room filtering to use room IDs consistently. This aligns with the existing navigation pattern, provides more stable identifiers, and simplifies the filtering logic.

**Impact of fix:**
- ✅ Room filtering works from all navigation paths
- ✅ URL parameters are stable and bookmarkable
- ✅ Browser back/forward navigation works correctly
- ✅ Simpler, more maintainable code
- ✅ Better alignment with SmartThings API (uses room IDs)

---

**Next Steps:**
1. Review and approve fix approach
2. Implement changes in DeviceFilter, DeviceListContainer, DeviceStore
3. Test all navigation scenarios
4. Update documentation
5. Deploy and verify in production
