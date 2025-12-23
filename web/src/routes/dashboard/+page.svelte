<script lang="ts">
	/**
	 * Dashboard Page - Mondrian Kiosk Dashboard
	 *
	 * Design: Room-based Mondrian grid with kiosk mode support
	 *
	 * Features:
	 * - Fetch rooms and devices from existing stores
	 * - MondrianGrid component for visual layout
	 * - StatusCrawler placeholder at top
	 * - Config button (gear icon) in bottom-right corner
	 * - Kiosk mode toggle
	 *
	 * Architecture:
	 * - Integrates with roomStore and deviceStore
	 * - Uses dashboardStore for kiosk mode and visibility filters
	 * - Loads data on mount
	 */

	import { onMount } from 'svelte';
	import { getRoomStore } from '$lib/stores/roomStore.svelte';
	import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
	import { getDashboardStore } from '$lib/stores/dashboardStore.svelte';
	import { getEventsStore } from '$lib/stores/eventsStore.svelte';
	import { getAlertStore } from '$lib/stores/alertStore.svelte';
	import MondrianGrid from '$lib/components/dashboard/MondrianGrid.svelte';
	import LoadingSpinner from '$lib/components/loading/LoadingSpinner.svelte';
	import StatusCrawler from '$lib/components/dashboard/StatusCrawler.svelte';
	import AlertOverlay from '$lib/components/dashboard/AlertOverlay.svelte';
	import ConfigModal from '$lib/components/dashboard/ConfigModal.svelte';
	import DashboardErrorBoundary from '$lib/components/dashboard/DashboardErrorBoundary.svelte';

	const roomStore = getRoomStore();
	const deviceStore = getDeviceStore();
	const dashboardStore = getDashboardStore();
	const eventsStore = getEventsStore();
	const alertStore = getAlertStore();

	let showConfig = $state(false);

	/**
	 * Event buffer for batched alert analysis
	 * Design Decision: 5-second buffer window
	 * Rationale: Balance between real-time alerts and API cost.
	 * Buffering reduces LLM calls while maintaining responsiveness.
	 */
	let eventBuffer: any[] = [];
	let bufferTimeout: NodeJS.Timeout | null = null;
	const BUFFER_WINDOW_MS = 5000; // 5 seconds

	/**
	 * Rate limiting for alert analysis
	 * Design Decision: Max 6 calls per minute
	 * Rationale: Prevents API abuse while allowing responsive alerts.
	 */
	let lastAnalysisTime = 0;
	const MIN_ANALYSIS_INTERVAL_MS = 10000; // 10 seconds between calls

	/**
	 * Analyze buffered events for alerts
	 */
	async function analyzeBufferedEvents() {
		if (eventBuffer.length === 0) return;

		// Check rate limiting
		const now = Date.now();
		if (now - lastAnalysisTime < MIN_ANALYSIS_INTERVAL_MS) {
			console.log('[Dashboard] Skipping analysis due to rate limiting');
			return;
		}

		// Get events to analyze (copy and clear buffer)
		const eventsToAnalyze = [...eventBuffer];
		eventBuffer = [];

		console.log(`[Dashboard] Analyzing ${eventsToAnalyze.length} buffered events for alerts`);

		try {
			// Call backend API for alert analysis
			const response = await fetch('http://localhost:5182/api/dashboard/analyze-event', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					events: eventsToAnalyze
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.data.alerts.length > 0) {
				console.log(`[Dashboard] ${result.data.alerts.length} alerts detected`);

				// Add alerts to store
				result.data.alerts.forEach((alert: any) => {
					alertStore.addAlert({
						priority: alert.priority,
						message: alert.message,
						category: alert.category
					});
				});
			}

			lastAnalysisTime = now;
		} catch (error) {
			console.error('[Dashboard] Failed to analyze events:', error);
		}
	}

	/**
	 * Buffer event for analysis
	 */
	function bufferEvent(event: any) {
		eventBuffer.push(event);

		// Clear existing timeout
		if (bufferTimeout) {
			clearTimeout(bufferTimeout);
		}

		// Set new timeout to analyze after buffer window
		bufferTimeout = setTimeout(() => {
			analyzeBufferedEvents();
			bufferTimeout = null;
		}, BUFFER_WINDOW_MS);
	}

	onMount(() => {
		// Load rooms and devices
		Promise.all([
			roomStore.loadRooms(),
			deviceStore.loadDevices()
		]).catch(error => {
			console.error('[Dashboard] Failed to load data:', error);
		});

		// Connect to SSE stream for alert analysis (if alerts enabled)
		if (dashboardStore.showAlerts) {
			eventsStore.connectSSE();

			// Watch for new events from SSE
			let previousEventCount = eventsStore.events.length;

			// Subscribe to event changes
			$effect(() => {
				const currentEventCount = eventsStore.events.length;

				// If new events arrived
				if (currentEventCount > previousEventCount) {
					const newEvents = eventsStore.events.slice(0, currentEventCount - previousEventCount);
					newEvents.forEach((event) => bufferEvent(event));
				}

				previousEventCount = currentEventCount;
			});
		}

		// Cleanup on unmount
		return () => {
			if (bufferTimeout) {
				clearTimeout(bufferTimeout);
			}
			eventsStore.disconnectSSE();
		};
	});

	function toggleConfig() {
		showConfig = !showConfig;
	}

	function toggleKioskMode() {
		dashboardStore.toggleKioskMode();
	}
