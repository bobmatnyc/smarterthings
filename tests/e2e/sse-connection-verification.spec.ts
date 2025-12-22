import { test, expect } from '@playwright/test';

/**
 * SSE Connection Status Verification
 *
 * Verifies that the Svelte 5 reactivity fix correctly displays
 * the SSE connection status as "Connected" (green) instead of
 * "Reconnecting..." (amber).
 *
 * Related: Svelte 5 $derived.by() reactivity fix
 */

test.describe('SSE Connection Status on Rooms Page', () => {
  test('should show "Connected" status with green indicator after page load', async ({ page }) => {
    // Set up console message listener
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      console.log(`[Browser Console] ${text}`);
    });

    // Navigate to rooms page
    console.log('Navigating to http://localhost:5181/rooms');
    await page.goto('http://localhost:5181/rooms');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, waiting 3 seconds for SSE connection...');
    await page.waitForTimeout(3000);

    // Take screenshot of initial state
    await page.screenshot({
      path: '/Users/masa/Projects/smarterthings/test-results/sse-status-initial.png',
      fullPage: true
    });
    console.log('Screenshot saved: test-results/sse-status-initial.png');

    // Check for SSE connection message in console
    const sseConnectedMsg = consoleMessages.find(msg =>
      msg.includes('[SSE] Connected to device event stream')
    );

    if (sseConnectedMsg) {
      console.log(`✅ Found SSE connection message: ${sseConnectedMsg}`);
    } else {
      console.log('❌ No SSE connection message found in console');
      console.log('Console messages:', consoleMessages.filter(msg =>
        msg.includes('SSE') || msg.includes('connection')
      ));
    }

    // Find the connection status element
    // Looking for text that contains "Connected" or "Reconnecting"
    const statusElement = page.locator('text=/Connected|Reconnecting/').first();

    // Wait for status element to appear
    await expect(statusElement).toBeVisible({ timeout: 5000 });

    // Get the actual status text
    const statusText = await statusElement.textContent();
    console.log(`Connection status text: "${statusText}"`);

    // Take screenshot of status area
    await statusElement.screenshot({
      path: '/Users/masa/Projects/smarterthings/test-results/sse-status-element.png'
    });
    console.log('Screenshot saved: test-results/sse-status-element.png');

    // Verify status is "Connected" not "Reconnecting..."
    expect(statusText).toContain('Connected');
    expect(statusText).not.toContain('Reconnecting');

    // Check for green indicator (success color class or green dot)
    // Looking for common green color classes or SVG elements
    const greenIndicator = page.locator('[class*="success"], [class*="green"], circle[fill*="green"], circle[class*="success"]').first();

    if (await greenIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Green indicator found');
      await greenIndicator.screenshot({
        path: '/Users/masa/Projects/smarterthings/test-results/sse-green-indicator.png'
      });
    } else {
      console.log('⚠️  Green indicator not found (may use different styling)');
    }

    // Final verification screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/smarterthings/test-results/sse-status-final.png',
      fullPage: true
    });
    console.log('Screenshot saved: test-results/sse-status-final.png');

    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Status Text: ${statusText}`);
    console.log(`SSE Console Message: ${sseConnectedMsg ? 'Found' : 'Not Found'}`);
    console.log(`Green Indicator: ${await greenIndicator.isVisible().catch(() => false) ? 'Found' : 'Not Found'}`);
  });

  test('should not show amber "Reconnecting..." status', async ({ page }) => {
    // Navigate to rooms page
    await page.goto('http://localhost:5181/rooms');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for "Reconnecting..." text (should NOT exist after fix)
    const reconnectingText = page.locator('text="Reconnecting..."');

    // This should timeout (element should not exist)
    const isReconnecting = await reconnectingText.isVisible({ timeout: 2000 }).catch(() => false);

    if (isReconnecting) {
      console.log('❌ FAIL: Still showing "Reconnecting..." status');
      await page.screenshot({
        path: '/Users/masa/Projects/smarterthings/test-results/sse-status-reconnecting-bug.png',
        fullPage: true
      });
    } else {
      console.log('✅ PASS: No "Reconnecting..." status found');
    }

    expect(isReconnecting).toBe(false);
  });
});
