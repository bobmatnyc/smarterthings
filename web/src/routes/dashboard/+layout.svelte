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

	let { children } = $props();
	const dashboardStore = getDashboardStore();

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
	<!-- Normal Mode: Let root layout handle chrome, just render content -->
	{@render children()}
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
</style>
