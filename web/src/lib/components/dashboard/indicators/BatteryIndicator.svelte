<script lang="ts">
	/**
	 * Battery Indicator
	 *
	 * Displays battery level with visual warnings.
	 * - Normal (>20%): Green
	 * - Low (10-20%): Amber with "Low" text
	 * - Critical (≤10%): Red with pulse animation and "Critical" text
	 * - Shows percentage number
	 * - SVG battery icon with fill level
	 *
	 * Design: Clear visual hierarchy for battery status with urgent warnings
	 */

	import type { UnifiedDevice } from '$types';

	let { device }: {
		device: UnifiedDevice;
	} = $props();

	// Get battery level (0-100)
	let batteryLevel = $derived(
		device.platformSpecific?.state?.['battery.battery'] as number | undefined
	);

	// Determine status level
	let status = $derived.by(() => {
		if (batteryLevel === undefined) return 'unknown';
		if (batteryLevel <= 10) return 'critical';
		if (batteryLevel <= 20) return 'low';
		return 'normal';
	});

	// Calculate fill height for battery icon (as percentage)
	let fillHeight = $derived(batteryLevel ?? 0);
</script>

<div
	class="battery-indicator {status}"
	role="status"
	aria-label="Battery: {batteryLevel ?? 'unknown'}%"
>
	<!-- Battery Icon SVG with fill level -->
	<div class="battery-icon">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<!-- Battery outline -->
			<rect x="2" y="6" width="18" height="12" rx="2" ry="2"></rect>
			<line x1="22" y1="10" x2="22" y2="14"></line>

			<!-- Battery fill (dynamic based on level) -->
			{#if batteryLevel !== undefined}
				<rect
					x="3.5"
					y={(18 - (12 * fillHeight / 100)) + 6}
					width="15"
					height={12 * fillHeight / 100}
					fill="currentColor"
					opacity="0.6"
				></rect>
			{/if}
		</svg>
	</div>

	<!-- Battery percentage and status text -->
	<div class="battery-info">
		{#if batteryLevel !== undefined}
			<div class="battery-percent">{batteryLevel}%</div>
		{:else}
			<div class="battery-percent">--</div>
		{/if}
		{#if status === 'critical'}
			<div class="battery-status">Critical</div>
		{:else if status === 'low'}
			<div class="battery-status">Low</div>
		{/if}
	</div>
</div>

<style>
	.battery-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		background-color: rgb(220, 252, 231);
		color: rgb(22, 101, 52);
		transition: all 0.2s ease;
	}

	.battery-icon {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.battery-icon svg {
		width: 100%;
		height: 100%;
	}

	.battery-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.battery-percent {
		font-size: 0.75rem;
		font-weight: 600;
		font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
	}

	.battery-status {
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	/* Status variants */
	.battery-indicator.low {
		background-color: rgb(254, 243, 199);
		color: rgb(180, 83, 9);
	}

	.battery-indicator.critical {
		background-color: rgb(254, 226, 226);
		color: rgb(153, 27, 27);
		animation: pulse-critical 2s ease-in-out infinite;
	}

	@keyframes pulse-critical {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.05);
		}
	}

	.battery-indicator.unknown {
		background-color: rgb(243, 244, 246);
		color: rgb(107, 114, 128);
	}
</style>
