#!/usr/bin/env node
/**
 * CLI Router for MCP SmartThings
 *
 * Routes commands to appropriate handlers:
 * - install: System installation command
 * - config: Interactive configuration
 * - chat: Chat interface
 * - alexa-server: Alexa server
 * - (no command): Start MCP server
 */

const command = process.argv[2];

switch (command) {
  case 'install':
    import('./cli/install.js');
    break;
  case 'config':
    import('./cli/config.js');
    break;
  case 'chat':
    import('./cli/chat.js');
    break;
  case 'alexa-server':
    import('./cli/alexa-server.js');
    break;
  case 'help':
  case '--help':
  case '-h':
    console.log(`
MCP SmartThings - AI-powered LLM controller for SmartThings

Usage:
  mcp-smartthings [command] [options]

Commands:
  install        Install MCP server for agentic systems
  config         Interactive configuration menu
  chat           Start chat interface
  alexa-server   Start Alexa integration server
  help           Show this help message

Examples:
  mcp-smartthings install              # Auto-detect and install
  mcp-smartthings install --help       # Show install help
  mcp-smartthings config               # Configure SmartThings PAT
  mcp-smartthings                      # Start MCP server

Documentation:
  https://github.com/bobmatnyc/mcp-smartthings
`);
    break;
  default:
    // No command or unknown command: start MCP server
    import('./index.js');
    break;
}
