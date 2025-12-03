<script lang="ts">
	/**
	 * ErrorState Component
	 *
	 * Standalone error display with optional retry functionality.
	 * Used by AsyncContent's default error state and can be used independently.
	 *
	 * Design Decisions:
	 * - Red accent color for error severity indication
	 * - Large icon for visual prominence
	 * - Optional retry button for recoverable errors
	 * - Async retry support with loading state
	 *
	 * Accessibility:
	 * - role="alert" for immediate screen reader announcement
	 * - aria-live="assertive" ensures error interrupts other announcements
	 * - Focus management: Auto-focus retry button on error
	 * - Clear, actionable error messages
	 *
	 * Performance:
	 * - Minimal DOM nodes
	 * - CSS-only animations
	 * - No unnecessary re-renders
	 */

	import { onMount } from 'svelte';

	let {
		message,
		onRetry,
		retryLabel = 'Try Again'
	}: {
		message: string;
		onRetry?: () => void | Promise<void>;
		retryLabel?: string;
	} = $props();

	let retrying = $state(false);
	let retryButtonRef = $state<HTMLButtonElement | undefined>(undefined);

	/**
	 * Handle retry with async support
	 *
	 * Shows loading state during async retry operations.
	 * Prevents double-clicks during retry execution.
	 */
	async function handleRetry() {
		if (!onRetry || retrying) return;

		retrying = true;
		try {
			await onRetry();
		} finally {
			retrying = false;
		}
	}

	/**
	 * Auto-focus retry button on mount
	 *
	 * Accessibility: Immediately focus actionable element
	 * so keyboard users can quickly retry without tabbing.
	 */
	onMount(() => {
		if (retryButtonRef && onRetry) {
			retryButtonRef.focus();
		}
	});
</script>

<div class="error-state" role="alert" aria-live="assertive">
	<!-- Error Icon: Exclamation Circle -->
	<div class="error-icon">
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
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
	</div>

	<!-- Error Message -->
	<h2 class="error-title">Something Went Wrong</h2>
	<p class="error-message">{message}</p>

	<!-- Retry Button (Optional) -->
	{#if onRetry}
		<button
			bind:this={retryButtonRef}
			class="retry-button"
			onclick={handleRetry}
			disabled={retrying}
			aria-label={retrying ? 'Retrying...' : retryLabel}
		>
			{#if retrying}
				<!-- Loading Spinner -->
				<svg
					class="spinner"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<span>Retrying...</span>
			{:else}
				<span>{retryLabel}</span>
			{/if}
		</button>
	{/if}
</div>

<style>
	/**
	 * Error State Container
	 *
	 * Centered layout with vertical stacking.
	 * Generous padding for visual breathing room.
	 */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 400px;
	}

	/**
	 * Error Icon Container
	 *
	 * Red gradient background with error icon.
	 * Circle shape with smooth gradient for visual hierarchy.
	 */
	.error-icon {
		width: 5rem;
		height: 5rem;
		background: linear-gradient(135deg, rgb(254, 242, 242) 0%, rgb(254, 226, 226) 100%);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(239, 68, 68);
		margin-bottom: 1.5rem;
	}

	.error-icon svg {
		width: 2.5rem;
		height: 2.5rem;
	}

	/**
	 * Error Title
	 *
	 * Large, bold heading for error state.
	 * Dark text for strong contrast and readability.
	 */
	.error-title {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	/**
	 * Error Message
	 *
	 * Detailed error information with max-width for readability.
	 * Gray text to differentiate from title while maintaining legibility.
	 */
	.error-message {
		margin: 0 0 1.5rem;
		max-width: 28rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
	}

	/**
	 * Retry Button
	 *
	 * Primary action button with blue accent.
	 * Hover/active states for interaction feedback.
	 * Disabled state during retry execution.
	 */
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
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 7rem;
		justify-content: center;
	}

	.retry-button:hover:not(:disabled) {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.retry-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.retry-button:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	.retry-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/**
	 * Loading Spinner
	 *
	 * Animated spinner shown during retry execution.
	 * CSS-only animation for performance.
	 */
	.spinner {
		width: 1rem;
		height: 1rem;
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

	/**
	 * Mobile Responsiveness
	 *
	 * Reduced padding and font sizes on small screens.
	 * Maintains usability while maximizing content space.
	 */
	@media (max-width: 768px) {
		.error-state {
			padding: 3rem 1.5rem;
			min-height: 300px;
		}

		.error-icon {
			width: 4rem;
			height: 4rem;
		}

		.error-icon svg {
			width: 2rem;
			height: 2rem;
		}

		.error-title {
			font-size: 1.25rem;
		}

		.error-message {
			font-size: 0.9375rem;
		}
	}
</style>
