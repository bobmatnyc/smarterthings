/**
 * Tests for Squarified Treemap Algorithm
 */

import { describe, it, expect } from 'vitest';
import { computeTreemap, applyGap, type TreemapItem } from './treemap';

describe('Squarified Treemap Algorithm', () => {
	describe('computeTreemap', () => {
		it('should handle empty array', () => {
			const result = computeTreemap([], 800, 600);
			expect(result).toEqual([]);
		});

		it('should handle single item', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 100, label: 'Room A' }
			];

			const result = computeTreemap(items, 800, 600);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: '1',
				x: 0,
				y: 0,
				width: 800,
				height: 600,
				value: 100,
				label: 'Room A'
			});
		});

		it('should divide space proportionally for two items', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 75, label: 'Room A' },
				{ id: '2', value: 25, label: 'Room B' }
			];

			const result = computeTreemap(items, 800, 600);

			expect(result).toHaveLength(2);

			// Total area should equal container area
			const totalArea = result.reduce((sum, rect) => sum + (rect.width * rect.height), 0);
			expect(totalArea).toBeCloseTo(800 * 600, 0);

			// Areas should be proportional to values
			const area1 = result[0].width * result[0].height;
			const area2 = result[1].width * result[1].height;
			expect(area1 / area2).toBeCloseTo(75 / 25, 1);
		});

		it('should create squarish rectangles', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 24, label: 'Living Room' },
				{ id: '2', value: 18, label: 'Bedroom' },
				{ id: '3', value: 12, label: 'Kitchen' },
				{ id: '4', value: 8, label: 'Bath' },
				{ id: '5', value: 6, label: 'Office' },
				{ id: '6', value: 4, label: 'Garage' }
			];

			const result = computeTreemap(items, 1200, 800);

			expect(result).toHaveLength(6);

			// Check that aspect ratios are reasonable (not too elongated)
			result.forEach(rect => {
				const aspectRatio = Math.max(rect.width / rect.height, rect.height / rect.width);
				expect(aspectRatio).toBeLessThan(4); // Should be fairly square
			});
		});

		it('should filter out zero and negative values', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 10, label: 'Room A' },
				{ id: '2', value: 0, label: 'Room B' },
				{ id: '3', value: -5, label: 'Room C' },
				{ id: '4', value: 5, label: 'Room D' }
			];

			const result = computeTreemap(items, 800, 600);

			expect(result).toHaveLength(2);
			expect(result.map(r => r.id)).toEqual(['1', '4']);
		});

		it('should sort items by value (descending)', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 5, label: 'Small' },
				{ id: '2', value: 20, label: 'Large' },
				{ id: '3', value: 10, label: 'Medium' }
			];

			const result = computeTreemap(items, 800, 600);

			// First item should be the largest
			expect(result[0].id).toBe('2');
			expect(result[0].value).toBe(20);
		});

		it('should handle invalid container dimensions', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 100, label: 'Room A' }
			];

			const result = computeTreemap(items, 0, 600);
			expect(result).toEqual([]);

			const result2 = computeTreemap(items, 800, -100);
			expect(result2).toEqual([]);
		});

		it('should preserve metadata', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 100, label: 'Room A', metadata: { custom: 'data' } }
			];

			const result = computeTreemap(items, 800, 600);

			expect(result[0].metadata).toEqual({ custom: 'data' });
		});

		it('should not have overlapping rectangles', () => {
			const items: TreemapItem[] = [
				{ id: '1', value: 10, label: 'A' },
				{ id: '2', value: 20, label: 'B' },
				{ id: '3', value: 15, label: 'C' }
			];

			const result = computeTreemap(items, 800, 600);

			// Check for overlaps
			for (let i = 0; i < result.length; i++) {
				for (let j = i + 1; j < result.length; j++) {
					const rect1 = result[i];
					const rect2 = result[j];

					// Rectangles overlap if they intersect
					const overlapX = !(rect1.x + rect1.width <= rect2.x || rect2.x + rect2.width <= rect1.x);
					const overlapY = !(rect1.y + rect1.height <= rect2.y || rect2.y + rect2.height <= rect1.y);

					expect(overlapX && overlapY).toBe(false);
				}
			}
		});
	});

	describe('applyGap', () => {
		it('should apply gap to rectangles', () => {
			const rectangles = [
				{ id: '1', x: 0, y: 0, width: 100, height: 100, value: 10, label: 'A' },
				{ id: '2', x: 100, y: 0, width: 100, height: 100, value: 10, label: 'B' }
			];

			const result = applyGap(rectangles, 4);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				id: '1',
				x: 2,
				y: 2,
				width: 96,
				height: 96
			});
			expect(result[1]).toMatchObject({
				id: '2',
				x: 102,
				y: 2,
				width: 96,
				height: 96
			});
		});

		it('should handle zero gap', () => {
			const rectangles = [
				{ id: '1', x: 0, y: 0, width: 100, height: 100, value: 10, label: 'A' }
			];

			const result = applyGap(rectangles, 0);

			expect(result[0]).toMatchObject({
				x: 0,
				y: 0,
				width: 100,
				height: 100
			});
		});

		it('should not create negative dimensions', () => {
			const rectangles = [
				{ id: '1', x: 0, y: 0, width: 5, height: 5, value: 10, label: 'A' }
			];

			const result = applyGap(rectangles, 10);

			expect(result[0].width).toBeGreaterThanOrEqual(0);
			expect(result[0].height).toBeGreaterThanOrEqual(0);
		});
	});
});
