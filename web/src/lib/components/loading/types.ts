/**
 * Loading Skeleton Component Types
 *
 * Type definitions for all loading skeleton components.
 * These types ensure type safety across the loading component library.
 */

/**
 * Skeleton card variants matching different entity types
 */
export type SkeletonVariant =
	| 'rule'
	| 'automation'
	| 'room'
	| 'device'
	| 'installedapp';

/**
 * Text skeleton variants for different typography sizes
 */
export type TextVariant = 'title' | 'body' | 'caption';

/**
 * Icon shape variants for skeleton placeholders
 */
export type IconShape = 'circle' | 'square';
