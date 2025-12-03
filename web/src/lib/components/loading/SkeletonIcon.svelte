<script lang="ts">
	/**
	 * SkeletonIcon Component
	 *
	 * Accessible icon skeleton placeholder with shape variants.
	 *
	 * Design Decisions:
	 * - Supports both circular and square icons
	 * - Shimmer animation matches SkeletonText for visual consistency
	 * - Reduced motion support for accessibility
	 *
	 * Accessibility:
	 * - aria-label for screen reader context
	 * - role="status" indicates loading state
	 *
	 * Performance:
	 * - CSS-only animation (no JavaScript overhead)
	 * - GPU-accelerated via background-position transform
	 */

	import type { IconShape } from './types';

	let {
		size = '24px',
		shape = 'circle'
	}: {
		size?: string;
		shape?: IconShape;
	} = $props();
</script>

<div
	class="skeleton-icon"
	class:circle={shape === 'circle'}
	class:square={shape === 'square'}
	style:width={size}
	style:height={size}
	aria-label="Loading icon"
	role="status"
></div>

<style>
	.skeleton-icon {
		background: linear-gradient(
			90deg,
			rgb(243, 244, 246) 25%,
			rgb(229, 231, 235) 50%,
			rgb(243, 244, 246) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		flex-shrink: 0;
		display: block;
	}

	.skeleton-icon.circle {
		border-radius: 50%;
	}

	.skeleton-icon.square {
		border-radius: 0.5rem;
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
	 * Replace shimmer with opacity pulse for users who prefer reduced motion.
	 * Maintains loading feedback while respecting accessibility preferences.
	 */
	@media (prefers-reduced-motion: reduce) {
		.skeleton-icon {
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
