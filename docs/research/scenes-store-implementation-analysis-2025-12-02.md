# Scenes Store Implementation Analysis

**Date:** 2025-12-02
**Researcher:** Claude (Research Agent)
**Focus:** scenesStore.svelte.ts implementation requirements

---

## Executive Summary

Analysis of existing store patterns and backend infrastructure reveals a clear implementation path for `scenesStore.svelte.ts`. The store should follow the established Svelte 5 runes pattern with Map-based state management, integrate with existing `/api/automations` endpoints, and mirror the structure of `automationStore.svelte.ts` (which currently handles scenes but is semantically misnamed).

**Key Finding:** The backend already implements complete scenes functionality under `/api/automations` endpoints. The new `scenesStore` should replace the misnamed `automationStore` with proper naming that reflects actual SmartThings terminology (Scenes = "Manually run routines").

---

## 1. Existing Store Patterns Analysis

### Common Svelte 5 Runes Patterns

All stores (`deviceStore`, `automationStore`, `rulesStore`, `roomStore`) follow consistent patterns:

#### **State Management with $state rune**

```typescript
// Map-based storage for O(1) lookups
let sceneMap = $state<Map<string, Scene>>(new Map());

// Loading and error state
let loading = $state(true);
let error = $state<string | null>(null);
```

**Design Rationale:** Map-based storage provides O(1) lookups by ID while maintaining Svelte 5's fine-grained reactivity. Entire map replacement triggers reactivity without deep tracking overhead.

#### **Derived State with $derived rune**

```typescript
// Convert map to sorted array
let scenes = $derived(
  Array.from(sceneMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

// Computed statistics
let stats = $derived({
  total: scenes.length,
  enabled: scenes.filter((s) => s.enabled).length,
  disabled: scenes.filter((s) => !s.enabled).length
});
```

**Design Rationale:** `$derived` provides automatic memoization with dependency tracking. Recomputes only when dependencies change, preventing unnecessary recalculations.

#### **Read-Only Getters Export Pattern**

All stores export a factory function that returns an object with read-only getters:

```typescript
export function getSceneStore() {
  return {
    // State (read-only getters for reactivity)
    get scenes() { return scenes; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },

    // Actions
    loadScenes,
    executeScene,
    getSceneById
  };
}
```

**Design Rationale:** Getters ensure consumers access the latest reactive state without directly exposing mutable state variables. Prevents external mutations that could break reactivity.

### Error Handling Patterns

Consistent error handling across all stores:

```typescript
export async function loadScenes(): Promise<void> {
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/automations');
    const result: ScenesResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load scenes');
    }

    // Transform and update state
    const newSceneMap = new Map<string, Scene>();
    result.data.scenes.forEach((scene: any) => {
      newSceneMap.set(scene.sceneId, transformScene(scene));
    });

    sceneMap = newSceneMap;
  } catch (err) {
    console.error('Failed to load scenes:', err);
    error = err instanceof Error ? err.message : 'Failed to load scenes';
    sceneMap = new Map(); // Clear on error
  } finally {
    loading = false;
  }
}
```

**Error Handling Strategy:**
- Always set `loading = true` at start, `false` in finally block
- Clear error state before operation: `error = null`
- Clear data on error to prevent stale state
- Transform API errors to user-friendly messages
- Log errors to console for debugging

### State Update Patterns

**Immutable Updates for Reactivity:**

```typescript
// ❌ Wrong: Mutates existing object (breaks reactivity)
sceneMap.get(sceneId).lastExecuted = Date.now();

// ✅ Correct: Creates new object (triggers reactivity)
const scene = sceneMap.get(sceneId);
if (scene) {
  sceneMap.set(sceneId, {
    ...scene,
    lastExecuted: Date.now()
  });
}
```

**Design Rationale:** Svelte 5 runes track state at the container level (Map reference), not deep object properties. Map mutation methods (`set`, `delete`) trigger reactivity, but object property mutations do not.

