<script lang="ts">
	import '../app.postcss';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-shell">
	<header class="app-header">
		<!-- Header will go here -->
	</header>

	<div class="app-content">
		<aside class="app-sidebar">
			<!-- Sidebar navigation -->
		</aside>

		<main class="app-main">
			{@render children()}
		</main>
	</div>

	<footer class="app-footer">
		<!-- Footer -->
	</footer>
</div>
