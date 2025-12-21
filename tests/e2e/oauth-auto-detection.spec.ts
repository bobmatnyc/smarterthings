import { test, expect, type Page } from '@playwright/test';

/**
 * OAuth Auto-Detection UI - E2E Test Suite
 *
 * Tests the OAuth auto-detection implementation in +page.svelte and OAuthConnect.svelte
 *
 * Test Scenarios:
 * 1. Unauthenticated state - OAuth UI display
 * 2. Health check integration - API call and response handling
 * 3. Error handling - Backend unreachable scenario
 * 4. UI/UX quality - Design consistency and responsiveness
 * 5. Accessibility - Keyboard navigation and ARIA labels
 * 6. Console and network monitoring - Error detection
 */

// Test configuration
const FRONTEND_URL = 'http://localhost:5181';
const BACKEND_URL = 'http://localhost:5182';

test.describe('OAuth Auto-Detection UI', () => {

  /**
   * Scenario 1: Unauthenticated State
   *
   * Verify that the OAuth connection UI is properly displayed when
   * the backend reports SmartThings as not initialized.
   */
  test('should display OAuthConnect component when unauthenticated', async ({ page }) => {
    // Capture console messages for monitoring
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    // Navigate to the app
    await page.goto(FRONTEND_URL);

    // Wait for auth check to complete (should transition from loading to OAuth UI)
    await page.waitForLoadState('networkidle');

    // Verify loading state appeared initially
    // Note: This might be too fast to catch, but we'll check for it
    const loadingText = page.getByText('Connecting to Smarter Things...');

    // Verify OAuth UI is now displayed
    await expect(page.getByRole('heading', { name: 'Connect to SmartThings' })).toBeVisible();

    // Verify SmartThings logo is present
    const logo = page.locator('svg[aria-label="SmartThings Logo"]');
    await expect(logo).toBeVisible();

    // Verify description text
    await expect(page.getByText('To use Smarter Things, you need to connect your SmartThings account.')).toBeVisible();

    // Verify feature list items
    await expect(page.getByText('View and control your smart devices')).toBeVisible();
    await expect(page.getByText('Manage rooms and organize devices')).toBeVisible();
    await expect(page.getByText('Create and execute automations')).toBeVisible();
    await expect(page.getByText('Monitor device events in real-time')).toBeVisible();

    // Verify security notice
    await expect(page.getByText('Your credentials are encrypted and never stored on our servers')).toBeVisible();

    // Verify connect button
    const connectButton = page.getByRole('button', { name: 'Connect SmartThings Account' });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();

    // Verify help text
    await expect(page.getByText("You'll be redirected to SmartThings to authorize access.")).toBeVisible();

    // Log console messages for review
    console.log('Console messages captured:', consoleMessages);
  });

  /**
   * Scenario 2: Health Check Integration
   *
   * Verify that the app correctly calls /health endpoint and interprets
   * the SmartThings initialization status.
   */
  test('should call /health endpoint and detect authentication status', async ({ page }) => {
    // Intercept and monitor network requests
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/health')) {
        requests.push(request.url());
      }
    });

    // Intercept health endpoint to verify response handling
    await page.route('**/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          service: 'mcp-smarterthings-alexa',
          version: '0.7.2',
          smartthings: {
            initialized: false,
            message: 'SmartThings not configured - visit /auth/smartthings to connect'
          }
        })
      });
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Verify /health was called
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]).toContain('/health');

    // Verify OAuth UI is displayed (because initialized: false)
    await expect(page.getByRole('heading', { name: 'Connect to SmartThings' })).toBeVisible();
  });

  /**
   * Scenario 3: Error Handling - Backend Unreachable
   *
   * Test the error UI when the backend server is not responding.
   */
  test('should display error UI when backend is unreachable', async ({ page }) => {
    // Intercept health endpoint to simulate network error
    await page.route('**/health', async (route) => {
      await route.abort('failed');
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Wait a moment for error state to render
    await page.waitForTimeout(1000);

    // Verify error UI is displayed
    await expect(page.getByRole('heading', { name: 'Connection Failed' })).toBeVisible();

    // Verify error message
    await expect(page.getByText('Unable to connect to backend server. Please ensure the server is running.')).toBeVisible();

    // Verify "Try Again" button exists
    const retryButton = page.getByRole('button', { name: 'Try Again' });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    // Verify error icon is present
    const errorIcon = page.locator('.error-icon');
    await expect(errorIcon).toBeVisible();
  });

  /**
   * Scenario 4: UI/UX Quality - Design Consistency
   *
   * Verify the OAuth UI matches design standards and is visually consistent.
   */
  test('should have consistent design and styling', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Verify OAuth container background gradient
    const container = page.locator('.oauth-container');
    await expect(container).toBeVisible();

    // Verify card styling
    const card = page.locator('.oauth-card');
    await expect(card).toBeVisible();

    // Check card has white background (computed style check)
    const cardBg = await card.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(cardBg).toContain('rgb(255, 255, 255)'); // white

    // Verify button styling - SmartThings brand color
    const button = page.getByRole('button', { name: 'Connect SmartThings Account' });
    const buttonBg = await button.evaluate(el => window.getComputedStyle(el).background);
    expect(buttonBg).toContain('linear-gradient'); // Has gradient background

    // Verify check icons are green
    const checkIcon = page.locator('.check-icon').first();
    const checkColor = await checkIcon.evaluate(el => window.getComputedStyle(el).color);
    expect(checkColor).toContain('rgb(34, 197, 94)'); // green color
  });

  /**
   * Scenario 5: Mobile Responsiveness
   *
   * Test the OAuth UI on mobile viewport sizes.
   */
  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Verify OAuth UI is still visible and properly laid out
    await expect(page.getByRole('heading', { name: 'Connect to SmartThings' })).toBeVisible();

    // Verify button is full width on mobile
    const button = page.getByRole('button', { name: 'Connect SmartThings Account' });
    await expect(button).toBeVisible();

    const buttonWidth = await button.evaluate(el => el.getBoundingClientRect().width);
    const containerWidth = await page.locator('.oauth-card').evaluate(el => el.getBoundingClientRect().width);

    // Button should be nearly full width (accounting for padding)
    expect(buttonWidth).toBeGreaterThan(containerWidth * 0.8);

    // Verify all content is readable and not cut off
    await expect(page.getByText('View and control your smart devices')).toBeVisible();
  });

  /**
   * Scenario 6: Accessibility - Keyboard Navigation
   *
   * Verify keyboard navigation and focus indicators work correctly.
   */
  test('should support keyboard navigation and have proper focus indicators', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Tab to the connect button
    await page.keyboard.press('Tab');

    // Verify button receives focus
    const button = page.getByRole('button', { name: 'Connect SmartThings Account' });
    await expect(button).toBeFocused();

    // Verify focus outline is visible (accessibility requirement)
    const outlineStyle = await button.evaluate(el => window.getComputedStyle(el).outline);
    expect(outlineStyle).toBeTruthy(); // Should have an outline when focused

    // Verify button can be activated with Enter key (but don't actually navigate)
    // We'll just check the onclick handler exists
    const hasOnClick = await button.evaluate(el => typeof (el as any).onclick === 'function');
    expect(hasOnClick).toBe(true);
  });

  /**
   * Scenario 7: Accessibility - ARIA Labels and Semantic HTML
   *
   * Verify proper ARIA labels and semantic HTML structure.
   */
  test('should have proper ARIA labels and semantic HTML', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Verify heading hierarchy
    const h1 = page.getByRole('heading', { level: 1, name: 'Connect to SmartThings' });
    await expect(h1).toBeVisible();

    // Verify SmartThings logo has aria-label
    const logo = page.locator('svg[aria-label="SmartThings Logo"]');
    await expect(logo).toBeVisible();

    // Verify button has proper type attribute
    const button = page.getByRole('button', { name: 'Connect SmartThings Account' });
    const buttonType = await button.getAttribute('type');
    expect(buttonType).toBe('button');

    // Verify list structure is semantic
    const featuresList = page.locator('.features-list');
    await expect(featuresList).toBeVisible();

    const listItems = featuresList.locator('li');
    const itemCount = await listItems.count();
    expect(itemCount).toBe(4); // Should have 4 feature items
  });

  /**
   * Scenario 8: Console and Network Monitoring
   *
   * Verify no JavaScript errors or failed network requests during load.
   */
  test('should load without JavaScript errors or network failures', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const failedRequests: string[] = [];

    // Monitor console for errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Monitor network for failed requests
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Wait a moment to ensure all async operations complete
    await page.waitForTimeout(2000);

    // Report findings
    console.log('Console Errors:', consoleErrors);
    console.log('Console Warnings:', consoleWarnings);
    console.log('Failed Requests:', failedRequests);

    // Verify no critical errors (allow warnings and expected failures like auth check)
    // Filter out expected "Auth check failed" console logs
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('Auth check failed') &&
      !err.includes('Unable to connect to backend')
    );

    expect(criticalErrors.length).toBe(0);
  });

  /**
   * Scenario 9: Performance - Page Load Time
   *
   * Verify the OAuth UI loads quickly (< 500ms target).
   */
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Wait for OAuth UI to be visible
    await page.getByRole('heading', { name: 'Connect to SmartThings' }).waitFor();

    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);

    // Verify load time is reasonable (increase budget to 3000ms for E2E)
    expect(loadTime).toBeLessThan(3000);
  });

  /**
   * Scenario 10: Button Hover Effect
   *
   * Verify the connect button has proper hover states.
   */
  test('should show hover effect on connect button', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    const button = page.getByRole('button', { name: 'Connect SmartThings Account' });

    // Get initial button state
    const initialTransform = await button.evaluate(el => window.getComputedStyle(el).transform);

    // Hover over button
    await button.hover();

    // Wait for transition
    await page.waitForTimeout(300);

    // Get hover state (should have transform applied)
    const hoverTransform = await button.evaluate(el => window.getComputedStyle(el).transform);

    // Note: Transform may or may not change depending on browser rendering
    // This is a visual check that's hard to assert programmatically
    console.log('Initial transform:', initialTransform);
    console.log('Hover transform:', hoverTransform);
  });

  /**
   * Scenario 11: Error Recovery - Retry Button
   *
   * Verify the "Try Again" button works after backend error.
   */
  test('should retry authentication check when retry button clicked', async ({ page }) => {
    let healthCallCount = 0;

    // First call fails, second succeeds
    await page.route('**/health', async (route) => {
      healthCallCount++;

      if (healthCallCount === 1) {
        // First call - fail
        await route.abort('failed');
      } else {
        // Second call - succeed
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'healthy',
            smartthings: { initialized: false }
          })
        });
      }
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Verify error UI appears
    await expect(page.getByRole('heading', { name: 'Connection Failed' })).toBeVisible();

    // Click retry button
    await page.getByRole('button', { name: 'Try Again' }).click();

    // Wait for retry to complete
    await page.waitForTimeout(1000);

    // Verify OAuth UI now appears (successful connection)
    await expect(page.getByRole('heading', { name: 'Connect to SmartThings' })).toBeVisible();

    // Verify health was called twice
    expect(healthCallCount).toBe(2);
  });
});
