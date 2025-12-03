# AsyncContent Component

Declarative loading/error/empty state handling using Svelte 5 snippets.

## Purpose

Eliminates repetitive loading/error/empty state logic from grid components by providing a reusable wrapper with customizable slots for each state.

## Features

- **Svelte 5 Runes API**: Modern reactive state management
- **Snippet-based Slots**: Maximum flexibility with type-safe snippets
- **Default States**: Zero-config usage with sensible defaults
- **Fade Transitions**: Smooth animations between states
- **Accessibility**: ARIA attributes, screen reader support, focus management
- **TypeScript**: Full type safety for all props and snippets

## Installation

```typescript
import { AsyncContent } from '$lib/components/loading';
```

## Basic Usage

### Zero Configuration (Default States)

```svelte
<script lang="ts">
  import { AsyncContent } from '$lib/components/loading';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';

  const store = getRulesStore();
</script>

<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.rules.length === 0}
  emptyMessage="No rules found. Create your first rule to get started."
  onRetry={store.loadRules}
>
  <RulesGrid rules={store.rules} />
</AsyncContent>
```

This will automatically show:
- **Loading**: SkeletonGrid with 6 rule-variant cards
- **Error**: Error message with retry button
- **Empty**: "No rules found" message
- **Content**: Your actual content when data is loaded

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `loading` | `boolean` | `false` | Show loading state |
| `error` | `string \| null` | `null` | Error message to display |
| `empty` | `boolean` | `false` | Show empty state |
| `emptyMessage` | `string` | `"No items found"` | Message for default empty state |
| `errorRetryable` | `boolean` | `true` | Show retry button on error |
| `onRetry` | `() => void \| Promise<void>` | `undefined` | Retry function (async supported) |
| `skeletonCount` | `number` | `6` | Number of skeleton cards in default loading |
| `skeletonVariant` | `SkeletonVariant` | `"rule"` | Skeleton variant for default loading |
| `children` | `Snippet` | *required* | Content to show when loaded |
| `loadingSlot` | `Snippet` | `undefined` | Custom loading state |
| `errorSlot` | `Snippet<[string]>` | `undefined` | Custom error state (receives error message) |
| `emptySlot` | `Snippet` | `undefined` | Custom empty state |

## Skeleton Variants

- `rule`: Wider cards for rules, automations, installed apps (320px min)
- `device`: Narrower cards for devices, rooms (280px min)
- `automation`: Same as rule variant
- `room`: Same as device variant
- `installedapp`: Same as rule variant

## Custom States

### Custom Loading State

```svelte
<AsyncContent loading={store.loading} error={store.error} empty={false}>
  {#snippet loadingSlot()}
    <div class="custom-loading">
      <SkeletonGrid count={8} variant="device" />
      <p>Loading your devices...</p>
    </div>
  {/snippet}

  <DeviceGrid devices={store.devices} />
</AsyncContent>
```

### Custom Error State

```svelte
<AsyncContent loading={store.loading} error={store.error} empty={false}>
  {#snippet errorSlot(err)}
    <div class="custom-error">
      <h3>Oops! Something Went Wrong</h3>
      <p>{err}</p>
      <button onclick={store.loadRules}>Try Again</button>
      <button>Contact Support</button>
    </div>
  {/snippet}

  <RulesGrid rules={store.rules} />
</AsyncContent>
```

### Custom Empty State

```svelte
<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.rules.length === 0}
>
  {#snippet emptySlot()}
    <EmptyState title="No Rules Yet">
      {#snippet icon()}
        <svg><!-- Custom icon --></svg>
      {/snippet}

      {#snippet action()}
        <button onclick={createRule}>Create Your First Rule</button>
      {/snippet}
    </EmptyState>
  {/snippet}

  <RulesGrid rules={store.rules} />
</AsyncContent>
```

## State Priority

States are checked in this order:

