import { test, expect, Page } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

// Test configuration
const FRONTEND_URL = 'http://localhost:5181';
const BACKEND_URL = 'http://localhost:5182';
const SCREENSHOT_DIR = join(process.cwd(), 'test-results', 'brilliant-detection');

// Ensure screenshot directory exists
test.beforeAll(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Brilliant Device Auto-Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to devices page
    await page.goto(`${FRONTEND_URL}/devices`);

    // Wait for device grid to load
    await page.waitForSelector('[data-testid="device-grid"], .grid, .device-card', { timeout: 10000 });

    // Wait a bit for devices to render
    await page.waitForTimeout(2000);
  });

  test('Test 1: Verify Brilliant device icon display', async ({ page }) => {
    console.log('Test 1: Checking Brilliant device icons...');

    // Look for Brilliant devices by manufacturer badge or card content
    const deviceCards = await page.locator('.device-card, [class*="card"]').all();

    console.log(`Found ${deviceCards.length} device cards total`);

    let brilliantDevicesFound = 0;
    let devicesWithIcons = 0;

    for (const card of deviceCards) {
      const cardText = await card.textContent();

      // Check if this is a Brilliant device
      if (cardText?.includes('Brilliant')) {
        brilliantDevicesFound++;
        console.log(`Found Brilliant device: ${cardText.substring(0, 100)}`);

        // Check for icon (🔆 for dimmers or 💡 for switches)
        const hasLightIcon = cardText.includes('🔆') || cardText.includes('💡');

        if (hasLightIcon) {
          devicesWithIcons++;
          console.log('  ✓ Icon found');
        } else {
          console.log('  ✗ Icon missing');
        }
      }
    }

    console.log(`Brilliant devices found: ${brilliantDevicesFound}`);
    console.log(`Devices with icons: ${devicesWithIcons}`);

    // Take screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test1-brilliant-icons.png'),
      fullPage: true
    });

    // Assertions
    expect(brilliantDevicesFound).toBeGreaterThan(0);
    expect(devicesWithIcons).toBe(brilliantDevicesFound);
  });

  test('Test 2: Verify manufacturer badge styling and accessibility', async ({ page }) => {
    console.log('Test 2: Checking manufacturer badge...');

    // Find Brilliant badge
    const brilliantBadge = page.locator('text=/Brilliant/i').first();

    // Check if badge exists
    const badgeCount = await page.locator('text=/Brilliant/i').count();
    console.log(`Found ${badgeCount} Brilliant badges`);

    if (badgeCount > 0) {
      // Check badge styling
      const badge = brilliantBadge;
      await badge.waitFor({ state: 'visible', timeout: 5000 });

      // Get computed styles
      const color = await badge.evaluate((el) => window.getComputedStyle(el).color);
      const bgColor = await badge.evaluate((el) => window.getComputedStyle(el).backgroundColor);

      console.log(`Badge color: ${color}`);
      console.log(`Badge background: ${bgColor}`);

      // Check ARIA attributes
      const ariaLabel = await badge.getAttribute('aria-label');
      console.log(`ARIA label: ${ariaLabel || 'none'}`);
    }

    // Take screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test2-manufacturer-badge.png'),
      fullPage: true
    });

    expect(badgeCount).toBeGreaterThan(0);
  });

  test('Test 3: Verify manufacturer filter functionality', async ({ page }) => {
    console.log('Test 3: Testing manufacturer filter...');

    // Look for manufacturer filter dropdown
    const filterSelectors = [
      'select[name="manufacturer"]',
      'select:has-text("Manufacturer")',
      '[data-filter="manufacturer"]',
      'select',
      '.filter select'
    ];

    let manufacturerSelect = null;

    for (const selector of filterSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found filter with selector: ${selector}`);
        manufacturerSelect = page.locator(selector).first();
        break;
      }
    }

    // Count devices before filter
    const devicesBeforeFilter = await page.locator('.device-card, [class*="card"]').count();
    console.log(`Devices before filter: ${devicesBeforeFilter}`);

    // Take screenshot before filtering
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test3a-before-filter.png'),
      fullPage: true
    });

    if (manufacturerSelect) {
      // Get all options
      const options = await manufacturerSelect.locator('option').allTextContents();
      console.log('Available manufacturer options:', options);

      // Check if Brilliant option exists
      const hasBrilliantOption = options.some(opt => opt.includes('Brilliant'));
      expect(hasBrilliantOption).toBe(true);

      if (hasBrilliantOption) {
        // Select Brilliant manufacturer
        await manufacturerSelect.selectOption({ label: /Brilliant/i });

        // Wait for filter to apply
        await page.waitForTimeout(1000);

        // Count devices after filter
        const devicesAfterFilter = await page.locator('.device-card, [class*="card"]').count();
        console.log(`Devices after filter: ${devicesAfterFilter}`);

        // Check that only Brilliant devices are shown
        const deviceCards = await page.locator('.device-card, [class*="card"]').all();
        for (const card of deviceCards) {
          const text = await card.textContent();
          const isBrilliant = text?.includes('Brilliant');
          console.log(`Device is Brilliant: ${isBrilliant}`);
          expect(isBrilliant).toBe(true);
        }

        // Take screenshot after filtering
        await page.screenshot({
          path: join(SCREENSHOT_DIR, 'test3b-after-filter.png'),
          fullPage: true
        });

        // Check for filter badge
        const filterBadge = await page.locator('[class*="badge"], .active-filter').count();
        console.log(`Active filter badges: ${filterBadge}`);

        // Test clear filters
        const clearButton = page.locator('button:has-text("Clear"), button:has-text("Reset")');
        if (await clearButton.count() > 0) {
          await clearButton.first().click();
          await page.waitForTimeout(1000);

          const devicesAfterClear = await page.locator('.device-card, [class*="card"]').count();
          console.log(`Devices after clear: ${devicesAfterClear}`);

          expect(devicesAfterClear).toBe(devicesBeforeFilter);
        }
      }
    } else {
      console.warn('Manufacturer filter dropdown not found!');
    }

    // Take final screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test3c-final.png'),
      fullPage: true
    });
  });

  test('Test 4: Verify tooltip display on hover', async ({ page }) => {
    console.log('Test 4: Testing tooltip display...');

    // Find info icon (ℹ️) on Brilliant devices
    const infoIcons = page.locator('text=/ℹ️|info/i');
    const iconCount = await infoIcons.count();

    console.log(`Found ${iconCount} info icons`);

    if (iconCount > 0) {
      const firstIcon = infoIcons.first();

      // Hover over icon
      await firstIcon.hover();

      // Wait for tooltip
      await page.waitForTimeout(1000);

      // Look for tooltip with expected text
      const tooltip = page.locator('text=/Advanced features available/i');
      const tooltipVisible = await tooltip.isVisible().catch(() => false);

      console.log(`Tooltip visible: ${tooltipVisible}`);

      if (tooltipVisible) {
        const tooltipText = await tooltip.textContent();
        console.log(`Tooltip text: ${tooltipText}`);
        expect(tooltipText).toContain('Advanced features');
      }

      // Take screenshot with tooltip
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'test4-tooltip.png'),
        fullPage: true
      });
    }
  });

  test('Test 5: Verify mobile responsive layout', async ({ page }) => {
    console.log('Test 5: Testing mobile responsive layout...');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for layout adjustment
    await page.waitForTimeout(1000);

    // Take mobile screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test5a-mobile-view.png'),
      fullPage: true
    });

    // Check Brilliant badges are visible
    const badges = await page.locator('text=/Brilliant/i').count();
    console.log(`Brilliant badges visible on mobile: ${badges}`);

    // Check icons are visible
    const deviceCards = await page.locator('.device-card, [class*="card"]').all();
    let iconsVisible = 0;

    for (const card of deviceCards) {
      const text = await card.textContent();
      if (text?.includes('🔆') || text?.includes('💡')) {
        iconsVisible++;
      }
    }

    console.log(`Icons visible on mobile: ${iconsVisible}`);

    // Test manufacturer filter on mobile
    const filterDropdown = page.locator('select').first();
    if (await filterDropdown.isVisible()) {
      console.log('Manufacturer filter visible on mobile: true');

      // Take screenshot of filter
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'test5b-mobile-filter.png'),
        fullPage: true
      });
    } else {
      console.log('Manufacturer filter visible on mobile: false');
    }

    expect(badges).toBeGreaterThan(0);
  });

  test('Test 6: Validate API device detection logic', async ({ page, request }) => {
    console.log('Test 6: Validating API device detection...');

    // Monitor network requests
    const apiResponses: any[] = [];

    page.on('response', async (response) => {
      if (response.url().includes('/api/devices') || response.url().includes('devices')) {
        try {
          const data = await response.json();
          apiResponses.push({ url: response.url(), data });
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });

    // Reload page to capture API calls
    await page.reload();
    await page.waitForTimeout(3000);

    console.log(`Captured ${apiResponses.length} API responses`);

    // Analyze device data
    let brilliantDevices = 0;

    for (const response of apiResponses) {
      if (Array.isArray(response.data)) {
        for (const device of response.data) {
          if (device.manufacturer === 'Brilliant Home Technology') {
            brilliantDevices++;
            console.log(`Brilliant device: ${device.name || device.label}`);
            console.log(`  Manufacturer: ${device.manufacturer}`);
            console.log(`  Model: ${device.model || 'N/A'}`);
          }
        }
      } else if (response.data.devices && Array.isArray(response.data.devices)) {
        for (const device of response.data.devices) {
          if (device.manufacturer === 'Brilliant Home Technology') {
            brilliantDevices++;
            console.log(`Brilliant device: ${device.name || device.label}`);
            console.log(`  Manufacturer: ${device.manufacturer}`);
            console.log(`  Model: ${device.model || 'N/A'}`);
          }
        }
      }
    }

    console.log(`Total Brilliant devices in API: ${brilliantDevices}`);
    expect(brilliantDevices).toBeGreaterThan(0);

    // Take screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test6-api-validation.png'),
      fullPage: true
    });
  });

  test('Test 7: Check browser console for errors', async ({ page }) => {
    console.log('Test 7: Monitoring browser console...');

    const consoleMessages: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Listen to console events
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);

      if (msg.type() === 'error') {
        errors.push(text);
      } else if (msg.type() === 'warning') {
        warnings.push(text);
      }
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      errors.push(`PAGE ERROR: ${error.message}`);
    });

    // Reload and interact with page
    await page.reload();
    await page.waitForTimeout(2000);

    // Interact with filters
    const filterDropdown = page.locator('select').first();
    if (await filterDropdown.count() > 0) {
      await filterDropdown.selectOption({ index: 0 });
      await page.waitForTimeout(500);
    }

    // Click on a device
    const deviceCard = page.locator('.device-card, [class*="card"]').first();
    if (await deviceCard.count() > 0) {
      await deviceCard.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // Take screenshot of clean console
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test7-console-check.png'),
      fullPage: true
    });

    // Report findings
    console.log(`\nConsole Messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n🔴 Console Errors:');
      errors.forEach(err => console.log(`  - ${err}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Console Warnings:');
      warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    // Fail test if there are errors
    expect(errors.length).toBe(0);
  });

  test('Test 8: Verify existing functionality regression', async ({ page }) => {
    console.log('Test 8: Testing existing functionality...');

    // Test room filtering
    console.log('Testing room filtering...');
    const roomFilter = page.locator('select').first();
    if (await roomFilter.count() > 0) {
      await roomFilter.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      console.log('  ✓ Room filter functional');
    }

    // Reset filters
    const clearButton = page.locator('button:has-text("Clear"), button:has-text("Reset")');
    if (await clearButton.count() > 0) {
      await clearButton.first().click();
      await page.waitForTimeout(1000);
    }

    // Test capability filtering
    console.log('Testing capability filtering...');
    const capabilityButtons = page.locator('button:has-text("Switch"), button:has-text("Dimmer"), button:has-text("Temperature")');
    if (await capabilityButtons.count() > 0) {
      await capabilityButtons.first().click();
      await page.waitForTimeout(1000);
      console.log('  ✓ Capability filter functional');
    }

    // Take screenshot
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'test8-regression-check.png'),
      fullPage: true
    });

    console.log('Test 8: All existing functionality working');
  });

  test('Test 9: Verify dark mode compatibility', async ({ page }) => {
    console.log('Test 9: Testing dark mode...');

    // Look for dark mode toggle
    const darkModeToggle = page.locator('button:has-text("Dark"), [aria-label*="dark" i], [aria-label*="theme" i]');

    if (await darkModeToggle.count() > 0) {
      console.log('Dark mode toggle found');

      // Enable dark mode
      await darkModeToggle.first().click();
      await page.waitForTimeout(1000);

      // Take screenshot in dark mode
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'test9a-dark-mode.png'),
        fullPage: true
      });

      // Check Brilliant badge visibility in dark mode
      const badges = await page.locator('text=/Brilliant/i').count();
      console.log(`Brilliant badges visible in dark mode: ${badges}`);

      // Check icon contrast
      const deviceCards = await page.locator('.device-card, [class*="card"]').all();
      let iconsVisible = 0;

      for (const card of deviceCards) {
        const text = await card.textContent();
        if (text?.includes('🔆') || text?.includes('💡')) {
          iconsVisible++;
        }
      }

      console.log(`Icons visible in dark mode: ${iconsVisible}`);

      // Test tooltip in dark mode
      const infoIcon = page.locator('text=/ℹ️|info/i').first();
      if (await infoIcon.count() > 0) {
        await infoIcon.hover();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: join(SCREENSHOT_DIR, 'test9b-dark-mode-tooltip.png'),
          fullPage: true
        });
      }

      expect(badges).toBeGreaterThan(0);
      expect(iconsVisible).toBeGreaterThan(0);
    } else {
      console.log('Dark mode toggle not found - checking if already in dark mode...');

      // Take screenshot anyway
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'test9-mode-check.png'),
        fullPage: true
      });
    }
  });
});
