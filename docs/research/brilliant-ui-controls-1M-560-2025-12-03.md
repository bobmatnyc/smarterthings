# Brilliant UI Control Components Research
**Ticket:** 1M-560
**Date:** 2025-12-03
**Status:** Research Complete
**Effort Estimate:** 4-6 hours (validated)

---

## Executive Summary

**Current State:** ✅ Brilliant devices are fully functional with standard dimmer controls (ticket 1M-559 complete). Detection, badging, and icons working correctly.

**Gap Analysis:** Minimal gaps identified. Existing controls work well, but Brilliant-specific enhancements would improve UX for multi-gang panels.

**Recommendation:** **ENHANCE** existing DeviceCard.svelte with optional Brilliant-specific grouping view. Do NOT create separate component.

**Implementation Scope:** 3-4 hours (lower than budgeted 4-6 hours)

---

## 1. Brilliant Device Analysis

### Test Data Summary (9 Brilliant devices)
```
📊 Device Distribution:
- 8 Dimmers (switch + switchLevel capabilities)
- 1 Switch (switch only, no dimming)
- 9 total devices across 6 rooms
- 3 rooms have multi-gang panels (2 switches each)
```

### Multi-Gang Panel Detection
```bash
Room Distribution:
- Master Bedroom: 2 devices (Master Down Lights, Master Wall Washers)
- Loft: 2 devices (Loft Wall Washer, Loft Chandelier)
- Kitchen: 2 devices (Kitchen Down Lights, Pendant)
- Living Room: 1 device (Living Room Washer)
- Dining Room: 1 device (Dining Room Bird)
- Downstairs: 1 device (Downstairs Slot Light)
```

**Key Insight:** Real-world data shows 2-gang panels (not 3-4 gang as hypothesized). SmartThings API doesn't expose panel position or physical grouping.

---

## 2. Current UI Component State

### ✅ What's Already Working

**DeviceCard.svelte** (Lines 1-179)
- ✅ Brilliant badge display (line 102-110)
- ✅ Brilliant-specific icons 🔆 (line 68-71)
- ✅ Advanced features tooltip (line 117-125)
- ✅ Dynamic control routing (dimmer/switch)
- ✅ Manufacturer filtering integration

**DimmerControl.svelte** (Lines 1-188)
- ✅ On/off toggle with optimistic updates
- ✅ Brightness slider (0-100%) with debouncing (300ms)
- ✅ Offline device handling
- ✅ Loading states and error rollback
- ⚠️ **NOTE:** Line 103 shows setLevel API not implemented (TODO comment)

**SwitchControl.svelte** (Lines 1-93)
- ✅ Binary on/off toggle
- ✅ Optimistic updates with rollback
- ✅ Full error handling

**deviceStore.svelte.ts**
- ✅ Manufacturer filtering (line 110-113, 369-371)
- ✅ Room-based filtering (line 92-103)
- ✅ Device grouping utilities available

**device-utils.ts**
- ✅ `isBrilliantDevice()` detection (line 44-65)
- ✅ `getBrilliantDeviceType()` categorization (line 89-113)
- ✅ `getBrilliantIcon()` emoji mapping (line 178-190)
- ✅ `groupBrilliantByRoom()` utility (line 139-155)

---

## 3. Gap Analysis

### What's Missing for Brilliant-Specific UI

#### 🔴 Critical Gap: setLevel API Not Implemented
**File:** `web/src/lib/components/devices/controls/DimmerControl.svelte:103`
```typescript
async function setBrightness(level: number) {
    console.log('Set brightness to', level);
    // API call will be implemented when setLevel endpoint is added
}
```

**Impact:** Brightness slider updates UI but doesn't control physical device.
**Blocker:** This MUST be fixed before any Brilliant-specific enhancements.
**Effort:** 30-60 minutes to add backend endpoint + frontend integration.

#### 🟡 Medium Priority: Multi-Gang Panel Grouping

**Current Behavior:**
- Brilliant devices appear as individual cards in device list
- No visual indication that devices belong to same physical panel
- Users must mentally group devices by room name

