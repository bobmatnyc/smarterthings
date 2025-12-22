import { test, expect } from '@playwright/test';

/**
 * SSE Connection Status Verification on Rooms Page
 *
 * Purpose: Verify that the SSE connection status fix works on the /rooms route.
 * The fix moved SSE initialization from DeviceListContainer.svelte to +layout.svelte,
 * so SSE should now be connected on all routes including /rooms.
 *
 * Related: docs/research/sse-connection-status-bug-analysis-2025-12-21.md
 */

test.describe('SSE Connection Status on Rooms Page', () => {
  test('should show Connected status after SSE connects', async ({ page }) => {
    // Enable console logging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[Browser Console] ${text}`);
    });

    // Navigate to /rooms
    console.log('Navigating to /rooms...');
    await page.goto('/rooms', { waitUntil: 'domcontentloaded' });

    // Wait for page to fully load (but don't wait for networkidle as SSE keeps connection open)
    console.log('Waiting for page load...');
    await page.waitForLoadState('load');

    // Wait for SSE connection (3-4 seconds as per test requirements)
    console.log('Waiting 4 seconds for SSE connection...');
    await page.waitForTimeout(4000);

    // Check for SSE connection message in console
    const sseConnected = consoleLogs.some(log =>
      log.includes('[SSE] Connected to device event stream') ||
      log.includes('SSE Connected')
    );
    console.log(`SSE connection message found: ${sseConnected}`);

    // Take screenshot before checking status
    await page.screenshot({
      path: 'test-results/sse-rooms-before-check.png',
      fullPage: true
    });

    // Find the connection status indicator
    // Looking for the ConnectionStatus component in the navigation bar
    const statusIndicator = page.locator('.connection-status');

    // Wait for the status indicator to be visible
    await expect(statusIndicator).toBeVisible({ timeout: 5000 });

    // Get the current status text
    const statusText = await statusIndicator.locator('.status-text').textContent();
    console.log(`Current status: ${statusText}`);

    // Take screenshot after status check
    await page.screenshot({
      path: 'test-results/sse-rooms-status-check.png',
      fullPage: true
    });

    // Check if status is "Connected" (green)
    if (statusText?.includes('Connected')) {
      console.log('✅ Status is "Connected"');

      // Verify the indicator has connected/green styling
      const indicatorClasses = await statusIndicator.getAttribute('class');
      console.log(`Indicator classes: ${indicatorClasses}`);

      // Should have .connected class
      expect(indicatorClasses).toContain('connected');
    } else if (statusText?.includes('Reconnecting')) {
      console.log('⚠️  Status is "Reconnecting" (amber)');
      console.log('This indicates the SSE fix may not be working correctly.');
    } else if (statusText?.includes('Disconnected')) {
      console.log('❌ Status is "Disconnected" (red)');
      console.log('This indicates SSE is not connected at all.');
    }

    // Print all console logs for debugging
    console.log('\n=== All Browser Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    // Final verification: Status should be "Connected"
    expect(statusText).toMatch(/Connected/i);
    expect(statusText).not.toMatch(/Reconnecting|Disconnected/i);

    // Take final screenshot as evidence
    await page.screenshot({
      path: 'test-results/sse-rooms-final-evidence.png',
      fullPage: true
    });

    console.log('\n=== Test Result ===');
    console.log(`Status shown: ${statusText}`);
    console.log(`SSE console message: ${sseConnected ? 'YES' : 'NO'}`);
    console.log('Screenshots saved to test-results/');
  });

  test('should display rooms page content correctly', async ({ page }) => {
    await page.goto('/rooms', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    // Verify rooms page is displayed
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    const headingText = await heading.textContent();
    console.log(`Page heading: ${headingText}`);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/sse-rooms-page-content.png',
      fullPage: true
    });
  });
});
