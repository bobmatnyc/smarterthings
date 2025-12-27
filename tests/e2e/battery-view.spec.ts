/**
 * E2E Test: Battery View
 *
 * Verifies the battery monitoring page at /battery
 *
 * Test Coverage:
 * - Page loads successfully
 * - Header displays correctly
 * - Console errors are checked
 * - Visual regression with screenshot
 * - Empty state OR device cards are shown
 * - Statistics summary displays when devices exist
 */

import { test, expect } from '@playwright/test';

test.describe('Battery View', () => {
	test('should load battery page without errors', async ({ page }) => {
		// Monitor console for errors
		const consoleErrors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		// Navigate to battery page
		await page.goto('http://localhost:5181/battery');

		// Wait for page to fully load
		await page.waitForLoadState('networkidle');

		// Check page title
		const title = await page.title();
		expect(title).toContain('Battery');

		// Verify header is present
		const header = page.locator('h1', { hasText: 'Battery Monitor' });
		await expect(header).toBeVisible();

		// Verify header description
		const description = page.locator('text=Devices with battery level below 50%');
		await expect(description).toBeVisible();

		// Verify battery emoji icon
		const batteryIcon = page.locator('text=🔋').first();
		await expect(batteryIcon).toBeVisible();

		// Check for console errors
		expect(consoleErrors).toHaveLength(0);

		// Take screenshot for visual verification
		await page.screenshot({
			path: 'test-results/battery-view-page.png',
			fullPage: true
		});
	});

	test('should show empty state OR device cards', async ({ page }) => {
		await page.goto('http://localhost:5181/battery');
		await page.waitForLoadState('networkidle');

		// Wait for loading to complete
		await page.waitForSelector('.battery-page', { state: 'visible' });

		// Check if empty state exists
		const emptyState = page.locator('text=All Batteries Healthy');
		const emptyStateVisible = await emptyState.isVisible().catch(() => false);

		if (emptyStateVisible) {
			// Verify empty state content
			const checkmark = page.locator('text=✅');
			await expect(checkmark).toBeVisible();

			const emptyMessage = page.locator('text=No devices currently have battery levels below 50%');
			await expect(emptyMessage).toBeVisible();

			console.log('✅ Empty state verified: All batteries healthy');
		} else {
			// Verify device cards exist
			const deviceCards = page.locator('.device-grid > div');
			const count = await deviceCards.count();

			expect(count).toBeGreaterThan(0);
			console.log(`✅ Device cards verified: ${count} low battery devices`);

			// Verify statistics summary exists
			const statsTotal = page.locator('text=Total Devices');
			await expect(statsTotal).toBeVisible();

			const statsCritical = page.locator('text=Critical');
			await expect(statsCritical).toBeVisible();

			// Verify at least one battery percentage badge
			const batteryBadge = page.locator('.badge:has-text("%")').first();
			await expect(batteryBadge).toBeVisible();
		}

		// Take screenshot of final state
		await page.screenshot({
			path: 'test-results/battery-view-state.png',
			fullPage: true
		});
	});

	test('should have responsive layout', async ({ page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('http://localhost:5181/battery');
		await page.waitForLoadState('networkidle');

		await page.screenshot({
			path: 'test-results/battery-view-mobile.png',
			fullPage: true
		});

		// Test tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.reload();
		await page.waitForLoadState('networkidle');

		await page.screenshot({
			path: 'test-results/battery-view-tablet.png',
			fullPage: true
		});

		// Test desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.reload();
		await page.waitForLoadState('networkidle');

		await page.screenshot({
			path: 'test-results/battery-view-desktop.png',
			fullPage: true
		});
	});

	test('should verify color-coded battery indicators', async ({ page }) => {
		await page.goto('http://localhost:5181/battery');
		await page.waitForLoadState('networkidle');

		// Check if device cards exist
		const deviceCards = page.locator('.device-grid > div');
		const count = await deviceCards.count();

		if (count > 0) {
			// Verify battery badges have color classes
			const criticalBadge = page.locator('.badge.variant-filled-error').first();
			const warningBadge = page.locator('.badge.variant-filled-warning').first();

			// At least one type of badge should exist
			const criticalExists = await criticalBadge.isVisible().catch(() => false);
			const warningExists = await warningBadge.isVisible().catch(() => false);

			expect(criticalExists || warningExists).toBe(true);

			console.log('✅ Color-coded battery indicators verified');
		}
	});
});
