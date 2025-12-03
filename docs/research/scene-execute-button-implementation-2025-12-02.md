# Scene Execute Button Implementation Analysis

**Date**: 2025-12-02
**Status**: Implementation Ready
**Complexity**: Low (Simple component modification)

## Executive Summary

This analysis examines how to add execute buttons to Scene components, following the established RuleCard pattern. Scenes are currently displayed using AutomationCard but lack manual execution capability. The scenesStore already provides the `executeScene()` method, making this a straightforward UI enhancement.

**Key Finding**: Scenes are conceptually different from automations (toggle on/off) and rules (execute with conditions). Scenes should use an execute button pattern like RuleCard, not the toggle pattern in AutomationCard.

---

## 1. Current Scene Component Structure

### 1.1 Component Hierarchy

```
web/src/routes/automations/+page.svelte
└── AutomationsGrid.svelte
    └── AutomationCard.svelte (currently used for scenes)
```

**File Paths**:
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationCard.svelte`
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationsGrid.svelte`
- `/Users/masa/Projects/mcp-smartthings/web/src/routes/automations/+page.svelte`

### 1.2 AutomationCard Current Features

**Props Interface**:
```typescript
interface Props {
    automation: Automation;
}
```

**Visual Elements**:
- Icon (48x48px gradient background)
- Name (h3, 1.125rem)
- Status badge (enabled/disabled)
- Triggers list (collapsible, shows first + count)
- Last executed timestamp (relative time)
- Toggle switch (3rem x 1.75rem)

**Interaction Pattern**:
```typescript
async function handleToggle(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (isToggling) return;

    isToggling = true;
    await automationStore.toggleAutomation(automation.id);
    isToggling = false;
}
```

### 1.3 Problem Statement

**Current Mismatch**:
- AutomationCard uses toggle switch (appropriate for enable/disable)
- Scenes cannot be disabled (always enabled: true)
- Scenes need manual execution (like running a script)
- Toggle switch is semantically incorrect for scenes

**User Experience Gap**:
- No visual affordance for "run this scene"
- Users cannot manually trigger scenes from UI
- Scenes appear as read-only automations

---

## 2. RuleCard Execute Button Pattern Analysis

### 2.1 RuleCard Structure

