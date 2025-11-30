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
	 * - Responsive layout
	 *
	 * Architecture:
	 * - Single DeviceListContainer component
	 * - All state managed by device store
	 * - SSE connection for live updates
	 */

	import DeviceListContainer from '$lib/components/devices/DeviceListContainer.svelte';
</script>

<svelte:head>
	<title>Devices - Smarter Things</title>
	<meta name="description" content="View and control your smart home devices" />
</svelte:head>

<DeviceListContainer />
