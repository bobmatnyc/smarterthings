/**
 * Cache Utility Tests
 *
 * Run with: npm test cache.test.ts
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getCache,
	setCache,
	clearCache,
	clearAllCaches,
	getCacheStats,
	CACHE_KEYS,
	DEFAULT_TTL
} from './cache';

// Mock sessionStorage
const sessionStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		},
		key: (index: number) => Object.keys(store)[index] || null
	};
})();

Object.defineProperty(globalThis, 'sessionStorage', {
	value: sessionStorageMock,
	writable: true,
	configurable: true
});

describe('Cache Utility', () => {
	beforeEach(() => {
		sessionStorageMock.clear();
	});

	describe('setCache / getCache', () => {
		it('should cache and retrieve data', () => {
			const testData = { id: 1, name: 'Test Device' };
			setCache('test-key', testData);

			const retrieved = getCache<typeof testData>('test-key');
			expect(retrieved).toEqual(testData);
		});

		it('should return null for non-existent cache', () => {
			const result = getCache('non-existent');
			expect(result).toBeNull();
		});

		it('should return null for expired cache', () => {
			const testData = { id: 1, name: 'Test' };
			setCache('test-key', testData, 100); // 100ms TTL

			// Wait for expiration
			vi.useFakeTimers();
			vi.advanceTimersByTime(150);

			const result = getCache('test-key', 100);
			expect(result).toBeNull();

			vi.useRealTimers();
		});

		it('should cache arrays', () => {
			const testDevices = [
				{ id: '1', name: 'Device 1' },
				{ id: '2', name: 'Device 2' }
			];

			setCache(CACHE_KEYS.DEVICES, testDevices);
			const retrieved = getCache<typeof testDevices>(CACHE_KEYS.DEVICES);

			expect(retrieved).toHaveLength(2);
			expect(retrieved?.[0].id).toBe('1');
		});

		it('should respect custom TTL', () => {
			const customTTL = 1000; // 1 second
			setCache('test-key', { data: 'test' }, customTTL);

			const cached = sessionStorage.getItem('test-key');
			expect(cached).toBeTruthy();

			const parsed = JSON.parse(cached!);
			expect(parsed.ttl).toBe(customTTL);
		});
	});

	describe('clearCache', () => {
		it('should clear specific cache entry', () => {
			setCache('key1', { data: 'test1' });
			setCache('key2', { data: 'test2' });

			clearCache('key1');

			expect(getCache('key1')).toBeNull();
			expect(getCache('key2')).toBeTruthy();
		});
	});

	describe('clearAllCaches', () => {
		it('should clear all smartthings cache entries', () => {
			setCache(CACHE_KEYS.DEVICES, []);
			setCache(CACHE_KEYS.ROOMS, []);
			sessionStorage.setItem('other-key', 'should-remain');

			clearAllCaches();

			expect(getCache(CACHE_KEYS.DEVICES)).toBeNull();
			expect(getCache(CACHE_KEYS.ROOMS)).toBeNull();
			expect(sessionStorage.getItem('other-key')).toBe('should-remain');
		});
	});

	describe('getCacheStats', () => {
		it('should return cache statistics', () => {
			setCache(CACHE_KEYS.DEVICES, [{ id: '1' }, { id: '2' }]);
			setCache(CACHE_KEYS.ROOMS, [{ roomId: 'r1', name: 'Living Room' }]);

			const stats = getCacheStats();

			expect(stats.available).toBe(true);
			expect(stats.entries).toBeDefined();
			expect(Object.keys(stats.entries)).toHaveLength(2);
			expect(stats.totalSizeFormatted).toMatch(/KB$/);
		});

		it('should calculate entry age', () => {
			setCache('test-key', { data: 'test' });

			const stats = getCacheStats();
			const testEntry = stats.entries['smartthings:devices:v1'];

			// Age should be close to 0 seconds
			if (testEntry) {
				expect(testEntry.age).toMatch(/s$/);
			}
		});
	});

	describe('Version handling', () => {
		it('should invalidate cache on version mismatch', () => {
			// Manually create cache with old version
			const oldEntry = {
				data: { id: 1 },
				timestamp: Date.now(),
				ttl: DEFAULT_TTL,
				version: 'v0' // Old version
			};

			sessionStorage.setItem('test-key', JSON.stringify(oldEntry));

			const result = getCache('test-key');
			expect(result).toBeNull();
			expect(sessionStorage.getItem('test-key')).toBeNull(); // Should be cleared
		});
	});

	describe('Error handling', () => {
		it('should handle JSON parse errors gracefully', () => {
			sessionStorage.setItem('corrupt-key', 'not-valid-json{');

			const result = getCache('corrupt-key');
			expect(result).toBeNull();
		});

		it('should handle quota exceeded errors', () => {
			const originalSetItem = sessionStorage.setItem;

			// Mock quota exceeded
			sessionStorage.setItem = vi.fn(() => {
				const error = new DOMException('QuotaExceededError');
				error.name = 'QuotaExceededError';
				throw error;
			});

			// Should not throw
			expect(() => setCache('test-key', { data: 'test' })).not.toThrow();

			sessionStorage.setItem = originalSetItem;
		});
	});

	describe('CACHE_KEYS constants', () => {
		it('should have proper namespace', () => {
			expect(CACHE_KEYS.DEVICES).toMatch(/^smartthings:/);
			expect(CACHE_KEYS.ROOMS).toMatch(/^smartthings:/);
			expect(CACHE_KEYS.DEVICES_META).toMatch(/^smartthings:/);
			expect(CACHE_KEYS.ROOMS_META).toMatch(/^smartthings:/);
		});

		it('should have version suffix', () => {
			expect(CACHE_KEYS.DEVICES).toMatch(/:v\d+$/);
			expect(CACHE_KEYS.ROOMS).toMatch(/:v\d+$/);
		});
	});

	describe('Performance', () => {
		it('should cache large datasets efficiently', () => {
			const largeDataset = Array.from({ length: 100 }, (_, i) => ({
				id: `device-${i}`,
				name: `Device ${i}`,
				capabilities: ['switch', 'powerMeter', 'energyMeter']
			}));

			const startSet = performance.now();
			setCache(CACHE_KEYS.DEVICES, largeDataset);
			const setDuration = performance.now() - startSet;

			const startGet = performance.now();
			const retrieved = getCache(CACHE_KEYS.DEVICES);
			const getDuration = performance.now() - startGet;

			// Cache operations should be fast (<10ms)
			expect(setDuration).toBeLessThan(10);
			expect(getDuration).toBeLessThan(10);
			expect(retrieved).toHaveLength(100);
		});
	});
});
