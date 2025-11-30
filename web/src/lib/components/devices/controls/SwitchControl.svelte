<script lang="ts">
	/**
	 * Switch Control Component
	 *
	 * Binary on/off toggle for devices with SWITCH capability.
	 *
	 * Features:
	 * - Optimistic UI updates (instant feedback)
	 * - Automatic rollback on error
	 * - Loading state indication
	 * - Disabled state for offline devices
	 *
	 * Design Pattern: Optimistic Update with Rollback
	 * - Update UI immediately for responsiveness
	 * - Send API request in background
	 * - Rollback if request fails
	 */

	import { apiClient } from '$lib/api/client';
	import type { UnifiedDevice } from '$types';

	interface Props {
		device: UnifiedDevice;
	}

	let { device }: Props = $props();

	// Extract switch state from device (default to false)
	// TypeScript doesn't know platformSpecific.state structure, so we type cast
	let isOn = $state(
		(() => {
			const state = device.platformSpecific?.state as any;
			return state?.switch === 'on' || state?.switch === true || false;
		})()
	);
	let loading = $state(false);

	/**
	 * Toggle switch with optimistic update and rollback on error
	 */
	async function toggleSwitch() {
		if (!device.online || loading) return;

		loading = true;
		const originalState = isOn;
		const newState = !isOn;

		// Optimistic update (instant UI feedback)
		isOn = newState;

		try {
			const result = newState
				? await apiClient.turnOnDevice(device.platformDeviceId as any)
				: await apiClient.turnOffDevice(device.platformDeviceId as any);

			if (!result.success) {
				// Rollback on API error
				isOn = originalState;
				console.error('Failed to toggle device:', result.error.message);
			}
		} catch (error) {
			// Rollback on network error
			isOn = originalState;
			console.error('Error toggling device:', error);
		} finally {
			loading = false;
		}
	}
</script>

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
