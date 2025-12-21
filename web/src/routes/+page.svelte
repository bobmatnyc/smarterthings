<script lang="ts">
	/**
	 * Main Dashboard - Rooms View
	 *
	 * Design Decision: Rooms-first architecture (simplified - auth handled by layout)
	 * Rationale: Modern smart home apps (Apple Home, Google Home) use
	 * room-based navigation as the primary way users interact with devices.
	 * Users think in terms of physical spaces, not device lists.
	 *
	 * Features:
	 * - Responsive grid of room cards
	 * - Device count per room
	 * - Loading states and error handling
	 * - OAuth success message handling
	 *
	 * Authentication: HANDLED BY ROOT LAYOUT
	 * - No auth checks in this component
	 * - Layout redirects to /auth if not authenticated
	 * - This page only renders if user is authenticated
	 *
	 * Navigation:
	 * - Rooms (default) → This page
	 * - Devices → /devices
	 * - Automations → /automations
	 */

	import { onMount } from 'svelte';
	import RoomsGrid from '$lib/components/rooms/RoomsGrid.svelte';

	// OAuth success message handling
	let showOAuthSuccess = $state(false);

	onMount(() => {
		// Handle OAuth success callback
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('oauth') === 'success') {
			showOAuthSuccess = true;

			// Clear the URL parameter
			window.history.replaceState({}, '', '/');

			// Auto-hide after 5 seconds
			setTimeout(() => {
				showOAuthSuccess = false;
			}, 5000);
		}
	});

	function dismissOAuthMessage() {
		showOAuthSuccess = false;
	}
</script>

<svelte:head>
	<title>Rooms - Smarter Things</title>
	<meta name="description" content="View and manage your smart home rooms" />
</svelte:head>

<!-- OAuth Success Message (shown after successful authentication) -->
{#if showOAuthSuccess}
	<div class="oauth-success-banner" role="alert">
		<div class="success-content">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="success-icon"
			>
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
				<polyline points="22 4 12 14.01 9 11.01"></polyline>
			</svg>
			<div class="success-text">
				<strong>Successfully connected!</strong>
				<span>Your SmartThings account is now linked.</span>
			</div>
		</div>
		<button class="dismiss-button" onclick={dismissOAuthMessage} aria-label="Dismiss message">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	</div>
{/if}

<!-- Authenticated: Show rooms grid (auth guaranteed by layout) -->
<RoomsGrid />

<style>
	/* OAuth Success Banner */
	.oauth-success-banner {
		position: fixed;
		top: 5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		background: linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%);
		color: white;
		padding: 1rem 1.5rem;
		border-radius: 0.75rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 320px;
		max-width: 500px;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			transform: translate(-50%, -100%);
			opacity: 0;
		}
		to {
			transform: translate(-50%, 0);
			opacity: 1;
		}
	}

	.success-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.success-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
	}

	.success-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9375rem;
	}

	.success-text strong {
		font-weight: 600;
	}

	.success-text span {
		font-size: 0.875rem;
		opacity: 0.95;
	}

	.dismiss-button {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		color: white;
		width: 2rem;
		height: 2rem;
		border-radius: 0.375rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s ease;
		flex-shrink: 0;
	}

	.dismiss-button:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.dismiss-button:focus {
		outline: 2px solid white;
		outline-offset: 2px;
	}

	.dismiss-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.oauth-success-banner {
			top: 4rem;
			left: 1rem;
			right: 1rem;
			transform: none;
			min-width: auto;
			padding: 0.875rem 1rem;
		}

		@keyframes slideDown {
			from {
				transform: translateY(-100%);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}

		.success-text {
			font-size: 0.875rem;
		}

		.success-text span {
			font-size: 0.8125rem;
		}
	}
</style>
