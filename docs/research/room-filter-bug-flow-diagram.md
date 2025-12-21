# Room Filter Bug - Data Flow Diagram

## Current Broken State

```
User Action: Click "Master Bedroom" room card
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ RoomCard Component                                              │
│ href="/devices?room=a1b2c3d4-5678-..."  ← Room ID (UUID)       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ Browser Navigation                                              │
│ URL: /devices?room=a1b2c3d4-5678-...                           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │                                         │
        ↓                                         ↓
┌─────────────────────────┐           ┌─────────────────────────┐
│ Devices Page Route      │           │ DeviceFilter Component  │
│                         │           │                         │
│ roomId = "a1b2c3d4..."  │           │ selectedRoom = "a1b2..." │
│ ↓                       │           │ ↓                       │
│ deviceStore.            │           │ emitFilterChange({      │
│   setSelectedRoomId(    │           │   selectedRoom:         │
│     "a1b2c3d4..."       │           │     "a1b2c3d4..."       │
│   ) ✅                  │           │ }) ❌ WRONG!            │
└─────────────────────────┘           └─────────────────────────┘
        │                                         │
        │                                         ↓
        │                           ┌─────────────────────────┐
        │                           │ DeviceListContainer     │
        │                           │                         │
        │                           │ store.setSelectedRoom(  │
        │                           │   "a1b2c3d4..."         │
        │                           │ ) ❌ Sets ID as NAME!   │
        │                           └─────────────────────────┘
        │                                         │
        └─────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceStore - filteredDevices                                   │
│                                                                 │
│ Step 1: Filter by selectedRoom                                 │
│   if (selectedRoom) {  // "a1b2c3d4-5678-..."                 │
│     devices.filter(d =>                                         │
│       d.room === selectedRoom  // ❌ "Master Bedroom" ≠ UUID   │
│     )                                                           │
│   }                                                             │
│   Result: [] (NO MATCHES)                                      │
│                                                                 │
│ Step 2: Filter by selectedRoomId                               │
│   if (selectedRoomId) {  // "a1b2c3d4-5678-..."               │
│     devices.filter(d =>                                         │
│       d.platformSpecific.roomId === selectedRoomId  // ✅      │
│     )                                                           │
│   }                                                             │
│   Result: Already empty from Step 1!                           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                   ┌─────────────┐
                   │   UI Shows  │
                   │ "No devices │
                   │  match your │
                   │   filters"  │
                   └─────────────┘
```

---

## Device Structure

```typescript
Device Object:
{
  id: "device-123",
  name: "Bedroom Light",
  room: "Master Bedroom",           // ← Room NAME (string)
  platformSpecific: {
    roomId: "a1b2c3d4-5678-...",    // ← Room ID (UUID)
    state: { ... }
  }
}

Filter Comparison (BROKEN):
- selectedRoom = "a1b2c3d4-5678-..."
- device.room = "Master Bedroom"
- "a1b2c3d4-5678-..." === "Master Bedroom" → false ❌
```

---

## Working Scenario: Dropdown Selection

```
User Action: Select "Master Bedroom" from dropdown
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceFilter Component                                          │
│                                                                 │
│ <select onchange={onRoomChange}>                               │
│   <option value="Master Bedroom">Master Bedroom</option>       │
│ </select>                                                       │
│                                                                 │
│ selectedRoom = "Master Bedroom"  ← Room NAME (string)          │
│ ↓                                                               │
│ emitFilterChange({ selectedRoom: "Master Bedroom" }) ✅        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceListContainer                                             │
│                                                                 │
│ store.setSelectedRoom("Master Bedroom") ✅                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceStore - filteredDevices                                   │
│                                                                 │
│ if (selectedRoom) {  // "Master Bedroom"                       │
│   devices.filter(d =>                                           │
│     d.room === selectedRoom  // ✅ "Master Bedroom" = "Master..." │
│   )                                                             │
│ }                                                               │
│ Result: [device1, device2, ...] ✅                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                   ┌─────────────┐
                   │   UI Shows  │
                   │   Devices   │
                   │      ✅     │
                   └─────────────┘
```

---

## Proposed Fix: Normalize to Room ID

