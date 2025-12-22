<script lang="ts">
	/**
	 * Battery Monitoring Page
	 *
	 * Features:
	 * - Display devices with battery level < 50%
	 * - Sort by battery level (lowest first - most urgent)
	 * - Color-coded battery indicators:
	 *   - Red: < 20% (critical)
	 *   - Orange: 20-35% (low)
	 *   - Yellow: 35-50% (moderate)
	 * - Empty state for when all devices have sufficient battery
	 *
	 * Architecture:
	 * - Uses deviceStore for state management
	 * - Svelte 5 Runes for reactive state ($derived)
	 * - Reuses DeviceCard component for consistency
	 *
	 * Performance:
	 * - Filters and sorts reactively with $derived
	 * - Only re-renders when device battery levels change
	 */

	import { onMount } from 'svelte';
	import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
	import DeviceCard from '$lib/components/devices/DeviceCard.svelte';
	import type { UnifiedDevice } from '$types';

	const store = getDeviceStore();

	/**
	 * Filter to devices with battery capability and low battery (< 50%)
	 * Sort by battery level (lowest first for urgency)
	 */
	const lowBatteryDevices = $derived.by(() => {
		return store.devices
			.filter((d) => {
				const battery = d.platformSpecific?.state?.battery;
				return typeof battery === 'number' && battery < 50;
			})
			.sort((a, b) => {
				const levelA = (a.platformSpecific?.state?.battery as number) ?? 100;
				const levelB = (b.platformSpecific?.state?.battery as number) ?? 100;
				return levelA - levelB;
			});
	});

	/**
	 * Battery level statistics
	 */
	const stats = $derived({
		total: lowBatteryDevices.length,
		critical: lowBatteryDevices.filter((d) => {
			const battery = d.platformSpecific?.state?.battery as number;
			return battery < 20;
		}).length,
		low: lowBatteryDevices.filter((d) => {
			const battery = d.platformSpecific?.state?.battery as number;
			return battery >= 20 && battery < 35;
		}).length,
		moderate: lowBatteryDevices.filter((d) => {
			const battery = d.platformSpecific?.state?.battery as number;
			return battery >= 35 && battery < 50;
		}).length
	});

	/**
	 * Get battery level color class
	 *
	 * @param battery Battery level (0-100)
	 * @returns Tailwind color class
	 */
	function getBatteryColor(battery: number): string {
		if (battery < 20) return 'text-red-600 dark:text-red-400';
		if (battery < 35) return 'text-orange-600 dark:text-orange-400';
		return 'text-yellow-600 dark:text-yellow-400';
	}

	/**
	 * Get battery level badge variant
	 *
	 * @param battery Battery level (0-100)
	 * @returns Skeleton UI badge variant
	 */
	function getBatteryBadgeVariant(battery: number): string {
		if (battery < 20) return 'variant-filled-error';
		if (battery < 35) return 'variant-filled-warning';
		return 'variant-filled-surface';
	}

	/**
	 * Load devices on mount
	 */
	onMount(() => {
		store.loadDevices();
	});
</script>

<svelte:head>
	<title>Battery - Smarter Things</title>
	<meta name="description" content="Monitor devices with low battery levels" />
</svelte:head>

<div class="battery-page max-w-7xl mx-auto px-4 py-6">
	<!-- Header -->
	<header class="mb-8">
		<div class="flex items-center gap-4 mb-4">
			<div class="text-5xl" aria-hidden="true">🔋</div>
			<div>
				<h1 class="text-3xl font-bold text-surface-900-50-token">Battery Monitor</h1>
				<p class="text-surface-600-300-token mt-1">
					Devices with battery level below 50%
				</p>
			</div>
		</div>

		<!-- Statistics Summary -->
		{#if !store.loading && lowBatteryDevices.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
				<!-- Total -->
				<div class="card p-4 bg-surface-100-800-token">
					<div class="text-2xl font-bold text-surface-900-50-token">{stats.total}</div>
					<div class="text-sm text-surface-600-300-token">Total Devices</div>
				</div>

				<!-- Critical -->
				<div class="card p-4 bg-red-50 dark:bg-red-900/20">
					<div class="text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</div>
					<div class="text-sm text-red-600 dark:text-red-400">Critical (&lt;20%)</div>
				</div>

				<!-- Low -->
				<div class="card p-4 bg-orange-50 dark:bg-orange-900/20">
					<div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.low}</div>
					<div class="text-sm text-orange-600 dark:text-orange-400">Low (20-35%)</div>
				</div>

				<!-- Moderate -->
				<div class="card p-4 bg-yellow-50 dark:bg-yellow-900/20">
					<div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
						{stats.moderate}
					</div>
					<div class="text-sm text-yellow-600 dark:text-yellow-400">Moderate (35-50%)</div>
				</div>
			</div>
		{/if}
	</header>

	<!-- Loading State -->
	{#if store.loading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
				<p class="text-surface-600-300-token mt-4">Loading devices...</p>
			</div>
		</div>
	{/if}

	<!-- Error State -->
	{#if store.error}
		<div class="card variant-filled-error p-6 text-center">
			<p class="font-semibold">Error loading devices</p>
			<p class="text-sm mt-2">{store.error}</p>
		</div>
	{/if}

	<!-- Empty State -->
	{#if !store.loading && !store.error && lowBatteryDevices.length === 0}
		<div class="card p-12 text-center bg-surface-100-800-token">
			<div class="text-6xl mb-4" aria-hidden="true">✅</div>
			<h2 class="text-2xl font-semibold text-surface-900-50-token mb-2">
				All Batteries Healthy
			</h2>
			<p class="text-surface-600-300-token">
				No devices currently have battery levels below 50%
			</p>
		</div>
	{/if}

	<!-- Device Grid -->
	{#if !store.loading && !store.error && lowBatteryDevices.length > 0}
		<div class="device-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each lowBatteryDevices as device (device.id)}
				<div class="relative">
					<!-- Battery Level Indicator Badge -->
					<div class="absolute top-2 right-2 z-10">
						<span
							class="badge {getBatteryBadgeVariant(
								device.platformSpecific?.state?.battery as number
							)} font-semibold"
							aria-label="Battery level: {device.platformSpecific?.state?.battery}%"
						>
							🔋 {device.platformSpecific?.state?.battery}%
						</span>
					</div>

					<!-- Device Card -->
					<DeviceCard {device} />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/**
	 * Battery Page Styles
	 *
	 * Responsive grid layout with optimal spacing
	 */

	.battery-page {
		min-height: calc(100vh - 200px);
	}

	/**
	 * Device Grid
	 *
	 * Responsive breakpoints:
	 * - Mobile: 1 column
	 * - Tablet: 2 columns
	 * - Desktop: 3 columns
	 */
	.device-grid {
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/**
	 * Card hover effect
	 *
	 * Subtle lift on hover for interactivity
	 */
	.device-grid > div:hover {
		transform: translateY(-2px);
		transition: transform 0.2s ease;
	}
</style>
