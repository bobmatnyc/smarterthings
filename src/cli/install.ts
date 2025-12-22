#!/usr/bin/env node
/**
 * MCP SmartThings Installation Command
 *
 * Automates installation of MCP SmartThings for agentic coding systems.
 *
 * Design Decision: Auto-detection with explicit override options
 *
 * Supported Systems:
 * - Claude Desktop (macOS/Windows native app)
 * - Claude Code (CLI tool)
 * - Codex (CLI tool with TOML config)
 * - Gemini CLI (Google's CLI tool)
 * - Auggie (Community CLI tool)
 *
 * Usage:
 *   mcp-smartthings install [system] [options]
 *
 * Features:
 * - Auto-detection of installed systems
 * - Non-destructive config merging
 * - Dry-run preview mode
 * - Force overwrite with backup
 * - Comprehensive validation
 *
 * Architecture:
 * - Detectors: System detection logic
 * - ConfigManagers: Format-specific config handling
 * - Validators: Pre/post-installation checks
 * - Utils: Cross-platform helpers
 */

import chalk from 'chalk';
import { parseArgs } from 'util';
import type { AgenticSystem, InstallMode, InstallOptions, InstallResult, SystemName } from '../types/install.js';
import {
  detectAllSystems,
  getSystemDefinition,
  formatDetectionResults,
} from './install/detectors.js';
import { detectPackageInfo } from './install/utils.js';
import {
  validatePreInstallation,
  validatePostInstallation,
  validateExistingConfig,
} from './install/validators.js';
import {
  createClaudeDesktopManager,
  createClaudeCodeManager,
  createGeminiCliManager,
  createAuggieManager,
} from './install/config-managers/json.js';
import { createCodexManager } from './install/config-managers/toml.js';

/**
 * Display help message.
 */
