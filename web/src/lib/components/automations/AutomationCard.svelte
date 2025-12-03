<script lang="ts">
	/**
	 * Automation Card Component
	 *
	 * Design: Clean card showing automation name, status, and toggle control
	 * Inspired by Apple Home app automations and SmartThings routines
	 *
	 * Visual Design:
	 * - Rounded corners with subtle shadow
	 * - Hover elevation effect
	 * - Status indicator (enabled/disabled)
	 * - Toggle switch for quick enable/disable
	 * - Icon representing automation type
	 *
	 * Accessibility:
	 * - Semantic article element
	 * - Proper heading hierarchy
	 * - ARIA labels for toggle switch
	 * - Keyboard navigable with clear focus
	 * - Screen reader friendly status announcements
	 *
	 * Performance:
	 * - Lightweight CSS transitions
	 * - No JavaScript for hover effects
	 * - Optimistic UI updates for toggle
	 *
	 * Interaction:
	 * - Clicking card navigates to automation details (future)
	 * - Toggle switch enables/disables automation
	 * - Visual feedback on interaction
	 */

	import type { Scene } from '$lib/stores/scenesStore.svelte';
	import { getScenesStore } from '$lib/stores/scenesStore.svelte';

	interface Props {
		scene: Scene;
	}

	let { scene }: Props = $props();

	const scenesStore = getScenesStore();

	let isExecuting = $state(false);

	async function handleExecute(event: Event) {
		event.preventDefault();
		event.stopPropagation();

		if (isExecuting) return;

		isExecuting = true;
		await scenesStore.executeScene(scene.id);
		isExecuting = false;
	}

	// Format last executed time
	const lastExecutedText = $derived(() => {
		if (!scene.lastExecuted) return 'Never executed';

		const date = new Date(scene.lastExecuted);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 60) {
			return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
		} else if (diffHours < 24) {
			return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
		} else if (diffDays < 7) {
			return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
		} else {
			return date.toLocaleDateString();
		}
	});
</script>

<article class="automation-card" class:disabled={!scene.enabled}>
	<div class="card-content">
		<!-- Scene Icon -->
		<div class="automation-icon" aria-hidden="true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
			</svg>
		</div>

		<!-- Scene Info -->
		<div class="automation-info">
			<div class="header-row">
				<h3 class="automation-name">{scene.name}</h3>

				<!-- Status Badge -->
				<div class="status-badge" class:enabled={scene.enabled}>
					<span class="status-dot"></span>
					<span class="status-text">{scene.enabled ? 'Ready' : 'Disabled'}</span>
				</div>
			</div>

			<!-- Scene Type (Manual trigger) -->
			<div class="automation-triggers">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="trigger-icon"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<span class="trigger-text">Manual</span>
			</div>

			<!-- Last Executed -->
			<div class="last-executed">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="clock-icon"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<span>Last run: {lastExecutedText()}</span>
			</div>
		</div>

		<!-- Execute Button -->
		<div class="toggle-wrapper">
			<button
				class="toggle-switch"
				class:active={true}
				class:toggling={isExecuting}
				onclick={handleExecute}
				aria-label={`Execute ${scene.name}`}
				disabled={isExecuting}
			>
				<span class="toggle-slider"></span>
			</button>
		</div>
	</div>
</article>

<style>
	.automation-card {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid rgb(229, 231, 235);
		overflow: hidden;
	}

	.automation-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border-color: rgb(59, 130, 246);
	}

	.automation-card.disabled {
		opacity: 0.7;
	}

	.card-content {
		padding: 1.5rem;
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}

	/* Automation Icon */
	.automation-icon {
		width: 3rem;
		height: 3rem;
		background: linear-gradient(135deg, rgb(239, 246, 255) 0%, rgb(219, 234, 254) 100%);
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(59, 130, 246);
		flex-shrink: 0;
	}

	.automation-card.disabled .automation-icon {
		background: linear-gradient(135deg, rgb(249, 250, 251) 0%, rgb(243, 244, 246) 100%);
		color: rgb(156, 163, 175);
	}

	.automation-icon svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Automation Info */
	.automation-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.automation-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
		line-height: 1.3;
	}

	/* Status Badge */
	.status-badge {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		background: rgb(243, 244, 246);
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(107, 114, 128);
	}

	.status-badge.enabled {
		background: rgb(220, 252, 231);
		color: rgb(21, 128, 61);
	}

	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: rgb(156, 163, 175);
	}

	.status-badge.enabled .status-dot {
		background: rgb(34, 197, 94);
	}

	/* Triggers */
	.automation-triggers {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: rgb(107, 114, 128);
	}

	.trigger-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.trigger-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Last Executed */
	.last-executed {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: rgb(156, 163, 175);
	}

	.clock-icon {
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
	}

	/* Toggle Switch */
	.toggle-wrapper {
		display: flex;
		align-items: flex-start;
		padding-top: 0.25rem;
	}

	.toggle-switch {
		width: 3rem;
		height: 1.75rem;
		background: rgb(209, 213, 219);
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		position: relative;
		transition: background-color 0.2s ease;
		padding: 0;
		flex-shrink: 0;
	}

	.toggle-switch:hover {
		background: rgb(156, 163, 175);
	}

	.toggle-switch:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.toggle-switch.active {
		background: rgb(59, 130, 246);
	}

	.toggle-switch.active:hover {
		background: rgb(37, 99, 235);
	}

	.toggle-switch.toggling {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.toggle-slider {
		display: block;
		width: 1.25rem;
		height: 1.25rem;
		background: white;
		border-radius: 50%;
		position: absolute;
		top: 0.25rem;
		left: 0.25rem;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.toggle-switch.active .toggle-slider {
		transform: translateX(1.25rem);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.card-content {
			padding: 1.25rem;
			gap: 1rem;
		}

		.automation-icon {
			width: 2.5rem;
			height: 2.5rem;
		}

		.automation-icon svg {
			width: 1.25rem;
			height: 1.25rem;
		}

		.automation-name {
			font-size: 1rem;
		}

		.status-badge {
			font-size: 0.75rem;
			padding: 0.2rem 0.625rem;
		}

		.automation-triggers,
		.last-executed {
			font-size: 0.8125rem;
		}

		.toggle-switch {
			width: 2.75rem;
			height: 1.625rem;
		}

		.toggle-slider {
			width: 1.125rem;
			height: 1.125rem;
		}

		.toggle-switch.active .toggle-slider {
			transform: translateX(1.125rem);
		}
	}

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.card-content {
			padding: 1.375rem;
		}
	}

	/* Prevent text selection on rapid clicks */
	.automation-card {
		user-select: none;
		-webkit-user-select: none;
	}

	.automation-name {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
