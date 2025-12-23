<script lang="ts">
	/**
	 * Light Glow Indicator
	 *
	 * Visual indicator for switch/light devices with glow effect.
	 * - When ON: Green glow effect (box-shadow)
	 * - When OFF: No glow, subtle gray
	 * - Smooth transition: 300ms ease-in-out
	 * - Shows brightness level if dimmer capability exists
	 *
	 * Design: Simple, elegant glow effect for instant visual feedback
	 */

	import type { UnifiedDevice } from '$types';

	let { device }: {
		device: UnifiedDevice;
	} = $props();

	// Get switch state
	let switchState = $derived(
		device.platformSpecific?.state?.['switch.switch'] as string | undefined
	);

	// Get brightness level if dimmer capability exists
	let brightnessLevel = $derived(
		device.platformSpecific?.state?.['dimmer.level'] as number | undefined
	);

	let isOn = $derived(switchState === 'on');
	let hasDimmer = $derived(device.capabilities.includes('dimmer' as any));
</script>

<div
	class="light-indicator"
	class:on={isOn}
	role="status"
	aria-label="Light is {isOn ? 'on' : 'off'}{hasDimmer && brightnessLevel ? ` at ${brightnessLevel}%` : ''}"
>
	<div class="light-icon">
		<!-- Light bulb icon -->
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M9 18h6"></path>
			<path d="M10 22h4"></path>
			<path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8a6 6 0 0 0-12 0c0 1.33.47 2.48 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path>
		</svg>
	</div>
	{#if hasDimmer && isOn && brightnessLevel !== undefined}
		<div class="brightness-level">{brightnessLevel}%</div>
	{/if}
</div>

<style>
	.light-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		border-radius: 0.375rem;
		background-color: rgb(243, 244, 246);
		color: rgb(107, 114, 128);
		transition: all 0.3s ease-in-out;
	}

	.light-indicator.on {
		background-color: rgb(34, 197, 94);
		color: white;
		box-shadow: 0 0 15px 5px rgba(34, 197, 94, 0.6);
	}

	.light-icon {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.light-icon svg {
		width: 100%;
		height: 100%;
	}

	.brightness-level {
		font-size: 0.625rem;
		font-weight: 600;
		white-space: nowrap;
	}
</style>