```
User Action: Click "Master Bedroom" room card
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ RoomCard Component                                              │
│ href="/devices?room=a1b2c3d4-5678-..."  ← Room ID (UUID)       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ Browser Navigation                                              │
│ URL: /devices?room=a1b2c3d4-5678-...                           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │                                         │
        ↓                                         ↓
┌─────────────────────────┐           ┌─────────────────────────┐
│ Devices Page Route      │           │ DeviceFilter Component  │
│                         │           │ (FIXED)                 │
│ roomId = "a1b2c3d4..."  │           │                         │
│ ↓                       │           │ selectedRoomId =        │
│ deviceStore.            │           │   "a1b2c3d4..." ✅     │
│   setSelectedRoomId(    │           │ ↓                       │
│     "a1b2c3d4..."       │           │ emitFilterChange({      │
│   ) ✅                  │           │   selectedRoomId:       │
│                         │           │     "a1b2c3d4..."       │
│                         │           │ }) ✅                   │
└─────────────────────────┘           └─────────────────────────┘
        │                                         │
        │                                         ↓
        │                           ┌─────────────────────────┐
        │                           │ DeviceListContainer     │
        │                           │ (FIXED)                 │
        │                           │                         │
        │                           │ store.setSelectedRoomId(│
        │                           │   "a1b2c3d4..."         │
        │                           │ ) ✅                    │
        │                           └─────────────────────────┘
        │                                         │
        └─────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceStore - filteredDevices (SIMPLIFIED)                      │
│                                                                 │
│ if (selectedRoomId) {  // "a1b2c3d4-5678-..."                 │
│   devices.filter(d => {                                         │
│     const deviceRoomId = d.platformSpecific?.roomId;            │
│     return deviceRoomId === selectedRoomId;                     │
│   })                                                            │
│   // ✅ "a1b2c3d4-5678-..." === "a1b2c3d4-5678-..."           │
│ }                                                               │
│ Result: [device1, device2, ...] ✅                             │
│                                                                 │
│ NO MORE selectedRoom filter! (removed)                          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                   ┌─────────────┐
                   │   UI Shows  │
                   │   Devices   │
                   │      ✅     │
                   └─────────────┘
```

---

## Dropdown Selection (After Fix)

```
User Action: Select "Master Bedroom" from dropdown
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceFilter Component (FIXED)                                  │
│                                                                 │
│ <select onchange={onRoomChange}>                               │
│   {#each rooms as room}                                        │
│     <option value={room.roomId}>{room.name}</option>           │
│   {/each}                                                       │
│ </select>                                                       │
│                                                                 │
│ selectedRoomId = "a1b2c3d4-5678-..."  ← Room ID ✅             │
│ ↓                                                               │
│ emitFilterChange({ selectedRoomId: "a1b2c3d4-..." }) ✅        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceListContainer (FIXED)                                     │
│                                                                 │
│ store.setSelectedRoomId("a1b2c3d4-5678-...") ✅                │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ DeviceStore - filteredDevices                                   │
│                                                                 │
│ if (selectedRoomId) {  // "a1b2c3d4-5678-..."                 │
│   devices.filter(d => {                                         │
│     const deviceRoomId = d.platformSpecific?.roomId;            │
│     return deviceRoomId === selectedRoomId;                     │
│   })                                                            │
│ }                                                               │
│ Result: [device1, device2, ...] ✅                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                   ┌─────────────┐
                   │   UI Shows  │
                   │   Devices   │
                   │      ✅     │
                   └─────────────┘
```

---

## Summary of Changes

### REMOVE (Cause of Bug)
- ❌ `selectedRoom` (room name filter)
- ❌ `setSelectedRoom()` action
- ❌ Room name comparison in filter logic
- ❌ String-based room dropdown options

### ADD/MODIFY (Fix)
- ✅ Use only `selectedRoomId` for filtering
- ✅ Update dropdown to accept Room[] objects
- ✅ Use room.roomId as option values
- ✅ Display room.name as option labels
- ✅ Consistent room ID-based filtering everywhere

### Benefits
- ✅ Works from all navigation paths
- ✅ Stable, bookmarkable URLs
- ✅ Simpler code (single filter path)
- ✅ Aligns with SmartThings API
- ✅ Handles room renames gracefully
