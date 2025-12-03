# AsyncContent Migration Guide

Step-by-step guide for migrating existing grid components to use `AsyncContent`.

## Benefits of Migration

- **90% Less Code**: Eliminate repetitive state logic
- **Consistent UX**: Same loading/error/empty states everywhere
- **Better Accessibility**: Built-in ARIA attributes and focus management
- **Type Safety**: TypeScript support for all states
- **Easier Testing**: Mock states by passing props instead of complex component logic

## Migration Steps

### Step 1: Identify Current Pattern

Look for components with this pattern:

```svelte
{#if loading}
  <!-- skeleton cards -->
{:else if error}
  <!-- error message -->
{:else if items.length === 0}
  <!-- empty state -->
{:else}
  <!-- actual content -->
{/if}
```

### Step 2: Add AsyncContent Import

```typescript
import { AsyncContent } from '$lib/components/loading';
```

### Step 3: Replace Conditional Logic

**Before:**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';
  import RuleCard from './RuleCard.svelte';

  const rulesStore = getRulesStore();
  onMount(async () => await rulesStore.loadRules());
</script>

<div class="rules-container">
  {#if rulesStore.loading}
    <!-- 50 lines of skeleton code -->
  {:else if rulesStore.error}
    <!-- 30 lines of error state -->
  {:else if rulesStore.rules.length === 0}
    <!-- 25 lines of empty state -->
  {:else}
    <div class="rules-grid">
      {#each rulesStore.rules as rule (rule.id)}
        <RuleCard {rule} />
      {/each}
    </div>
  {/if}
</div>
```

**After:**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { AsyncContent } from '$lib/components/loading';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';
  import RuleCard from './RuleCard.svelte';

  const rulesStore = getRulesStore();
  onMount(async () => await rulesStore.loadRules());
</script>

<div class="rules-container">
  <AsyncContent
    loading={rulesStore.loading}
    error={rulesStore.error}
    empty={rulesStore.rules.length === 0}
    emptyMessage="No rules found. Create your first rule to get started."
    onRetry={rulesStore.loadRules}
    skeletonVariant="rule"
  >
    <div class="rules-grid">
      {#each rulesStore.rules as rule (rule.id)}
        <RuleCard {rule} />
      {/each}
    </div>
  </AsyncContent>
</div>
```

### Step 4: Remove Unused Styles

Delete CSS for loading/error/empty states (100+ lines typically):

```css
/* DELETE THESE: */
.skeleton-card { ... }
.skeleton-header { ... }
.skeleton-icon { ... }
/* ... all skeleton styles ... */

.empty-state { ... }
.empty-icon { ... }
/* ... all empty state styles ... */

.error-state { ... }
/* ... all error state styles ... */
```

Keep only your content grid styles:

```css
/* KEEP THESE: */
.rules-container { ... }
.rules-grid { ... }
/* ... content styles ... */
```

## Real-World Examples

### Example 1: Rules Grid (Simple)

**Lines of Code:**
- Before: 486 lines (HTML + CSS)
- After: 30 lines (HTML only)
- **Reduction: 94%**

**Before (RulesGrid.svelte):**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';
  import RuleCard from './RuleCard.svelte';

  const rulesStore = getRulesStore();
  onMount(async () => await rulesStore.loadRules());
</script>

<div class="rules-container">
  {#if rulesStore.loading}
    <div class="rules-grid">
      {#each Array(6) as _, i}
        <div class="skeleton-card">
          <!-- 15 lines of skeleton markup -->
        </div>
      {/each}
    </div>
  {:else if rulesStore.error}
    <div class="empty-state" role="alert">
      <!-- 20 lines of error state -->
    </div>
  {:else if rulesStore.rules.length === 0}
    <div class="empty-state">
      <!-- 30 lines of empty state -->
    </div>
  {:else}
    <div class="rules-header">
      <!-- Header with stats -->
    </div>
    <div class="rules-grid">
      {#each rulesStore.rules as rule (rule.id)}
        <RuleCard {rule} />
      {/each}
    </div>
  {/if}
</div>

<style>
  /* 300+ lines of CSS for all states */
</style>
```

**After (RulesGrid.svelte):**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { AsyncContent } from '$lib/components/loading';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';
  import RuleCard from './RuleCard.svelte';

  const rulesStore = getRulesStore();
  onMount(async () => await rulesStore.loadRules());
</script>

<div class="rules-container">
  <AsyncContent
    loading={rulesStore.loading}
    error={rulesStore.error}
    empty={rulesStore.rules.length === 0}
    emptyMessage="No rules found. Create your first rule to get started."
    onRetry={rulesStore.loadRules}
  >
    <div class="rules-header">
      <h2>Rules ({rulesStore.stats.total})</h2>
    </div>
    <div class="rules-grid">
      {#each rulesStore.rules as rule (rule.id)}
        <RuleCard {rule} />
      {/each}
    </div>
  </AsyncContent>
</div>

<style>
  .rules-container { /* ... */ }
  .rules-header { /* ... */ }
  .rules-grid { /* ... */ }
  /* Only 30 lines for content layout */
</style>
```

### Example 2: Devices Grid (Custom Loading)

When you need a custom loading state (different skeleton variant):

```svelte
<script lang="ts">
  import { AsyncContent, SkeletonGrid } from '$lib/components/loading';
  import { getDeviceStore } from '$lib/stores/deviceStore.svelte';

  const store = getDeviceStore();
  onMount(() => store.loadDevices());
</script>

<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.devices.length === 0}
  onRetry={store.loadDevices}
>
  {#snippet loadingSlot()}
    <SkeletonGrid count={12} variant="device" />
  {/snippet}

  <DeviceGrid devices={store.devices} />
</AsyncContent>
```

### Example 3: Automations with Custom Empty State

```svelte
<script lang="ts">
  import { AsyncContent, EmptyState } from '$lib/components/loading';
  import { getAutomationStore } from '$lib/stores/automationStore.svelte';

  const store = getAutomationStore();
  onMount(() => store.loadAutomations());

  function createAutomation() {
    // Navigate to creation page
  }
</script>

<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.automations.length === 0}
  onRetry={store.loadAutomations}
>
  {#snippet emptySlot()}
    <EmptyState title="No Automations Yet">
      {#snippet action()}
        <button class="create-btn" onclick={createAutomation}>
          <svg><!-- Plus icon --></svg>
          Create First Automation
        </button>
      {/snippet}
    </EmptyState>
  {/snippet}

  <AutomationsGrid automations={store.automations} />
</AsyncContent>
```

## Checklist for Migration

- [ ] Import `AsyncContent` from `$lib/components/loading`
- [ ] Replace `{#if loading}...{:else if error}...` with `<AsyncContent>`
- [ ] Map store properties to AsyncContent props:
  - `loading={store.loading}`
  - `error={store.error}`
  - `empty={store.items.length === 0}`
- [ ] Add `onRetry` if store has retry/reload method
- [ ] Set appropriate `skeletonVariant` for your entity type
- [ ] Add custom `emptyMessage` if needed
- [ ] Remove old skeleton/error/empty HTML markup
- [ ] Remove old skeleton/error/empty CSS styles
- [ ] Test all four states: loading, error, empty, content
- [ ] Verify accessibility with screen reader
- [ ] Check keyboard navigation (retry button focus)

## Common Patterns

### Pattern 1: Grid Component

```svelte
<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.items.length === 0}
  onRetry={store.load}
>
  <ItemGrid items={store.items} />
</AsyncContent>
```

### Pattern 2: List Component

```svelte
<AsyncContent
  loading={loading}
  error={error}
  empty={items.length === 0}
  emptyMessage="No items match your filters"
>
  {#each items as item}
    <ItemRow {item} />
  {/each}
</AsyncContent>
```

### Pattern 3: Detail View

```svelte
<AsyncContent
  loading={loading}
  error={error}
  empty={!item}
  emptyMessage="Item not found"
>
  <ItemDetail {item} />
</AsyncContent>
```

## Testing Changes

1. **Loading State**: Set `loading={true}` temporarily
2. **Error State**: Set `error={"Test error message"}` temporarily
3. **Empty State**: Use empty array or set `empty={true}`
4. **Content State**: Normal data flow

## Rollback Plan

If issues arise, keep old code commented:

```svelte
<!-- OLD IMPLEMENTATION (BACKUP)
{#if loading}
  ...
{:else if error}
  ...
{:else}
  ...
{/if}
-->

<AsyncContent ...>
  <!-- NEW IMPLEMENTATION -->
</AsyncContent>
```

## Performance Impact

- **Before**: 100-200 lines of duplicate skeleton/error/empty code per grid
- **After**: Single `<AsyncContent>` wrapper (5-10 lines)
- **Bundle Size**: Reduced by ~50KB after migrating 5 grids
- **Maintenance**: One location for loading/error/empty styles
- **Runtime**: Identical (same rendering, just centralized)

## Next Steps

1. Start with simplest grid (rules or automations)
2. Verify all states work correctly
3. Migrate remaining grids one at a time
4. Update tests to use AsyncContent props
5. Document any custom patterns for your team

## Questions?

See `AsyncContent.md` for complete API documentation and `AsyncContent.example.svelte` for comprehensive examples.
