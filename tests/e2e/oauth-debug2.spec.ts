import { test } from '@playwright/test';

test('debug - check auth state flow', async ({ page }) => {
  // Capture console logs
  page.on('console', msg => {
    console.log(`BROWSER ${msg.type()}: ${msg.text()}`);
  });

  // Capture network requests
  page.on('response', async response => {
    if (response.url().includes('/health')) {
      const body = await response.json();
      console.log('Health response:', JSON.stringify(body, null, 2));
    }
  });

  await page.goto('http://localhost:5181');

  // Wait for auth check to complete
  await page.waitForTimeout(3000);

  // Check rendered elements
  const oauthContainer = await page.locator('.oauth-container').count();
  const loadingContainer = await page.locator('.auth-loading-container').count();
  const errorContainer = await page.locator('.auth-error-container').count();
  const roomsContainer = await page.locator('.rooms-container').count();

  console.log('OAuth container:', oauthContainer);
  console.log('Loading container:', loadingContainer);
  console.log('Error container:', errorContainer);
  console.log('Rooms container:', roomsContainer);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug2-screenshot.png', fullPage: true });
});