1. **Loading** (`loading === true`) - Shows loading state
2. **Error** (`error !== null`) - Shows error state
3. **Empty** (`empty === true`) - Shows empty state
4. **Content** - Shows children

## Standalone Components

You can also use the state components independently:

### ErrorState

```svelte
<script lang="ts">
  import { ErrorState } from '$lib/components/loading';
</script>

<ErrorState
  message="Failed to load data"
  onRetry={async () => await fetchData()}
  retryLabel="Reload"
/>
```

**Props:**
- `message: string` - Error message to display
- `onRetry?: () => void | Promise<void>` - Optional retry function
- `retryLabel?: string` - Retry button label (default: "Try Again")

### EmptyState

```svelte
<script lang="ts">
  import { EmptyState } from '$lib/components/loading';
</script>

<EmptyState
  title="No Items Found"
  message="Try adjusting your filters or create a new item."
>
  {#snippet icon()}
    <svg><!-- Custom icon --></svg>
  {/snippet}

  {#snippet action()}
    <button onclick={createNew}>Create New</button>
  {/snippet}
</EmptyState>
```

**Props:**
- `title: string` - Main heading
- `message?: string` - Optional description
- `icon?: Snippet` - Custom icon snippet
- `action?: Snippet` - Custom action button snippet

## Accessibility

### ARIA Attributes

- **Loading State**: `aria-live="polite"`, `aria-busy="true"`
- **Error State**: `role="alert"`, `aria-live="assertive"`
- **Empty State**: `role="status"`, `aria-live="polite"`

### Focus Management

- Error retry button auto-focuses on mount
- Keyboard navigation fully supported
- Screen reader announcements for all state changes

### Reduced Motion

All transitions respect `prefers-reduced-motion` user preference.

## Performance

- **CSS-Only Animations**: No JavaScript overhead
- **Fine-Grained Reactivity**: Svelte 5 Runes minimize re-renders
- **Lazy Snippet Evaluation**: Only active state is rendered
- **Minimal DOM**: Efficient rendering with transitions

## Examples

See `AsyncContent.example.svelte` for comprehensive usage examples including:

1. Basic usage with defaults
2. Custom loading state
3. Custom error state
4. Custom empty state
5. Complete customization
6. Non-retryable errors

## Migration from Inline States

### Before (Inline Logic)

```svelte
<script lang="ts">
  const store = getRulesStore();
  onMount(() => store.loadRules());
</script>

{#if store.loading}
  <SkeletonGrid count={6} variant="rule" />
{:else if store.error}
  <div class="error">
    <p>{store.error}</p>
    <button onclick={store.loadRules}>Retry</button>
  </div>
{:else if store.rules.length === 0}
  <div class="empty">
    <p>No rules found</p>
  </div>
{:else}
  <RulesGrid rules={store.rules} />
{/if}
```

### After (AsyncContent)

```svelte
<script lang="ts">
  import { AsyncContent } from '$lib/components/loading';
  const store = getRulesStore();
  onMount(() => store.loadRules());
</script>

<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.rules.length === 0}
  emptyMessage="No rules found"
  onRetry={store.loadRules}
>
  <RulesGrid rules={store.rules} />
</AsyncContent>
```

**Benefits:**
- 90% less code
- Consistent UX across all grids
- Built-in accessibility
- No duplicate styling
- Type-safe snippets

## Design Philosophy

1. **Zero Config by Default**: Works with minimal props
2. **Progressive Enhancement**: Add customization only when needed
3. **Type Safety**: TypeScript for all props and snippets
4. **Accessibility First**: ARIA, focus management, screen readers
5. **Performance**: CSS animations, minimal re-renders

## Related Components

- `SkeletonGrid` - Grid of skeleton cards
- `ErrorState` - Standalone error display
- `EmptyState` - Standalone empty display
- `LoadingSpinner` - Inline spinner for buttons

## Browser Support

- Modern browsers with CSS Grid support
- Svelte 5 compatible
- Respects user accessibility preferences
