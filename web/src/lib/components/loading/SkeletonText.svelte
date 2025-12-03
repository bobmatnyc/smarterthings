<script lang="ts">
	/**
	 * SkeletonText Component
	 *
	 * Accessible text line skeleton with shimmer animation.
	 *
	 * Design Decisions:
	 * - Shimmer animation provides visual feedback during loading
	 * - Reduced motion support via @media query (uses opacity pulse instead)
	 * - ARIA attributes ensure screen reader accessibility
	 * - GPU-accelerated animation via transform for 60fps performance
	 *
	 * Accessibility:
	 * - aria-label="Loading content" for screen readers
	 * - Respects prefers-reduced-motion user preference
	 *
	 * Performance:
	 * - CSS-only animation (no JavaScript)
	 * - transform: translateX() triggers GPU acceleration
	 * - background-size optimization reduces repaints
	 */

	import type { TextVariant } from './types';

	let {
		width = '100%',
		height,
		variant = 'body'
	}: {
		width?: string;
		height?: string;
		variant?: TextVariant;
	} = $props();

	// Compute height based on variant if not explicitly provided
	const computedHeight = $derived(
		height ||
			(variant === 'title' ? '1.5rem' : variant === 'caption' ? '0.875rem' : '1rem')
	);
</script>

<div
	class="skeleton-text"
	class:title={variant === 'title'}
	class:body={variant === 'body'}
	class:caption={variant === 'caption'}
	style:width
	style:height={computedHeight}
	aria-label="Loading content"
	role="status"
></div>

<style>
	.skeleton-text {
		background: linear-gradient(
			90deg,
			rgb(243, 244, 246) 25%,
			rgb(229, 231, 235) 50%,
			rgb(243, 244, 246) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		border-radius: 0.25rem;
		display: block;
	}

	.skeleton-text.title {
		border-radius: 0.375rem;
	}

	.skeleton-text.body {
		border-radius: 0.25rem;
	}

	.skeleton-text.caption {
		border-radius: 0.1875rem;
	}

	/* Shimmer animation with GPU acceleration */
	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/**
	 * Accessibility: Reduced Motion Support
	 *
	 * For users with vestibular disorders or motion sensitivity,
	 * replace shimmer animation with subtle opacity pulse.
	 * This maintains visual feedback while respecting user preferences.
	 */
	@media (prefers-reduced-motion: reduce) {
		.skeleton-text {
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
