/**
 * Debug Auth Page with Session Expired Reason
 *
 * Test accessing /auth?reason=session_expired directly
 * This simulates what happens when apiClient.ts redirects on 401
 */

import { chromium } from 'playwright';

async function debugAuthWithReason() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect everything
  const consoleMessages = [];
  const apiCalls = [];
  const navigationEvents = [];

  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('response', async response => {
    const url = response.url();
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
        body: body,
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navigationEvents.push({
        url: frame.url(),
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('\n🔍 Testing: /auth?reason=session_expired\n');

  try {
    await page.goto('http://localhost:5181/auth?reason=session_expired', {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    // Wait for any potential redirects
    await page.waitForTimeout(5000);

    const finalUrl = page.url();

    console.log('\n📊 DIAGNOSTIC RESULTS:\n');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Starting URL: http://localhost:5181/auth?reason=session_expired`);
    console.log(`Final URL: ${finalUrl}\n`);

    console.log('═══ NAVIGATION FLOW ═══');
    navigationEvents.forEach((event, i) => {
      console.log(`${i + 1}. [${event.timestamp}] ${event.url}`);
    });
    console.log();

    if (navigationEvents.length > 3) {
      console.log('⚠️  WARNING: Multiple navigations detected! This is the redirect loop!\n');
    }

    console.log('═══ API CALLS ═══');
    apiCalls.forEach((call, i) => {
      console.log(`${i + 1}. [${call.timestamp}] ${call.status} ${call.url}`);
      if (call.body && (call.status === 401 || !call.body.success)) {
        console.log(`   Response:`, JSON.stringify(call.body, null, 2));
      }
    });
    console.log();

    console.log('═══ CONSOLE MESSAGES (auth/redirect/401 only) ═══');
    const relevantMessages = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('401') ||
      msg.text.toLowerCase().includes('redirect') ||
      msg.text.toLowerCase().includes('auth') ||
      msg.text.toLowerCase().includes('apiclient') ||
      msg.text.toLowerCase().includes('session') ||
      msg.text.toLowerCase().includes('unauthorized')
    );
    relevantMessages.forEach(msg => {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
    });
    console.log();

    console.log('═══ ANALYSIS ═══');
    const hasLoop = navigationEvents.length > 3;
    const has401Calls = apiCalls.filter(c => c.status === 401).length;
    const sessionExpiredVisible = await page.locator('text="Your session has expired"').isVisible().catch(() => false);

    console.log(`Redirect loop detected: ${hasLoop ? '❌ YES - FOUND THE ISSUE!' : '✅ NO'}`);
    console.log(`Number of 401 API calls: ${has401Calls}`);
    console.log(`"Session expired" message visible: ${sessionExpiredVisible ? '✅ YES' : '❌ NO'}`);
    console.log();

    if (has401Calls > 0) {
      console.log('🔍 ROOT CAUSE:');
      console.log('The auth page (or its components) is making API calls that return 401.');
      console.log('These 401 responses trigger apiClient.handleAuthError() which redirects back to /auth.');
      console.log('This creates the infinite loop.\n');
    }

    console.log('═══════════════════════════════════════════════════════\n');

    console.log('⏳ Keeping browser open for 10 seconds...\n');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await browser.close();
  }
}

debugAuthWithReason().catch(console.error);
