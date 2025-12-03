# Brilliant UI Controls - Visual Guide
**Ticket:** 1M-560
**Date:** 2025-12-03

---

## UI Component Overview

### 1. Grouping Toggle (Conditional)

**Location:** Below device filters, above device grid

**Appearance:**
```
┌────────────────────────────────────────────────────────┐
│ [✓] 🔆 Group Brilliant multi-switch panels            │
└────────────────────────────────────────────────────────┘
```

**Behavior:**
- Only appears when Brilliant devices present in device list
- Checkbox toggles between grouped and individual views
- OFF by default (backward compatible)
- Blue highlight border to draw attention

---

### 2. Grouped Panel Card (Multi-Device)

**Desktop View:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔆 Master Bedroom Panel                        [Brilliant] ●│
│ 2 switches • 2 online                                        │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔆 Master Down Lights                                    │ │
│ │ [●] ══════●═══════════════════ 75%                      │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔆 Master Wall Washers                                   │ │
│ │ [○] ════════════════════════○  0%                       │ │
│ └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ [Toggle All On]           [Toggle All Off]                  │
└──────────────────────────────────────────────────────────────┘
```

**Mobile View:**
```
┌────────────────────────────┐
│ 🔆 MB Panel    [Brilliant]●│
│ 2 switches • 2 online      │
├────────────────────────────┤
│ 🔆 Master Down Lights      │
│ [●] ═══●═══════ 75%       │
│                            │
│ 🔆 Master Wall Washers     │
│ [○] ═════════○  0%        │
├────────────────────────────┤
│ [All On]  [All Off]       │
└────────────────────────────┘
```

---

### 3. Component Anatomy

#### A. Header Section
```
┌────────────────────────────────────────────┐
│ 🔆 [Room Name] Panel         [Brilliant] ●│
│ [N] switches • [M] online                  │
└────────────────────────────────────────────┘
```

**Elements:**
1. **Brilliant Icon** (🔆): Left-aligned, 32px
2. **Panel Title**: Room name + "Panel" suffix
3. **Brilliant Badge**: Blue pill badge, right-aligned
4. **Status Indicator**: ● (green) if any device online, ○ (gray) if all offline
5. **Device Count**: "N switches • M online" subtitle

**Styling:**
- Blue gradient background (light mode: blue-50 to blue-100)
- Blue border (2px, color: blue-200)
- Rounded corners (8px)
- Hover effect: Lift shadow

---

#### B. Device Row (Compact)
```
┌────────────────────────────────────────────┐
│ 🔆 Device Name                              │
│ [●] ══════●═══════════════════ 75%         │
└────────────────────────────────────────────┘
```

**Elements:**
1. **Device Icon** (🔆/💡): Type-specific emoji
2. **Device Name**: Truncated with ellipsis if >30 chars
3. **Toggle Button**: [●] ON (blue) or [○] OFF (gray)
4. **Brightness Slider**: Inline range input (0-100%)
5. **Percentage Display**: "75%" right-aligned
6. **Offline Indicator**: "Offline" text if device offline

**Layout:**
- Horizontal flex layout
- Toggle: Fixed width (48px)
- Slider: Flex-grow (takes remaining space)
- Percentage: Fixed width (48px)

**States:**
- **On + Dimmable**: Toggle [●] + Slider + Percentage
- **Off + Dimmable**: Toggle [○] + "Off" text
- **On + Switch Only**: Toggle [●] + "Switch Only" text
- **Off + Switch Only**: Toggle [○] + "Switch Only" text
- **Offline**: Grayed out + "Offline" indicator

---

#### C. Bulk Actions Footer
```
┌────────────────────────────────────────────┐
│ [Toggle All On]        [Toggle All Off]   │
└────────────────────────────────────────────┘
```

**Elements:**
1. **Toggle All On**: Green button, left side
2. **Toggle All Off**: Gray button, right side
3. **Loading Spinner**: ⟳ appears during bulk operations

**Behavior:**
- **Toggle All On**: Turns on all devices that are currently OFF
- **Toggle All Off**: Turns off all devices that are currently ON
- **Disabled States**:
  - Panel offline (all devices offline)
  - Bulk operation in progress
- **Feedback**:
  - Button shows spinner during operation
  - Individual device toggles update in real-time

---

## Interaction Patterns

### 1. Individual Device Control

**On/Off Toggle:**
```
User clicks [○] → Button changes to [●] → API call → Device turns on
                                          ↓ (if error)
                     Button reverts to [○] → Error alert
