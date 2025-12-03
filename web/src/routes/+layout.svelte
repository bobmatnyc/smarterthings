<script lang="ts">
	/**
	 * App Layout with Modern Dashboard Design
	 *
	 * Design Decision: Simplified layout with rooms-first navigation
	 *
	 * Rationale: Modern smart home UX pattern focusing on:
	 * - Clear visual hierarchy (Header → SubNav → Content)
	 * - Consistent navigation across all views
	 * - Chat sidebar for AI assistance (optional/collapsible)
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

	import '../app.postcss';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/layout/Header.svelte';
	import SubNav from '$lib/components/layout/SubNav.svelte';
	import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
	import { getChatStore } from '$lib/stores/chatStore.svelte';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
	const chatStore = getChatStore();

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
			<p class="copyright">© 2024 Smarter Things. All rights reserved.</p>
			<div class="footer-links">
				<a href="/privacy">Privacy</a>
				<span class="divider">•</span>
				<a href="/terms">Terms</a>
				<span class="divider">•</span>
				<a href="https://github.com/yourusername/mcp-smartthings" target="_blank" rel="noopener">
					GitHub
				</a>
			</div>
		</div>
	</footer>
</div>

<!-- Toast Notification System -->
<Toaster position="top-right" richColors closeButton duration={3000} />

<style>
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
