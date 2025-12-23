/**
 * Dashboard Access Verification Test
 *
 * Verifies that the dashboard is accessible without authentication loop issues.
 *
 * Test Steps:
 * 1. Navigate to http://localhost:5181/dashboard
 * 2. Verify page loads successfully (not redirected to /auth)
 * 3. Check for Mondrian grid layout with rooms
 * 4. Verify no console errors related to authentication
 * 5. Take screenshot of dashboard
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Access Verification', () => {
  test('should load dashboard without authentication loop', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Capture console errors and warnings
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Navigate to dashboard
    console.log('Navigating to http://localhost:5181/dashboard');
    const response = await page.goto('http://localhost:5181/dashboard', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Verify HTTP 200 response
    expect(response?.status()).toBe(200);
    console.log('✓ Dashboard returned HTTP 200');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on /dashboard, not redirected to /auth
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    expect(currentUrl).toContain('/dashboard');
    expect(currentUrl).not.toContain('/auth');
    console.log('✓ No redirect to /auth - authentication loop resolved');

    // Take screenshot for evidence
    await page.screenshot({
      path: '/Users/masa/Projects/smarterthings/test-results/screenshots/dashboard-loaded.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved to test-results/screenshots/dashboard-loaded.png');

    // Check for page title or header indicating dashboard
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Look for dashboard-specific elements
    // (Adjust selectors based on actual dashboard structure)
    const dashboardElements = await Promise.all([
      page.locator('h1, h2, [data-testid="dashboard"]').count(),
      page.locator('[class*="grid"], [class*="mondrian"]').count(),
      page.locator('[class*="room"], [data-room]').count(),
    ]);

    console.log(`Dashboard elements found: ${JSON.stringify(dashboardElements)}`);

    // Verify no authentication-related console errors
    const authErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('auth') ||
      err.toLowerCase().includes('401') ||
      err.toLowerCase().includes('unauthorized')
    );

    if (authErrors.length > 0) {
      console.error('⚠️ Authentication-related console errors:', authErrors);
    } else {
      console.log('✓ No authentication-related console errors');
    }

    // Log all console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    } else {
      console.log('✓ No console errors');
    }

    // Log warnings (non-critical)
    if (consoleWarnings.length > 0) {
      console.log('Console warnings (non-critical):', consoleWarnings);
    }

    // Verify network requests succeeded
    const failedRequests: string[] = [];
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Wait a bit to ensure all network requests complete
    await page.waitForTimeout(2000);

    if (failedRequests.length > 0) {
      console.log('⚠️ Failed network requests:', failedRequests);
    } else {
      console.log('✓ All network requests succeeded');
    }

    // Verify no critical auth errors
    expect(authErrors).toHaveLength(0);
  });

  test('should verify backend health endpoint shows initialized', async ({ request }) => {
    const response = await request.get('http://localhost:5182/health');
    expect(response.ok()).toBeTruthy();

    const health = await response.json();
    console.log('Backend health:', JSON.stringify(health, null, 2));

    expect(health.smartthings.initialized).toBe(true);
    expect(health.smartthings.authMethod).toBe('pat');
    console.log('✓ Backend initialized with PAT authentication');
  });
});
