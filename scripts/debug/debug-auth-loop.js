/**
 * Debug Auth Loop Script
 *
 * This script navigates to /auth and monitors:
 * 1. Console messages
 * 2. Network requests
 * 3. Redirect behavior
 */

import { chromium } from 'playwright';

async function debugAuthLoop() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
  });

  // Collect network requests
  const networkRequests = [];
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      timestamp: new Date().toISOString()
    });
  });

  // Collect network responses
  const networkResponses = [];
  page.on('response', async response => {
    const request = response.request();
    let body = null;

    try {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/json')) {
        body = await response.json();
      }
    } catch (e) {
      // Ignore parse errors
    }

    networkResponses.push({
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      body: body,
      timestamp: new Date().toISOString()
    });
  });

  // Monitor navigation events
  const navigationEvents = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navigationEvents.push({
        url: frame.url(),
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('\n🔍 Navigating to http://localhost:5181/auth...\n');

  try {
    // Navigate to auth page with increased timeout
    await page.goto('http://localhost:5181/auth', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Wait a bit to see if any redirects happen
    await page.waitForTimeout(3000);

    // Get final URL
    const finalUrl = page.url();

    console.log('\n📊 DIAGNOSTIC RESULTS:\n');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Final URL: ${finalUrl}`);
    console.log(`Expected: http://localhost:5181/auth`);
    console.log(`Redirect detected: ${finalUrl !== 'http://localhost:5181/auth'}\n`);

    console.log('═══ NAVIGATION EVENTS ═══');
    navigationEvents.forEach(event => {
      console.log(`[${event.timestamp}] ${event.url}`);
    });
    console.log();

    console.log('═══ CONSOLE MESSAGES ═══');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.timestamp}] [${msg.type}] ${msg.text}`);
    });
    console.log();

    console.log('═══ NETWORK REQUESTS ═══');
    // Filter out non-app requests (webpack, vite, etc.)
    const appRequests = networkRequests.filter(req =>
      !req.url.includes('/__vite_ping') &&
      !req.url.includes('/node_modules/') &&
      !req.url.includes('/@vite/') &&
      !req.url.includes('@fs/')
    );
    appRequests.forEach(req => {
      console.log(`[${req.timestamp}] ${req.method} ${req.url}`);
    });
    console.log();

    console.log('═══ API RESPONSES (with 401) ═══');
    const apiResponses = networkResponses.filter(res =>
      res.url.includes('/api/') || res.status === 401
    );
    apiResponses.forEach(res => {
      console.log(`[${res.timestamp}] ${res.status} ${res.statusText} - ${res.url}`);
      if (res.body) {
        console.log(`  Body:`, JSON.stringify(res.body, null, 2));
      }
    });
    console.log();

    console.log('═══════════════════════════════════════════════════════\n');

    // Keep browser open for 5 seconds for manual inspection
    console.log('⏳ Keeping browser open for 5 seconds...\n');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await browser.close();
  }
}

debugAuthLoop().catch(console.error);
