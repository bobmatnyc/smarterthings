#!/usr/bin/env node

/**
 * Alexa server CLI entry point
 *
 * Design Decision: Simple CLI launcher for Alexa Fastify server
 * Rationale: Provides dedicated entry point for running Alexa server independently
 * from MCP STDIO/SSE transports. Enables easy deployment and testing.
 *
 * Usage:
 *   npm run alexa-server
 *   pnpm alexa-server
 *   node dist/cli/alexa-server.js
 *
 * Environment Variables:
 *   SMARTTHINGS_PAT         SmartThings Personal Access Token (required)
 *   ALEXA_SERVER_PORT       Server port (default: 3000)
 *   ALEXA_SERVER_HOST       Server host (default: 0.0.0.0)
 *   NODE_ENV                Environment (production/development)
 *   ALEXA_SKIP_VERIFICATION Skip signature verification (dev only, DANGEROUS)
 *
 * Error Handling:
 * - Missing SmartThings PAT: Clear error with setup instructions
 * - Port already in use: Error with suggestion to use different port
 * - Unhandled errors: Logged and exit with error code
 */

import { config as loadEnv } from 'dotenv';
import chalk from 'chalk';
import { startAlexaServer } from '../server-alexa.js';
import logger from '../utils/logger.js';

// Load environment variables from .env.local
loadEnv({ path: '.env.local' });

/**
 * Validate environment configuration
 *
 * Checks:
 * - SMARTTHINGS_PAT is set (required for SmartThings API)
 * - Warns if ALEXA_SKIP_VERIFICATION is enabled (security risk)
 *
 * @throws Error if required variables missing
 */
function validateEnvironment(): void {
  // Check SmartThings PAT
  const smartThingsPat = process.env['SMARTTHINGS_PAT'] || process.env['SMARTTHINGS_TOKEN'];

  if (!smartThingsPat) {
    console.error(chalk.red('\n❌ Error: SMARTTHINGS_PAT environment variable is required\n'));
    console.error(chalk.gray('Setup instructions:'));
    console.error(chalk.gray('  1. Create a PAT at https://account.smartthings.com/tokens'));
    console.error(chalk.gray('  2. Add to .env.local: SMARTTHINGS_PAT=your-token-here\n'));
    process.exit(1);
  }

  // Warn about disabled verification
  if (process.env['ALEXA_SKIP_VERIFICATION'] === 'true') {
    console.warn(chalk.yellow('\n⚠️  WARNING: Alexa request verification is DISABLED'));
    console.warn(chalk.yellow('⚠️  This is a SECURITY RISK. Only use in development.\n'));
    logger.warn('Alexa verification disabled', {
      nodeEnv: process.env['NODE_ENV'],
    });
  }
}

/**
 * Display startup banner
 */
function displayBanner(): void {
  const port = process.env['ALEXA_SERVER_PORT'] || '3000';
  const host = process.env['ALEXA_SERVER_HOST'] || '0.0.0.0';

  console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════╗'));
  console.log(
    chalk.cyan('║') +
      chalk.bold.white('  MCP SmartThings - Alexa Smart Home Server        ') +
      chalk.cyan('║')
  );
  console.log(chalk.cyan('╚════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.gray('Server configuration:'));
  console.log(chalk.gray(`  Port: ${port}`));
  console.log(chalk.gray(`  Host: ${host}`));
  console.log(chalk.gray(`  Local URL: http://localhost:${port}`));
  console.log(chalk.gray(`  Health check: http://localhost:${port}/health\n`));

  console.log(chalk.gray('ngrok setup:'));
  console.log(chalk.gray(`  Command: ngrok http ${port} --subdomain=smarty`));
  console.log(chalk.gray('  Public URL: https://smarty.ngrok-free.app\n'));

  console.log(chalk.gray('Endpoints:'));
  console.log(chalk.gray('  POST /alexa  - Alexa Smart Home directives'));
  console.log(chalk.gray('  GET  /health - Health check'));
  console.log(chalk.gray('  GET  /       - Service info\n'));

  console.log(chalk.green('Starting server...\n'));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Validate environment
    validateEnvironment();

    // Display banner
    displayBanner();

    // Start server
    await startAlexaServer();

    console.log(chalk.green.bold('✓ Server started successfully!\n'));
    console.log(chalk.gray('Ready to receive Alexa directives'));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));
  } catch (error) {
    logger.error('Failed to start Alexa server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error(chalk.red('\n❌ Failed to start server:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));

    // Check for common errors
    if (error instanceof Error && error.message.includes('EADDRINUSE')) {
      const port = process.env['ALEXA_SERVER_PORT'] || '3000';
      console.error(chalk.yellow(`\n⚠️  Port ${port} is already in use`));
      console.error(chalk.gray('Try setting a different port:'));
      console.error(chalk.gray(`  ALEXA_SERVER_PORT=3001 npm run alexa-server\n`));
    }

    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise,
  });

  console.error(chalk.red('\n❌ Unhandled promise rejection:'));
  console.error(chalk.red(reason instanceof Error ? reason.message : String(reason)));

  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });

  console.error(chalk.red('\n❌ Uncaught exception:'));
  console.error(chalk.red(error.message));

  process.exit(1);
});

// Start the server
main().catch((error) => {
  logger.error('Fatal error in main', {
    error: error instanceof Error ? error.message : String(error),
  });

  console.error(chalk.red('\n❌ Fatal error:'));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));

  process.exit(1);
});
