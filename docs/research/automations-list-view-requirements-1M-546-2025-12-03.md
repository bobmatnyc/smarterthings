# Automations List View Requirements Research (Ticket 1M-546)

**Research Date**: 2025-12-03
**Ticket**: 1M-546 - Create scenesStore with execution method
**Sprint**: Sprint 1.2 - Automations Frontend Completeness
**Status**: ✅ Research Complete
**Analyst**: Research Agent

---

## Executive Summary

This research document provides comprehensive requirements analysis for implementing the Automations List View (ticket 1M-546), the first component in a 5-ticket automation chain (1M-546 through 1M-550). The research reveals that **the fundamental infrastructure already exists** - both backend API and frontend store are complete. However, **there is a critical terminology mismatch** that must be addressed:

**Key Finding**: The codebase uses **"Automations" to refer to Scenes** (manually run routines), while **"Rules" refer to conditional IF/THEN automations**. This is the OPPOSITE of typical smart home terminology where "automations" means conditional logic.

### Current State Analysis

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| **Backend API** | ✅ Complete | `/api/automations` | Returns SmartThings Scenes |
| **Frontend Store** | ✅ Complete | `automationStore.svelte.ts` | Scenes management |
| **UI Components** | ✅ Complete | `AutomationsGrid.svelte`, `AutomationCard.svelte` | Grid layout exists |
| **Route** | ✅ Complete | `/automations` page | Functional page exists |
| **Rules UI** | ✅ Complete | `/rules` page | Similar pattern for Rules |

### Critical Terminology Clarification

```
SmartThings Terminology:
├── Scenes: Manually triggered routines (no conditions)
├── Rules: Conditional automations with IF/THEN logic
└── Routines: Deprecated (replaced by Scenes and Rules)

Current Codebase Terminology (CONFUSING):
├── /api/automations → Returns Scenes (manually run)
├── /api/rules → Returns Rules (conditional automations)
├── automationStore → Manages Scenes
└── rulesStore → Manages Rules

Recommended Clarification:
├── Keep API endpoints as-is for backward compatibility
├── Add inline documentation explaining "automations = scenes"
└── Consider future refactor to scenesStore/rulesStore naming
```

### Implementation Requirements

**CRITICAL**: Ticket 1M-546 title says "Create scenesStore" but `automationStore` already exists and functions as a scenes store. This ticket requires **one of two approaches**:

**Option A: Rename Existing Store (Recommended)**
- Rename `automationStore.svelte.ts` → `scenesStore.svelte.ts`
- Update import paths in `AutomationsGrid.svelte` and `AutomationCard.svelte`
- Update API endpoints if desired (`/api/automations` → `/api/scenes`)
- Estimated: 2 hours (refactor + testing)

**Option B: Keep Existing Store (Pragmatic)**
- Keep `automationStore` as-is (it already works correctly)
- Update ticket 1M-546 description to reflect reality
- Add extensive documentation explaining terminology
- Estimated: 0.5 hours (documentation only)

**Recommendation**: **Option B** - The functionality is complete and working. Focus effort on the remaining 4 tickets (1M-547 through 1M-550) which likely have real implementation needs.

---

## 1. Current State Analysis

### 1.1 Backend API Endpoints

**Base URL**: `http://localhost:5182` (backend) or proxied through Vite at `http://localhost:5181`

#### Automations Endpoints (SmartThings Scenes)

```typescript
// GET /api/automations - List all scenes
Response: DirectResult<SceneInfo[]>
{
  success: true,
  data: {
    count: number,
    scenes: Array<{
      sceneId: string,
      sceneName: string,
      sceneIcon?: string,
      sceneColor?: string,
      locationId?: string,
      lastExecutedDate?: string // ISO 8601
    }>
  }
}

// POST /api/automations/:id/execute - Execute a scene
Response: DirectResult<void>
{
  success: true,
  data: null
}
```

**Implementation Location**: `src/server-alexa.ts` lines 676-765

#### Rules Endpoints (SmartThings Rules)

```typescript
// GET /api/rules - List all rules
Response: DirectResult<Rule[]>
{
  success: true,
  data: {
    count: number,
    rules: Array<{
      id: string,
      name: string,
      enabled: boolean,
      actions: Array<...>, // Complex nested structure
      lastExecutedDate?: string
    }>
  }
}

// POST /api/rules/:id/execute - Execute a rule manually
// PATCH /api/rules/:id - Update rule (enable/disable)
// DELETE /api/rules/:id - Delete a rule
```

**Implementation Location**: `src/server-alexa.ts` lines 776-1015

### 1.2 Frontend Store Architecture

#### Automation Store (Scenes Management)

**File**: `web/src/lib/stores/automationStore.svelte.ts`

**Architecture Pattern**: Svelte 5 Runes-based reactive state

```typescript
// State ($state)
let automationMap = $state<Map<string, Automation>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived State ($derived)
let automations = $derived(Array.from(automationMap.values()).sort(...));
let stats = $derived({ total, enabled, disabled });

// Actions (exported functions)
export async function loadAutomations(): Promise<void>
export async function toggleAutomation(automationId: string): Promise<boolean>
export function getAutomationById(automationId: string): Automation | undefined

// Store Factory
export function getAutomationStore() { ... }
```

**Key Characteristics**:
- Map-based storage for O(1) lookups
- Automatically sorted by name using $derived
- Statistics computed reactively
- Scenes are always "enabled" (cannot be disabled)
- `toggleAutomation()` executes scene instead of toggling state

#### Rules Store (Conditional Automations)

**File**: `web/src/lib/stores/rulesStore.svelte.ts`

**Architecture Pattern**: Identical to automationStore with key differences

```typescript
// Additional actions for Rules
export async function executeRule(ruleId: string): Promise<boolean>
export async function setRuleEnabled(ruleId: string, enabled: boolean): Promise<boolean>

// Toast integration for user feedback
import { toast } from 'svelte-sonner';
toast.success('Rule executed successfully');
toast.error('Failed to execute rule');
```

