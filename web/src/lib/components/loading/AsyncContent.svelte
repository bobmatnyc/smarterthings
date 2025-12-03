<script lang="ts">
	/**
	 * AsyncContent Wrapper Component
	 *
	 * Declarative loading/error/empty state handling using Svelte 5 snippets.
	 * Eliminates repetitive state logic from grid components.
	 *
	 * Design Decisions:
	 * - Svelte 5 Runes API for reactive state management
	 * - Snippet-based slots for maximum flexibility
	 * - Default states for zero-config usage
	 * - Fade transitions between states for smooth UX
	 *
	 * State Priority (checked in order):
	 * 1. Loading state (when loading === true)
	 * 2. Error state (when error !== null)
	 * 3. Empty state (when empty === true)
	 * 4. Content state (show children)
	 *
	 * Accessibility:
	 * - ARIA live regions for state changes
	 * - Screen reader announcements for all states
	 * - Focus management on error retry
	 * - Keyboard navigation support
	 *
	 * Performance:
	 * - CSS-only animations (no JavaScript overhead)
	 * - Minimal re-renders with fine-grained reactivity
	 * - Lazy evaluation of snippet content
	 *
	 * Usage Example:
	 * ```svelte
	 * <AsyncContent
	 *   loading={store.loading}
	 *   error={store.error}
	 *   empty={store.items.length === 0}
	 *   emptyMessage="No items found"
	 *   onRetry={store.reload}
	 * >
	 *   <ItemGrid items={store.items} />
	 * </AsyncContent>
	 * ```
	 */

	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import SkeletonGrid from './SkeletonGrid.svelte';
	import ErrorState from './ErrorState.svelte';
	import EmptyState from './EmptyState.svelte';
	import type { SkeletonVariant } from './types';

	let {
		loading = false,
		error = null,
		empty = false,
		emptyMessage = 'No items found',
		errorRetryable = true,
		onRetry,
		skeletonCount = 6,
		skeletonVariant = 'rule',
		children,
		loadingSlot,
		errorSlot,
		emptySlot
	}: {
		loading?: boolean;
		error?: string | null;
		empty?: boolean;
		emptyMessage?: string;
		errorRetryable?: boolean;
		onRetry?: () => void | Promise<void>;
		skeletonCount?: number;
		skeletonVariant?: SkeletonVariant;
		children: Snippet;
		loadingSlot?: Snippet;
		errorSlot?: Snippet<[string]>;
		emptySlot?: Snippet;
	} = $props();

	/**
	 * Determine Current State
	 *
	 * Priority order ensures loading/error states
	 * always take precedence over empty/content.
	 */
	let currentState = $derived.by(() => {
		if (loading) return 'loading';
		if (error) return 'error';
		if (empty) return 'empty';
		return 'content';
	});
</script>

{#if currentState === 'loading'}
	<!-- Loading State -->
	<div class="async-content-state" transition:fade={{ duration: 150 }}>
		{#if loadingSlot}
			{@render loadingSlot()}
		{:else}
			<!-- Default Loading: SkeletonGrid -->
			<SkeletonGrid count={skeletonCount} variant={skeletonVariant} />
		{/if}
	</div>
{:else if currentState === 'error' && error}
	<!-- Error State -->
	<div class="async-content-state" transition:fade={{ duration: 150 }}>
		{#if errorSlot}
			{@render errorSlot(error)}
		{:else}
			<!-- Default Error State -->
			<ErrorState message={error} onRetry={errorRetryable ? onRetry : undefined} />
		{/if}
	</div>
{:else if currentState === 'empty'}
	<!-- Empty State -->
	<div class="async-content-state" transition:fade={{ duration: 150 }}>
		{#if emptySlot}
			{@render emptySlot()}
		{:else}
			<!-- Default Empty State -->
			<EmptyState title="No Items Found" message={emptyMessage} />
		{/if}
	</div>
{:else}
	<!-- Content State -->
	<div class="async-content-state" transition:fade={{ duration: 150 }}>
		{@render children()}
	</div>
{/if}

<style>
	/**
	 * State Container
	 *
	 * Simple wrapper for transition animations.
	 * No layout constraints - content determines size.
	 */
	.async-content-state {
		width: 100%;
	}
</style>