function displayHelp(): void {
  console.log(chalk.bold.cyan('\nMCP SmartThings Installation'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(chalk.white('Usage:'));
  console.log(chalk.gray('  mcp-smartthings install [system] [options]'));
  console.log();
  console.log(chalk.white('Arguments:'));
  console.log(
    chalk.gray('  system              Target system (optional, auto-detect if not specified)')
  );
  console.log();
  console.log(chalk.white('Options:'));
  console.log(chalk.gray('  --help, -h          Show this help message'));
  console.log(chalk.gray('  --list, -l          List supported systems'));
  console.log(chalk.gray('  --detect, -d        Detect installed systems only'));
  console.log(chalk.gray('  --force, -f         Overwrite existing config (not merge)'));
  console.log(chalk.gray('  --global            Use global npm package path'));
  console.log(chalk.gray('  --local             Use local project path'));
  console.log(chalk.gray('  --dry-run           Preview changes without applying'));
  console.log();
  console.log(chalk.white('Supported Systems:'));
  console.log(chalk.gray('  claude-desktop      Claude Desktop app'));
  console.log(chalk.gray('  claude-code         Claude Code CLI'));
  console.log(chalk.gray('  codex               Codex CLI'));
  console.log(chalk.gray('  gemini-cli          Gemini CLI'));
  console.log(chalk.gray('  auggie              Auggie'));
  console.log();
  console.log(chalk.white('Examples:'));
  console.log(chalk.gray('  mcp-smartthings install                    # Auto-detect and install'));
  console.log(
    chalk.gray('  mcp-smartthings install claude-desktop     # Install for Claude Desktop')
  );
  console.log(chalk.gray('  mcp-smartthings install --detect           # List detected systems'));
  console.log(chalk.gray('  mcp-smartthings install --dry-run          # Preview installation'));
  console.log();
  console.log(chalk.white('Documentation:'));
  console.log(chalk.gray('  https://github.com/bobmatnyc/mcp-smartthings/docs/installation.md'));
  console.log();
}

/**
 * Display list of supported systems.
 */
function displaySystemList(): void {
  console.log(chalk.bold.cyan('\nSupported Systems:'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();
  console.log(
    chalk.white('  claude-desktop') + chalk.gray('  - Claude Desktop app (macOS/Windows)')
  );
  console.log(chalk.white('  claude-code') + chalk.gray('     - Claude Code CLI tool'));
  console.log(chalk.white('  codex') + chalk.gray('           - Codex CLI tool'));
  console.log(chalk.white('  gemini-cli') + chalk.gray('      - Gemini CLI tool'));
  console.log(chalk.white('  auggie') + chalk.gray('          - Auggie tool'));
  console.log();
}

/**
 * Parse command-line arguments.
 */
function parseArguments(): { system?: SystemName; options: InstallOptions } {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(3), // Skip 'node', script, 'install'
    options: {
      help: { type: 'boolean', short: 'h' },
      list: { type: 'boolean', short: 'l' },
      detect: { type: 'boolean', short: 'd' },
      force: { type: 'boolean', short: 'f' },
      global: { type: 'boolean' },
      local: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
    allowPositionals: true,
  });

  const options: InstallOptions = {
    help: values.help as boolean,
    list: values.list as boolean,
    detect: values.detect as boolean,
    force: values.force as boolean,
    global: values.global as boolean,
    local: values.local as boolean,
    dryRun: values['dry-run'] as boolean,
  };

  const system = positionals[0] as SystemName | undefined;

  return { system, options };
}

/**
 * Create config manager for a system.
 */
function createConfigManager(system: AgenticSystem, packagePath: string) {
  switch (system.name) {
    case 'claude-desktop':
      return createClaudeDesktopManager(system, packagePath);
    case 'claude-code':
      return createClaudeCodeManager(system, packagePath);
    case 'codex':
      return createCodexManager(system, packagePath);
    case 'gemini-cli':
      return createGeminiCliManager(system, packagePath);
    case 'auggie':
      return createAuggieManager(system, packagePath);
    default:
      throw new Error(`Unsupported system: ${system.name}`);
  }
}

/**
 * Install for a single system.
 */
async function installForSystem(
  system: AgenticSystem,
  packagePath: string,
  options: InstallOptions
): Promise<InstallResult> {
  const configPath = system.detectedConfigPath || system.configPath;

  try {
    // 1. Validate existing config (if exists)
    const existingValidation = validateExistingConfig(system, configPath);
    if (!existingValidation.valid) {
      return {
        system: system.name,
        success: false,
        error: existingValidation.errors.join('\n'),
      };
    }

    // 2. Pre-installation validation
    const packageInfo = {
      mode: (options.global ? 'global' : options.local ? 'local' : 'auto') as InstallMode,
      path: packagePath,
      exists: true,
    };
    const preValidation = validatePreInstallation(system, packageInfo);
    if (!preValidation.valid) {
      return {
        system: system.name,
        success: false,
        error: preValidation.errors.join('\n'),
      };
    }

    // Show warnings if any
    if (preValidation.warnings.length > 0) {
      preValidation.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  ⚠️  ${warning}`));
      });
    }

    // 3. Create config manager and install
    const manager = createConfigManager(system, packagePath);
    const changes = manager.install(options.force || false, options.dryRun || false);

    // 4. Post-installation validation (skip for dry-run)
    if (!options.dryRun) {
      const postValidation = validatePostInstallation(system, configPath);
      if (!postValidation.valid) {
        return {
          system: system.name,
          success: false,
          error: postValidation.errors.join('\n'),
        };
      }
    }

    // Success
    return {
      system: system.name,
      success: true,
      configPath,
      dryRun: options.dryRun,
      changes,
    };
  } catch (error) {
    return {
      system: system.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Display installation results.
 */
function displayResults(results: InstallResult[]): void {
  console.log();
  console.log(chalk.bold.cyan('Installation Results:'));
  console.log(chalk.gray('━'.repeat(60)));

  for (const result of results) {
    if (result.success) {
      console.log();
      console.log(chalk.green(`✓ ${result.system}`));
      console.log(chalk.gray(`  Config: ${result.configPath}`));

      if (result.changes) {
        if (result.changes.added.length > 0) {
          console.log(chalk.gray(`  Added: ${result.changes.added.join(', ')}`));
        }
        if (result.changes.updated.length > 0) {
          console.log(chalk.gray(`  Updated: ${result.changes.updated.join(', ')}`));
        }
        if (result.changes.preserved.length > 0) {
          console.log(chalk.gray(`  Preserved: ${result.changes.preserved.join(', ')}`));
        }
        if (result.changes.backupPath) {
          console.log(chalk.gray(`  Backup: ${result.changes.backupPath}`));
        }
      }
    } else {
      console.log();
      console.log(chalk.red(`✗ ${result.system}`));
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  }

  console.log();

  // Show next steps if any successful installations
  const successCount = results.filter((r) => r.success).length;
  if (successCount > 0 && !results[0]?.dryRun) {
    console.log(chalk.bold.green('✅ Installation complete!'));
    console.log();
    console.log(chalk.white('Next Steps:'));
    console.log(chalk.gray('  1. Restart your agentic coding system'));
    console.log(chalk.gray('  2. Set SMARTTHINGS_TOKEN environment variable:'));
    console.log(chalk.gray('     export SMARTTHINGS_TOKEN=your-token-here'));
    console.log(chalk.gray('  3. Test MCP tools in your coding interface'));
    console.log();
    console.log(chalk.white('Need help? Run:'));
    console.log(chalk.gray('  mcp-smartthings config  # Interactive configuration'));
    console.log();
  } else if (successCount > 0 && results[0]?.dryRun) {
    console.log(chalk.bold.yellow('Dry run complete (no changes made)'));
    console.log();
    console.log(chalk.white('To apply changes, run without --dry-run'));
    console.log();
  }
}

/**
 * Main installation command.
 */
async function main(): Promise<void> {
  const { system, options } = parseArguments();

  // Show help
  if (options.help) {
    displayHelp();
    return;
  }

  // List systems
  if (options.list) {
    displaySystemList();
    return;
  }

  console.log(chalk.bold.cyan('\n🏠 MCP SmartThings Installation'));
  console.log(chalk.gray('━'.repeat(60)));

  // Detect package
  try {
    const packageInfo = detectPackageInfo(
      options.global ? 'global' : options.local ? 'local' : 'auto'
    );
    console.log(chalk.gray(`📦 Package: ${packageInfo.mode} (${packageInfo.path})`));
  } catch (error) {
    console.error(chalk.red('\n❌ Package not found'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  console.log();

  // Detect systems
  console.log(chalk.blue('🔍 Detecting installed systems...'));
  const detectedSystems = detectAllSystems();

  if (detectedSystems.length === 0 && !system) {
    console.error(chalk.red('\n❌ No supported systems detected'));
    console.error();
    console.error(chalk.white('Supported systems:'));
    console.error(chalk.gray('  - Claude Desktop'));
    console.error(chalk.gray('  - Claude Code'));
    console.error(chalk.gray('  - Codex'));
    console.error(chalk.gray('  - Gemini CLI'));
    console.error(chalk.gray('  - Auggie'));
    console.error();
    console.error(chalk.white('Solutions:'));
    console.error(chalk.gray('  1. Install an agentic system first'));
    console.error(
      chalk.gray('  2. Specify system explicitly: mcp-smartthings install claude-desktop')
    );
    console.error(chalk.gray('  3. Manual installation: See docs/manual-install.md'));
    console.error();
    process.exit(1);
  }

  console.log(formatDetectionResults(detectedSystems));

  // Detect-only mode
  if (options.detect) {
    console.log();
    return;
  }

  // Determine target systems
  let targetSystems: AgenticSystem[];
  if (system) {
    const targetSystem = getSystemDefinition(system);
    if (!targetSystem.detected) {
      console.warn(chalk.yellow(`\n⚠️  Warning: ${targetSystem.displayName} not detected`));
      console.warn(
        chalk.yellow('    Installation will proceed but may fail if system is not installed')
      );
    }
    targetSystems = [targetSystem];
  } else {
    targetSystems = detectedSystems;
  }

  // Dry run notice
  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow('📋 Dry Run Mode - No changes will be made'));
  }

  // Install for each target system
  const packageInfo = detectPackageInfo(
    options.global ? 'global' : options.local ? 'local' : 'auto'
  );

  const results: InstallResult[] = [];
  for (const target of targetSystems) {
    console.log();
    console.log(chalk.blue(`📦 Installing for ${target.displayName}...`));

    const result = await installForSystem(target, packageInfo.path, options);
    results.push(result);
  }

  // Display results
  displayResults(results);

  // Exit with error code if any failures
  const hasFailures = results.some((r) => !r.success);
  if (hasFailures) {
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('\n❌ Installation failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