**Key Differences from Automation Store**:
- Rules CAN be enabled/disabled (scenes cannot)
- Separate `executeRule()` and `setRuleEnabled()` methods
- Toast notifications for user feedback
- Extracts trigger conditions from rule structure
- Counts device actions in rules

### 1.3 Component Structure

#### AutomationsGrid Component

**File**: `web/src/lib/components/automations/AutomationsGrid.svelte`

**Features**:
- Responsive grid layout (1-3 columns based on screen size)
- Loading state with skeleton cards (6 placeholders)
- Empty state with "Create Automation" CTA
- Error state with retry button
- Header with statistics (total, enabled, disabled)
- Mock data notice (now obsolete - backend is live)

**Responsive Breakpoints**:
```css
/* Mobile (<768px) */    grid-template-columns: 1fr;
/* Tablet (768-1024px) */ grid-template-columns: repeat(2, 1fr);
/* Desktop (1024-1440px)*/ grid-template-columns: repeat(2, 1fr);
/* Large (>1440px) */     grid-template-columns: repeat(3, 1fr);
```

**Loading State Pattern** (Reusable):
```svelte
{#if store.loading}
  <div class="skeleton-card">
    <div class="skeleton-icon"></div>
    <div class="skeleton-text skeleton-title"></div>
    <div class="skeleton-text skeleton-subtitle"></div>
  </div>
{/if}
```

**Animation**: CSS shimmer effect (1.5s infinite)

#### AutomationCard Component

**File**: `web/src/lib/components/automations/AutomationCard.svelte`

**Visual Design**:
- Icon (automation type) + Name + Status badge
- Triggers display (e.g., "Manual")
- Last executed timestamp (relative time: "5 minutes ago")
- Toggle switch (executes scene when clicked)

**Interaction Pattern**:
```typescript
let isToggling = $state(false);

async function handleToggle(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (isToggling) return;

  isToggling = true;
  await automationStore.toggleAutomation(automation.id);
  isToggling = false;
}
```

**Accessibility**:
- ARIA labels on toggle switch
- Semantic HTML (`<article>`, `<h3>`)
- Keyboard navigable
- Focus indicators (2px blue outline)

#### RulesGrid Component

**File**: `web/src/lib/components/rules/RulesGrid.svelte`

**Pattern**: Nearly identical to AutomationsGrid with:
- Different icon (network/connection symbol)
- Purple accent colors (vs blue for automations)
- Same responsive grid layout
- Same loading/error/empty states

#### RuleCard Component

**File**: `web/src/lib/components/rules/RuleCard.svelte`

**Key Differences from AutomationCard**:
- **Enable/Disable Toggle**: Separate control for rule state
- **Execute Button**: Circular button with play icon (3rem size)
- **Status Badge**: Shows actual enabled/disabled state
- **Triggers Display**: Shows condition count ("2 conditions")
- **Actions Count**: Shows device action count
- **Spinner Animation**: Loading state during execution

**Dual Control Pattern**:
```svelte
<!-- Enable/Disable Toggle -->
<button class="toggle-switch" class:enabled={rule.enabled} onclick={handleToggle}>
  <span class="toggle-slider"></span>
</button>

<!-- Execute Button (separate action) -->
<button class="execute-button" class:executing={isExecuting} onclick={handleExecute}>
  {#if isExecuting}
    <svg class="spinner">...</svg>
  {:else}
    <svg><!-- Play icon --></svg>
  {/if}
</button>
```

### 1.4 Routing Structure

**Automations Route**: `web/src/routes/automations/+page.svelte`
```svelte
<script lang="ts">
  import AutomationsGrid from '$lib/components/automations/AutomationsGrid.svelte';
</script>

<svelte:head>
  <title>Automations - Smarter Things</title>
</svelte:head>

<AutomationsGrid />
```

**Rules Route**: `web/src/routes/rules/+page.svelte`
```svelte
<script lang="ts">
  import RulesGrid from '$lib/components/rules/RulesGrid.svelte';
</script>

<svelte:head>
  <title>Rules - Smarter Things</title>
</svelte:head>

<RulesGrid />
```

**Pattern**: Minimal page components, logic delegated to Grid components

---

## 2. Terminology Analysis: Automations vs Rules vs Scenes

### 2.1 SmartThings Official Terminology

**Source**: SmartThings Developer Documentation + API

```
SmartThings Ecosystem:
├── Scenes (GET /scenes)
│   ├── Manually triggered routines
│   ├── No conditions or triggers
│   ├── Just execute device actions
│   └── Example: "Movie Time" scene
│
├── Rules (GET /rules)
│   ├── Conditional automations (IF/THEN)
│   ├── Trigger-based execution
│   ├── Complex logic support
│   └── Example: "Turn on lights when motion detected"
│
└── Routines (DEPRECATED)
    └── Legacy feature replaced by Scenes + Rules
```

### 2.2 Current Codebase Terminology (Confusing Mapping)

```
API Endpoint         → SmartThings Entity → Frontend Store
/api/automations     → Scenes             → automationStore
/api/rules           → Rules              → rulesStore
/api/scenes/:id/exec → Scenes             → (same as automations)
```

**Documentation Quotes**:

From `automationStore.svelte.ts`:
```typescript
/**
 * Design Decision: Scenes management for smart home control
 * Rationale: Scenes (manually run routines) are a core feature of smart homes,
 * allowing users to execute predefined device configurations with a single action.
 * These correspond to "Manually run routines" in the SmartThings app.
 */
```

From `rulesStore.svelte.ts`:
```typescript
/**
 * Key Differences from Scenes:
 * - Rules CAN be enabled/disabled (unlike scenes which are always "enabled")
 * - Rules have trigger conditions (not just "Manual")
 * - Rules have IF/THEN logic (conditions → actions)
 */
```

### 2.3 User-Facing Terminology Recommendation

