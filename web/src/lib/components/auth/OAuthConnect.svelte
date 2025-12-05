<script lang="ts">
	/**
	 * OAuthConnect Component
	 *
	 * Design: Friendly authentication UI for SmartThings OAuth flow
	 * Inspired by modern OAuth consent screens (GitHub, Google, etc.)
	 *
	 * Features:
	 * - Clear call-to-action button
	 * - SmartThings branding
	 * - Explanation of what will happen
	 * - Accessible keyboard navigation
	 *
	 * Accessibility:
	 * - Semantic HTML structure
	 * - ARIA labels for screen readers
	 * - High contrast colors (WCAG AA)
	 * - Focus indicators for keyboard navigation
	 *
	 * Performance:
	 * - Simple redirect, no heavy operations
	 * - CSS-only animations
	 */

	// Backend URL from environment or default to localhost
	const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5182';

	function handleConnect() {
		// Redirect to backend OAuth flow
		window.location.href = `${BACKEND_URL}/auth/smartthings`;
	}
</script>

<div class="oauth-container">
	<div class="oauth-card">
		<!-- SmartThings Logo -->
		<div class="logo-container">
			<svg
				class="smartthings-logo"
				viewBox="0 0 200 200"
				xmlns="http://www.w3.org/2000/svg"
				aria-label="SmartThings Logo"
			>
				<circle cx="100" cy="100" r="95" fill="#15BFFD" />
				<path
					d="M100 40 L160 100 L100 160 L40 100 Z"
					fill="white"
					opacity="0.9"
				/>
				<circle cx="100" cy="100" r="25" fill="white" />
			</svg>
		</div>

		<!-- Heading -->
		<h1 class="oauth-title">Connect to SmartThings</h1>

		<!-- Description -->
		<p class="oauth-description">
			To use Smarter Things, you need to connect your SmartThings account.
			This will allow you to:
		</p>

		<!-- Features List -->
		<ul class="features-list">
			<li class="feature-item">
				<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
				<span>View and control your smart devices</span>
			</li>
			<li class="feature-item">
				<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
				<span>Manage rooms and organize devices</span>
			</li>
			<li class="feature-item">
				<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
				<span>Create and execute automations</span>
			</li>
			<li class="feature-item">
				<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
				<span>Monitor device events in real-time</span>
			</li>
		</ul>

		<!-- Security Notice -->
		<div class="security-notice">
			<svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
				<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
			</svg>
			<span>Your credentials are encrypted and never stored on our servers</span>
		</div>

		<!-- Connect Button -->
		<button
			class="connect-button"
			onclick={handleConnect}
			type="button"
		>
			<span>Connect SmartThings Account</span>
			<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="5" y1="12" x2="19" y2="12"></line>
				<polyline points="12 5 19 12 12 19"></polyline>
			</svg>
		</button>

		<!-- Help Text -->
		<p class="help-text">
			You'll be redirected to SmartThings to authorize access.
			After authorization, you'll return here automatically.
		</p>
	</div>
</div>

<style>
	/**
	 * OAuth Container
	 *
	 * Center the card vertically and horizontally with full viewport height.
	 * Provides padding for smaller screens.
	 */
	.oauth-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 4rem); /* Account for header */
		padding: 2rem 1rem;
		background: linear-gradient(135deg, rgb(240, 249, 255) 0%, rgb(224, 242, 254) 100%);
	}

	/**
	 * OAuth Card
	 *
	 * White card with shadow for content isolation.
	 * Max width for readability, responsive design.
	 */
	.oauth-card {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
		padding: 3rem 2rem;
		max-width: 500px;
		width: 100%;
		text-align: center;
	}

	/**
	 * SmartThings Logo
	 *
	 * Simplified SmartThings brand colors and shape.
	 * Centered with margin for visual hierarchy.
	 */
	.logo-container {
		display: flex;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.smartthings-logo {
		width: 80px;
		height: 80px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}

	/**
	 * Typography
	 *
	 * Clear hierarchy: title → description → features
	 */
	.oauth-title {
		font-size: 1.875rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
		margin: 0 0 1rem;
		line-height: 1.2;
	}

	.oauth-description {
		font-size: 1rem;
		color: rgb(75, 85, 99);
		margin: 0 0 1.5rem;
		line-height: 1.6;
	}

	/**
	 * Features List
	 *
	 * Left-aligned list with checkmark icons.
	 * Visual feedback of what user can do after connecting.
	 */
	.features-list {
		list-style: none;
		padding: 0;
		margin: 0 0 1.5rem;
		text-align: left;
	}

	.feature-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0;
		font-size: 0.9375rem;
		color: rgb(55, 65, 81);
	}

	.check-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: rgb(34, 197, 94);
		flex-shrink: 0;
	}

	/**
	 * Security Notice
	 *
	 * Reassures user about data security.
	 * Light background with lock icon.
	 */
	.security-notice {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
		background: rgb(243, 244, 246);
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
		color: rgb(75, 85, 99);
		text-align: center;
	}

	.lock-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: rgb(107, 114, 128);
	}

	/**
	 * Connect Button
	 *
	 * Primary CTA with SmartThings brand color.
	 * Large touch target, smooth transitions.
	 */
	.connect-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 1rem 1.5rem;
		background: linear-gradient(135deg, rgb(21, 191, 253) 0%, rgb(14, 165, 233) 100%);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(21, 191, 253, 0.2);
	}

	.connect-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(21, 191, 253, 0.3);
	}

	.connect-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(21, 191, 253, 0.2);
	}

	.connect-button:focus {
		outline: 3px solid rgba(21, 191, 253, 0.4);
		outline-offset: 2px;
	}

	.arrow-icon {
		width: 1.25rem;
		height: 1.25rem;
		transition: transform 0.2s ease;
	}

	.connect-button:hover .arrow-icon {
		transform: translateX(4px);
	}

	/**
	 * Help Text
	 *
	 * Small explanatory text below button.
	 */
	.help-text {
		margin: 1rem 0 0;
		font-size: 0.875rem;
		color: rgb(107, 114, 128);
		line-height: 1.5;
	}

	/**
	 * Mobile Responsiveness
	 *
	 * Adjust padding and font sizes for smaller screens.
	 */
	@media (max-width: 640px) {
		.oauth-card {
			padding: 2rem 1.5rem;
		}

		.oauth-title {
			font-size: 1.5rem;
		}

		.oauth-description {
			font-size: 0.9375rem;
		}

		.feature-item {
			font-size: 0.875rem;
		}

		.security-notice {
			font-size: 0.8125rem;
			padding: 0.75rem;
		}

		.connect-button {
			padding: 0.875rem 1.25rem;
			font-size: 0.9375rem;
		}
	}

	/**
	 * Accessibility: Reduced Motion
	 *
	 * Disable animations for users with motion sensitivity.
	 */
	@media (prefers-reduced-motion: reduce) {
		.connect-button {
			transition: none;
		}

		.connect-button:hover {
			transform: none;
		}

		.arrow-icon {
			transition: none;
		}

		.connect-button:hover .arrow-icon {
			transform: none;
		}
	}
</style>
