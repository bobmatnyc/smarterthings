/**
 * TOML configuration manager for Codex.
 *
 * Design Decision: Use @iarna/toml for parsing/serialization
 *
 * Codex Format:
 * [mcp_servers.server-name]
 * command = "node"
 * args = ["/path/to/index.js"]
 * env = { "SMARTTHINGS_TOKEN" = "${SMARTTHINGS_TOKEN}" }
 *
 * Critical: Use mcp_servers (underscore), not mcp-servers
 */

import * as TOML from '@iarna/toml';
import type { ConfigChanges, TomlMcpConfig, AgenticSystem } from '../../../types/install.js';
import { BaseConfigManager } from './base.js';

/**
 * TOML configuration manager for Codex.
 */
export class TomlConfigManager extends BaseConfigManager {
  /**
   * Parse TOML configuration.
   *
   * @param content - Raw TOML string
   * @returns Parsed TOML object
   * @throws Error if TOML is invalid
   */
  protected parseConfig(content: string): TomlMcpConfig {
    const parsed = TOML.parse(content);
    return parsed as unknown as TomlMcpConfig;
  }

  /**
   * Serialize configuration to formatted TOML.
   *
   * @param config - Config object
   * @returns Formatted TOML string
   */
  protected serializeConfig(config: unknown): string {
    return TOML.stringify(config as TOML.JsonMap);
  }

  /**
   * Merge new MCP server config with existing TOML configuration.
   *
   * Design Decision: Preserve all existing servers, add/update mcp-smartthings
   *
   * @param existing - Existing config (undefined if new file)
   * @param force - If true, ignore existing servers
   * @returns Merged config and change information
   */
  protected mergeConfig(
    existing: TomlMcpConfig | undefined,
    force: boolean
  ): { config: TomlMcpConfig; changes: ConfigChanges } {
    const changes: ConfigChanges = {
      added: [],
      updated: [],
      preserved: [],
    };

    const mcpServerConfig = this.generateMcpServerConfig();

    // Force overwrite: ignore existing
    if (force || !existing) {
      changes.added.push('mcp-smartthings');
      return {
        config: {
          mcp_servers: {
            'mcp-smartthings': mcpServerConfig,
          },
        },
        changes,
      };
    }

    // Merge mode: preserve existing servers
    const merged: TomlMcpConfig = {
      ...existing,
      mcp_servers: {
        ...(existing.mcp_servers || {}),
      },
    };

    // Track existing servers
    if (merged.mcp_servers) {
      for (const serverName of Object.keys(merged.mcp_servers)) {
        if (serverName !== 'mcp-smartthings') {
          changes.preserved.push(serverName);
        }
      }
    }

    // Add or update mcp-smartthings
    if (merged.mcp_servers['mcp-smartthings']) {
      changes.updated.push('mcp-smartthings');
    } else {
      changes.added.push('mcp-smartthings');
    }

    merged.mcp_servers['mcp-smartthings'] = mcpServerConfig;

    return { config: merged, changes };
  }
}

/**
 * Create TOML config manager for Codex.
 */
export function createCodexManager(system: AgenticSystem, packagePath: string): TomlConfigManager {
  return new TomlConfigManager(system, packagePath);
}
