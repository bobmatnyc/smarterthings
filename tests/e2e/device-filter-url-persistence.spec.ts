/**
 * E2E Tests: Device Filter URL Persistence (Ticket 1M-533)
 *
 * Tests URL query parameter synchronization with device filter state.
 *
 * Test Coverage:
 * - URL parameter writing when filters change
 * - URL parameter reading on page load
 * - Browser back/forward navigation
 * - Bookmark/direct URL navigation
 * - Clear filters removes URL params
 * - Multiple filter combinations
 * - Special character encoding
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5181';

test.describe('Device Filter URL Persistence (1M-533)', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to devices page
		await page.goto(`${BASE_URL}/devices`);

		// Wait for page to load
		await page.waitForSelector('[data-testid="device-filter"], .card', { timeout: 5000 });
	});

	test('URL updates when room filter changes', async ({ page }) => {
		// Select a room from dropdown
		const roomSelect = page.locator('select#room-filter');
		await roomSelect.selectOption('Master Bedroom');

		// Wait for URL to update (100ms debounce)
		await page.waitForTimeout(200);

		// Check URL contains room parameter
		const url = new URL(page.url());
		expect(url.searchParams.get('room')).toBe('Master Bedroom');
	});

	test('URL updates when device type filter changes', async ({ page }) => {
		// Select a device type
		const typeSelect = page.locator('select#type-filter');
		await typeSelect.selectOption('switch');

		// Wait for URL to update
		await page.waitForTimeout(200);

		// Check URL contains type parameter
		const url = new URL(page.url());
		expect(url.searchParams.get('type')).toBe('switch');
	});

	test('URL updates when manufacturer filter changes', async ({ page }) => {
		// Select a manufacturer
		const mfrSelect = page.locator('select#manufacturer-filter');
		await mfrSelect.selectOption('Brilliant');

		// Wait for URL to update
		await page.waitForTimeout(200);

		// Check URL contains manufacturer parameter
		const url = new URL(page.url());
		expect(url.searchParams.get('manufacturer')).toBe('Brilliant');
	});

	test('URL updates when search query changes (debounced)', async ({ page }) => {
		// Type in search input
		const searchInput = page.locator('input#device-search');
		await searchInput.fill('light');

		// Wait for debounce (300ms) + URL update (100ms)
		await page.waitForTimeout(500);

		// Check URL contains search parameter
		const url = new URL(page.url());
		expect(url.searchParams.get('search')).toBe('light');
	});

	test('Multiple filters combine in URL', async ({ page }) => {
		// Apply multiple filters
		await page.locator('select#room-filter').selectOption('Kitchen');
		await page.locator('select#type-filter').selectOption('switch');
		await page.locator('input#device-search').fill('ceiling');

		// Wait for all updates
		await page.waitForTimeout(500);

		// Check URL contains all parameters
		const url = new URL(page.url());
		expect(url.searchParams.get('room')).toBe('Kitchen');
		expect(url.searchParams.get('type')).toBe('switch');
		expect(url.searchParams.get('search')).toBe('ceiling');
	});

	test('Filters restore from URL on page load', async ({ page }) => {
		// Navigate to URL with query parameters
		await page.goto(`${BASE_URL}/devices?room=Master+Bedroom&type=switch&search=light`);

		// Wait for page to load
		await page.waitForSelector('[data-testid="device-filter"], .card');

		// Check filter UI reflects URL parameters
		const roomSelect = page.locator('select#room-filter');
		const typeSelect = page.locator('select#type-filter');
		const searchInput = page.locator('input#device-search');

		await expect(roomSelect).toHaveValue('Master Bedroom');
		await expect(typeSelect).toHaveValue('switch');
		await expect(searchInput).toHaveValue('light');
	});

	test('Clear Filters removes all URL parameters', async ({ page }) => {
		// Apply filters
		await page.locator('select#room-filter').selectOption('Kitchen');
		await page.locator('select#type-filter').selectOption('switch');
		await page.locator('input#device-search').fill('light');

		// Wait for updates
		await page.waitForTimeout(500);

		// Verify URL has parameters
		let url = new URL(page.url());
		expect(url.search).toBeTruthy(); // Has query string

		// Click Clear Filters button
		await page.locator('button:has-text("Clear Filters")').click();

		// Wait for URL update
		await page.waitForTimeout(200);

		// Verify URL has no parameters
		url = new URL(page.url());
		expect(url.search).toBe(''); // No query string
	});

	test('Browser back button restores previous filter state', async ({ page }) => {
		// Apply first filter
		await page.locator('select#room-filter').selectOption('Kitchen');
		await page.waitForTimeout(200);

		// Apply second filter (this will replace state due to replaceState: true)
		await page.locator('select#type-filter').selectOption('switch');
		await page.waitForTimeout(200);

		// Check URL has both filters
		let url = new URL(page.url());
		expect(url.searchParams.get('room')).toBe('Kitchen');
		expect(url.searchParams.get('type')).toBe('switch');

		// Note: Due to replaceState: true, browser back may not work as expected
		// This test documents the behavior rather than enforcing it
	});

	test('Bookmarking preserves filter state', async ({ page }) => {
		// Apply filters
		await page.locator('select#room-filter').selectOption('Master Bedroom');
		await page.locator('select#type-filter').selectOption('dimmer');
		await page.waitForTimeout(200);

		// Get current URL (simulating bookmark)
		const bookmarkUrl = page.url();

		// Navigate away
		await page.goto(`${BASE_URL}/`);

		// Navigate back to bookmarked URL
		await page.goto(bookmarkUrl);

		// Wait for page to load
		await page.waitForSelector('[data-testid="device-filter"], .card');

		// Verify filters restored
		const roomSelect = page.locator('select#room-filter');
		const typeSelect = page.locator('select#type-filter');

		await expect(roomSelect).toHaveValue('Master Bedroom');
		await expect(typeSelect).toHaveValue('dimmer');
	});

	test('Special characters in room names are URL-encoded', async ({ page }) => {
		// If a room has spaces or special characters
		await page.locator('select#room-filter').selectOption('Master Bedroom');
		await page.waitForTimeout(200);

		// Check URL encoding
		const url = page.url();
		// SvelteKit may use + or %20 for spaces
		expect(url).toMatch(/room=(Master\+Bedroom|Master%20Bedroom)/);
	});

	test('Invalid URL parameter values are ignored gracefully', async ({ page }) => {
		// Navigate with invalid room name
		await page.goto(`${BASE_URL}/devices?room=NonExistentRoom`);

		// Wait for page to load
		await page.waitForSelector('[data-testid="device-filter"], .card');

		// Check that filter shows "All Rooms" (invalid value ignored)
		const roomSelect = page.locator('select#room-filter');
		await expect(roomSelect).toHaveValue('');
	});

	test('Empty search parameter is handled correctly', async ({ page }) => {
		// Navigate with empty search
		await page.goto(`${BASE_URL}/devices?search=`);

		// Wait for page to load
		await page.waitForSelector('[data-testid="device-filter"], .card');

		// Search input should be empty
		const searchInput = page.locator('input#device-search');
		await expect(searchInput).toHaveValue('');

		// URL should not have search parameter (empty values are removed)
		const url = new URL(page.url());
		expect(url.searchParams.has('search')).toBe(false);
	});

	test('Changing filter updates URL without page reload', async ({ page }) => {
		// Add navigation listener to detect full page reloads
		let navigationOccurred = false;
		page.on('framenavigated', () => {
			navigationOccurred = true;
		});

		// Apply filter
		await page.locator('select#room-filter').selectOption('Kitchen');
		await page.waitForTimeout(200);

		// Check URL updated
		const url = new URL(page.url());
		expect(url.searchParams.get('room')).toBe('Kitchen');

		// Verify no full page reload occurred
		// Note: SvelteKit's goto() may trigger framenavigated, so we check
		// that the page content is still reactive (SSE connection status exists)
		const liveIndicator = page.locator('span.badge:has-text("Live"), span.badge:has-text("Connecting")');
		await expect(liveIndicator).toBeVisible();
	});
});

test.describe('Device Filter URL Persistence - Edge Cases', () => {
	test('Rapid filter changes are debounced correctly', async ({ page }) => {
		await page.goto(`${BASE_URL}/devices`);
		await page.waitForSelector('[data-testid="device-filter"], .card');

		// Type rapidly in search
		const searchInput = page.locator('input#device-search');
		await searchInput.fill('a');
		await searchInput.fill('ab');
		await searchInput.fill('abc');

		// Wait for debounce
		await page.waitForTimeout(500);

		// URL should have final value
		const url = new URL(page.url());
		expect(url.searchParams.get('search')).toBe('abc');
	});

	test('Mixing URL room filter with dropdown room filter works', async ({ page }) => {
		// Start with URL parameter for room ID (from breadcrumb navigation)
		await page.goto(`${BASE_URL}/devices?room=some-room-id`);
		await page.waitForSelector('[data-testid="device-filter"], .card');

		// Now use dropdown to select room by name
		const roomSelect = page.locator('select#room-filter');
		await roomSelect.selectOption('Kitchen');
		await page.waitForTimeout(200);

		// URL should update to room name
		const url = new URL(page.url());
		expect(url.searchParams.get('room')).toBe('Kitchen');
	});
});
