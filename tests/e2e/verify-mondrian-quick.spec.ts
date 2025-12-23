import { test, expect } from '@playwright/test';

test.describe('Mondrian Dashboard Quick Verification', () => {
  test('Full Dashboard Verification', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Capture console messages
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

    console.log('\n=== 1. NAVIGATION TEST ===');
    await page.goto('http://localhost:5181');

    // Wait for navigation to complete (2 seconds should be enough)
    await page.waitForTimeout(2000);

    const currentURL = page.url();
    console.log(`Current URL: ${currentURL}`);
    console.log(`✓ Redirected to dashboard: ${currentURL.includes('/dashboard')}`);

    console.log('\n=== 2. PAGE STRUCTURE ===');
    const title = await page.title();
    console.log(`Page Title: ${title}`);

    // Take screenshot of initial load
    await page.screenshot({ path: 'test-results/screenshots/dashboard-initial.png', fullPage: true });

    // Check basic structure
    const hasNav = await page.locator('nav').count() > 0;
    const hasMain = await page.locator('main').count() > 0;

    console.log(`✓ Has navigation: ${hasNav}`);
    console.log(`✓ Has main content: ${hasMain}`);

    console.log('\n=== 3. MONDRIAN GRID ===');
    // Wait a bit for content to render
    await page.waitForTimeout(1000);

    // Look for room/tile elements with multiple selectors
    const gridSelectors = [
      '[class*="room"]',
      '[class*="tile"]',
      '[class*="grid"]',
      '[data-room]',
      '[class*="mondrian"]',
      '.room',
      '.tile',
      '.grid-item'
    ];

    let totalElements = 0;
    for (const selector of gridSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`  Found ${count} elements matching "${selector}"`);
        totalElements += count;
      }
    }

    console.log(`Total grid-related elements: ${totalElements}`);

    // Check for device elements
    const deviceCount = await page.locator('[class*="device"], [data-device], .device').count();
    console.log(`Device elements: ${deviceCount}`);

    console.log('\n=== 4. STATUS CRAWLER ===');
    const statusSelectors = [
      '[class*="status"]',
      '[class*="crawler"]',
      '[class*="scroll"]',
      '[class*="ticker"]',
      '.status-bar',
      '.crawler'
    ];

    let statusFound = false;
    for (const selector of statusSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const isVisible = await page.locator(selector).first().isVisible();
        console.log(`  "${selector}": ${count} elements, visible: ${isVisible}`);
        if (isVisible) statusFound = true;
      }
    }

    console.log(`✓ Status crawler visible: ${statusFound}`);

    console.log('\n=== 5. NAVIGATION LINKS ===');
    const navLinks = await page.locator('nav a, [class*="nav"] a, header a').allTextContents();
    console.log(`Navigation links: ${navLinks.join(', ')}`);

    const hasDashboardLink = navLinks.some(link => link.toLowerCase().includes('dashboard'));
    console.log(`✓ Dashboard in navigation: ${hasDashboardLink}`);

    console.log('\n=== 6. CONFIG MODAL TEST ===');
    // Look for gear/settings/config button
    const configSelectors = [
      'button[aria-label*="settings" i]',
      'button[aria-label*="config" i]',
      '[class*="gear"]',
      '[class*="settings"]',
      '[class*="config"]',
      'button.settings',
      'button.gear'
    ];

    let configButton = null;
    for (const selector of configSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        console.log(`  Found config button: "${selector}"`);
        configButton = button;
        break;
      }
    }

    if (configButton) {
      try {
        await configButton.click();
        await page.waitForTimeout(1000);

        // Take screenshot of modal
        await page.screenshot({ path: 'test-results/screenshots/config-modal.png', fullPage: true });

        const modalVisible = await page.locator('[role="dialog"], [class*="modal"], .modal').count() > 0;
        const tabsCount = await page.locator('[role="tab"], [class*="tab"], .tab').count();

        console.log(`✓ Modal opened: ${modalVisible}`);
        console.log(`✓ Tabs found: ${tabsCount}`);
      } catch (e) {
        console.log(`⚠ Could not click config button: ${e}`);
      }
    } else {
      console.log('⚠ Config button not found');
    }

    console.log('\n=== 7. CONSOLE ERRORS ===');
    // Wait a bit more for any async errors
    await page.waitForTimeout(2000);

    console.log(`Total errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors:');
      errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more`);
      }
    } else {
      console.log('✓ No console errors detected');
    }

    console.log(`\nTotal warnings: ${warnings.length}`);
    if (warnings.length > 0 && warnings.length <= 5) {
      console.log('Warnings:');
      warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/screenshots/dashboard-final-view.png', fullPage: true });

    console.log('\n=== 8. PAGE SNAPSHOT ===');
    // Get HTML structure
    const bodyText = await page.locator('body').innerText();
    console.log(`Body text preview (first 500 chars):\n${bodyText.substring(0, 500)}`);

    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log(`Screenshots saved to: test-results/screenshots/`);

    // Assert no critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('source-map') &&
      !e.includes('DevTools')
    );

    if (criticalErrors.length > 0) {
      console.log('\n⚠ Critical errors found:');
      criticalErrors.forEach(e => console.log(`  - ${e}`));
    }

    expect(criticalErrors.length).toBe(0);
  });
});