---

## 2. Scenes API Integration

### Backend Implementation Status

**Fully Implemented:** Backend scenes functionality is complete and production-ready.

#### Available Endpoints

| Endpoint | Method | Purpose | Response Type |
|----------|--------|---------|---------------|
| `/api/automations` | GET | List all scenes | `DirectResult<SceneInfo[]>` |
| `/api/automations/:id/execute` | POST | Execute scene | `DirectResult<void>` |

**API Location:** `/Users/masa/Projects/mcp-smartthings/src/server-alexa.ts` (lines 556-648)

#### Scene API Response Structure

**GET /api/automations Response:**

```typescript
{
  success: boolean;
  data: {
    count: number;
    scenes: SceneInfo[];  // Array of scene objects
  };
  error?: {
    code: string;
    message: string;
  };
}
```

**POST /api/automations/:id/execute Response:**

```typescript
{
  success: boolean;
  data?: void;
  error?: {
    code: string;
    message: string;
  };
}
```

### Backend Scene Type Definition

**File:** `/Users/masa/Projects/mcp-smartthings/src/types/smartthings.ts` (line 163)

```typescript
export interface SceneInfo {
  sceneId: SceneId;           // UUID branded type
  sceneName: string;
  sceneIcon?: string;
  sceneColor?: string;
  locationId?: LocationId;
  createdBy?: string;
  createdDate?: Date;
  lastUpdatedDate?: Date;
  lastExecutedDate?: Date;    // Timestamp of last execution
  editable?: boolean;
}

export type SceneId = string & { readonly __brand: 'SceneId' };
```

### Scene Service Implementation

**File:** `/Users/masa/Projects/mcp-smartthings/src/services/SceneService.ts`

The backend provides a full-featured SceneService with error handling:

```typescript
class SceneService implements ISceneService {
  async listScenes(locationId?: LocationId): Promise<SceneInfo[]>
  async executeScene(sceneId: SceneId): Promise<void>
  async findSceneByName(sceneName: string): Promise<SceneInfo>
}
```

**Design Features:**
- Error transformation with context (service, operation, parameters)
- Structured logging with operation parameters
- Integration with retry policies via ServiceContainer
- Network error handling with automatic retries

### Direct Tool Executor Integration

**File:** `/Users/masa/Projects/mcp-smartthings/src/direct/ToolExecutor.ts` (lines 299-328)

```typescript
class ToolExecutor {
  async executeScene(sceneId: SceneId): Promise<DirectResult<void>>
  async listScenes(params?: { locationId?: LocationId }): Promise<DirectResult<any>>
  async listScenesByRoom(roomName: string): Promise<DirectResult<any>>
}
```

**Performance Characteristics:**
- List scenes: O(n) where n = scene count (~100ms)
- Execute scene: O(1) (~200-500ms including API latency)

---

## 3. Required Dependencies and Types

### Frontend Type Definitions

**Create:** `/Users/masa/Projects/mcp-smartthings/web/src/lib/types/scene.ts`

```typescript
/**
 * Frontend scene type matching backend SceneInfo structure
 */
export interface Scene {
  id: string;              // Maps to sceneId (normalized for frontend consistency)
  name: string;            // Maps to sceneName
  enabled: boolean;        // Always true for scenes (manually triggered)
  icon?: string;           // Maps to sceneIcon
  color?: string;          // Maps to sceneColor
  locationId?: string;
  lastExecuted?: number;   // Timestamp in milliseconds (converted from Date)
  editable?: boolean;
}

/**
 * API response structure for scenes list
 */
export interface ScenesResponse {
  success: boolean;
  data: {
    count: number;
    scenes: any[];         // Backend SceneInfo objects (transformed in store)
  };
  error?: {
    code?: string;
    message: string;
  };
}

/**
 * API response structure for scene execution
 */
export interface SceneExecuteResponse {
  success: boolean;
  data?: {
    sceneId: string;
    sceneName: string;
    executed: boolean;
  };
  error?: {
    code?: string;
    message: string;
  };
}
```