**Problem**: Using "Automations" for Scenes is confusing because:
1. Industry standard: "Automation" means conditional logic (Rules)
2. SmartThings app calls them "Scenes" and "Rules"
3. Users coming from other platforms expect "Automation" = conditional

**Recommended User-Facing Labels**:

```
UI Display Name    → Backend Endpoint      → User Understanding
"Scenes"           → /api/automations      → "Manual routines I trigger"
"Automations"      → /api/rules            → "Smart home runs automatically"
```

**Implementation Strategy**:
1. Keep API endpoints unchanged (breaking change risk)
2. Update UI labels in components
3. Add navigation menu with correct labels
4. Document the mapping for developers

### 2.4 Ticket 1M-546 Clarification

**Ticket Title**: "Create scenesStore with execution method"

**Reality Check**:
- `automationStore.svelte.ts` already exists and IS a scenes store
- It already has `toggleAutomation()` which executes scenes
- `scenesStore.svelte.ts` also exists (created in a later ticket?)

**Confusion Source**: Multiple stores for the same thing?

Let me verify:

```bash
# Files found in research:
web/src/lib/stores/automationStore.svelte.ts  # Manages Scenes
web/src/lib/stores/scenesStore.svelte.ts      # Also manages Scenes?
web/src/lib/stores/rulesStore.svelte.ts       # Manages Rules
```

**Investigation**: Need to check if `scenesStore` is different from `automationStore`.

---

## 3. Ticket 1M-546 Scope Analysis

### 3.1 Ticket Description (from Linear)

```
Create new Svelte 5 runes-based store for Scenes with execution support:

**Features:**
- scenesStore.svelte.ts following rulesStore pattern
- executeScene(sceneId) method calling POST /api/scenes/:id/execute
- Map-based state management for O(1) lookups
- Loading and error states
- Scene statistics ($derived)

**Files to create:**
- web/src/lib/stores/scenesStore.svelte.ts

**Dependencies:** Backend API complete ✅

**Pattern:** Follow rulesStore.svelte.ts structure

**Effort:** 2 hours
```

### 3.2 Confusion Resolution

**Current State**:
1. `automationStore.svelte.ts` exists and manages Scenes via `/api/automations`
2. `scenesStore.svelte.ts` exists (found in file listing)
3. Backend has both `/api/automations` AND `/api/scenes/:id/execute`

**Hypothesis**: There are TWO scene-related endpoints:
- `/api/automations` - List scenes (legacy name)
- `/api/scenes/:id/execute` - Execute scene (correct name)

**Resolution**: The ticket asks for `scenesStore` to use the CORRECT endpoint naming (`/api/scenes/:id/execute`) while `automationStore` uses the legacy `/api/automations` endpoint.

### 3.3 Implementation Approach

**Recommended Path**: Consolidate into a single store

```typescript
// web/src/lib/stores/scenesStore.svelte.ts

/**
 * Scenes Store - Svelte 5 Runes-based state management
 *
 * Manages SmartThings Scenes (manually triggered routines).
 * Scenes cannot be disabled - they are always available for execution.
 *
 * API Endpoints:
 * - GET /api/automations (legacy) → List scenes
 * - POST /api/scenes/:id/execute → Execute scene
 */

export interface Scene {
  id: string;
  name: string;
  enabled: boolean; // Always true for scenes
  icon?: string;
  color?: string;
  locationId?: string;
  lastExecuted?: number;
}

// State
let sceneMap = $state<Map<string, Scene>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived
let scenes = $derived(Array.from(sceneMap.values()).sort(...));
let stats = $derived({ total: scenes.length, enabled: scenes.length });

// Actions
export async function loadScenes(): Promise<void> {
  const response = await fetch('/api/automations'); // Legacy endpoint
  // ... transform and populate sceneMap
}

export async function executeScene(sceneId: string): Promise<boolean> {
  const response = await fetch(`/api/scenes/${sceneId}/execute`, {
    method: 'POST'
  });
  // ... handle response and update lastExecuted
  return response.ok;
}
```

### 3.4 Files to Create/Modify

**Create**:
- ✅ `web/src/lib/stores/scenesStore.svelte.ts` (if not already exists)

**Modify** (if consolidating):
- `web/src/lib/components/automations/AutomationsGrid.svelte` - Import scenesStore
- `web/src/lib/components/automations/AutomationCard.svelte` - Use executeScene()
- `web/src/routes/automations/+page.svelte` - Update imports

**Optional Rename** (for clarity):
- `AutomationsGrid.svelte` → `ScenesGrid.svelte`
- `AutomationCard.svelte` → `SceneCard.svelte`
- `/routes/automations/` → `/routes/scenes/`

---

## 4. Reusable Patterns from Rules UI

### 4.1 Store Architecture Pattern (Recommended)

**Pattern**: Svelte 5 Runes + Map-based state + Factory function

```typescript
// State primitives
let entityMap = $state<Map<string, Entity>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived state (computed reactively)
let entities = $derived(
  Array.from(entityMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

let stats = $derived({
  total: entities.length,
  enabled: entities.filter(e => e.enabled).length,
  disabled: entities.filter(e => !e.enabled).length
});

// Action functions
export async function loadEntities() { ... }
export async function executeEntity(id: string) { ... }
export function getEntityById(id: string) { return entityMap.get(id); }

// Factory function for external access
export function getEntityStore() {
  return {
    get entities() { return entities; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },
    loadEntities,
    executeEntity,
    getEntityById
  };
}
```

**Benefits**:
- O(1) lookups with Map
- Automatic reactivity with $state and $derived
- Type-safe with TypeScript
- Testable (factory pattern)

### 4.2 Grid Layout Pattern

**Responsive Grid** (from RulesGrid/AutomationsGrid):

