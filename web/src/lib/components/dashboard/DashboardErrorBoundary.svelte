<script lang="ts">
	/**
	 * Dashboard Error Boundary
	 *
	 * Design Decision: Catch errors in dashboard components with fallback UI
	 * Rationale: Dashboard should never crash the entire app. Show friendly
	 * error message with recovery options.
	 *
	 * Features:
	 * - Catch component errors
	 * - Display user-friendly error message
	 * - Provide "Refresh" button to reload
	 * - Log errors for debugging
	 *
	 * Architecture:
	 * - Uses Svelte's error boundary pattern
	 * - Wraps dashboard components in try/catch
	 * - Provides graceful degradation
	 */

	import { onMount } from 'svelte';

	let { children }: { children?: import('svelte').Snippet } = $props();

	let hasError = $state(false);
	let errorMessage = $state('');
	let errorStack = $state('');

	/**
	 * Handle component errors
	 */
	function handleError(error: Error) {
		console.error('[DashboardErrorBoundary] Caught error:', error);
		hasError = true;
		errorMessage = error.message || 'An unexpected error occurred';
		errorStack = error.stack || '';
	}

	/**
	 * Refresh page to recover from error
	 */
	function refresh() {
		window.location.reload();
	}

	/**
	 * Reset error state
	 */
	function reset() {
		hasError = false;
		errorMessage = '';
		errorStack = '';
	}

	onMount(() => {
		// Set up global error handler for dashboard
		const errorHandler = (event: ErrorEvent) => {
			// Only handle errors in dashboard components
			if (event.error && event.filename?.includes('/dashboard/')) {
				event.preventDefault();
				handleError(event.error);
			}
		};

		window.addEventListener('error', errorHandler);

		return () => {
			window.removeEventListener('error', errorHandler);
		};
	});
</script>

{#if hasError}
	<!-- Error Fallback UI -->
	<div class="error-boundary">
		<div class="error-content">
			<div class="error-icon">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
			</div>

			<h2 class="error-title">Dashboard Error</h2>

			<p class="error-description">
				Something went wrong while loading the dashboard. Don't worry, your smart home is
				still working - this is just a display issue.
			</p>

			<div class="error-actions">
				<button class="btn-primary" onclick={refresh}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="23 4 23 10 17 10"></polyline>
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
					</svg>
					Refresh Dashboard
				</button>

				<button class="btn-secondary" onclick={reset}>Try Again</button>
			</div>

			{#if errorMessage}
				<details class="error-details">
					<summary>Technical Details</summary>
					<pre class="error-stack">{errorMessage}\n\n{errorStack}</pre>
				</details>
			{/if}
		</div>
	</div>
{:else}
	<!-- Render children when no error -->
	{@render children?.()}
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 12rem);
		padding: 2rem;
		background: linear-gradient(135deg, rgb(254, 242, 242) 0%, rgb(254, 226, 226) 100%);
	}

	.error-content {
		max-width: 32rem;
		text-align: center;
		background: white;
		padding: 3rem 2rem;
		border-radius: 1rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
	}

	.error-icon {
		width: 5rem;
		height: 5rem;
		margin: 0 auto 1.5rem;
		background: linear-gradient(135deg, rgb(254, 242, 242) 0%, rgb(254, 226, 226) 100%);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(239, 68, 68);
	}

	.error-icon svg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.error-title {
		margin: 0 0 1rem;
		font-size: 1.75rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
	}

	.error-description {
		margin: 0 0 2rem;
		color: rgb(107, 114, 128);
		line-height: 1.6;
		font-size: 1rem;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-primary {
		background: rgb(239, 68, 68);
		color: white;
	}

	.btn-primary:hover {
		background: rgb(220, 38, 38);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);
	}

	.btn-primary svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.btn-secondary {
		background: rgb(243, 244, 246);
		color: rgb(75, 85, 99);
	}

	.btn-secondary:hover {
		background: rgb(229, 231, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.error-details {
		margin-top: 2rem;
		text-align: left;
		border-top: 1px solid rgb(229, 231, 235);
		padding-top: 1.5rem;
	}

	.error-details summary {
		cursor: pointer;
		color: rgb(107, 114, 128);
		font-size: 0.875rem;
		font-weight: 500;
		user-select: none;
	}

	.error-details summary:hover {
		color: rgb(59, 130, 246);
	}

	.error-stack {
		margin-top: 1rem;
		padding: 1rem;
		background: rgb(249, 250, 251);
		border: 1px solid rgb(229, 231, 235);
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-family: monospace;
		color: rgb(75, 85, 99);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.error-content {
			padding: 2rem 1.5rem;
		}

		.error-title {
			font-size: 1.5rem;
		}

		.error-actions {
			flex-direction: column;
			width: 100%;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
			justify-content: center;
		}
	}
</style>
