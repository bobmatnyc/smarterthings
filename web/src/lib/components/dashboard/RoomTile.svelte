<script lang="ts">
	/**
	 * Room Tile Component for Mondrian Dashboard
	 *
	 * Design: Compact room display with device mini-cards
	 * - Room name header
	 * - Device count badge
	 * - Nested grid of device mini-cards (placeholder for now)
	 * - Mondrian border style (2px solid black)
	 * - Room-specific subtle background color
	 *
	 * Performance:
	 * - Lightweight component, minimal re-renders
	 * - CSS Grid for device layout
	 */

	import type { Room } from '$lib/stores/roomStore.svelte';
	import type { UnifiedDevice } from '$types';
	import DeviceMiniCard from './DeviceMiniCard.svelte';

	let { room, devices }: {
		room: Room;
		devices: UnifiedDevice[];
	} = $props();

	/**
	 * Generate room-specific background color
	 * Uses room ID to create consistent hue-based color
	 */
	function getRoomColor(roomId: string): string {
		// Simple hash to generate consistent hue (0-360)
		let hash = 0;
		for (let i = 0; i < roomId.length; i++) {
			hash = roomId.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = Math.abs(hash % 360);

		// Return very subtle pastel color (low saturation, high lightness)
		return `hsl(${hue}, 25%, 96%)`;
	}

	let backgroundColor = $derived(getRoomColor(room.roomId));
</script>

<div class="room-tile" style="background-color: {backgroundColor};">
	<!-- Room Header -->
	<div class="room-header">
		<h3 class="room-name">{room.name}</h3>
		<span class="device-count-badge">{devices.length}</span>
	</div>

	<!-- Device Mini-Cards -->
	<div class="devices-grid">
		{#each devices as device (device.id)}
			<DeviceMiniCard {device} />
		{/each}
	</div>
</div>

<style>
	.room-tile {
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		height: 100%;
		overflow: hidden;
	}

	/* Room Header */
	.room-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
	}

	.room-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.device-count-badge {
		background: rgb(59, 130, 246);
		color: white;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		min-width: 1.5rem;
		text-align: center;
	}

	/* Device Grid */
	.devices-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
		gap: 0.75rem;
		overflow-y: auto;
		flex: 1;
	}

	/* Mobile: Adjust grid */
	@media (max-width: 767px) {
		.room-tile {
			padding: 1rem;
		}

		.room-header {
			margin-bottom: 0.75rem;
		}

		.room-name {
			font-size: 1rem;
		}

		.devices-grid {
			grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
			gap: 0.5rem;
		}
	}
</style>
