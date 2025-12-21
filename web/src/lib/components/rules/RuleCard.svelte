<script lang="ts">
	/**
	 * Rule Card Component
	 *
	 * Design: Clean card showing rule name, status, triggers, and execute control
	 * Inspired by Apple Home app automations and SmartThings rules
	 *
	 * Visual Design:
	 * - Rounded corners with subtle shadow
	 * - Hover elevation effect
	 * - Status indicator (enabled/disabled)
	 * - Execute button for manual rule execution
	 * - Icon representing automation type
	 *
	 * Key Differences from AutomationCard (Scenes):
	 * - Rules can be enabled/disabled (badge shows actual state)
	 * - Rules have trigger conditions (not just "Manual")
	 * - Rules show action count
	 * - Execute button triggers rule manually
	 *
	 * Accessibility:
	 * - Semantic article element
	 * - Proper heading hierarchy
	 * - ARIA labels for execute button
	 * - Keyboard navigable with clear focus
	 * - Screen reader friendly status announcements
	 *
	 * Performance:
	 * - Lightweight CSS transitions
	 * - No JavaScript for hover effects
	 * - Optimistic UI updates for toggle
	 *
	 * Interaction:
	 * - Clicking card navigates to rule details (future)
	 * - Execute button runs rule immediately
	 * - Visual feedback on interaction
	 */

	import type { Rule } from '$lib/stores/rulesStore.svelte';
	import { getRulesStore } from '$lib/stores/rulesStore.svelte';

	interface Props {
		rule: Rule;
	}

	let { rule }: Props = $props();

	const rulesStore = getRulesStore();

	let isExecuting = $state(false);
	let isToggling = $state(false);

	async function handleExecute(event: Event) {
		event.preventDefault();
		event.stopPropagation();

		if (isExecuting) return;

		isExecuting = true;
		await rulesStore.executeRule(rule.id); // Toast handled in store
		isExecuting = false;
	}

	async function handleToggle(event: Event) {
		event.preventDefault();
		event.stopPropagation();

		if (isToggling) return;

		isToggling = true;
		const newEnabledState = !rule.enabled;
		await rulesStore.setRuleEnabled(rule.id, newEnabledState); // Toast handled in store
		isToggling = false;
	}

	// Format last executed time
	const lastExecutedText = $derived(() => {
		if (!rule.lastExecuted) return 'Never executed';

		const date = new Date(rule.lastExecuted);
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

<article class="rule-card" class:disabled={!rule.enabled}>
	<div class="card-content">
		<!-- Rule Icon -->
		<div class="rule-icon" aria-hidden="true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="3"></circle>
				<path d="M12 1v6m0 6v6m8.66-9l-5.2 3m-5.2 3l-5.2 3M20.66 17l-5.2-3m-5.2-3l-5.2-3"></path>
			</svg>
		</div>

		<!-- Rule Info -->
		<div class="rule-info">
			<div class="header-row">
				<h3 class="rule-name">{rule.name}</h3>

				<div class="header-controls">
					<!-- Enable/Disable Toggle -->
					<button
						class="toggle-switch"
						class:enabled={rule.enabled}
						class:toggling={isToggling}
						onclick={handleToggle}
						aria-label={rule.enabled ? `Disable ${rule.name}` : `Enable ${rule.name}`}
						disabled={isToggling}
					>
						<span class="toggle-slider"></span>
					</button>

					<!-- Status Badge -->
					<div class="status-badge" class:enabled={rule.enabled}>
						<span class="status-dot"></span>
						<span class="status-text">{rule.enabled ? 'Enabled' : 'Disabled'}</span>
					</div>
				</div>
			</div>

			<!-- Triggers -->
			{#if rule.triggers && rule.triggers.length > 0}
				<div class="rule-triggers">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="trigger-icon"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
					<span class="trigger-text">{rule.triggers[0]}</span>
					{#if rule.triggers.length > 1}
						<span class="trigger-count">+{rule.triggers.length - 1} more</span>
					{/if}
				</div>
			{/if}

			<!-- Actions Count -->
			{#if rule.actions && rule.actions.length > 0}
				<div class="rule-actions">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="action-icon"
					>
						<polyline points="9 11 12 14 22 4"></polyline>
						<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
					</svg>
					<span>{rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}</span>
				</div>
			{/if}

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
		<div class="execute-wrapper">
			<button
				class="execute-button"
				class:executing={isExecuting}
				onclick={handleExecute}
				aria-label={`Execute ${rule.name}`}
				disabled={isExecuting}
			>
				{#if isExecuting}
					<svg
						class="spinner"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polygon points="5 3 19 12 5 21 5 3"></polygon>
					</svg>
				{/if}
			</button>
		</div>
	</div>
</article>

<style>
	.rule-card {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid rgb(229, 231, 235);
		overflow: hidden;
	}

	.rule-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border-color: rgb(59, 130, 246);
	}

	.rule-card.disabled {
		opacity: 0.7;
	}

	.card-content {
		padding: 1.5rem;
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}

	/* Rule Icon */
	.rule-icon {
		width: 3rem;
		height: 3rem;
		background: linear-gradient(135deg, rgb(243, 232, 255) 0%, rgb(233, 213, 255) 100%);
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(147, 51, 234);
		flex-shrink: 0;
	}

	.rule-card.disabled .rule-icon {
		background: linear-gradient(135deg, rgb(249, 250, 251) 0%, rgb(243, 244, 246) 100%);
		color: rgb(156, 163, 175);
	}

	.rule-icon svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Rule Info */
	.rule-info {
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

	.header-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.rule-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
		line-height: 1.3;
	}

	/* Toggle Switch */
	.toggle-switch {
		position: relative;
		width: 2.75rem;
		height: 1.5rem;
		background: rgb(209, 213, 219);
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
		flex-shrink: 0;
	}

	.toggle-switch:hover {
		background: rgb(156, 163, 175);
	}

	.toggle-switch.enabled {
		background: rgb(34, 197, 94);
	}

	.toggle-switch.enabled:hover {
		background: rgb(22, 163, 74);
	}

	.toggle-switch.toggling {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.toggle-switch:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.toggle-slider {
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 1.25rem;
		height: 1.25rem;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.toggle-switch.enabled .toggle-slider {
		transform: translateX(1.25rem);
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
	.rule-triggers {
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

	.trigger-count {
		color: rgb(156, 163, 175);
		font-size: 0.8125rem;
	}

	/* Actions */
	.rule-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: rgb(107, 114, 128);
	}

	.action-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
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

	/* Execute Button */
	.execute-wrapper {
		display: flex;
		align-items: flex-start;
		padding-top: 0.25rem;
	}

	.execute-button {
		width: 3rem;
		height: 3rem;
		background: rgb(59, 130, 246);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		position: relative;
		transition: all 0.2s ease;
		padding: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}

	.execute-button:hover {
		background: rgb(37, 99, 235);
		transform: scale(1.05);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.execute-button:active {
		transform: scale(0.95);
	}

	.execute-button:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.execute-button.executing {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.execute-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.card-content {
			padding: 1.25rem;
			gap: 1rem;
		}

		.rule-icon {
			width: 2.5rem;
			height: 2.5rem;
		}

		.rule-icon svg {
			width: 1.25rem;
			height: 1.25rem;
		}

		.rule-name {
			font-size: 1rem;
		}

		.status-badge {
			font-size: 0.75rem;
			padding: 0.2rem 0.625rem;
		}

		.rule-triggers,
		.rule-actions,
		.last-executed {
			font-size: 0.8125rem;
		}

		.execute-button {
			width: 2.75rem;
			height: 2.75rem;
		}

		.execute-button svg {
			width: 1.125rem;
			height: 1.125rem;
		}
	}

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.card-content {
			padding: 1.375rem;
		}
	}

	/* Prevent text selection on rapid clicks */
	.rule-card {
		user-select: none;
		-webkit-user-select: none;
	}

	.rule-name {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
