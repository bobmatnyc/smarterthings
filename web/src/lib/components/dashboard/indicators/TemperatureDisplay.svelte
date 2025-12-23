<script lang="ts">
	/**
	 * Temperature Display Indicator
	 *
	 * Displays temperature with color gradient based on value.
	 * - Blue (<60°F): Cool
	 * - Green (60-75°F): Comfortable
	 * - Orange (>75°F): Warm
	 * - Monospace font for consistent width
	 * - Shows °F or °C based on unit
	 *
	 * Design: Clean, readable temperature display with visual temperature cues
	 */

	import type { UnifiedDevice } from '$types';

	let { device }: {
		device: UnifiedDevice;
	} = $props();

	// Get temperature value and unit
	let temperature = $derived(
		device.platformSpecific?.state?.['temperatureSensor.temperature'] as number | undefined
	);

	let unit = $derived(
		(device.platformSpecific?.state?.['temperatureSensor.unit'] as string | undefined) || 'F'
	);

	// Determine color based on temperature (assuming Fahrenheit, adjust for Celsius)
	let colorClass = $derived.by(() => {
		if (!temperature) return 'neutral';

		// Convert to Fahrenheit for comparison if needed
		const tempF = unit === 'C' ? (temperature * 9/5) + 32 : temperature;

		if (tempF < 60) return 'cool';
		if (tempF <= 75) return 'comfortable';
		return 'warm';
	});

	// Format temperature display
	let displayTemp = $derived(
		temperature !== undefined ? temperature.toFixed(1) : '--'
	);
</script>

<div
	class="temperature-display {colorClass}"
	role="status"
	aria-label="Temperature: {displayTemp}°{unit}"
>
	<div class="temp-icon">
		<!-- Thermometer icon -->
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
		</svg>
	</div>
	<div class="temp-value">{displayTemp}°{unit}</div>
</div>

<style>
	.temperature-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		background-color: rgb(243, 244, 246);
		font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
		transition: all 0.2s ease;
	}

	.temp-icon {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.temp-icon svg {
		width: 100%;
		height: 100%;
	}

	.temp-value {
		font-size: 0.875rem;
		font-weight: 600;
	}

	/* Color variants based on temperature */
	.temperature-display.cool {
		background-color: rgb(219, 234, 254);
		color: rgb(29, 78, 216);
	}

	.temperature-display.cool .temp-icon {
		color: rgb(59, 130, 246);
	}

	.temperature-display.comfortable {
		background-color: rgb(220, 252, 231);
		color: rgb(22, 101, 52);
	}

	.temperature-display.comfortable .temp-icon {
		color: rgb(34, 197, 94);
	}

	.temperature-display.warm {
		background-color: rgb(254, 243, 199);
		color: rgb(180, 83, 9);
	}

	.temperature-display.warm .temp-icon {
		color: rgb(251, 146, 60);
	}

	.temperature-display.neutral {
		background-color: rgb(243, 244, 246);
		color: rgb(107, 114, 128);
	}
</style>
