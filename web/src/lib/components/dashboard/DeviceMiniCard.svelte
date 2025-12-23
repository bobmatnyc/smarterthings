<script lang="ts">
	/**
	 * Device Mini Card
	 *
	 * Compact device representation for dashboard grid.
	 * - Icon based on device capability (reuses patterns from DeviceCard)
	 * - Device name (truncated if long)
	 * - State indicator component based on capability type
	 * - Compact size (~60-80px cards)
	 * - Click to toggle (for switches/lights)
	 *
	 * Capability Priority (matches DeviceCard):
	 * 1. SWITCH/DIMMER → LightGlowIndicator
	 * 2. TEMPERATURE_SENSOR → TemperatureDisplay
	 * 3. MOTION/CONTACT/OCCUPANCY/WATER_LEAK → SensorPulseIndicator
	 * 4. BATTERY → BatteryIndicator
	 * 5. Default → Generic state text
	 */

	import type { UnifiedDevice } from '$types';
	import { isBrilliantDevice, getBrilliantIcon } from '$lib/utils/device-utils';
	import LightGlowIndicator from './indicators/LightGlowIndicator.svelte';
	import TemperatureDisplay from './indicators/TemperatureDisplay.svelte';
	import SensorPulseIndicator from './indicators/SensorPulseIndicator.svelte';
	import BatteryIndicator from './indicators/BatteryIndicator.svelte';
	import { apiClient } from '$lib/api/client';

	let { device }: {
		device: UnifiedDevice;
	} = $props();

	/**
	 * Get capability icon for device (same logic as DeviceCard)
	 */
	function getDeviceIcon(device: UnifiedDevice): string {
		// Priority 1: Brilliant-specific icons
		if (isBrilliantDevice(device)) {
			return getBrilliantIcon(device);
		}

		// Priority 2: Standard capability icons
		const capabilities = device.capabilities.map(c => String(c));
		if (capabilities.includes('dimmer')) return '💡';
		if (capabilities.includes('switch')) return '🔌';
		if (capabilities.includes('thermostat')) return '🌡️';
		if (capabilities.includes('lock')) return '🔒';
		if (capabilities.includes('temperatureSensor')) return '🌡️';
		if (capabilities.includes('motionSensor')) return '🏃';
		if (capabilities.includes('contactSensor')) return '🚪';
		return '📱'; // Default
	}

	/**
	 * Determine which indicator to show based on capabilities
	 */
	let indicatorType = $derived.by(() => {
		const caps = device.capabilities.map(c => String(c));

		// Priority 1: Switches and lights
		if (caps.includes('switch') || caps.includes('dimmer')) {
			return 'light';
		}

		// Priority 2: Temperature sensors
		if (caps.includes('temperatureSensor')) {
			return 'temperature';
		}

		// Priority 3: Binary sensors
		if (caps.includes('motionSensor')) {
			return 'motion';
		}
		if (caps.includes('contactSensor')) {
			return 'contact';
		}
		if (caps.includes('occupancySensor')) {
			return 'occupancy';
		}
		if (caps.includes('waterLeakSensor')) {
			return 'waterLeak';
		}

		// Priority 4: Battery
		if (caps.includes('battery')) {
			return 'battery';
		}

		return null;
	});

	/**
	 * Check if device is controllable (switch/dimmer)
	 */
	let isControllable = $derived(
		device.capabilities.some(c => String(c) === 'switch' || String(c) === 'dimmer')
	);

	/**
	 * Get current switch state
	 */
	let switchState = $derived(
		device.platformSpecific?.state?.['switch.switch'] as string | undefined
	);

	/**
	 * Handle click to toggle switch/light
	 */
	async function handleClick() {
		if (!isControllable) return;

		const newState = switchState === 'on' ? 'off' : 'on';

		try {
			await apiClient.executeDeviceCommand({
				deviceId: device.id,
				command: newState,
				capability: 'switch',
				args: []
			});
		} catch (error) {
			console.error('Failed to toggle device:', error);
		}
	}
</script>

<button
	class="device-mini-card"
	class:controllable={isControllable}
	onclick={handleClick}
	disabled={!isControllable}
	aria-label="{device.name} - {switchState ?? 'unknown'}"
>
	<!-- Device Icon -->
	<div class="device-icon" aria-hidden="true">
		{getDeviceIcon(device)}
	</div>

	<!-- Device Name -->
	<div class="device-name" title={device.label || device.name}>
		{device.label || device.name}
	</div>

	<!-- State Indicator -->
	<div class="state-indicator">
		{#if indicatorType === 'light'}
			<LightGlowIndicator {device} />
		{:else if indicatorType === 'temperature'}
			<TemperatureDisplay {device} />
		{:else if indicatorType === 'motion'}
			<SensorPulseIndicator {device} capability="motionSensor" />
		{:else if indicatorType === 'contact'}
			<SensorPulseIndicator {device} capability="contactSensor" />
		{:else if indicatorType === 'occupancy'}
			<SensorPulseIndicator {device} capability="occupancySensor" />
		{:else if indicatorType === 'waterLeak'}
			<SensorPulseIndicator {device} capability="waterLeakSensor" />
		{:else if indicatorType === 'battery'}
			<BatteryIndicator {device} />
		{:else}
			<!-- Generic state display -->
			<div class="generic-state">
				{#if device.online}
					<span class="online-badge">●</span>
				{:else}
					<span class="offline-badge">○</span>
				{/if}
			</div>
		{/if}
	</div>
</button>

<style>
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
		cursor: default;
		width: 100%;
		min-height: 120px;
	}

	.device-mini-card.controllable {
		cursor: pointer;
	}

	.device-mini-card.controllable:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		border-color: rgb(59, 130, 246);
	}

	.device-mini-card.controllable:active {
		transform: translateY(0);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.device-icon {
		font-size: 2rem;
		line-height: 1;
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
		font-weight: 500;
	}

	.state-indicator {
		width: 100%;
		display: flex;
		justify-content: center;
		margin-top: auto;
	}

	.generic-state {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
	}

	.online-badge {
		color: rgb(34, 197, 94);
	}

	.offline-badge {
		color: rgb(156, 163, 175);
	}

	/* Accessibility */
	.device-mini-card:disabled {
		cursor: default;
		opacity: 0.9;
	}

	.device-mini-card:focus-visible {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	/* Mobile responsiveness */
	@media (max-width: 767px) {
		.device-mini-card {
			padding: 0.5rem;
			min-height: 100px;
		}

		.device-icon {
			font-size: 1.75rem;
		}

		.device-name {
			font-size: 0.6875rem;
		}
	}
</style>
