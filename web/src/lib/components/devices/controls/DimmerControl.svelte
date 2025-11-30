<script lang="ts">
	/**
	 * Dimmer Control Component
	 *
	 * Level control (0-100%) for dimmable devices.
	 * Typically combined with SWITCH capability.
	 *
	 * Features:
	 * - On/off toggle
	 * - Brightness slider (0-100%)
	 * - Debounced API calls (avoid spamming during slider drag)
	 * - Optimistic updates
	 *
	 * Design Pattern: Debounced Slider Updates
	 * - Update UI immediately (responsive slider)
	 * - Debounce API calls by 300ms (reduce server load)
	 * - Only send final value after user stops dragging
	 */

	import { apiClient } from '$lib/api/client';
	import type { UnifiedDevice } from '$types';

	interface Props {
		device: UnifiedDevice;
	}

	let { device }: Props = $props();

	// Extract state (default to off, brightness 100)
	// TypeScript doesn't know platformSpecific.state structure, so we type cast
	let isOn = $state(
		(() => {
			const state = device.platformSpecific?.state as any;
			return state?.switch === 'on' || state?.switch === true || false;
		})()
	);
	let brightness = $state(
		(() => {
			const state = device.platformSpecific?.state as any;
			return state?.level ?? state?.brightness ?? 100;
		})()
	);
	let loading = $state(false);

	// Debounce timer
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Toggle on/off
	 */
	async function toggleSwitch() {
		if (!device.online || loading) return;

		loading = true;
		const originalState = isOn;
		const newState = !isOn;

		// Optimistic update
		isOn = newState;

		try {
			const result = newState
				? await apiClient.turnOnDevice(device.platformDeviceId as any)
				: await apiClient.turnOffDevice(device.platformDeviceId as any);

			if (!result.success) {
				isOn = originalState;
				console.error('Failed to toggle device:', result.error.message);
			}
		} catch (error) {
			isOn = originalState;
			console.error('Error toggling device:', error);
		} finally {
			loading = false;
		}
	}

	/**
	 * Handle brightness change with debouncing
	 * Updates UI immediately but delays API call
	 */
	function onBrightnessChange(event: Event) {
		const target = event.target as HTMLInputElement;
		brightness = parseInt(target.value, 10);

		// Clear existing timeout
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		// Debounce API call by 300ms
		debounceTimeout = setTimeout(() => {
			setBrightness(brightness);
		}, 300);
	}

	/**
	 * Set brightness via API
	 * TODO: Implement setLevel API endpoint
	 */
	async function setBrightness(level: number) {
		console.log('Set brightness to', level);
		// API call will be implemented when setLevel endpoint is added
	}
</script>

<div class="space-y-3">
	<!-- On/Off Toggle -->
	<div class="flex items-center gap-3">
		<button
			class="btn variant-filled-{isOn ? 'primary' : 'surface'} {loading
				? 'opacity-75'
				: ''} transition-all"
			disabled={!device.online || loading}
			onclick={toggleSwitch}
			aria-pressed={isOn}
			aria-label="Toggle {device.name}"
		>
			{#if loading}
				<span class="animate-spin">⟳</span>
			{:else}
				<span class="text-lg">{isOn ? '●' : '○'}</span>
			{/if}
			<span class="text-sm font-medium">{isOn ? 'On' : 'Off'}</span>
		</button>

		{#if !device.online}
			<span class="text-xs text-gray-500 italic">Offline</span>
		{/if}
	</div>

	<!-- Brightness Slider (only when on) -->
	{#if isOn}
		<div class="space-y-1">
			<label class="text-xs text-gray-600 font-medium" for="brightness-{device.id}">
				Brightness: {brightness}%
			</label>
			<input
				id="brightness-{device.id}"
				type="range"
				min="0"
				max="100"
				step="1"
				value={brightness}
				disabled={!device.online}
				oninput={onBrightnessChange}
				class="w-full accent-primary-500"
			/>
		</div>
	{/if}
</div>

<style>
	/* Custom range slider styling */
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
