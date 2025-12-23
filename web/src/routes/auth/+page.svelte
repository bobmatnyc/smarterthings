<script lang="ts">
	/**
	 * Dedicated OAuth Authentication Page
	 *
	 * Design Decision: Dedicated auth page instead of inline component
	 * Rationale: Modern web apps (Google, GitHub, etc.) use dedicated auth
	 * pages that are completely separate from the main application flow.
	 * This provides:
	 * - Clear mental model (you're on the "login page")
	 * - Better UX (no confusion about app state)
	 * - Simpler architecture (no conditional rendering in every page)
	 * - Global auth guard at layout level
	 *
	 * This page is shown when:
	 * - User is not authenticated (detected by root layout)
	 * - User manually navigates to /auth
	 * - OAuth callback redirects here on error
	 * - API returns 401 (session expired)
	 *
	 * After successful authentication, user is redirected to homepage (/).
	 */

	import { page } from '$app/stores';
	import OAuthConnect from '$lib/components/auth/OAuthConnect.svelte';

	// Check for session expired reason
	let { data } = $props();
	let reason = $derived($page.url.searchParams.get('reason'));
	let isSessionExpired = $derived(reason === 'session_expired');
</script>

<svelte:head>
	<title>Connect SmartThings - Smarter Things</title>
	<meta name="description" content="Connect your SmartThings account to Smarter Things" />
</svelte:head>

{#if isSessionExpired}
	<!-- Session Expired Message -->
	<div class="session-expired-banner">
		<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		<div class="alert-content">
			<h2 class="alert-title">Your session has expired</h2>
			<p class="alert-description">Please reconnect to SmartThings to continue.</p>
		</div>
	</div>
{/if}

<OAuthConnect />

<style>
	/**
	 * Session Expired Banner
	 *
	 * Design: Prominent alert at top of page
	 * Rationale: User should immediately understand why they're on auth page
	 */
	.session-expired-banner {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem 2rem;
		background: linear-gradient(135deg, rgb(254, 242, 242) 0%, rgb(254, 226, 226) 100%);
		border-bottom: 2px solid rgb(239, 68, 68);
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);
	}

	.alert-icon {
		width: 2.5rem;
		height: 2.5rem;
		color: rgb(239, 68, 68);
		flex-shrink: 0;
	}

	.alert-content {
		flex: 1;
	}

	.alert-title {
		margin: 0 0 0.25rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(127, 29, 29);
	}

	.alert-description {
		margin: 0;
		font-size: 0.9375rem;
		color: rgb(153, 27, 27);
	}

	/**
	 * Mobile Responsiveness
	 */
	@media (max-width: 640px) {
		.session-expired-banner {
			padding: 1rem 1.5rem;
		}

		.alert-icon {
			width: 2rem;
			height: 2rem;
		}

		.alert-title {
			font-size: 1rem;
		}

		.alert-description {
			font-size: 0.875rem;
		}
	}
</style>
