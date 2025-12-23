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
	import MondrianGrid from '$lib/components/dashboard/MondrianGrid.svelte';
	import LoadingSpinner from '$lib/components/loading/LoadingSpinner.svelte';
	import StatusCrawler from '$lib/components/dashboard/StatusCrawler.svelte';

	const roomStore = getRoomStore();
	const deviceStore = getDeviceStore();
	const dashboardStore = getDashboardStore();

	let showConfig = $state(false);

	onMount(async () => {
		// Load rooms and devices
		await Promise.all([
			roomStore.loadRooms(),
			deviceStore.loadDevices()
		]);
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

<div class="dashboard-container">
	<!-- Status Crawler with LLM Summary -->
	{#if dashboardStore.showStatusCrawler}
		<StatusCrawler />
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

	<!-- Config Button (bottom-right) -->
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

	<!-- Config Panel -->
	{#if showConfig}
		<div class="config-panel">
			<div class="config-header">
				<h3>Dashboard Settings</h3>
				<button class="close-button" onclick={toggleConfig}>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="config-content">
				<!-- Kiosk Mode Toggle -->
				<div class="config-item">
					<label class="config-label">
						<input
							type="checkbox"
							checked={dashboardStore.kioskMode}
							onchange={toggleKioskMode}
						/>
						<span>Kiosk Mode</span>
					</label>
					<p class="config-description">Hide navigation for fullscreen display (press ESC to exit)</p>
				</div>

				<!-- Status Crawler Toggle -->
				<div class="config-item">
					<label class="config-label">
						<input
							type="checkbox"
							checked={dashboardStore.showStatusCrawler}
							onchange={(e) => dashboardStore.setShowStatusCrawler((e.target as HTMLInputElement).checked)}
						/>
						<span>Show Status Crawler</span>
					</label>
					<p class="config-description">Display status bar at the top</p>
				</div>

				<!-- Alerts Toggle -->
				<div class="config-item">
					<label class="config-label">
						<input
							type="checkbox"
							checked={dashboardStore.showAlerts}
							onchange={(e) => dashboardStore.setShowAlerts((e.target as HTMLInputElement).checked)}
						/>
						<span>Show Alerts</span>
					</label>
					<p class="config-description">Display device alerts and notifications</p>
				</div>
			</div>
		</div>

		<!-- Overlay backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="config-overlay" onclick={toggleConfig}></div>
	{/if}
</div>

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

	/* Config Button */
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

	/* Config Panel */
	.config-panel {
		position: fixed;
		top: 50%;
		right: 2rem;
		transform: translateY(-50%);
		background: white;
		border-radius: 1rem;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		width: 22rem;
		max-height: calc(100vh - 4rem);
		overflow-y: auto;
		z-index: 100;
	}

	.config-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid rgb(229, 231, 235);
	}

	.config-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.close-button {
		background: transparent;
		border: none;
		color: rgb(107, 114, 128);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background: rgb(243, 244, 246);
		color: rgb(17, 24, 39);
	}

	.close-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.config-content {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.config-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.config-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-weight: 500;
		color: rgb(17, 24, 39);
		cursor: pointer;
	}

	.config-label input[type="checkbox"] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	.config-description {
		margin: 0;
		font-size: 0.875rem;
		color: rgb(107, 114, 128);
		line-height: 1.5;
	}

	.config-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 90;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.config-button {
			bottom: 1.5rem;
			right: 1.5rem;
			width: 3rem;
			height: 3rem;
		}

		.config-panel {
			top: auto;
			bottom: 0;
			right: 0;
			left: 0;
			transform: none;
			width: 100%;
			max-height: 80vh;
			border-radius: 1rem 1rem 0 0;
		}
	}
</style>
