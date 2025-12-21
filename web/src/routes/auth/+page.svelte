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
	 *
	 * After successful authentication, user is redirected to homepage (/).
	 */

	import OAuthConnect from '$lib/components/auth/OAuthConnect.svelte';
</script>

<svelte:head>
	<title>Connect SmartThings - Smarter Things</title>
	<meta name="description" content="Connect your SmartThings account to Smarter Things" />
</svelte:head>

<OAuthConnect />
