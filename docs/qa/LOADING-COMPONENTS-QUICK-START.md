# Loading Components - Quick Start Guide

## 🚀 Installation

The loading components are already installed at:
```
web/src/lib/components/loading/
```

## 📖 Basic Usage

### Import Components
```svelte
<script lang="ts">
  import { SkeletonGrid } from '$lib/components/loading';
</script>
```

### Replace Loading State
```svelte
{#if loading}
  <SkeletonGrid count={6} variant="rule" />
{:else}
  <RulesGrid rules={rules} />
{/if}
```

## 🎯 Quick Examples

### Example 1: Rules Grid
```svelte
<script lang="ts">
  import { SkeletonGrid } from '$lib/components/loading';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';
  
  const rulesStore = getRulesStore();
</script>

{#if rulesStore.loading}
  <SkeletonGrid count={6} variant="rule" />
{:else}
  <div class="rules-grid">
    {#each rulesStore.rules as rule (rule.id)}
      <RuleCard {rule} />
    {/each}
  </div>
{/if}
```

### Example 2: Button Loading
```svelte
<script>
  import { LoadingSpinner } from '$lib/components/loading';
  
  let saving = $state(false);
  
  async function save() {
    saving = true;
    await api.saveData();
    saving = false;
  }
</script>

<button disabled={saving} onclick={save}>
  {#if saving}
    <LoadingSpinner size="16px" label="Saving" />
  {:else}
    Save Changes
  {/if}
</button>
```

### Example 3: Custom Layout
```svelte
<script>
  import { SkeletonText, SkeletonIcon } from '$lib/components/loading';
</script>

<div class="custom-card">
  <SkeletonIcon size="3rem" shape="square" />
  <SkeletonText variant="title" width="60%" />
  <SkeletonText variant="body" width="80%" />
</div>
```

## 🎨 Available Components

### 1. SkeletonGrid (Most Common)
```svelte
<SkeletonGrid 
  count={6}
  variant="rule | automation | room | device | installedapp"
/>
```

### 2. SkeletonCard
```svelte
<SkeletonCard 
  variant="rule | automation | room | device | installedapp"
/>
```

### 3. SkeletonText
```svelte
<SkeletonText
  variant="title | body | caption"
  width="60%"
/>
```

### 4. SkeletonIcon
```svelte
<SkeletonIcon
  size="3rem"
  shape="circle | square"
/>
```

### 5. LoadingSpinner
```svelte
<LoadingSpinner
  size="24px"
  label="Loading"
/>
```

## ✨ Variant Guide

| Variant | Layout | Use Case |
|---------|--------|----------|
| `rule` | Horizontal: Icon + Title + Subtitle + Button | Rules list |
| `automation` | Horizontal: Icon + Title + Subtitle + Toggle | Automations list |
| `room` | Vertical: Icon + Title + Count | Rooms grid |
| `device` | Vertical: Icon + Title + Subtitle | Devices grid |
| `installedapp` | Horizontal: Icon + Title + Subtitle + Action | Installed apps |

## 🔄 Migration Steps

### Step 1: Import Component
```diff
<script lang="ts">
+ import { SkeletonGrid } from '$lib/components/loading';
  import { getRulesStore } from '$lib/stores/rulesStore.svelte';
  import RuleCard from './RuleCard.svelte';
</script>
```

### Step 2: Replace Skeleton Markup
```diff
{#if rulesStore.loading}
- <div class="rules-grid">
-   {#each Array(6) as _, i}
-     <div class="skeleton-card">...</div>
-   {/each}
- </div>
+ <SkeletonGrid count={6} variant="rule" />
{/if}
```

### Step 3: Remove Skeleton CSS
```diff
<style>
- /* 200+ lines of skeleton CSS */
- .skeleton-card { ... }
- .skeleton-icon { ... }
- @keyframes shimmer { ... }

  /* Keep other styles */
  .rules-grid { ... }
</style>
```

## ✅ Accessibility

All components include:
- ✅ ARIA attributes (`role="status"`, `aria-label`)
- ✅ Reduced motion support (`prefers-reduced-motion`)
- ✅ WCAG AA color contrast (4.51:1)
- ✅ Screen reader announcements

