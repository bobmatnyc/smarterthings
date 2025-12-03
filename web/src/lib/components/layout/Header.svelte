<script lang="ts">
	/**
	 * Main Application Header
	 *
	 * Design: Clean, modern header with app branding
	 * Fixed at top for consistent navigation across views
	 *
	 * Accessibility:
	 * - Semantic header element
	 * - Proper heading hierarchy (h1)
	 * - High contrast for readability
	 */
</script>

<header class="app-header">
	<div class="header-content">
		<h1 class="app-title">Smarter Things</h1>
	</div>
</header>

<style>
	.app-header {
		background: linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(99, 102, 241) 100%);
		color: white;
		padding: 1.25rem 2rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		position: sticky;
		top: 0;
		z-index: 50;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.header-content {
		max-width: 1400px;
		margin: 0 auto;
	}

	.app-title {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		background: linear-gradient(to right, white, rgba(255, 255, 255, 0.9));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.app-header {
			padding: 1rem 1.5rem;
		}

		.app-title {
			font-size: 1.5rem;
		}
	}
</style>
