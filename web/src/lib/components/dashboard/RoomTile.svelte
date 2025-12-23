<script lang="ts">
	/**
	 * Room Tile Component for Mondrian Dashboard
	 *
	 * Design: Clickable room display with Mondrian-inspired colors
	 * - Room name header
	 * - Device count badge
	 * - Nested grid of device mini-cards
	 * - Mondrian colors: red, blue, yellow, white
	 * - Clickable navigation to room detail
	 *
	 * Performance:
	 * - Lightweight component, minimal re-renders
	 * - CSS Grid for device layout
	 */

	import { goto } from '$app/navigation';
	import type { Room } from '$lib/stores/roomStore.svelte';
	import type { UnifiedDevice } from '$types';
	import DeviceMiniCard from './DeviceMiniCard.svelte';

	let { room, devices, deviceCount }: {
		room: Room;
		devices: UnifiedDevice[];
		deviceCount?: number;
	} = $props();

	/**
	 * Mondrian-inspired color palette
	 * Primary colors: red, blue, yellow
	 * Neutral: white (with subtle tint)
	 */
	const MONDRIAN_COLORS = [
		'#FEFEFE', // White (subtle warm tint)
		'#FFE8E8', // Very light red
		'#E8F0FF', // Very light blue
		'#FFFBE8', // Very light yellow
		'#FFF5F5', // Another light red variant
		'#F0F5FF', // Another light blue variant
	];

	/**
	 * Generate consistent Mondrian-inspired color for room
	 */
	function getMondrianColor(roomId: string): string {
		// Hash room ID to get consistent color index
		let hash = 0;
		for (let i = 0; i < roomId.length; i++) {
			hash = roomId.charCodeAt(i) + ((hash << 5) - hash);
		}
		const index = Math.abs(hash % MONDRIAN_COLORS.length);
		return MONDRIAN_COLORS[index];
	}

	let backgroundColor = $derived(getMondrianColor(room.roomId));

	/**
	 * Handle room tile click - navigate to room detail
	 */
	function handleClick() {
		// Navigate to rooms page with room filter
		goto(`/rooms?room=${encodeURIComponent(room.name)}`);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="room-tile"
	style="background-color: {backgroundColor};"
	onclick={handleClick}
	role="button"
	tabindex="0"
>
	<!-- Room Header -->
	<div class="room-header">
		<h3 class="room-name">{room.name}</h3>
		<span class="device-count-badge">{deviceCount ?? devices.length}</span>
	</div>

	<!-- Device Mini-Cards -->
	<div class="devices-grid">
		{#each devices.slice(0, 8) as device (device.id)}
			<DeviceMiniCard {device} />
		{/each}
		{#if devices.length > 8}
			<div class="more-devices">
				+{devices.length - 8}
			</div>
		{/if}
	</div>
</div>

<style>
	.room-tile {
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		height: 100%;
		overflow: hidden;
		cursor: pointer;
		user-select: none;
		transition: opacity 0.2s ease;
	}

	.room-tile:hover {
		opacity: 0.9;
	}

	.room-tile:active {
		opacity: 0.8;
	}

	/* Room Header */
	.room-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid rgba(0, 0, 0, 0.8); /* Mondrian-style bold border */
	}

	.room-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700; /* Bolder for Mondrian aesthetic */
		color: rgb(17, 24, 39);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: 'Arial', 'Helvetica', sans-serif; /* Clean, geometric font */
		text-transform: uppercase; /* Mondrian-inspired uppercase */
		letter-spacing: 0.05em;
	}

	.device-count-badge {
		background: #000; /* Mondrian black */
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.375rem 0.625rem;
		border-radius: 0; /* Square for Mondrian aesthetic */
		min-width: 2rem;
		text-align: center;
	}

	/* Device Grid */
	.devices-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
		gap: 0.75rem;
		overflow-y: auto;
		flex: 1;
		pointer-events: none; /* Prevent device cards from intercepting clicks */
	}

	.more-devices {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.05);
		border: 2px solid rgba(0, 0, 0, 0.1);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: rgb(107, 114, 128);
		min-height: 80px;
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
			font-size: 0.875rem;
			letter-spacing: 0.03em;
		}

		.device-count-badge {
			font-size: 0.625rem;
			padding: 0.25rem 0.5rem;
			min-width: 1.5rem;
		}

		.devices-grid {
			grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
			gap: 0.5rem;
		}

		.more-devices {
			min-height: 70px;
			font-size: 0.75rem;
		}
	}
</style>
