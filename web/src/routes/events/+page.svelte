<script lang="ts">
	/**
	 * Events Page - Real-time smart home event monitoring
	 *
	 * Design: Svelte 5 Runes with SSE integration
	 * Features:
	 * - Real-time event streaming via Server-Sent Events (SSE)
	 * - Two view modes: Timeline (streaming list) and Grid (unique devices)
	 * - Event filtering by type and source
	 * - Auto-scroll toggle for new events
	 * - Connection status indicator
	 *
	 * View Modes:
	 * - Timeline: Chronological list of all events (default)
	 * - Grid: Most recent event per device, sorted by recency
	 *
	 * Performance:
	 * - SSE latency: < 100ms (server → client)
	 * - Automatic reconnection with exponential backoff
	 * - Event list capped at 500 for performance
	 */
	import { getEventsStore } from '$lib/stores/eventsStore.svelte';
	import type { SmartHomeEvent } from '$lib/stores/eventsStore.svelte';
	import EventGridCard from '$lib/components/events/EventGridCard.svelte';

	const store = getEventsStore();

	// View mode state: 'timeline' or 'grid'
	let viewMode = $state<'timeline' | 'grid'>('timeline');

	// Svelte 5 Runes: Load events and connect SSE on mount, cleanup on unmount
	$effect(() => {
		store.loadEvents(100);
		store.connectSSE();

		// Cleanup function runs on component unmount
		return () => {
			store.disconnectSSE();
		};
	});

	/**
	 * Grid View: Unique devices with most recent event
	 *
	 * Design Decision: Device-centric view
	 * Rationale: Shows which devices have been active recently at a glance.
	 * Groups events by device and keeps only the most recent per device.
	 *
	 * Algorithm:
	 * 1. Sort all events by timestamp (most recent first)
	 * 2. Keep only first occurrence of each deviceId
	 * 3. Result: Array of most recent events per device, sorted by recency
	 */
	const uniqueDeviceEvents = $derived.by(() => {
		const deviceMap = new Map<string, SmartHomeEvent>();

		// Sort by timestamp descending first (most recent first)
		const sorted = [...store.filteredEvents].sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);

		// Keep only most recent event per device
		for (const event of sorted) {
			if (event.deviceId && !deviceMap.has(event.deviceId)) {
				deviceMap.set(event.deviceId, event);
			}
		}

		return Array.from(deviceMap.values());
	});

	// Format timestamp as relative time
	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);
		const diffDay = Math.floor(diffHour / 24);

		if (diffSec < 60) return `${diffSec}s ago`;
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHour < 24) return `${diffHour}h ago`;
		return `${diffDay}d ago`;
	}

	// Get badge color for event type
	function getTypeBadgeColor(type: string): string {
		const colors: Record<string, string> = {
			device_event: 'badge variant-ghost-primary',
			user_command: 'badge variant-ghost-secondary',
			automation_trigger: 'badge variant-ghost-tertiary',
			rule_execution: 'badge variant-ghost-success',
		};
		return colors[type] || 'badge variant-ghost-surface';
	}

	// Get badge color for event source
	function getSourceBadgeColor(source: string): string {
		const colors: Record<string, string> = {
			smartthings: 'badge variant-filled-primary',
			alexa: 'badge variant-filled-secondary',
			mcp: 'badge variant-filled-tertiary',
			webhook: 'badge variant-filled-surface',
		};
		return colors[source] || 'badge variant-filled-surface';
	}
</script>

