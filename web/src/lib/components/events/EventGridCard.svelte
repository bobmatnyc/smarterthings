<script lang="ts">
	/**
	 * Event Grid Card Component
	 *
	 * Compact card showing the most recent event for a device.
	 * Used in the Grid view on the Events page.
	 *
	 * Design Decision: Compact, color-coded cards
	 * Rationale: Grid view needs to show many devices at once, so cards
	 * must be compact while still conveying essential information.
	 *
	 * Features:
	 * - Device name and formatted event value
	 * - Event type badge with color coding
	 * - Relative timestamp
	 * - Hover effects for interactivity
	 *
	 * Architecture:
	 * - Reuses formatEventValue utility for consistent formatting
	 * - Color-coded by event type for quick visual scanning
	 * - Responsive design with consistent padding
	 */

	import type { SmartHomeEvent } from '$lib/stores/eventsStore.svelte';
	import { formatEventValue, getEventTypeLabel } from '$lib/utils/eventFormatters';

	interface Props {
		event: SmartHomeEvent;
	}

	let { event }: Props = $props();

	/**
	 * Format timestamp as relative time
	 */
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

	/**
	 * Get badge color for event type
	 */
	function getTypeBadgeColor(type: string): string {
		const colors: Record<string, string> = {
			device_event: 'badge variant-ghost-primary',
			user_command: 'badge variant-ghost-secondary',
			automation_trigger: 'badge variant-ghost-tertiary',
			rule_execution: 'badge variant-ghost-success',
		};
		return colors[type] || 'badge variant-ghost-surface';
	}

	/**
	 * Get device icon based on event type or device state
	 */
	function getDeviceIcon(): string {
		// Check event value for specific device types
		const value = event.value;
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, unknown>;
			if ('switch' in obj) return '💡';
			if ('motion' in obj) return '🏃';
			if ('contact' in obj) return '🚪';
			if ('temperature' in obj) return '🌡️';
			if ('battery' in obj) return '🔋';
			if ('lock' in obj) return '🔒';
			if ('presence' in obj) return '👤';
		}
		return '📱'; // Default
	}

	const formattedValue = $derived(formatEventValue(event.value));
</script>

<div
	class="card p-4 hover:shadow-lg transition-all bg-white dark:bg-surface-800 h-full flex flex-col"
>
	<!-- Header: Device Name and Icon -->
	<div class="flex items-start justify-between mb-3">
		<div class="flex items-center gap-2 flex-1 min-w-0">
			<div class="text-2xl flex-shrink-0" aria-hidden="true">
				{getDeviceIcon()}
			</div>
			<h3 class="font-semibold truncate" title={event.deviceName || 'Unknown Device'}>
				{event.deviceName || 'Unknown Device'}
			</h3>
		</div>
	</div>

	<!-- Event Value (Primary Information) -->
	<div class="flex-1 mb-3">
		<p class="text-2xl font-bold text-surface-900-50-token" title={formattedValue}>
			{formattedValue}
		</p>
		{#if event.eventType}
			<p class="text-sm text-surface-600-300-token mt-1">
				{event.eventType}
			</p>
		{/if}
	</div>

	<!-- Footer: Event Type and Timestamp -->
	<div class="flex items-center justify-between gap-2 pt-3 border-t border-surface-300-600-token">
		<span class={getTypeBadgeColor(event.type)}>
			{getEventTypeLabel(event.type)}
		</span>
		<span class="text-xs text-surface-600-300-token whitespace-nowrap">
			{formatTimestamp(event.timestamp)}
		</span>
	</div>
</div>

<style>
	/**
	 * Grid Card Styles
	 *
	 * Design: Consistent height with flex layout
	 * Ensures all cards in grid have same height for visual consistency
	 */
	.card {
		min-height: 180px;
	}
</style>
