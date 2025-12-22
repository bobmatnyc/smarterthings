import { test, expect, type Page } from '@playwright/test';
import { join } from 'path';

// Test data - Lutron device details
const LUTRON_DEVICE_NAME = 'AR Lights';
const ROOM_NAME = "Autumn's Room";

// Screenshot directory
const screenshotDir = join(process.cwd(), 'test-results', 'ui-verification');

test.describe('UI Verification Tests', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let networkRequests: Array<{ url: string; method: string; status?: number; response?: any }> = [];

  test.beforeEach(async ({ page }) => {
    // Clear logs
    consoleLogs = [];
    consoleErrors = [];
    networkRequests = [];

    // Capture console logs
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture network requests
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
        });
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        const request = networkRequests.find(
          (req) => req.url === response.url() && !req.status
        );
        if (request) {
          request.status = response.status();
          try {
            request.response = await response.json();
          } catch {
            request.response = await response.text();
          }
        }
      }
    });
  });

  test('1. Lutron Device Toggle - Verify 422 Error Fix', async ({ page }) => {
    console.log('\n=== Test 1: Lutron Device Toggle ===\n');

    // Navigate to home page
    await page.goto('http://localhost:5181');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({
      path: join(screenshotDir, '01-home-page.png'),
      fullPage: true
    });

    // Find the Lutron device card
    console.log(`Looking for device: "${LUTRON_DEVICE_NAME}" in room "${ROOM_NAME}"`);

    // Wait for devices to load
    await page.waitForSelector('[data-testid="device-card"], .device-card', { timeout: 10000 });

    // Find the specific device card
    const deviceCard = page.locator('[data-testid="device-card"], .device-card').filter({
      hasText: LUTRON_DEVICE_NAME
    }).filter({
      hasText: ROOM_NAME
    }).first();

    // Verify device card exists
    await expect(deviceCard).toBeVisible({ timeout: 10000 });

    // Take screenshot of device card
    await deviceCard.screenshot({
      path: join(screenshotDir, '02-lutron-device-card.png')
    });

    // Find the toggle switch within the device card
    const toggleSwitch = deviceCard.locator('input[type="checkbox"], button[role="switch"], .toggle, [data-testid="device-toggle"]').first();

    // Get current state
    const isChecked = await toggleSwitch.isChecked().catch(() => false);
    console.log(`Current toggle state: ${isChecked ? 'ON' : 'OFF'}`);

    // Clear previous network requests
    networkRequests = [];

    // Toggle the device ON
    console.log('Toggling device ON...');
    await toggleSwitch.click();

    // Wait for network request to complete
    await page.waitForTimeout(2000);

    // Take screenshot after toggle
    await page.screenshot({
      path: join(screenshotDir, '03-after-toggle.png'),
      fullPage: true
    });

    // Find the device toggle request
    const toggleRequest = networkRequests.find(req =>
      req.url.includes('/devices/') &&
      (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
    );

    console.log('\n--- Network Request Analysis ---');
    if (toggleRequest) {
      console.log(`Request URL: ${toggleRequest.url}`);
      console.log(`Request Method: ${toggleRequest.method}`);
      console.log(`Response Status: ${toggleRequest.status}`);
      console.log(`Response Body:`, JSON.stringify(toggleRequest.response, null, 2));

      // Verify no 422 error
      expect(toggleRequest.status).not.toBe(422);

      if (toggleRequest.status === 422) {
        console.error('\n❌ FAILED: Still receiving 422 ConstraintViolationError');
      } else if (toggleRequest.status === 200) {
        console.log('\n✅ PASSED: Toggle command succeeded with 200 OK');
      } else {
        console.log(`\n⚠️  Unexpected status: ${toggleRequest.status}`);
      }
    } else {
      console.log('⚠️  No device toggle request found in network logs');
    }

    // Check for console errors
    console.log('\n--- Console Error Analysis ---');
    const relevantErrors = consoleErrors.filter(err =>
      err.includes('422') ||
      err.includes('ConstraintViolation') ||
      err.includes('device') ||
      err.includes('toggle')
    );

    if (relevantErrors.length > 0) {
      console.log('Console Errors Found:');
      relevantErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No relevant console errors detected');
    }

    // Verify toggle succeeded
    if (toggleRequest) {
      expect(toggleRequest.status).toBe(200);
    }
  });

  test('2. Rooms Page SSE Connection - Verify Connection Status', async ({ page }) => {
    console.log('\n=== Test 2: Rooms Page SSE Connection ===\n');

    // Navigate to rooms page
    await page.goto('http://localhost:5181/rooms');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({
      path: join(screenshotDir, '04-rooms-page.png'),
      fullPage: true
    });

    // Wait for SSE connection to establish (give it some time)
    await page.waitForTimeout(3000);

    // Look for connection status indicator
    // Common patterns: "Connected", "Disconnected", "Reconnecting..."
    const statusIndicators = [
      '[data-testid="connection-status"]',
      '[data-testid="sse-status"]',
      '.connection-status',
      '.sse-status',
      'text=/connected|disconnected|reconnecting/i'
    ];

    let statusElement = null;
    for (const selector of statusIndicators) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        statusElement = element;
        break;
      }
    }

    if (statusElement) {
      const statusText = await statusElement.textContent();
      console.log(`Connection Status Indicator: "${statusText}"`);

      await statusElement.screenshot({
        path: join(screenshotDir, '05-connection-status.png')
      });

      // Verify status is "Connected" and not "Reconnecting..."
      expect(statusText?.toLowerCase()).toContain('connected');
      expect(statusText?.toLowerCase()).not.toContain('reconnecting');

      if (statusText?.toLowerCase().includes('reconnecting')) {
        console.log('❌ FAILED: Status shows "Reconnecting..." instead of "Connected"');
      } else if (statusText?.toLowerCase().includes('connected')) {
        console.log('✅ PASSED: Status shows "Connected"');
      }
    } else {
      console.log('⚠️  No connection status indicator found on page');
    }

    // Check console logs for SSE connection messages
    console.log('\n--- SSE Console Log Analysis ---');
    const sseConnectedLog = consoleLogs.find(log =>
      log.includes('[SSE]') && log.includes('Connected to device event stream')
    );

    const sseErrorLogs = consoleLogs.filter(log =>
      log.includes('[SSE]') && (log.includes('error') || log.includes('failed'))
    );

    if (sseConnectedLog) {
      console.log('✅ Found SSE connection log:', sseConnectedLog);
    } else {
      console.log('⚠️  No SSE connection success log found');
    }

    if (sseErrorLogs.length > 0) {
      console.log('❌ SSE Error Logs Found:');
      sseErrorLogs.forEach(log => console.log(`  - ${log}`));
    } else {
      console.log('✅ No SSE error logs detected');
    }

    // Check for SSE EventSource in network
    const sseRequest = networkRequests.find(req =>
      req.url.includes('/events') || req.url.includes('/sse')
    );

    if (sseRequest) {
      console.log('\n--- SSE Network Request ---');
      console.log(`SSE Endpoint: ${sseRequest.url}`);
      console.log(`Status: ${sseRequest.status || 'Pending/Open'}`);
    }

    // Take final screenshot
    await page.screenshot({
      path: join(screenshotDir, '06-rooms-page-final.png'),
      fullPage: true
    });

    // Verify SSE connection is established
    expect(sseConnectedLog || sseRequest).toBeTruthy();
  });

  test.afterEach(async () => {
    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Total Console Logs: ${consoleLogs.length}`);
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Network Requests: ${networkRequests.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nAll Console Errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }

    console.log('\nAll Network Requests:');
    networkRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} -> ${req.status || 'pending'}`);
    });
  });
});
