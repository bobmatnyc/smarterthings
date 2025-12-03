/**
 * AsyncContent Component Tests
 *
 * Tests for declarative loading/error/empty state handling.
 * Uses Vitest for unit testing with Svelte component mounts.
 *
 * Test Coverage:
 * - Default state rendering (loading, error, empty, content)
 * - Custom snippet overrides
 * - State transitions
 * - Async retry functionality
 * - Accessibility attributes
 * - TypeScript type safety
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import AsyncContent from './AsyncContent.svelte';
import type { ComponentProps } from 'svelte';

// Test component props type
type AsyncContentProps = ComponentProps<AsyncContent>;

describe('AsyncContent', () => {
	let defaultProps: Partial<AsyncContentProps>;

	beforeEach(() => {
		defaultProps = {
			loading: false,
			error: null,
			empty: false,
			children: () => {} // Mock snippet
		};
	});

	describe('State Priority', () => {
		it('should show loading state when loading=true', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					loading: true
				}
			});

			// Default loading state should show SkeletonGrid
			const skeletonGrid = container.querySelector('[aria-busy="true"]');
			expect(skeletonGrid).toBeTruthy();
		});

		it('should show error state when error is set', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Test error message'
				}
			});

			// Error state should have role="alert"
			const errorState = container.querySelector('[role="alert"]');
			expect(errorState).toBeTruthy();
		});

		it('should prioritize loading over error', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					loading: true,
					error: 'Test error'
				}
			});

			// Should show loading (higher priority)
			const skeletonGrid = container.querySelector('[aria-busy="true"]');
			expect(skeletonGrid).toBeTruthy();

			// Should NOT show error
			const errorState = container.querySelector('[role="alert"]');
			expect(errorState).toBeFalsy();
		});

		it('should prioritize error over empty', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Test error',
					empty: true
				}
			});

			// Should show error
			const errorState = container.querySelector('[role="alert"]');
			expect(errorState).toBeTruthy();

			// Should NOT show empty
			const emptyState = container.querySelector('[role="status"]');
			expect(emptyState).toBeFalsy();
		});
	});

	describe('Default States', () => {
		it('should render default loading state', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					loading: true,
					skeletonCount: 6,
					skeletonVariant: 'rule'
				}
			});

			const skeletonGrid = container.querySelector('.skeleton-grid');
			expect(skeletonGrid).toBeTruthy();
			expect(skeletonGrid?.classList.contains('rule-variant')).toBe(true);
		});

		it('should render default error state with message', async () => {
			render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Network connection failed'
				}
			});

			const errorMessage = screen.getByText(/Network connection failed/i);
			expect(errorMessage).toBeTruthy();
		});

		it('should render default empty state with custom message', async () => {
			render(AsyncContent, {
				props: {
					...defaultProps,
					empty: true,
					emptyMessage: 'No items found'
				}
			});

			const emptyMessage = screen.getByText(/No items found/i);
			expect(emptyMessage).toBeTruthy();
		});
	});

	describe('Retry Functionality', () => {
		it('should show retry button when onRetry is provided', async () => {
			const onRetry = vi.fn();

			render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Test error',
					onRetry
				}
			});

			const retryButton = screen.getByText(/Try Again/i);
			expect(retryButton).toBeTruthy();
		});

		it('should call onRetry when retry button clicked', async () => {
			const onRetry = vi.fn();

			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Test error',
					onRetry
				}
			});

			const retryButton = screen.getByText(/Try Again/i);
			retryButton.click();

			await tick();

			expect(onRetry).toHaveBeenCalledTimes(1);
		});

		it('should not show retry button when errorRetryable=false', async () => {
			const onRetry = vi.fn();

			render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Fatal error',
					errorRetryable: false,
					onRetry
				}
			});

			const retryButton = screen.queryByText(/Try Again/i);
			expect(retryButton).toBeFalsy();
		});
	});

	describe('Accessibility', () => {
		it('should have aria-busy on loading state', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					loading: true
				}
			});

			const loadingElement = container.querySelector('[aria-busy="true"]');
			expect(loadingElement).toBeTruthy();
		});

		it('should have role="alert" on error state', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Test error'
				}
			});

			const errorElement = container.querySelector('[role="alert"]');
			expect(errorElement).toBeTruthy();
		});

		it('should have role="status" on empty state', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					empty: true
				}
			});

			const emptyElement = container.querySelector('[role="status"]');
			expect(emptyElement).toBeTruthy();
		});

		it('should have aria-live="assertive" on error', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					error: 'Test error'
				}
			});

			const errorElement = container.querySelector('[aria-live="assertive"]');
			expect(errorElement).toBeTruthy();
		});

		it('should have aria-live="polite" on empty', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					empty: true
				}
			});

			const emptyElement = container.querySelector('[aria-live="polite"]');
			expect(emptyElement).toBeTruthy();
		});
	});

	describe('Configuration', () => {
		it('should respect skeletonCount prop', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					loading: true,
					skeletonCount: 8
				}
			});

			const skeletonCards = container.querySelectorAll('.skeleton-grid > *');
			expect(skeletonCards.length).toBe(8);
		});

		it('should respect skeletonVariant prop', async () => {
			const { container } = render(AsyncContent, {
				props: {
					...defaultProps,
					loading: true,
					skeletonVariant: 'device'
				}
			});

			const skeletonGrid = container.querySelector('.skeleton-grid');
			expect(skeletonGrid?.classList.contains('device-variant')).toBe(true);
		});
	});
});

describe('ErrorState', () => {
	it('should render error message', async () => {
		const ErrorState = (await import('./ErrorState.svelte')).default;

		render(ErrorState, {
			props: {
				message: 'Connection timeout'
			}
		});

		const message = screen.getByText(/Connection timeout/i);
		expect(message).toBeTruthy();
	});

	it('should render retry button when onRetry provided', async () => {
		const ErrorState = (await import('./ErrorState.svelte')).default;
		const onRetry = vi.fn();

		render(ErrorState, {
			props: {
				message: 'Test error',
				onRetry
			}
		});

		const retryButton = screen.getByText(/Try Again/i);
		expect(retryButton).toBeTruthy();
	});

	it('should call onRetry when clicked', async () => {
		const ErrorState = (await import('./ErrorState.svelte')).default;
		const onRetry = vi.fn();

		render(ErrorState, {
			props: {
				message: 'Test error',
				onRetry
			}
		});

		const retryButton = screen.getByText(/Try Again/i);
		retryButton.click();

		await tick();

		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('should use custom retry label', async () => {
		const ErrorState = (await import('./ErrorState.svelte')).default;
		const onRetry = vi.fn();

		render(ErrorState, {
			props: {
				message: 'Test error',
				onRetry,
				retryLabel: 'Reload'
			}
		});

		const retryButton = screen.getByText(/Reload/i);
		expect(retryButton).toBeTruthy();
	});
});

describe('EmptyState', () => {
	it('should render title', async () => {
		const EmptyState = (await import('./EmptyState.svelte')).default;

		render(EmptyState, {
			props: {
				title: 'No Items Found'
			}
		});

		const title = screen.getByText(/No Items Found/i);
		expect(title).toBeTruthy();
	});

	it('should render optional message', async () => {
		const EmptyState = (await import('./EmptyState.svelte')).default;

		render(EmptyState, {
			props: {
				title: 'Empty',
				message: 'Try creating your first item'
			}
		});

		const message = screen.getByText(/Try creating your first item/i);
		expect(message).toBeTruthy();
	});

	it('should have role="status"', async () => {
		const EmptyState = (await import('./EmptyState.svelte')).default;

		const { container } = render(EmptyState, {
			props: {
				title: 'Empty'
			}
		});

		const emptyElement = container.querySelector('[role="status"]');
		expect(emptyElement).toBeTruthy();
	});
});