### Required Imports for scenesStore.svelte.ts

```typescript
// No API client method needed - use fetch directly (consistent with automationStore)
// Types can be defined inline or imported from separate types file
```

**Design Decision:** Direct `fetch` calls instead of `apiClient` methods

**Rationale:** Existing `automationStore` and `rulesStore` use direct `fetch` instead of `apiClient`. This provides:
- Consistent pattern across automation-related stores
- Simpler implementation without API client updates
- Direct control over request/response handling
- Easier to add custom headers or parameters later

**Note:** `deviceStore` uses `apiClient` because it has more complex operations (filters, SSE integration). Scenes are simpler CRUD operations.

---

## 4. Implementation Approach

### Store Structure (Properties)

```typescript
/**
 * File: /Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.svelte.ts
 */

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Scene map for O(1) lookups
 */
let sceneMap = $state<Map<string, Scene>>(new Map());

/**
 * Loading and error state
 */
let loading = $state(true);
let error = $state<string | null>(null);

// ============================================================================
// DERIVED STATE
// ============================================================================

/**
 * Convert scene map to array, sorted by name
 */
let scenes = $derived(
  Array.from(sceneMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

/**
 * Scene statistics
 * Note: Scenes are always "enabled" (manually triggered), so enabled count = total
 */
let stats = $derived({
  total: scenes.length,
  enabled: scenes.length,        // All scenes are "enabled" by definition
  disabled: 0,                   // Scenes cannot be disabled
  recentlyExecuted: scenes.filter(s => {
    if (!s.lastExecuted) return false;
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return s.lastExecuted > hourAgo;
  }).length
});
```

### Store Methods

#### loadScenes(): Promise<void>

```typescript
/**
 * Load scenes from API
 *
 * Design Decision: Direct SmartThings Scenes API integration
 * Rationale: Backend scene endpoints are implemented at /api/automations,
 * providing real-time access to SmartThings Scenes (manually run routines).
 */
export async function loadScenes(): Promise<void> {
  loading = true;
  error = null;

  try {
    const response = await fetch('/api/automations');

    if (!response.ok) {
      throw new Error(`Failed to fetch scenes: ${response.statusText}`);
    }

    const result: ScenesResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load scenes');
    }

    // Transform SmartThings Scenes to frontend Scene format
    const newSceneMap = new Map<string, Scene>();

    // Extract scenes array from nested response structure
    // API returns: { success: true, data: { count: N, scenes: [...] } }
    const scenesData = result.data;
    const scenesArray = scenesData.scenes || [];

    scenesArray.forEach((scene: any) => {
      const sceneObj: Scene = {
        id: scene.sceneId,
        name: scene.sceneName,
        enabled: true,           // Scenes are always "enabled" (manually triggered)
        icon: scene.sceneIcon,
        color: scene.sceneColor,
        locationId: scene.locationId,
        lastExecuted: scene.lastExecutedDate
          ? new Date(scene.lastExecutedDate).getTime()
          : undefined,
        editable: scene.editable
      };
      newSceneMap.set(sceneObj.id, sceneObj);
    });

    sceneMap = newSceneMap;
  } catch (err) {
    console.error('Failed to load scenes:', err);
    error = err instanceof Error ? err.message : 'Failed to load scenes';
    sceneMap = new Map(); // Clear scenes on error
  } finally {
    loading = false;
  }
}
```

#### executeScene(sceneId: string): Promise<boolean>

