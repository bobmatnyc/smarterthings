# Room Filter Bug - Executive Summary

**Date:** 2025-12-03  
**Issue:** Room filtering broken when clicking from RoomCard or breadcrumb navigation  
**Severity:** HIGH - Core feature completely broken for primary navigation path

---

## The Bug in 30 Seconds

**What happens:**
1. User clicks "Master Bedroom" room card
2. URL becomes `/devices?room=a1b2c3d4-5678-...` (room ID)
3. DeviceFilter reads URL and treats room ID as room name
4. Filter tries to match devices where `room === "a1b2c3d4-5678-..."`
5. But devices have `room: "Master Bedroom"` (room name)
6. **Result: Zero devices match, empty list shown**

**Root cause:** Mismatch between navigation (uses room ID) and filtering (expects room name)

---

## Quick Fix Summary

**Change:** Normalize all room filtering to use room IDs instead of room names

**Why room IDs:**
- ✅ Already used by navigation (RoomCard, devices page route)
- ✅ Stable identifiers (UUIDs don't change)
- ✅ Aligns with SmartThings API
- ✅ Handles room renames gracefully
- ✅ Better for URL bookmarking

**Files to modify:**
1. `DeviceFilter.svelte` - Change `selectedRoom` → `selectedRoomId`, update dropdown
2. `DeviceListContainer.svelte` - Pass Room objects, call `setSelectedRoomId`
3. `deviceStore.svelte.ts` - Remove `selectedRoom` filter, keep only `selectedRoomId`

**Estimated effort:** 2-3 hours

---

## Current vs. Fixed Behavior

### BEFORE (Broken)
```
Click "Master Bedroom" card
  → URL: /devices?room=a1b2c3d4-...
  → DeviceFilter: selectedRoom = "a1b2c3d4-..."
  → Store filters: device.room === "a1b2c3d4-..." 
  → Comparison: "Master Bedroom" === "a1b2c3d4-..." ❌
  → Result: NO DEVICES SHOWN
```

### AFTER (Fixed)
```
Click "Master Bedroom" card
  → URL: /devices?room=a1b2c3d4-...
  → DeviceFilter: selectedRoomId = "a1b2c3d4-..."
  → Store filters: device.platformSpecific.roomId === "a1b2c3d4-..."
  → Comparison: "a1b2c3d4-..." === "a1b2c3d4-..." ✅
  → Result: DEVICES SHOWN CORRECTLY
```

---

## Technical Details

### Device Structure
```typescript
{
  id: "device-123",
  room: "Master Bedroom",           // Room name (string)
  platformSpecific: {
    roomId: "a1b2c3d4-5678-...",    // Room ID (UUID)
  }
}
```

### Current Dual Filter System (PROBLEMATIC)
```typescript
// deviceStore.svelte.ts
let selectedRoom = $state<string | null>(null);      // Room name
let selectedRoomId = $state<string | null>(null);    // Room ID

// Both filters applied (AND logic - must match both!)
if (selectedRoom) {
  result = devices.filter(d => d.room === selectedRoom);
}
if (selectedRoomId) {
  result = devices.filter(d => 
    d.platformSpecific?.roomId === selectedRoomId
  );
}
```

**Problem:** When navigation sets `selectedRoomId`, DeviceFilter ALSO sets `selectedRoom` with the room ID value, causing both filters to apply with conflicting criteria.

### Proposed Single Filter System (FIXED)
```typescript
// deviceStore.svelte.ts
let selectedRoomId = $state<string | null>(null);    // Room ID only

// Single filter path
if (selectedRoomId) {
  result = devices.filter(d => 
    d.platformSpecific?.roomId === selectedRoomId
  );
}
```

---

## Code Changes Required

### 1. DeviceFilter.svelte

**BEFORE:**
```typescript
let selectedRoom = $state<string | null>(urlParams.get('room') || null);

function onRoomChange(event: Event) {
  selectedRoom = event.target.value || null;
  emitFilterChange();
}

// Dropdown
<select value={selectedRoom ?? ''}>
  {#each rooms as room}
    <option value={room}>{room}</option>
  {/each}
</select>
```

**AFTER:**
```typescript
let selectedRoomId = $state<string | null>(urlParams.get('room') || null);

function onRoomChange(event: Event) {
  selectedRoomId = event.target.value || null;
  emitFilterChange();
}

// Dropdown
<select value={selectedRoomId ?? ''}>
  {#each rooms as room}
    <option value={room.roomId}>{room.name}</option>
  {/each}
</select>
```

### 2. DeviceListContainer.svelte

**BEFORE:**
```typescript
onFilterChange={(filters) => {
  store.setSelectedRoom(filters.selectedRoom);
  ...
}}
```

**AFTER:**
```typescript
onFilterChange={(filters) => {
  store.setSelectedRoomId(filters.selectedRoomId);
  ...
}}
```

### 3. deviceStore.svelte.ts

**BEFORE:**
```typescript
let selectedRoom = $state<string | null>(null);
let selectedRoomId = $state<string | null>(null);

// Dual filters
if (selectedRoom) {
  result = result.filter(d => d.room === selectedRoom);
}
if (selectedRoomId) {
  result = result.filter(d => 
    d.platformSpecific?.roomId === selectedRoomId
  );
}
```

**AFTER:**
```typescript
let selectedRoomId = $state<string | null>(null);

// Single filter
if (selectedRoomId) {
  result = result.filter(d => 
    d.platformSpecific?.roomId === selectedRoomId
  );
}
```

---

## Test Scenarios

### Critical Tests
1. ✅ Click room card → devices page shows filtered devices
2. ✅ Use room dropdown → devices filtered correctly
3. ✅ Browser back/forward → room filter persists
4. ✅ Direct URL entry → filter applied correctly
5. ✅ Bookmark URL → filter works after reload

### Edge Cases
6. ✅ Invalid room ID in URL → show all devices or error
7. ✅ Room deleted but URL bookmarked → graceful handling
8. ✅ Multiple rapid room selections → debounced correctly
9. ✅ Clear filters button → removes room filter
10. ✅ Room renamed → filter still works (uses stable ID)

---

## Full Documentation

For complete analysis with code traces and diagrams, see:
- **Detailed Analysis:** `docs/research/room-filter-bug-analysis-2025-12-03.md`
- **Flow Diagrams:** `docs/research/room-filter-bug-flow-diagram.md`

---

## Next Steps

1. ✅ Research complete (this document)
2. ⏳ Review fix approach with team
3. ⏳ Implement changes in 3 files
4. ⏳ Test all navigation scenarios
5. ⏳ Update documentation
6. ⏳ Deploy and verify

**Priority:** HIGH - Blocks primary user workflow (room-based navigation)
