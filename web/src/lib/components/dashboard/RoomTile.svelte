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
			<div class="device-mini-card">
				<div class="device-icon">
					{#if device.capabilities.includes('switch')}
						<!-- Light bulb icon -->
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M9 18h6"></path>
							<path d="M10 22h4"></path>
							<path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8a6 6 0 0 0-12 0c0 1.33.47 2.48 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path>
						</svg>
					{:else if device.capabilities.includes('temperatureMeasurement')}
						<!-- Thermometer icon -->
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
						</svg>
					{:else if device.capabilities.includes('lock')}
						<!-- Lock icon -->
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
							<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
						</svg>
					{:else}
						<!-- Generic device icon -->
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
							<rect x="9" y="9" width="6" height="6"></rect>
							<line x1="9" y1="1" x2="9" y2="4"></line>
							<line x1="15" y1="1" x2="15" y2="4"></line>
							<line x1="9" y1="20" x2="9" y2="23"></line>
							<line x1="15" y1="20" x2="15" y2="23"></line>
							<line x1="20" y1="9" x2="23" y2="9"></line>
							<line x1="20" y1="14" x2="23" y2="14"></line>
							<line x1="1" y1="9" x2="4" y2="9"></line>
							<line x1="1" y1="14" x2="4" y2="14"></line>
						</svg>
					{/if}
				</div>
				<span class="device-name">{device.name}</span>
			</div>
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

	.device-mini-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: white;
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 0.5rem;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.device-mini-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		border-color: rgb(59, 130, 246);
	}

	.device-icon {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(107, 114, 128);
	}

	.device-icon svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	.device-name {
		font-size: 0.75rem;
		color: rgb(55, 65, 81);
		text-align: center;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	/* Mobile: Larger device cards */
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

		.device-mini-card {
			padding: 0.5rem;
		}

		.device-icon {
			width: 1.75rem;
			height: 1.75rem;
		}

		.device-icon svg {
			width: 1.25rem;
			height: 1.25rem;
		}

		.device-name {
			font-size: 0.6875rem;
		}
	}
</style>
