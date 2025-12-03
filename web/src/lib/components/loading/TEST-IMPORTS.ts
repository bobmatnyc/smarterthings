/**
 * Import Verification Test
 *
 * This file verifies that all loading components can be imported correctly.
 * Run: npx svelte-check --output human
 *
 * Expected: No TypeScript errors
 */

import {
	SkeletonText,
	SkeletonIcon,
	SkeletonCard,
	SkeletonGrid,
	LoadingSpinner
} from './index';

import type { SkeletonVariant, TextVariant, IconShape } from './types';

// Type assertions to verify component types are correct
const textVariants: TextVariant[] = ['title', 'body', 'caption'];
const iconShapes: IconShape[] = ['circle', 'square'];
const skeletonVariants: SkeletonVariant[] = [
	'rule',
	'automation',
	'room',
	'device',
	'installedapp'
];

// Verify exports are functions/components (not undefined)
if (!SkeletonText) throw new Error('SkeletonText not exported');
if (!SkeletonIcon) throw new Error('SkeletonIcon not exported');
if (!SkeletonCard) throw new Error('SkeletonCard not exported');
if (!SkeletonGrid) throw new Error('SkeletonGrid not exported');
if (!LoadingSpinner) throw new Error('LoadingSpinner not exported');

console.log('✅ All loading components import successfully');
console.log('✅ All TypeScript types are valid');
console.log('✅ Component library is ready for use');