</script>

<svelte:head>
	<title>Dashboard - Smarter Things</title>
	<meta name="description" content="Mondrian-style smart home dashboard" />
</svelte:head>

<DashboardErrorBoundary>
	<div class="dashboard-container">
		<!-- Status Crawler with LLM Summary -->
		{#if dashboardStore.showStatusCrawler}
			<StatusCrawler />
		{/if}

		<!-- Alert Overlay (if alerts enabled) -->
		{#if dashboardStore.showAlerts}
			<AlertOverlay />
		{/if}

		<!-- Main Content -->
		{#if roomStore.loading || deviceStore.loading}
			<!-- Loading State -->
			<div class="loading-container">
				<LoadingSpinner size="48px" label="Loading dashboard" />
				<p class="loading-text">Fetching your rooms and devices...</p>
			</div>
		{:else if roomStore.error || deviceStore.error}
			<!-- Error State -->
			<div class="error-container">
				<div class="error-icon">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				</div>
				<h2 class="error-title">Failed to Load Dashboard</h2>
				<p class="error-description">
					{roomStore.error || deviceStore.error}
				</p>
				<button class="retry-button" onclick={() => { roomStore.loadRooms(); deviceStore.loadDevices(); }}>
					Try Again
				</button>
			</div>
		{:else}
			<!-- Mondrian Grid -->
			<MondrianGrid
				rooms={roomStore.rooms}
				devices={deviceStore.devices}
				hiddenRooms={dashboardStore.hiddenRooms}
			/>
		{/if}

		<!-- Config Button (bottom-right, always visible) -->
		<button
			class="config-button"
			onclick={toggleConfig}
			aria-label="Dashboard settings"
			title="Dashboard settings"
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3"></circle>
				<path d="M12 1v6m0 6v6m5.196-15.392l-3 3m-6.392 6.392l-3 3m15.392-.196l-3-3m-6.392-6.392l-3-3"></path>
			</svg>
		</button>

		<!-- Config Modal -->
		{#if showConfig}
			<ConfigModal
				rooms={roomStore.rooms}
				devices={deviceStore.devices}
				onClose={toggleConfig}
			/>
		{/if}
	</div>
</DashboardErrorBoundary>

<style>
	.dashboard-container {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: calc(100vh - 12rem);
	}

	/* Loading/Error States */
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 400px;
	}

	.loading-text {
		margin-top: 1rem;
		font-size: 1rem;
		color: rgb(107, 114, 128);
	}

	.error-icon {
		width: 5rem;
		height: 5rem;
		background: linear-gradient(135deg, rgb(254, 242, 242) 0%, rgb(254, 226, 226) 100%);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(239, 68, 68);
		margin-bottom: 1.5rem;
	}

	.error-icon svg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.error-title {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.error-description {
		margin: 0 0 1.5rem;
		max-width: 28rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
	}

	.retry-button {
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.retry-button:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	/* Config Button - Always visible, semi-transparent in kiosk mode */
	.config-button {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		width: 3.5rem;
		height: 3.5rem;
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: all 0.2s ease;
		z-index: 50;
	}

	.config-button:hover {
		background: rgb(37, 99, 235);
		transform: scale(1.1);
	}

	.config-button svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.config-button {
			bottom: 1.5rem;
			right: 1.5rem;
			width: 3rem;
			height: 3rem;
		}
	}
</style>
