/**
 * Utility functions for MCP server installation.
 *
 * Design Decision: Cross-platform path resolution and npm package detection
 *
 * Trade-offs:
 * - Performance: Synchronous operations for simplicity (installation is one-time)
 * - Reliability: Multiple detection methods with fallbacks
 * - Security: No shell injection risks (using execSync with careful escaping)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import type { PackageInfo, InstallMode } from '../../types/install.js';

/**
 * Expand ~ in file paths to home directory.
 *
 * @param path - Path potentially containing ~
 * @returns Expanded absolute path
 */
export function expandHome(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * Get platform-specific config paths.
 *
 * Design: Handle macOS, Windows, Linux differences
 *
 * @param systemName - System identifier
 * @returns Platform-specific config path
 */
export function getPlatformConfigPath(systemName: string): string {
  const os = platform();

  switch (systemName) {
    case 'claude-desktop':
      if (os === 'darwin') {
        return '~/Library/Application Support/Claude/claude_desktop_config.json';
      } else if (os === 'win32') {
        return join(process.env['APPDATA'] || '', 'Claude', 'claude_desktop_config.json');
      }
      // Linux: Use generic path
      return '~/.config/claude/claude_desktop_config.json';

    case 'claude-code':
      // Claude Code uses same paths across platforms
      return '~/.claude/settings.local.json';

    case 'codex':
      return '~/.codex/config.toml';

    case 'gemini-cli':
      return '~/.gemini/settings.json';

    case 'auggie':
      return '~/.auggie/servers.json';

    default:
      throw new Error(`Unknown system: ${systemName}`);
  }
}

/**
 * Check if a command is available in PATH.
 *
 * @param command - Command name to check
 * @returns true if command exists
 */
export function isCommandAvailable(command: string): boolean {
  try {
    const whichCommand = platform() === 'win32' ? 'where' : 'which';
    execSync(`${whichCommand} ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get global npm root directory.
 *
 * @returns Global npm root path or undefined if not available
 */
export function getGlobalNpmRoot(): string | undefined {
  try {
    const result = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    return result;
  } catch {
    return undefined;
  }
}

/**
 * Detect package installation location and information.
 *
 * Design Decision: Auto-detection with explicit override options
 *
 * Priority:
 * 1. Explicit --global or --local flag
 * 2. Global installation (if exists)
 * 3. Local project build (fallback)
 *
 * @param mode - Installation mode from CLI flags
 * @returns Package information
 */
export function detectPackageInfo(mode: InstallMode = 'auto'): PackageInfo {
  const packageName = '@bobmatnyc/mcp-smarterthings';
  const entryPoint = 'dist/index.js';

  // Get npm roots
  const globalRoot = getGlobalNpmRoot();
  const localRoot = process.cwd();

  // Construct paths
  const globalPath = globalRoot ? join(globalRoot, packageName, entryPoint) : undefined;
  const localPath = join(localRoot, entryPoint);

  // Explicit mode override
  if (mode === 'global') {
    if (!globalPath || !existsSync(globalPath)) {
      throw new Error(`Global installation not found. Install with: npm install -g ${packageName}`);
    }
    return {
      mode: 'global',
      path: globalPath,
      exists: true,
      globalRoot,
      localRoot,
    };
  }

  if (mode === 'local') {
    if (!existsSync(localPath)) {
      throw new Error('Local build not found. Run: pnpm build');
    }
    return {
      mode: 'local',
      path: localPath,
      exists: true,
      globalRoot,
      localRoot,
    };
  }

  // Auto-detect: prefer global if available
  if (globalPath && existsSync(globalPath)) {
    return {
      mode: 'global',
      path: globalPath,
      exists: true,
      globalRoot,
      localRoot,
    };
  }

  // Fallback to local
  if (existsSync(localPath)) {
    return {
      mode: 'local',
      path: localPath,
      exists: true,
      globalRoot,
      localRoot,
    };
  }

  // Not found anywhere
  throw new Error(
    `Package not found.\n\n` +
      `Tried:\n` +
      `  Global: ${globalPath || 'npm root -g failed'}\n` +
      `  Local:  ${localPath}\n\n` +
      `Solutions:\n` +
      `  1. Install globally: npm install -g ${packageName}\n` +
      `  2. Build locally: pnpm build`
  );
}

/**
 * Create backup filename with timestamp.
 *
 * @param originalPath - Original config file path
 * @returns Backup file path
 */
export function createBackupPath(originalPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  return `${originalPath}.backup-${timestamp}`;
}

/**
 * Check if a path exists and is a directory.
 *
 * @param path - Path to check
 * @returns true if path is an existing directory
 */
export function isDirectory(path: string): boolean {
  try {
    const fs = require('fs');
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Validate that a path is safe (no injection attacks).
 *
 * @param path - Path to validate
 * @throws Error if path contains suspicious characters
 */
export function validatePath(path: string): void {
  // Check for suspicious characters that could indicate injection
  const suspiciousPattern = /[;&|`$()<>]/;
  if (suspiciousPattern.test(path)) {
    throw new Error(`Invalid path contains suspicious characters: ${path}`);
  }
}
