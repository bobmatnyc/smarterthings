<script lang="ts">
	/**
	 * StatusCrawler - Scrolling status bar for dashboard
	 *
	 * Design Decision: CSS animation for smooth scrolling
	 * Rationale: Hardware-accelerated CSS transforms provide smooth 60fps scrolling
	 * without JavaScript animation loops. Auto-fetches summary every 30s.
	 *
	 * Architecture:
	 * - Fetch summary from /api/dashboard/summary every 30s
	 * - CSS translateX animation for continuous scroll
	 * - Error state with retry logic
	 * - Loading state during fetch
	 *
	 * Performance:
	 * - CSS transform uses GPU acceleration
	 * - Scroll speed configurable (default: 60s per cycle)
	 * - Lightweight component (<1ms render)
	 */

	import { onMount, onDestroy } from 'svelte';

	// ============================================================================
	// STATE (Svelte 5 Runes)
	// ============================================================================

	let summary = $state<string>('Loading smart home status...');
	let eventCount = $state<number>(0);
	let loading = $state<boolean>(true);
	let error = $state<boolean>(false);
	let lastUpdate = $state<string>('');

	let fetchInterval: ReturnType<typeof setInterval> | null = null;

	// ============================================================================
	// DERIVED STATE
	// ============================================================================

	let displayText = $derived(error ? 'Unable to load status. Retrying...' : summary);

	// ============================================================================
	// LIFECYCLE
	// ============================================================================

	onMount(() => {
		// Initial fetch
		fetchSummary();

		// Fetch every 30 seconds
		fetchInterval = setInterval(fetchSummary, 30000);
	});

	onDestroy(() => {
		if (fetchInterval) {
			clearInterval(fetchInterval);
		}
	});

	// ============================================================================
	// ACTIONS
	// ============================================================================

	/**
	 * Fetch summary from API
	 */
	async function fetchSummary() {
		try {
			loading = true;
			error = false;

			const response = await fetch('/api/dashboard/summary');

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success && data.data) {
				summary = data.data.summary;
				eventCount = data.data.eventCount;
				lastUpdate = new Date().toLocaleTimeString();
				error = false;
			} else {
				throw new Error('Invalid response format');
			}
		} catch (err) {
			console.error('[StatusCrawler] Failed to fetch summary:', err);
			error = true;
		} finally {
			loading = false;
		}
	}
</script>

<div class="status-crawler" role="status" aria-live="polite" aria-label="Smart home status">
	<div class="crawler-inner">
		<div class="crawler-text" class:loading class:error>
			{displayText}
			{#if eventCount > 0}
				<span class="event-count">• {eventCount} events</span>
			{/if}
		</div>
		<div class="crawler-text" class:loading class:error aria-hidden="true">
			{displayText}
			{#if eventCount > 0}
				<span class="event-count">• {eventCount} events</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.status-crawler {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 50px;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
		z-index: 1000;
	}

	.crawler-inner {
		display: flex;
		height: 100%;
		align-items: center;
		white-space: nowrap;
		animation: crawl 60s linear infinite;
	}

	.crawler-text {
		display: inline-flex;
		align-items: center;
		padding: 0 3rem;
		font-size: 1rem;
		font-weight: 500;
		color: #ffffff;
		letter-spacing: 0.025em;
	}

	.crawler-text.loading {
		color: #94a3b8;
		animation: pulse 2s ease-in-out infinite;
	}

	.crawler-text.error {
		color: #f87171;
	}

	.event-count {
		margin-left: 1rem;
		font-size: 0.875rem;
		color: #94a3b8;
	}

	/* Scrolling animation */
	@keyframes crawl {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	/* Loading pulse */
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.status-crawler {
			height: 40px;
		}

		.crawler-text {
			font-size: 0.875rem;
			padding: 0 2rem;
		}

		.event-count {
			font-size: 0.75rem;
			margin-left: 0.75rem;
		}

		.crawler-inner {
			animation: crawl 45s linear infinite; /* Faster on mobile */
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.crawler-inner {
			animation: crawl 120s linear infinite; /* Slower for accessibility */
		}

		.crawler-text.loading {
			animation: none;
		}
	}
</style>
