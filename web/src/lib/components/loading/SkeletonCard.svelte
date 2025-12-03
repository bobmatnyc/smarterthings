<script lang="ts">
	/**
	 * SkeletonCard Component
	 *
	 * Generic card skeleton with variant-specific layouts.
	 *
	 * Design Decisions:
	 * - Different variants match specific entity card layouts
	 * - Reuses SkeletonIcon and SkeletonText for consistency
	 * - Layout matches actual card components (RuleCard, AutomationCard, etc.)
	 *
	 * Variants:
	 * - rule: Icon + title + subtitle + button (horizontal layout)
	 * - automation: Icon + title + subtitle + toggle (horizontal layout)
	 * - room: Icon + title + count (vertical layout)
	 * - device: Icon + title + subtitle (vertical layout)
	 * - installedapp: Icon + title + subtitle (horizontal layout)
	 *
	 * Accessibility:
	 * - role="status" indicates loading state
	 * - aria-label provides context for screen readers
	 * - aria-busy="true" signals dynamic content loading
	 *
	 * Performance:
	 * - Minimal DOM nodes (optimized for rendering 6-12 cards)
	 * - CSS-only animations (no JavaScript)
	 */

	import SkeletonIcon from './SkeletonIcon.svelte';
	import SkeletonText from './SkeletonText.svelte';
	import type { SkeletonVariant } from './types';

	let {
		variant = 'rule'
	}: {
		variant?: SkeletonVariant;
	} = $props();
</script>

{#if variant === 'rule' || variant === 'automation' || variant === 'installedapp'}
	<!-- Horizontal Layout: Icon + Content + Action -->
	<div
		class="skeleton-card horizontal"
		role="status"
		aria-label="Loading {variant}"
		aria-busy="true"
	>
		<div class="skeleton-header">
			<SkeletonIcon size="3rem" shape="square" />
			<div class="skeleton-content">
				<SkeletonText variant="title" width="60%" />
				<SkeletonText variant="body" width="80%" />
			</div>
			{#if variant === 'rule'}
				<SkeletonIcon size="3rem" shape="circle" />
			{:else if variant === 'automation'}
				<div class="skeleton-toggle"></div>
			{:else if variant === 'installedapp'}
				<SkeletonIcon size="2.5rem" shape="circle" />
			{/if}
		</div>
	</div>
{:else if variant === 'room' || variant === 'device'}
	<!-- Vertical Layout: Icon + Title + Metadata -->
	<div
		class="skeleton-card vertical"
		role="status"
		aria-label="Loading {variant}"
		aria-busy="true"
	>
		<SkeletonIcon size="3.5rem" shape="square" />
		<SkeletonText variant="title" width="60%" />
		<SkeletonText variant="caption" width="40%" />
	</div>
{/if}

<style>
	.skeleton-card {
		background: white;
		border-radius: 1rem;
		padding: 1.5rem;
		border: 1px solid rgb(229, 231, 235);
	}

	.skeleton-card.horizontal {
		min-height: 140px;
	}

	.skeleton-card.vertical {
		min-height: 160px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.skeleton-header {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/**
	 * Toggle Switch Skeleton
	 *
	 * Mimics the toggle switch found in automation cards.
	 * Uses same shimmer animation for visual consistency.
	 */
	.skeleton-toggle {
		width: 3rem;
		height: 1.75rem;
		background: linear-gradient(
			90deg,
			rgb(243, 244, 246) 25%,
			rgb(229, 231, 235) 50%,
			rgb(243, 244, 246) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/**
	 * Mobile Responsiveness
	 *
	 * Reduce padding and min-height on mobile for better space utilization.
	 */
	@media (max-width: 768px) {
		.skeleton-card {
			padding: 1.25rem;
		}

		.skeleton-card.horizontal {
			min-height: 120px;
		}

		.skeleton-card.vertical {
			min-height: 140px;
			gap: 1rem;
		}
	}

	/**
	 * Accessibility: Reduced Motion Support
	 */
	@media (prefers-reduced-motion: reduce) {
		.skeleton-toggle {
			animation: pulse 2s ease-in-out infinite;
			background: rgb(229, 231, 235);
		}

		@keyframes pulse {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.6;
			}
		}
	}
</style>