**File Path**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/rules/RuleCard.svelte`

**Key Differences from AutomationCard**:
| Feature | AutomationCard | RuleCard |
|---------|---------------|----------|
| Right-side control | Toggle switch | Execute button |
| User action | Enable/disable | Run now |
| Loading state | `isToggling` | `isExecuting` |
| Button type | Toggle (switch role) | Action button |
| State tracking | enabled/disabled | lastExecuted timestamp |
| Additional control | None | Enable/disable toggle (top-right) |

### 2.2 Execute Button Implementation

**Button Structure**:
```svelte
<div class="execute-wrapper">
    <button
        class="execute-button"
        class:executing={isExecuting}
        onclick={handleExecute}
        aria-label={`Execute ${rule.name}`}
        disabled={isExecuting}
    >
        {#if isExecuting}
            <!-- Spinning loader SVG -->
        {:else}
            <!-- Play icon SVG -->
        {/if}
    </button>
</div>
```

**Handler Pattern**:
```typescript
let isExecuting = $state(false);

async function handleExecute(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (isExecuting) return;

    isExecuting = true;
    await rulesStore.executeRule(rule.id); // Toast handled in store
    isExecuting = false;
}
```

### 2.3 Styling Details

**Button Styles**:
```css
.execute-button {
    width: 3rem;           /* Same as toggle switch */
    height: 3rem;          /* Circular */
    background: rgb(59, 130, 246);  /* Primary blue */
    border: none;
    border-radius: 50%;    /* Circular button */
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.execute-button:hover {
    background: rgb(37, 99, 235);  /* Darker blue */
    transform: scale(1.05);         /* Slight grow */
    box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
}

.execute-button.executing {
    opacity: 0.6;
    cursor: not-allowed;
}
```

**Spinner Animation**:
```css
.spinner {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
```

**Mobile Responsive**:
```css
@media (max-width: 768px) {
    .execute-button {
        width: 2.75rem;
        height: 2.75rem;
    }
}
```

---

## 3. scenesStore Integration Analysis

### 3.1 Store API Surface

**File Path**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.svelte.ts`

**Available Methods**:
```typescript
export function getScenesStore() {
    return {
        // State (read-only getters)
        get scenes() { return scenes; },
        get stats() { return stats; },
        get loading() { return loading; },
        get error() { return error; },

        // Actions
        loadScenes,
        executeScene,      // ✅ AVAILABLE
        getSceneById,
        clearError
    };
}
```

### 3.2 executeScene() Method

**Signature**:
```typescript
export async function executeScene(sceneId: string): Promise<boolean>
```

**Implementation Details**:
```typescript
export async function executeScene(sceneId: string): Promise<boolean> {
    const scene = sceneMap.get(sceneId);
    if (!scene) {
        console.error('Scene not found:', sceneId);
        toast.error('Scene not found');
        return false;
    }

    try {
        // POST /api/automations/:id/execute
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

        // Optimistic update
        sceneMap.set(sceneId, {
            ...scene,
            lastExecuted: Date.now()
        });

        // Success toast
        toast.success(`Scene "${scene.name}" executed successfully`, {
            description: 'All actions completed'
        });

        return true;
    } catch (err) {
        console.error('Failed to execute scene:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to execute scene';
        error = errorMessage;

        // Error toast
        toast.error(`Failed to execute scene "${scene.name}"`, {
            description: errorMessage
        });

        return false;
    }
}
```

**Key Characteristics**:
- ✅ Returns `Promise<boolean>` (success/failure)
- ✅ Handles toasts internally (no manual toast needed in component)
- ✅ Updates lastExecuted timestamp optimistically
- ✅ Error handling built-in
- ✅ API endpoint: `POST /api/automations/:id/execute`

### 3.3 Scene Interface

```typescript
export interface Scene {
    id: string;
    name: string;
    enabled: boolean;        // Always true
    icon?: string;
    color?: string;
    locationId?: string;
    lastExecuted?: number;   // Timestamp in ms
}
```

**Note**: Scenes are always `enabled: true` (cannot be disabled).

---

## 4. Implementation Approach

### 4.1 Recommended Strategy: Create SceneCard Component

**Rationale**:
- Scenes have different interaction model than automations
- Avoids polluting AutomationCard with conditional logic
- Follows separation of concerns (scenes vs automations vs rules)
- Easier to maintain and test independently

**Component Structure**:
```
web/src/lib/components/
├── automations/
│   ├── AutomationCard.svelte     (keep as-is for automations)
│   └── AutomationsGrid.svelte    (modify to detect scene type)
└── scenes/
    ├── SceneCard.svelte          (NEW: based on RuleCard pattern)
    └── ScenesGrid.svelte         (OPTIONAL: dedicated scene grid)
```

### 4.2 SceneCard Implementation Plan

**Base Pattern**: Copy RuleCard structure, adapt for scenes

**Key Modifications**:
1. Remove enable/disable toggle (scenes always enabled)
2. Keep execute button (primary action)
3. Adapt styling for scene icon/color
4. Use scenesStore instead of rulesStore
5. Simplify status badge (no enabled/disabled states)

**Component Outline**:
```svelte
<script lang="ts">
    import type { Scene } from '$lib/stores/scenesStore.svelte';
    import { getScenesStore } from '$lib/stores/scenesStore.svelte';

    interface Props {
        scene: Scene;
    }

    let { scene }: Props = $props();

    const scenesStore = getScenesStore();

    let isExecuting = $state(false);

    async function handleExecute(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (isExecuting) return;

        isExecuting = true;
        await scenesStore.executeScene(scene.id);
        isExecuting = false;
    }

    // Format last executed time (same as RuleCard)
    const lastExecutedText = $derived(() => {
        // ... same logic as RuleCard
    });
</script>

<article class="scene-card">
    <div class="card-content">
        <!-- Scene Icon -->
        <div class="scene-icon" style:background={scene.color}>
            <!-- Use scene.icon or default icon -->
        </div>

        <!-- Scene Info -->
        <div class="scene-info">
            <h3 class="scene-name">{scene.name}</h3>

            <!-- Last Executed -->
            <div class="last-executed">
                <span>Last run: {lastExecutedText()}</span>
            </div>
        </div>

        <!-- Execute Button (from RuleCard) -->
        <div class="execute-wrapper">
            <button
                class="execute-button"
                class:executing={isExecuting}
                onclick={handleExecute}
                aria-label={`Execute ${scene.name}`}
                disabled={isExecuting}
            >
                {#if isExecuting}
                    <!-- Spinner SVG -->
                {:else}
                    <!-- Play icon SVG -->
                {/if}
            </button>
        </div>
    </div>
</article>
```

### 4.3 Alternative Approach: Modify AutomationCard

**Use Case**: If you want to keep scenes and automations in the same component.

**Implementation**:
```svelte
<script lang="ts">
    interface Props {
        automation: Automation;
        type?: 'automation' | 'scene';  // Add type discrimination
    }

    let { automation, type = 'automation' }: Props = $props();

    // Import both stores
    import { getAutomationStore } from '$lib/stores/automationStore.svelte';
    import { getScenesStore } from '$lib/stores/scenesStore.svelte';

    const automationStore = getAutomationStore();
    const scenesStore = getScenesStore();

    let isToggling = $state(false);
    let isExecuting = $state(false);  // Add for scenes

    async function handleToggle(event: Event) {
        // ... existing toggle logic
    }

    async function handleExecute(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (isExecuting) return;

        isExecuting = true;
        await scenesStore.executeScene(automation.id);
        isExecuting = false;
    }
</script>

<!-- ... -->

<!-- Conditional rendering based on type -->
{#if type === 'scene'}
    <!-- Execute Button -->
    <div class="execute-wrapper">
        <button
            class="execute-button"
            class:executing={isExecuting}
            onclick={handleExecute}
            aria-label={`Execute ${automation.name}`}
            disabled={isExecuting}
        >
            <!-- ... -->
        </button>
    </div>
{:else}
    <!-- Toggle Switch -->
    <div class="toggle-wrapper">
        <!-- ... existing toggle -->
    </div>
{/if}
```

**Drawbacks**:
- Increases component complexity
- Mixes concerns (automation toggle + scene execute)
- Harder to maintain long-term
- May need additional conditional logic for status badges

### 4.4 Grid Component Integration

**AutomationsGrid Modification** (if using type discrimination):
```svelte
<script lang="ts">
    import AutomationCard from './AutomationCard.svelte';

    // Detect if using scenes or automations
    const automationStore = getAutomationStore();

    // OR import scenes store
    import { getScenesStore } from '$lib/stores/scenesStore.svelte';
    const scenesStore = getScenesStore();

    // Determine type based on data source
    const itemType = /* 'scene' or 'automation' based on context */;
</script>

<!-- ... -->

{#each items as item (item.id)}
    <AutomationCard automation={item} type={itemType} />
{/each}
```

**OR Create Dedicated ScenesGrid**:
```svelte
<!-- web/src/lib/components/scenes/ScenesGrid.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { getScenesStore } from '$lib/stores/scenesStore.svelte';
    import SceneCard from './SceneCard.svelte';

    const scenesStore = getScenesStore();

    onMount(async () => {
        await scenesStore.loadScenes();
    });
</script>

<div class="scenes-container">
    {#if scenesStore.loading}
        <!-- Loading skeleton -->
    {:else if scenesStore.error}
        <!-- Error state -->
    {:else if scenesStore.scenes.length === 0}
        <!-- Empty state -->
    {:else}
        <!-- Scenes Grid -->
        <div class="scenes-grid">
            {#each scenesStore.scenes as scene (scene.id)}
                <SceneCard {scene} />
            {/each}
        </div>
    {/if}
</div>
```

---

## 5. Code Changes Summary

### 5.1 New Files to Create (Recommended Approach)

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/scenes/SceneCard.svelte`
```svelte
<!-- Base on RuleCard.svelte structure -->
<!-- Remove: Enable/disable toggle, status badge -->
<!-- Keep: Execute button, last executed timestamp -->
<!-- Adapt: Icon styling for scene.color and scene.icon -->
```

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/scenes/ScenesGrid.svelte` (Optional)
```svelte
<!-- Base on AutomationsGrid.svelte structure -->
<!-- Use: scenesStore instead of automationStore -->
<!-- Replace: AutomationCard with SceneCard -->
```

### 5.2 Files to Modify (Alternative Approach)

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationCard.svelte`

**Changes**:
1. Add `type?: 'automation' | 'scene'` to Props interface
2. Import scenesStore: `import { getScenesStore } from '$lib/stores/scenesStore.svelte';`
3. Add `isExecuting` state variable
4. Add `handleExecute()` function
5. Add conditional rendering for execute button vs toggle switch
6. Copy execute button styles from RuleCard

**File**: `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationsGrid.svelte`

**Changes**:
1. Determine if rendering scenes or automations
2. Pass `type` prop to AutomationCard: `<AutomationCard automation={item} type="scene" />`

---

## 6. Consistency with RuleCard Pattern

### 6.1 Visual Consistency

| Element | RuleCard | Recommended SceneCard |
|---------|----------|----------------------|
| Layout | Icon + Info + Button | ✅ Same |
| Icon size | 3rem × 3rem | ✅ Same |
| Icon style | Gradient background | ✅ Adapt with scene.color |
| Button size | 3rem (desktop), 2.75rem (mobile) | ✅ Same |
| Button color | Blue (rgb(59, 130, 246)) | ✅ Same |
| Button icon | Play triangle | ✅ Same |
| Loading spinner | Rotating circle | ✅ Same |
| Hover effect | Scale 1.05 + shadow | ✅ Same |
| Last executed | Relative time format | ✅ Same |

### 6.2 Interaction Consistency

| Interaction | RuleCard | SceneCard |
|-------------|----------|-----------|
| Primary action | Execute button | ✅ Execute button |
| Event handling | event.preventDefault() + stopPropagation() | ✅ Same |
| Loading state | isExecuting boolean | ✅ Same |
| Disabled during execution | disabled={isExecuting} | ✅ Same |
| Toast notifications | Handled in store | ✅ Same (scenesStore.executeScene) |
| Optimistic update | Updates lastExecuted | ✅ Same |

### 6.3 Code Pattern Consistency

**Handler Pattern** (Both use identical structure):
```typescript
let isExecuting = $state(false);

async function handleExecute(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (isExecuting) return;

    isExecuting = true;
    await store.executeXYZ(id);  // rulesStore vs scenesStore
    isExecuting = false;
}
```

**Store Integration** (Both follow same pattern):
```typescript
// RuleCard
import { getRulesStore } from '$lib/stores/rulesStore.svelte';
const rulesStore = getRulesStore();
await rulesStore.executeRule(rule.id);

// SceneCard (same pattern)
import { getScenesStore } from '$lib/stores/scenesStore.svelte';
const scenesStore = getScenesStore();
await scenesStore.executeScene(scene.id);
```

---

## 7. Implementation Recommendations

### 7.1 Recommended Approach: Dedicated SceneCard

**Priority**: HIGH
**Effort**: LOW (2-3 hours)
**Maintainability**: EXCELLENT

**Steps**:
1. Create `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/scenes/` directory
2. Create `SceneCard.svelte` by adapting RuleCard:
   - Copy RuleCard structure
   - Remove enable/disable toggle and badge
   - Replace rulesStore with scenesStore
   - Adapt icon styling for scene.color
   - Keep execute button identical to RuleCard
3. Create `ScenesGrid.svelte` by adapting AutomationsGrid:
   - Copy AutomationsGrid structure
   - Replace automationStore with scenesStore
   - Replace AutomationCard with SceneCard
4. Update route to use ScenesGrid

**Benefits**:
- ✅ Clean separation of concerns
- ✅ Easy to maintain and extend
- ✅ Follows existing component architecture (rules have RuleCard, scenes have SceneCard)
- ✅ No conditional logic complexity
- ✅ Independent styling and behavior

### 7.2 Alternative Approach: Modify AutomationCard

**Priority**: MEDIUM
**Effort**: LOW (1-2 hours)
**Maintainability**: FAIR

**Use When**:
- Scenes and automations will remain tightly coupled
- You want to minimize file count
- Future features will apply to both equally

**Steps**:
1. Add type discrimination to AutomationCard
2. Import scenesStore
3. Add execute button conditional rendering
4. Copy execute button styles from RuleCard
5. Update AutomationsGrid to pass type prop

**Drawbacks**:
- ⚠️ Increases component complexity
- ⚠️ Mixes two different interaction patterns
- ⚠️ May need more conditionals as features diverge

### 7.3 Next Steps

**Immediate Actions**:
1. Decide between dedicated SceneCard or modified AutomationCard
2. Create SceneCard component (recommended)
3. Test execute button functionality with scenesStore
4. Verify toast notifications appear correctly
5. Test loading states during execution
6. Verify lastExecuted timestamp updates

**Future Enhancements**:
- Scene icon customization (use scene.icon and scene.color)
- Scene categorization or tags
- Scene execution history
- Batch scene execution
- Scene scheduling

---

## 8. Testing Checklist

### 8.1 Component Rendering
- [ ] SceneCard renders with correct scene data
- [ ] Execute button appears in correct position
- [ ] Icon displays with scene.color background
- [ ] Name displays correctly
- [ ] Last executed timestamp formats correctly

### 8.2 Execute Button Interaction
- [ ] Clicking execute button calls scenesStore.executeScene()
- [ ] Button shows spinner during execution
- [ ] Button is disabled during execution (cannot double-click)
- [ ] Success toast appears on successful execution
- [ ] Error toast appears on failed execution
- [ ] lastExecuted timestamp updates after execution

### 8.3 Responsive Behavior
- [ ] Desktop: Button is 3rem × 3rem
- [ ] Mobile (<768px): Button is 2.75rem × 2.75rem
- [ ] Card layout adapts correctly on mobile
- [ ] Touch interactions work smoothly

### 8.4 Accessibility
- [ ] Button has aria-label with scene name
- [ ] Button disabled state is announced
- [ ] Focus styles are visible
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Screen reader announces execution state

---

## 9. Related Files Reference

### Component Files
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationCard.svelte` (current scene display)
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/automations/AutomationsGrid.svelte` (grid container)
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/components/rules/RuleCard.svelte` (execute button reference)
- `/Users/masa/Projects/mcp-smartthings/web/src/routes/automations/+page.svelte` (page entry)

### Store Files
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/scenesStore.svelte.ts` (scene state management)
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/rulesStore.svelte.ts` (reference for pattern)
- `/Users/masa/Projects/mcp-smartthings/web/src/lib/stores/automationStore.svelte.ts` (automation state)

---

## 10. Conclusion

**Key Recommendations**:

1. **Create Dedicated SceneCard Component** (RECOMMENDED)
   - Follow RuleCard pattern exactly
   - Remove enable/disable toggle (scenes always enabled)
   - Keep execute button as primary action
   - Use scenesStore.executeScene() method

2. **Component Structure**:
   ```
   SceneCard = RuleCard - EnableToggle - StatusBadge + SceneIconStyling
   ```

3. **Integration Points**:
   - scenesStore.executeScene() is ready to use
   - Toast notifications handled automatically
   - No manual state updates needed
   - Returns boolean for success tracking

4. **Consistency**:
   - Exact same execute button as RuleCard
   - Same event handler pattern
   - Same loading states and animations
   - Same responsive behavior

**Implementation Effort**: 2-3 hours for dedicated SceneCard approach

**Confidence Level**: HIGH - All required functionality exists, pattern is well-established in RuleCard.
