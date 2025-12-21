# Sensor Readings QA Testing Guide (Ticket 1M-605)

**Ticket:** 1M-605
**Component:** SensorReadings.svelte
**Date:** 2025-12-03

## Quick Start

### Test Environment Setup

1. **Backend running:** `pnpm dev` (port 5182)
2. **Frontend running:** `pnpm dev:web` (port 5181)
3. **SmartThings connected:** Valid PAT configured
4. **Test device:** Zooz 4-in-1 sensor (AR Motion Sensor)

### Access Points

- Frontend: http://localhost:5181
- Devices page: http://localhost:5181/devices

## Visual Comparison

### Before (1M-604)
```
┌─────────────────────────────────────┐
│ 🏃 AR Motion Sensor                 │
│    Zooz 4-in-1 sensor               │
│    Autumns Room                     │
│                                     │
│ ─────────────────────────────────  │
│                                     │
│ ● No controls available             │ ❌
│                                     │
└─────────────────────────────────────┘
```

### After (1M-605)
```
┌─────────────────────────────────────┐
│ 🏃 AR Motion Sensor                 │
│    Zooz 4-in-1 sensor               │
│    Autumns Room                     │
│                                     │
│ ─────────────────────────────────  │
│ ┌─────────────────────────────────┐│
│ │ 🌡️ Temperature:           72°F  ││ ✅
│ │ 💧 Humidity:              45%   ││ ✅
│ │ 🏃 Motion:                Clear ││ ✅
│ │ 💡 Light Level:           850 lux││ ✅
│ │ 🔋 Battery:               95%   ││ ✅
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

## Test Cases

### Test 1: Zooz 4-in-1 Sensor (Full Sensor Suite)

**Device:** AR Motion Sensor (Zooz 4-in-1)

**Expected Display:**
```
🌡️ Temperature: [value]°F
💧 Humidity: [value]%
🏃 Motion: Detected | Clear
💡 Light Level: [value] lux
🔋 Battery: [value]%
```

**Verification Steps:**
1. Navigate to Devices page
2. Locate "AR Motion Sensor" card
3. Verify all 5 sensor readings appear
4. Verify values are numbers (not "--")
5. Verify units are displayed (°F, %, lux)
6. Verify motion shows "Detected" or "Clear"

**Expected Results:**
- ✅ All 5 readings visible
- ✅ Values formatted correctly
- ✅ Icons displayed
- ✅ No "No controls available" message

### Test 2: Temperature-Only Sensor

**Device:** Any thermostat or temperature sensor

**Expected Display:**
```
🌡️ Temperature: [value]°F
```

**Verification Steps:**
1. Find device with only temperature capability
2. Verify only temperature reading shows
3. Verify other sensors don't appear
4. Verify no "--" placeholders shown

**Expected Results:**
- ✅ Only temperature displayed
- ✅ Other sensor types hidden
- ✅ Component doesn't show empty rows

### Test 3: Device Without Sensors

**Device:** Brilliant Control (switch only)

**Expected Display:**
```
[Switch control component]
```

**Verification Steps:**
1. Find Brilliant device or pure switch
2. Verify SensorReadings component doesn't render
3. Verify switch control is shown instead
4. Verify no "No controls available" message

**Expected Results:**
- ✅ SensorReadings not rendered
- ✅ Switch control displays
- ✅ No error messages

### Test 4: Device with No Data

**Device:** Offline or non-reporting device

**Expected Display:**
```
● No controls available
```

**Verification Steps:**
1. Find offline device
2. Verify "No controls available" still shows
3. Verify no sensor readings appear
4. Verify no console errors

**Expected Results:**
- ✅ "No controls available" message shown
- ✅ No sensor component rendered
- ✅ No broken UI

### Test 5: Dark Mode

**Toggle:** Click theme toggle in header

**Expected Results:**
- ✅ Sensor readings background lightens (white overlay)
- ✅ Text remains readable
- ✅ Icons visible
- ✅ Skeleton UI theme tokens applied

**Verification Steps:**
1. Enable dark mode
2. Check sensor readings background color
3. Verify text contrast
4. Toggle back to light mode
5. Verify background darkens (black overlay)

### Test 6: Mobile/Responsive

**Viewport:** Resize to 375px width (iPhone SE)

**Expected Results:**
- ✅ Layout doesn't break
- ✅ Values align properly
- ✅ No horizontal scroll
- ✅ Touch-friendly spacing

**Verification Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone SE"
4. Navigate to devices page
5. Verify sensor cards render correctly

### Test 7: Motion State Changes

**Trigger:** Wave hand in front of sensor

**Expected Results:**
- ✅ Motion changes from "Clear" to "Detected"
- ✅ UI updates automatically
- ✅ No page refresh needed

**Verification Steps:**
1. Note current motion state
2. Trigger motion sensor
3. Wait 2-3 seconds
4. Verify state updates in UI

### Test 8: Battery Level Display

**Range Testing:**

| Battery Level | Expected Display | Visual Indicator |
|---------------|------------------|------------------|
| 100% | `🔋 Battery: 100%` | Full battery icon |
| 50% | `🔋 Battery: 50%` | Full battery icon |
| 20% | `🔋 Battery: 20%` | Full battery icon |
| 5% | `🔋 Battery: 5%` | Full battery icon |

**Note:** Future enhancement could add warning styling for low battery.

## Browser Compatibility

Test in:
- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Safari 17+
- ✅ Edge 120+

## Performance Checks

### Load Time
- [ ] Sensor cards render within 500ms
- [ ] No layout shift during render
- [ ] No console errors
- [ ] No console warnings

### Memory
- [ ] No memory leaks (check DevTools Performance tab)
- [ ] Component cleanup on navigation

### Network
- [ ] No unnecessary API calls
- [ ] Data fetched from deviceStore (cached)

## Accessibility Checks

### Screen Reader (NVDA/JAWS)
- [ ] Icons announced as "Temperature", "Humidity", etc.
- [ ] Values read correctly
- [ ] Navigation logical (top to bottom)

### Keyboard Navigation
- [ ] Tab navigation works
- [ ] Focus indicators visible
- [ ] No keyboard traps

### Color Contrast
- [ ] Text meets WCAG 2.1 AA (4.5:1 minimum)
- [ ] Dark mode meets contrast requirements
- [ ] Icons visible without color

## Known Issues

None currently identified.

## Regression Testing

Ensure existing functionality still works:

- [ ] Switch controls still function
- [ ] Dimmer controls still function
- [ ] Device grid layout intact
- [ ] Room filtering works
- [ ] Device search works
- [ ] Online/offline status displays

## Bug Reporting Template

If issues found:

```markdown
**Issue:** [Brief description]
**Device:** [Device name and model]
**Browser:** [Browser and version]
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected:** [What should happen]
**Actual:** [What actually happened]
**Screenshot:** [Attach if applicable]
**Console Errors:** [Copy from DevTools Console]
```

## Success Criteria

All test cases pass:
- ✅ Test 1: Zooz 4-in-1 full suite
- ✅ Test 2: Temperature-only sensor
- ✅ Test 3: Device without sensors
- ✅ Test 4: Device with no data
- ✅ Test 5: Dark mode
- ✅ Test 6: Mobile responsive
- ✅ Test 7: Motion state changes
- ✅ Test 8: Battery level display

## QA Sign-Off

**Tester:** _______________
**Date:** _______________
**Result:** PASS / FAIL
**Notes:**

---

**Ready for Production:** [ ] Yes [ ] No
**Blocker Issues:** [ ] None [ ] List below