```

**Brightness Slider:**
```
User drags slider → UI updates immediately → Wait 300ms → API call
                                             ↓ (if error)
                                Revert to previous value → Error alert
```

**Debouncing Logic:**
- User drags slider from 50% → 60% → 70%
- UI shows: 50% → 60% → 70% (instant)
- API calls: Wait 300ms after last change → Send 70%
- Result: 1 API call instead of 3

---

### 2. Bulk Actions

**Toggle All On:**
```
User clicks [Toggle All On]
  ↓
Identify all OFF devices: [Device A, Device B]
  ↓
Show loading spinner: ⟳
  ↓
Parallel API calls: turnOnDevice(A), turnOnDevice(B)
  ↓
Update each device state individually as responses arrive
  ↓
Hide loading spinner
```

**Error Handling:**
```
Device A: Success → Toggle updates to [●]
Device B: Failure → Toggle stays [○], logs error
```

---

### 3. Grouping Toggle

**Enabling Grouping:**
```
User checks [✓] Group Brilliant panels
  ↓
DeviceListContainer re-renders
  ↓
Filter Brilliant devices: [A, B, C, D, E]
  ↓
Group by room:
  - Master Bedroom: [A, B] → Grouped Panel
  - Kitchen: [C, D] → Grouped Panel
  - Loft: [E] → Individual Card
  ↓
Render grouped panels + individual card
```

**Disabling Grouping:**
```
User unchecks [ ] Group Brilliant panels
  ↓
DeviceListContainer re-renders
  ↓