```typescript
/**
 * Execute a scene (trigger scene execution)
 *
 * Note: This is the primary action for scenes - they cannot be "toggled" enabled/disabled.
 * Scenes are always manually triggered, unlike rules which run automatically.
 */
export async function executeScene(sceneId: string): Promise<boolean> {
  const scene = sceneMap.get(sceneId);
  if (!scene) {
    console.error('Scene not found:', sceneId);
    return false;
  }

  try {
    const response = await fetch(`/api/automations/${sceneId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to execute scene: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to execute scene');
    }

    // Update last executed time
    sceneMap.set(sceneId, {
      ...scene,
      lastExecuted: Date.now()
    });

    return true;
  } catch (err) {
    console.error('Failed to execute scene:', err);
    error = err instanceof Error ? err.message : 'Failed to execute scene';
    return false;
  }
}
```

#### getSceneById(sceneId: string): Scene | undefined

```typescript
/**
 * Get scene by ID
 */
export function getSceneById(sceneId: string): Scene | undefined {
  return sceneMap.get(sceneId);
}
```

#### clearError(): void

```typescript
/**
 * Clear error state
 * Useful for dismissing error notifications after user acknowledgment
 */
export function clearError(): void {
  error = null;
}
```

### Export Pattern

```typescript
/**
 * Get scenes store with reactive state and actions
 */
export function getScenesStore() {
  return {
    // State (read-only getters)
    get scenes() {
      return scenes;
    },
    get stats() {
      return stats;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },

    // Actions
    loadScenes,
    executeScene,
    getSceneById,
    clearError
  };
}
```

---

## 5. Scene Execution Flow

### User Interaction Flow

```
User clicks "Execute" button on scene card
    ↓
Component calls: store.executeScene(sceneId)
    ↓
scenesStore: POST /api/automations/:id/execute
    ↓
Backend server-alexa.ts endpoint handler
    ↓
ToolExecutor.executeScene(sceneId)
    ↓
MCP Scene Tool: handleExecuteScene
    ↓
SceneService.executeScene(sceneId)
    ↓
SmartThingsService (singleton)
    ↓
SmartThings API: POST /scenes/:sceneId/execute
    ↓
Scene executes on devices
    ↓
Backend returns success response
    ↓
scenesStore updates lastExecuted timestamp
    ↓
UI shows success feedback
```

**Latency Profile:**
- Frontend → Backend: ~10-20ms (local network)
- Backend → SmartThings API: ~200-500ms (API latency)
- SmartThings → Device execution: ~100-300ms (depends on device type)
- **Total:** ~300-800ms for scene execution

### Error Handling Flow

```
Error occurs at any layer
    ↓
Error propagated up the stack
    ↓
scenesStore catches error
    ↓
Set error state: error = err.message
    ↓
Return false from executeScene()
    ↓
Component shows error notification
    ↓
User can retry or dismiss error
```

---

## 6. Loading/Success/Error State Management

### State Transitions

```
Initial State: { loading: true, error: null, scenes: [] }
    ↓
loadScenes() called
    ↓
loading = true, error = null
    ↓
API request sent
    ↓
┌──────────────────────────────────┐
│  Success Path                    │  Error Path
├──────────────────────────────────┼──────────────────────────────
│  Response OK                     │  Response failed / Network error
│  sceneMap = new Map(scenes)      │  error = err.message
│  loading = false                 │  sceneMap = new Map() (clear data)
│  error = null                    │  loading = false
└──────────────────────────────────┴──────────────────────────────

Final States:
- Success: { loading: false, error: null, scenes: SceneInfo[] }
- Error:   { loading: false, error: "Error message", scenes: [] }
```

### Component Usage Pattern

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getScenesStore } from '$lib/stores/scenesStore.svelte';

  const store = getScenesStore();

  onMount(() => {
    store.loadScenes();
  });

  async function handleExecute(sceneId: string) {
    const success = await store.executeScene(sceneId);
    if (success) {
      // Show success toast
    }
    // Error state is automatically managed by store
  }
</script>

{#if store.loading}
  <LoadingSpinner />
{:else if store.error}
  <ErrorAlert message={store.error} onDismiss={store.clearError} />
{:else}
  <div class="scenes-grid">
    {#each store.scenes as scene}
      <SceneCard
        {scene}
        onExecute={() => handleExecute(scene.id)}
      />
    {/each}
  </div>

  <div class="stats">
    Total Scenes: {store.stats.total}
    Recently Executed: {store.stats.recentlyExecuted}
  </div>
{/if}
```

