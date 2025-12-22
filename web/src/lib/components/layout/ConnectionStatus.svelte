<script lang="ts">
	/**
	 * Connection Status Indicator Component
	 *
	 * Design Decision: Real-time SSE connection status visualization
	 * Rationale: Users need visual feedback when SSE connection is active,
	 * reconnecting, or disconnected for troubleshooting and confidence.
	 *
	 * States:
	 * - Connected (green): SSE connection active
	 * - Reconnecting (amber): Attempting to reconnect
	 * - Disconnected (red): No SSE connection
	 *
	 * Accessibility:
	 * - ARIA role="status" for screen readers
	 * - Title attribute for tooltip
	 * - Color + icon + text for clarity
	 *
	 * Performance:
	 * - Minimal re-renders (only on connection state change)
	 * - Pure CSS animations (GPU-accelerated)
	 * - No external dependencies
	 */

	import { getDeviceStore } from '$lib/stores/deviceStore.svelte';

	const deviceStore = getDeviceStore();

	// Reactive connection status from device store
	// FIX: Use $derived.by() to properly track getter changes across component boundaries
	// The getter deviceStore.sseConnected returns module-level $state, which requires
	// explicit reactivity tracking in Svelte 5 when accessed from a different component
	let connected = $derived.by(() => deviceStore.sseConnected);

	// Derive status for display
	let status = $derived(connected ? 'connected' : 'reconnecting');
	let statusText = $derived(connected ? 'Connected' : 'Reconnecting...');
	let statusColor = $derived(connected ? 'green' : 'amber');
</script>

<div
	class="connection-status"
	class:connected={status === 'connected'}
	class:reconnecting={status === 'reconnecting'}
	role="status"
	aria-live="polite"
	title={statusText}
>
	<span class="pulse" class:green={statusColor === 'green'} class:amber={statusColor === 'amber'}></span>
	<span class="status-text">{statusText}</span>
</div>

<style>
	.connection-status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.connection-status.connected {
		background-color: rgb(236, 253, 245); /* green-50 */
		color: rgb(22, 101, 52); /* green-800 */
	}

	.connection-status.reconnecting {
		background-color: rgb(254, 243, 199); /* amber-100 */
		color: rgb(120, 53, 15); /* amber-900 */
	}

	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
	}

	.pulse.green {
		background-color: rgb(34, 197, 94); /* green-500 */
	}

	.pulse.amber {
		background-color: rgb(245, 158, 11); /* amber-500 */
	}

	.status-text {
		line-height: 1;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Mobile responsiveness - show only dot on small screens */
	@media (max-width: 768px) {
		.status-text {
			display: none;
		}

		.connection-status {
			padding: 0.5rem;
		}
	}
</style>
