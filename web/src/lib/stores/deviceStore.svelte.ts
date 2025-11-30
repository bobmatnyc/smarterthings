/**
 * Device Store - Svelte 5 Runes-based state management
 *
 * Design Decision: Fine-Grained Reactivity with Runes
 * Rationale: Svelte 5 runes provide optimal performance with automatic
 * dependency tracking and minimal re-renders.
 *
 * State Pattern:
 * - $state(): Reactive state primitives
 * - $derived(): Computed values (memoized)
 * - Map-based device storage for O(1) lookups
 *
 * Architecture:
 * - Single source of truth for all devices
 * - Filtered views computed reactively
 * - SSE integration for real-time updates
 * - Zero Redux/Zustand dependencies (pure Svelte)
 *
 * Performance:
 * - Device map: O(1) lookups by ID
 * - Filtered list: O(n) but memoized with $derived
 * - Updates: Fine-grained (only affected components re-render)
 */

import { apiClient } from '$lib/api/client';
import type { UnifiedDevice, DeviceCapability } from '$types';

// Use string for device IDs (UniversalDeviceId is a branded type from backend)
type DeviceId = string;

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Device map for O(1) lookups
 * Using Map for efficient device retrieval and updates
 */
let deviceMap = $state<Map<DeviceId, UnifiedDevice>>(new Map());

/**
 * Filter state
 */
let searchQuery = $state('');
let selectedRoom = $state<string | null>(null);
let selectedCapabilities = $state<string[]>([]);

/**
 * Loading and error state
 */
let loading = $state(true);
let error = $state<string | null>(null);

/**
 * SSE connection state
 */
let sseConnected = $state(false);

// ============================================================================
// DERIVED STATE (Computed Values)
// ============================================================================

/**
 * Convert device map to array
 * Derived value automatically updates when deviceMap changes
 */
let devices = $derived(Array.from(deviceMap.values()));

/**
 * Filtered devices based on search query, room, and capabilities
 * Fine-grained reactivity: Only recomputes when dependencies change
 */
let filteredDevices = $derived.by(() => {
	let result = devices;

	// Filter by search query (name, room, label)
	if (searchQuery.trim()) {
		const query = searchQuery.toLowerCase();
		result = result.filter(
			(d) =>
				d.name.toLowerCase().includes(query) ||
				d.room?.toLowerCase().includes(query) ||
				d.label?.toLowerCase().includes(query)
		);
	}

	// Filter by selected room
	if (selectedRoom) {
		result = result.filter((d) => d.room === selectedRoom);
	}

	// Filter by selected capabilities (device must have ALL)
	if (selectedCapabilities.length > 0) {
		result = result.filter((d) =>
			selectedCapabilities.every((cap) => d.capabilities.includes(cap as DeviceCapability))
		);
	}

	return result;
});

/**
 * Available rooms (unique, sorted)
 * Automatically updates when devices change
 */
let availableRooms = $derived.by(() => {
	const rooms = new Set<string>();
	devices.forEach((d) => {
		if (d.room) rooms.add(d.room);
	});
	return Array.from(rooms).sort();
});

/**
 * Device statistics
 * Online/offline counts and filtered count
 */
let stats = $derived({
	total: devices.length,
	online: devices.filter((d) => d.online).length,
	offline: devices.filter((d) => !d.online).length,
	filtered: filteredDevices.length
});

// ============================================================================
// ACTIONS (Exported Functions)
// ============================================================================

/**
 * Load devices from API
 * Initial load and manual refresh
 */
export async function loadDevices(): Promise<void> {
	loading = true;
	error = null;

	try {
		const result = await apiClient.getDevices();

		if (result.success) {
			// Populate device map
			deviceMap.clear();
			result.data.forEach((device) => {
				deviceMap.set(device.id, device);
			});
		} else {
			error = result.error.message;
		}
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load devices';
	} finally {
		loading = false;
	}
}

/**
 * Update device state from SSE event
 * Merges state update into existing device
 *
 * @param deviceId Device ID
 * @param stateUpdate State update object
 */
export function updateDeviceState(deviceId: DeviceId, stateUpdate: any): void {
	const device = deviceMap.get(deviceId);
	if (!device) {
		console.warn(`Device ${deviceId} not found in store`);
		return;
	}

	// Merge state update (immutable update for reactivity)
	const updatedDevice: UnifiedDevice = {
		...device,
		platformSpecific: {
			...device.platformSpecific,
			state: stateUpdate
		}
	};

	deviceMap.set(deviceId, updatedDevice);
}

/**
 * Update device online status
 *
 * @param deviceId Device ID
 * @param online Online status
 */
export function updateDeviceOnlineStatus(deviceId: DeviceId, online: boolean): void {
	const device = deviceMap.get(deviceId);
	if (!device) return;

	deviceMap.set(deviceId, {
		...device,
		online,
		lastSeen: online ? new Date() : device.lastSeen
	});
}

/**
 * Add new device to store
 *
 * @param device Device to add
 */
export function addDevice(device: UnifiedDevice): void {
	deviceMap.set(device.id, device);
}

/**
 * Remove device from store
 *
 * @param deviceId Device ID to remove
 */
export function removeDevice(deviceId: DeviceId): void {
	deviceMap.delete(deviceId);
}

/**
 * Set search query
 * Triggers filtered devices recomputation
 *
 * @param query Search string
 */
export function setSearchQuery(query: string): void {
	searchQuery = query;
}

/**
 * Set selected room filter
 *
 * @param room Room name or null for all
 */
export function setSelectedRoom(room: string | null): void {
	selectedRoom = room;
}

/**
 * Set selected capabilities filter
 *
 * @param capabilities Array of capability strings
 */
export function setSelectedCapabilities(capabilities: string[]): void {
	selectedCapabilities = capabilities;
}

/**
 * Clear all filters
 */
export function clearFilters(): void {
	searchQuery = '';
	selectedRoom = null;
	selectedCapabilities = [];
}

/**
 * Set SSE connection status
 *
 * @param connected Connection status
 */
export function setSSEConnected(connected: boolean): void {
	sseConnected = connected;
}

// ============================================================================
// EXPORTS (Read-only Reactive State)
// ============================================================================

/**
 * Get device store with reactive state and actions
 *
 * Returns object with read-only getters for reactive state
 * and action functions for mutations.
 *
 * Usage:
 * ```svelte
 * <script>
 *   const store = getDeviceStore();
 *   $effect(() => {
 *     store.loadDevices();
 *   });
 * </script>
 *
 * <div>
 *   {#each store.filteredDevices as device}
 *     <DeviceCard {device} />
 *   {/each}
 * </div>
 * ```
 */
export function getDeviceStore() {
	return {
		// State (read-only getters for reactivity)
		get devices() {
			return devices;
		},
		get filteredDevices() {
			return filteredDevices;
		},
		get availableRooms() {
			return availableRooms;
		},
		get stats() {
			return stats;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get searchQuery() {
			return searchQuery;
		},
		get selectedRoom() {
			return selectedRoom;
		},
		get selectedCapabilities() {
			return selectedCapabilities;
		},
		get sseConnected() {
			return sseConnected;
		},

		// Actions
		loadDevices,
		updateDeviceState,
		updateDeviceOnlineStatus,
		addDevice,
		removeDevice,
		setSearchQuery,
		setSelectedRoom,
		setSelectedCapabilities,
		clearFilters,
		setSSEConnected
	};
}
