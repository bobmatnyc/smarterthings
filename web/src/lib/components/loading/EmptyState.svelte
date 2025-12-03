<script lang="ts">
	/**
	 * EmptyState Component
	 *
	 * Standalone empty state display with optional action button.
	 * Used by AsyncContent's default empty state and can be used independently.
	 *
	 * Design Decisions:
	 * - Muted purple accent color for neutral tone
	 * - Large icon for visual prominence
	 * - Optional action button for primary user task
	 * - Customizable title, message, icon
	 *
	 * Accessibility:
	 * - role="status" for screen reader announcements
	 * - aria-live="polite" ensures non-interrupting announcements
	 * - Clear, informative messaging
	 * - Keyboard accessible action button
	 *
	 * Performance:
	 * - Minimal DOM nodes
	 * - CSS-only styling (no JavaScript animations)
	 * - No unnecessary re-renders
	 */

	import type { Snippet } from 'svelte';

	let {
		title,
		message,
		icon,
		action
	}: {
		title: string;
		message?: string;
		icon?: Snippet;
		action?: Snippet;
	} = $props();
</script>

<div class="empty-state" role="status" aria-live="polite">
	<!-- Icon Container -->
	<div class="empty-icon">
		{#if icon}
			{@render icon()}
		{:else}
			<!-- Default Icon: Inbox/Folder -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M3 3h18v18H3z"></path>
				<path d="M3 9h18"></path>
				<path d="M9 21V9"></path>
			</svg>
		{/if}
	</div>

	<!-- Title -->
	<h2 class="empty-title">{title}</h2>

	<!-- Optional Message -->
	{#if message}
		<p class="empty-message">{message}</p>
	{/if}

	<!-- Optional Action Button -->
	{#if action}
		<div class="empty-action">
			{@render action()}
		</div>
	{/if}
</div>

<style>
	/**
	 * Empty State Container
	 *
	 * Centered layout with vertical stacking.
	 * Generous padding for visual breathing room.
	 */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 400px;
	}

	/**
	 * Empty Icon Container
	 *
	 * Purple gradient background with icon.
	 * Circle shape with smooth gradient for visual hierarchy.
	 */
	.empty-icon {
		width: 5rem;
		height: 5rem;
		background: linear-gradient(135deg, rgb(250, 245, 255) 0%, rgb(243, 232, 255) 100%);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(147, 51, 234);
		margin-bottom: 1.5rem;
	}

	.empty-icon :global(svg) {
		width: 2.5rem;
		height: 2.5rem;
	}

	/**
	 * Empty Title
	 *
	 * Large, bold heading for empty state.
	 * Dark text for strong contrast and readability.
	 */
	.empty-title {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	/**
	 * Empty Message
	 *
	 * Detailed information with max-width for readability.
	 * Gray text to differentiate from title while maintaining legibility.
	 */
	.empty-message {
		margin: 0 0 1.5rem;
		max-width: 28rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
	}

	/**
	 * Action Button Container
	 *
	 * Wrapper for custom action button slot.
	 * No spacing if no action provided.
	 */
	.empty-action {
		margin-top: 0.5rem;
	}

	/**
	 * Mobile Responsiveness
	 *
	 * Reduced padding and font sizes on small screens.
	 * Maintains usability while maximizing content space.
	 */
	@media (max-width: 768px) {
		.empty-state {
			padding: 3rem 1.5rem;
			min-height: 300px;
		}

		.empty-icon {
			width: 4rem;
			height: 4rem;
		}

		.empty-icon :global(svg) {
			width: 2rem;
			height: 2rem;
		}

		.empty-title {
			font-size: 1.25rem;
		}

		.empty-message {
			font-size: 0.9375rem;
		}
	}
</style>
