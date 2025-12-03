# AsyncContent Quick Reference

## Import

```typescript
import { AsyncContent, ErrorState, EmptyState } from '$lib/components/loading';
```

## Basic Usage

```svelte
<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={items.length === 0}
  onRetry={store.reload}
>
  <YourContent />
</AsyncContent>
```

## All Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `loading` | `boolean` | `false` | Show loading state |
| `error` | `string \| null` | `null` | Error message |
| `empty` | `boolean` | `false` | Show empty state |
| `emptyMessage` | `string` | `"No items found"` | Empty message |
| `errorRetryable` | `boolean` | `true` | Show retry button |
| `onRetry` | `() => void \| Promise<void>` | - | Retry function |
| `skeletonCount` | `number` | `6` | Skeleton cards |
| `skeletonVariant` | `SkeletonVariant` | `"rule"` | Skeleton type |
| `children` | `Snippet` | *required* | Content |
| `loadingSlot` | `Snippet` | - | Custom loading |
| `errorSlot` | `Snippet<[string]>` | - | Custom error |
| `emptySlot` | `Snippet` | - | Custom empty |

## Skeleton Variants

- `rule` - Rules, automations, installed apps (320px min)
- `device` - Devices, rooms (280px min)
- `automation` - Same as rule
- `room` - Same as device
- `installedapp` - Same as rule

## Custom Loading

```svelte
<AsyncContent loading={true} error={null} empty={false}>
  {#snippet loadingSlot()}
    <SkeletonGrid count={8} variant="device" />
  {/snippet}

  <Content />
</AsyncContent>
```

## Custom Error

```svelte
<AsyncContent loading={false} error="Network error" empty={false}>
  {#snippet errorSlot(err)}
    <div class="error">
      <p>{err}</p>
      <button onclick={retry}>Retry</button>
    </div>
  {/snippet}

  <Content />
</AsyncContent>
```

## Custom Empty

```svelte
<AsyncContent loading={false} error={null} empty={true}>
  {#snippet emptySlot()}
    <EmptyState title="No Items">
      {#snippet action()}
        <button onclick={create}>Create</button>
      {/snippet}
    </EmptyState>
  {/snippet}

  <Content />
</AsyncContent>
```

## State Priority

1. Loading (highest)
2. Error
3. Empty
4. Content (lowest)

## Accessibility

- Loading: `aria-live="polite"`, `aria-busy="true"`
- Error: `role="alert"`, `aria-live="assertive"`
- Empty: `role="status"`, `aria-live="polite"`
- Retry button auto-focused

## ErrorState (Standalone)

```svelte
<ErrorState
  message="Failed to load"
  onRetry={async () => await fetch()}
  retryLabel="Reload"
/>
```

## EmptyState (Standalone)

```svelte
<EmptyState title="No Items" message="Create your first item">
  {#snippet icon()}
    <svg><!-- Custom icon --></svg>
  {/snippet}

  {#snippet action()}
    <button onclick={create}>Create</button>
  {/snippet}
</EmptyState>
```

## Common Patterns

### Grid Component
```svelte
<AsyncContent
  loading={store.loading}
  error={store.error}
  empty={store.items.length === 0}
  onRetry={store.load}
>
  <Grid items={store.items} />
</AsyncContent>
```

### List Component
```svelte
<AsyncContent
  loading={loading}
  error={error}
  empty={items.length === 0}
>
  {#each items as item}
    <Row {item} />
  {/each}
</AsyncContent>
```

### Detail View
```svelte
<AsyncContent
  loading={loading}
  error={error}
  empty={!item}
  emptyMessage="Item not found"
>
  <Detail {item} />
</AsyncContent>
```

## Files

- **Component**: `AsyncContent.svelte`
- **API Docs**: `AsyncContent.md`
- **Examples**: `AsyncContent.example.svelte`
- **Migration**: `MIGRATION-GUIDE.md`
- **Tests**: `AsyncContent.test.ts`
