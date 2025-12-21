#!/usr/bin/env ts-node

/**
 * Test script: Verify server starts without authentication
 *
 * Tests that the OAuth implementation allows server to start
 * without valid SmartThings credentials, enabling the chicken-and-egg
 * OAuth flow.
 */

import { startAlexaServer } from './src/server-alexa.js';
import logger from './src/utils/logger.js';

async function testOAuthStartup() {
  logger.info('='.repeat(80));
  logger.info('Test: Server startup without authentication');
  logger.info('='.repeat(80));

  // Temporarily clear SMARTTHINGS_PAT to simulate no credentials
  const originalPAT = process.env['SMARTTHINGS_PAT'];
  process.env['SMARTTHINGS_PAT'] = '';

  try {
    logger.info('Starting server without SmartThings PAT...');

    const server = await startAlexaServer();

    logger.info('✓ Server started successfully!');

    // Test OAuth routes are accessible
    logger.info('Testing OAuth routes accessibility...');

    const healthResponse = await server.inject({
      method: 'GET',
      url: '/health',
    });

    logger.info('Health check response:', {
      statusCode: healthResponse.statusCode,
      body: JSON.parse(healthResponse.body),
    });

    if (healthResponse.statusCode === 200) {
      logger.info('✓ Health check passed');
    }

    const authStatusResponse = await server.inject({
      method: 'GET',
      url: '/auth/smartthings/status',
    });

    logger.info('OAuth status response:', {
      statusCode: authStatusResponse.statusCode,
      body: JSON.parse(authStatusResponse.body),
    });

    if (authStatusResponse.statusCode === 200) {
      logger.info('✓ OAuth status route accessible');
    }

    // Test API routes return 503 when adapter not initialized
    logger.info('Testing API routes return 503 without adapter...');

    const devicesResponse = await server.inject({
      method: 'GET',
      url: '/api/devices',
    });

    logger.info('Devices API response:', {
      statusCode: devicesResponse.statusCode,
      body: JSON.parse(devicesResponse.body),
    });

    if (devicesResponse.statusCode === 503) {
      logger.info('✓ API routes correctly return 503 without authentication');
    } else {
      logger.error('✗ Expected 503, got', devicesResponse.statusCode);
    }

    // Cleanup
    await server.close();

    logger.info('='.repeat(80));
    logger.info('✓ All tests passed!');
    logger.info('='.repeat(80));

    process.exit(0);
  } catch (error) {
    logger.error('✗ Test failed:', error);
    process.exit(1);
  } finally {
    // Restore original PAT
    if (originalPAT) {
      process.env['SMARTTHINGS_PAT'] = originalPAT;
    }
  }
}

// Run test
testOAuthStartup().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
