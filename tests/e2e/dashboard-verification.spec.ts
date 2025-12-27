import { test, expect } from '@playwright/test';

test.describe('Mondrian Dashboard Verification', () => {
  test('should display dashboard correctly without double headers or 404 errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', (response) => {
      if (response.status() === 404) {
        networkErrors.push(`404 Error: ${response.url()}`);
      }
    });

    // Navigate to dashboard
    await page.goto('http://localhost:5181/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait a bit for the page to fully render
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/smarterthings/test-results/screenshots/dashboard-verification.png',
      fullPage: true
    });

    // Check for single header (not double)
    const headers = await page.locator('header').count();
    console.log(`Headers found: ${headers}`);

    // Check for dashboard grid
    const dashboardGrid = await page.locator('[class*="dashboard"], [class*="grid"]').count();
    console.log(`Dashboard grid elements found: ${dashboardGrid}`);

    // Check for status crawler
    const statusCrawler = await page.locator('[class*="status"], [class*="crawler"]').count();
    console.log(`Status/crawler elements found: ${statusCrawler}`);

    // Log any errors found
    console.log('\n=== VERIFICATION RESULTS ===');
    console.log(`Headers: ${headers} (expected: 1)`);
    console.log(`Dashboard grid present: ${dashboardGrid > 0}`);
    console.log(`Status crawler present: ${statusCrawler > 0}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`404 errors: ${networkErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }

    if (networkErrors.length > 0) {
      console.log('\n404 Errors:');
      networkErrors.forEach(err => console.log(`  - ${err}`));
    }

    // Assertions
    expect(headers).toBe(1); // Should have exactly 1 header
    expect(dashboardGrid).toBeGreaterThan(0); // Should have dashboard grid
    expect(networkErrors.filter(e => e.includes('404'))).toHaveLength(0); // No 404 errors
  });
});
