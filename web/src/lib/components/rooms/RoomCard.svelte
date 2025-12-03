<script lang="ts">
	/**
	 * Room Card Component
	 *
	 * Design: Clean card showing room name and device count
	 * Inspired by Apple Home app and Google Home room tiles
	 *
	 * Visual Design:
	 * - Rounded corners with subtle shadow
	 * - Hover elevation effect
	 * - Device count badge
	 * - Optional room icon/thumbnail placeholder
	 *
	 * Accessibility:
	 * - Semantic article element
	 * - Proper heading hierarchy
	 * - ARIA labels for device count
	 * - Keyboard navigable with clear focus
	 * - Click target at least 44x44px
	 *
	 * Performance:
	 * - Lightweight CSS transitions
	 * - No JavaScript for hover effects
	 * - Image lazy loading (when icons added)
	 *
	 * Navigation:
	 * - Clicking navigates to devices page with room filter
	 * - URL format: /devices?room={roomId}
	 */

	import type { Room } from '$lib/stores/roomStore.svelte';
	import { getRoomIcon, ROOM_ICONS } from '$lib/utils/roomIcons';

	interface Props {
		room: Room;
	}

	let { room }: Props = $props();

	const deviceCount = $derived(room.deviceCount ?? 0);
	const deviceLabel = $derived(deviceCount === 1 ? 'device' : 'devices');
	const roomIcon = $derived(getRoomIcon(room.name));
</script>

<article class="room-card">
	<a href={`/devices?room=${room.roomId}`} class="card-link">
		<div class="card-content">
			<!-- Dynamic Room Icon -->
			<div class="room-icon" aria-hidden="true">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					{@html ROOM_ICONS[roomIcon]}
				</svg>
			</div>

			<!-- Room Info -->
			<div class="room-info">
				<h2 class="room-name">{room.name}</h2>
				<div class="device-count" aria-label={`${deviceCount} ${deviceLabel}`}>
					<span class="count-badge">{deviceCount}</span>
					<span class="count-label">{deviceLabel}</span>
				</div>
			</div>
		</div>
	</a>
</article>

<style>
	.room-card {
		height: 100%;
	}

	.card-link {
		display: block;
		height: 100%;
		background: white;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		text-decoration: none;
		color: inherit;
		overflow: hidden;
		border: 1px solid rgb(229, 231, 235);
	}

	.card-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border-color: rgb(59, 130, 246);
	}

	.card-link:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.card-link:active {
		transform: translateY(0);
	}

	.card-content {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		height: 100%;
		min-height: 160px;
	}

	.room-icon {
		width: 3.5rem;
		height: 3.5rem;
		background: linear-gradient(135deg, rgb(239, 246, 255) 0%, rgb(219, 234, 254) 100%);
		border-radius: 0.875rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(59, 130, 246);
		flex-shrink: 0;
	}

	.room-icon svg {
		width: 1.75rem;
		height: 1.75rem;
	}

	.room-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.room-name {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
		line-height: 1.3;
	}

	.device-count {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: auto;
	}

	.count-badge {
		background: rgb(59, 130, 246);
		color: white;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
		min-width: 2rem;
		text-align: center;
	}

	.count-label {
		color: rgb(107, 114, 128);
		font-size: 0.875rem;
		font-weight: 500;
	}

	/* Empty state styling */
	.card-link:has(.count-badge:empty) .count-badge::after {
		content: '0';
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.card-content {
			padding: 1.5rem;
			min-height: 140px;
		}

		.room-icon {
			width: 3rem;
			height: 3rem;
		}

		.room-icon svg {
			width: 1.5rem;
			height: 1.5rem;
		}

		.room-name {
			font-size: 1.125rem;
		}

		.count-badge {
			font-size: 0.8125rem;
			padding: 0.2rem 0.625rem;
		}

		.count-label {
			font-size: 0.8125rem;
		}
	}

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.card-content {
			padding: 1.75rem;
		}
	}

	/* Prevent text selection on rapid clicks */
	.card-link {
		user-select: none;
		-webkit-user-select: none;
	}

	.room-name {
		user-select: text;
		-webkit-user-select: text;
	}
</style>
