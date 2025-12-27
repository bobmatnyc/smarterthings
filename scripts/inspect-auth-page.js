import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  try {
    console.log('Navigating to http://localhost:5181/auth...');
    await page.goto('http://localhost:5181/auth', { waitUntil: 'networkidle', timeout: 10000 });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: '/Users/masa/Projects/smarterthings/test-results/screenshots/auth-page-inspection.png', fullPage: true });
    console.log('Screenshot saved to test-results/screenshots/auth-page-inspection.png');

    // Get page title
    const title = await page.title();
    console.log('\n=== PAGE INFO ===');
    console.log('Title:', title);
    console.log('URL:', page.url());

    // Check for the button
    console.log('\n=== BUTTON CHECK ===');
    const button = await page.$('a[href="/auth/smartthings"]');
    if (button) {
      const buttonText = await button.textContent();
      const isVisible = await button.isVisible();
      console.log('Button found:', buttonText);
      console.log('Button visible:', isVisible);

      // Get button attributes
      const href = await button.getAttribute('href');
      console.log('Button href:', href);
    } else {
      console.log('Button NOT found with selector: a[href="/auth/smartthings"]');

      // Try to find any links
      const allLinks = await page.$$('a');
      console.log(`Found ${allLinks.length} links on page`);
      for (const link of allLinks) {
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        console.log(`  - "${text.trim()}" -> ${href}`);
      }
    }

    // Print all console messages
    console.log('\n=== CONSOLE MESSAGES ===');
    if (consoleMessages.length === 0) {
      console.log('No console messages');
    } else {
      consoleMessages.forEach((msg, idx) => {
        console.log(`[${idx + 1}] ${msg.type.toUpperCase()}: ${msg.text}`);
        if (msg.location && msg.location.url) {
          console.log(`    Location: ${msg.location.url}:${msg.location.lineNumber}:${msg.location.columnNumber}`);
        }
      });
    }

    // Print page errors
    console.log('\n=== PAGE ERRORS ===');
    if (pageErrors.length === 0) {
      console.log('No page errors');
    } else {
      pageErrors.forEach((error, idx) => {
        console.log(`[${idx + 1}] ${error.message}`);
        if (error.stack) {
          console.log(error.stack);
        }
      });
    }

    // Try to get the page HTML to see what's actually there
    console.log('\n=== PAGE HTML (body) ===');
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log(bodyHTML.substring(0, 500) + '...');

  } catch (error) {
    console.error('Error during inspection:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
