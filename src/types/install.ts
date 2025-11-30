/**
 * Type definitions for MCP server installation.
 *
 * Design Decision: Comprehensive type safety for multi-system installation
 *
 * Supported Systems:
 * - Claude Desktop (macOS/Windows native app)
 * - Claude Code (CLI tool)
 * - Codex (CLI tool with TOML config)
 * - Gemini CLI (Google's CLI tool)
 * - Auggie (Community CLI tool)
 */

/**
 * Supported agentic coding systems.
 */
export type SystemName = 'claude-desktop' | 'claude-code' | 'codex' | 'gemini-cli' | 'auggie';

/**
 * Configuration file formats.
 */
export type ConfigFormat = 'json' | 'toml';

/**
 * Installation mode for package path resolution.
 */
export type InstallMode = 'global' | 'local' | 'auto';

/**
 * System configuration definition.
 *
 * Design: Each system has unique config paths and detection methods
 */
export interface AgenticSystem {
  /** System identifier */
  name: SystemName;

  /** Display name for user output */
  displayName: string;

  /** Configuration file path (supports ~ expansion) */
  configPath: string;

  /** Alternative config paths (checked in order) */
  alternativeConfigPaths?: string[];

  /** Config file format */
  configFormat: ConfigFormat;

  /** Command to detect installation (e.g., 'claude', 'codex') */
  detectCommand?: string;

  /** Application path for detection (macOS apps) */
  appPath?: string;

  /** Whether this system is currently detected */
  detected?: boolean;

  /** Detected config path (if multiple alternatives exist) */
  detectedConfigPath?: string;
}

/**
 * MCP server configuration entry.
 *
 * Standard format used by all MCP-compatible systems.
 */
export interface McpServerConfig {
  /** Command to execute (e.g., 'node') */
  command: string;

  /** Command arguments (e.g., path to index.js) */
  args: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Transport protocol (some systems require explicit 'stdio') */
  transport?: 'stdio';
}

/**
 * Complete config file structure for JSON-based systems.
 */
export interface JsonMcpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Flat config structure (used by some systems like Auggie).
 */
export type FlatMcpConfig = Record<string, McpServerConfig & { transport?: 'stdio' }>;

/**
 * TOML config structure for Codex.
 */
export interface TomlMcpConfig {
  mcp_servers: Record<string, McpServerConfig>;
}

/**
 * Installation options from CLI flags.
 */
export interface InstallOptions {
  /** Target system (undefined = auto-detect all) */
  system?: SystemName;

  /** Show detected systems only */
  detect?: boolean;

  /** Preview changes without applying */
  dryRun?: boolean;

  /** Overwrite existing config (create backup) */
  force?: boolean;

  /** Use global npm package path */
  global?: boolean;

  /** Use local project path */
  local?: boolean;

  /** Show help message */
  help?: boolean;

  /** List supported systems */
  list?: boolean;
}

/**
 * Validation result for pre/post-installation checks.
 */
export interface ValidationResult {
  /** Overall validation status */
  valid: boolean;

  /** Critical errors that block installation */
  errors: string[];

  /** Non-critical warnings */
  warnings: string[];
}

/**
 * Installation result for a single system.
 */
export interface InstallResult {
  /** Target system */
  system: SystemName;

  /** Installation success status */
  success: boolean;

  /** Config file path that was written */
  configPath?: string;

  /** Error message if installation failed */
  error?: string;

  /** Whether this was a dry run */
  dryRun?: boolean;

  /** Changes that were (or would be) made */
  changes?: ConfigChanges;
}

/**
 * Changes made to configuration.
 */
export interface ConfigChanges {
  /** New server entries added */
  added: string[];

  /** Existing server entries updated */
  updated: string[];

  /** Existing server entries preserved */
  preserved: string[];

  /** Backup file path (if overwrite occurred) */
  backupPath?: string;
}

/**
 * Package installation information.
 */
export interface PackageInfo {
  /** Package installation mode */
  mode: InstallMode;

  /** Full path to package entry point */
  path: string;

  /** Whether package exists at path */
  exists: boolean;

  /** Global npm root directory */
  globalRoot?: string;

  /** Local project directory */
  localRoot?: string;
}