## 🎯 Common Patterns

### Pattern 1: Grid Loading
```svelte
{#if loading}
  <SkeletonGrid count={6} variant="rule" />
{:else if error}
  <ErrorMessage {error} />
{:else if items.length === 0}
  <EmptyState />
{:else}
  <ItemsGrid {items} />
{/if}
```

### Pattern 2: Inline Loading
```svelte
<div class="card">
  {#if loading}
    <SkeletonCard variant="device" />
  {:else}
    <DeviceCard {device} />
  {/if}
</div>
```

### Pattern 3: Progressive Loading
```svelte
{#if initialLoading}
  <SkeletonGrid count={6} variant="room" />
{:else}
  <div class="rooms-grid">
    {#each rooms as room (room.id)}
      <RoomCard {room} />
    {/each}
    {#if loadingMore}
      <SkeletonCard variant="room" />
      <SkeletonCard variant="room" />
    {/if}
  </div>
{/if}
```

## 📱 Responsive Behavior

All components are responsive by default:

- **Mobile (<768px):** 1 column
- **Tablet (768-1440px):** 2-3 columns
- **Desktop (>1440px):** 3-4 columns

## 🧪 Testing

### Visual Test
1. Add `<SkeletonGrid count={6} variant="rule" />` to page
2. Verify shimmer animation appears
3. Check responsive breakpoints

### Accessibility Test
1. Enable VoiceOver (Cmd+F5 on Mac)
2. Navigate to skeleton
3. Verify "Loading rule" announcement

### Reduced Motion Test
1. Open Chrome DevTools
2. Cmd+Shift+P → "Emulate CSS prefers-reduced-motion"
3. Select "reduce"
4. Verify animation changes to opacity pulse

## 📚 Full Documentation

- **Component API:** `web/src/lib/components/loading/README.md`
- **Examples:** `web/src/lib/components/loading/EXAMPLE.svelte`
- **Implementation:** `LOADING-COMPONENTS-SUMMARY.md`

## 🎓 Learn More

### Component Documentation
```bash
# Read comprehensive docs
cat web/src/lib/components/loading/README.md

# View interactive examples
# Open web/src/lib/components/loading/EXAMPLE.svelte in browser
```

### TypeScript Types
```typescript
import type { 
  SkeletonVariant,
  TextVariant,
  IconShape
} from '$lib/components/loading';

// All types are exported and documented
```

## 💡 Tips

1. **Use SkeletonGrid for most cases** - It handles layout automatically
2. **Match variant to entity type** - `variant="rule"` for rules, etc.
3. **Count should match expected items** - Usually 6-12 for grids
4. **LoadingSpinner for inline states** - Buttons, forms, small areas
5. **Compose with primitives for custom layouts** - Use SkeletonText + SkeletonIcon

## 🚨 Common Mistakes

❌ **Wrong:**
```svelte
<!-- Too many skeletons -->
<SkeletonGrid count={100} variant="rule" />

<!-- Wrong variant -->
<SkeletonGrid count={6} variant="device" />  <!-- For a rules page -->

<!-- Missing conditional -->
<SkeletonGrid count={6} variant="rule" />
<RulesGrid rules={rules} />  <!-- Shows both! -->
```

✅ **Correct:**
```svelte
<!-- Reasonable count -->
<SkeletonGrid count={6} variant="rule" />

<!-- Matching variant -->
<SkeletonGrid count={6} variant="rule" />  <!-- For a rules page -->

<!-- Proper conditional -->
{#if loading}
  <SkeletonGrid count={6} variant="rule" />
{:else}
  <RulesGrid rules={rules} />
{/if}
```

## 🎯 Next Steps

1. **Try the examples** - Open EXAMPLE.svelte
2. **Migrate one component** - Start with RulesGrid.svelte
3. **Test accessibility** - Use VoiceOver/NVDA
4. **Share feedback** - Report issues or improvements

---

**Questions?** See `web/src/lib/components/loading/README.md` for full documentation.
