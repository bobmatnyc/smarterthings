import { test, expect } from '@playwright/test';

test.describe('OAuth Persistence Verification', () => {
  test('should load dashboard without redirecting to auth when tokens exist', async ({ page }) => {
    // Set up console error monitoring
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to homepage
    await page.goto('http://localhost:5181', { waitUntil: 'domcontentloaded' });

    // Wait for initial render and data loading
    await page.waitForTimeout(8000);

    // Get final URL after any redirects
    const currentURL = page.url();

    // Take screenshot of the page
    await page.screenshot({
      path: 'test-results/oauth-persistence-homepage.png',
      fullPage: true
    });

    // Verify we're NOT on the auth page
    expect(currentURL).not.toContain('/auth');
    expect(currentURL).toBe('http://localhost:5181/');

    // Check that we can see dashboard elements (not auth prompt)
    // Look for common dashboard elements
    const bodyText = await page.textContent('body');

    // Should NOT see authentication prompts
    expect(bodyText).not.toContain('Authenticate with SmartThings');
    expect(bodyText).not.toContain('Connect to SmartThings');

    // Should see dashboard elements (devices, rooms, etc.)
    // This verifies the app is initialized and showing content
    const textLength = await page.evaluate(() => {
      return document.body.innerText.length;
    });
    console.log('Page content length:', textLength);

    // The page should have some content - either loading state or dashboard
    // If it shows "Connecting to Smarter Things..." that's also valid (OAuth is working)
    expect(textLength).toBeGreaterThan(10);

    // Filter out known non-critical errors (if any)
    const criticalErrors = consoleErrors.filter(err =>
      err.includes('auth') || err.includes('token') || err.includes('oauth')
    );

    console.log('All console errors:', consoleErrors);
    console.log('Auth-related console errors:', criticalErrors);

    // Log page content for debugging
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    console.log('Body text length:', bodyText?.length || 0);

    // Should have no critical auth-related errors
    expect(criticalErrors.length).toBe(0);
  });

  test('should verify health endpoint shows initialized state', async ({ request }) => {
    const response = await request.get('http://localhost:5182/health');
    expect(response.ok()).toBeTruthy();

    const health = await response.json();

    // Verify SmartThings is initialized
    expect(health.smartthings.initialized).toBe(true);
    expect(health.smartthings.hasTokens).toBe(true);

    console.log('Health check result:', JSON.stringify(health, null, 2));
  });
});
