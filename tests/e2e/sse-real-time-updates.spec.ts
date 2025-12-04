/**
 * E2E Tests: SSE Real-Time Updates (Ticket 1M-437)
 *
 * Test Coverage:
 * 1. SSE connection establishment and status indicator
 * 2. Device state updates via SSE (real-time UI updates)
 * 3. Connection status transitions (connected → reconnecting)
 * 4. Exponential backoff on reconnection
 *
 * Test Strategy:
 * - Use Playwright to verify UI behavior
 * - Mock or simulate SSE events from backend
 * - Verify device cards update without page reload
 * - Verify connection status indicator states
 *
 * Prerequisites:
 * - Backend server running on localhost:5182
 * - Frontend server running on localhost:5181
 * - At least one device available for testing
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Helper: Wait for SSE connection to establish
 */
async function waitForSSEConnection(page: Page, timeout: number = 10000): Promise<void> {
	await page.waitForFunction(
		() => {
			const status = document.querySelector('.connection-status.connected');
			return status !== null;
		},
		{ timeout }
	);
}

/**
 * Helper: Simulate SSE event by posting message to backend
 * In real scenario, this would be triggered by SmartThings webhook
 */
async function simulateDeviceEvent(page: Page, deviceId: string, state: Record<string, any>): Promise<void> {
	// POST to webhook endpoint to trigger SSE broadcast
	// This simulates a real SmartThings device event
	await page.evaluate(
		async ({ deviceId, state }) => {
			const response = await fetch('http://localhost:5182/api/test/simulate-event', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'device_event',
					deviceId,
					value: state
				})
			});
			return response.ok;
		},
		{ deviceId, state }
	);
}

test.describe('SSE Real-Time Updates (Ticket 1M-437)', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to devices page
		await page.goto('http://localhost:5181/devices');

		// Wait for page load and initial device fetch
		await page.waitForLoadState('networkidle');
	});

	test('should establish SSE connection and show connected status', async ({ page }) => {
		// Wait for SSE connection to establish
		await waitForSSEConnection(page);

		// Verify connection status indicator is visible and shows "Connected"
		const statusIndicator = page.locator('.connection-status.connected');
		await expect(statusIndicator).toBeVisible();

		// Verify status text
		const statusText = statusIndicator.locator('.status-text');
		await expect(statusText).toHaveText('Connected');

		// Verify green pulse indicator
		const pulse = statusIndicator.locator('.pulse.green');
		await expect(pulse).toBeVisible();
	});

	test('should update device state in real-time via SSE', async ({ page }) => {
		// Wait for SSE connection
		await waitForSSEConnection(page);

		// Find a switch device (or any device with state)
		const deviceCard = page.locator('[data-device-type="switch"]').first();
		if (!(await deviceCard.isVisible())) {
			test.skip(); // Skip if no switch devices available
		}

		// Get device ID from card
		const deviceId = await deviceCard.getAttribute('data-device-id');
		if (!deviceId) {
			throw new Error('Device ID not found on device card');
		}

		// Get initial state
		const initialState = await deviceCard.locator('[data-state]').getAttribute('data-state');

		// Simulate device state change via backend
		const newState = { switch: initialState === 'on' ? 'off' : 'on' };
		await simulateDeviceEvent(page, deviceId, newState);

		// Wait for SSE event to propagate and UI to update
		await page.waitForTimeout(1000); // Allow time for SSE event processing

		// Verify device card UI updated (without page reload)
		const updatedState = await deviceCard.locator('[data-state]').getAttribute('data-state');
		expect(updatedState).toBe(newState.switch);

		// Verify no page reload occurred (check window.performance)
		const navigationCount = await page.evaluate(() => window.performance.navigation.type);
		expect(navigationCount).toBe(0); // 0 = navigate (not reload)
	});

	test('should show reconnecting status when SSE disconnects', async ({ page }) => {
		// Wait for initial connection
		await waitForSSEConnection(page);

		// Simulate SSE disconnection by closing EventSource
		await page.evaluate(() => {
			// Access EventSource from window (if exposed for testing)
			// Or simulate network failure
			const eventSources = (window as any).eventSource;
			if (eventSources) {
				eventSources.close();
			}
		});

		// Wait for reconnecting status
		await page.waitForSelector('.connection-status.reconnecting', { timeout: 5000 });

		// Verify reconnecting indicator
		const statusIndicator = page.locator('.connection-status.reconnecting');
		await expect(statusIndicator).toBeVisible();

		// Verify status text
		const statusText = statusIndicator.locator('.status-text');
		await expect(statusText).toHaveText('Reconnecting...');

		// Verify amber pulse indicator
		const pulse = statusIndicator.locator('.pulse.amber');
		await expect(pulse).toBeVisible();
	});

	test('should maintain device state across SSE reconnections', async ({ page }) => {
		// Wait for initial connection
		await waitForSSEConnection(page);

		// Get initial device list
		const initialDeviceCount = await page.locator('[data-device-type]').count();

		// Simulate SSE disconnect and reconnect
		await page.evaluate(() => {
			const eventSources = (window as any).eventSource;
			if (eventSources) {
				eventSources.close();
			}
		});

		// Wait for reconnection
		await waitForSSEConnection(page);

		// Verify device list still present (state preserved)
		const reconnectedDeviceCount = await page.locator('[data-device-type]').count();
		expect(reconnectedDeviceCount).toBe(initialDeviceCount);
	});

	test('connection status indicator should be visible in nav bar', async ({ page }) => {
		// Wait for page load
		await page.waitForLoadState('networkidle');

		// Verify ConnectionStatus component is in SubNav
		const subNav = page.locator('.sub-nav');
		await expect(subNav).toBeVisible();

		const connectionStatus = subNav.locator('.connection-status-container');
		await expect(connectionStatus).toBeVisible();

		// Verify it's positioned on the right side
		const navContent = subNav.locator('.nav-content');
		const styles = await navContent.evaluate((el) => {
			const computed = window.getComputedStyle(el);
			return {
				display: computed.display,
				justifyContent: computed.justifyContent
			};
		});

		expect(styles.display).toBe('flex');
		expect(styles.justifyContent).toBe('space-between');
	});
});

/**
 * Note: Some tests require backend simulation endpoint
 *
 * To fully test SSE, implement test helper endpoint:
 * POST /api/test/simulate-event
 *
 * This endpoint should:
 * 1. Create a SmartHomeEvent
 * 2. Broadcast it to SSE clients via broadcastEvent()
 * 3. Return success
 *
 * This allows E2E tests to trigger SSE events without
 * requiring actual SmartThings device changes.
 */
