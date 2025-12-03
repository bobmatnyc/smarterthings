# AsyncContent Architecture

## Component Hierarchy

```
AsyncContent.svelte (Main Wrapper)
├── Props: loading, error, empty, children, snippets
├── State Management: $derived.by() for currentState
└── Conditional Rendering:
    ├── Loading State
    │   ├── Default: SkeletonGrid (6 cards, variant="rule")
    │   └── Custom: loadingSlot snippet
    ├── Error State
    │   ├── Default: ErrorState component
    │   └── Custom: errorSlot snippet (receives error message)
    ├── Empty State
    │   ├── Default: EmptyState component
    │   └── Custom: emptySlot snippet
    └── Content State
        └── children snippet (your actual content)
```

## Component Files

```
web/src/lib/components/loading/
├── AsyncContent.svelte       # Main wrapper component
├── ErrorState.svelte         # Standalone error display
├── EmptyState.svelte         # Standalone empty display
├── SkeletonGrid.svelte       # Used by default loading state
├── SkeletonCard.svelte       # Individual skeleton cards
├── index.ts                  # Barrel exports
├── AsyncContent.md           # API documentation
├── AsyncContent.example.svelte # Usage examples
├── AsyncContent.test.ts      # Unit tests
├── MIGRATION-GUIDE.md        # Migration instructions
├── QUICK-REFERENCE.md        # Quick lookup guide
└── ARCHITECTURE.md           # This file
```

## Data Flow

```
Store State (Reactive)
    │
    ├─ loading: boolean
    ├─ error: string | null
    └─ items: T[]
    │
    ▼
AsyncContent Props
    │
    ├─ loading={store.loading}
    ├─ error={store.error}
    └─ empty={store.items.length === 0}
    │
    ▼
State Priority Logic ($derived.by)
    │
    ├─ if (loading) → "loading"
    ├─ if (error) → "error"
    ├─ if (empty) → "empty"
    └─ else → "content"
    │
    ▼
Render State
    │
    ├─ Loading → SkeletonGrid (or loadingSlot)
    ├─ Error → ErrorState (or errorSlot)
    ├─ Empty → EmptyState (or emptySlot)
    └─ Content → children
```

## State Transitions

```
Initial Load:
[Content] → [Loading] → [Content/Error/Empty]

User Action (Retry):
[Error] → [Loading] → [Content/Error]

Refetch:
[Content] → [Loading] → [Content/Error]

Empty to Content:
[Empty] → [Loading] → [Content]
```

## Reactivity Flow (Svelte 5 Runes)

```typescript
// Props (destructured with $props)
let { loading, error, empty, children, ... } = $props();

// Derived State (computed with $derived.by)
let currentState = $derived.by(() => {
  if (loading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'content';
});

// Template Rendering (based on currentState)
{#if currentState === 'loading'}
  {@render loadingSlot() || <SkeletonGrid />}
{:else if currentState === 'error'}
  {@render errorSlot(error) || <ErrorState />}
{:else if currentState === 'empty'}
  {@render emptySlot() || <EmptyState />}
{:else}
  {@render children()}
{/if}
```

## Snippet System

### Parent Component (Consumer)
```svelte
<AsyncContent loading={true} error={null} empty={false}>
  {#snippet loadingSlot()}
    <!-- Custom loading UI -->
  {/snippet}

  {#snippet errorSlot(errorMessage)}
    <!-- Custom error UI, receives error message -->
  {/snippet}

  {#snippet emptySlot()}
    <!-- Custom empty UI -->
  {/snippet}

  <!-- Content (children snippet) -->
  <Grid items={data} />
</AsyncContent>
```

### AsyncContent (Component)
```svelte
<script lang="ts">
  let { loadingSlot, errorSlot, emptySlot, children } = $props();
</script>

{#if currentState === 'loading'}
  {#if loadingSlot}
    {@render loadingSlot()}
  {:else}
    <SkeletonGrid />
  {/if}
{/if}
```

## Accessibility Architecture

