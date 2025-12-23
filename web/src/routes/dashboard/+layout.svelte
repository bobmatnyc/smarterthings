<script lang="ts">
	/**
	 * Dashboard Layout - Kiosk Mode Support
	 *
	 * Design Decision: Conditional layout based on kiosk mode
	 * Rationale: Dashboard can operate in fullscreen kiosk mode without
	 * navigation UI, or in normal mode with full app chrome.
	 *
	 * Features:
	 * - Kiosk mode: Hides Header/SubNav/Footer for fullscreen display
	 * - Normal mode: Shows all navigation elements
	 * - ESC key listener to exit kiosk mode
	 * - Fullscreen container when in kiosk mode
	 *
	 * Architecture:
	 * - Wraps dashboard pages with conditional chrome
	 * - Inherits authentication from root layout
	 * - Manages kiosk mode state via dashboardStore
	 */

	import { onMount } from 'svelte';
	import { getDashboardStore } from '$lib/stores/dashboardStore.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import { FOOTER_LABELS } from '$lib/constants/labels';

	let { children } = $props();
	const dashboardStore = getDashboardStore();

	// Dynamic copyright year
	const currentYear = new Date().getFullYear();
	const copyrightText = FOOTER_LABELS.copyright(currentYear);

	// Cursor auto-hide state
	let cursorVisible = $state(true);
	let cursorTimeout: NodeJS.Timeout | null = null;

	/**
	 * ESC key handler to exit kiosk mode AND fullscreen
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && dashboardStore.kioskMode) {
			event.preventDefault();
			exitKioskMode();
		}
	}

	/**
	 * Exit kiosk mode and fullscreen
	 */
	async function exitKioskMode() {
		// Exit fullscreen if active
		if (document.fullscreenElement) {
			try {
				await document.exitFullscreen();
			} catch (err) {
				console.error('Failed to exit fullscreen:', err);
			}
		}
		// Exit kiosk mode
		dashboardStore.setKioskMode(false);
	}

	/**
	 * Mouse move handler for cursor auto-hide
	 */
	function handleMouseMove() {
		if (!dashboardStore.kioskMode) return;

		// Show cursor
		cursorVisible = true;

		// Clear existing timeout
		if (cursorTimeout) {
			clearTimeout(cursorTimeout);
		}

		// Hide cursor after 3 seconds
		cursorTimeout = setTimeout(() => {
			cursorVisible = false;
		}, 3000);
	}

	/**
	 * Enter fullscreen mode
	 */
	async function enterFullscreen() {
		try {
			await document.documentElement.requestFullscreen();
		} catch (err) {
			console.error('Failed to enter fullscreen:', err);
		}
	}

	/**
	 * Watch for kiosk mode changes and trigger fullscreen
	 */
	$effect(() => {
		if (dashboardStore.kioskMode) {
			enterFullscreen();
		}
	});

	onMount(() => {
		// Setup ESC key listener
		window.addEventListener('keydown', handleKeydown);

		// Setup mouse move listener for cursor auto-hide
		window.addEventListener('mousemove', handleMouseMove);

		// Auto-enter kiosk mode if enabled
		if (dashboardStore.kioskAutostart && !dashboardStore.kioskMode) {
			dashboardStore.setKioskMode(true);
		}

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('mousemove', handleMouseMove);
			if (cursorTimeout) {
				clearTimeout(cursorTimeout);
			}
		};
	});
</script>

<svelte:head>
	<title>Dashboard - Smarter Things</title>
	<meta name="description" content="Mondrian-style smart home dashboard" />
</svelte:head>

{#if dashboardStore.kioskMode}
	<!-- Kiosk Mode: Fullscreen without navigation -->
	<div class="kiosk-container" class:hide-cursor={!cursorVisible}>
		{@render children()}
	</div>
{:else}
	<!-- Normal Mode: Full app chrome -->
	<div class="dashboard-shell">
		<!-- Header -->
		<Header />

		<!-- Sub-Navigation -->
		<SubNav />

		<!-- Main Content -->
		<main class="dashboard-main">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="dashboard-footer">
			<div class="footer-content">
				<p class="copyright">{copyrightText}</p>
				<div class="footer-links">
					<a href="/privacy">{FOOTER_LABELS.privacy}</a>
					<span class="divider">•</span>
					<a href="/terms">{FOOTER_LABELS.terms}</a>
					<span class="divider">•</span>
					<a href="https://github.com/bobmatnyc/mcp-smarterthings" target="_blank" rel="noopener">
						{FOOTER_LABELS.github}
					</a>
				</div>
			</div>
		</footer>
	</div>
{/if}

<style>
	/* Kiosk Mode: Fullscreen container */
	.kiosk-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100vw;
		height: 100vh;
		background: rgb(249, 250, 251);
		overflow: hidden;
		z-index: 9999;
	}

	/* Hide cursor when inactive in kiosk mode */
	.kiosk-container.hide-cursor {
		cursor: none;
	}

	.kiosk-container.hide-cursor * {
		cursor: none !important;
	}

	/* Normal Mode: Standard layout */
	.dashboard-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: rgb(249, 250, 251);
	}

	.dashboard-main {
		flex: 1;
		overflow-y: auto;
		position: relative;
	}

	.dashboard-footer {
		background: white;
		border-top: 1px solid rgb(229, 231, 235);
		padding: 2rem;
		margin-top: 0;
	}

	.footer-content {
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.copyright {
		margin: 0;
		color: rgb(107, 114, 128);
		font-size: 0.875rem;
	}

	.footer-links {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
	}

	.footer-links a {
		color: rgb(107, 114, 128);
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.footer-links a:hover {
		color: rgb(59, 130, 246);
	}

	.footer-links a:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
		border-radius: 0.25rem;
	}

	.divider {
		color: rgb(209, 213, 219);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.dashboard-footer {
			padding: 1.5rem 1rem;
		}

		.footer-content {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 0.75rem;
		}

		.copyright {
			font-size: 0.8125rem;
		}

		.footer-links {
			font-size: 0.8125rem;
			gap: 0.5rem;
		}
	}
</style>
