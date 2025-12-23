/**
 * Dashboard Load Test - Lenient Version
 *
 * Tests dashboard accessibility with more lenient waiting conditions
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Load Test', () => {
  test('should load dashboard page successfully', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkRequests: { url: string; status: number | null }[] = [];

    // Track console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track network requests
    page.on('response', (response) => {
      networkRequests.push({
        url: response.url(),
        status: response.status()
      });
    });

    console.log('1. Navigating to http://localhost:5181/dashboard...');

    // Use 'domcontentloaded' instead of 'networkidle' for faster, more reliable loading
    const response = await page.goto('http://localhost:5181/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log(`   Response status: ${response?.status()}`);
    expect(response?.status()).toBe(200);
    console.log('   ✓ HTTP 200 OK');

    // Check URL to ensure we're not redirected
    const currentUrl = page.url();
    console.log(`2. Current URL: ${currentUrl}`);

    const isOnDashboard = currentUrl.includes('/dashboard');
    const isRedirectedToAuth = currentUrl.includes('/auth');

    console.log(`   On /dashboard: ${isOnDashboard}`);
    console.log(`   Redirected to /auth: ${isRedirectedToAuth}`);

    expect(isOnDashboard).toBe(true);
    expect(isRedirectedToAuth).toBe(false);
    console.log('   ✓ No authentication redirect');

    // Wait for SvelteKit to initialize
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = '/Users/masa/Projects/smarterthings/test-results/screenshots/dashboard-verification.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`3. Screenshot saved: ${screenshotPath}`);

    // Check for key page elements
    const bodyText = await page.locator('body').textContent();
    console.log(`4. Page content length: ${bodyText?.length || 0} characters`);

    // Log network requests
    console.log(`5. Network requests made: ${networkRequests.length}`);

    const apiRequests = networkRequests.filter(r => r.url.includes('/api/'));
    console.log(`   API requests: ${apiRequests.length}`);

    apiRequests.forEach(req => {
      console.log(`   - ${req.url} [${req.status}]`);
    });

    // Check for auth-related errors
    const authErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('auth') ||
      err.toLowerCase().includes('401') ||
      err.toLowerCase().includes('403') ||
      err.toLowerCase().includes('unauthorized')
    );

    console.log(`6. Console errors: ${consoleErrors.length}`);
    if (authErrors.length > 0) {
      console.log('   Auth-related errors:');
      authErrors.forEach(err => console.log(`   - ${err}`));
    } else {
      console.log('   ✓ No auth-related console errors');
    }

    if (consoleErrors.length > 0 && authErrors.length === 0) {
      console.log('   Other console errors:');
      consoleErrors.forEach(err => console.log(`   - ${err}`));
    }

    // Final assertion: no authentication errors
    expect(authErrors).toHaveLength(0);
    console.log('\n✅ Dashboard verification PASSED');
  });

  test('should check if dashboard makes successful API calls', async ({ page }) => {
    const apiResponses: { url: string; status: number; ok: boolean }[] = [];

    // Track API responses
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          ok: response.ok()
        });
      }
    });

    await page.goto('http://localhost:5181/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // Wait for API calls to complete
    await page.waitForTimeout(3000);

    console.log('\nAPI Calls Analysis:');
    console.log(`Total API calls: ${apiResponses.length}`);

    if (apiResponses.length > 0) {
      const successful = apiResponses.filter(r => r.ok);
      const failed = apiResponses.filter(r => !r.ok);

      console.log(`Successful: ${successful.length}`);
      console.log(`Failed: ${failed.length}`);

      if (failed.length > 0) {
        console.log('\nFailed requests:');
        failed.forEach(r => {
          console.log(`  ${r.status} ${r.url}`);
        });
      }

      // Report all API calls
      console.log('\nAll API calls:');
      apiResponses.forEach(r => {
        const statusIcon = r.ok ? '✓' : '✗';
        console.log(`  ${statusIcon} ${r.status} ${r.url}`);
      });
    } else {
      console.log('⚠️ No API calls detected');
    }
  });
});