```
AsyncContent
├── Loading State
│   ├── aria-live="polite"
│   └── aria-busy="true"
├── Error State
│   ├── role="alert"
│   ├── aria-live="assertive"
│   └── Retry Button (auto-focused)
├── Empty State
│   ├── role="status"
│   └── aria-live="polite"
└── Content State
    └── No ARIA (content provides own)
```

## Type System

```typescript
// Main Component Props
interface AsyncContentProps {
  // State control
  loading?: boolean;
  error?: string | null;
  empty?: boolean;

  // Configuration
  emptyMessage?: string;
  errorRetryable?: boolean;
  onRetry?: () => void | Promise<void>;
  skeletonCount?: number;
  skeletonVariant?: SkeletonVariant;

  // Snippets
  children: Snippet;              // Required
  loadingSlot?: Snippet;          // Optional
  errorSlot?: Snippet<[string]>;  // Receives error message
  emptySlot?: Snippet;            // Optional
}

// Skeleton Variants
type SkeletonVariant = 'rule' | 'automation' | 'room' | 'device' | 'installedapp';
```

## Performance Characteristics

### Rendering
- **State Changes**: O(1) - Direct comparison in $derived.by
- **Re-renders**: Minimal - Only when state changes
- **DOM Updates**: Single state visible at once
- **Transitions**: 150ms CSS fade (GPU accelerated)

### Memory
- **Active States**: 1 (only current state rendered)
- **Snippet Memory**: Lazy - Only active snippet evaluated
- **Event Listeners**: 0-1 (retry button when in error state)

### Bundle Size
- **AsyncContent**: ~3KB gzipped
- **ErrorState**: ~2KB gzipped
- **EmptyState**: ~1.5KB gzipped
- **Total**: ~6.5KB (replaces ~50KB of duplicates)

## Design Patterns

### Composition Pattern
```
AsyncContent (Container)
└── Uses composition of:
    ├── SkeletonGrid (loading)
    ├── ErrorState (error)
    ├── EmptyState (empty)
    └── Children (content)
```

### Snippet Pattern (Svelte 5)
```
Component provides snippets as props
└── Parent passes custom UI as snippets
    └── Component renders snippet or default
```

### State Machine Pattern
```
States: Loading → Error → Empty → Content
Transitions: Controlled by props
Priority: Loading > Error > Empty > Content
```

### Progressive Enhancement
```
Level 1: Zero config (all defaults)
Level 2: Custom messages
Level 3: Custom snippets
Level 4: Fully branded UI
```

## Integration Points

### Store Integration
```typescript
// Store provides reactive state
const store = getRulesStore();
// Component binds to store
<AsyncContent loading={store.loading} ... />
```

### API Integration
```typescript
// onRetry calls async API function
onRetry={async () => await store.loadRules()}
```

### Routing Integration
```svelte
<!-- Works with SvelteKit load functions -->
<script lang="ts">
  export let data;
</script>

<AsyncContent
  loading={data.loading}
  error={data.error}
  empty={data.items.length === 0}
>
  <Grid items={data.items} />
</AsyncContent>
```

## Testing Strategy

### Unit Tests
- Props validation
- State priority logic
- Snippet rendering
- Accessibility attributes

### Integration Tests
- Store integration
- API retry functionality
- State transitions

### E2E Tests
- User interactions
- Keyboard navigation
- Screen reader announcements

## Migration Path

```
1. Identify component with inline states
   └── RulesGrid.svelte (486 lines)

2. Replace conditional logic
   └── {#if loading} → <AsyncContent>

3. Remove duplicate styles
   └── Delete 300+ lines of CSS

4. Test all states
   └── loading, error, empty, content

5. Verify accessibility
   └── ARIA, focus, keyboard nav

Result: 30 lines (90% reduction)
```

## Future Enhancements

### Potential Features
- [ ] Skeleton shimmer animation control
- [ ] Custom transition durations
- [ ] Multiple loading states (initial vs. refetch)
- [ ] Optimistic UI support
- [ ] Stale-while-revalidate pattern
- [ ] Retry with backoff strategy
- [ ] Error boundary integration

### Not Planned
- ❌ Client-side routing (use SvelteKit)
- ❌ Data fetching (use stores)
- ❌ Caching (use separate cache layer)
- ❌ Pagination (handled by content)
