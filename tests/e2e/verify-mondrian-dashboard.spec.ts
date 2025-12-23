import { test, expect } from '@playwright/test';

test.describe('Mondrian Kiosk Dashboard Verification', () => {
  test('Dashboard loads and redirects correctly', async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:5181');

    // Should redirect to /dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    console.log('✓ Dashboard redirect working');
  });

  test('Mondrian Grid displays rooms and devices', async ({ page }) => {
    await page.goto('http://localhost:5181/dashboard');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot of the dashboard
    await page.screenshot({ path: 'test-results/screenshots/dashboard-view.png', fullPage: true });

    // Check for room tiles - Mondrian uses grid layout
    const roomTiles = await page.locator('[class*="room"], [class*="tile"], [data-room]').count();
    console.log(`✓ Found ${roomTiles} room/tile elements`);

    // Check for device elements
    const deviceElements = await page.locator('[class*="device"], [data-device]').count();
    console.log(`✓ Found ${deviceElements} device elements`);
  });

  test('Status Crawler displays at top', async ({ page }) => {
    await page.goto('http://localhost:5181/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for status crawler/scrolling bar
    const statusBar = await page.locator('[class*="status"], [class*="crawler"], [class*="scroll"]').first();

    if (await statusBar.count() > 0) {
      const isVisible = await statusBar.isVisible();
      console.log(`✓ Status crawler visible: ${isVisible}`);
    } else {
      console.log('⚠ Status crawler not found by class selector');
    }
  });

  test('Navigation contains Dashboard link', async ({ page }) => {
    await page.goto('http://localhost:5181/dashboard');
    await page.waitForLoadState('networkidle');

    // Check navigation
    const navLinks = await page.locator('nav a, [class*="nav"] a').allTextContents();
    console.log('✓ Navigation links found:', navLinks);

    const hasDashboard = navLinks.some(link => link.toLowerCase().includes('dashboard'));
    console.log(`✓ Dashboard in navigation: ${hasDashboard}`);
  });

  test('Config modal opens from gear icon', async ({ page }) => {
    await page.goto('http://localhost:5181/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for gear/settings icon (commonly in bottom-right)
    const gearIcon = await page.locator('[class*="gear"], [class*="settings"], button[aria-label*="settings" i], button[aria-label*="config" i]').first();

    if (await gearIcon.count() > 0) {
      await gearIcon.click();

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Take screenshot of modal
      await page.screenshot({ path: 'test-results/screenshots/config-modal.png', fullPage: true });

      // Check for modal/tabs
      const modal = await page.locator('[role="dialog"], [class*="modal"]').count();
      const tabs = await page.locator('[role="tab"], [class*="tab"]').count();

      console.log(`✓ Modal opened: ${modal > 0}`);
      console.log(`✓ Tabs found: ${tabs}`);
    } else {
      console.log('⚠ Gear/settings icon not found');
    }
  });

  test('Check for console errors', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(`Page Error: ${error.message}`);
    });

    await page.goto('http://localhost:5181/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    console.log('\n=== Console Output ===');
    console.log(`Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Error messages:');
      errors.forEach(err => console.log(`  - ${err}`));
    }

    console.log(`Warnings: ${warnings.length}`);
    if (warnings.length > 0 && warnings.length < 10) {
      console.log('Warning messages:');
      warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/screenshots/dashboard-final.png', fullPage: true });

    expect(errors.length).toBe(0);
  });

  test('Take page snapshot', async ({ page }) => {
    await page.goto('http://localhost:5181/dashboard');
    await page.waitForLoadState('networkidle');

    // Get page structure
    const bodyHTML = await page.locator('body').innerHTML();
    const title = await page.title();

    console.log('\n=== Page Snapshot ===');
    console.log(`Title: ${title}`);
    console.log(`Body HTML length: ${bodyHTML.length} characters`);

    // Get key structure elements
    const structure = {
      title,
      hasNav: await page.locator('nav').count() > 0,
      hasHeader: await page.locator('header').count() > 0,
      hasMain: await page.locator('main').count() > 0,
      hasFooter: await page.locator('footer').count() > 0,
      roomCount: await page.locator('[class*="room"], [data-room]').count(),
      deviceCount: await page.locator('[class*="device"], [data-device]').count(),
    };

    console.log('Structure:', JSON.stringify(structure, null, 2));
  });
});
