<script lang="ts">
	/**
	 * Mondrian Grid Component
	 *
	 * Design: Piet Mondrian-inspired grid layout with dynamic sizing
	 * Algorithm:
	 * - gridUnits = Math.max(1, Math.round(Math.sqrt(deviceCount) * 2) / 2)
	 * - Sort rooms by size (largest first)
	 * - CSS Grid with dynamic columns
	 * - Black 2-3px borders between tiles (Mondrian style)
	 *
	 * Responsive:
	 * - Mobile (<768px): Stack vertically (1 column)
	 * - Tablet (768-1024px): 2 columns
	 * - Desktop (>1024px): Full Mondrian grid (6-8 columns)
	 *
	 * Performance:
	 * - CSS Grid for efficient layout
	 * - No unnecessary re-renders
	 * - Filtered rooms computed reactively
	 */

	import type { Room } from '$lib/stores/roomStore.svelte';
	import type { UnifiedDevice } from '$types';
	import RoomTile from './RoomTile.svelte';

	interface RoomWithDevices extends Room {
		devices: UnifiedDevice[];
		gridUnits: number;
	}

	let { rooms, devices, hiddenRooms }: {
		rooms: Room[];
		devices: UnifiedDevice[];
		hiddenRooms: string[];
	} = $props();

	/**
	 * Compute room tiles with device assignments and grid sizing
	 *
	 * Algorithm:
	 * 1. Group devices by room
	 * 2. Calculate grid units: sqrt(deviceCount) * 2, rounded to nearest 0.5
	 * 3. Sort rooms by size (largest first)
	 * 4. Filter out hidden rooms
	 */
	let roomTiles = $derived.by(() => {
		// Group devices by room ID
		const devicesByRoom = new Map<string, UnifiedDevice[]>();
		devices.forEach((device) => {
			const roomId = (device.platformSpecific as any)?.roomId;
			if (roomId) {
				if (!devicesByRoom.has(roomId)) {
					devicesByRoom.set(roomId, []);
				}
				devicesByRoom.get(roomId)!.push(device);
			}
		});

		// Create room tiles with grid sizing
		const tiles: RoomWithDevices[] = rooms
			.filter((room) => !hiddenRooms.includes(room.roomId))
			.map((room) => {
				const roomDevices = devicesByRoom.get(room.roomId) || [];
				const deviceCount = roomDevices.length;

				// Grid units algorithm: sqrt(deviceCount) * 2, rounded to nearest 0.5
				// Examples: 1 device = 2 units, 4 devices = 4 units, 9 devices = 6 units
				const gridUnits = Math.max(1, Math.round(Math.sqrt(deviceCount) * 2 * 2) / 2);

				return {
					...room,
					devices: roomDevices,
					gridUnits
				};
			})
			.sort((a, b) => b.gridUnits - a.gridUnits); // Sort largest first

		return tiles;
	});
</script>

<div class="mondrian-grid-container">
	{#if roomTiles.length === 0}
		<!-- Empty State -->
		<div class="empty-state">
			<div class="empty-icon">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="3" y="3" width="7" height="7"></rect>
					<rect x="14" y="3" width="7" height="7"></rect>
					<rect x="14" y="14" width="7" height="7"></rect>
					<rect x="3" y="14" width="7" height="7"></rect>
				</svg>
			</div>
			<h2 class="empty-title">No Rooms to Display</h2>
			<p class="empty-description">
				All rooms are hidden or no rooms are configured. Add rooms in the SmartThings app or adjust your dashboard settings.
			</p>
		</div>
	{:else}
		<!-- Mondrian Grid -->
		<div class="mondrian-grid">
			{#each roomTiles as roomTile (roomTile.roomId)}
				<div class="room-tile-wrapper" style="grid-column: span {roomTile.gridUnits};">
					<RoomTile room={roomTile} devices={roomTile.devices} />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.mondrian-grid-container {
		width: 100%;
		height: 100%;
		padding: 1.5rem;
	}

	.mondrian-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 2px; /* Mondrian-style thin black gaps */
		background: black; /* Gap color */
		border: 2px solid black;
		min-height: calc(100vh - 12rem);
	}

	.room-tile-wrapper {
		background: white;
		min-height: 200px;
		overflow: hidden;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 400px;
	}

	.empty-icon {
		width: 5rem;
		height: 5rem;
		background: linear-gradient(135deg, rgb(239, 246, 255) 0%, rgb(219, 234, 254) 100%);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(59, 130, 246);
		margin-bottom: 1.5rem;
	}

	.empty-icon svg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.empty-title {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.empty-description {
		margin: 0;
		max-width: 28rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
	}

	/* Responsive Breakpoints */

	/* Tablet: 2 columns */
	@media (min-width: 768px) and (max-width: 1023px) {
		.mondrian-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 2px;
		}

		.room-tile-wrapper {
			grid-column: span 1 !important; /* Override dynamic sizing */
		}
	}

	/* Mobile: 1 column */
	@media (max-width: 767px) {
		.mondrian-grid-container {
			padding: 1rem;
		}

		.mondrian-grid {
			grid-template-columns: 1fr;
			gap: 2px;
			min-height: auto;
		}

		.room-tile-wrapper {
			grid-column: span 1 !important; /* Override dynamic sizing */
			min-height: 150px;
		}

		.empty-state {
			padding: 3rem 1.5rem;
			min-height: 300px;
		}

		.empty-icon {
			width: 4rem;
			height: 4rem;
		}

		.empty-icon svg {
			width: 2rem;
			height: 2rem;
		}

		.empty-title {
			font-size: 1.25rem;
		}

		.empty-description {
			font-size: 0.9375rem;
		}
	}
</style>
