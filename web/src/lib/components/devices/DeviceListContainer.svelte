<script lang="ts">
	/**
	 * Device List Container Component
	 *
	 * Main container that orchestrates the device list UI.
	 *
	 * Architecture:
	 * - Device store for state management (Svelte 5 runes)
	 * - SSE connection for real-time updates
	 * - Filter, grid, and card components
	 * - Loading, error, and empty states
	 *
	 * Lifecycle:
	 * 1. Load devices on mount
	 * 2. Establish SSE connection
	 * 3. Render filtered device grid
	 * 4. Cleanup SSE on unmount
	 *
	 * Performance:
	 * - Fine-grained reactivity (Svelte 5)
	 * - Efficient filtering with $derived
	 * - Minimal re-renders
	 */

	import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
	import { connectDeviceSSE } from '$lib/sse/deviceStream.svelte';
	import DeviceFilter from './DeviceFilter.svelte';
	import DeviceGrid from './DeviceGrid.svelte';
	import SkeletonGrid from '$lib/components/loading/SkeletonGrid.svelte';

	const store = getDeviceStore();

	/**
	 * Load devices and connect SSE on mount
	 */
	$effect(() => {
		// Load devices from API
		store.loadDevices();

		// Connect to SSE stream for real-time updates
		const cleanup = connectDeviceSSE(store);

		// Cleanup SSE connection on unmount
		return () => {
			cleanup();
		};
	});
</script>

<div class="container mx-auto p-4 space-y-6">
	<!-- Header with Stats and Connection Status -->
	<header class="flex items-center justify-between flex-wrap gap-4">
		<div>
			<h1 class="h1 text-3xl font-bold mb-2">Devices</h1>
			<div class="flex items-center gap-4 text-sm">
				<span class="text-green-600 dark:text-green-400 font-semibold">
					{store.stats.online} online
				</span>
				<span class="text-gray-500 dark:text-gray-400">{store.stats.offline} offline</span>
				<span class="text-gray-700 dark:text-gray-300">{store.stats.total} total</span>
			</div>
		</div>

		<!-- SSE Connection Status -->
		<div>
			{#if store.sseConnected}
				<span class="badge variant-filled-success gap-2">
					<span class="w-2 h-2 bg-white rounded-full animate-pulse" aria-hidden="true"></span>
					<span>Live</span>
				</span>
			{:else}
				<span class="badge variant-filled-warning gap-2">
					<span class="w-2 h-2 bg-white rounded-full" aria-hidden="true"></span>
					<span>Connecting...</span>
				</span>
			{/if}
		</div>
	</header>

	<!-- Filter Controls -->
	<DeviceFilter
		rooms={store.availableRooms}
		types={store.availableTypes}
		onFilterChange={(filters) => {
			store.setSearchQuery(filters.searchQuery);
			store.setSelectedRoom(filters.selectedRoom);
			store.setSelectedType(filters.selectedType);
			store.setSelectedCapabilities(filters.selectedCapabilities);
		}}
	/>

	<!-- Loading State -->
	{#if store.loading}
		<SkeletonGrid count={8} variant="device" />

	<!-- Error State -->
	{:else if store.error}
		<div class="alert variant-filled-error">
			<div class="flex items-center gap-3">
				<span class="text-2xl" aria-hidden="true">⚠️</span>
				<div>
					<h3 class="font-bold">Error Loading Devices</h3>
					<p class="text-sm">{store.error}</p>
				</div>
			</div>
			<div class="flex gap-2 mt-4">
				<button class="btn variant-filled-surface" onclick={() => store.loadDevices()}>
					Retry
				</button>
			</div>
		</div>

	<!-- Empty State (no devices or no matches) -->
	{:else if store.filteredDevices.length === 0}
		<div class="card p-12 text-center bg-surface-100 dark:bg-surface-800">
			<div class="text-6xl mb-4" aria-hidden="true">
				{#if store.searchQuery || store.selectedRoom || store.selectedType}
					🔍
				{:else}
					📱
				{/if}
			</div>
			<h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
				{#if store.searchQuery || store.selectedRoom || store.selectedType}
					No devices match your filters
				{:else}
					No devices found
				{/if}
			</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-6">
				{#if store.searchQuery || store.selectedRoom || store.selectedType}
					Try adjusting your search criteria
				{:else}
					Add devices to get started
				{/if}
			</p>
			{#if store.searchQuery || store.selectedRoom || store.selectedType}
				<button class="btn variant-filled-primary" onclick={store.clearFilters}>
					Clear Filters
				</button>
			{/if}
		</div>

	<!-- Device Grid (success state) -->
	{:else}
		<div>
			<!-- Results Count -->
			<div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Showing {store.filteredDevices.length} of {store.stats.total} devices
			</div>

			<!-- Grid -->
			<DeviceGrid devices={store.filteredDevices} />
		</div>
	{/if}
</div>
