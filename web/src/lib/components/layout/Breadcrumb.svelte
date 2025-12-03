<script lang="ts">
	/**
	 * Breadcrumb Navigation Component
	 *
	 * Reusable breadcrumb navigation with room icons and responsive design.
	 *
	 * Features:
	 * - Dynamic room icons based on pattern matching
	 * - Chevron separators (not "/")
	 * - RoomCard-inspired styling (shadows, gradients, hover effects)
	 * - Grid icon for "Show All Devices" button
	 * - ARIA breadcrumb navigation attributes
	 * - Responsive design (stacks on mobile)
	 *
	 * Design System Alignment:
	 * - Matches RoomCard visual language
	 * - Inline SVG icons (zero dependencies)
	 * - Smooth transitions with cubic-bezier
	 * - Proper focus indicators for accessibility
	 *
	 * Accessibility:
	 * - role="navigation" with aria-label="Breadcrumb"
	 * - Keyboard navigable with clear focus states
	 * - Screen reader friendly
	 * - aria-hidden on decorative icons
	 */

	import type { Room } from '$lib/stores/roomStore.svelte';
	import { ROOM_ICONS, type RoomIconName } from '$lib/utils/roomIcons';

	interface Props {
		selectedRoom: Room | null;
		loading?: boolean;
		onShowAll: () => void;
	}

	let { selectedRoom, loading = false, onShowAll }: Props = $props();

	// Derive room icon from room name (handled in parent)
	let roomIcon = $derived<RoomIconName>((selectedRoom as any)?.icon ?? 'home');
	let roomName = $derived(selectedRoom?.name ?? null);

	// Show loading placeholder when loading or room name is missing
	let displayName = $derived(loading || !roomName ? null : roomName);
</script>

<div class="breadcrumb-container">
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<!-- Rooms Link -->
		<a href="/rooms" class="breadcrumb-link">
			<span class="breadcrumb-icon" aria-hidden="true">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					{@html ROOM_ICONS.home}
				</svg>
			</span>
			<span>Rooms</span>
		</a>

		<!-- Chevron Separator -->
		<span class="breadcrumb-separator" aria-hidden="true">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		</span>

		<!-- Current Room -->
		<span class="breadcrumb-current">
			{#if displayName}
				<span class="breadcrumb-icon" aria-hidden="true">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						{@html ROOM_ICONS[roomIcon]}
					</svg>
				</span>
				<span>{displayName}</span>
			{:else}
				<!-- Loading Skeleton -->
				<span class="skeleton-icon" aria-hidden="true"></span>
				<span class="skeleton-text" aria-busy="true" aria-label="Loading room name"></span>
			{/if}
		</span>
	</nav>

	<!-- Show All Devices Button -->
	<button onclick={onShowAll} class="clear-filter-btn" aria-label="View all devices">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="w-4 h-4"
			aria-hidden="true"
		>
			<!-- Grid icon (4 squares) -->
			<rect x="3" y="3" width="7" height="7"></rect>
			<rect x="14" y="3" width="7" height="7"></rect>
			<rect x="3" y="14" width="7" height="7"></rect>
			<rect x="14" y="14" width="7" height="7"></rect>
		</svg>
		<span>Show All Devices</span>
	</button>
</div>

<style>
	.breadcrumb-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.breadcrumb {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
		border: 1px solid rgb(229, 231, 235);
		transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.breadcrumb-link,
	.breadcrumb-current {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.breadcrumb-link {
		padding: 0.375rem 0.625rem;
		border-radius: 0.5rem;
		color: rgb(59, 130, 246);
		text-decoration: none;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.breadcrumb-link:hover {
		background: rgb(239, 246, 255);
	}

	.breadcrumb-link:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.breadcrumb-current {
		color: rgb(55, 65, 81);
	}

	.breadcrumb-icon {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.breadcrumb-separator {
		width: 1rem;
		height: 1rem;
		color: rgb(209, 213, 219);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.clear-filter-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: transparent;
		border: 1px solid rgb(229, 231, 235);
		border-radius: 0.5rem;
		color: rgb(55, 65, 81);
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.clear-filter-btn:hover {
		background: rgb(249, 250, 251);
		border-color: rgb(209, 213, 219);
	}

	.clear-filter-btn:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	/* Dark mode support */
	:global(.dark) .breadcrumb {
		background: rgb(31, 41, 55);
		border-color: rgb(55, 65, 81);
	}

	:global(.dark) .breadcrumb-link {
		color: rgb(96, 165, 250);
	}

	:global(.dark) .breadcrumb-link:hover {
		background: rgb(30, 58, 138);
	}

	:global(.dark) .breadcrumb-current {
		color: rgb(229, 231, 235);
	}

	:global(.dark) .breadcrumb-separator {
		color: rgb(75, 85, 99);
	}

	:global(.dark) .clear-filter-btn {
		background: transparent;
		border-color: rgb(55, 65, 81);
		color: rgb(229, 231, 235);
	}

	:global(.dark) .clear-filter-btn:hover {
		background: rgb(31, 41, 55);
		border-color: rgb(75, 85, 99);
	}

	/* Loading Skeleton */
	.skeleton-icon {
		width: 1.25rem;
		height: 1.25rem;
		background: linear-gradient(90deg, rgb(243, 244, 246) 25%, rgb(229, 231, 235) 50%, rgb(243, 244, 246) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.375rem;
		flex-shrink: 0;
	}

	.skeleton-text {
		width: 8rem;
		height: 1rem;
		background: linear-gradient(90deg, rgb(243, 244, 246) 25%, rgb(229, 231, 235) 50%, rgb(243, 244, 246) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.375rem;
		display: inline-block;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.breadcrumb-container {
			flex-direction: column;
			align-items: flex-start;
		}

		.breadcrumb {
			padding: 0.625rem 1rem;
			font-size: 0.8125rem;
		}

		.breadcrumb-link,
		.breadcrumb-current {
			font-size: 0.8125rem;
		}

		.clear-filter-btn {
			width: 100%;
			justify-content: center;
		}

		.skeleton-text {
			width: 6rem;
		}
	}
</style>