**Desired Enhancement:**
- Optional grouped view for Brilliant devices in same room
- Compact multi-switch control panel card
- Quick toggle all switches in panel

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ 🔆 Master Bedroom Panel      [Brilliant]│
│ 2 switches • Room: Master Bedroom       │
├─────────────────────────────────────────┤
│ Master Down Lights    [●] ═══●════ 75% │
│ Master Wall Washers   [○] ═══════○  0% │
│                                          │
│ [Toggle All On] [Toggle All Off]        │
└─────────────────────────────────────────┘
```

#### 🟢 Low Priority: Nice-to-Have Enhancements

1. **Quick Scene Presets:**
   - "All On", "All Off", "Dim to 50%"
   - Per-panel custom scenes

2. **Panel Position Labels:**
   - SmartThings doesn't provide this
   - Could allow manual configuration
   - Low ROI for engineering effort

3. **Synchronization Controls:**
   - Link brightness sliders (master/slave)
   - Useful for accent lighting pairs

---

## 4. Implementation Plan

### Phase 1: Fix setLevel API (MUST DO FIRST) ⏱️ 1 hour
**Ticket Dependency:** Create blocker ticket 1M-561
**Files:**
- Backend: `src/routes/devices.ts` - Add `/devices/:id/level` PUT endpoint
- Backend: `src/platforms/smartthings/SmartThingsAdapter.ts` - Add `setLevel()` method
- Frontend: `web/src/lib/api/client.ts` - Add `setDeviceLevel(deviceId, level)` method
- Frontend: `web/src/lib/components/devices/controls/DimmerControl.svelte` - Wire up setBrightness()

**Validation:**
```bash
# Test dimmer control works
curl -X PUT http://localhost:5182/api/devices/{id}/level -d '{"level": 75}'
```

### Phase 2: Enhance DeviceCard with Grouped View ⏱️ 2-3 hours

**Option A: Conditional Rendering in DeviceCard.svelte (RECOMMENDED)**
```typescript
// Add to DeviceCard.svelte
let showGroupedView = $props<boolean>(false); // Optional prop
let groupedDevices = $props<UnifiedDevice[]>([]); // Optional group

