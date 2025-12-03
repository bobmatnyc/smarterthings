/**
 * Loading Components - Barrel Export
 *
 * Centralized export for all loading skeleton components.
 * Provides clean import syntax across the application.
 *
 * Usage:
 *   import { SkeletonGrid, LoadingSpinner } from '$lib/components/loading';
 *
 * Design Philosophy:
 * - Single source of truth for loading states
 * - Consistent visual language across all pages
 * - WCAG 2.1 AA accessibility compliance
 * - Reduced motion support built-in
 *
 * Components:
 * - SkeletonText: Text line placeholders
 * - SkeletonIcon: Icon placeholders
 * - SkeletonCard: Entity card placeholders
 * - SkeletonGrid: Grid layout with multiple skeleton cards
 * - LoadingSpinner: Inline spinner for buttons/forms
 *
 * Performance:
 * - All components use CSS-only animations (no JS overhead)
 * - GPU-accelerated animations via transform properties
 * - Minimal DOM nodes for fast rendering
 *
 * Accessibility:
 * - ARIA attributes on all components
 * - Screen reader announcements via aria-live regions
 * - Respects prefers-reduced-motion user preference
 * - WCAG AA color contrast compliance
 */

export { default as SkeletonText } from './SkeletonText.svelte';
export { default as SkeletonIcon } from './SkeletonIcon.svelte';
export { default as SkeletonCard } from './SkeletonCard.svelte';
export { default as SkeletonGrid } from './SkeletonGrid.svelte';
export { default as LoadingSpinner } from './LoadingSpinner.svelte';
export { default as AsyncContent } from './AsyncContent.svelte';
export { default as ErrorState } from './ErrorState.svelte';
export { default as EmptyState } from './EmptyState.svelte';

export type { SkeletonVariant, TextVariant, IconShape } from './types';
