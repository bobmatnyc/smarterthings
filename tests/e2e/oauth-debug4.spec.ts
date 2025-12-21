import { test } from '@playwright/test';

test('debug - intercept health and check if called', async ({ page }) => {
  let healthCalled = false;

  // Intercept health endpoint
  await page.route('**/health', async (route) => {
    healthCalled = true;
    console.log('✅ /health endpoint was called!');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'healthy',
        smartthings: {
          initialized: false,
          message: 'Not configured'
        }
      })
    });
  });

  console.log('Navigating to page...');
  await page.goto('http://localhost:5181');

  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  console.log(`Health called: ${healthCalled}`);

  // Check what's rendered
  const oauth = await page.locator('.oauth-container').count();
  const loading = await page.locator('.auth-loading-container').count();
  const error = await page.locator('.auth-error-container').count();
  const rooms = await page.locator('.rooms-container').count();

  console.log(`OAuth: ${oauth}, Loading: ${loading}, Error: ${error}, Rooms: ${rooms}`);

  await page.screenshot({ path: 'test-results/debug4-screenshot.png', fullPage: true });
});
