<script lang="ts">
	/**
	 * Rooms Page Route
	 *
	 * Main page for viewing all rooms in the SmartThings account.
	 *
	 * Features:
	 * - Displays all rooms in responsive grid layout
	 * - Loading skeletons during data fetch
	 * - Empty state when no rooms exist
	 * - Click room card to navigate to devices filtered by room
	 *
	 * Architecture:
	 * - Single RoomsGrid component handles all UI
	 * - roomStore manages state and API calls
	 * - Leverages existing room components and styling
	 */

	import RoomsGrid from '$lib/components/rooms/RoomsGrid.svelte';
</script>

<svelte:head>
	<title>Rooms - Smarter Things</title>
	<meta name="description" content="View and manage your smart home rooms" />
</svelte:head>

<div class="rooms-page">
	<RoomsGrid />
</div>

<style>
	.rooms-page {
		min-height: 100vh;
	}
</style>
