<script lang="ts">
	/**
	 * Device Card Component
	 *
	 * Individual device card with capability-based control routing.
	 *
	 * Design Decision: Priority-Based Control Selection
	 * Rationale: Devices can have multiple capabilities. Show the most
	 * useful control based on priority order.
	 *
	 * Priority Order:
	 * 1. DIMMER (most feature-rich, includes on/off)
	 * 2. SWITCH (basic on/off)
	 * 3. Sensors (read-only display)
	 *
	 * Architecture:
	 * - Capability detection using hasCapability utility
	 * - Dynamic component rendering with svelte:component
	 * - Responsive card layout with Skeleton UI
	 */

	import type { UnifiedDevice, DeviceCapability } from '$types';
	import SwitchControl from './controls/SwitchControl.svelte';
	import DimmerControl from './controls/DimmerControl.svelte';
	import SensorReadings from './SensorReadings.svelte';
	import { isBrilliantDevice, getBrilliantIcon } from '$lib/utils/device-utils';

	interface Props {
		device: UnifiedDevice;
		compact?: boolean;
	}

	let { device, compact = false }: Props = $props();

	/**
	 * Check if device has specific capability
	 */
	function hasCapability(cap: DeviceCapability): boolean {
		return device.capabilities.includes(cap);
	}

	/**
	 * Determine which control to show
	 * Returns control type string instead of component for Svelte 5 compatibility
	 */
	let controlType = $derived.by(() => {
		// Priority 1: Dimmer (includes level control)
		if (hasCapability('dimmer' as DeviceCapability)) {
			return 'dimmer';
		}

		// Priority 2: Switch (basic on/off)
		if (hasCapability('switch' as DeviceCapability)) {
			return 'switch';
		}

		// No controllable capability found
		return null;
	});

	/**
	 * Get capability icon for device
	 *
	 * Priority Order:
	 * 1. Brilliant devices get manufacturer-specific icons
	 * 2. Standard devices get capability-based icons
	 */
	function getDeviceIcon(device: UnifiedDevice): string {
		// Priority 1: Brilliant-specific icons (ticket 1M-559)
		if (isBrilliantDevice(device)) {
			return getBrilliantIcon(device);
		}

		// Priority 2: Standard capability icons
		const capabilities = device.capabilities;
		if (capabilities.includes('dimmer' as DeviceCapability)) return '💡';
		if (capabilities.includes('switch' as DeviceCapability)) return '🔌';
		if (capabilities.includes('thermostat' as DeviceCapability)) return '🌡️';
		if (capabilities.includes('lock' as DeviceCapability)) return '🔒';
		if (capabilities.includes('temperatureSensor' as DeviceCapability)) return '🌡️';
		if (capabilities.includes('motionSensor' as DeviceCapability)) return '🏃';
		if (capabilities.includes('contactSensor' as DeviceCapability)) return '🚪';
		return '📱'; // Default
	}
</script>

<div class="card p-4 hover:shadow-lg transition-shadow bg-white dark:bg-surface-800">
	<!-- Header -->
	<header class="flex items-start justify-between mb-4">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<!-- Device Icon -->
			<div class="text-3xl flex-shrink-0" aria-hidden="true">
				{getDeviceIcon(device)}
			</div>

			<!-- Device Name and Room -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 mb-1">
					<h3 class="text-lg font-semibold truncate" title={device.label || device.name}>
						{device.label || device.name}
					</h3>
					<!-- Brilliant Manufacturer Badge (Ticket 1M-559) -->
					{#if isBrilliantDevice(device)}
						<span
							class="badge variant-filled-primary text-xs px-2 py-0.5"
							title="Brilliant Home Technology Device"
							aria-label="Brilliant Home Technology Device"
						>
							Brilliant
						</span>
					{/if}
				</div>
				<!-- Device Type Subtitle - Show technical device type -->
				{#if device.model}
					<p class="text-xs text-gray-500 dark:text-gray-400 truncate" title={device.model}>
						{device.model}
					</p>
				{/if}
				{#if device.room}
					<p class="text-sm text-gray-600 dark:text-gray-400 truncate">
						{device.room}
					</p>
				{/if}
				<!-- Brilliant Info Tooltip (Ticket 1M-559) -->
				{#if isBrilliantDevice(device)}
					<p
						class="text-xs text-gray-500 dark:text-gray-400 mt-1"
						title="Advanced features (camera, motion sensor, intercom) available in Brilliant Home app"
					>
						💡 Tip: Advanced features available in Brilliant app
					</p>
				{/if}
			</div>
		</div>

		<!-- Online Status Badge -->
		<div class="flex-shrink-0">
			<span
				class="badge variant-filled-{device.online ? 'success' : 'surface'}"
				aria-label="Device {device.online ? 'online' : 'offline'}"
				role="status"
			>
				{device.online ? '●' : '○'}
			</span>
		</div>
	</header>

	<!-- Device Info (manufacturer/model) -->
	{#if !compact && (device.manufacturer || device.model)}
		<div class="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
			{device.manufacturer ?? ''} {device.model ?? ''}
		</div>
	{/if}

	<!-- Controls or Sensor Readings -->
	<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
		{#if controlType === 'dimmer'}
			<DimmerControl {device} />
		{:else if controlType === 'switch'}
			<SwitchControl {device} />
		{:else}
			<!-- Ticket 1M-605: Display sensor readings for sensor devices -->
			<SensorReadings {device} />

			<!-- Only show "No controls available" if truly no sensor data -->
			{#if !device.platformSpecific?.state || Object.keys(device.platformSpecific.state).length === 0}
				<div class="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
					No controls available
				</div>
			{/if}
		{/if}
	</div>

	<!-- Capability Tags (footer) -->
	{#if !compact && device.capabilities.length > 0}
		<footer class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
			<div class="flex flex-wrap gap-1">
				{#each device.capabilities.slice(0, 4) as capability}
					<span class="badge variant-soft-surface text-xs">
						{capability}
					</span>
				{/each}
				{#if device.capabilities.length > 4}
					<span class="badge variant-soft-surface text-xs">
						+{device.capabilities.length - 4} more
					</span>
				{/if}
			</div>
		</footer>
	{/if}
</div>