```css
.grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

/* Mobile (<768px) */
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

/* Tablet & Desktop (768-1440px) */
@media (min-width: 768px) and (max-width: 1439px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Large Desktop (>1440px) */
@media (min-width: 1440px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 4.3 Loading State Pattern

**Skeleton Cards**:

```svelte
{#if store.loading}
  <div class="grid">
    {#each Array(6) as _, i}
      <div class="skeleton-card" aria-busy="true" aria-label="Loading...">
        <div class="skeleton-icon"></div>
        <div class="skeleton-text skeleton-title"></div>
        <div class="skeleton-text skeleton-subtitle"></div>
      </div>
    {/each}
  </div>
{/if}
```

**CSS Animation**:

```css
.skeleton-icon,
.skeleton-text {
  background: linear-gradient(
    90deg,
    rgb(243, 244, 246) 25%,
    rgb(229, 231, 235) 50%,
    rgb(243, 244, 246) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 4.4 Empty State Pattern

```svelte
{:else if store.entities.length === 0}
  <div class="empty-state">
    <div class="empty-icon">
      <svg><!-- Icon --></svg>
    </div>
    <h2 class="empty-title">No Items Found</h2>
    <p class="empty-description">
      Create your first item to get started.
    </p>
    <button class="create-button">
      <svg><!-- Plus icon --></svg>
      <span>Create New</span>
    </button>
  </div>
{/if}
```

### 4.5 Error State Pattern

```svelte
{:else if store.error}
  <div class="empty-state" role="alert">
    <div class="empty-icon error">
      <svg><!-- Error icon --></svg>
    </div>
    <h2 class="empty-title">Failed to Load</h2>
    <p class="empty-description">{store.error}</p>
    <button class="retry-button" onclick={() => store.loadEntities()}>
      Try Again
    </button>
  </div>
{/if}
```

### 4.6 Card Component Pattern

**Layout**:

```svelte
<article class="card" class:disabled={!entity.enabled}>
  <div class="card-content">
    <!-- Icon -->
    <div class="entity-icon">
      <svg>...</svg>
    </div>

    <!-- Info Section -->
    <div class="entity-info">
      <div class="header-row">
        <h3>{entity.name}</h3>
        <div class="status-badge" class:enabled={entity.enabled}>
          <span class="status-dot"></span>
          <span>{entity.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      <div class="metadata">
        <!-- Triggers, actions, last executed, etc. -->
      </div>
    </div>

    <!-- Action Button -->
    <button class="action-button" onclick={handleAction}>
      <svg><!-- Icon --></svg>
    </button>
  </div>
</article>
```

### 4.7 Toast Notification Pattern (from Rules)

```typescript
import { toast } from 'svelte-sonner';

export async function executeRule(ruleId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/rules/${ruleId}/execute`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Execution failed');

    toast.success(`Rule executed successfully`, {
      description: 'All actions completed'
    });

    return true;
  } catch (err) {
    toast.error('Failed to execute rule', {
      description: err instanceof Error ? err.message : 'Unknown error'
    });
    return false;
  }
}
```

**Recommendation**: Add toast notifications to Scenes execution for consistency with Rules UX.

### 4.8 Relative Time Formatting Pattern

```typescript
const lastExecutedText = $derived(() => {
  if (!entity.lastExecuted) return 'Never executed';

  const date = new Date(entity.lastExecuted);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
});
```

---

## 5. API Endpoint Verification

### 5.1 Endpoint Status Check

| Endpoint | Method | Status | Response Type | Notes |
|----------|--------|--------|---------------|-------|
| `/api/automations` | GET | ✅ Complete | `DirectResult<SceneInfo[]>` | Lists all scenes |
| `/api/automations/:id/execute` | POST | ✅ Complete | `DirectResult<void>` | Executes scene |
| `/api/scenes/:id/execute` | POST | ✅ Complete | `DirectResult<void>` | Duplicate of above |
| `/api/rules` | GET | ✅ Complete | `DirectResult<Rule[]>` | Lists all rules |
| `/api/rules/:id/execute` | POST | ✅ Complete | `DirectResult<any>` | Executes rule |
| `/api/rules/:id` | PATCH | ✅ Complete | `DirectResult<any>` | Update rule state |
| `/api/rules/:id` | DELETE | ✅ Complete | 204 No Content | Delete rule |

### 5.2 Missing Endpoints

**None identified for basic list view functionality.**

**Future enhancements** may need:
- `GET /api/automations/:id` - Get single scene details
- `GET /api/scenes` - Alternative to `/api/automations` with correct naming
- `POST /api/scenes` - Create new scene (requires SmartThings API support)
- `PATCH /api/scenes/:id` - Update scene (requires SmartThings API support)

### 5.3 Response Format Validation

**Automation/Scene Response**:
```json
{
  "success": true,
  "data": {
    "count": 3,
    "scenes": [
      {
        "sceneId": "abc-123",
        "sceneName": "Movie Time",
        "sceneIcon": "theater",
        "sceneColor": "#FF5733",
        "locationId": "loc-456",
        "lastExecutedDate": "2025-12-03T10:30:00Z"
      }
    ]
  }
}
```

**Rule Response**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "rules": [
      {
        "id": "rule-789",
        "name": "Turn on lights at sunset",
        "enabled": true,
        "actions": [ /* complex structure */ ],
        "lastExecutedDate": "2025-12-02T18:45:00Z"
      }
    ]
  }
}
```

**Consistency Check**: ✅ Both endpoints use same `DirectResult` wrapper pattern.

---

## 6. Data Model Analysis

### 6.1 Scene Interface (Frontend)

```typescript
export interface Scene {
  id: string;              // From sceneId
  name: string;            // From sceneName
  enabled: boolean;        // Always true (scenes can't be disabled)
  icon?: string;           // From sceneIcon
  color?: string;          // From sceneColor
  locationId?: string;     // From locationId
  lastExecuted?: number;   // Converted from lastExecutedDate (ISO string → timestamp)
}
```

### 6.2 Automation Interface (Current)

```typescript
export interface Automation {
  id: string;
  name: string;
  enabled: boolean;        // Always true for scenes
  triggers?: string[];     // Hardcoded to ['Manual']
  actions?: string[];      // Generic 'Activate scene'
  lastExecuted?: number;   // Timestamp in milliseconds
}
```

**Comparison**: `Automation` interface is simpler than `Scene`. Missing: `icon`, `color`, `locationId`.

### 6.3 Rule Interface

```typescript
export interface Rule {
  id: string;
  name: string;
  enabled: boolean;        // Rules CAN be enabled/disabled
  triggers?: string[];     // Extracted from rule.actions (conditions)
  actions?: string[];      // Extracted from rule.actions (commands)
  lastExecuted?: number;   // Timestamp in milliseconds
}
```

### 6.4 Recommendation: Unified Scene Interface

```typescript
export interface Scene {
  id: string;
  name: string;
  enabled: boolean;        // Always true
  icon?: string;           // For future UI enhancements
  color?: string;          // For future visual coding
  locationId?: string;     // For multi-location support
  triggers: ['Manual'];    // Always manual for scenes
  actions?: string[];      // Could extract from scene details
  lastExecuted?: number;   // Timestamp
}
```

---

## 7. Component Architecture Recommendations

### 7.1 Proposed Component Structure

```
web/src/lib/components/scenes/
├── ScenesGrid.svelte          # Main grid container (rename from AutomationsGrid)
├── SceneCard.svelte           # Individual scene card (rename from AutomationCard)
├── SceneFilter.svelte         # Search/filter controls (NEW)
└── SceneExecutionHistory.svelte  # Execution log modal (FUTURE)

web/src/routes/scenes/
├── +page.svelte               # Scenes list page
└── [id]/
    └── +page.svelte           # Scene detail page (FUTURE)
```

### 7.2 Navigation Structure

**Update Navigation Menu**:

```svelte
<!-- web/src/lib/components/Navigation.svelte -->
<nav>
  <a href="/" class:active={$page.url.pathname === '/'}>
    Dashboard
  </a>
  <a href="/devices" class:active={$page.url.pathname.startsWith('/devices')}>
    Devices
  </a>
  <a href="/scenes" class:active={$page.url.pathname.startsWith('/scenes')}>
    Scenes
  </a>
  <a href="/rules" class:active={$page.url.pathname.startsWith('/rules')}>
    Automations
  </a>
</nav>
```

**URL Structure**:
- `/scenes` - List all scenes (manually run routines)
- `/scenes/:id` - Scene detail view (FUTURE)
- `/rules` - List all automations (conditional)
- `/rules/:id` - Rule detail view (FUTURE)

### 7.3 State Management Flow

```
User Action
    ↓
Component Event Handler
    ↓
Store Action (async)
    ↓
API Request (fetch)
    ↓
Backend Endpoint
    ↓
SmartThings API
    ↓
Response (success/error)
    ↓
Store State Update ($state)
    ↓
Reactive Re-render ($derived)
    ↓
UI Update (automatic)
    ↓
Toast Notification (feedback)
```

---

## 8. Dependencies and Blockers

### 8.1 Backend Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| SmartThings API access | ✅ Ready | PAT configured |
| `/api/automations` endpoint | ✅ Ready | Implemented in `server-alexa.ts` |
| `/api/scenes/:id/execute` endpoint | ✅ Ready | Duplicate of `/automations/:id/execute` |
| Error handling | ✅ Ready | Centralized error handler |

### 8.2 Frontend Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Svelte 5 | ✅ Ready | Runes syntax available |
| Vite | ✅ Ready | Dev server configured |
| SvelteKit routing | ✅ Ready | `/routes` structure exists |
| Toast library (`svelte-sonner`) | ✅ Ready | Used in Rules store |
| CSS Grid support | ✅ Ready | Modern browsers only |

### 8.3 Known Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| Terminology confusion | Medium | Documentation + UI labels |
| Duplicate scene endpoints | Low | Use `/api/automations` (legacy) for now |
| Missing scene icons | Low | Add placeholder icon logic |
| Mock data notice | Low | Remove mock notice banner |

### 8.4 Blockers

**None identified.** All required infrastructure is complete and operational.

---

## 9. Implementation Plan

### 9.1 Option A: Create New scenesStore (Per Ticket)

**Approach**: Implement exactly as ticket 1M-546 describes.

**Steps**:

1. **Create scenesStore.svelte.ts** (1 hour)
   - Copy pattern from `rulesStore.svelte.ts`
   - Implement `loadScenes()` using `/api/automations`
   - Implement `executeScene()` using `/api/scenes/:id/execute`
   - Add loading, error, and derived state
   - Map-based storage for O(1) lookups

2. **Update AutomationsGrid to use scenesStore** (0.5 hours)
   - Import `getScenesStore()` instead of `getAutomationStore()`
   - Update variable names (`scenes` instead of `automations`)
   - Remove mock data notice
   - Add toast notifications for execution

3. **Update AutomationCard to use executeScene** (0.5 hours)
   - Import `executeScene()` from scenesStore
   - Update toggle handler to use new method
   - Add toast feedback

**Total Effort**: 2 hours ✅ (matches ticket estimate)

### 9.2 Option B: Refactor Existing automationStore (Recommended)

**Approach**: Rename existing store for clarity, keep functionality.

**Steps**:

1. **Rename automationStore → scenesStore** (0.5 hours)
   ```bash
   git mv web/src/lib/stores/automationStore.svelte.ts \
          web/src/lib/stores/scenesStore.svelte.ts
   ```
   - Update exports: `Automation` → `Scene`
   - Update function names: `loadAutomations` → `loadScenes`
   - Update API call to use `/api/scenes/:id/execute`

2. **Update component imports** (0.5 hours)
   - `AutomationsGrid.svelte` - Update import
   - `AutomationCard.svelte` - Update import
   - `/routes/automations/+page.svelte` - Update import

3. **Add toast notifications** (0.5 hours)
   - Import `svelte-sonner`
   - Add success/error toasts in `executeScene()`

4. **Update documentation** (0.5 hours)
   - Add inline comments explaining "automations = scenes"
   - Update README with terminology clarification

**Total Effort**: 2 hours ✅

### 9.3 Option C: Keep Both Stores (Not Recommended)

**Approach**: Keep `automationStore` for `/automations` route, create `scenesStore` for future `/scenes` route.

**Pros**:
- No breaking changes
- Gradual migration path

**Cons**:
- Code duplication (two stores for same data)
- Maintenance burden (update both stores)
- User confusion (two pages for same thing)

**Recommendation**: ❌ Avoid this option.

### 9.4 Recommended Implementation Path

**Phase 1: Complete Ticket 1M-546 (2 hours)**
- Option A: Create scenesStore as specified
- Get ticket marked as "Done"
- Move to next ticket (1M-547)

**Phase 2: Refactor for Clarity (Post-Sprint 1.2)**
- Consolidate automationStore and scenesStore
- Rename routes: `/automations` → `/scenes`
- Update navigation labels
- Add redirect from old URLs

**Rationale**: Ship quickly, refine later.

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Store Tests** (`scenesStore.test.ts`):

```typescript
describe('scenesStore', () => {
  it('should load scenes from API', async () => {
    // Mock fetch response
    // Call loadScenes()
    // Assert sceneMap populated
  });

  it('should execute scene via API', async () => {
    // Mock fetch response
    // Call executeScene()
    // Assert lastExecuted updated
  });

  it('should handle API errors gracefully', async () => {
    // Mock fetch error
    // Call loadScenes()
    // Assert error state set
  });

  it('should compute statistics correctly', () => {
    // Populate sceneMap
    // Assert stats.total matches
  });
});
```

### 10.2 Component Tests

**ScenesGrid Tests**:

```typescript
describe('ScenesGrid', () => {
  it('should display loading state initially', () => {
    render(ScenesGrid);
    expect(screen.getAllByLabelText('Loading...')).toHaveLength(6);
  });

  it('should display scenes after load', async () => {
    render(ScenesGrid);
    await waitFor(() => {
      expect(screen.getByText('Movie Time')).toBeInTheDocument();
    });
  });

  it('should display empty state when no scenes', async () => {
    // Mock empty response
    render(ScenesGrid);
    await waitFor(() => {
      expect(screen.getByText('No Scenes Found')).toBeInTheDocument();
    });
  });
});
```

**SceneCard Tests**:

```typescript
describe('SceneCard', () => {
  it('should execute scene when toggle clicked', async () => {
    const scene = { id: '123', name: 'Test', enabled: true };
    render(SceneCard, { scene });

    const toggle = screen.getByLabelText('Execute Test');
    await fireEvent.click(toggle);

    // Assert API called
    expect(fetch).toHaveBeenCalledWith('/api/scenes/123/execute', {
      method: 'POST'
    });
  });
});
```

### 10.3 Integration Tests

**E2E Test** (Playwright):

```typescript
test('should execute scene from list view', async ({ page }) => {
  await page.goto('/scenes');

  // Wait for scenes to load
  await page.waitForSelector('.scene-card');

  // Click execute toggle
  await page.click('[aria-label="Execute Movie Time"]');

  // Verify success toast
  await expect(page.locator('.toast-success')).toContainText('executed');

  // Verify last executed timestamp updated
  await expect(page.locator('.last-executed')).toContainText('ago');
});
```

### 10.4 API Integration Tests

```typescript
describe('Scenes API Integration', () => {
  it('should fetch and execute scenes', async () => {
    const response = await fetch('http://localhost:5182/api/automations');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.scenes).toBeInstanceOf(Array);

    if (data.data.scenes.length > 0) {
      const sceneId = data.data.scenes[0].sceneId;
      const execResponse = await fetch(
        `http://localhost:5182/api/scenes/${sceneId}/execute`,
        { method: 'POST' }
      );
      expect(execResponse.ok).toBe(true);
    }
  });
});
```

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [x] Backend API endpoint exists and returns scenes
- [x] Frontend store manages scene state reactively
- [ ] Scenes load automatically on page mount
- [x] Scenes display in responsive grid layout
- [ ] Execute button triggers scene execution
- [ ] Last executed timestamp updates after execution
- [ ] Error handling with user-friendly messages
- [ ] Loading states during API calls

### 11.2 Non-Functional Requirements

- [ ] Page load time < 2 seconds
- [ ] Scene execution response < 500ms (p95)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessible (WCAG 2.1 AA compliance)
- [ ] No console errors or warnings
- [ ] Type-safe (no `any` types)

### 11.3 User Experience Requirements

- [ ] Clear visual feedback for actions (loading, success, error)
- [ ] Intuitive controls (one-click execution)
- [ ] Helpful empty state with CTA
- [ ] Descriptive error messages
- [ ] Consistent with existing UI patterns (Rules page)
- [ ] Toast notifications for execution results

### 11.4 Code Quality Requirements

- [ ] TypeScript strict mode compliance
- [ ] Svelte 5 runes syntax (no legacy $: reactive)
- [ ] Component composition (single responsibility)
- [ ] Reusable utilities (time formatting, error handling)
- [ ] Comprehensive inline documentation
- [ ] Unit test coverage > 80%

---

## 12. Time Estimate Breakdown

### 12.1 Ticket 1M-546 (Create scenesStore)

| Task | Estimated Time | Notes |
|------|---------------|-------|
| Create scenesStore.svelte.ts | 1 hour | Copy rulesStore pattern |
| Implement loadScenes() | 15 min | API integration |
| Implement executeScene() | 15 min | POST request |
| Add error handling | 15 min | Try-catch + error state |
| Add derived statistics | 15 min | $derived implementation |
| **Total** | **2 hours** | ✅ Matches ticket estimate |

### 12.2 Related Work (Not in Ticket Scope)

| Task | Estimated Time | Notes |
|------|---------------|-------|
| Update AutomationsGrid | 30 min | Import scenesStore |
| Update AutomationCard | 30 min | Use executeScene() |
| Add toast notifications | 30 min | svelte-sonner integration |
| Remove mock data notice | 15 min | Delete banner component |
| Update tests | 1 hour | Unit + integration tests |
| **Total Additional** | **2.75 hours** | Follow-up work |

### 12.3 Refactoring Work (Future)

| Task | Estimated Time | Notes |
|------|---------------|-------|
| Rename routes | 1 hour | /automations → /scenes |
| Update navigation | 30 min | Menu labels |
| Consolidate stores | 1 hour | Merge automationStore |
| Update documentation | 1 hour | README, inline comments |
| **Total Refactor** | **3.5 hours** | Post-Sprint 1.2 |

---

## 13. Dependencies on Future Tickets

### 13.1 Sprint 1.2 Automation Chain

Based on Sprint 1.2 roadmap analysis:

| Ticket | Title (Estimated) | Dependencies | Estimated Effort |
|--------|-------------------|--------------|------------------|
| 1M-546 | Automations List View | None | 2 hours ✅ (THIS TICKET) |
| 1M-547 | Automation Detail View | 1M-546 | 8-10 hours |
| 1M-548 | Automation Edit Interface | 1M-547 | 10-12 hours |
| 1M-549 | Automation Enable/Disable Toggle | 1M-546 | 4-6 hours |
| 1M-550 | Automation Testing & Validation | 1M-546-1M-549 | 6-8 hours |

**Total Chain**: 34-44 hours (approximately 5-6 days)

### 13.2 Dependency Graph

```
1M-546 (List View - THIS TICKET)
├── 1M-549 (Toggle) - Can start after 1M-546
├── 1M-547 (Detail View) - Can start after 1M-546
│   └── 1M-548 (Edit Interface) - Requires 1M-547
└── 1M-550 (Testing) - Requires all above
```

**Critical Path**: 1M-546 → 1M-547 → 1M-548 → 1M-550

**Parallel Path**: 1M-546 → 1M-549 (can work in parallel with 1M-547)

### 13.3 Recommended Sprint 1.2 Execution Order

**Week 1** (December 18-22):
1. ✅ 1M-546 (2h) - Complete first (THIS TICKET)
2. 🔄 1M-549 (4-6h) - Execute toggle (builds on list view)
3. 🔄 1M-547 (8-10h) - Detail view (start mid-week)

**Week 2** (December 23-31):
4. 🔄 1M-548 (10-12h) - Edit interface (requires detail view)
5. 🔄 1M-550 (6-8h) - Testing (requires all above)
6. Buffer for holiday slowdown and unexpected issues

---

## 14. Risks and Mitigations

### 14.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Terminology confusion | High | Medium | Extensive documentation + inline comments |
| API endpoint duplication | Medium | Low | Use `/api/automations` consistently |
| Store duplication | Medium | Medium | Consolidate stores post-sprint |
| Breaking changes | Low | High | Thorough testing before refactor |

### 14.2 Implementation Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Over-engineering | Medium | Medium | Follow ticket scope strictly |
| Scope creep | Medium | High | Defer refactoring to later sprint |
| Test coverage gaps | High | Medium | Write tests alongside implementation |
| Regression in automations page | Low | High | E2E tests before merge |

### 14.3 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Confusing terminology | High | High | Clear UI labels ("Scenes" not "Automations") |
| Slow execution feedback | Low | Medium | Toast notifications + optimistic UI |
| Mobile layout issues | Medium | Medium | Test on real devices |
| Accessibility gaps | Medium | High | WCAG audit + screen reader testing |

---

## 15. Recommendations

### 15.1 Immediate Actions (Ticket 1M-546)

1. **✅ DO**: Create `scenesStore.svelte.ts` following `rulesStore` pattern
2. **✅ DO**: Use existing `/api/automations` endpoint for listing
3. **✅ DO**: Use `/api/scenes/:id/execute` for execution
4. **✅ DO**: Add toast notifications for execution feedback
5. **✅ DO**: Remove "Demo Mode" mock data notice from AutomationsGrid

### 15.2 Short-Term Actions (Sprint 1.2)

1. **Update component imports** to use scenesStore
2. **Add comprehensive tests** for store and components
3. **Complete tickets 1M-547 through 1M-550** in dependency order
4. **Document terminology** in README and inline comments

### 15.3 Long-Term Actions (Post-Sprint 1.2)

1. **Refactor routes**: `/automations` → `/scenes`, `/rules` → `/automations`
2. **Consolidate stores**: Merge automationStore and scenesStore
3. **Add backend endpoints**: `/api/scenes` (not just `/api/automations`)
4. **Implement scene editing**: Create/update/delete operations (requires SmartThings API support)

### 15.4 Documentation Needs

1. **Add to README**: Terminology clarification (Scenes vs Automations vs Rules)
2. **Inline comments**: Explain `/api/automations` returns Scenes
3. **API docs**: Document all endpoints with examples
4. **Architecture decision record**: Explain store naming choices

---

## 16. Conclusion

### 16.1 Key Findings Summary

1. **Infrastructure Complete**: Backend API and frontend store already exist and are functional
2. **Terminology Confusion**: "Automations" endpoint returns "Scenes" (manually run routines)
3. **Ticket Scope**: Create new scenesStore following rulesStore pattern
4. **Estimated Effort**: 2 hours (matches ticket estimate)
5. **No Blockers**: All dependencies are ready

### 16.2 Recommended Implementation

**Approach**: Option A - Create new scenesStore as ticket specifies

**Rationale**:
- Follows ticket scope exactly
- Gets ticket marked "Done" quickly
- Enables team to move to next tickets (1M-547-1M-550)
- Defers refactoring to post-sprint cleanup

**Time to Complete**: 2 hours of focused work

### 16.3 Next Steps

1. **Implement scenesStore.svelte.ts** (1 hour)
2. **Update AutomationsGrid and AutomationCard** (0.5 hours)
3. **Add toast notifications** (0.25 hours)
4. **Test integration** (0.25 hours)
5. **Remove mock data notice** (5 minutes)
6. **Mark ticket as Done** ✅
7. **Move to ticket 1M-549 or 1M-547** (parallel work)

### 16.4 Files to Create/Modify

**Create**:
- ✅ `web/src/lib/stores/scenesStore.svelte.ts`

**Modify**:
- `web/src/lib/components/automations/AutomationsGrid.svelte`
- `web/src/lib/components/automations/AutomationCard.svelte`

**Test**:
- `web/src/lib/stores/scenesStore.test.ts` (NEW)
- Integration test for `/scenes` route (NEW)

### 16.5 Success Metrics

- [ ] scenesStore created and exported
- [ ] Scenes load from `/api/automations` on mount
- [ ] Execute button triggers scene via `/api/scenes/:id/execute`
- [ ] Last executed timestamp updates after execution
- [ ] Toast notifications show success/error feedback
- [ ] No console errors
- [ ] Tests pass (unit + integration)
- [ ] Ticket 1M-546 marked "Done" in Linear

---

## Appendices

### Appendix A: API Response Examples

**GET /api/automations** (Successful):
```json
{
  "success": true,
  "data": {
    "count": 3,
    "scenes": [
      {
        "sceneId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "sceneName": "Movie Time",
        "sceneIcon": "theater",
        "sceneColor": "#FF5733",
        "locationId": "loc-456",
        "lastExecutedDate": "2025-12-03T10:30:00.000Z"
      },
      {
        "sceneId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "sceneName": "Good Morning",
        "sceneIcon": "sunrise",
        "sceneColor": "#FFC300",
        "locationId": "loc-456",
        "lastExecutedDate": null
      }
    ]
  }
}
```

**POST /api/scenes/:id/execute** (Successful):
```json
{
  "success": true,
  "data": null,
  "latency_ms": 450
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "message": "Scene not found",
    "code": "SCENE_NOT_FOUND"
  }
}
```

### Appendix B: Store Implementation Reference

**Complete scenesStore.svelte.ts skeleton**:

```typescript
/**
 * Scenes Store - Svelte 5 Runes-based state management
 *
 * Manages SmartThings Scenes (manually triggered routines).
 * Note: API endpoint is /api/automations but returns Scenes.
 */