<div class="container mx-auto p-4 max-w-7xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="h1 mb-2">Events</h1>
		<p class="text-surface-600-300-token">Real-time smart home event monitoring</p>
	</div>

	<!-- Status Bar -->
	<div class="card p-4 mb-4">
		<div class="flex items-center justify-between flex-wrap gap-4">
			<div class="flex items-center gap-4">
				<!-- Connection Status -->
				<div class="flex items-center gap-2">
					<div
						class="w-2 h-2 rounded-full {store.connected
							? 'bg-success-500'
							: 'bg-error-500'} animate-pulse"
					></div>
					<span class="text-sm">
						{store.connected ? 'Connected' : 'Disconnected'}
					</span>
				</div>

				<!-- Stats -->
				<div class="text-sm text-surface-600-300-token">
					{#if viewMode === 'grid'}
						{uniqueDeviceEvents.length} unique devices
					{:else}
						{store.stats.filtered} / {store.stats.total} events
					{/if}
				</div>
			</div>

			<!-- View Toggle and Actions -->
			<div class="flex items-center gap-2">
				<!-- View Mode Toggle -->
				<div class="btn-group variant-ghost">
					<button
						class="btn btn-sm {viewMode === 'timeline' ? 'variant-filled-primary' : 'variant-ghost'}"
						on:click={() => (viewMode = 'timeline')}
						title="Timeline view - Chronological list of all events"
					>
						Timeline
					</button>
					<button
						class="btn btn-sm {viewMode === 'grid' ? 'variant-filled-primary' : 'variant-ghost'}"
						on:click={() => (viewMode = 'grid')}
						title="Grid view - Most recent event per device"
					>
						Grid
					</button>
				</div>

				<!-- Auto-scroll (Timeline only) -->
				{#if viewMode === 'timeline'}
					<button
						class="btn btn-sm variant-ghost-surface"
						on:click={() => store.setAutoScroll(!store.autoScroll)}
					>
						{store.autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
					</button>
				{/if}

				<button class="btn btn-sm variant-ghost-primary" on:click={() => store.loadEvents(100)}>
					Refresh
				</button>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="card p-4 mb-4">
		<div class="flex flex-wrap gap-3">
			<!-- Type Filter -->
			<select
				class="select w-48"
				value={store.filters.type || ''}
				on:change={(e) => store.setTypeFilter(e.currentTarget.value || null)}
			>
				<option value="">All Types</option>
				<option value="device_event">Device Event</option>
				<option value="user_command">User Command</option>
				<option value="automation_trigger">Automation Trigger</option>
				<option value="rule_execution">Rule Execution</option>
			</select>

			<!-- Source Filter -->
			<select
				class="select w-48"
				value={store.filters.source || ''}
				on:change={(e) => store.setSourceFilter(e.currentTarget.value || null)}
			>
				<option value="">All Sources</option>
				<option value="smartthings">SmartThings</option>
				<option value="alexa">Alexa</option>
				<option value="mcp">MCP</option>
				<option value="webhook">Webhook</option>
			</select>

			<!-- Clear Filters -->
			{#if store.filters.type || store.filters.source}
				<button class="btn btn-sm variant-ghost-surface" on:click={() => store.clearFilters()}>
					Clear Filters
				</button>
			{/if}
		</div>
	</div>

	<!-- Loading State -->
	{#if store.loading}
		<div class="card p-8 text-center">
			<p class="text-surface-600-300-token">Loading events...</p>
		</div>
	{/if}

	<!-- Error State -->
	{#if store.error}
		<div class="alert variant-filled-error mb-4">
			<p>{store.error}</p>
		</div>
	{/if}

	<!-- Timeline View: Chronological list of all events -->
	{#if viewMode === 'timeline'}
		{#if !store.loading && store.filteredEvents.length > 0}
			<div class="space-y-2">
				{#each store.filteredEvents as event (event.id)}
					<div class="card p-4 hover:variant-soft-surface transition-colors">
						<div class="flex items-start justify-between gap-4">
							<!-- Event Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-2">
									<span class={getTypeBadgeColor(event.type)}>{event.type}</span>
									<span class={getSourceBadgeColor(event.source)}>{event.source}</span>
									{#if event.eventType}
										<span class="text-sm text-surface-600-300-token">{event.eventType}</span>
									{/if}
								</div>

								{#if event.deviceName}
									<p class="font-semibold mb-1">{event.deviceName}</p>
								{/if}

								{#if event.value}
									<p class="text-sm text-surface-600-300-token">
										Value: {typeof event.value === 'object'
											? JSON.stringify(event.value)
											: String(event.value)}
									</p>
								{/if}
							</div>

							<!-- Timestamp -->
							<div class="text-sm text-surface-600-300-token whitespace-nowrap">
								{formatTimestamp(event.timestamp)}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Grid View: Most recent event per device -->
	{#if viewMode === 'grid'}
		{#if !store.loading && uniqueDeviceEvents.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each uniqueDeviceEvents as event (event.id)}
					<EventGridCard {event} />
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Empty State -->
	{#if !store.loading && (viewMode === 'timeline' ? store.filteredEvents.length === 0 : uniqueDeviceEvents.length === 0)}
		<div class="card p-8 text-center">
			<p class="text-surface-600-300-token">
				{viewMode === 'grid' ? 'No device events found' : 'No events found'}
			</p>
			<p class="text-sm text-surface-600-300-token mt-2">
				{#if store.filters.type || store.filters.source}
					Try adjusting your filters
				{:else}
					Events will appear here as they occur
				{/if}
			</p>
		</div>
	{/if}
</div>
