# Events Page Two-View Enhancement Research

**Research Date:** 2025-12-22
**Working Directory:** /Users/masa/Projects/smarterthings
**Purpose:** Investigate current Events page implementation to plan the addition of Timeline (current) and Grid views with toggle switching

---

## Executive Summary

The Events page currently displays a real-time timeline of smart home events with Server-Sent Events (SSE) streaming, filtering, and auto-scroll functionality. This research identifies all components, data structures, and patterns needed to implement a two-view system: **Timeline View** (current) and **Grid View** (new).

### Key Findings

1. **Event Data Structure**: Comprehensive schema with 9 fields suitable for grid display
2. **Current Implementation**: Single-view timeline with SSE streaming (well-architected)
3. **UI Patterns Available**: Button toggle pattern exists in codebase (Skeleton UI variants)
4. **Grid Layout Reference**: Battery page and Automations grid provide excellent templates
5. **Value Parsing**: Human-readable formatting needed for grid view display

---

## 1. Current Events Page Implementation

### File Location
- **Frontend:** `web/src/routes/events/+page.svelte` (220 lines)
- **Store:** `web/src/lib/stores/eventsStore.svelte.ts` (400 lines)
- **Backend:** `src/storage/event-store.ts` (486 lines)

### Current Features
✅ Real-time event streaming via SSE
✅ Connection status indicator with exponential backoff reconnection
✅ Event filtering (type, source)
✅ Auto-scroll toggle
✅ Pagination stats (filtered/total count)
✅ Relative timestamp formatting (e.g., "5m ago", "2h ago")
✅ Badge color coding for event types and sources

### Architecture Pattern
- **State Management:** Svelte 5 Runes (`$state`, `$derived`)
- **Data Flow:** SSE → Store → Component (reactive)
- **Performance:** Capped at 500 events max for memory efficiency
- **Reactivity:** Fine-grained updates (only affected components re-render)

---

## 2. Event Data Structure

### TypeScript Interface (Frontend)
```typescript
export interface SmartHomeEvent {
  id: string;                    // Unique event ID (UUID)
  type: 'device_event'           // Event classification
      | 'user_command'
      | 'automation_trigger'
      | 'rule_execution';
  source: 'smartthings'          // Originating platform
        | 'alexa'
        | 'mcp'
        | 'webhook';
  deviceId?: string;             // Associated device (optional)
  deviceName?: string;           // Human-readable device name (optional)
  locationId?: string;           // SmartThings location (optional)
  eventType?: string;            // Specific event subtype (optional)
  value?: any;                   // Event payload (JSON)
  timestamp: string;             // ISO timestamp (e.g., "2025-12-22T10:30:00Z")
  metadata?: Record<string, any>; // Additional context (optional)
}
```

### Backend Database Schema (SQLite)
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,           -- Event UUID
  type TEXT NOT NULL,            -- Event classification
  source TEXT NOT NULL,          -- Originating platform
  device_id TEXT,                -- Associated device (nullable)
  device_name TEXT,              -- Human-readable device name (nullable)
  location_id TEXT,              -- SmartThings location (nullable)
  event_type TEXT,               -- Specific event subtype (nullable)
  value TEXT,                    -- JSON stringified event payload
  timestamp INTEGER NOT NULL,    -- Unix milliseconds
  metadata TEXT,                 -- JSON stringified metadata
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Performance indexes
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_device ON events(device_id, timestamp DESC);
CREATE INDEX idx_events_type ON events(type, timestamp DESC);
CREATE INDEX idx_events_source ON events(source, timestamp DESC);
```

### Fields Available for Grid View

| Field | Current Timeline Usage | Grid View Potential |
|-------|------------------------|---------------------|
| `id` | Hidden (React key) | Hidden (React key) |
| `type` | Badge (ghost variant) | Badge (ghost variant) |
| `source` | Badge (filled variant) | Badge (filled variant) |
| `deviceName` | Main text (bold) | Card title |
| `eventType` | Subtitle (gray text) | Card subtitle |
| `value` | JSON stringified | **Needs human-readable parsing** |
| `timestamp` | Relative ("5m ago") | Both relative + absolute time |
| `deviceId` | Hidden | Could enable device linking |
| `metadata` | Hidden | Could enable expandable details |

---

## 3. Similar UI Patterns in Codebase

### View Toggle Buttons

**Pattern:** Skeleton UI variant-filled/variant-ghost button groups

**Examples from Codebase:**
```svelte
<!-- Switch Control (ON/OFF state toggle) -->
<button
  class="btn variant-filled-{isOn ? 'primary' : 'surface'}"
  on:click={toggle}