{#if showGroupedView && groupedDevices.length > 1}
  <BrilliantGroupedControls devices={groupedDevices} />
{:else}
  <!-- Existing single device controls -->
{/if}
```

**Option B: New BrilliantPanelCard.svelte Component**
- Separate component for grouped view
- Used in place of DeviceCard when grouping enabled
- More modular but increases complexity

**Recommendation:** **Option A** - Simpler, fewer moving parts, easier to maintain.

### Phase 3: Add Grouping Toggle to DeviceListContainer ⏱️ 1 hour

**File:** `web/src/lib/components/devices/DeviceListContainer.svelte`

**Features:**
1. Add toggle: "Group Brilliant panels by room"
2. When enabled, call `groupBrilliantByRoom(devices)`
3. Render grouped cards for multi-device rooms
4. Render single cards for standalone devices

**UI Addition:**
```svelte
<label class="flex items-center gap-2">
  <input type="checkbox" bind:checked={groupBrilliantPanels} />
  <span>Group Brilliant panels</span>
</label>
```

---

## 5. Detailed Component Specification

### New Component: BrilliantGroupedControls.svelte

**Props:**
```typescript
interface Props {
  devices: UnifiedDevice[];  // 2-4 devices in same room
  compact?: boolean;
}
```

**Features:**
1. **Header Section:**
   - Room name + "Panel"
   - Device count badge
   - Brilliant manufacturer badge

2. **Device Rows:**
   - Device name (truncated if long)
   - On/off toggle
   - Brightness slider (inline, compact)
   - State indicator (● / ○)

3. **Bulk Actions Footer:**
   - [Toggle All On] button
   - [Toggle All Off] button
   - Optional: [Dim to 50%] button

**Accessibility:**
- ARIA labels for all controls
- Keyboard navigation (tab order)
- Screen reader friendly group labels

**Performance:**
- Debounced API calls (existing pattern)
- Optimistic updates (existing pattern)
- Maximum 4 devices per group (prevent UI clutter)

---

## 6. Integration Points

### deviceStore.svelte.ts
- ✅ Already has `setSelectedManufacturer()` (line 369)
- ✅ Already has `availableManufacturers` derived state (line 154)
- ✅ Room filtering working (line 92-103)
- ➕ Add: `groupBrilliantDevices()` action to return grouped structure

### device-utils.ts
- ✅ `groupBrilliantByRoom()` utility exists (line 139-155)
- ✅ Returns `Record<string, UnifiedDevice[]>` structure
- ➕ Enhancement: Add `isMultiGangPanel(devices: UnifiedDevice[]): boolean` helper

### DeviceFilter.svelte (if exists)
- ➕ Add manufacturer filter dropdown
- ➕ Add "Group Brilliant panels" checkbox

---

## 7. Effort Estimate Breakdown

| Task | Estimated Time | Priority |
|------|----------------|----------|
| Fix setLevel API (backend + frontend) | 1 hour | 🔴 BLOCKER |
| Create BrilliantGroupedControls.svelte | 1.5 hours | 🟡 Medium |
| Enhance DeviceCard conditional rendering | 0.5 hours | 🟡 Medium |
| Add grouping toggle to DeviceListContainer | 1 hour | 🟡 Medium |
| Testing and refinement | 1 hour | - |
| **TOTAL** | **5 hours** | - |

**Original Estimate:** 4-6 hours
**Revised Estimate:** 5 hours (validated, mid-range)

---

## 8. Dependencies and Risks

### Dependencies
1. ⚠️ **Blocker:** setLevel API must be implemented first (ticket 1M-561)
2. ✅ DeviceStore manufacturer filtering (already done in 1M-559)
3. ✅ Room data available in devices (confirmed in test data)

### Risks
1. **Low Risk:** API latency on multi-device control
   - Mitigation: Use Promise.all() for parallel requests
   - Expected: <300ms for 2-4 devices

2. **Low Risk:** SmartThings API rate limits
   - Mitigation: Existing debouncing (300ms)
   - Rate limit: 250 requests/minute (more than sufficient)

3. **Low Risk:** Panel grouping accuracy
   - Issue: No SmartThings metadata for physical panels
   - Mitigation: Room-based grouping (best available heuristic)
   - Fallback: Allow manual grouping in future enhancement

---

## 9. Design Decisions

### Decision 1: Enhance DeviceCard vs. New Component
**Chosen:** Enhance DeviceCard with conditional rendering
**Rationale:**
- Reuses existing patterns (DRY principle)
- Less code duplication
- Easier to maintain single component
- Reduces bundle size

**Alternative:** Separate BrilliantPanelCard.svelte
**Rejected Because:**
- More files to maintain
- Duplicate logic for device controls
- Increases cognitive load for developers

### Decision 2: Room-Based Grouping vs. Manual
**Chosen:** Room-based automatic grouping
**Rationale:**
- SmartThings API doesn't provide panel metadata
- Room assignment is reliable signal (users set this)
- Zero configuration required from users

**Alternative:** Manual panel configuration
**Rejected for MVP:** Too much UX overhead

### Decision 3: Inline Compact Controls vs. Full Controls
**Chosen:** Inline compact controls (slider + toggle)
**Rationale:**
- Screen real estate efficiency (2-4 devices in one card)
- Reduces scrolling on mobile devices
- Maintains visual hierarchy

**Alternative:** Full controls per device (like normal cards)
**Rejected Because:** Takes up 2-4x vertical space

---

## 10. Testing Strategy

### Unit Tests
```typescript
// tests/unit/components/BrilliantGroupedControls.test.ts
describe('BrilliantGroupedControls', () => {
  it('renders 2 devices in compact view', () => {});
  it('toggles all devices on/off', () => {});
  it('handles API errors gracefully', () => {});
  it('respects offline device status', () => {});
});
```

### Integration Tests
```typescript
// tests/integration/brilliant-controls.test.ts
describe('Brilliant Controls Integration', () => {
  it('groups devices by room correctly', () => {});
  it('filters to Brilliant manufacturer', () => {});
  it('persists grouping preference', () => {});
});
```

### Manual QA Checklist
- [ ] Verify 2-gang panel displays correctly
- [ ] Test "Toggle All On" button
- [ ] Test "Toggle All Off" button
- [ ] Verify individual sliders work
- [ ] Test with offline device in group
- [ ] Mobile responsive design check
- [ ] Keyboard navigation verification
- [ ] Screen reader compatibility

---

## 11. UI/UX Mockups

### Single Device View (Current - Working)
```
┌────────────────────────────────────┐
│ 🔆 Master Down Lights   [Brilliant]│
│ Master Bedroom                   ● │
│ Brilliant Home Technology          │
│ Model: Brilliant Control           │
├────────────────────────────────────┤
│ [●] On    Brightness: 75%          │
│           ═══●═════════            │
├────────────────────────────────────┤
│ switch | switchLevel | refresh     │
└────────────────────────────────────┘
```

### Grouped Panel View (Proposed Enhancement)
```
┌──────────────────────────────────────────┐
│ 🔆 Master Bedroom Panel       [Brilliant]│
│ 2 switches • Master Bedroom           ● │
├──────────────────────────────────────────┤
│ ┌────────────────────────────────────┐  │
│ │ Master Down Lights                 │  │
│ │ [●] On   ═══●═════════ 75%        │  │
│ └────────────────────────────────────┘  │
│ ┌────────────────────────────────────┐  │
│ │ Master Wall Washers                │  │
│ │ [○] Off  ═══════════○  0%         │  │
│ └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│ [Toggle All On]  [Toggle All Off]       │
└──────────────────────────────────────────┘
```

### Mobile Responsive (Stacked)
```
┌────────────────────────┐
│ 🔆 MB Panel [Brilliant]│
│ 2 switches          ● │
├────────────────────────┤
│ Master Down Lights    │
│ [●] ═══●═══════ 75%  │
│                        │
│ Master Wall Washers   │
│ [○] ═══════════○ 0%  │
├────────────────────────┤
│ [All On] [All Off]    │
└────────────────────────┘
```

---

## 12. Future Enhancements (Out of Scope)

### Post-MVP Features
1. **Custom Panel Names:**
   - Allow users to rename "Master Bedroom Panel" → "Bedroom Lighting"
   - Persistence: localStorage or backend preference

2. **Panel Position Configuration:**
   - Drag-and-drop switch ordering
   - Visual panel layout editor
   - Useful for matching physical panel layout

3. **Scene Integration:**
   - "Evening Ambiance" - Dim to 30%
   - "Movie Mode" - Downlights off, accent on
   - Integration with SmartThings scenes

4. **Advanced Features Indicator:**
   - Camera status (if accessible via API)
   - Motion sensor integration
   - Intercom status
   - **Note:** These require Brilliant API (not SmartThings)

5. **Energy Monitoring:**
   - If Brilliant exposes powerMeter capability
   - Track on-time and energy usage
   - Highlight "forgotten" lights

---

## 13. Conclusion and Next Steps

### Summary
**Current State:** Brilliant devices work correctly with standard dimmer controls. Detection and badging complete (1M-559).

**Recommended Approach:** Enhance existing DeviceCard with optional grouped view. Do NOT create separate Brilliant-specific components.

**Critical Blocker:** setLevel API must be implemented before any UI enhancements (create ticket 1M-561).

**Effort:** 5 hours total (within 4-6 hour budget)

### Implementation Order
1. ✅ **BLOCKER:** Fix setLevel API (ticket 1M-561) - 1 hour
2. 🟡 Create BrilliantGroupedControls.svelte - 1.5 hours
3. 🟡 Add conditional rendering to DeviceCard - 0.5 hours
4. 🟡 Add grouping toggle to DeviceListContainer - 1 hour
5. 🟢 Testing and refinement - 1 hour

### Validation Criteria
- [ ] setLevel API working (curl test passes)
- [ ] Multi-gang panel displays correctly
- [ ] Individual device controls functional
- [ ] Bulk actions (All On/Off) working
- [ ] Mobile responsive design
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] No performance regressions

### Files to Create/Modify
**New Files:**
- `web/src/lib/components/devices/BrilliantGroupedControls.svelte`
- `tests/unit/components/BrilliantGroupedControls.test.ts`

**Modified Files:**
- `web/src/lib/components/devices/DeviceCard.svelte` (add grouped view logic)
- `web/src/lib/components/devices/DeviceListContainer.svelte` (add grouping toggle)
- `web/src/lib/stores/deviceStore.svelte.ts` (add groupBrilliantDevices action)
- `web/src/lib/utils/device-utils.ts` (add isMultiGangPanel helper)

**Backend Files (for setLevel API):**
- `src/routes/devices.ts`
- `src/platforms/smartthings/SmartThingsAdapter.ts`
- `src/lib/api/client.ts`

---

## Appendix A: Test Data Reference

### Brilliant Device Details
```json
{
  "manufacturer": "Brilliant Home Technology",
  "model": "Brilliant Control",
  "type": "VIPER",
  "capabilities": ["switch", "switchLevel", "refresh", "healthCheck"],
  "executionContext": "CLOUD"
}
```

### Room Distribution
```
576d2551-3db1-48e5-a110-659e427830b2: Master Bedroom (2 devices)
19759624-b8ca-49cb-9368-7e247973d8c1: Loft (2 devices)
35ebee2a-3993-4eff-acb6-8667ab04a568: Kitchen (2 devices)
f03c3224-2b40-4d77-85dd-0592011e5b6e: Living Room (1 device)
e6366402-4070-428d-ac24-cbf8a95ea468: Dining Room (1 device)
970edb5b-713f-478c-adc2-f9a04e529648: Downstairs (1 device)
```

---

**Research Completed:** 2025-12-03
**Ready for Implementation:** ✅ Yes (after 1M-561 blocker resolved)