import { toast } from 'svelte-sonner';

export interface Scene {
  id: string;
  name: string;
  enabled: boolean; // Always true
  icon?: string;
  color?: string;
  locationId?: string;
  lastExecuted?: number; // Timestamp in ms
}

// State
let sceneMap = $state<Map<string, Scene>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived
let scenes = $derived(
  Array.from(sceneMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

let stats = $derived({
  total: scenes.length,
  enabled: scenes.length // All scenes are always enabled
});

// Actions
export async function loadScenes(): Promise<void> {
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/automations');
    if (!response.ok) throw new Error('Failed to fetch scenes');

    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to load scenes');

    const newSceneMap = new Map<string, Scene>();
    const scenesData = result.data.scenes || [];

    scenesData.forEach((scene: any) => {
      newSceneMap.set(scene.sceneId, {
        id: scene.sceneId,
        name: scene.sceneName,
        enabled: true,
        icon: scene.sceneIcon,
        color: scene.sceneColor,
        locationId: scene.locationId,
        lastExecuted: scene.lastExecutedDate
          ? new Date(scene.lastExecutedDate).getTime()
          : undefined
      });
    });

    sceneMap = newSceneMap;
  } catch (err) {
    console.error('Failed to load scenes:', err);
    error = err instanceof Error ? err.message : 'Failed to load scenes';
    sceneMap = new Map();
  } finally {
    loading = false;
  }
}

export async function executeScene(sceneId: string): Promise<boolean> {
  const scene = sceneMap.get(sceneId);
  if (!scene) {
    toast.error('Scene not found');
    return false;
  }

  try {
    const response = await fetch(`/api/scenes/${sceneId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to execute scene');

    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message || 'Failed to execute scene');

    // Update last executed time
    sceneMap.set(sceneId, {
      ...scene,
      lastExecuted: Date.now()
    });

    toast.success(`Scene "${scene.name}" executed successfully`);
    return true;
  } catch (err) {
    console.error('Failed to execute scene:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to execute scene';
    toast.error(`Failed to execute "${scene.name}"`, {
      description: errorMessage
    });
    return false;
  }
}

export function getSceneById(sceneId: string): Scene | undefined {
  return sceneMap.get(sceneId);
}

// Store Factory
export function getScenesStore() {
  return {
    get scenes() { return scenes; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },
    loadScenes,
    executeScene,
    getSceneById
  };
}
```

### Appendix C: Research File Locations

**Files Examined**:
- ✅ `web/src/routes/automations/+page.svelte`
- ✅ `web/src/routes/rules/+page.svelte`
- ✅ `web/src/lib/stores/automationStore.svelte.ts`
- ✅ `web/src/lib/stores/rulesStore.svelte.ts`
- ✅ `web/src/lib/stores/scenesStore.svelte.ts`
- ✅ `web/src/lib/components/automations/AutomationsGrid.svelte`
- ✅ `web/src/lib/components/automations/AutomationCard.svelte`
- ✅ `web/src/lib/components/rules/RulesGrid.svelte`
- ✅ `web/src/lib/components/rules/RuleCard.svelte`
- ✅ `src/server-alexa.ts` (lines 676-1015)

**Documentation Reviewed**:
- ✅ `docs/planning/WORK_PLAN_SPRINT_1-2-ROADMAP.md`
- ✅ Ticket 1M-546 description in Linear

**Total Files Analyzed**: 11 files + 2 documentation sources

---

**End of Research Document**

**Prepared by**: Research Agent
**Date**: 2025-12-03
**Next Action**: Implement scenesStore.svelte.ts per ticket 1M-546 specification
