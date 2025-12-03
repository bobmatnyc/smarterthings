<script lang="ts">
	/**
	 * Brilliant Grouped Controls Component (Ticket 1M-560)
	 *
	 * Enhanced UI for multi-gang Brilliant panels in same room.
	 * Displays multiple switches in compact grouped view with bulk actions.
	 *
	 * Design Decision: Compact Multi-Switch Layout
	 * Rationale: Brilliant panels have 2-4 switches physically grouped.
	 * This component mirrors that physical grouping in the UI.
	 *
	 * Features:
	 * - Display multiple switches from same Brilliant panel
	 * - Inline brightness controls for each dimmer
	 * - Bulk actions: "Toggle All On" and "Toggle All Off"
	 * - Room grouping using existing utilities
	 * - Mobile responsive design
	 *
	 * Performance:
	 * - Debounced brightness updates (300ms, reusing DimmerControl pattern)
	 * - Optimistic UI updates
	 * - Parallel API calls with Promise.all()
	 *
	 * Accessibility:
	 * - ARIA labels for all controls
	 * - Keyboard navigation support
	 * - Screen reader friendly group structure
	 */

	import { apiClient } from '$lib/api/client';
	import type { UnifiedDevice } from '$types';
	import { getBrilliantIcon } from '$lib/utils/device-utils';

	interface Props {
		devices: UnifiedDevice[]; // Brilliant devices in same room (2-4 devices)
		room: string;
	}

	let { devices, room }: Props = $props();

	/**
	 * Device state management
	 * Each device has: isOn, brightness, loading
	 */
	interface DeviceState {
		isOn: boolean;
		brightness: number;
		loading: boolean;
	}

	// Map device ID to its state
	let deviceStates = $state<Map<string, DeviceState>>(new Map());

	// Debounce timers per device
	let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// Bulk action loading state
	let bulkActionLoading = $state(false);

	/**
	 * Initialize device states on mount
	 */
	$effect(() => {
		const newStates = new Map<string, DeviceState>();

		for (const device of devices) {
			const state = device.platformSpecific?.state as any;
			newStates.set(device.id, {
				isOn: state?.switch === 'on' || state?.switch === true || false,
				brightness: state?.level ?? state?.brightness ?? 100,
				loading: false
			});
		}

		deviceStates = newStates;
	});

	/**
	 * Get state for device (with fallback)
	 */
	function getDeviceState(deviceId: string): DeviceState {
		return (
			deviceStates.get(deviceId) || {
				isOn: false,
				brightness: 100,
				loading: false
			}
		);
	}

	/**
	 * Toggle device on/off
	 */
	async function toggleDevice(device: UnifiedDevice) {
		if (!device.online) return;

		const currentState = getDeviceState(device.id);
		const newState = !currentState.isOn;

		// Optimistic update
		deviceStates.set(device.id, { ...currentState, loading: true });

		try {
			const result = newState
				? await apiClient.turnOnDevice(device.platformDeviceId as any)
				: await apiClient.turnOffDevice(device.platformDeviceId as any);

			if (result.success) {
				deviceStates.set(device.id, { ...currentState, isOn: newState, loading: false });
			} else {
				// Revert on failure
				deviceStates.set(device.id, { ...currentState, loading: false });
				console.error('Failed to toggle device:', result.error.message);
			}
		} catch (error) {
			// Revert on error
			deviceStates.set(device.id, { ...currentState, loading: false });
			console.error('Error toggling device:', error);
		}
	}

	/**
	 * Handle brightness change with debouncing
	 */
	function onBrightnessChange(device: UnifiedDevice, event: Event) {
		const target = event.target as HTMLInputElement;
		const newBrightness = parseInt(target.value, 10);

		// Update UI immediately
		const currentState = getDeviceState(device.id);
		deviceStates.set(device.id, { ...currentState, brightness: newBrightness });

		// Clear existing timeout
		const existingTimer = debounceTimers.get(device.id);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Debounce API call by 300ms
		const timer = setTimeout(() => {
			setBrightness(device, newBrightness);
		}, 300);

		debounceTimers.set(device.id, timer);
	}

	/**
	 * Set brightness via API
	 */
	async function setBrightness(device: UnifiedDevice, level: number) {
		if (isNaN(level) || level < 0 || level > 100) {
			console.error('[BrilliantGrouped] Invalid brightness level:', level);
			return;
		}

		const currentState = getDeviceState(device.id);
		const previousLevel = currentState.brightness;

		try {
			await apiClient.setDeviceLevel(device.platformDeviceId as any, Math.round(level));
			console.log(`[BrilliantGrouped] Set ${device.name} brightness to ${level}%`);
		} catch (error) {
			console.error(`[BrilliantGrouped] Failed to set brightness:`, error);

			// Revert UI on error
			deviceStates.set(device.id, { ...currentState, brightness: previousLevel });
			alert(`Failed to set brightness: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check if device has dimming capability
	 */
	function isDimmable(device: UnifiedDevice): boolean {
		return (
			device.capabilities.includes('dimmer' as any) ||
			device.capabilities.includes('switchLevel' as any)
		);
	}

	/**
	 * Toggle all devices ON
	 */
	async function toggleAllOn() {
		bulkActionLoading = true;

		try {
			const promises = devices
				.filter((d) => d.online && !getDeviceState(d.id).isOn)
				.map(async (device) => {
					const currentState = getDeviceState(device.id);
					deviceStates.set(device.id, { ...currentState, loading: true });

					try {
						const result = await apiClient.turnOnDevice(device.platformDeviceId as any);
						if (result.success) {
							deviceStates.set(device.id, { ...currentState, isOn: true, loading: false });
						} else {
							deviceStates.set(device.id, { ...currentState, loading: false });
						}
					} catch (error) {
						deviceStates.set(device.id, { ...currentState, loading: false });
						console.error('Error turning on device:', error);
					}
				});

			await Promise.all(promises);
		} finally {
			bulkActionLoading = false;
		}
	}

	/**
	 * Toggle all devices OFF
	 */
	async function toggleAllOff() {
		bulkActionLoading = true;

		try {
			const promises = devices
				.filter((d) => d.online && getDeviceState(d.id).isOn)
				.map(async (device) => {
					const currentState = getDeviceState(device.id);
					deviceStates.set(device.id, { ...currentState, loading: true });

					try {
						const result = await apiClient.turnOffDevice(device.platformDeviceId as any);
						if (result.success) {
							deviceStates.set(device.id, { ...currentState, isOn: false, loading: false });
						} else {
							deviceStates.set(device.id, { ...currentState, loading: false });
						}
					} catch (error) {
						deviceStates.set(device.id, { ...currentState, loading: false });
						console.error('Error turning off device:', error);
					}
				});

			await Promise.all(promises);
		} finally {
			bulkActionLoading = false;
		}
	}

	/**
	 * Get any online status indicator for panel
	 * Returns true if ANY device is online
	 */
	let panelOnline = $derived(devices.some((d) => d.online));

	/**
	 * Count online devices
	 */
	let onlineCount = $derived(devices.filter((d) => d.online).length);
</script>

<div
	class="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-surface-800 dark:to-surface-900 border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow"
	role="region"
	aria-label="Brilliant panel in {room}"
>
	<!-- Header -->
	<header class="flex items-center justify-between mb-4 pb-3 border-b border-blue-200 dark:border-blue-700">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<!-- Brilliant Icon -->
			<div class="text-3xl flex-shrink-0" aria-hidden="true">
				🔆
			</div>

			<!-- Panel Title -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 mb-1">
					<h3 class="text-lg font-bold truncate text-blue-900 dark:text-blue-100">
						{room} Panel
					</h3>
					<span
						class="badge variant-filled-primary text-xs px-2 py-0.5"
						title="Brilliant Home Technology Multi-Switch Panel"
					>
						Brilliant
					</span>
				</div>
				<p class="text-sm text-blue-700 dark:text-blue-300">
					{devices.length} switches • {onlineCount} online
				</p>
			</div>
		</div>

		<!-- Panel Status Badge -->
		<div class="flex-shrink-0">
			<span
				class="badge variant-filled-{panelOnline ? 'success' : 'surface'}"
				aria-label="Panel {panelOnline ? 'online' : 'offline'}"
				role="status"
			>
				{panelOnline ? '●' : '○'}
			</span>
		</div>
	</header>

	<!-- Device Controls -->
	<div class="space-y-3 mb-4">
		{#each devices as device}
			{@const state = getDeviceState(device.id)}
			<div
				class="bg-white dark:bg-surface-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
			>
				<!-- Device Name -->
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2 flex-1 min-w-0">
						<span class="text-lg" aria-hidden="true">{getBrilliantIcon(device)}</span>
						<h4 class="font-medium text-sm truncate flex-1" title={device.name}>
							{device.name}
						</h4>
						{#if !device.online}
							<span class="text-xs text-gray-500 italic">Offline</span>
						{/if}
					</div>
				</div>

				<!-- On/Off Toggle + Brightness Control -->
				<div class="flex items-center gap-3">
					<!-- Toggle Button -->
					<button
						class="btn btn-sm variant-filled-{state.isOn ? 'primary' : 'surface'} {state.loading
							? 'opacity-75'
							: ''} transition-all flex-shrink-0"
						disabled={!device.online || state.loading}
						onclick={() => toggleDevice(device)}
						aria-pressed={state.isOn}
						aria-label="Toggle {device.name}"
					>
						{#if state.loading}
							<span class="animate-spin">⟳</span>
						{:else}
							<span>{state.isOn ? '●' : '○'}</span>
						{/if}
					</button>

					<!-- Brightness Slider (only for dimmable devices when on) -->
					{#if isDimmable(device)}
						<div class="flex-1 flex items-center gap-2">
							{#if state.isOn}
								<input
									type="range"
									min="0"
									max="100"
									step="1"
									value={state.brightness}
									disabled={!device.online}
									oninput={(e) => onBrightnessChange(device, e)}
									class="flex-1 accent-primary-500"
									aria-label="Brightness for {device.name}"
								/>
								<span class="text-xs font-medium text-gray-600 dark:text-gray-300 w-10 text-right">
									{state.brightness}%
								</span>
							{:else}
								<div class="flex-1 text-xs text-gray-400 italic">Off</div>
							{/if}
						</div>
					{:else}
						<div class="flex-1 text-xs text-gray-500">Switch Only</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Bulk Actions Footer -->
	<footer
		class="flex gap-2 pt-3 border-t border-blue-200 dark:border-blue-700"
		role="group"
		aria-label="Bulk panel controls"
	>
		<button
			class="btn variant-filled-success flex-1"
			disabled={!panelOnline || bulkActionLoading}
			onclick={toggleAllOn}
			aria-label="Turn all switches on"
		>
			{#if bulkActionLoading}
				<span class="animate-spin">⟳</span>
			{/if}
			<span>Toggle All On</span>
		</button>
		<button
			class="btn variant-filled-surface flex-1"
			disabled={!panelOnline || bulkActionLoading}
			onclick={toggleAllOff}
			aria-label="Turn all switches off"
		>
			{#if bulkActionLoading}
				<span class="animate-spin">⟳</span>
			{/if}
			<span>Toggle All Off</span>
		</button>
	</footer>
</div>

<style>
	/* Custom range slider styling (matches DimmerControl.svelte) */
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		background: #e5e7eb;
		outline: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
		border: none;
	}

	input[type='range']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
