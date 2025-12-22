<script lang="ts">
	/**
	 * Automations Grid Component
	 *
	 * Design: Responsive grid layout for automation cards
	 * Inspired by Apple Home, Google Home, SmartThings app
	 *
	 * Responsive Breakpoints:
	 * - Mobile (<768px): 1 column
	 * - Tablet (768-1024px): 2 columns
	 * - Desktop (1024-1440px): 2 columns
	 * - Large Desktop (>1440px): 3 columns
	 *
	 * Loading States:
	 * - Skeleton cards during initial load
	 * - Empty state when no automations
	 * - Error state for API failures
	 * - Mock data notice (until backend API is ready)
	 *
	 * Performance:
	 * - CSS Grid for efficient layout
	 * - No unnecessary re-renders
	 * - Minimal DOM manipulation
	 */

	import { onMount } from 'svelte';
	import { getScenesStore } from '$lib/stores/scenesStore.svelte';
	import AutomationCard from './AutomationCard.svelte';

	const scenesStore = getScenesStore();

	onMount(async () => {
		await scenesStore.loadScenes();
	});
</script>

<div class="automations-container">
	{#if scenesStore.loading}
		<!-- Loading State: Skeleton Cards -->
		<div class="automations-grid">
			{#each Array(6) as _, i}
				<div class="skeleton-card" aria-busy="true" aria-label="Loading automation">
					<div class="skeleton-header">
						<div class="skeleton-icon"></div>
						<div class="skeleton-content">
							<div class="skeleton-text skeleton-title"></div>
							<div class="skeleton-text skeleton-subtitle"></div>
						</div>
						<div class="skeleton-toggle"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if scenesStore.error}
		<!-- Error State -->
		<div class="empty-state" role="alert">
			<div class="empty-icon error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
			</div>
			<h2 class="empty-title">Failed to Load Scenes</h2>
			<p class="empty-description">{scenesStore.error}</p>
			<button class="retry-button" onclick={() => scenesStore.loadScenes()}>
				Try Again
			</button>
		</div>
	{:else if scenesStore.scenes.length === 0}
		<!-- Empty State -->
		<div class="empty-state">
			<div class="empty-icon">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
				</svg>
			</div>
			<h2 class="empty-title">No Scenes Found</h2>
			<p class="empty-description">
				Scenes let you control multiple devices at once with a single tap.
				Create scenes in the SmartThings app.
			</p>
			<button class="create-button">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				<span>Create Automation</span>
			</button>
		</div>
	{:else}
		<!-- Header with Stats and Create Button -->
		<div class="automations-header">
			<div class="header-content">
				<h2 class="section-title">Scenes</h2>
				<div class="automations-stats">
					<span class="stat-item">{scenesStore.stats.total} total</span>
					<span class="stat-divider">•</span>
					<span class="stat-item enabled">{scenesStore.stats.enabled} enabled</span>
					<span class="stat-divider">•</span>
					<span class="stat-item disabled">{scenesStore.stats.disabled} disabled</span>
				</div>
			</div>
			<button class="create-button">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				<span>Create Automation</span>
			</button>
		</div>

		<!-- Automations Grid -->
		<div class="automations-grid">
			{#each scenesStore.scenes as scene (scene.id)}
				<AutomationCard scene={scene} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.automations-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
		padding-bottom: 3rem;
	}

	.automations-header {
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-content {
		flex: 1;
	}

	.section-title {
		margin: 0 0 0.5rem;
		font-size: 1.875rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
	}

	.automations-stats {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: rgb(107, 114, 128);
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.stat-item {
		white-space: nowrap;
	}

	.stat-item.enabled {
		color: rgb(34, 197, 94);
	}

	.stat-item.disabled {
		color: rgb(156, 163, 175);
	}

	.stat-divider {
		color: rgb(209, 213, 219);
	}

	/* Mock Data Notice */
	.mock-notice {
		background: linear-gradient(135deg, rgb(254, 249, 195) 0%, rgb(253, 246, 178) 100%);
		border: 1px solid rgb(250, 204, 21);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: rgb(113, 63, 18);
		font-size: 0.9375rem;
	}

	.info-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		color: rgb(202, 138, 4);
	}

	.mock-notice strong {
		font-weight: 600;
	}

	/* Create Button */
	.create-button {
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.create-button:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.create-button:active {
		transform: translateY(0);
	}

	.create-button:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.create-button svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.automations-grid {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	}

	/* Responsive grid columns */
	@media (min-width: 768px) and (max-width: 1439px) {
		.automations-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1440px) {
		.automations-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Skeleton Loading Cards */
	.skeleton-card {
		background: white;
		border-radius: 1rem;
		padding: 1.5rem;
		border: 1px solid rgb(229, 231, 235);
		min-height: 140px;
	}

	.skeleton-header {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}

	.skeleton-icon {
		width: 3rem;
		height: 3rem;
		background: linear-gradient(
			90deg,
			rgb(243, 244, 246) 25%,
			rgb(229, 231, 235) 50%,
			rgb(243, 244, 246) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.75rem;
		flex-shrink: 0;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.skeleton-text {
		background: linear-gradient(
			90deg,
			rgb(243, 244, 246) 25%,
			rgb(229, 231, 235) 50%,
			rgb(243, 244, 246) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.5rem;
		height: 1rem;
	}

	.skeleton-title {
		width: 60%;
		height: 1.25rem;
	}

	.skeleton-subtitle {
		width: 80%;
	}

	.skeleton-toggle {
		width: 3rem;
		height: 1.75rem;
		background: linear-gradient(
			90deg,
			rgb(243, 244, 246) 25%,
			rgb(229, 231, 235) 50%,
			rgb(243, 244, 246) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 400px;
	}

	.empty-icon {
		width: 5rem;
		height: 5rem;
		background: linear-gradient(135deg, rgb(239, 246, 255) 0%, rgb(219, 234, 254) 100%);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(59, 130, 246);
		margin-bottom: 1.5rem;
	}

	.empty-icon.error {
		background: linear-gradient(135deg, rgb(254, 242, 242) 0%, rgb(254, 226, 226) 100%);
		color: rgb(239, 68, 68);
	}

	.empty-icon svg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.empty-title {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.empty-description {
		margin: 0 0 1.5rem;
		max-width: 28rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
	}

	.retry-button {
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.retry-button:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.retry-button:active {
		transform: translateY(0);
	}

	.retry-button:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.automations-container {
			padding: 1.5rem 1rem;
			padding-bottom: 2rem;
		}

		.automations-header {
			flex-direction: column;
			align-items: stretch;
		}

		.section-title {
			font-size: 1.5rem;
		}

		.automations-stats {
			font-size: 0.875rem;
		}

		.create-button {
			width: 100%;
			justify-content: center;
		}

		.mock-notice {
			padding: 0.875rem 1rem;
			font-size: 0.875rem;
		}

		.automations-grid {
			gap: 1rem;
			grid-template-columns: 1fr;
		}

		.skeleton-card {
			padding: 1.25rem;
			min-height: 120px;
		}

		.skeleton-icon {
			width: 2.5rem;
			height: 2.5rem;
		}

		.empty-state {
			padding: 3rem 1.5rem;
			min-height: 300px;
		}

		.empty-icon {
			width: 4rem;
			height: 4rem;
		}

		.empty-icon svg {
			width: 2rem;
			height: 2rem;
		}

		.empty-title {
			font-size: 1.25rem;
		}

		.empty-description {
			font-size: 0.9375rem;
		}
	}

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.automations-container {
			padding: 1.75rem 1.5rem;
			padding-bottom: 2.5rem;
		}

		.section-title {
			font-size: 1.75rem;
		}
	}
</style>