>
  {isOn ? 'ON' : 'OFF'}
</button>

<!-- Auto-scroll toggle (current Events page) -->
<button
  class="btn btn-sm variant-ghost-surface"
  on:click={() => store.setAutoScroll(!store.autoScroll)}
>
  {store.autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
</button>
```

**Recommended Pattern for View Toggle:**
```svelte
<div class="flex items-center gap-2">
  <button
    class="btn btn-sm variant-{view === 'timeline' ? 'filled' : 'ghost'}-primary"
    on:click={() => setView('timeline')}
  >
    Timeline
  </button>
  <button
    class="btn btn-sm variant-{view === 'grid' ? 'filled' : 'ghost'}-primary"
    on:click={() => setView('grid')}
  >
    Grid
  </button>
</div>
```

### Grid Layout References

**1. Battery Page** (`web/src/routes/battery/+page.svelte`)
```svelte
<!-- Responsive grid with device cards -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {#each lowBatteryDevices as device}
    <DeviceCard {device} />
  {/each}
</div>
```

**2. Automations Grid** (`web/src/lib/components/automations/AutomationsGrid.svelte`)
```svelte
<!-- Custom CSS Grid with responsive breakpoints -->
<div class="automations-grid">
  {#each scenesStore.scenes as scene}
    <AutomationCard {scene} />
  {/each}
</div>

<style>
  .automations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
</style>
```

**Recommended for Events Grid:**
```svelte
<!-- Responsive grid with Tailwind CSS -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each store.filteredEvents as event}
    <EventCard {event} />
  {/each}
</div>
```

---

## 4. Human-Readable Value Parsing

### Current Implementation (Timeline View)
```svelte
{#if event.value}
  <p class="text-sm text-surface-600-300-token">
    Value: {typeof event.value === 'object'
      ? JSON.stringify(event.value)
      : String(event.value)}
  </p>
{/if}
```

**Problem:** JSON strings like `{"level":50,"unit":"percent"}` are not user-friendly.

### Recommended Value Formatter

```typescript
/**
 * Format event value for human-readable display
 *
 * Examples:
 * - {"level":50,"unit":"percent"} → "50%"
 * - {"switch":"on"} → "On"
 * - {"temperature":72,"unit":"F"} → "72°F"
 * - "on" → "On"
 * - 50 → "50"
 * - true → "Yes"
 */
function formatEventValue(value: any): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  // Boolean values
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // String values (capitalize)
  if (typeof value === 'string') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  // Number values
  if (typeof value === 'number') {
    return String(value);
  }

  // Object values (common patterns)
  if (typeof value === 'object') {
    // Switch state
    if ('switch' in value) {
      return value.switch === 'on' ? 'On' : 'Off';
    }

    // Level with unit (dimmer, volume, etc.)
    if ('level' in value && 'unit' in value) {
      const unit = value.unit === 'percent' ? '%' : value.unit;
      return `${value.level}${unit}`;
    }

    // Temperature
    if ('temperature' in value && 'unit' in value) {
      return `${value.temperature}°${value.unit}`;
    }

    // Battery level
    if ('battery' in value) {
      return `${value.battery}%`;
    }

    // Fallback: JSON stringify (formatted)
    return JSON.stringify(value, null, 2);
  }

  // Fallback
  return String(value);
}
```

**Usage in Grid View:**
```svelte
<div class="event-value">
  {formatEventValue(event.value)}
</div>
```

---

## 5. Recommended Implementation Approach

### 5.1 Store Enhancements (`eventsStore.svelte.ts`)

**Add view state:**
```typescript
// New state for view mode
let viewMode = $state<'timeline' | 'grid'>('timeline');

// Export getter and setter
export function getEventsStore() {
  return {
    // ... existing getters
    get viewMode() {
      return viewMode;
    },
    setViewMode(mode: 'timeline' | 'grid') {
      viewMode = mode;
    },
  };
}
```

### 5.2 Page Component Structure (`+page.svelte`)

**Layout structure:**
```svelte
<script lang="ts">
  const store = getEventsStore();

  // Existing lifecycle hooks
  $effect(() => {
    store.loadEvents(100);
    store.connectSSE();
    return () => store.disconnectSSE();
  });

  // Helper functions (formatTimestamp, getBadgeColor, etc.)
  // Add: formatEventValue()
</script>

<div class="container mx-auto p-4 max-w-7xl">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="h1 mb-2">Events</h1>
    <p class="text-surface-600-300-token">Real-time smart home event monitoring</p>
  </div>

  <!-- Status Bar with View Toggle -->
  <div class="card p-4 mb-4">
    <div class="flex items-center justify-between">
      <!-- Left: Connection Status + Stats -->
      <div class="flex items-center gap-4">
        <!-- Existing connection status -->
        <!-- Existing stats -->
      </div>

      <!-- Right: View Toggle + Actions -->
      <div class="flex items-center gap-2">
        <!-- NEW: View Toggle -->
        <div class="btn-group variant-ghost-primary">
          <button
            class="btn btn-sm variant-{store.viewMode === 'timeline' ? 'filled' : 'ghost'}-primary"
            on:click={() => store.setViewMode('timeline')}
          >
            Timeline
          </button>
          <button
            class="btn btn-sm variant-{store.viewMode === 'grid' ? 'filled' : 'ghost'}-primary"
            on:click={() => store.setViewMode('grid')}
          >
            Grid
          </button>
        </div>

        <!-- Existing auto-scroll + refresh buttons -->
      </div>
    </div>
  </div>

  <!-- Filters (existing) -->
  <div class="card p-4 mb-4">
    <!-- Existing filter UI -->
  </div>

  <!-- Loading/Error States (existing) -->

  <!-- NEW: Conditional View Rendering -->
  {#if !store.loading && store.filteredEvents.length > 0}
    {#if store.viewMode === 'timeline'}
      <!-- Existing Timeline View -->
      <div class="space-y-2">
        {#each store.filteredEvents as event}
          <!-- Existing timeline card -->
        {/each}
      </div>
    {:else}
      <!-- NEW: Grid View -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each store.filteredEvents as event}
          <EventGridCard {event} />
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Empty State (existing) -->
</div>
```

### 5.3 New Component: `EventGridCard.svelte`

**Location:** `web/src/lib/components/events/EventGridCard.svelte`

**Purpose:** Card component for grid view display

**Key Features:**
- Compact design (300px min-width)
- Device name as primary text
- Event type and source badges
- Human-readable value display
- Absolute + relative timestamp
- Hover state for better UX

**Skeleton Structure:**
```svelte
<script lang="ts">
  import type { SmartHomeEvent } from '$lib/stores/eventsStore.svelte';

  export let event: SmartHomeEvent;

  // Helper functions
  function formatEventValue(value: any): string { /* ... */ }
  function formatTimestamp(timestamp: string): string { /* ... */ }
  function formatAbsoluteTime(timestamp: string): string { /* ... */ }
  function getTypeBadgeColor(type: string): string { /* ... */ }
  function getSourceBadgeColor(source: string): string { /* ... */ }
</script>

<div class="card p-4 hover:variant-soft-surface transition-colors">
  <!-- Header: Badges -->
  <div class="flex items-center gap-2 mb-3">
    <span class={getTypeBadgeColor(event.type)}>{event.type}</span>
    <span class={getSourceBadgeColor(event.source)}>{event.source}</span>
  </div>

  <!-- Device Name (Primary) -->
  {#if event.deviceName}
    <h3 class="font-semibold text-lg mb-2">{event.deviceName}</h3>
  {:else}
    <h3 class="font-semibold text-lg mb-2 text-surface-500">Unknown Device</h3>
  {/if}

  <!-- Event Type (Subtitle) -->
  {#if event.eventType}
    <p class="text-sm text-surface-600-300-token mb-3">{event.eventType}</p>
  {/if}

  <!-- Value (Human-Readable) -->
  {#if event.value}
    <div class="mb-3">
      <span class="text-xs text-surface-600-300-token uppercase">Value:</span>
      <p class="font-medium">{formatEventValue(event.value)}</p>
    </div>
  {/if}

  <!-- Timestamp (Relative + Absolute) -->
  <div class="text-xs text-surface-600-300-token">
    {formatTimestamp(event.timestamp)}
    <span class="text-surface-500-400-token ml-1">
      ({formatAbsoluteTime(event.timestamp)})
    </span>
  </div>
</div>
```

---

## 6. Implementation Checklist

### Phase 1: Store Updates
- [ ] Add `viewMode` state to `eventsStore.svelte.ts`
- [ ] Add `setViewMode()` action
- [ ] Export view mode getter

### Phase 2: Helper Functions
- [ ] Create `formatEventValue()` utility function
- [ ] Create `formatAbsoluteTime()` utility function (e.g., "10:30 AM")
- [ ] Test value parsing with real event data

### Phase 3: Component Development
- [ ] Create `EventGridCard.svelte` component
- [ ] Add responsive grid layout
- [ ] Add hover states and transitions
- [ ] Test with filtered events

### Phase 4: Page Integration
- [ ] Add view toggle buttons to status bar
- [ ] Add conditional rendering (timeline vs. grid)
- [ ] Preserve existing timeline view functionality
- [ ] Test SSE streaming in both views
- [ ] Test filtering in both views

### Phase 5: Polish & Testing
- [ ] Add keyboard navigation (arrow keys for view toggle)
- [ ] Add accessibility attributes (aria-label, role)
- [ ] Test mobile responsiveness (1 column on small screens)
- [ ] Test with 500+ events (performance validation)
- [ ] Update documentation

---

## 7. Performance Considerations

### Memory Management
- **Current:** 500 event cap (maintained in both views)
- **Grid View Impact:** Minimal (same data, different presentation)
- **Recommendation:** Keep 500 event cap, no changes needed

### Rendering Performance
- **Timeline View:** Vertical list (minimal layout calculations)
- **Grid View:** CSS Grid (browser-optimized, no JavaScript layout)
- **Recommendation:** Use CSS Grid (`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`)

### SSE Integration
- **No changes needed:** Both views consume same reactive store
- **Auto-scroll:** Disable in grid view (doesn't make sense for grid layout)
- **Recommendation:** Add `{#if store.viewMode === 'timeline'}` around auto-scroll button

---

## 8. Accessibility Considerations

### Keyboard Navigation
```svelte
<!-- View toggle with keyboard support -->
<div class="btn-group" role="tablist">
  <button
    role="tab"
    aria-selected={store.viewMode === 'timeline'}
    aria-controls="events-timeline"
    on:click={() => store.setViewMode('timeline')}
  >
    Timeline
  </button>
  <button
    role="tab"
    aria-selected={store.viewMode === 'grid'}
    aria-controls="events-grid"
    on:click={() => store.setViewMode('grid')}
  >
    Grid
  </button>
</div>
```

### Screen Reader Support
- Add `aria-label` to event cards
- Add `role="list"` to grid container
- Add `role="listitem"` to event cards
- Ensure badge text is readable (not icon-only)

---

## 9. Trade-offs Analysis

### Timeline View (Current)
**Pros:**
- Chronological order (intuitive for event monitoring)
- Natural scrolling experience
- Auto-scroll for real-time updates
- Space-efficient (narrow cards)

**Cons:**
- Hard to compare events side-by-side
- Requires scrolling to see multiple events
- Less information density

### Grid View (Proposed)
**Pros:**
- High information density (see many events at once)
- Easy visual comparison across events
- Better use of wide screens
- Card-based pattern (familiar from Devices/Automations)

**Cons:**
- Loss of strict chronological ordering (within same row)
- Auto-scroll doesn't make sense
- More complex layout on mobile

### Recommendation
**Keep both views** with toggle. Default to **Timeline** (current behavior), allow users to switch to **Grid** for dense monitoring.

---

## 10. Example Value Parsing Test Cases

| Input Value | Formatted Output |
|-------------|------------------|
| `{"switch":"on"}` | "On" |
| `{"switch":"off"}` | "Off" |
| `{"level":50,"unit":"percent"}` | "50%" |
| `{"temperature":72,"unit":"F"}` | "72°F" |
| `{"battery":85}` | "85%" |
| `true` | "Yes" |
| `false` | "No" |
| `"on"` | "On" |
| `50` | "50" |
| `{"unknown":"data"}` | `{"unknown": "data"}` (JSON) |

---

## 11. Next Steps

### Immediate Actions
1. **Add value formatter utility** (`web/src/lib/utils/eventFormatters.ts`)
2. **Create EventGridCard component** (`web/src/lib/components/events/EventGridCard.svelte`)
3. **Update eventsStore** with view mode state
4. **Modify +page.svelte** with view toggle and conditional rendering

### Future Enhancements (Out of Scope)
- Event detail modal (expand metadata)
- Event export (CSV, JSON)
- Event search (text-based filtering)
- Custom time range filtering
- Event grouping by device/type

---

## 12. References

### Files Reviewed
- `web/src/routes/events/+page.svelte` (220 lines)
- `web/src/lib/stores/eventsStore.svelte.ts` (400 lines)
- `src/storage/event-store.ts` (486 lines)
- `src/queue/MessageQueue.ts` (event type definitions)
- `web/src/routes/battery/+page.svelte` (grid layout reference)
- `web/src/lib/components/automations/AutomationsGrid.svelte` (grid layout reference)
- `web/src/lib/components/layout/SubNav.svelte` (tab navigation reference)

### UI Framework
- **Skeleton UI**: https://www.skeleton.dev/
- **Tailwind CSS 4.1.17**: https://tailwindcss.com/
- **Svelte 5.43.8**: https://svelte.dev/

### Design Inspiration
- SmartThings app (event log view)
- Google Home app (device grid)
- Apple Home app (accessory grid)

---

## Appendix: Current Event Type & Source Values

### Event Types (from backend)
```typescript
type SmartHomeEventType =
  | 'device_event'          // Device state change (e.g., light turned on)
  | 'user_command'          // User-initiated command (e.g., Alexa voice command)
  | 'automation_trigger'    // Scene/automation executed
  | 'rule_execution';       // Rule triggered
```

### Event Sources (from backend)
```typescript
type EventSource =
  | 'smartthings'           // SmartThings platform
  | 'alexa'                 // Alexa voice command
  | 'mcp'                   // MCP tool invocation
  | 'webhook';              // Webhook POST request
```

### Badge Color Mapping (Current Implementation)
```typescript
// Type badges (ghost variant - outline)
const typeBadgeColors: Record<string, string> = {
  device_event: 'badge variant-ghost-primary',        // Blue
  user_command: 'badge variant-ghost-secondary',      // Purple
  automation_trigger: 'badge variant-ghost-tertiary', // Green
  rule_execution: 'badge variant-ghost-success',      // Teal
};

// Source badges (filled variant - solid background)
const sourceBadgeColors: Record<string, string> = {
  smartthings: 'badge variant-filled-primary',   // Blue
  alexa: 'badge variant-filled-secondary',       // Purple
  mcp: 'badge variant-filled-tertiary',          // Green
  webhook: 'badge variant-filled-surface',       // Gray
};
```

---

**End of Research Report**
**Next Action:** Begin implementation of view toggle and EventGridCard component
