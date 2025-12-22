/**
 * JSON configuration manager for MCP servers.
 *
 * Design Decision: Handle two JSON structure variants
 * - Standard: { mcpServers: { "server-name": {...} } }
 * - Flat: { "server-name": {...} }
 *
 * Used by: Claude Desktop, Claude Code, Gemini CLI
 */

import type {
  ConfigChanges,
  JsonMcpConfig,
  FlatMcpConfig,
  AgenticSystem,
} from '../../../types/install.js';
import { BaseConfigManager } from './base.js';

/**
 * JSON configuration manager with support for both structure types.
 */
export class JsonConfigManager extends BaseConfigManager {
  constructor(
    system: AgenticSystem,
    packagePath: string,
    private useFlatStructure: boolean = false
  ) {
    super(system, packagePath);
  }

  /**
   * Parse JSON configuration.
   *
   * @param content - Raw JSON string
   * @returns Parsed JSON object
   * @throws Error if JSON is invalid
   */
  protected parseConfig(content: string): JsonMcpConfig | FlatMcpConfig {
    return JSON.parse(content);
  }

  /**
   * Serialize configuration to formatted JSON.
   *
   * @param config - Config object
   * @returns Formatted JSON string
   */
  protected serializeConfig(config: unknown): string {
    return JSON.stringify(config, null, 2) + '\n'; // Add trailing newline
  }

  /**
   * Merge new MCP server config with existing configuration.
   *
   * Design Decision: Preserve all existing servers, add/update mcp-smartthings
   *
   * @param existing - Existing config (undefined if new file)
   * @param force - If true, ignore existing servers
   * @returns Merged config and change information
   */
  protected mergeConfig(
    existing: JsonMcpConfig | FlatMcpConfig | undefined,
    force: boolean
  ): { config: JsonMcpConfig | FlatMcpConfig; changes: ConfigChanges } {
    const changes: ConfigChanges = {
      added: [],
      updated: [],
      preserved: [],
    };

    const mcpServerConfig = this.generateMcpServerConfig();

    // Force overwrite: ignore existing
    if (force || !existing) {
      if (this.useFlatStructure) {
        changes.added.push('mcp-smartthings');
        return {
          config: {
            'mcp-smartthings': {
              ...mcpServerConfig,
              transport: 'stdio',
            },
          },
          changes,
        };
      } else {
        changes.added.push('mcp-smartthings');
        return {
          config: {
            mcpServers: {
              'mcp-smartthings': mcpServerConfig,
            },
          },
          changes,
        };
      }
    }

    // Merge mode: preserve existing servers
    if (this.useFlatStructure) {
      // Flat structure (Auggie-style)
      const merged = { ...existing } as FlatMcpConfig;

      // Track existing servers
      for (const serverName of Object.keys(merged)) {
        if (serverName !== 'mcp-smartthings') {
          changes.preserved.push(serverName);
        }
      }

      // Add or update mcp-smartthings
      if (merged['mcp-smartthings']) {
        changes.updated.push('mcp-smartthings');
      } else {
        changes.added.push('mcp-smartthings');
      }

      merged['mcp-smartthings'] = {
        ...mcpServerConfig,
        transport: 'stdio',
      };

      return { config: merged, changes };
    } else {
      // Standard structure (Claude Desktop, Claude Code, Gemini CLI)
      const merged = { ...existing } as JsonMcpConfig;

      if (!merged.mcpServers) {
        merged.mcpServers = {};
      }

      // Track existing servers
      for (const serverName of Object.keys(merged.mcpServers)) {
        if (serverName !== 'mcp-smartthings') {
          changes.preserved.push(serverName);
        }
      }

      // Add or update mcp-smartthings
      if (merged.mcpServers['mcp-smartthings']) {
        changes.updated.push('mcp-smartthings');
      } else {
        changes.added.push('mcp-smartthings');
      }

      merged.mcpServers['mcp-smartthings'] = mcpServerConfig;

      return { config: merged, changes };
    }
  }
}

/**
 * Create JSON config manager for Claude Desktop.
 */
export function createClaudeDesktopManager(
  system: AgenticSystem,
  packagePath: string
): JsonConfigManager {
  return new JsonConfigManager(system, packagePath, false);
}

/**
 * Create JSON config manager for Claude Code.
 */
export function createClaudeCodeManager(
  system: AgenticSystem,
  packagePath: string
): JsonConfigManager {
  return new JsonConfigManager(system, packagePath, false);
}

/**
 * Create JSON config manager for Gemini CLI.
 */
export function createGeminiCliManager(
  system: AgenticSystem,
  packagePath: string
): JsonConfigManager {
  return new JsonConfigManager(system, packagePath, false);
}

/**
 * Create JSON config manager for Auggie (flat structure).
 */
export function createAuggieManager(system: AgenticSystem, packagePath: string): JsonConfigManager {
  return new JsonConfigManager(system, packagePath, true); // Use flat structure
}
