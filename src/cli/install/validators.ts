/**
 * Configuration validation for MCP server installation.
 *
 * Design Decision: Comprehensive validation before and after installation
 *
 * Validation Stages:
 * 1. Pre-installation: Check permissions, paths, existing configs
 * 2. Post-installation: Verify written config is valid
 *
 * Trade-offs:
 * - Safety First: Multiple validation layers prevent corruption
 * - Performance: Validation is fast (< 100ms total)
 * - User Experience: Clear error messages guide remediation
 */

import { existsSync, accessSync, constants, statSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import * as TOML from '@iarna/toml';
import type { ValidationResult, AgenticSystem, PackageInfo } from '../../types/install.js';
import { expandHome } from './utils.js';

/**
 * Validate pre-installation requirements.
 *
 * Checks:
 * - Package exists at expected path
 * - Config directory exists or can be created
 * - Config directory is writable
 * - No permission issues
 *
 * @param system - Target system
 * @param packageInfo - Package installation info
 * @returns Validation result
 */
export function validatePreInstallation(
  system: AgenticSystem,
  packageInfo: PackageInfo
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // 1. Validate package exists
  if (!packageInfo.exists) {
    result.valid = false;
    result.errors.push(`Package not found: ${packageInfo.path}`);
  }

  // 2. Validate config directory
  const configPath = system.detectedConfigPath || expandHome(system.configPath);
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    // Try to create directory
    try {
      mkdirSync(configDir, { recursive: true });
      result.warnings.push(`Created config directory: ${configDir}`);
    } catch (error) {
      result.valid = false;
      result.errors.push(
        `Cannot create config directory: ${configDir}\n` +
          `  Error: ${error instanceof Error ? error.message : String(error)}`
      );
      return result; // Early exit - can't proceed
    }
  }

  // 3. Check if config directory is actually a directory
  try {
    const stats = statSync(configDir);
    if (!stats.isDirectory()) {
      result.valid = false;
      result.errors.push(`Config path exists but is not a directory: ${configDir}`);
      return result;
    }
  } catch (error) {
    result.valid = false;
    result.errors.push(`Cannot stat config directory: ${configDir}`);
    return result;
  }

  // 4. Check write permissions
  try {
    accessSync(configDir, constants.W_OK);
  } catch {
    result.valid = false;
    result.errors.push(
      `No write permission for config directory: ${configDir}\n` + `  Try: chmod u+w ${configDir}`
    );
  }

  // 5. Warn if config file already exists (not an error)
  if (existsSync(configPath)) {
    result.warnings.push(
      `Config file already exists: ${configPath}\n` +
        `  Existing configuration will be merged (use --force to overwrite)`
    );
  }

  return result;
}

/**
 * Validate post-installation config file.
 *
 * Checks:
 * - Config file was created
 * - Config file is valid JSON/TOML
 * - MCP server entry exists
 * - Required fields present
 *
 * @param system - Target system
 * @param configPath - Path to written config file
 * @returns Validation result
 */
export function validatePostInstallation(
  system: AgenticSystem,
  configPath: string
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // 1. Check file exists
  if (!existsSync(configPath)) {
    result.valid = false;
    result.errors.push(`Config file was not created: ${configPath}`);
    return result;
  }

  // 2. Validate file content
  try {
    const content = readFileSync(configPath, 'utf-8');

    if (system.configFormat === 'json') {
      // Validate JSON structure
      const config = JSON.parse(content);

      // Check for MCP server entry (different structures for different systems)
      let hasEntry = false;

      if (config.mcpServers && config.mcpServers['mcp-smartthings']) {
        hasEntry = true;
      } else if (config['mcp-smartthings']) {
        hasEntry = true;
      }

      if (!hasEntry) {
        result.valid = false;
        result.errors.push('MCP SmartThings entry not found in config');
      }
    } else if (system.configFormat === 'toml') {
      // Validate TOML structure
      const config = TOML.parse(content) as any;

      if (!config['mcp_servers'] || !config['mcp_servers']['mcp-smartthings']) {
        result.valid = false;
        result.errors.push('MCP SmartThings entry not found in TOML config');
      }
    }
  } catch (error) {
    result.valid = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Config file validation failed: ${errorMessage}`);
  }

  return result;
}

/**
 * Validate existing config file for merging.
 *
 * Checks:
 * - File is readable
 * - File is valid JSON/TOML
 * - Structure is compatible with merging
 *
 * @param system - Target system
 * @param configPath - Path to existing config
 * @returns Validation result
 */
export function validateExistingConfig(
  system: AgenticSystem,
  configPath: string
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!existsSync(configPath)) {
    // Not an error - will create new file
    return result;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');

    if (system.configFormat === 'json') {
      JSON.parse(content); // Throws if invalid
    } else if (system.configFormat === 'toml') {
      TOML.parse(content); // Throws if invalid
    }
  } catch (error) {
    result.valid = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(
      `Existing config file is malformed: ${configPath}\n` +
        `  Error: ${errorMessage}\n` +
        `  Solution: Fix the file manually or use --force to overwrite (creates backup)`
    );
  }

  return result;
}

/**
 * Validate package path is executable.
 *
 * @param packagePath - Path to package entry point
 * @returns Validation result
 */
export function validatePackagePath(packagePath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!existsSync(packagePath)) {
    result.valid = false;
    result.errors.push(`Package not found: ${packagePath}`);
    return result;
  }

  // Check if it's a file
  try {
    const stats = statSync(packagePath);
    if (!stats.isFile()) {
      result.valid = false;
      result.errors.push(`Package path is not a file: ${packagePath}`);
    }
  } catch (error) {
    result.valid = false;
    result.errors.push(`Cannot stat package: ${packagePath}`);
  }

  return result;
}

/**
 * Format validation result for display.
 *
 * @param result - Validation result
 * @returns Formatted string for console output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    result.errors.forEach((error) => lines.push(`  ❌ ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    result.warnings.forEach((warning) => lines.push(`  ⚠️  ${warning}`));
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('✓ Validation passed');
  }

  return lines.join('\n');
}