---

## 7. Migration from automationStore

### Current State

**Problem:** The existing `automationStore.svelte.ts` is semantically incorrect:
- Named "automations" but actually manages "scenes"
- Scenes are NOT automations in SmartThings terminology
- Confusing naming leads to developer confusion

**SmartThings Terminology:**
- **Scenes:** Manually triggered routines (what automationStore currently handles)
- **Rules:** Automated IF/THEN logic (handled by rulesStore)
- **Automations:** Generic term that includes both scenes and rules

### Recommended Migration Path

#### Phase 1: Create New scenesStore (Immediate)

1. **Create** `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.svelte.ts`
2. **Copy** implementation from `automationStore.svelte.ts`
3. **Rename** all references: Automation → Scene
4. **Update** components to use `getScenesStore()` instead of `getAutomationStore()`

#### Phase 2: Deprecate automationStore (Next Sprint)

1. **Add deprecation notice** to `automationStore.svelte.ts`:
```typescript
/**
 * @deprecated Use scenesStore.svelte.ts instead
 * This store was renamed to reflect correct SmartThings terminology.
 * Scenes are "Manually run routines", not automations.
 */
```

2. **Update** all components importing `automationStore` to use `scenesStore`
3. **Update** route `/automations` to `/scenes` (with redirect)

#### Phase 3: Remove automationStore (Cleanup)

1. **Delete** `automationStore.svelte.ts`
2. **Delete** `/web/src/lib/components/automations/` directory
3. **Delete** `/web/src/routes/automations/` directory
4. **Update** documentation to reflect terminology changes

### File Mapping

| Current (Wrong) | New (Correct) | Status |
|----------------|---------------|---------|
| `automationStore.svelte.ts` | `scenesStore.svelte.ts` | 🆕 Create |
| `web/src/lib/components/automations/` | `web/src/lib/components/scenes/` | 🔄 Rename |
| `web/src/routes/automations/` | `web/src/routes/scenes/` | 🔄 Rename |
| `/api/automations` | `/api/scenes` | ⚠️ Backend breaking change (Phase 2) |

**Design Decision:** Keep `/api/automations` endpoints unchanged initially

**Rationale:**
- Avoids breaking changes to existing integrations
- Frontend can migrate independently
- Backend endpoint rename can happen in Phase 2 with proper versioning
- Provides time for external clients to migrate

---

## 8. Additional Recommendations

### 1. Add Scene Filtering Support

**Enhancement:** Filter scenes by location, room, or search query

```typescript
// Add to state
let searchQuery = $state('');
let selectedLocationId = $state<string | null>(null);

// Add to derived state
let filteredScenes = $derived.by(() => {
  let result = scenes;

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(query)
    );
  }

  if (selectedLocationId) {
    result = result.filter(s => s.locationId === selectedLocationId);
  }

  return result;
});

// Add filter actions
export function setSearchQuery(query: string): void {
  searchQuery = query;
}

export function setSelectedLocation(locationId: string | null): void {
  selectedLocationId = locationId;
}

export function clearFilters(): void {
  searchQuery = '';
  selectedLocationId = null;
}
```

### 2. Add Scene Favorite/Recent Support

**Enhancement:** Track favorite scenes and most recently executed scenes

