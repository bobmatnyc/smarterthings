<script lang="ts">
	/**
	 * Rooms Grid Component
	 *
	 * Design: Responsive grid layout for room cards
	 * Inspired by Apple Home, Google Home, SmartThings app
	 *
	 * Responsive Breakpoints:
	 * - Mobile (<768px): 1 column
	 * - Tablet (768-1024px): 2 columns
	 * - Desktop (1024-1440px): 3 columns
	 * - Large Desktop (>1440px): 4 columns
	 *
	 * Loading States:
	 * - Skeleton cards during initial load
	 * - Empty state when no rooms
	 * - Error state for API failures
	 *
	 * Performance:
	 * - CSS Grid for efficient layout
	 * - No unnecessary re-renders
	 * - Minimal DOM manipulation
	 */

	import { onMount } from 'svelte';
	import { getRoomStore } from '$lib/stores/roomStore.svelte';
	import RoomCard from './RoomCard.svelte';

	const roomStore = getRoomStore();

	onMount(async () => {
		await roomStore.loadRooms();
	});
</script>

<div class="rooms-container">
	{#if roomStore.loading}
		<!-- Loading State: Skeleton Cards -->
		<div class="rooms-grid">
			{#each Array(6) as _, i}
				<div class="skeleton-card" aria-busy="true" aria-label="Loading room">
					<div class="skeleton-icon"></div>
					<div class="skeleton-text skeleton-title"></div>
					<div class="skeleton-text skeleton-count"></div>
				</div>
			{/each}
		</div>
	{:else if roomStore.error}
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
			<h2 class="empty-title">Failed to Load Rooms</h2>
			<p class="empty-description">{roomStore.error}</p>
			<button class="retry-button" onclick={() => roomStore.loadRooms()}>Try Again</button>
		</div>
	{:else if roomStore.rooms.length === 0}
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
					<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
					<polyline points="9 22 9 12 15 12 15 22"></polyline>
				</svg>
			</div>
			<h2 class="empty-title">No Rooms Found</h2>
			<p class="empty-description">
				No rooms are configured in your SmartThings account. Add rooms in the SmartThings app to
				organize your devices.
			</p>
		</div>
	{:else}
		<!-- Rooms Grid -->
		<div class="rooms-header">
			<h2 class="section-title">Your Rooms</h2>
			<div class="rooms-stats">
				<span class="stat-item">{roomStore.stats.total} rooms</span>
				<span class="stat-divider">•</span>
				<span class="stat-item">{roomStore.stats.totalDevices} devices</span>
			</div>
		</div>

		<div class="rooms-grid">
			{#each roomStore.rooms as room (room.roomId)}
				<RoomCard {room} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.rooms-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
		padding-bottom: 3rem;
	}

	.rooms-header {
		margin-bottom: 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
	}

	.rooms-stats {
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

	.stat-divider {
		color: rgb(209, 213, 219);
	}

	.rooms-grid {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	/* Responsive grid columns */
	@media (min-width: 768px) and (max-width: 1023px) {
		.rooms-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) and (max-width: 1439px) {
		.rooms-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 1440px) {
		.rooms-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	/* Skeleton Loading Cards */
	.skeleton-card {
		background: white;
		border-radius: 1rem;
		padding: 2rem;
		border: 1px solid rgb(229, 231, 235);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-height: 160px;
	}

	.skeleton-icon {
		width: 3.5rem;
		height: 3.5rem;
		background: linear-gradient(90deg, rgb(243, 244, 246) 25%, rgb(229, 231, 235) 50%, rgb(243, 244, 246) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.875rem;
	}

	.skeleton-text {
		background: linear-gradient(90deg, rgb(243, 244, 246) 25%, rgb(229, 231, 235) 50%, rgb(243, 244, 246) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.5rem;
		height: 1.25rem;
	}

	.skeleton-title {
		width: 60%;
		height: 1.5rem;
	}

	.skeleton-count {
		width: 40%;
		margin-top: auto;
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
		.rooms-container {
			padding: 1.5rem 1rem;
			padding-bottom: 2rem;
		}

		.rooms-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.section-title {
			font-size: 1.5rem;
		}

		.rooms-stats {
			font-size: 0.875rem;
		}

		.rooms-grid {
			gap: 1rem;
			grid-template-columns: 1fr;
		}

		.skeleton-card {
			padding: 1.5rem;
			min-height: 140px;
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
		.rooms-container {
			padding: 1.75rem 1.5rem;
			padding-bottom: 2.5rem;
		}

		.section-title {
			font-size: 1.75rem;
		}
	}
</style>
