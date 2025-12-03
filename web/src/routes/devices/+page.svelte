<script lang="ts">
	/**
	 * Devices Page Route
	 *
	 * Main page for viewing and controlling SmartThings devices.
	 *
	 * Features:
	 * - Real-time device list with SSE updates
	 * - Search and filter capabilities
	 * - Device control (on/off, dimming, etc.)
	 * - Room-based filtering via URL parameters
	 * - Responsive layout
	 *
	 * Architecture:
	 * - Single DeviceListContainer component
	 * - All state managed by device store
	 * - SSE connection for live updates
	 * - URL parameter handling for room filtering
	 *
	 * URL Parameters:
	 * - ?room={roomId} - Filter devices by room
	 */

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
	import { getRoomStore } from '$lib/stores/roomStore.svelte';
	import DeviceListContainer from '$lib/components/devices/DeviceListContainer.svelte';
	import Breadcrumb from '$lib/components/layout/Breadcrumb.svelte';
	import { getRoomIcon } from '$lib/utils/roomIcons';

	const deviceStore = getDeviceStore();
	const roomStore = getRoomStore();

	// Extract room ID from URL query parameters
	let roomId = $derived($page.url.searchParams.get('room'));

	// Get room details for displaying room name and icon
	let selectedRoom = $derived(roomId ? roomStore.getRoomById(roomId) : null);
	let roomName = $derived(selectedRoom?.name ?? null);

	// Enhance selectedRoom with icon property for Breadcrumb component
	let selectedRoomWithIcon = $derived(
		selectedRoom
			? { ...selectedRoom, icon: getRoomIcon(selectedRoom.name) }
			: null
	);

	// Determine if we should show loading state in breadcrumb
	// Loading when: roomId exists but selectedRoom is null (room data not loaded yet)
	let breadcrumbLoading = $derived(Boolean(roomId && !selectedRoom));

	// Apply room filter when URL parameter changes
	$effect(() => {
		if (roomId) {
			deviceStore.setSelectedRoomId(roomId);
		} else {
			deviceStore.setSelectedRoomId(null);
		}
	});

	// Navigation handlers
	function clearRoomFilter() {
		goto('/devices');
	}
</script>

<svelte:head>
	<title>
		{roomId && roomName ? `${roomName} Devices` : 'Devices'} - Smarter Things
	</title>
	<meta name="description" content="View and control your smart home devices" />
</svelte:head>

<div class="devices-page">
	<!-- Breadcrumb / Navigation Header (only shown when filtering by room) -->
	{#if roomId}
		<!-- New Breadcrumb Component -->
		<Breadcrumb
			selectedRoom={selectedRoomWithIcon}
			loading={breadcrumbLoading}
			onShowAll={clearRoomFilter}
		/>

		<!-- Room Header (Simplified - breadcrumb now handles navigation) -->
		<div class="mb-6">
			{#if roomName}
				<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
					{roomName}
				</h1>
				<p class="text-gray-600 dark:text-gray-400 mt-1">
					Devices in this room
				</p>
			{:else}
				<!-- Loading skeleton for room header -->
				<div class="skeleton-title"></div>
				<div class="skeleton-subtitle"></div>
			{/if}
		</div>
	{/if}

	<!-- Device List Container -->
	<DeviceListContainer />
</div>

<style>
	.devices-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
		padding-bottom: 3rem;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.devices-page {
			padding: 1.5rem 1rem;
			padding-bottom: 2rem;
		}
	}

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.devices-page {
			padding: 1.75rem 1.5rem;
			padding-bottom: 2.5rem;
		}
	}

	/* Loading skeletons */
	.skeleton-title {
		width: 16rem;
		height: 2.25rem;
		background: linear-gradient(90deg, rgb(243, 244, 246) 25%, rgb(229, 231, 235) 50%, rgb(243, 244, 246) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.skeleton-subtitle {
		width: 10rem;
		height: 1.25rem;
		background: linear-gradient(90deg, rgb(243, 244, 246) 25%, rgb(229, 231, 235) 50%, rgb(243, 244, 246) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.375rem;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (max-width: 768px) {
		.skeleton-title {
			width: 12rem;
			height: 1.875rem;
		}

		.skeleton-subtitle {
			width: 8rem;
		}
	}
</style>
