<script lang="ts">
	/**
	 * Root Page - Redirect to Dashboard
	 *
	 * Design Decision: Root path redirects to dashboard
	 * Rationale: Default landing page is the Mondrian dashboard,
	 * which provides a visual overview of all rooms and devices.
	 *
	 * Navigation:
	 * - / → /dashboard (redirect)
	 * - /rooms → Room-specific view
	 * - /devices → Device-specific view
	 */

	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// Redirect to dashboard
		goto('/dashboard', { replaceState: true });
	});
</script>

<svelte:head>
	<title>Smarter Things</title>
	<meta name="description" content="AI-powered SmartThings controller" />
</svelte:head>

<!-- Loading state while redirecting -->
<div class="redirect-container">
	<p>Redirecting to dashboard...</p>
</div>

<style>
	.redirect-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		color: rgb(107, 114, 128);
	}
</style>
