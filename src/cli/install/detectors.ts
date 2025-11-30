/**
 * System detection for MCP-compatible agentic coding tools.
 *
 * Design Decision: Multiple detection methods with prioritization
 *
 * Detection Strategy:
 * 1. Check for binary in PATH (most reliable)
 * 2. Check for config directory existence
 * 3. Check for application installation (macOS apps)
 *
 * Trade-offs:
 * - False Positives: Config dir exists but system not installed (acceptable - will fail gracefully)
 * - False Negatives: System installed but not in PATH (user can specify explicitly)
 */

import { existsSync } from 'fs';
import { dirname } from 'path';
import { platform } from 'os';
import type { AgenticSystem, SystemName } from '../../types/install.js';
import { expandHome, getPlatformConfigPath, isCommandAvailable, isDirectory } from './utils.js';

/**
 * System definitions with detection configuration.
 *
 * Design: Centralized system metadata for easy maintenance
 */
const SYSTEM_DEFINITIONS: Record<SystemName, Omit<AgenticSystem, 'detected' | 'detectedConfigPath'>> = {
  'claude-desktop': {
    name: 'claude-desktop',
    displayName: 'Claude Desktop',
    configPath: getPlatformConfigPath('claude-desktop'),
    configFormat: 'json',
    detectCommand: undefined, // No CLI command for desktop app
    appPath: platform() === 'darwin' ? '/Applications/Claude.app' : undefined,
  },
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    configPath: '~/.claude/settings.local.json',
    alternativeConfigPaths: [
      '.claude/settings.local.json', // Project-specific
      '.mcp.json', // Version-controlled
    ],
    configFormat: 'json',
    detectCommand: 'claude',
  },
  'codex': {
    name: 'codex',
    displayName: 'Codex',
    configPath: '~/.codex/config.toml',
    configFormat: 'toml',
    detectCommand: 'codex',
  },
  'gemini-cli': {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    configPath: '~/.gemini/settings.json',
    configFormat: 'json',
    detectCommand: 'gemini',
  },
  'auggie': {
    name: 'auggie',
    displayName: 'Auggie',
    configPath: '~/.auggie/servers.json',
    configFormat: 'json',
    detectCommand: 'auggie',
  },
};

/**
 * Detect if a specific system is installed.
 *
 * Detection Logic:
 * 1. If detectCommand exists, check if binary is in PATH
 * 2. If appPath exists (macOS apps), check if app is installed
 * 3. Check if config directory exists (indicates previous usage)
 *
 * @param systemName - System to detect
 * @returns AgenticSystem with detection results
 */
export function detectSystem(systemName: SystemName): AgenticSystem {
  const definition = SYSTEM_DEFINITIONS[systemName];

  // Method 1: Check for binary in PATH (most reliable)
  if (definition.detectCommand && isCommandAvailable(definition.detectCommand)) {
    return {
      ...definition,
      detected: true,
      detectedConfigPath: expandHome(definition.configPath),
    };
  }

  // Method 2: Check for app installation (macOS)
  if (definition.appPath && existsSync(definition.appPath)) {
    return {
      ...definition,
      detected: true,
      detectedConfigPath: expandHome(definition.configPath),
    };
  }

  // Method 3: Check for config directory (indicates previous usage)
  const mainConfigDir = dirname(expandHome(definition.configPath));
  if (existsSync(mainConfigDir) && isDirectory(mainConfigDir)) {
    return {
      ...definition,
      detected: true,
      detectedConfigPath: expandHome(definition.configPath),
    };
  }

  // Method 4: Check alternative config paths (for Claude Code)
  if (definition.alternativeConfigPaths) {
    for (const altPath of definition.alternativeConfigPaths) {
      const expandedPath = expandHome(altPath);
      const altDir = dirname(expandedPath);
      if (existsSync(altDir) && isDirectory(altDir)) {
        return {
          ...definition,
          detected: true,
          detectedConfigPath: expandedPath,
        };
      }
    }
  }

  // Not detected
  return {
    ...definition,
    detected: false,
  };
}

/**
 * Detect all installed agentic systems.
 *
 * @returns Array of detected systems
 */
export function detectAllSystems(): AgenticSystem[] {
  const systemNames: SystemName[] = [
    'claude-desktop',
    'claude-code',
    'codex',
    'gemini-cli',
    'auggie',
  ];

  const detected: AgenticSystem[] = [];

  for (const name of systemNames) {
    const system = detectSystem(name);
    if (system.detected) {
      detected.push(system);
    }
  }

  return detected;
}

/**
 * Get system definition by name.
 *
 * @param systemName - System name
 * @returns System definition with detection results
 */
export function getSystemDefinition(systemName: SystemName): AgenticSystem {
  return detectSystem(systemName);
}

/**
 * Get all system definitions (whether detected or not).
 *
 * @returns Array of all system definitions
 */
export function getAllSystemDefinitions(): AgenticSystem[] {
  const systemNames: SystemName[] = [
    'claude-desktop',
    'claude-code',
    'codex',
    'gemini-cli',
    'auggie',
  ];

  return systemNames.map((name) => detectSystem(name));
}

/**
 * Format detection results for display.
 *
 * @param systems - Systems to format
 * @returns Formatted string for console output
 */
export function formatDetectionResults(systems: AgenticSystem[]): string {
  if (systems.length === 0) {
    return 'No supported systems detected.';
  }

  const lines = systems.map((system) => {
    const mark = system.detected ? '✓' : '✗';
    const path = system.detected
      ? system.detectedConfigPath || system.configPath
      : dirname(expandHome(system.configPath));
    return `  ${mark} ${system.displayName} (${path})`;
  });

  return lines.join('\n');
}
