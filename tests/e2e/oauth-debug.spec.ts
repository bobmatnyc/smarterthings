import { test, expect } from '@playwright/test';

test('debug - what is actually rendered', async ({ page }) => {
  await page.goto('http://localhost:5181');
  await page.waitForLoadState('networkidle');

  // Wait a moment
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });

  // Get page content
  const bodyText = await page.locator('body').textContent();
  console.log('Page body text:', bodyText);

  // Get all headings
  const headings = await page.locator('h1, h2, h3').allTextContents();
  console.log('Headings found:', headings);

  // Get all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons found:', buttons);

  // Check if OAuth container exists
  const oauthContainer = page.locator('.oauth-container');
  const oauthExists = await oauthContainer.count();
  console.log('OAuth container count:', oauthExists);

  // Check if loading container exists
  const loadingContainer = page.locator('.auth-loading-container');
  const loadingExists = await loadingContainer.count();
  console.log('Loading container count:', loadingExists);

  // Check if error container exists
  const errorContainer = page.locator('.auth-error-container');
  const errorExists = await errorContainer.count();
  console.log('Error container count:', errorExists);

  // Check if RoomsGrid is rendered
  const roomsGrid = page.locator('text=Rooms');
  const roomsExists = await roomsGrid.count();
  console.log('Rooms grid count:', roomsExists);
});
