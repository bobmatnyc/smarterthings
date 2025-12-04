<script lang="ts">
	/**
	 * Sensor Readings Component
	 *
	 * Displays sensor data for devices with read-only capabilities (temperature,
	 * humidity, motion, illuminance, battery). Data is extracted from the
	 * platformSpecific.state field populated by ticket 1M-604.
	 *
	 * Design Decision: Conditional Rendering
	 * Rationale: Only display sensors that have actual data. Component is
	 * completely hidden if no sensor data exists (undefined platformSpecific.state).
	 *
	 * Supported Sensors:
	 * - Temperature (°F)
	 * - Humidity (%)
	 * - Motion (Detected/Clear)
	 * - Illuminance (lux)
	 * - Battery (%)
	 *
	 * Architecture:
	 * - Svelte 5 Runes API ($props, $derived)
	 * - Type-safe access to device state
	 * - Graceful handling of undefined/missing values
	 * - Responsive layout with Skeleton UI
	 *
	 * @implements ticket 1M-605
	 */

	interface DeviceState {
		temperature?: number;
		humidity?: number;
		motion?: 'active' | 'inactive';
		illuminance?: number;
		battery?: number;
		timestamp?: string;
	}

	interface Props {
		device: {
			platformSpecific?: {
				state?: DeviceState;
			};
		};
	}

	let { device }: Props = $props();

	// Extract sensor state from device
	const state = $derived(device.platformSpecific?.state as DeviceState | undefined);

	/**
	 * Format temperature in Fahrenheit
	 *
	 * @param temp Temperature value (may be undefined)
	 * @returns Formatted temperature string with °F unit
	 */
	function formatTemperature(temp: number | undefined): string {
		if (temp === undefined) return '--';
		return `${Math.round(temp)}°F`;
	}

	/**
	 * Format humidity as percentage
	 *
	 * @param humidity Humidity value (may be undefined)
	 * @returns Formatted humidity string with % unit
	 */
	function formatHumidity(humidity: number | undefined): string {
		if (humidity === undefined) return '--';
		return `${Math.round(humidity)}%`;
	}

	/**
	 * Format motion sensor status
	 *
	 * @param motion Motion value ('active' | 'inactive' | undefined)
	 * @returns User-friendly motion status
	 */
	function formatMotion(motion: string | undefined): string {
		if (!motion) return '--';
		return motion === 'active' ? 'Detected' : 'Clear';
	}

	/**
	 * Format illuminance in lux
	 *
	 * @param lux Illuminance value (may be undefined)
	 * @returns Formatted illuminance string with lux unit
	 */
	function formatIlluminance(lux: number | undefined): string {
		if (lux === undefined) return '--';
		return `${Math.round(lux)} lux`;
	}

	/**
	 * Format battery level as percentage
	 *
	 * @param battery Battery value (may be undefined)
	 * @returns Formatted battery string with % unit
	 */
	function formatBattery(battery: number | undefined): string {
		if (battery === undefined) return '--';
		return `${Math.round(battery)}%`;
	}

	/**
	 * Determine if device has any sensor data to display
	 *
	 * Returns true if at least one sensor reading exists.
	 * Used to conditionally render the entire component.
	 */
	const hasSensorData = $derived(
		state?.temperature !== undefined ||
			state?.humidity !== undefined ||
			state?.motion !== undefined ||
			state?.illuminance !== undefined ||
			state?.battery !== undefined
	);
</script>

{#if hasSensorData}
	<div class="sensor-readings space-y-2 mt-3">
		<!-- Temperature -->
		{#if state?.temperature !== undefined}
			<div class="sensor-item flex items-center gap-2 text-sm">
				<span class="sensor-icon" role="img" aria-label="Temperature">🌡️</span>
				<span class="sensor-label text-surface-600-300-token">Temperature:</span>
				<span class="sensor-value font-medium">{formatTemperature(state.temperature)}</span>
			</div>
		{/if}

		<!-- Humidity -->
		{#if state?.humidity !== undefined}
			<div class="sensor-item flex items-center gap-2 text-sm">
				<span class="sensor-icon" role="img" aria-label="Humidity">💧</span>
				<span class="sensor-label text-surface-600-300-token">Humidity:</span>
				<span class="sensor-value font-medium">{formatHumidity(state.humidity)}</span>
			</div>
		{/if}

		<!-- Motion -->
		{#if state?.motion !== undefined}
			<div class="sensor-item flex items-center gap-2 text-sm">
				<span class="sensor-icon" role="img" aria-label="Motion">🏃</span>
				<span class="sensor-label text-surface-600-300-token">Motion:</span>
				<span class="sensor-value font-medium">{formatMotion(state.motion)}</span>
			</div>
		{/if}

		<!-- Illuminance -->
		{#if state?.illuminance !== undefined}
			<div class="sensor-item flex items-center gap-2 text-sm">
				<span class="sensor-icon" role="img" aria-label="Light Level">💡</span>
				<span class="sensor-label text-surface-600-300-token">Light Level:</span>
				<span class="sensor-value font-medium">{formatIlluminance(state.illuminance)}</span>
			</div>
		{/if}

		<!-- Battery -->
		{#if state?.battery !== undefined}
			<div class="sensor-item flex items-center gap-2 text-sm">
				<span class="sensor-icon" role="img" aria-label="Battery">🔋</span>
				<span class="sensor-label text-surface-600-300-token">Battery:</span>
				<span class="sensor-value font-medium">{formatBattery(state.battery)}</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	/**
	 * Sensor Readings Container
	 *
	 * Background: Subtle tinted background to visually separate from controls
	 * - Light mode: rgba(0, 0, 0, 0.05) - slight darkening
	 * - Dark mode: rgba(255, 255, 255, 0.05) - slight lightening
	 *
	 * Padding: 0.75rem provides comfortable spacing
	 * Border radius: 0.375rem matches card design system
	 */
	.sensor-readings {
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 0.375rem;
	}

	/**
	 * Dark mode background adjustment
	 *
	 * Uses Skeleton UI global dark class for theme detection
	 */
	:global(.dark) .sensor-readings {
		background: rgba(255, 255, 255, 0.05);
	}

	/**
	 * Sensor Icon
	 *
	 * Slightly larger than text for visual hierarchy
	 * Fixed width prevents layout shift
	 */
	.sensor-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	/**
	 * Sensor Label
	 *
	 * Fixed minimum width ensures value alignment
	 * Labels stack vertically in consistent column
	 */
	.sensor-label {
		min-width: 6rem;
	}

	/**
	 * Sensor Value
	 *
	 * Right-aligned for tabular appearance
	 * Margin-left: auto pushes to right edge
	 */
	.sensor-value {
		margin-left: auto;
	}
</style>
