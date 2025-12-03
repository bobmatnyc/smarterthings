<script lang="ts">
	/**
	 * AsyncContent Usage Examples
	 *
	 * Demonstrates various ways to use the AsyncContent wrapper component
	 * with Svelte 5 snippets for declarative state management.
	 *
	 * Examples:
	 * 1. Basic usage with default states
	 * 2. Custom loading state with different skeleton variant
	 * 3. Custom error state with custom retry logic
	 * 4. Custom empty state with action button
	 * 5. All custom states together
	 */

	import { AsyncContent, SkeletonGrid, ErrorState, EmptyState } from '$lib/components/loading';
	import { getRulesStore } from '$lib/stores/rulesStore.svelte';

	const rulesStore = getRulesStore();

	/**
	 * Simulated fetch function for demo purposes
	 */
	async function loadRulesWithDelay() {
		// Add artificial delay for demo
		await new Promise((resolve) => setTimeout(resolve, 500));
		await rulesStore.loadRules();
	}
</script>

<div class="examples-container">
	<!-- Example 1: Basic Usage with Defaults -->
	<section class="example">
		<h2>Example 1: Basic Usage (Default States)</h2>
		<p class="description">
			Zero configuration - uses default loading (SkeletonGrid), error, and empty states.
		</p>

		<AsyncContent
			loading={rulesStore.loading}
			error={rulesStore.error}
			empty={rulesStore.rules.length === 0}
			emptyMessage="No rules found. Create your first rule to get started."
			onRetry={rulesStore.loadRules}
		>
			<div class="content-display">
				<p>✅ Loaded {rulesStore.rules.length} rules successfully!</p>
				<pre>{JSON.stringify(rulesStore.rules.slice(0, 2), null, 2)}</pre>
			</div>
		</AsyncContent>
	</section>

	<!-- Example 2: Custom Loading State -->
	<section class="example">
		<h2>Example 2: Custom Loading State</h2>
		<p class="description">Override loading state with custom skeleton variant.</p>

		<AsyncContent
			loading={rulesStore.loading}
			error={rulesStore.error}
			empty={rulesStore.rules.length === 0}
			onRetry={rulesStore.loadRules}
		>
			{#snippet loadingSlot()}
				<div class="custom-loading">
					<SkeletonGrid count={8} variant="device" />
					<p class="loading-hint">Loading your smart home rules...</p>
				</div>
			{/snippet}

			<div class="content-display">
				<p>✅ Content loaded with custom loading state</p>
			</div>
		</AsyncContent>
	</section>

	<!-- Example 3: Custom Error State -->
	<section class="example">
		<h2>Example 3: Custom Error State</h2>
		<p class="description">Custom error display with branded styling.</p>

		<AsyncContent loading={rulesStore.loading} error={rulesStore.error} empty={false}>
			{#snippet errorSlot(err)}
				<div class="custom-error">
					<div class="error-badge">⚠️</div>
					<h3>Oops! Something Went Wrong</h3>
					<p class="error-detail">{err}</p>
					<div class="error-actions">
						<button class="btn-primary" onclick={loadRulesWithDelay}>Retry Loading</button>
						<button class="btn-secondary">Contact Support</button>
					</div>
				</div>
			{/snippet}

			<div class="content-display">
				<p>✅ Content loaded</p>
			</div>
		</AsyncContent>
	</section>

	<!-- Example 4: Custom Empty State -->
	<section class="example">
		<h2>Example 4: Custom Empty State</h2>
		<p class="description">Custom empty state with action button and icon.</p>

		<AsyncContent
			loading={rulesStore.loading}
			error={rulesStore.error}
			empty={rulesStore.rules.length === 0}
		>
			{#snippet emptySlot()}
				<EmptyState title="No Rules Yet">
					{#snippet icon()}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="3"></circle>
							<path
								d="M12 1v6m0 6v6m8.66-9l-5.2 3m-5.2 3l-5.2 3M20.66 17l-5.2-3m-5.2-3l-5.2-3"
							></path>
						</svg>
					{/snippet}

					{#snippet action()}
						<button class="btn-create" onclick={() => console.log('Create rule')}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="12" y1="5" x2="12" y2="19"></line>
								<line x1="5" y1="12" x2="19" y2="12"></line>
							</svg>
							<span>Create Your First Rule</span>
						</button>
					{/snippet}
				</EmptyState>
			{/snippet}

			<div class="content-display">
				<p>✅ Content loaded</p>
			</div>
		</AsyncContent>
	</section>

	<!-- Example 5: All Custom States -->
	<section class="example">
		<h2>Example 5: Complete Customization</h2>
		<p class="description">All states customized with brand-specific design.</p>

		<AsyncContent
			loading={rulesStore.loading}
			error={rulesStore.error}
			empty={rulesStore.rules.length === 0}
			onRetry={rulesStore.loadRules}
		>
			{#snippet loadingSlot()}
				<div class="brand-loading">
					<div class="spinner-container">
						<div class="brand-spinner"></div>
					</div>
					<p class="brand-loading-text">Loading your automation rules...</p>
				</div>
			{/snippet}

			{#snippet errorSlot(err)}
				<div class="brand-error">
					<h3>⚠️ Connection Error</h3>
					<p>{err}</p>
					<button class="brand-button" onclick={rulesStore.loadRules}>Try Again</button>
				</div>
			{/snippet}

			{#snippet emptySlot()}
				<div class="brand-empty">
					<h3>🎯 Ready to Automate?</h3>
					<p>Create your first rule to make your smart home work for you.</p>
					<button class="brand-button">Get Started</button>
				</div>
			{/snippet}

			<div class="content-display brand-content">
				<h3>✨ Your Rules ({rulesStore.rules.length})</h3>
				<p>All systems operational!</p>
			</div>
		</AsyncContent>
	</section>

	<!-- Example 6: Non-Retryable Error -->
	<section class="example">
		<h2>Example 6: Non-Retryable Error</h2>
		<p class="description">Error state without retry button (errorRetryable=false).</p>

		<AsyncContent
			loading={false}
			error="This operation cannot be retried. Please contact support."
			empty={false}
			errorRetryable={false}
		>
			<div class="content-display">
				<p>✅ Content</p>
			</div>
		</AsyncContent>
	</section>
</div>

<style>
	.examples-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.example {
		margin-bottom: 4rem;
		padding: 2rem;
		background: white;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.example h2 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.description {
		margin: 0 0 1.5rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
	}

	.content-display {
		padding: 2rem;
		background: rgb(243, 244, 246);
		border-radius: 0.5rem;
		min-height: 200px;
	}

	.content-display p {
		margin: 0 0 1rem;
		font-weight: 600;
		color: rgb(34, 197, 94);
	}

	.content-display pre {
		background: rgb(17, 24, 39);
		color: rgb(243, 244, 246);
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		font-size: 0.875rem;
	}

	/* Custom Loading State Styles */
	.custom-loading {
		text-align: center;
	}

	.loading-hint {
		margin-top: 1.5rem;
		color: rgb(107, 114, 128);
		font-style: italic;
	}

	/* Custom Error State Styles */
	.custom-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3rem 2rem;
		text-align: center;
	}

	.error-badge {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.custom-error h3 {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		color: rgb(17, 24, 39);
	}

	.error-detail {
		margin: 0 0 1.5rem;
		color: rgb(107, 114, 128);
		max-width: 28rem;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
	}

	/* Button Styles */
	.btn-primary,
	.btn-secondary,
	.btn-create {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-primary,
	.btn-create {
		background: rgb(59, 130, 246);
		color: white;
	}

	.btn-primary:hover,
	.btn-create:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
	}

	.btn-secondary {
		background: white;
		color: rgb(59, 130, 246);
		border: 2px solid rgb(59, 130, 246);
	}

	.btn-secondary:hover {
		background: rgb(239, 246, 255);
	}

	.btn-create svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	/* Brand Customization Styles */
	.brand-loading,
	.brand-error,
	.brand-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 400px;
	}

	.spinner-container {
		margin-bottom: 1.5rem;
	}

	.brand-spinner {
		width: 4rem;
		height: 4rem;
		border: 4px solid rgb(229, 231, 235);
		border-top-color: rgb(59, 130, 246);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.brand-loading-text {
		color: rgb(107, 114, 128);
		font-size: 1.125rem;
	}

	.brand-error h3,
	.brand-empty h3 {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
	}

	.brand-error p,
	.brand-empty p {
		margin: 0 0 1.5rem;
		color: rgb(107, 114, 128);
		max-width: 28rem;
	}

	.brand-button {
		background: linear-gradient(135deg, rgb(147, 51, 234), rgb(219, 39, 119));
		color: white;
		border: none;
		padding: 0.875rem 1.75rem;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.brand-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(147, 51, 234, 0.4);
	}

	.brand-content {
		background: linear-gradient(135deg, rgb(243, 232, 255), rgb(254, 242, 242));
	}

	.brand-content h3 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		color: rgb(17, 24, 39);
	}

	.brand-content p {
		margin: 0;
		color: rgb(107, 114, 128);
	}
</style>
