<script lang="ts">
	/**
	 * Mondrian Grid Component
	 *
	 * Design: Piet Mondrian-inspired treemap layout with dynamic sizing
	 * Algorithm: Squarified Treemap (Bruls, Huizing, van Wijk, 2000)
	 * - Rooms sized proportionally to device count
	 * - Optimized for square-like aspect ratios
	 * - Black 2-4px borders between tiles (Mondrian style)
	 *
	 * Responsive:
	 * - Uses ResizeObserver to track container dimensions
	 * - Recalculates layout on resize
	 * - Mobile/tablet: Falls back to simple grid
	 *
	 * Performance:
	 * - Absolute positioning for efficient layout
	 * - Reactive recalculation only when needed
	 * - Filtered rooms computed reactively
	 */

	import { onMount } from 'svelte';
	import type { Room } from '$lib/stores/roomStore.svelte';
	import type { UnifiedDevice } from '$types';
	import RoomTile from './RoomTile.svelte';
	import { computeTreemap, applyGap, type TreemapItem, type TreemapRect } from '$lib/utils/treemap';

	interface RoomWithDevices extends Room {
		devices: UnifiedDevice[];
		deviceCount: number;
	}

	let { rooms, devices, hiddenRooms }: {
		rooms: Room[];
		devices: UnifiedDevice[];
		hiddenRooms: string[];
	} = $props();

	// Container element and dimensions
	let containerElement: HTMLDivElement | null = $state(null);
	let containerWidth = $state(800);
	let containerHeight = $state(600);

	/**
	 * Compute room tiles with device assignments
	 *
	 * Algorithm:
	 * 1. Group devices by room
	 * 2. Filter out hidden rooms
	 * 3. Calculate device counts
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

		// Create room tiles
		const tiles: RoomWithDevices[] = rooms
			.filter((room) => !hiddenRooms.includes(room.roomId))
			.map((room) => {
				const roomDevices = devicesByRoom.get(room.roomId) || [];
				return {
					...room,
					devices: roomDevices,
					deviceCount: roomDevices.length
				};
			})
			.filter((tile) => tile.deviceCount > 0); // Only show rooms with devices

		return tiles;
	});

	/**
	 * Compute treemap layout for rooms
	 */
	let treemapLayout = $derived.by(() => {
		if (roomTiles.length === 0) {
			return [];
		}

		// Convert rooms to treemap items
		const items: TreemapItem[] = roomTiles.map((tile) => ({
			id: tile.roomId,
			value: tile.deviceCount,
			label: tile.name,
			metadata: tile
		}));

		// Compute treemap rectangles
		const rectangles = computeTreemap(items, containerWidth, containerHeight);

		// Apply gap (Mondrian-style borders)
		const GAP_SIZE = 3;
		return applyGap(rectangles, GAP_SIZE);
	});

	/**
	 * Setup ResizeObserver to track container dimensions
	 */
	onMount(() => {
		if (!containerElement) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				containerWidth = width;
				containerHeight = height;
			}
		});

		resizeObserver.observe(containerElement);

		// Cleanup
		return () => {
			resizeObserver.disconnect();
		};
	});
</script>

<div class="mondrian-grid-container" bind:this={containerElement}>
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
		<!-- Treemap Layout -->
		<div class="treemap-container">
			{#each treemapLayout as rect (rect.id)}
				{@const roomData = rect.metadata as RoomWithDevices}
				<div
					class="room-tile-wrapper"
					style="
						position: absolute;
						left: {rect.x}px;
						top: {rect.y}px;
						width: {rect.width}px;
						height: {rect.height}px;
					"
				>
					<RoomTile
						room={roomData}
						devices={roomData.devices}
						deviceCount={rect.value}
					/>
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
		min-height: calc(100vh - 12rem);
	}

	.treemap-container {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: calc(100vh - 15rem);
		background: #000; /* Mondrian-style black background for gaps */
		border: 3px solid #000;
	}

	.room-tile-wrapper {
		background: white;
		overflow: hidden;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.room-tile-wrapper:hover {
		transform: scale(1.02);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		z-index: 10;
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

	/* Mobile: 1 column */
	@media (max-width: 767px) {
		.mondrian-grid-container {
			padding: 1rem;
		}

		.treemap-container {
			min-height: calc(100vh - 14rem);
		}

		.room-tile-wrapper:hover {
			transform: scale(1.01);
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
