<script lang="ts">
	/**
	 * Sensor Pulse Indicator
	 *
	 * Animated indicator for binary sensors (motion, contact, occupancy, water leak).
	 * - Pulse animation on state change (scale 1.0 → 1.2 → 1.0 over 500ms)
	 * - Brief gold flash for 300ms when state changes
	 * - Shows current state text (active/inactive, open/closed, etc.)
	 *
	 * Design: Uses $effect to track previous state and trigger animations
	 */

	import type { UnifiedDevice } from '$types';

	let { device, capability }: {
		device: UnifiedDevice;
		capability: 'motionSensor' | 'contactSensor' | 'occupancySensor' | 'waterLeakSensor';
	} = $props();

	// Map capability to state attribute key
	const attributeMap = {
		motionSensor: 'motion',
		contactSensor: 'contact',
		occupancySensor: 'occupancy',
		waterLeakSensor: 'water'
	};

	const attribute = attributeMap[capability];
	const stateKey = `${capability}.${attribute}`;

	// Get current state from device
	let currentState = $derived(
		device.platformSpecific?.state?.[stateKey] as string | undefined
	);

	// Track previous state to detect changes
	let previousState = $state<string | undefined>(undefined);
	let shouldAnimate = $state(false);

	// Detect state changes and trigger animation
	$effect(() => {
		if (currentState && previousState !== undefined && currentState !== previousState) {
			shouldAnimate = true;
			// Reset animation flag after animation completes
			setTimeout(() => {
				shouldAnimate = false;
			}, 500);
		}
		previousState = currentState;
	});

	// Determine if sensor is active
	let isActive = $derived(
		currentState === 'active' ||
		currentState === 'open' ||
		currentState === 'occupied' ||
		currentState === 'wet'
	);

	// Get display text for current state
	let stateText = $derived.by(() => {
		if (!currentState) return 'Unknown';

		switch (capability) {
			case 'motionSensor':
				return currentState === 'active' ? 'Motion' : 'Clear';
			case 'contactSensor':
				return currentState === 'open' ? 'Open' : 'Closed';
			case 'occupancySensor':
				return currentState === 'occupied' ? 'Occupied' : 'Vacant';
			case 'waterLeakSensor':
				return currentState === 'wet' ? 'Leak!' : 'Dry';
			default:
				return currentState;
		}
	});
</script>

<div
	class="sensor-indicator"
	class:active={isActive}
	class:animate={shouldAnimate}
	role="status"
	aria-label="{capability} sensor: {stateText}"
>
	<div class="state-text">{stateText}</div>
</div>

<style>
	.sensor-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		background-color: rgb(243, 244, 246);
		color: rgb(107, 114, 128);
		font-size: 0.75rem;
		font-weight: 600;
		transition: all 0.3s ease-in-out;
	}

	.sensor-indicator.active {
		background-color: rgb(34, 197, 94);
		color: white;
	}

	/* Pulse animation on state change */
	.sensor-indicator.animate {
		animation: pulse 0.5s ease-in-out;
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
		}
		50% {
			transform: scale(1.2);
			box-shadow: 0 0 15px 5px rgba(255, 215, 0, 0.6);
		}
	}

	.state-text {
		white-space: nowrap;
		user-select: none;
	}
</style>
