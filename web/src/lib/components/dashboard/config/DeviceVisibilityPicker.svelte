<script lang="ts">
	/**
	 * Device Visibility Picker - Control which devices appear on dashboard
	 *
	 * Features:
	 * - Expandable sections per room
	 * - Checkbox for each device
	 * - Device icon + name
	 * - "Show All" / "Hide All" per room
	 * - Connected to dashboardStore.hiddenDevices
	 */

	import type { Room } from '$lib/stores/roomStore.svelte';
	import type { UnifiedDevice } from '$types';
	import { getDashboardStore } from '$lib/stores/dashboardStore.svelte';

	interface Props {
		rooms: Room[];
		devices: UnifiedDevice[];
	}

	let { rooms = [], devices = [] }: Props = $props();

	const dashboardStore = getDashboardStore();

	// Track expanded rooms
	let expandedRooms = $state<Set<string>>(new Set());

	function toggleRoom(roomId: string) {
		if (expandedRooms.has(roomId)) {
			expandedRooms.delete(roomId);
		} else {
			expandedRooms.add(roomId);
		}
		expandedRooms = new Set(expandedRooms);
	}

	function toggleDevice(deviceId: string) {
		dashboardStore.toggleDeviceVisibility(deviceId);
	}

	function showAllInRoom(roomId: string) {
		const devicesInRoom = getDevicesForRoom(roomId);
		devicesInRoom.forEach((d) => {
			if (dashboardStore.hiddenDevices.includes(d.id)) {
				dashboardStore.showDevice(d.id);
			}
		});
	}

	function hideAllInRoom(roomId: string) {
		const devicesInRoom = getDevicesForRoom(roomId);
		devicesInRoom.forEach((d) => {
			if (!dashboardStore.hiddenDevices.includes(d.id)) {
				dashboardStore.hideDevice(d.id);
			}
		});
	}

	function getDevicesForRoom(roomId: string): UnifiedDevice[] {
		return devices.filter((d) => {
			const deviceRoomId = (d.platformSpecific as any)?.roomId;
			return deviceRoomId === roomId;
		});
	}

	let roomDeviceMap = $derived.by(() => {
		const map = new Map<string, UnifiedDevice[]>();
		rooms.forEach((room) => {
			map.set(room.roomId, getDevicesForRoom(room.roomId));
		});
		return map;
	});
</script>

<div class="device-visibility-picker">
	<h4>Device Visibility by Room</h4>

	<div class="room-sections">
		{#each rooms as room (room.roomId)}
			{@const devicesInRoom = roomDeviceMap.get(room.roomId) || []}
			{@const visibleCount = devicesInRoom.filter((d) => !dashboardStore.hiddenDevices.includes(d.id)).length}

			<div class="room-section">
				<button type="button" class="room-header" onclick={() => toggleRoom(room.roomId)}>
					<span class="expand-icon" class:expanded={expandedRooms.has(room.roomId)}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</span>
					<span class="room-title">{room.name}</span>
					<span class="room-stats"
						>{visibleCount}/{devicesInRoom.length} visible</span
					>
				</button>

				{#if expandedRooms.has(room.roomId)}
					<div class="room-content">
						<div class="room-actions">
							<button type="button" class="action-btn" onclick={() => showAllInRoom(room.roomId)}>
								Show All
							</button>
							<button type="button" class="action-btn" onclick={() => hideAllInRoom(room.roomId)}>
								Hide All
							</button>
						</div>

						<div class="device-list">
							{#each devicesInRoom as device (device.id)}
								<label class="device-item">
									<input
										type="checkbox"
										checked={!dashboardStore.hiddenDevices.includes(device.id)}
										onchange={() => toggleDevice(device.id)}
									/>
									<span class="device-name">{device.name}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.device-visibility-picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.device-visibility-picker h4 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.room-sections {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 400px;
		overflow-y: auto;
		padding: 0.5rem;
		border: 1px solid rgb(229, 231, 235);
		border-radius: 0.5rem;
		background: rgb(249, 250, 251);
	}

	.room-section {
		background: white;
		border-radius: 0.375rem;
		overflow: hidden;
	}

	.room-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.room-header:hover {
		background: rgb(243, 244, 246);
	}

	.expand-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: rgb(107, 114, 128);
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.expand-icon.expanded {
		transform: rotate(180deg);
	}

	.expand-icon svg {
		width: 100%;
		height: 100%;
	}

	.room-title {
		flex: 1;
		text-align: left;
		font-size: 0.9375rem;
		font-weight: 500;
		color: rgb(17, 24, 39);
	}

	.room-stats {
		font-size: 0.8125rem;
		color: rgb(107, 114, 128);
	}

	.room-content {
		padding: 0 0.75rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.room-actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgb(249, 250, 251);
		border-radius: 0.375rem;
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

	.device-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.device-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem;
		background: rgb(249, 250, 251);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.device-item:hover {
		background: rgb(243, 244, 246);
	}

	.device-item input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.device-name {
		flex: 1;
		font-size: 0.875rem;
		color: rgb(55, 65, 81);
	}

	/* Scrollbar styling */
	.room-sections::-webkit-scrollbar {
		width: 0.5rem;
	}

	.room-sections::-webkit-scrollbar-track {
		background: rgb(243, 244, 246);
		border-radius: 0.25rem;
	}

	.room-sections::-webkit-scrollbar-thumb {
		background: rgb(209, 213, 219);
		border-radius: 0.25rem;
	}

	.room-sections::-webkit-scrollbar-thumb:hover {
		background: rgb(156, 163, 175);
	}
</style>
