import { test } from '@playwright/test';

test('debug - monitor all network requests', async ({ page }) => {
  // Capture ALL network requests
  const requests: string[] = [];

  page.on('request', request => {
    requests.push(`${request.method()} ${request.url()}`);
  });

  page.on('response', async response => {
    console.log(`Response: ${response.status()} ${response.url()}`);
  });

  await page.goto('http://localhost:5181');
  await page.waitForTimeout(3000);

  console.log('\n=== All Network Requests ===');
  requests.forEach(req => console.log(req));
  console.log('===========================\n');

  // Check if /health was called
  const healthCalls = requests.filter(r => r.includes('/health'));
  console.log('Health check calls:', healthCalls.length);
});
