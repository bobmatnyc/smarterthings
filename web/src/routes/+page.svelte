<script lang="ts">
	/**
	 * Main Dashboard - Rooms View with OAuth Detection
	 *
	 * Design Decision: Rooms-first architecture with authentication gate
	 * Rationale: Modern smart home apps (Apple Home, Google Home) use
	 * room-based navigation as the primary way users interact with devices.
	 * Users think in terms of physical spaces, not device lists.
	 *
	 * Features:
	 * - OAuth authentication detection on page load
	 * - Automatic redirect to OAuth flow if not authenticated
	 * - Responsive grid of room cards (when authenticated)
	 * - Device count per room
	 * - Loading states and error handling
	 * - OAuth success message handling
	 *
	 * Authentication Flow:
	 * 1. Check /health endpoint for SmartThings connection status
	 * 2. If not connected, show OAuthConnect component
	 * 3. If connected, show normal dashboard (RoomsGrid)
	 * 4. Handle OAuth success callback with success banner
	 *
	 * Navigation:
	 * - Rooms (default) → This page
	 * - Devices → /devices
	 * - Automations → /automations
	 */

	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import RoomsGrid from '$lib/components/rooms/RoomsGrid.svelte';
	import OAuthConnect from '$lib/components/auth/OAuthConnect.svelte';
	import LoadingSpinner from '$lib/components/loading/LoadingSpinner.svelte';

	// Backend URL from environment or default
	const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5182';

	// Authentication state
	interface AuthState {
		checking: boolean;
		connected: boolean;
		error: string | null;
	}

	let authState = $state<AuthState>({
		checking: true,
		connected: false,
		error: null
	});

	// OAuth success message handling
	let showOAuthSuccess = $state(false);

	/**
	 * Check Authentication Status
	 *
	 * Fetches /health endpoint to determine if SmartThings is connected.
	 * Updates authState based on response.
	 */
	async function checkAuth() {
		try {
			authState.checking = true;
			authState.error = null;

			const response = await fetch(`${BACKEND_URL}/health`);

			if (!response.ok) {
				throw new Error(`Backend returned ${response.status}`);
			}

			const data = await response.json();

			// Check if SmartThings is initialized
			authState.connected = data.smartthings?.initialized ?? false;
		} catch (error) {
			console.error('Auth check failed:', error);
			authState.error = 'Unable to connect to backend server. Please ensure the server is running.';
			authState.connected = false;
		} finally {
			authState.checking = false;
		}
	}

	onMount(() => {
		// Check authentication status on mount
		checkAuth();

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

			// Recheck auth after OAuth success
			checkAuth();
		}
	});

	function dismissOAuthMessage() {
		showOAuthSuccess = false;
	}

	function handleRetry() {
		checkAuth();
	}
</script>

<svelte:head>
	<title>Rooms - Smarter Things</title>
	<meta name="description" content="View and manage your smart home rooms" />
</svelte:head>

<!-- OAuth Success Message (shown after successful authentication) -->
{#if showOAuthSuccess && authState.connected}
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

<!-- Conditional Rendering Based on Auth State -->
{#if authState.checking}
	<!-- Loading State: Checking authentication -->
	<div class="auth-loading-container">
		<LoadingSpinner size="48px" label="Checking authentication" />
		<p class="auth-loading-text">Connecting to Smarter Things...</p>
	</div>
{:else if authState.error}
	<!-- Error State: Backend unreachable -->
	<div class="auth-error-container">
		<div class="auth-error-card">
			<div class="error-icon-container">
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
			<h2 class="auth-error-title">Connection Failed</h2>
			<p class="auth-error-message">{authState.error}</p>
			<button class="retry-button" onclick={handleRetry} type="button">
				<svg class="retry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="23 4 23 10 17 10"></polyline>
					<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
				</svg>
				Try Again
			</button>
		</div>
	</div>
{:else if !authState.connected}
	<!-- Not Authenticated: Show OAuth connection UI -->
	<OAuthConnect />
{:else}
	<!-- Authenticated: Show normal app content -->
	<RoomsGrid />
{/if}

<style>
	/**
	 * Auth Loading Container
	 *
	 * Centered loading state while checking authentication.
	 */
	.auth-loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 4rem);
		gap: 1rem;
		padding: 2rem;
	}

	.auth-loading-text {
		font-size: 1rem;
		color: rgb(107, 114, 128);
		margin: 0;
	}

	/**
	 * Auth Error Container
	 *
	 * Centered error card when backend is unreachable.
	 */
	.auth-error-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 4rem);
		padding: 2rem 1rem;
	}

	.auth-error-card {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
		padding: 3rem 2rem;
		max-width: 500px;
		width: 100%;
		text-align: center;
	}

	.error-icon-container {
		display: flex;
		justify-content: center;
		margin-bottom: 1.5rem;
		color: rgb(239, 68, 68);
	}

	.error-icon {
		width: 64px;
		height: 64px;
	}

	.auth-error-title {
		font-size: 1.875rem;
		font-weight: 700;
		color: rgb(220, 38, 38);
		margin: 0 0 1rem;
	}

	.auth-error-message {
		font-size: 1rem;
		color: rgb(107, 114, 128);
		margin: 0 0 2rem;
		line-height: 1.6;
	}

	.retry-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.75rem;
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.retry-button:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
	}

	.retry-button:focus {
		outline: 3px solid rgba(59, 130, 246, 0.4);
		outline-offset: 2px;
	}

	.retry-icon {
		width: 1.25rem;
		height: 1.25rem;
	}

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
