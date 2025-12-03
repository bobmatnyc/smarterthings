<script lang="ts">
	/**
	 * SkeletonGrid Component
	 *
	 * Responsive grid of skeleton cards matching entity-specific layouts.
	 *
	 * Design Decisions:
	 * - Grid layout matches actual data grid components
	 * - Responsive breakpoints match RulesGrid, AutomationsGrid, etc.
	 * - ARIA live region announces loading state to screen readers
	 *
	 * Responsive Breakpoints:
	 * - Mobile (<768px): 1 column
	 * - Tablet (768-1024px): 2 columns (rules, automations, installedapps)
	 * - Tablet (768-1024px): 2-3 columns (rooms, devices)
	 * - Desktop (1024-1440px): 2-3 columns
	 * - Large Desktop (>1440px): 3-4 columns
	 *
	 * Accessibility:
	 * - aria-live="polite" announces loading without interrupting
	 * - aria-busy="true" signals dynamic content loading
	 * - Individual cards have role="status" for granular feedback
	 *
	 * Performance:
	 * - CSS Grid for efficient layout
	 * - Array iteration optimized for typical counts (6-12 cards)
	 * - No unnecessary re-renders (static during loading)
	 */

	import SkeletonCard from './SkeletonCard.svelte';
	import type { SkeletonVariant } from './types';

	let {
		count = 6,
		variant = 'rule'
	}: {
		count?: number;
		variant?: SkeletonVariant;
	} = $props();
</script>

<div
	class="skeleton-grid"
	class:rule-variant={variant === 'rule'}
	class:automation-variant={variant === 'automation'}
	class:room-variant={variant === 'room'}
	class:device-variant={variant === 'device'}
	class:installedapp-variant={variant === 'installedapp'}
	aria-live="polite"
	aria-busy="true"
>
	{#each Array(count) as _, i (i)}
		<SkeletonCard {variant} />
	{/each}
</div>

<style>
	/**
	 * Base Grid Layout
	 *
	 * Uses CSS Grid with auto-fill for responsive behavior.
	 * Different variants have different column widths based on content.
	 */
	.skeleton-grid {
		display: grid;
		gap: 1.5rem;
	}

	/**
	 * Rule, Automation, InstalledApp Variants
	 *
	 * Wider cards (320px minimum) for horizontal layout.
	 * Breakpoints:
	 * - Mobile: 1 column
	 * - Tablet: 2 columns
	 * - Desktop: 2 columns
	 * - Large Desktop: 3 columns
	 */
	.skeleton-grid.rule-variant,
	.skeleton-grid.automation-variant,
	.skeleton-grid.installedapp-variant {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	}

	@media (min-width: 768px) and (max-width: 1439px) {
		.skeleton-grid.rule-variant,
		.skeleton-grid.automation-variant,
		.skeleton-grid.installedapp-variant {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1440px) {
		.skeleton-grid.rule-variant,
		.skeleton-grid.automation-variant,
		.skeleton-grid.installedapp-variant {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/**
	 * Room, Device Variants
	 *
	 * Narrower cards (280px minimum) for vertical layout.
	 * Breakpoints:
	 * - Mobile: 1 column
	 * - Tablet: 2-3 columns
	 * - Desktop: 3 columns
	 * - Large Desktop: 4 columns
	 */
	.skeleton-grid.room-variant,
	.skeleton-grid.device-variant {
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	@media (min-width: 768px) and (max-width: 1023px) {
		.skeleton-grid.room-variant,
		.skeleton-grid.device-variant {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) and (max-width: 1439px) {
		.skeleton-grid.room-variant,
		.skeleton-grid.device-variant {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 1440px) {
		.skeleton-grid.room-variant,
		.skeleton-grid.device-variant {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	/**
	 * Mobile Responsiveness
	 *
	 * Single column layout with reduced gap on mobile devices.
	 */
	@media (max-width: 768px) {
		.skeleton-grid {
			gap: 1rem;
			grid-template-columns: 1fr;
		}
	}
</style>
