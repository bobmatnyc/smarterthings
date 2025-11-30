<script lang="ts">
	/**
	 * Device Grid Component
	 *
	 * Responsive grid layout for device cards.
	 *
	 * Design Decision: CSS Grid with Responsive Breakpoints
	 * Rationale: CSS Grid provides optimal layout with minimal JavaScript.
	 * Mobile-first approach ensures good UX on all devices.
	 *
	 * Grid Layout:
	 * - Mobile (< 640px): 1 column
	 * - Tablet (640px - 1024px): 2 columns
	 * - Desktop (> 1024px): 3 columns
	 *
	 * Performance:
	 * - No virtual scrolling needed for <200 devices
	 * - Svelte 5 fine-grained reactivity ensures minimal re-renders
	 * - Lazy image loading for device icons
	 */

	import type { UnifiedDevice } from '$types';
	import DeviceCard from './DeviceCard.svelte';

	interface Props {
		devices: UnifiedDevice[];
		compact?: boolean;
	}

	let { devices, compact = false }: Props = $props();
</script>

<!-- Responsive Grid -->
<div
	class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
	role="list"
	aria-label="Device list"
>
	{#each devices as device (device.id)}
		<div role="listitem">
			<DeviceCard {device} {compact} />
		</div>
	{/each}
</div>

<!-- Empty State (shown when no devices) -->
{#if devices.length === 0}
	<div class="text-center py-12">
		<div class="text-6xl mb-4" aria-hidden="true">📱</div>
		<h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No devices found</h3>
		<p class="text-gray-600 dark:text-gray-400">Try adjusting your filters</p>
	</div>
{/if}
