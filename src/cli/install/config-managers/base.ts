/**
 * Base configuration manager for MCP server installation.
 *
 * Design Decision: Unified interface for all config formats (JSON/TOML)
 *
 * Architecture:
 * - Base class provides common functionality
 * - Subclasses implement format-specific operations
 * - Non-destructive merging by default
 * - Backup creation before overwrite
 */

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import type { AgenticSystem, McpServerConfig, ConfigChanges } from '../../../types/install.js';
import { expandHome, createBackupPath } from '../utils.js';

/**
 * Base configuration manager.
 *
 * Implements Template Method pattern for config operations.
 */
export abstract class BaseConfigManager {
  constructor(
    protected system: AgenticSystem,
    protected packagePath: string
  ) {}

  /**
   * Read existing configuration (if it exists).
   *
   * @returns Parsed config object or undefined if not exists
   */
  protected readExistingConfig(): unknown | undefined {
    const configPath = this.getConfigPath();

    if (!existsSync(configPath)) {
      return undefined;
    }

    const content = readFileSync(configPath, 'utf-8');
    return this.parseConfig(content);
  }

  /**
   * Parse configuration from string content.
   *
   * @param content - Raw config file content
   * @returns Parsed config object
   */
  protected abstract parseConfig(content: string): unknown;

  /**
   * Serialize configuration to string.
   *
   * @param config - Config object
   * @returns Formatted config string
   */
  protected abstract serializeConfig(config: unknown): string;

  /**
   * Generate MCP server configuration entry.
   *
   * @returns MCP server config object
   */
  protected generateMcpServerConfig(): McpServerConfig {
    return {
      command: 'node',
      args: [this.packagePath],
      env: {
        SMARTTHINGS_TOKEN: '${SMARTTHINGS_TOKEN}',
      },
    };
  }

  /**
   * Merge new config with existing config.
   *
   * @param existing - Existing config (undefined if new file)
   * @param force - If true, replace instead of merge
   * @returns Merged config and change information
   */
  protected abstract mergeConfig(
    existing: unknown | undefined,
    force: boolean
  ): { config: unknown; changes: ConfigChanges };

  /**
   * Get config file path (with expansion).
   *
   * @returns Absolute config file path
   */
  protected getConfigPath(): string {
    return expandHome(this.system.detectedConfigPath || this.system.configPath);
  }

  /**
   * Write configuration to file.
   *
   * @param config - Config object to write
   */
  protected writeConfig(config: unknown): void {
    const configPath = this.getConfigPath();
    const content = this.serializeConfig(config);

    writeFileSync(configPath, content, 'utf-8');

    // Set secure permissions (rw-------)
    try {
      chmodSync(configPath, 0o600);
    } catch {
      // Permission setting may fail on some systems (not critical)
    }
  }

  /**
   * Create backup of existing config.
   *
   * @returns Backup file path or undefined if no backup needed
   */
  protected createBackup(): string | undefined {
    const configPath = this.getConfigPath();

    if (!existsSync(configPath)) {
      return undefined;
    }

    const backupPath = createBackupPath(configPath);
    const content = readFileSync(configPath, 'utf-8');
    writeFileSync(backupPath, content, 'utf-8');

    return backupPath;
  }

  /**
   * Install MCP server configuration.
   *
   * Main entry point for installation process.
   *
   * @param force - If true, overwrite instead of merge
   * @param dryRun - If true, preview changes without writing
   * @returns Change information
   */
  public install(force: boolean = false, dryRun: boolean = false): ConfigChanges {
    const existing = this.readExistingConfig();
    const { config, changes } = this.mergeConfig(existing, force);

    if (!dryRun) {
      // Create backup if overwriting
      if (force && existing) {
        const backupPath = this.createBackup();
        if (backupPath) {
          changes.backupPath = backupPath;
        }
      }

      // Write configuration
      this.writeConfig(config);
    }

    return changes;
  }
}
