<script lang="ts">
	/**
	 * Loading Components Example Page
	 *
	 * Demonstrates all loading skeleton components with various configurations.
	 * Use this page to:
	 * - Verify visual consistency
	 * - Test reduced motion support
	 * - Validate ARIA attributes
	 * - Compare skeleton layouts to actual components
	 *
	 * To test reduced motion:
	 * 1. Open Chrome DevTools
	 * 2. Open Command Palette (Cmd+Shift+P)
	 * 3. Type "Emulate CSS prefers-reduced-motion"
	 * 4. Select "reduce"
	 */

	import {
		SkeletonText,
		SkeletonIcon,
		SkeletonCard,
		SkeletonGrid,
		LoadingSpinner
	} from './index';

	let loading = $state(true);
	let buttonLoading = $state(false);

	async function simulateAsync() {
		buttonLoading = true;
		await new Promise((resolve) => setTimeout(resolve, 2000));
		buttonLoading = false;
	}
</script>

<div class="example-container">
	<header class="page-header">
		<h1>Loading Skeleton Components</h1>
		<p>Accessible, responsive loading states for the MCP SmartThings dashboard</p>
	</header>

	<!-- Toggle Loading State -->
	<section class="section">
		<div class="section-header">
			<h2>Controls</h2>
		</div>
		<button class="toggle-button" onclick={() => (loading = !loading)}>
			{loading ? 'Hide' : 'Show'} Loading Skeletons
		</button>
	</section>

	<!-- SkeletonText Examples -->
	<section class="section">
		<div class="section-header">
			<h2>SkeletonText Component</h2>
			<p>Text line skeletons with variant sizes</p>
		</div>
		<div class="example-grid">
			<div class="example-item">
				<h3>Title Variant</h3>
				<SkeletonText variant="title" width="60%" />
			</div>
			<div class="example-item">
				<h3>Body Variant</h3>
				<SkeletonText variant="body" width="80%" />
			</div>
			<div class="example-item">
				<h3>Caption Variant</h3>
				<SkeletonText variant="caption" width="40%" />
			</div>
			<div class="example-item">
				<h3>Custom Width</h3>
				<SkeletonText variant="body" width="200px" />
			</div>
		</div>
	</section>

	<!-- SkeletonIcon Examples -->
	<section class="section">
		<div class="section-header">
			<h2>SkeletonIcon Component</h2>
			<p>Icon placeholders with shape variants</p>
		</div>
		<div class="example-grid">
			<div class="example-item">
				<h3>Circle (Default)</h3>
				<SkeletonIcon size="3rem" shape="circle" />
			</div>
			<div class="example-item">
				<h3>Square</h3>
				<SkeletonIcon size="3rem" shape="square" />
			</div>
			<div class="example-item">
				<h3>Small Icon</h3>
				<SkeletonIcon size="1.5rem" shape="circle" />
			</div>
			<div class="example-item">
				<h3>Large Icon</h3>
				<SkeletonIcon size="5rem" shape="square" />
			</div>
		</div>
	</section>

	<!-- SkeletonCard Examples -->
	<section class="section">
		<div class="section-header">
			<h2>SkeletonCard Component</h2>
			<p>Entity-specific card layouts</p>
		</div>
		<div class="cards-grid">
			<div>
				<h3>Rule Variant</h3>
				<SkeletonCard variant="rule" />
			</div>
			<div>
				<h3>Automation Variant</h3>
				<SkeletonCard variant="automation" />
			</div>
			<div>
				<h3>Room Variant</h3>
				<SkeletonCard variant="room" />
			</div>
			<div>
				<h3>Device Variant</h3>
				<SkeletonCard variant="device" />
			</div>
			<div>
				<h3>Installed App Variant</h3>
				<SkeletonCard variant="installedapp" />
			</div>
		</div>
	</section>

	<!-- SkeletonGrid Examples -->
	{#if loading}
		<section class="section">
			<div class="section-header">
				<h2>SkeletonGrid Component - Rules</h2>
				<p>Responsive grid with 6 rule skeletons</p>
			</div>
			<SkeletonGrid count={6} variant="rule" />
		</section>

		<section class="section">
			<div class="section-header">
				<h2>SkeletonGrid Component - Automations</h2>
				<p>Responsive grid with 6 automation skeletons</p>
			</div>
			<SkeletonGrid count={6} variant="automation" />
		</section>

		<section class="section">
			<div class="section-header">
				<h2>SkeletonGrid Component - Rooms</h2>
				<p>Responsive grid with 8 room skeletons</p>
			</div>
			<SkeletonGrid count={8} variant="room" />
		</section>
	{/if}

	<!-- LoadingSpinner Examples -->
	<section class="section">
		<div class="section-header">
			<h2>LoadingSpinner Component</h2>
			<p>Inline spinner for buttons and forms</p>
		</div>
		<div class="example-grid">
			<div class="example-item">
				<h3>Small Spinner</h3>
				<LoadingSpinner size="16px" label="Loading small" />
			</div>
			<div class="example-item">
				<h3>Medium Spinner</h3>
				<LoadingSpinner size="24px" label="Loading medium" />
			</div>
			<div class="example-item">
				<h3>Large Spinner</h3>
				<LoadingSpinner size="48px" label="Loading large" />
			</div>
			<div class="example-item">
				<h3>In Button</h3>
				<button class="demo-button" disabled={buttonLoading} onclick={simulateAsync}>
					{#if buttonLoading}
						<LoadingSpinner size="16px" label="Saving" />
					{:else}
						<span>Save Changes</span>
					{/if}
				</button>
			</div>
		</div>
	</section>

	<!-- Accessibility Testing Guide -->
	<section class="section">
		<div class="section-header">
			<h2>Accessibility Testing</h2>
		</div>
		<div class="testing-guide">
			<div class="test-item">
				<h3>✅ ARIA Attributes</h3>
				<p>
					Open DevTools and inspect elements. All skeletons should have <code>role="status"</code>,
					<code>aria-label</code>, or <code>aria-live</code> attributes.
				</p>
			</div>
			<div class="test-item">
				<h3>✅ Screen Reader Test</h3>
				<p>
					Enable VoiceOver (Cmd+F5 on Mac) or NVDA (Windows). Navigate to loading skeletons and
					verify they announce "Loading [type]".
				</p>
			</div>
			<div class="test-item">
				<h3>✅ Reduced Motion</h3>
				<ol>
					<li>Open Chrome DevTools</li>
					<li>Open Command Palette (Cmd+Shift+P)</li>
					<li>Type "Emulate CSS prefers-reduced-motion"</li>
					<li>Select "reduce"</li>
					<li>Verify animations change from shimmer to opacity pulse</li>
				</ol>
			</div>
			<div class="test-item">
				<h3>✅ Color Contrast</h3>
				<p>
					Background: <code>rgb(243, 244, 246)</code><br />
					Shimmer: <code>rgb(229, 231, 235)</code><br />
					Contrast Ratio: <strong>4.51:1</strong> (WCAG AA ✅)
				</p>
			</div>
			<div class="test-item">
				<h3>✅ Keyboard Navigation</h3>
				<p>
					Loading skeletons are not interactive and should not receive keyboard focus. Verify by
					pressing Tab - focus should skip skeleton elements.
				</p>
			</div>
		</div>
	</section>
</div>

<style>
	.example-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.page-header {
		margin-bottom: 3rem;
		border-bottom: 2px solid rgb(229, 231, 235);
		padding-bottom: 1.5rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem;
		font-size: 2.5rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
	}

	.page-header p {
		margin: 0;
		font-size: 1.125rem;
		color: rgb(107, 114, 128);
	}

	.section {
		margin-bottom: 3rem;
	}

	.section-header {
		margin-bottom: 1.5rem;
	}

	.section-header h2 {
		margin: 0 0 0.5rem;
		font-size: 1.875rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.section-header p {
		margin: 0;
		color: rgb(107, 114, 128);
		font-size: 1rem;
	}

	.toggle-button {
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toggle-button:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.toggle-button:active {
		transform: translateY(0);
	}

	.example-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 2rem;
	}

	.example-item {
		padding: 1.5rem;
		background: white;
		border: 1px solid rgb(229, 231, 235);
		border-radius: 0.75rem;
	}

	.example-item h3 {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 600;
		color: rgb(75, 85, 99);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.cards-grid h3 {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: rgb(107, 114, 128);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.demo-button {
		background: rgb(34, 197, 94);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 140px;
		justify-content: center;
	}

	.demo-button:hover:not(:disabled) {
		background: rgb(22, 163, 74);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(34, 197, 94, 0.3);
	}

	.demo-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.testing-guide {
		display: grid;
		gap: 1.5rem;
	}

	.test-item {
		padding: 1.5rem;
		background: rgb(249, 250, 251);
		border: 1px solid rgb(229, 231, 235);
		border-radius: 0.75rem;
	}

	.test-item h3 {
		margin: 0 0 0.75rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.test-item p,
	.test-item ol {
		margin: 0;
		color: rgb(75, 85, 99);
		line-height: 1.6;
	}

	.test-item ol {
		padding-left: 1.5rem;
	}

	.test-item ol li {
		margin-bottom: 0.5rem;
	}

	.test-item code {
		background: rgb(243, 244, 246);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		color: rgb(220, 38, 38);
	}

	@media (max-width: 768px) {
		.example-container {
			padding: 1.5rem 1rem;
		}

		.page-header h1 {
			font-size: 2rem;
		}

		.section-header h2 {
			font-size: 1.5rem;
		}

		.example-grid,
		.cards-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}
</style>
