<script lang="ts">
	/**
	 * OAuth Callback Page
	 *
	 * Design: Success confirmation after OAuth flow completes
	 * Automatically redirects to homepage after brief delay
	 *
	 * Flow:
	 * 1. SmartThings OAuth redirects here with auth code
	 * 2. Backend exchanges code for token (already handled by backend)
	 * 3. Show success message
	 * 4. Auto-redirect to homepage after 2 seconds
	 *
	 * Accessibility:
	 * - role="status" for polite screen reader announcement
	 * - Clear success messaging
	 * - Manual "Continue" button for user control
	 *
	 * Error Handling:
	 * - Check for error parameters in URL
	 * - Display error message if OAuth failed
	 * - Provide "Try Again" link
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import LoadingSpinner from '$lib/components/loading/LoadingSpinner.svelte';

	// State management
	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state<string | null>(null);
	let countdown = $state(3);

	onMount(() => {
		// Check for OAuth errors in URL parameters
		const urlParams = new URLSearchParams(window.location.search);
		const error = urlParams.get('error');
		const errorDescription = urlParams.get('error_description');

		if (error) {
			// OAuth failed
			status = 'error';
			errorMessage = errorDescription || 'Authentication failed';
			return;
		}

		// OAuth succeeded
		status = 'success';

		// Countdown timer (3, 2, 1)
		const countdownInterval = setInterval(() => {
			countdown--;
			if (countdown <= 0) {
				clearInterval(countdownInterval);
			}
		}, 1000);

		// Auto-redirect to homepage after 3 seconds
		const redirectTimer = setTimeout(() => {
			goto('/?oauth=success');
		}, 3000);

		// Cleanup on unmount
		return () => {
			clearInterval(countdownInterval);
			clearTimeout(redirectTimer);
		};
	});

	function handleContinue() {
		goto('/?oauth=success');
	}

	function handleTryAgain() {
		goto('/');
	}
</script>

<svelte:head>
	<title>Authentication Complete - Smarter Things</title>
</svelte:head>

<div class="callback-container">
	{#if status === 'loading'}
		<!-- Loading State -->
		<div class="callback-card" role="status" aria-live="polite">
			<LoadingSpinner size="48px" label="Completing authentication" />
			<h1 class="callback-title">Completing Authentication...</h1>
			<p class="callback-description">Please wait while we finalize your connection.</p>
		</div>
	{:else if status === 'success'}
		<!-- Success State -->
		<div class="callback-card" role="status" aria-live="polite">
			<!-- Success Icon -->
			<div class="icon-container success">
				<svg
					class="success-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<path d="M9 12l2 2 4-4"></path>
				</svg>
			</div>

			<!-- Success Message -->
			<h1 class="callback-title">Authentication Successful!</h1>
			<p class="callback-description">
				Your SmartThings account has been connected successfully.
				<br />
				Redirecting to dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
			</p>

			<!-- Manual Continue Button -->
			<button class="continue-button" onclick={handleContinue} type="button">
				Continue to Dashboard
				<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="5" y1="12" x2="19" y2="12"></line>
					<polyline points="12 5 19 12 12 19"></polyline>
				</svg>
			</button>
		</div>
	{:else if status === 'error'}
		<!-- Error State -->
		<div class="callback-card" role="alert" aria-live="assertive">
			<!-- Error Icon -->
			<div class="icon-container error">
				<svg
					class="error-icon"
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

			<!-- Error Message -->
			<h1 class="callback-title error-title">Authentication Failed</h1>
			<p class="callback-description error-description">
				{errorMessage || 'Unable to complete authentication. Please try again.'}
			</p>

			<!-- Try Again Button -->
			<button class="continue-button error-button" onclick={handleTryAgain} type="button">
				Try Again
			</button>
		</div>
	{/if}
</div>

<style>
	/**
	 * Callback Container
	 *
	 * Center the card vertically and horizontally.
	 * Full viewport height for visual focus.
	 */
	.callback-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 2rem 1rem;
		background: linear-gradient(135deg, rgb(240, 249, 255) 0%, rgb(224, 242, 254) 100%);
	}

	/**
	 * Callback Card
	 *
	 * White card with shadow for content isolation.
	 */
	.callback-card {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
		padding: 3rem 2rem;
		max-width: 500px;
		width: 100%;
		text-align: center;
		animation: fadeInScale 0.3s ease-out;
	}

	@keyframes fadeInScale {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/**
	 * Icon Containers
	 *
	 * Success and error icons with appropriate colors.
	 */
	.icon-container {
		display: flex;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.icon-container.success {
		color: rgb(34, 197, 94);
	}

	.icon-container.error {
		color: rgb(239, 68, 68);
	}

	.success-icon,
	.error-icon {
		width: 64px;
		height: 64px;
		animation: iconPop 0.4s ease-out 0.2s backwards;
	}

	@keyframes iconPop {
		0% {
			transform: scale(0);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
	}

	/**
	 * Typography
	 */
	.callback-title {
		font-size: 1.875rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
		margin: 0 0 1rem;
		line-height: 1.2;
	}

	.callback-title.error-title {
		color: rgb(220, 38, 38);
	}

	.callback-description {
		font-size: 1rem;
		color: rgb(75, 85, 99);
		margin: 0 0 2rem;
		line-height: 1.6;
	}

	.callback-description.error-description {
		color: rgb(107, 114, 128);
	}

	/**
	 * Continue Button
	 *
	 * Primary CTA for manual navigation.
	 */
	.continue-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.75rem;
		background: linear-gradient(135deg, rgb(21, 191, 253) 0%, rgb(14, 165, 233) 100%);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(21, 191, 253, 0.2);
	}

	.continue-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(21, 191, 253, 0.3);
	}

	.continue-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(21, 191, 253, 0.2);
	}

	.continue-button:focus {
		outline: 3px solid rgba(21, 191, 253, 0.4);
		outline-offset: 2px;
	}

	.continue-button.error-button {
		background: linear-gradient(135deg, rgb(239, 68, 68) 0%, rgb(220, 38, 38) 100%);
		box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
	}

	.continue-button.error-button:hover {
		box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
	}

	.continue-button.error-button:focus {
		outline: 3px solid rgba(239, 68, 68, 0.4);
	}

	.arrow-icon {
		width: 1.25rem;
		height: 1.25rem;
		transition: transform 0.2s ease;
	}

	.continue-button:hover .arrow-icon {
		transform: translateX(4px);
	}

	/**
	 * Mobile Responsiveness
	 */
	@media (max-width: 640px) {
		.callback-card {
			padding: 2rem 1.5rem;
		}

		.callback-title {
			font-size: 1.5rem;
		}

		.callback-description {
			font-size: 0.9375rem;
		}

		.success-icon,
		.error-icon {
			width: 56px;
			height: 56px;
		}

		.continue-button {
			padding: 0.75rem 1.5rem;
			font-size: 0.9375rem;
		}
	}

	/**
	 * Accessibility: Reduced Motion
	 */
	@media (prefers-reduced-motion: reduce) {
		.callback-card,
		.success-icon,
		.error-icon {
			animation: none;
		}

		.continue-button {
			transition: none;
		}

		.continue-button:hover {
			transform: none;
		}

		.arrow-icon {
			transition: none;
		}

		.continue-button:hover .arrow-icon {
			transform: none;
		}
	}
</style>
