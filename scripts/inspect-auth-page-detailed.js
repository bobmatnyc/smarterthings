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

  // Collect network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()
    });
  });

  try {
    console.log('Navigating to http://localhost:5181/auth...');
    await page.goto('http://localhost:5181/auth', { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    console.log('\n=== PAGE INFO ===');
    console.log('Title:', await page.title());
    console.log('URL:', page.url());

    // Find all buttons
    console.log('\n=== BUTTON ELEMENTS ===');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} button(s)`);

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const isVisible = await button.isVisible();
      const isEnabled = await button.isEnabled();

      // Try to get onclick handler
      const hasClickHandler = await button.evaluate(el => {
        return typeof el.onclick === 'function' || el.hasAttribute('onclick');
      });

      console.log(`\nButton ${i + 1}:`);
      console.log(`  Text: "${text.trim()}"`);
      console.log(`  Visible: ${isVisible}`);
      console.log(`  Enabled: ${isEnabled}`);
      console.log(`  Has click handler: ${hasClickHandler}`);
    }

    // Try to find the specific button by text
    console.log('\n=== CONNECT BUTTON TEST ===');
    const connectButton = await page.getByText('Connect SmartThings Account').first();

    if (connectButton) {
      console.log('Found "Connect SmartThings Account" button');

      // Clear existing console messages
      consoleMessages.length = 0;

      // Try to click the button
      console.log('Attempting to click button...');
      await connectButton.click();

      // Wait for navigation or any response
      try {
        await page.waitForURL(/auth\/smartthings/, { timeout: 3000 });
        console.log('SUCCESS: Redirected to auth/smartthings');
        console.log('New URL:', page.url());
      } catch (e) {
        console.log('Did not redirect to auth/smartthings within 3 seconds');
        console.log('Current URL:', page.url());
      }
    } else {
      console.log('Could not find "Connect SmartThings Account" button');
    }

    // Print console messages after click
    console.log('\n=== CONSOLE MESSAGES (after click) ===');
    if (consoleMessages.length === 0) {
      console.log('No new console messages');
    } else {
      consoleMessages.forEach((msg, idx) => {
        console.log(`[${idx + 1}] ${msg.type.toUpperCase()}: ${msg.text}`);
        if (msg.location && msg.location.url) {
          console.log(`    Location: ${msg.location.url}:${msg.location.lineNumber}`);
        }
      });
    }

    // Print page errors
    console.log('\n=== JAVASCRIPT ERRORS ===');
    if (pageErrors.length === 0) {
      console.log('No JavaScript errors detected');
    } else {
      pageErrors.forEach((error, idx) => {
        console.log(`\n[ERROR ${idx + 1}] ${error.message}`);
        if (error.stack) {
          console.log(error.stack);
        }
      });
    }

    // Print network errors
    console.log('\n=== NETWORK ERRORS ===');
    if (networkErrors.length === 0) {
      console.log('No network errors detected');
    } else {
      networkErrors.forEach((error, idx) => {
        console.log(`\n[NET ERROR ${idx + 1}] ${error.url}`);
        console.log(`  Failure: ${error.failure?.errorText || 'Unknown'}`);
      });
    }

  } catch (error) {
    console.error('\n=== SCRIPT ERROR ===');
    console.error('Error during inspection:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
