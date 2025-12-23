<script lang="ts">
	/**
	 * AlertOverlay Component - Toast-style notification overlay
	 *
	 * Design: Fixed top-right overlay with stacked alerts
	 *
	 * Features:
	 * - Priority-based colors (info: blue, warning: amber, critical: red)
	 * - Auto-dismiss after 10s (configurable in store)
	 * - Manual dismiss (X button)
	 * - Slide-in animation from right
	 * - Max 5 visible alerts
	 * - Pulse animation for critical alerts
	 * - ARIA live regions for accessibility
	 *
	 * Architecture:
	 * - Consumes alertStore for reactive state
	 * - Displays visibleAlerts from store
	 * - Calls dismissAlert on manual dismiss
	 */

	import { getAlertStore } from '$lib/stores/alertStore.svelte';

	const alertStore = getAlertStore();

	/**
	 * Get priority styles (background, text, icon color)
	 */
	function getPriorityStyles(priority: string): {
		bg: string;
		text: string;
		border: string;
	} {
		switch (priority) {
			case 'critical':
				return {
					bg: 'rgb(254, 242, 242)',
					text: 'rgb(239, 68, 68)',
					border: 'rgb(239, 68, 68)'
				};
			case 'warning':
				return {
					bg: 'rgb(255, 251, 235)',
					text: 'rgb(245, 158, 11)',
					border: 'rgb(245, 158, 11)'
				};
			case 'info':
			default:
				return {
					bg: 'rgb(239, 246, 255)',
					text: 'rgb(59, 130, 246)',
					border: 'rgb(59, 130, 246)'
				};
		}
	}

	/**
	 * Get category icon SVG path
	 */
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'security':
				// Shield icon
				return 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
			case 'energy':
				// Lightning bolt icon
				return 'M13 2L3 14h8l-1 8 10-12h-8l1-8z';
			case 'system':
				// Alert triangle icon
				return 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01';
			case 'activity':
			default:
				// Activity icon
				return 'M22 12h-4l-3 9L9 3l-3 9H2';
		}
	}
</script>

<!-- Alert Overlay Container (top-right) -->
<div class="alert-overlay" role="region" aria-label="Notifications">
	{#each alertStore.visibleAlerts as alert (alert.id)}
		{@const styles = getPriorityStyles(alert.priority)}

		<!-- Alert Card -->
		<div
			class="alert-card"
			class:critical={alert.priority === 'critical'}
			style="--alert-bg: {styles.bg}; --alert-text: {styles.text}; --alert-border: {styles.border};"
			role="alert"
			aria-live={alert.priority === 'critical' ? 'assertive' : 'polite'}
			aria-atomic="true"
		>
			<!-- Icon -->
			<div class="alert-icon">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d={getCategoryIcon(alert.category)}></path>
				</svg>
			</div>

			<!-- Content -->
			<div class="alert-content">
				<p class="alert-message">{alert.message}</p>
				<span class="alert-meta">{alert.category} • {alert.priority}</span>
			</div>

			<!-- Dismiss Button -->
			<button
				class="alert-dismiss"
				onclick={() => alertStore.dismissAlert(alert.id)}
				aria-label="Dismiss alert"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	{/each}
</div>

<style>
	.alert-overlay {
		position: fixed;
		top: 1.5rem;
		right: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		z-index: 9999;
		pointer-events: none;
		max-width: 28rem;
	}

	.alert-card {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: var(--alert-bg);
		border: 2px solid var(--alert-border);
		border-radius: 0.75rem;
		padding: 1rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
		pointer-events: auto;
		animation: slideIn 0.3s ease-out;
		color: var(--alert-text);
	}

	.alert-card.critical {
		animation: slideIn 0.3s ease-out, pulse 1.5s ease-in-out infinite;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(2rem);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
		}
		50% {
			box-shadow: 0 10px 35px rgba(239, 68, 68, 0.4);
		}
	}

	.alert-icon {
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--alert-text);
	}

	.alert-icon svg {
		width: 100%;
		height: 100%;
	}

	.alert-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.alert-message {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 500;
		line-height: 1.5;
		color: rgb(17, 24, 39);
	}

	.alert-meta {
		font-size: 0.8125rem;
		color: rgb(107, 114, 128);
		text-transform: capitalize;
	}

	.alert-dismiss {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		border: none;
		color: rgb(107, 114, 128);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.alert-dismiss:hover {
		background: rgba(0, 0, 0, 0.1);
		color: rgb(17, 24, 39);
	}

	.alert-dismiss svg {
		width: 100%;
		height: 100%;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.alert-overlay {
			top: 1rem;
			right: 1rem;
			left: 1rem;
			max-width: none;
		}

		.alert-card {
			padding: 0.875rem;
		}

		.alert-message {
			font-size: 0.875rem;
		}

		.alert-meta {
			font-size: 0.75rem;
		}
	}
</style>
