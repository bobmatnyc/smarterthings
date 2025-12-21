/**
 * Frontend UAT Test - Comprehensive UI Testing
 *
 * Tests frontend application against requirements:
 * 1. Page load verification
 * 2. API integration testing
 * 3. Component rendering
 * 4. SSE connection
 * 5. Console logs analysis
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5181';
const API_BASE_URL = 'http://localhost:5182';

test.describe('Frontend UAT - Complete Application Testing', () => {
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  let networkRequests: { url: string; status: number; method: string }[] = [];
  let failedRequests: { url: string; status: number; error?: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear tracking arrays
    consoleMessages = [];
    consoleErrors = [];
    consoleWarnings = [];
    networkRequests = [];
    failedRequests = [];

    // Capture console logs
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);

      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Capture network requests
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const request = response.request();

      networkRequests.push({
        url,
        status,
        method: request.method()
      });

      // Track failed requests (4xx, 5xx)
      if (status >= 400) {
        failedRequests.push({
          url,
          status,
          error: await response.text().catch(() => 'Unable to read response')
        });
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`PAGE ERROR: ${error.message}\n${error.stack}`);
    });
  });

  test('1. Page Load Verification', async ({ page }) => {
    console.log('\n=== TEST 1: PAGE LOAD VERIFICATION ===');

    // Navigate to homepage
    const response = await page.goto(FRONTEND_URL);

    // Verify page loads successfully
    expect(response?.status()).toBeLessThan(400);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/qa-frontend-test-2025-12-05/01-homepage.png',
      fullPage: true
    });

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Print console errors found during load
    console.log(`Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors.slice(0, 5));
    }
  });

  test('2. API Integration Testing', async ({ page }) => {
    console.log('\n=== TEST 2: API INTEGRATION TESTING ===');

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait a bit for any async API calls
    await page.waitForTimeout(2000);

    // Check for API requests
    const apiRequests = networkRequests.filter(req =>
      req.url.includes('/api/')
    );

    console.log(`\nTotal network requests: ${networkRequests.length}`);
    console.log(`API requests: ${apiRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    // Log API requests
    if (apiRequests.length > 0) {
      console.log('\nAPI Requests:');
      apiRequests.forEach(req => {
        console.log(`  ${req.method} ${req.url} - Status: ${req.status}`);
      });
    }

    // Log failed requests
    if (failedRequests.length > 0) {
      console.log('\nFailed Requests:');
      failedRequests.forEach(req => {
        console.log(`  ${req.url} - Status: ${req.status}`);
        if (req.error && req.error.length < 200) {
          console.log(`  Error: ${req.error}`);
        }
      });
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-results/qa-frontend-test-2025-12-05/02-api-integration.png',
      fullPage: true
    });
  });

  test('3. Component Rendering', async ({ page }) => {
    console.log('\n=== TEST 3: COMPONENT RENDERING ===');

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check for key page elements
    const navigation = await page.locator('nav').count();
    console.log(`Navigation elements: ${navigation}`);

    const main = await page.locator('main').count();
    console.log(`Main content elements: ${main}`);

    // Check for common UI patterns
    const buttons = await page.locator('button').count();
    console.log(`Buttons: ${buttons}`);

    const links = await page.locator('a').count();
    console.log(`Links: ${links}`);

    // Check for loading states
    const loading = await page.locator('[data-loading], [aria-busy="true"], .skeleton, .loading').count();
    console.log(`Loading indicators: ${loading}`);

    // Check for error messages
    const errors = await page.locator('[role="alert"], .error, .alert-error').count();
    console.log(`Error messages visible: ${errors}`);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/qa-frontend-test-2025-12-05/03-components.png',
      fullPage: true
    });
  });

  test('4. SSE Connection Verification', async ({ page }) => {
    console.log('\n=== TEST 4: SSE CONNECTION VERIFICATION ===');

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait for SSE connection attempts
    await page.waitForTimeout(3000);

    // Check for SSE requests
    const sseRequests = networkRequests.filter(req =>
      req.url.includes('/api/events/stream') ||
      req.url.includes('/sse')
    );

    console.log(`SSE connection attempts: ${sseRequests.length}`);
    if (sseRequests.length > 0) {
      sseRequests.forEach(req => {
        console.log(`  ${req.url} - Status: ${req.status}`);
      });
    }

    // Check for EventSource in console logs
    const eventSourceLogs = consoleMessages.filter(msg =>
      msg.toLowerCase().includes('eventsource') ||
      msg.toLowerCase().includes('sse') ||
      msg.toLowerCase().includes('event stream')
    );

    if (eventSourceLogs.length > 0) {
      console.log('\nEventSource related logs:');
      eventSourceLogs.forEach(log => console.log(`  ${log}`));
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-results/qa-frontend-test-2025-12-05/04-sse-connection.png',
      fullPage: true
    });
  });

  test('5. Console Logs Analysis', async ({ page }) => {
    console.log('\n=== TEST 5: CONSOLE LOGS ANALYSIS ===');

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait for app to initialize
    await page.waitForTimeout(3000);

    console.log(`\nTotal console messages: ${consoleMessages.length}`);
    console.log(`Errors: ${consoleErrors.length}`);
    console.log(`Warnings: ${consoleWarnings.length}`);

    // Print errors
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    // Print warnings
    if (consoleWarnings.length > 0) {
      console.log('\n=== CONSOLE WARNINGS ===');
      consoleWarnings.slice(0, 10).forEach((warning, i) => {
        console.log(`${i + 1}. ${warning}`);
      });
    }

    // Print all messages to file
    const fs = require('fs');
    const logsPath = 'test-results/qa-frontend-test-2025-12-05/console-logs.txt';
    fs.writeFileSync(logsPath, [
      '=== ALL CONSOLE MESSAGES ===\n',
      ...consoleMessages.map((msg, i) => `${i + 1}. ${msg}\n`),
      '\n=== CONSOLE ERRORS ===\n',
      ...consoleErrors.map((err, i) => `${i + 1}. ${err}\n`),
      '\n=== CONSOLE WARNINGS ===\n',
      ...consoleWarnings.map((warn, i) => `${i + 1}. ${warn}\n`),
      '\n=== NETWORK REQUESTS ===\n',
      ...networkRequests.map((req, i) => `${i + 1}. ${req.method} ${req.url} - ${req.status}\n`),
      '\n=== FAILED REQUESTS ===\n',
      ...failedRequests.map((req, i) => `${i + 1}. ${req.url} - ${req.status}\n${req.error}\n\n`)
    ].join(''));

    console.log(`\nFull logs saved to: ${logsPath}`);

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/qa-frontend-test-2025-12-05/05-final-state.png',
      fullPage: true
    });
  });

  test.afterAll(async () => {
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Console warnings: ${consoleWarnings.length}`);
    console.log(`Network requests: ${networkRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);
  });
});
