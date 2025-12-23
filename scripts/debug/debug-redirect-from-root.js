/**
 * Debug Redirect Loop from Root
 *
 * Test the flow: / → 401 → /auth?reason=session_expired
 * This simulates what happens when a user visits the app with an invalid PAT
 */

import { chromium } from 'playwright';

async function debugRedirectFromRoot() {
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

  // Collect network requests and responses
  const apiCalls = [];
  page.on('response', async response => {
    const url = response.url();

    // Only track API calls and health checks
    if (url.includes('/api/') || url.includes('/health')) {
      let body = null;
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          body = await response.json();
        }
      } catch (e) {
        // Ignore
      }

      apiCalls.push({
        url: url,
        status: response.status(),
        statusText: response.statusText(),
        body: body,
        timestamp: new Date().toISOString()
      });
    }
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

  console.log('\n🔍 Testing redirect flow: / → /auth...\n');

  try {
    // Navigate to root (should trigger 401 and redirect to /auth)
    await page.goto('http://localhost:5181/', {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    // Wait to see if redirect loop happens
    await page.waitForTimeout(5000);

    const finalUrl = page.url();

    console.log('\n📊 DIAGNOSTIC RESULTS:\n');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Final URL: ${finalUrl}`);
    console.log(`Expected: http://localhost:5181/auth or http://localhost:5181/auth?reason=session_expired\n`);

    console.log('═══ NAVIGATION FLOW ═══');
    navigationEvents.forEach((event, i) => {
      console.log(`${i + 1}. [${event.timestamp}] ${event.url}`);
    });
    console.log();

    if (navigationEvents.length > 3) {
      console.log('⚠️  WARNING: Multiple navigations detected! Possible redirect loop.\n');
    }

    console.log('═══ API CALLS & HEALTH CHECKS ═══');
    apiCalls.forEach((call, i) => {
      console.log(`${i + 1}. [${call.timestamp}] ${call.status} ${call.url}`);
      if (call.body) {
        console.log(`   Response:`, JSON.stringify(call.body, null, 2));
      }
    });
    console.log();

    console.log('═══ CONSOLE MESSAGES (filtered) ═══');
    const relevantMessages = consoleMessages.filter(msg =>
      msg.text.includes('401') ||
      msg.text.includes('redirect') ||
      msg.text.includes('auth') ||
      msg.text.includes('ApiClient') ||
      msg.text.includes('session')
    );
    relevantMessages.forEach(msg => {
      console.log(`[${msg.timestamp}] [${msg.type}] ${msg.text}`);
    });
    console.log();

    console.log('═══ ANALYSIS ═══');
    const hasLoop = navigationEvents.length > 3;
    const has401 = apiCalls.some(c => c.status === 401);
    const reachedAuth = finalUrl.includes('/auth');

    console.log(`Redirect loop detected: ${hasLoop ? '❌ YES' : '✅ NO'}`);
    console.log(`401 response received: ${has401 ? '✅ YES' : '❌ NO'}`);
    console.log(`Reached auth page: ${reachedAuth ? '✅ YES' : '❌ NO'}`);
    console.log();

    console.log('═══════════════════════════════════════════════════════\n');

    // Keep browser open for manual inspection
    console.log('⏳ Keeping browser open for 10 seconds...\n');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await browser.close();
  }
}

debugRedirectFromRoot().catch(console.error);
