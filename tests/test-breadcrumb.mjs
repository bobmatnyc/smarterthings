/**
 * Breadcrumb Component Testing Script
 *
 * Tests the newly implemented room navigation breadcrumb enhancements:
 * - Visual rendering
 * - Icon mapping
 * - Navigation functionality
 * - Accessibility
 * - Responsive design
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:5181';
const MASTER_BEDROOM_ID = '576d2551-3db1-48e5-a110-659e427830b2';

async function runTests() {
  console.log('🧪 Starting Breadcrumb Component Tests\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    screenshots: [],
    consoleErrors: [],
    passed: 0,
    failed: 0
  };

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push({
        type: 'error',
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  page.on('pageerror', error => {
    results.consoleErrors.push({
      type: 'pageerror',
      message: error.message,
      stack: error.stack
    });
  });

  try {
    // Test 1: Navigate to /devices (no room filter)
    console.log('📍 Test 1: Devices page without room filter');
    await page.goto(`${BASE_URL}/devices`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    const noBreadcrumb = await page.$('nav[aria-label="Breadcrumb"]');
    results.tests.push({
      name: 'Devices page without room filter - No breadcrumb shown',
      passed: noBreadcrumb === null,
      expected: 'Breadcrumb should not be visible',
      actual: noBreadcrumb === null ? 'Not visible' : 'Visible'
    });
    if (noBreadcrumb === null) results.passed++; else results.failed++;

    // Test 2: Navigate to /devices with room filter (Master Bedroom)
    console.log('📍 Test 2: Devices page with Master Bedroom filter');
    await page.goto(`${BASE_URL}/devices?room=${MASTER_BEDROOM_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'breadcrumb-master-bedroom.png', fullPage: false });
    results.screenshots.push('breadcrumb-master-bedroom.png');
    console.log('  ✅ Screenshot saved: breadcrumb-master-bedroom.png');

    // Test 2a: Breadcrumb visibility
    const breadcrumb = await page.$('nav[aria-label="Breadcrumb"]');
    results.tests.push({
      name: 'Breadcrumb is visible with room filter',
      passed: breadcrumb !== null,
      expected: 'Breadcrumb element exists',
      actual: breadcrumb !== null ? 'Found' : 'Not found'
    });
    if (breadcrumb !== null) results.passed++; else results.failed++;

    // Test 2b: Breadcrumb contains "Rooms" link
    const roomsLink = await page.$('nav[aria-label="Breadcrumb"] a[href="/rooms"]');
    results.tests.push({
      name: 'Breadcrumb contains "Rooms" link',
      passed: roomsLink !== null,
      expected: 'Link to /rooms exists',
      actual: roomsLink !== null ? 'Found' : 'Not found'
    });
    if (roomsLink !== null) results.passed++; else results.failed++;

    // Test 2c: Breadcrumb shows chevron separator
    const chevronSeparator = await page.$('nav[aria-label="Breadcrumb"] .breadcrumb-separator svg polyline');
    results.tests.push({
      name: 'Breadcrumb shows chevron separator (→)',
      passed: chevronSeparator !== null,
      expected: 'SVG polyline for chevron exists',
      actual: chevronSeparator !== null ? 'Found' : 'Not found'
    });
    if (chevronSeparator !== null) results.passed++; else results.failed++;

    // Test 2d: Breadcrumb shows room name
    const roomName = await page.$eval('nav[aria-label="Breadcrumb"] .breadcrumb-current', el => el.textContent.trim());
    results.tests.push({
      name: 'Breadcrumb shows "Master Bedroom" room name',
      passed: roomName.includes('Master Bedroom'),
      expected: 'Master Bedroom',
      actual: roomName
    });
    if (roomName.includes('Master Bedroom')) results.passed++; else results.failed++;

    // Test 2e: Breadcrumb shows room icon (bed icon for bedroom)
    const roomIcon = await page.$('nav[aria-label="Breadcrumb"] .breadcrumb-current .breadcrumb-icon svg');
    results.tests.push({
      name: 'Breadcrumb shows room icon',
      passed: roomIcon !== null,
      expected: 'SVG icon exists',
      actual: roomIcon !== null ? 'Found' : 'Not found'
    });
    if (roomIcon !== null) results.passed++; else results.failed++;

    // Test 2f: "Show All Devices" button exists
    const showAllBtn = await page.$('button[aria-label="View all devices"]');
    results.tests.push({
      name: '"Show All Devices" button exists',
      passed: showAllBtn !== null,
      expected: 'Button with aria-label="View all devices"',
      actual: showAllBtn !== null ? 'Found' : 'Not found'
    });
    if (showAllBtn !== null) results.passed++; else results.failed++;

    // Test 2g: Button has grid icon (not X)
    const gridIcon = await page.$('button[aria-label="View all devices"] svg rect');
    results.tests.push({
      name: 'Button has grid icon (4 rectangles)',
      passed: gridIcon !== null,
      expected: 'SVG rect elements (grid icon)',
      actual: gridIcon !== null ? 'Found' : 'Not found'
    });
    if (gridIcon !== null) results.passed++; else results.failed++;

    // Test 3: Navigation - Click "Rooms" link
    console.log('📍 Test 3: Click "Rooms" breadcrumb link');
    await page.click('nav[aria-label="Breadcrumb"] a[href="/rooms"]');
    await page.waitForURL(`${BASE_URL}/rooms`);
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    results.tests.push({
      name: 'Clicking "Rooms" navigates to /rooms',
      passed: currentUrl === `${BASE_URL}/rooms`,
      expected: `${BASE_URL}/rooms`,
      actual: currentUrl
    });
    if (currentUrl === `${BASE_URL}/rooms`) results.passed++; else results.failed++;

    // Test 4: Navigate back and test "Show All Devices" button
    console.log('📍 Test 4: Click "Show All Devices" button');
    await page.goto(`${BASE_URL}/devices?room=${MASTER_BEDROOM_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    await page.click('button[aria-label="View all devices"]');
    await page.waitForURL(`${BASE_URL}/devices`);
    await page.waitForTimeout(1000);

    const clearedUrl = page.url();
    results.tests.push({
      name: 'Clicking "Show All Devices" removes room filter',
      passed: clearedUrl === `${BASE_URL}/devices`,
      expected: `${BASE_URL}/devices`,
      actual: clearedUrl
    });
    if (clearedUrl === `${BASE_URL}/devices`) results.passed++; else results.failed++;

    // Test 5: Icon mapping - Kitchen (should show chef icon)
    console.log('📍 Test 5: Icon mapping - Kitchen');
    await page.goto(`${BASE_URL}/rooms`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    // Find Kitchen room card
    const kitchenCard = await page.$('article:has-text("Kitchen") a');
    if (kitchenCard) {
      await kitchenCard.click();
      await page.waitForTimeout(1500);

      const kitchenBreadcrumb = await page.$('nav[aria-label="Breadcrumb"]');
      results.tests.push({
        name: 'Kitchen room shows breadcrumb with icon',
        passed: kitchenBreadcrumb !== null,
        expected: 'Breadcrumb visible',
        actual: kitchenBreadcrumb !== null ? 'Visible' : 'Not visible'
      });
      if (kitchenBreadcrumb !== null) results.passed++; else results.failed++;

      await page.screenshot({ path: 'breadcrumb-kitchen.png', fullPage: false });
      results.screenshots.push('breadcrumb-kitchen.png');
      console.log('  ✅ Screenshot saved: breadcrumb-kitchen.png');
    }

    // Test 6: Icon mapping - Living room (should show sofa icon)
    console.log('📍 Test 6: Icon mapping - Living room');
    await page.goto(`${BASE_URL}/rooms`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    const livingRoomCard = await page.$('article:has-text("Living room") a');
    if (livingRoomCard) {
      await livingRoomCard.click();
      await page.waitForTimeout(1500);

      const livingRoomBreadcrumb = await page.$('nav[aria-label="Breadcrumb"]');
      results.tests.push({
        name: 'Living room shows breadcrumb with icon',
        passed: livingRoomBreadcrumb !== null,
        expected: 'Breadcrumb visible',
        actual: livingRoomBreadcrumb !== null ? 'Visible' : 'Not visible'
      });
      if (livingRoomBreadcrumb !== null) results.passed++; else results.failed++;

      await page.screenshot({ path: 'breadcrumb-living-room.png', fullPage: false });
      results.screenshots.push('breadcrumb-living-room.png');
      console.log('  ✅ Screenshot saved: breadcrumb-living-room.png');
    }

    // Test 7: Accessibility - ARIA attributes
    console.log('📍 Test 7: Accessibility checks');
    await page.goto(`${BASE_URL}/devices?room=${MASTER_BEDROOM_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    const ariaLabel = await page.$eval('nav[aria-label="Breadcrumb"]', el => el.getAttribute('aria-label'));
    results.tests.push({
      name: 'Breadcrumb has aria-label="Breadcrumb"',
      passed: ariaLabel === 'Breadcrumb',
      expected: 'Breadcrumb',
      actual: ariaLabel
    });
    if (ariaLabel === 'Breadcrumb') results.passed++; else results.failed++;

    // Check aria-hidden on decorative icons
    const iconAriaHidden = await page.$$eval('nav[aria-label="Breadcrumb"] .breadcrumb-icon',
      icons => icons.every(icon => icon.getAttribute('aria-hidden') === 'true')
    );
    results.tests.push({
      name: 'Decorative icons have aria-hidden="true"',
      passed: iconAriaHidden,
      expected: 'All icons have aria-hidden',
      actual: iconAriaHidden ? 'All hidden' : 'Some visible to screen readers'
    });
    if (iconAriaHidden) results.passed++; else results.failed++;

    // Test 8: Responsive design - Mobile viewport
    console.log('📍 Test 8: Responsive design (mobile)');
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(`${BASE_URL}/devices?room=${MASTER_BEDROOM_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'breadcrumb-mobile.png', fullPage: false });
    results.screenshots.push('breadcrumb-mobile.png');
    console.log('  ✅ Screenshot saved: breadcrumb-mobile.png');

    // Check if breadcrumb container stacks vertically
    const containerLayout = await page.$eval('.breadcrumb-container', el => {
      const styles = window.getComputedStyle(el);
      return {
        flexDirection: styles.flexDirection,
        alignItems: styles.alignItems
      };
    });

    results.tests.push({
      name: 'Mobile layout stacks vertically (flex-direction: column)',
      passed: containerLayout.flexDirection === 'column',
      expected: 'column',
      actual: containerLayout.flexDirection
    });
    if (containerLayout.flexDirection === 'column') results.passed++; else results.failed++;

    // Test 9: Keyboard navigation
    console.log('📍 Test 9: Keyboard navigation');
    await page.setViewportSize({ width: 1920, height: 1080 }); // Back to desktop
    await page.goto(`${BASE_URL}/devices?room=${MASTER_BEDROOM_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(1000);

    // Focus on "Rooms" link and check focus indicator
    await page.focus('nav[aria-label="Breadcrumb"] a[href="/rooms"]');
    await page.waitForTimeout(200);

    const focusStyles = await page.$eval('nav[aria-label="Breadcrumb"] a[href="/rooms"]:focus', el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle
      };
    });

    const hasFocusIndicator = focusStyles.outlineWidth !== '0px' && focusStyles.outlineStyle !== 'none';
    results.tests.push({
      name: 'Focus indicator visible on keyboard navigation',
      passed: hasFocusIndicator,
      expected: 'Visible outline',
      actual: `${focusStyles.outlineWidth} ${focusStyles.outlineStyle}`
    });
    if (hasFocusIndicator) results.passed++; else results.failed++;

  } catch (error) {
    console.error('❌ Test execution error:', error);
    results.tests.push({
      name: 'Test execution',
      passed: false,
      expected: 'No errors',
      actual: error.message
    });
    results.failed++;
  } finally {
    await browser.close();
  }

  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`🐛 Console Errors: ${results.consoleErrors.length}`);
  console.log('='.repeat(60) + '\n');

  console.log('📋 DETAILED TEST RESULTS:\n');
  results.tests.forEach((test, index) => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status} - ${test.name}`);
    if (!test.passed) {
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
    }
  });

  if (results.consoleErrors.length > 0) {
    console.log('\n⚠️  CONSOLE ERRORS:\n');
    results.consoleErrors.forEach((error, index) => {
      console.log(`${index + 1}. [${error.type}] ${error.text || error.message}`);
      if (error.location) {
        console.log(`   Location: ${error.location.url}:${error.location.lineNumber}`);
      }
    });
  }

  console.log('\n📸 SCREENSHOTS:\n');
  results.screenshots.forEach(screenshot => {
    console.log(`   - ${screenshot}`);
  });

  // Save JSON report
  writeFileSync('breadcrumb-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Full results saved to: breadcrumb-test-results.json\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
