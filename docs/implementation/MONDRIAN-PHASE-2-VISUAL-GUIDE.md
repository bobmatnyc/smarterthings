# Mondrian Dashboard Phase 2: Visual Design Guide

## Component Visual Specifications

### 1. SensorPulseIndicator

**Default State (Inactive)**
```
┌──────────────┐
│    Clear     │  ← Gray background (rgb(243, 244, 246))
└──────────────┘     Gray text (rgb(107, 114, 128))
```

**Active State**
```
┌──────────────┐
│   Motion     │  ← Green background (rgb(34, 197, 94))
└──────────────┘     White text
```

**Animation on State Change**
```
Scale: 1.0 → 1.2 → 1.0 (500ms)
Flash: Gold shadow (rgba(255, 215, 0, 0.6)) for 300ms
```

**State Text Mapping**:
- Motion Sensor: "Motion" / "Clear"
- Contact Sensor: "Open" / "Closed"
- Occupancy Sensor: "Occupied" / "Vacant"
- Water Leak Sensor: "Leak!" / "Dry"

---

### 2. LightGlowIndicator

**OFF State**
```
┌──────────┐
│    💡    │  ← Gray background (rgb(243, 244, 246))
└──────────┘     No glow
```

**ON State**
```
┌──────────┐
│    💡    │  ← Green background (rgb(34, 197, 94))
└──────────┘     Green glow: box-shadow 0 0 15px 5px rgba(34, 197, 94, 0.6)
```

**ON State with Dimmer**
```
┌──────────┐
│    💡    │  ← Green background + glow
│   75%    │     Brightness percentage
└──────────┘
```

**Transition**: 300ms ease-in-out

---

### 3. TemperatureDisplay

**Color Gradient**:
```
< 60°F      │ 60-75°F       │ > 75°F
Blue        │ Green         │ Orange
────────────┼───────────────┼────────────
rgb(219,    │ rgb(220,      │ rgb(254,
234, 254)   │ 252, 231)     │ 243, 199)
Cool        │ Comfortable   │ Warm
```

**Display Format**:
```
┌──────────────┐
│  🌡️ 72.5°F  │  ← Monospace font (SF Mono, Monaco, Consolas)
└──────────────┘     Icon + Temperature + Unit
```

**Font**: 0.875rem, font-weight: 600

---

### 4. BatteryIndicator

**Normal (>20%)**
```
┌──────────────┐
│  🔋 85%      │  ← Green background (rgb(220, 252, 231))
└──────────────┘     Dynamic fill level in battery icon
```

**Low (10-20%)**
```
┌──────────────┐
│  🔋 15%      │  ← Amber background (rgb(254, 243, 199))
│     LOW      │     Warning text
└──────────────┘
```

**Critical (≤10%)**
```
┌──────────────┐
│  🔋 8%       │  ← Red background (rgb(254, 226, 226))
│   CRITICAL   │     Pulse animation (2s infinite)
└──────────────┘
```

**Battery Icon Fill**:
- SVG battery outline with dynamic fill rect
- Fill height = `12 * (batteryLevel / 100)` pixels
- Opacity: 0.6

---

### 5. DeviceMiniCard Layout

**Structure**:
```
┌─────────────────────┐
│                     │
│         💡          │  ← Device icon (2rem)
│                     │
│   Living Room       │  ← Device name (truncated, 2 lines)
│       Light         │
│                     │
│  ┌───────────────┐  │
│  │   Indicator   │  │  ← State indicator component
│  └───────────────┘  │
│                     │
└─────────────────────┘
```

**Dimensions**:
- Min-height: 120px
- Padding: 0.75rem
- Gap: 0.5rem between elements

**Hover State (Controllable)**:
```
Transform: translateY(-2px)
Shadow: 0 4px 6px rgba(0, 0, 0, 0.1)
Border: rgb(59, 130, 246)
Cursor: pointer
```

**Non-Controllable**:
```
Cursor: default
No hover effects
Generic online/offline badge (● / ○)
```

---

## RoomTile Grid Layout

