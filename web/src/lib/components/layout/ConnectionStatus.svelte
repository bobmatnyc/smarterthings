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
	 * Features:
	 * - Logout/disconnect button for OAuth re-authentication
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
	import { toast } from 'svelte-sonner';

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

	// Logout state
	let loggingOut = $state(false);

	/**
	 * Disconnect OAuth and reload to show connect screen
	 */
	async function handleLogout(): Promise<void> {
		if (loggingOut) return;

		loggingOut = true;
		try {
			const response = await fetch('/api/auth/smartthings/disconnect', {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('Failed to disconnect');
			}

			toast.success('Disconnected from SmartThings');

			// Reload page to show connect screen
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (err) {
			console.error('Logout failed:', err);
			toast.error('Failed to disconnect');
			loggingOut = false;
		}
	}
</script>

<div class="connection-wrapper">
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

	<!-- Logout Button -->
	<button
		class="logout-button"
		onclick={handleLogout}
		disabled={loggingOut}
		title="Disconnect SmartThings"
		aria-label="Disconnect SmartThings account"
	>
		{#if loggingOut}
			<span class="logout-spinner"></span>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
				<polyline points="16 17 21 12 16 7"></polyline>
				<line x1="21" y1="12" x2="9" y2="12"></line>
			</svg>
		{/if}
	</button>
</div>

<style>
	.connection-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

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

	/* Logout Button */
	.logout-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.375rem;
		background-color: transparent;
		color: rgb(107, 114, 128); /* gray-500 */
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.logout-button:hover {
		background-color: rgb(254, 226, 226); /* red-100 */
		color: rgb(220, 38, 38); /* red-600 */
	}

	.logout-button:focus {
		outline: 2px solid rgb(220, 38, 38);
		outline-offset: 2px;
	}

	.logout-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.logout-button svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.logout-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid rgb(209, 213, 219);
		border-top-color: rgb(107, 114, 128);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
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

		.logout-button {
			width: 1.75rem;
			height: 1.75rem;
		}

		.logout-button svg {
			width: 1rem;
			height: 1rem;
		}
	}
</style>