All devices rendered as individual DeviceCard components
```

---

## Responsive Breakpoints

### Desktop (≥1024px)
- 3-column grid
- Full device names
- Wide sliders (300px+)
- Side-by-side bulk action buttons

### Tablet (768px - 1023px)
- 2-column grid
- Truncated device names (30 chars)
- Medium sliders (200px)
- Side-by-side bulk action buttons

### Mobile (<768px)
- 1-column stack
- Truncated device names (20 chars)
- Narrow sliders (150px)
- Stacked bulk action buttons

---

## Color Palette

### Grouped Panel Card
```
Background:
  Light: linear-gradient(to-br, #eff6ff, #dbeafe) /* blue-50 to blue-100 */
  Dark: linear-gradient(to-br, #1e293b, #0f172a) /* surface-800 to surface-900 */

Border:
  Light: #bfdbfe /* blue-200 */
  Dark: #1e3a8a /* blue-800 */
```

### Device Row
```
Background:
  Light: #ffffff /* white */
  Dark: #334155 /* surface-700 */

Border:
  Light: #e5e7eb /* gray-200 */
  Dark: #4b5563 /* gray-600 */

Hover Border:
  Light: #93c5fd /* blue-300 */
  Dark: #2563eb /* blue-600 */
```

### Toggle Buttons
```
ON State:
  Background: #3b82f6 /* primary-500 blue */
  Text: #ffffff /* white */

OFF State:
  Background: #f3f4f6 /* surface-200 */
  Text: #1f2937 /* gray-800 */
```

### Bulk Action Buttons
```
Toggle All On:
  Background: #10b981 /* green-500 */
  Hover: #059669 /* green-600 */

Toggle All Off:
  Background: #f3f4f6 /* surface-200 */
  Hover: #e5e7eb /* surface-300 */
```

---

## State Indicators

### Online Status
- **● Green**: Device online and responsive
- **○ Gray**: Device offline or unreachable

### Loading States
- **⟳ Spinner**: Action in progress (animated rotation)
- **Opacity 75%**: Button disabled during loading

### Error States
- **Alert Dialog**: Browser alert() on API failure
- **Rollback**: UI reverts to previous state
- **Console Error**: Detailed error logged

---

## Accessibility Features

### Keyboard Navigation
```
Tab Order:
1. Grouping toggle checkbox
2. Device 1 on/off toggle
3. Device 1 brightness slider (if on)
4. Device 2 on/off toggle
5. Device 2 brightness slider (if on)
6. Toggle All On button
7. Toggle All Off button
```

### Screen Reader Announcements
```
Panel Header: "Master Bedroom Panel, Brilliant Home Technology, 2 switches, 2 online, panel online"

Device Row: "Master Down Lights, brightness slider, currently 75%, toggle button, currently on"

Bulk Actions: "Toggle all switches on, button, not disabled"
```

### Focus Indicators
- **Visible Focus Ring**: 2px solid blue-500
- **Contrast Ratio**: 4.5:1 minimum
- **Skip to Content**: Keyboard users can tab through efficiently

---

## Animation & Transitions

### Smooth Transitions
```css
/* Toggle button state change */
transition: background-color 200ms ease-in-out;

/* Slider thumb movement */
transition: transform 100ms ease-out;

/* Panel card hover */
transition: box-shadow 200ms ease-in-out;
```

### Loading Spinner
```css
/* Rotation animation */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
animation: spin 1s linear infinite;
```

---

## Performance Considerations

### Render Optimization
- **$derived.by()**: Memoized render item computation
- **Fine-grained reactivity**: Only affected devices re-render
- **Virtual scrolling**: Not needed (max 10-20 panels per page)

### API Call Optimization
- **Debouncing**: 300ms delay for brightness sliders
- **Parallel bulk actions**: `Promise.all()` for simultaneous calls
- **Optimistic updates**: UI changes before API confirmation

### Memory Management
- **Debounce timers**: Cleaned up on component unmount
- **State map**: Efficient O(1) device lookups
- **No memory leaks**: Timers cleared properly

---

## Comparison: Before vs. After

### Before (Individual Cards)
```
┌───────────────────┐  ┌───────────────────┐
│ 🔆 Master Down    │  │ 🔆 Master Wall    │
│ [Brilliant]     ●│  │ [Brilliant]     ●│
│ Master Bedroom    │  │ Master Bedroom    │
├───────────────────┤  ├───────────────────┤
│ [●] On            │  │ [○] Off           │
│ Brightness: 75%   │  │ Brightness: 0%    │
│ ═══●══════════    │  │ ═══════════○      │
└───────────────────┘  └───────────────────┘

Vertical Space: 280px per device
Total for 2 devices: 560px
```

### After (Grouped Panel)
```
┌──────────────────────────────────────────┐
│ 🔆 Master Bedroom Panel     [Brilliant] ●│
│ 2 switches • 2 online                    │
├──────────────────────────────────────────┤
│ 🔆 Master Down   [●] ═══●═════════ 75%  │
│ 🔆 Master Wall   [○] ═════════○    0%   │
├──────────────────────────────────────────┤
│ [Toggle All On]  [Toggle All Off]       │
└──────────────────────────────────────────┘

Vertical Space: 220px total
Savings: 60% reduction (340px saved)
```

**Benefits:**
- ✅ 60% less scrolling
- ✅ Better visual grouping
- ✅ Bulk actions added
- ✅ Clearer physical panel mapping

---

## Usage Scenarios

### Scenario 1: Bedroom Lighting Control
```
User's Goal: Turn on accent lighting, dim down lights

Steps:
1. Open grouped Master Bedroom Panel
2. Toggle "Master Wall Washers" [○] → [●]
3. Adjust "Master Down Lights" slider 75% → 40%
4. Done in 2 interactions

Alternative (without grouping):
1. Scroll to "Master Wall Washers" card
2. Toggle on
3. Scroll to "Master Down Lights" card
4. Adjust slider
5. Done in 4 interactions (2x more)
```

### Scenario 2: Evening Routine
```
User's Goal: Turn on all bedroom lights at once

Steps:
1. Open grouped Master Bedroom Panel
2. Click [Toggle All On]
3. Done in 1 interaction

Alternative (without grouping):
1. Find and toggle "Master Down Lights"
2. Find and toggle "Master Wall Washers"
3. Done in 2 interactions
```

### Scenario 3: Leaving Home
```
User's Goal: Turn off all lights before leaving

Steps:
1. Open grouped panels for each room
2. Click [Toggle All Off] for each panel
3. Done in 3 clicks (3 rooms)

Alternative (without grouping):
1. Toggle off 6 individual devices
2. Done in 6 clicks (2x more)
```

---

**Visual Guide Created:** 2025-12-03
**Component:** BrilliantGroupedControls.svelte
