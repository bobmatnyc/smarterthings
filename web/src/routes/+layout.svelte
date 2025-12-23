<script lang="ts">
	/**
	 * App Layout with Modern Dashboard Design + Global Auth Guard
	 *
	 * Design Decision: Global authentication check at layout level
	 *
	 * Rationale: Modern web apps (Google, GitHub, etc.) check authentication
	 * once at the root layout and redirect to dedicated auth page if needed.
	 * This provides:
	 * - Single source of truth for authentication state
	 * - No duplicate auth checks in every page
	 * - Clean separation between public (auth page) and protected routes
	 * - Better UX (clear "you need to log in" flow)
	 *
	 * Authentication Flow:
	 * 1. Layout checks /health endpoint on mount
	 * 2. If authenticated → render app normally
	 * 3. If not authenticated → redirect to /auth page
	 * 4. /auth page is exempt from redirect (public route)
	 *
	 * Layout Structure:
	 * - Fixed Header: App branding and title
	 * - Sticky SubNav: Main navigation tabs (Rooms/Devices/Automations)
	 * - Main Content: Route-specific content
	 * - Chat Sidebar: Collapsible AI assistant
	 *
	 * Keyboard Shortcuts:
	 * - Ctrl+/ (or Cmd+/ on Mac): Toggle chat sidebar
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '../app.postcss';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/layout/Header.svelte';
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
	import LoadingSpinner from '$lib/components/loading/LoadingSpinner.svelte';
	import { getChatStore } from '$lib/stores/chatStore.svelte';
	import { getDeviceStore } from '$lib/stores/deviceStore.svelte';
	import { connectDeviceSSE } from '$lib/sse/deviceStream.svelte';
	import { Toaster } from 'svelte-sonner';
	import { FOOTER_LABELS } from '$lib/constants/labels';

	let { children } = $props();
	const chatStore = getChatStore();
	const deviceStore = getDeviceStore();

	// Backend URL from environment or default
	const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5182';

	// Authentication state
	let authChecked = $state(false);
	let isAuthenticated = $state(false);

	// Dynamic copyright year
	const currentYear = new Date().getFullYear();
	const copyrightText = FOOTER_LABELS.copyright(currentYear);

	/**
	 * Global Authentication Check + SSE Connection
	 *
	 * Design Decision: Check auth at layout level, not in every page
	 * Rationale: Single check prevents duplicate code and race conditions
	 *
	 * Process:
	 * 1. Skip check for public routes (/auth)
	 * 2. Check /health endpoint for SmartThings initialization
	 * 3. If not authenticated, redirect to /auth
	 * 4. If authenticated, establish SSE connection and render app normally
	 */
	onMount(async () => {
		// Skip auth check for public routes
		if ($page.url.pathname.startsWith('/auth')) {
			authChecked = true;
			return;
		}

		try {
			// Check authentication via /health endpoint
			const response = await fetch(`${BACKEND_URL}/health`);

			if (!response.ok) {
				throw new Error(`Backend returned ${response.status}`);
			}

			const data = await response.json();

			// Check if SmartThings is initialized
			isAuthenticated = data.smartthings?.initialized ?? false;
			authChecked = true;

			if (!isAuthenticated) {
				// Redirect to auth page
				goto('/auth');
				return;
			}

			// Connect to SSE stream for real-time device updates
			// This ensures SSE is connected on ALL routes (/rooms, /devices, etc.)
			const cleanupSSE = connectDeviceSSE(deviceStore);

			// Return cleanup function
			return () => {
				cleanupSSE();
			};
		} catch (error) {
			console.error('Auth check failed:', error);
			authChecked = true;
			isAuthenticated = false;
			goto('/auth');
		}
	});

	/**
	 * Keyboard shortcut handler
	 * Ctrl+/ or Cmd+/ to toggle sidebar
	 */
	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === '/') {
			event.preventDefault();
			chatStore.toggleSidebar();
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- Global Auth Guard: Show loading or app based on auth state -->
{#if !authChecked}
	<!-- Loading State: Checking authentication -->
	<div class="auth-loading-container">
		<LoadingSpinner size="48px" label="Checking authentication" />
		<p class="auth-loading-text">Connecting to Smarter Things...</p>
	</div>
{:else if $page.url.pathname.startsWith('/auth')}
	<!-- Auth page: Minimal layout WITHOUT app shell components -->
	<!-- CRITICAL: Do NOT render ChatSidebar, Header, SubNav here - they make API calls that trigger 401 -->
	<div class="auth-layout">
		<main class="auth-main">
			{@render children()}
		</main>
	</div>
{:else if isAuthenticated}
	<!-- Authenticated: Show full app shell -->

	<!-- Chat Sidebar (Fixed Left) -->
	<ChatSidebar />

	<!-- Toggle Button (visible when sidebar is collapsed) -->
	{#if chatStore.sidebarCollapsed}
		<button
			class="sidebar-toggle-btn"
			onclick={() => chatStore.toggleSidebar()}
			aria-label="Open chat sidebar"
			title="Open chat (Ctrl+/)"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
		</button>
	{/if}

	<!-- Main App Shell -->
	<div class="app-shell" class:sidebar-open={!chatStore.sidebarCollapsed}>
		<!-- Main Header -->
		<Header />

		<!-- Sub-Navigation -->
		<SubNav />

		<!-- Main Content Area -->
		<main class="app-main">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="app-footer">
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

<!-- Toast Notification System -->
<Toaster position="top-right" richColors closeButton duration={3000} />

<style>
	/**
	 * Auth Loading Container
	 *
	 * Centered loading state while checking authentication at app startup.
	 */
	.auth-loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		gap: 1rem;
		padding: 2rem;
		background: rgb(249, 250, 251);
	}

	.auth-loading-text {
		font-size: 1rem;
		color: rgb(107, 114, 128);
		margin: 0;
	}

	/**
	 * Auth Layout
	 *
	 * Minimal layout for auth pages - NO app shell components.
	 * This prevents 401 errors from ChatSidebar/Header/SubNav API calls.
	 */
	.auth-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: rgb(249, 250, 251);
	}

	.auth-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.app-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		background: rgb(249, 250, 251);
	}

	/* Desktop: Push content right when sidebar open */
	@media (min-width: 769px) {
		.app-shell.sidebar-open {
			margin-left: 24rem;
		}
	}

	/* Tablet: Slightly less margin */
	@media (min-width: 769px) and (max-width: 1024px) {
		.app-shell.sidebar-open {
			margin-left: 20rem;
		}
	}

	/* Mobile: No margin (overlay mode) */
	@media (max-width: 768px) {
		.app-shell.sidebar-open {
			margin-left: 0;
		}
	}

	.app-main {
		flex: 1;
		overflow-y: auto;
		position: relative;
	}

	.app-footer {
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

	.sidebar-toggle-btn {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 60;
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: all 0.2s ease;
	}

	.sidebar-toggle-btn:hover {
		background: rgb(37, 99, 235);
		transform: scale(1.05);
	}

	.sidebar-toggle-btn:active {
		transform: scale(0.95);
	}

	.sidebar-toggle-btn:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
	}

	/* Mobile: Adjust footer */
	@media (max-width: 768px) {
		.app-footer {
			padding: 1.5rem 1rem;
			margin-top: 0;
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

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.app-footer {
			padding: 1.75rem 1.5rem;
		}
	}
</style>
