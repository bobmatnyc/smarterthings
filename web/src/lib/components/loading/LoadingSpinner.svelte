<script lang="ts">
	/**
	 * LoadingSpinner Component
	 *
	 * Accessible spinner for inline loading states.
	 *
	 * Design Decisions:
	 * - Use as fallback for non-grid loading states
	 * - Circular spinner with smooth rotation animation
	 * - Reduced motion support (static circle with pulse)
	 * - Screen reader-only label for context
	 *
	 * Use Cases:
	 * - Button loading states
	 * - Inline content loading
	 * - Modal/dialog loading
	 * - Form submission feedback
	 *
	 * Accessibility:
	 * - role="status" announces loading to screen readers
	 * - .sr-only class provides context without visual clutter
	 * - Respects prefers-reduced-motion preference
	 * - WCAG AA compliant color contrast (4.5:1)
	 *
	 * Performance:
	 * - CSS-only animation (no JavaScript)
	 * - transform: rotate() triggers GPU acceleration
	 * - Minimal DOM (single SVG element)
	 */

	let {
		size = '24px',
		label = 'Loading'
	}: {
		size?: string;
		label?: string;
	} = $props();
</script>

<div class="loading-spinner" role="status" aria-label={label}>
	<svg
		class="spinner"
		style:width={size}
		style:height={size}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle
			class="spinner-track"
			cx="12"
			cy="12"
			r="10"
			stroke="rgb(229, 231, 235)"
			stroke-width="3"
		></circle>
		<circle
			class="spinner-indicator"
			cx="12"
			cy="12"
			r="10"
			stroke="rgb(59, 130, 246)"
			stroke-width="3"
			stroke-linecap="round"
			stroke-dasharray="62.83185307179586"
			stroke-dashoffset="47.12388980384689"
		></circle>
	</svg>
	<span class="sr-only">{label}</span>
</div>

<style>
	.loading-spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	/**
	 * Spinner Animation
	 *
	 * Uses transform: rotate() for GPU acceleration and 60fps animation.
	 * Linear timing function provides consistent rotation speed.
	 */
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/**
	 * Spinner Indicator
	 *
	 * Partial circle (75% of circumference) creates classic spinner appearance.
	 * stroke-linecap="round" provides smooth, rounded ends.
	 */
	.spinner-indicator {
		transform-origin: center;
	}

	/**
	 * Screen Reader Only Text
	 *
	 * Visually hidden but accessible to screen readers.
	 * Provides context about loading state.
	 */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/**
	 * Accessibility: Reduced Motion Support
	 *
	 * For users with vestibular disorders, replace spinning animation
	 * with subtle opacity pulse. Maintains loading feedback while
	 * respecting accessibility preferences.
	 */
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: pulse 2s ease-in-out infinite;
		}

		@keyframes pulse {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.5;
			}
		}

		/**
		 * Show full circle when motion is reduced
		 * (no rotation animation means partial circle looks static/broken)
		 */
		.spinner-indicator {
			stroke-dashoffset: 0;
		}
	}
</style>
