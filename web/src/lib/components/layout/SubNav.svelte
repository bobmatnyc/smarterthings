<script lang="ts">
	/**
	 * Sub-Navigation Component
	 *
	 * Design: Tab-style navigation for main app sections
	 * Rooms (default) | Devices | Automations
	 *
	 * Features:
	 * - Tab-based navigation
	 * - Active state highlighting
	 * - Real-time SSE connection status indicator (ticket 1M-437)
	 *
	 * Accessibility:
	 * - Nav element with ARIA role
	 * - Active state indication
	 * - Keyboard navigable links
	 * - Clear focus indicators
	 *
	 * Performance:
	 * - SvelteKit native navigation (no JS routing overhead)
	 * - Instant navigation with preloading
	 */

	import { page } from '$app/stores';
	import ConnectionStatus from './ConnectionStatus.svelte';

	// Reactive current path for active tab highlighting
	$: currentPath = $page.url.pathname;

	interface NavItem {
		label: string;
		href: string;
		icon: string;
	}

	const navItems: NavItem[] = [
		{ label: 'Rooms', href: '/', icon: 'home' },
		{ label: 'Devices', href: '/devices', icon: 'devices' },
		{ label: 'Scenes', href: '/automations', icon: 'automation' },
		{ label: 'Events', href: '/events', icon: 'events' },
		{ label: 'Battery', href: '/battery', icon: 'battery' }
	];

	function isActive(href: string): boolean {
		if (href === '/') {
			return currentPath === '/';
		}
		return currentPath.startsWith(href);
	}
</script>

<nav class="sub-nav" role="navigation" aria-label="Main navigation">
	<div class="nav-content">
		<ul class="nav-list">
			{#each navItems as item}
				<li class="nav-item">
					<a
						href={item.href}
						class="nav-link"
						class:active={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						<span class="nav-icon" data-icon={item.icon}></span>
						<span class="nav-label">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<!-- Real-time connection status indicator (ticket 1M-437) -->
		<div class="connection-status-container">
			<ConnectionStatus />
		</div>
	</div>
</nav>

<style>
	.sub-nav {
		background: white;
		border-bottom: 2px solid rgb(229, 231, 235);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		position: sticky;
		top: 4.5rem;
		z-index: 40;
	}

	.nav-content {
		max-width: 1400px;
		margin: 0 auto;
		padding: 0 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.nav-list {
		display: flex;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.connection-status-container {
		margin-left: auto;
	}

	.nav-item {
		margin: 0;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		text-decoration: none;
		color: rgb(107, 114, 128);
		font-weight: 500;
		font-size: 0.9375rem;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all 0.2s ease;
		position: relative;
	}

	.nav-link:hover {
		color: rgb(59, 130, 246);
		background: rgb(239, 246, 255);
	}

	.nav-link:focus {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: -2px;
		border-radius: 0.25rem;
	}

	.nav-link.active {
		color: rgb(59, 130, 246);
		border-bottom-color: rgb(59, 130, 246);
		font-weight: 600;
	}

	.nav-icon {
		width: 1.25rem;
		height: 1.25rem;
		display: inline-block;
		position: relative;
	}

	/* Icon styles using CSS shapes (no external icon library needed) */
	.nav-icon::before {
		content: '';
		position: absolute;
		inset: 0;
		background: currentColor;
		-webkit-mask-size: contain;
		mask-size: contain;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
	}

	.nav-icon[data-icon='home']::before {
		-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'%3E%3C/path%3E%3Cpolyline points='9 22 9 12 15 12 15 22'%3E%3C/polyline%3E%3C/svg%3E");
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'%3E%3C/path%3E%3Cpolyline points='9 22 9 12 15 12 15 22'%3E%3C/polyline%3E%3C/svg%3E");
	}

	.nav-icon[data-icon='devices']::before {
		-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='2' y='2' width='20' height='8' rx='2' ry='2'%3E%3C/rect%3E%3Crect x='2' y='14' width='20' height='8' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='6' y1='6' x2='6.01' y2='6'%3E%3C/line%3E%3Cline x1='6' y1='18' x2='6.01' y2='18'%3E%3C/line%3E%3C/svg%3E");
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='2' y='2' width='20' height='8' rx='2' ry='2'%3E%3C/rect%3E%3Crect x='2' y='14' width='20' height='8' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='6' y1='6' x2='6.01' y2='6'%3E%3C/line%3E%3Cline x1='6' y1='18' x2='6.01' y2='18'%3E%3C/line%3E%3C/svg%3E");
	}

	.nav-icon[data-icon='automation']::before {
		-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpolyline points='22 12 18 12 15 21 9 3 6 12 2 12'%3E%3C/polyline%3E%3C/svg%3E");
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpolyline points='22 12 18 12 15 21 9 3 6 12 2 12'%3E%3C/polyline%3E%3C/svg%3E");
	}

	.nav-icon[data-icon='events']::before {
		-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpolyline points='22 12 18 12 15 21 9 3 6 12 2 12'%3E%3C/polyline%3E%3C/svg%3E");
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpolyline points='22 12 18 12 15 21 9 3 6 12 2 12'%3E%3C/polyline%3E%3C/svg%3E");
	}

	.nav-icon[data-icon='battery']::before {
		-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='1' y='6' width='18' height='12' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='23' y1='13' x2='23' y2='11'%3E%3C/line%3E%3C/svg%3E");
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='1' y='6' width='18' height='12' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='23' y1='13' x2='23' y2='11'%3E%3C/line%3E%3C/svg%3E");
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.sub-nav {
			top: 3.5rem;
		}

		.nav-content {
			padding: 0 1rem;
		}

		.nav-link {
			padding: 0.875rem 1rem;
			font-size: 0.875rem;
		}

		.nav-label {
			display: none;
		}

		.nav-icon {
			width: 1.5rem;
			height: 1.5rem;
		}
	}

	/* Tablet view */
	@media (min-width: 769px) and (max-width: 1024px) {
		.nav-link {
			padding: 0.875rem 1.25rem;
		}
	}
</style>
