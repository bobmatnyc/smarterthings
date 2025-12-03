<script lang="ts">
	/**
	 * Scene Card Component
	 *
	 * Design: Clean card for manually-triggered scenes
	 * Pattern: Simplified version of RuleCard (no enable/disable)
	 *
	 * Visual Design:
	 * - Scene icon (blue gradient background)
	 * - Scene name
	 * - Last executed timestamp
	 * - Execute button (play icon)
	 * - Hover elevation effect
	 *
	 * Key Differences from RuleCard:
	 * - NO enable/disable toggle (scenes are always enabled)
	 * - NO status badge (scenes don't have enabled/disabled state)
	 * - NO triggers/actions display (scenes are manual)
	 * - Cleaner, simpler layout focused on execution
	 *
	 * Interaction:
	 * - Click execute button to run scene
	 * - Visual feedback during execution (spinner)
	 * - Toast notifications handled by scenesStore
	 *
	 * Accessibility:
	 * - Semantic article element
	 * - Proper heading hierarchy
	 * - ARIA labels for execute button
	 * - Keyboard navigable with clear focus states
	 * - Screen reader friendly
	 *
	 * Performance:
	 * - Lightweight CSS transitions
	 * - No JavaScript for hover effects
	 * - Optimistic UI updates
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

	// Format last executed time (identical to RuleCard implementation)
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

<article class="scene-card">
	<div class="card-content">
		<!-- Scene Icon -->
		<div class="scene-icon" aria-hidden="true">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<!-- Theater masks / scene icon -->
				<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
				<circle cx="12" cy="12" r="3"></circle>
			</svg>
		</div>

		<!-- Scene Info -->
		<div class="scene-info">
			<h3 class="scene-name">{scene.name}</h3>

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
				aria-label={`Execute ${scene.name}`}
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
	/* Card Container - Based on RuleCard pattern */
	.scene-card {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid rgb(229, 231, 235);
		overflow: hidden;
	}

	.scene-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border-color: rgb(59, 130, 246);
	}

	.card-content {
		padding: 1.5rem;
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}

	/* Scene Icon - Blue gradient (distinguishes from purple Rules) */
	.scene-icon {
		width: 3rem;
		height: 3rem;
		background: linear-gradient(135deg, rgb(219, 234, 254) 0%, rgb(191, 219, 254) 100%);
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(59, 130, 246);
		flex-shrink: 0;
	}

	.scene-icon svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Scene Info */
	.scene-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.scene-name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
		line-height: 1.3;
	}

	/* Last Executed - Identical to RuleCard */
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

	/* Execute Button - Identical to RuleCard */
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

	/* Mobile responsiveness - Matching RuleCard */
	@media (max-width: 768px) {
		.card-content {
			padding: 1.25rem;
			gap: 1rem;
		}

		.scene-icon {
			width: 2.5rem;
			height: 2.5rem;
		}

		.scene-icon svg {
			width: 1.25rem;
			height: 1.25rem;
		}

		.scene-name {
			font-size: 1rem;
		}

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

	/* Tablet view - Matching RuleCard */
	@media (min-width: 769px) and (max-width: 1024px) {
		.card-content {
			padding: 1.375rem;
		}
	}

	/* Prevent text selection on rapid clicks */
	.scene-card {
		user-select: none;
		-webkit-user-select: none;
	}

	.scene-name {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
