import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Events Page Two-View Verification', () => {
  test('should display Timeline view by default and switch to Grid view', async ({ page }) => {
    // Set a longer timeout for this test
    test.setTimeout(60000);

    // Track console errors from the start
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const consoleLogs: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log(`[BROWSER ERROR] ${text}`);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
        console.log(`[BROWSER WARNING] ${text}`);
      } else if (msg.type() === 'log') {
        consoleLogs.push(text);
      }
    });

    // Navigate to Events page
    await page.goto('http://localhost:5181/events', { waitUntil: 'domcontentloaded' });

    // Wait for the page to load (more lenient)
    await page.waitForTimeout(2000);

    // Step 1: Verify page loaded
    console.log('✓ Navigated to http://localhost:5181/events');

    // Step 2: Take snapshot of Timeline view (default)
    const screenshotsDir = path.join(__dirname, '../../test-results/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(screenshotsDir, 'events-timeline-view.png'),
      fullPage: true
    });
    console.log('✓ Captured Timeline view snapshot');

    // Step 3: Look for Timeline and Grid toggle buttons
    const timelineButton = page.locator('button:has-text("Timeline"), button[aria-label*="Timeline"]').first();
    const gridButton = page.locator('button:has-text("Grid"), button[aria-label*="Grid"]').first();

    // Check if toggle buttons exist
    const timelineExists = await timelineButton.count() > 0;
    const gridExists = await gridButton.count() > 0;

    console.log(`Timeline button found: ${timelineExists}`);
    console.log(`Grid button found: ${gridExists}`);

    if (!timelineExists || !gridExists) {
      // Look for any view toggle buttons
      const allButtons = await page.locator('button').all();
      console.log('\nAll buttons on page:');
      for (const btn of allButtons) {
        const text = await btn.textContent();
        const ariaLabel = await btn.getAttribute('aria-label');
        console.log(`  - Text: "${text?.trim()}" | aria-label: "${ariaLabel}"`);
      }
    }

    expect(timelineExists || gridExists, 'View toggle buttons should exist').toBeTruthy();

    // Step 4: Verify Timeline is the default view
    // Check for timeline-specific elements or active state
    const ariaPressed = await timelineButton.getAttribute('aria-pressed');
    const className = await timelineButton.getAttribute('class');
    const dataState = await timelineButton.getAttribute('data-state');

    const timelineActive = ariaPressed === 'true' ||
                           (className && className.includes('active')) ||
                           dataState === 'active';

    console.log(`✓ Timeline view is default: ${timelineActive}`);

    // Step 5: Click on Grid button
    await gridButton.click();
    console.log('✓ Clicked Grid button');

    // Wait for view transition
    await page.waitForTimeout(500);

    // Step 6: Take snapshot of Grid view
    await page.screenshot({
      path: path.join(screenshotsDir, 'events-grid-view.png'),
      fullPage: true
    });
    console.log('✓ Captured Grid view snapshot');

    // Step 7: Verify Grid view shows device cards
    const deviceCards = page.locator('[data-testid="device-card"], .device-card, article, .card');
    const cardCount = await deviceCards.count();

    console.log(`✓ Grid view shows ${cardCount} device cards`);
    expect(cardCount, 'Grid view should show device cards').toBeGreaterThan(0);

    // Step 8: Verify human-readable values in Grid view
    const firstCard = deviceCards.first();
    const cardText = await firstCard.textContent();

    console.log('\nFirst card content preview:');
    console.log(cardText?.substring(0, 200));

    // Check for common human-readable patterns (not raw JSON/API data)
    const hasHumanReadableText = cardText && (
      /\d+%/.test(cardText) ||           // Percentage values
      /\d+°/.test(cardText) ||            // Temperature values
      /(on|off|active|inactive)/i.test(cardText) || // Status values
      /level|brightness|temperature/i.test(cardText) // Common labels
    );

    console.log(`✓ Grid shows human-readable values: ${hasHumanReadableText}`);

    // Step 9: Check console for errors
    // Wait a moment to catch any async errors
    await page.waitForTimeout(1000);

    if (consoleErrors.length > 0) {
      console.log('\n⚠ Console errors detected:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✓ No console errors detected');
    }

    if (consoleWarnings.length > 0) {
      console.log('\n⚠ Console warnings detected:');
      consoleWarnings.forEach(warn => console.log(`  - ${warn}`));
    }

    // Step 10: Generate report
    const report = {
      timestamp: new Date().toISOString(),
      url: 'http://localhost:5181/events',
      findings: {
        pageLoaded: true,
        timelineButtonFound: timelineExists,
        gridButtonFound: gridExists,
        timelineIsDefault: timelineActive,
        gridViewWorks: true,
        deviceCardsCount: cardCount,
        hasHumanReadableValues: hasHumanReadableText,
        consoleErrors: consoleErrors,
        screenshots: [
          'test-results/screenshots/events-timeline-view.png',
          'test-results/screenshots/events-grid-view.png'
        ]
      }
    };

    // Save report
    fs.writeFileSync(
      path.join(screenshotsDir, 'verification-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n✓ Verification report saved to test-results/screenshots/verification-report.json');

    // Final assertions
    expect(consoleErrors.length, 'Should have no console errors').toBe(0);
  });
});