```typescript
// Add to state
let favoriteSceneIds = $state<Set<string>>(new Set());

// Load from localStorage
onMount(() => {
  const stored = localStorage.getItem('favorite-scenes');
  if (stored) {
    favoriteSceneIds = new Set(JSON.parse(stored));
  }
});

// Add to derived state
let favoriteScenes = $derived(
  scenes.filter(s => favoriteSceneIds.has(s.id))
);

let recentScenes = $derived(
  scenes
    .filter(s => s.lastExecuted)
    .sort((a, b) => (b.lastExecuted || 0) - (a.lastExecuted || 0))
    .slice(0, 5)
);

// Add favorite actions
export function toggleFavorite(sceneId: string): void {
  const newFavorites = new Set(favoriteSceneIds);
  if (newFavorites.has(sceneId)) {
    newFavorites.delete(sceneId);
  } else {
    newFavorites.add(sceneId);
  }
  favoriteSceneIds = newFavorites;

  // Persist to localStorage
  localStorage.setItem('favorite-scenes', JSON.stringify([...newFavorites]));
}
```

### 3. Add Optimistic Updates

**Enhancement:** Update UI immediately, rollback on error

```typescript
export async function executeScene(sceneId: string): Promise<boolean> {
  const scene = sceneMap.get(sceneId);
  if (!scene) return false;

  // Optimistic update: Update UI immediately
  const previousLastExecuted = scene.lastExecuted;
  sceneMap.set(sceneId, {
    ...scene,
    lastExecuted: Date.now()
  });

  try {
    const response = await fetch(`/api/automations/${sceneId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to execute scene: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to execute scene');
    }

    return true;
  } catch (err) {
    console.error('Failed to execute scene:', err);
    error = err instanceof Error ? err.message : 'Failed to execute scene';

    // Rollback optimistic update
    sceneMap.set(sceneId, {
      ...scene,
      lastExecuted: previousLastExecuted
    });

    return false;
  }
}
```

**Benefits:**
- Instant UI feedback (perceived performance improvement)
- No loading spinners for simple actions
- Rollback on error maintains data consistency

### 4. Add Scene Execution History

**Enhancement:** Track execution history with timestamps and results

```typescript
interface SceneExecution {
  sceneId: string;
  sceneName: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

// Add to state
let executionHistory = $state<SceneExecution[]>([]);
const MAX_HISTORY = 50;

// Add to executeScene
export async function executeScene(sceneId: string): Promise<boolean> {
  const scene = sceneMap.get(sceneId);
  if (!scene) return false;

  const execution: SceneExecution = {
    sceneId: scene.id,
    sceneName: scene.name,
    timestamp: Date.now(),
    success: false
  };

  try {
    // ... existing execution code ...

    execution.success = true;
    return true;
  } catch (err) {
    execution.success = false;
    execution.error = err instanceof Error ? err.message : 'Unknown error';
    return false;
  } finally {
    // Add to history (keep last 50)
    executionHistory = [execution, ...executionHistory].slice(0, MAX_HISTORY);
  }
}

// Export history getter
get executionHistory() {
  return executionHistory;
}
```

---

## 9. Testing Recommendations

### Unit Tests

**File:** `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getScenesStore } from './scenesStore.svelte';