**Desktop** (>767px):
```
┌─────────────────────────────────────────┐
│  Living Room                         3  │  ← Room header
├─────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐│
│  │Dev1│  │Dev2│  │Dev3│  │Dev4│  │Dev5││  ← Device grid
│  └────┘  └────┘  └────┘  └────┘  └────┘│     (auto-fill, minmax 80px)
└─────────────────────────────────────────┘
```

**Mobile** (≤767px):
```
┌─────────────────────────┐
│  Living Room         3  │
├─────────────────────────┤
│  ┌───┐  ┌───┐  ┌───┐   │
│  │D1 │  │D2 │  │D3 │   │  ← Tighter grid
│  └───┘  └───┘  └───┘   │     (minmax 70px)
└─────────────────────────┘
```

---

## Animation Specifications

### Sensor Pulse Animation
```css
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
  }
  50% {
    transform: scale(1.2);
    box-shadow: 0 0 15px 5px rgba(255, 215, 0, 0.6);
  }
}
/* Duration: 500ms, Easing: ease-in-out */
```

### Battery Critical Pulse
```css
@keyframes pulse-critical {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}
/* Duration: 2s, Easing: ease-in-out, Iteration: infinite */
```

### Light Glow Transition
```css
.light-indicator {
  transition: all 0.3s ease-in-out;
}
/* Properties: background-color, color, box-shadow */
```

---

## Color Palette

**Indicator Colors**:
```
Green (Active/On):    rgb(34, 197, 94)
Gray (Inactive/Off):  rgb(243, 244, 246)
Blue (Cool):          rgb(219, 234, 254)
Orange (Warm):        rgb(254, 243, 199)
Amber (Low Battery):  rgb(254, 243, 199) / #F59E0B
Red (Critical):       rgb(254, 226, 226) / #EF4444
Gold (Flash):         #FFD700 / rgba(255, 215, 0, 0.6)
```

**Text Colors**:
```
Primary:    rgb(55, 65, 81)
Secondary:  rgb(107, 114, 128)
On-Color:   white / rgb(255, 255, 255)
```

**Border Colors**:
```
Default:    rgba(0, 0, 0, 0.1)
Focus:      rgb(59, 130, 246)
Room Tile:  2px solid black (Mondrian style)
```

---

## Typography

**Device Names**:
```
Font-size: 0.75rem (desktop), 0.6875rem (mobile)
Font-weight: 500
Line-clamp: 2 lines
Text-overflow: ellipsis
```

**State Text**:
```
Font-size: 0.75rem (indicators), 0.625rem (status labels)
Font-weight: 600
Text-transform: uppercase (status labels)
```

**Temperature/Battery Values**:
```
Font-family: 'SF Mono', 'Monaco', 'Consolas', monospace
Font-size: 0.875rem (temperature), 0.75rem (battery)
Font-weight: 600
```

---

## Accessibility

**ARIA Labels**:
```html
<div role="status" aria-label="motionSensor sensor: Motion">
<div role="status" aria-label="Light is on at 75%">
<div role="status" aria-label="Temperature: 72.5°F">
<div role="status" aria-label="Battery: 85%">
```

**Focus Indicators**:
```css
.device-mini-card:focus-visible {
  outline: 2px solid rgb(59, 130, 246);
  outline-offset: 2px;
}
```

**Keyboard Navigation**:
- Tab: Navigate between controllable devices
- Enter/Space: Toggle switch/light
- Focus-visible outline for keyboard users

---

## Performance Characteristics

**Animation Performance**:
- GPU-accelerated: `transform`, `opacity`, `box-shadow`
- No layout thrashing: Avoids `width`, `height`, `top`, `left`
- Hardware-accelerated: Uses CSS transforms
- 60fps target: Smooth animations on all devices

**Render Performance**:
- Svelte 5 fine-grained reactivity
- Only affected components re-render
- Minimal DOM updates
- Efficient state change detection with `$effect`

**Bundle Size**:
- DeviceMiniCard: ~6KB compiled
- Each indicator: ~2-3KB compiled
- Total Phase 2 addition: ~15KB (gzipped)
