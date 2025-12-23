<script lang="ts">
	/**
	 * Room Visibility Picker - Control which rooms appear on dashboard
	 *
	 * Features:
	 * - Checkbox for each room
	 * - "Show All" / "Hide All" buttons
	 * - Device count per room
	 * - Connected to dashboardStore.hiddenRooms
	 */

	import type { Room } from '$lib/stores/roomStore.svelte';
	import { getDashboardStore } from '$lib/stores/dashboardStore.svelte';

	interface Props {
		rooms: Room[];
	}

	let { rooms = [] }: Props = $props();

	const dashboardStore = getDashboardStore();

	function showAll() {
		dashboardStore.showAllRooms();
	}

	function hideAll() {
		const allRoomIds = rooms.map((r) => r.roomId);
		dashboardStore.hideAllRooms(allRoomIds);
	}

	function toggleRoom(roomId: string) {
		dashboardStore.toggleRoomVisibility(roomId);
	}

	let visibleCount = $derived(
		rooms.filter((r) => !dashboardStore.hiddenRooms.includes(r.roomId)).length
	);
</script>

<div class="room-visibility-picker">
	<div class="picker-header">
		<h4>Visible Rooms ({visibleCount}/{rooms.length})</h4>
		<div class="action-buttons">
			<button type="button" class="action-btn" onclick={showAll}>Show All</button>
			<button type="button" class="action-btn" onclick={hideAll}>Hide All</button>
		</div>
	</div>

	<div class="room-list">
		{#each rooms as room (room.roomId)}
			<label class="room-item">
				<input
					type="checkbox"
					checked={!dashboardStore.hiddenRooms.includes(room.roomId)}
					onchange={() => toggleRoom(room.roomId)}
				/>
				<span class="room-name">{room.name}</span>
				{#if room.deviceCount !== undefined}
					<span class="device-count">{room.deviceCount} devices</span>
				{/if}
			</label>
		{/each}
	</div>
</div>

<style>
	.room-visibility-picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.picker-header h4 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(59, 130, 246);
		background: transparent;
		border: 1px solid rgb(59, 130, 246);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: rgb(59, 130, 246);
		color: white;
	}

	.room-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 300px;
		overflow-y: auto;
		padding: 0.5rem;
		border: 1px solid rgb(229, 231, 235);
		border-radius: 0.5rem;
		background: rgb(249, 250, 251);
	}

	.room-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.room-item:hover {
		background: rgb(243, 244, 246);
	}

	.room-item input[type='checkbox'] {
		width: 1.125rem;
		height: 1.125rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.room-name {
		flex: 1;
		font-size: 0.9375rem;
		font-weight: 500;
		color: rgb(17, 24, 39);
	}

	.device-count {
		font-size: 0.8125rem;
		color: rgb(107, 114, 128);
	}

	/* Scrollbar styling */
	.room-list::-webkit-scrollbar {
		width: 0.5rem;
	}

	.room-list::-webkit-scrollbar-track {
		background: rgb(243, 244, 246);
		border-radius: 0.25rem;
	}

	.room-list::-webkit-scrollbar-thumb {
		background: rgb(209, 213, 219);
		border-radius: 0.25rem;
	}

	.room-list::-webkit-scrollbar-thumb:hover {
		background: rgb(156, 163, 175);
	}
</style>