describe('scenesStore', () => {
  let store: ReturnType<typeof getScenesStore>;

  beforeEach(() => {
    store = getScenesStore();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('loadScenes', () => {
    it('should load scenes successfully', async () => {
      const mockScenes = [
        { sceneId: '1', sceneName: 'Good Morning', lastExecutedDate: null },
        { sceneId: '2', sceneName: 'Good Night', lastExecutedDate: new Date() }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { count: 2, scenes: mockScenes }
        })
      });

      await store.loadScenes();

      expect(store.loading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.scenes).toHaveLength(2);
      expect(store.stats.total).toBe(2);
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      });

      await store.loadScenes();

      expect(store.loading).toBe(false);
      expect(store.error).toContain('Failed to fetch scenes');
      expect(store.scenes).toHaveLength(0);
    });
  });

  describe('executeScene', () => {
    it('should execute scene successfully', async () => {
      // Setup: Load scenes first
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { count: 1, scenes: [{ sceneId: '1', sceneName: 'Test' }] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      await store.loadScenes();
      const success = await store.executeScene('1');

      expect(success).toBe(true);
      expect(store.scenes[0].lastExecuted).toBeDefined();
    });

    it('should handle execution errors', async () => {
      // Setup
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { count: 1, scenes: [{ sceneId: '1', sceneName: 'Test' }] }
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Scene not found'
        });

      await store.loadScenes();
      const success = await store.executeScene('1');

      expect(success).toBe(false);
      expect(store.error).toContain('Failed to execute scene');
    });
  });
});
```

### Integration Tests

**File:** `/Users/masa/Projects/mcp-smartthings/web/tests/integration/scenes.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Scenes Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scenes');
  });

  test('should load and display scenes', async ({ page }) => {
    // Wait for scenes to load
    await page.waitForSelector('[data-testid="scene-card"]');

    // Check scene cards are displayed
    const sceneCards = await page.locator('[data-testid="scene-card"]').count();
    expect(sceneCards).toBeGreaterThan(0);
  });

  test('should execute scene on button click', async ({ page }) => {
    // Click first scene execute button
    await page.locator('[data-testid="scene-execute-btn"]').first().click();

    // Wait for success notification
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();

    // Verify last executed time updated
    await expect(page.locator('[data-testid="last-executed"]').first()).toContainText(/ago/);
  });

  test('should show error on execution failure', async ({ page }) => {
    // Mock API to return error
    await page.route('/api/automations/*/execute', route =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ success: false, error: { message: 'Test error' } })
      })
    );

    await page.locator('[data-testid="scene-execute-btn"]').first().click();

    // Verify error message displayed
    await expect(page.locator('[data-testid="error-alert"]')).toContainText('Test error');
  });
});
```

---

## 10. File Paths and Implementation Checklist

### Files to Create

- ✅ `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.svelte.ts`
  - Main store implementation
  - ~200-300 lines of code
  - Follows existing store patterns

- ✅ `/Users/masa/Projects/mcp-smartthings/web/src/lib/types/scene.ts` (optional)
  - Scene interface definition
  - Response type definitions
  - Can be inline in store file if preferred

### Files to Update

- 🔄 Component files importing `automationStore`
  - Update to use `scenesStore` instead
  - Update component props and method calls

- 🔄 Route files under `/web/src/routes/automations/`
  - Rename directory to `/scenes/`
  - Update route paths and metadata

### Dependencies Already Available

- ✅ Backend API endpoints: `/api/automations`, `/api/automations/:id/execute`
- ✅ Backend types: `SceneInfo` interface
- ✅ Backend services: `SceneService`, `ToolExecutor`
- ✅ Svelte 5 runes: `$state`, `$derived` (no additional packages needed)

### No Additional Packages Required

All dependencies are already installed and configured:
- Svelte 5 with runes support
- TypeScript with proper configuration
- Existing fetch API (no axios needed)
- No state management libraries needed (pure Svelte runes)

---

## Conclusion

The scenesStore implementation is straightforward with clear patterns to follow from existing stores. The backend infrastructure is complete and production-ready. The main implementation effort is creating the new store file (~200 lines) and updating components to use it.

**Next Steps:**
1. Create `scenesStore.svelte.ts` following `automationStore` pattern
2. Test with existing `/api/automations` endpoints
3. Create components to display and execute scenes
4. Add filtering and favorite features (optional enhancements)
5. Plan migration from `automationStore` (rename/deprecate)

**Estimated Implementation Time:**
- Core store: 2-3 hours
- Basic components: 3-4 hours
- Testing: 2-3 hours
- **Total:** 7-10 hours for complete implementation

**Risk Assessment:** Low
- Backend is fully implemented and tested
- Pattern is well-established in existing stores
- No new dependencies or complex state logic
- Clear migration path from existing `automationStore`
