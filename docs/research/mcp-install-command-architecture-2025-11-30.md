# MCP Install Command Architecture and Requirements

**Research Date:** 2025-11-30
**Status:** Design Phase
**Related Ticket:** 1M-413 (Phase 4.3: Implement mcp-install command)
**Researcher:** Claude (Research Agent)

---

## Executive Summary

This document provides comprehensive analysis and design specifications for implementing the `mcp-install` command for the mcp-smartthings MCP server. The command enables seamless deployment to multiple agentic coding systems (Claude Code, Codex, Gemini CLI, Auggie) through auto-detection and config generation.

**Key Findings:**

- **Ticket Requirements:** 1M-413 specifies support for 4 agentic systems with auto-detection
- **Config Formats:** Each system uses different JSON structures and file locations
- **Installation Challenge:** Non-destructive merging of existing configs is critical
- **Architecture Exists:** Dual-mode architecture design already documented (docs/research/dual-mode-mcp-architecture-2025-11-29.md)
- **Implementation Model:** Existing config.ts provides excellent pattern for interactive CLI

**Critical Corrections from Research:**

1. **Claude Desktop vs Claude Code:** Ticket specifies "Claude Code" (~/.claude/mcp_settings.json) but actual Claude Desktop uses `claude_desktop_config.json` at different location
2. **Codex Config Format:** Uses TOML (~/.codex/config.toml), not JSON
3. **Package Location:** Should reference global npm installation path, not project dist/

**Recommendations:**

1. **Phase 1** (Day 1-2): Implement core install.ts with system detection
2. **Phase 2** (Day 2-3): Add config generators for each system
3. **Phase 3** (Day 3-4): Implement non-destructive merging logic
4. **Phase 4** (Day 4-5): Testing, validation, and documentation
5. **Total Effort:** 5 days (matches ticket estimate)

---

## Table of Contents

1. [Ticket Analysis](#1-ticket-analysis)
2. [MCP Server Installation Standards](#2-mcp-server-installation-standards)
3. [Existing Code Analysis](#3-existing-code-analysis)
4. [Command Interface Design](#4-command-interface-design)
5. [Installation Workflow](#5-installation-workflow)
6. [Configuration Management](#6-configuration-management)
7. [Error Handling and Validation](#7-error-handling-and-validation)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Testing Strategy](#9-testing-strategy)
10. [File Structure and Changes](#10-file-structure-and-changes)

---

## 1. Ticket Analysis

### 1.1 Ticket 1M-413 Requirements

**Title:** Phase 4.3: Implement mcp-install command for agentic system deployment

**Supported Systems:**

1. **Claude Code** - ~/.claude/mcp_settings.json
2. **Codex** - ~/.codex/mcp_servers.json
3. **Gemini CLI** - ~/.config/gemini-cli/mcp.json
4. **Auggie** - ~/.auggie/servers.json

**Usage Patterns:**

```bash
# Auto-detect and install
mcp-smartthings install

# Install for specific system
mcp-smartthings install claude-code
mcp-smartthings install codex
mcp-smartthings install gemini-cli
mcp-smartthings install auggie
```

**Technical Requirements:**

- Auto-detection of installed agentic systems
- Non-destructive config merging (preserve existing servers)
- System-specific config file generation
- Validation and error handling
- Installation instructions per system

**Files to Create:**

- src/cli/install.ts (~500 lines)
- Config templates for each system
- Installation documentation

**Acceptance Criteria:**

- Auto-detection working for all 4 systems
- Config files generated correctly
- Non-destructive merging verified
- Installation instructions clear
- Tests passing

**Effort:** 5 days
**Depends On:** Issue 1M-411 (automation tools for complete feature set)
**Reference:** docs/research/dual-mode-mcp-architecture-2025-11-29.md

### 1.2 Critical Issues Discovered

**Issue 1: Claude Desktop vs Claude Code Confusion**

Ticket specifies:
- "Claude Code" with config at `~/.claude/mcp_settings.json`

Reality from research:
- **Claude Desktop:** Uses `claude_desktop_config.json` at:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- **Claude Code (CLI):** Uses different locations:
  - Project: `.mcp.json` or `.claude/settings.local.json`
  - User: `~/.claude/settings.local.json`

**Resolution:** Support BOTH Claude Desktop and Claude Code with separate detection logic.

**Issue 2: Codex Uses TOML Format**

Ticket specifies:
- JSON format at `~/.codex/mcp_servers.json`

Reality from research:
- **Codex:** Uses TOML format at `~/.codex/config.toml`
- Section header: `[mcp_servers.server-name]`
- Requires TOML parsing library

**Resolution:** Add TOML dependency and implement TOML-specific config generation.

**Issue 3: Package Installation Path**

Ticket reference implementation uses:
- `./dist/index.js` (project-relative path)

Better approach:
- Use global npm installation path
- Reference: `npm root -g` returns `/opt/homebrew/lib/node_modules`
- Full path: `{npm_root}/@bobmatnyc/mcp-smarterthings/dist/index.js`

**Resolution:** Detect if package is globally installed, otherwise use project path.

---

## 2. MCP Server Installation Standards

### 2.1 Claude Desktop Configuration

**File Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

**Format:**

```json
{
  "mcpServers": {
    "mcp-smartthings": {
      "command": "node",
      "args": ["/path/to/node_modules/@bobmatnyc/mcp-smarterthings/dist/index.js"],
      "env": {
        "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
      }
    }
  }
}
```

**Detection:**
- Check if config file exists
- Or check for Claude Desktop app installation (macOS: /Applications/Claude.app)

### 2.2 Claude Code (CLI) Configuration

**File Locations (Priority Order):**
1. Project-scoped: `.mcp.json` (version-controlled)
2. Project-specific: `.claude/settings.local.json`
3. User-specific: `~/.claude/settings.local.json`

**Format:**

```json
{
  "mcpServers": {
    "mcp-smartthings": {
      "command": "node",
      "args": ["/path/to/node_modules/@bobmatnyc/mcp-smarterthings/dist/index.js"],
      "env": {
        "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
      }
    }
  }
}
```

**Detection:**
- Check for `claude` binary in PATH
- Or check for `~/.claude/` directory

### 2.3 Codex Configuration

**File Location:**
- `~/.codex/config.toml`

**Format (TOML):**

```toml
[mcp_servers.mcp-smartthings]
command = "node"
args = ["/path/to/node_modules/@bobmatnyc/mcp-smarterthings/dist/index.js"]
env = { "SMARTTHINGS_TOKEN" = "${SMARTTHINGS_TOKEN}" }
```

**Important Notes:**
- Must use `mcp_servers` (underscore), not `mcp-servers` or `mcpservers`
- TOML format, not JSON
- All servers must use STDIO transport (local subprocesses only)

**Detection:**
- Check for `codex` binary in PATH
- Or check for `~/.codex/` directory

### 2.4 Gemini CLI Configuration

**File Location:**
- `~/.gemini/settings.json`

**Format:**

```json
{
  "mcpServers": {
    "mcp-smartthings": {
      "command": "node",
      "args": ["/path/to/node_modules/@bobmatnyc/mcp-smarterthings/dist/index.js"],
      "env": {
        "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
      }
    }
  }
}
```

**Alternative Format (Remote Servers):**

```json
{
  "mcpServers": {
    "mcp-smartthings": {
      "httpUrl": "https://server.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      }
    }
  }
}
```

**Detection:**
- Check for `gemini` binary in PATH
- Or check for `~/.gemini/` directory

### 2.5 Auggie Configuration

**Status:** Unable to verify - no official documentation found

**Assumed Format (based on ticket):**

```json
{
  "mcp-smartthings": {
    "command": "node",
    "args": ["/path/to/node_modules/@bobmatnyc/mcp-smarterthings/dist/index.js"],
    "env": {
      "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
    },
    "transport": "stdio"
  }
}
```

**Detection:**
- Check for `auggie` binary in PATH
- Or check for `~/.auggie/` directory

**Note:** May require further research or user feedback to validate format.

---

## 3. Existing Code Analysis

### 3.1 Package Configuration

**package.json:**

```json
{
  "name": "@bobmatnyc/mcp-smarterthings",
  "version": "0.7.2",
  "type": "module",
  "bin": {
    "mcp-smarterthings": "./dist/index.js"
  }
}
```

**Key Observations:**

- Package name: `@bobmatnyc/mcp-smarterthings`
- Binary command: `mcp-smarterthings`
- Entry point: `./dist/index.js` (after build)
- ES modules: `"type": "module"`

**Global Installation:**

```bash
npm install -g @bobmatnyc/mcp-smarterthings
# Creates: {npm_root}/@bobmatnyc/mcp-smarterthings/
# Binary: Available as 'mcp-smarterthings' in PATH
```

### 3.2 Existing CLI Commands

**Current CLI Structure:**

```
src/cli/
├── chat.ts          # Interactive chat interface
├── config.ts        # Configuration management (excellent pattern!)
└── alexa-server.ts  # Alexa integration server
```

**config.ts Analysis:**

- **Interactive menu system** - Uses `readline/promises` for user input
- **Configuration management** - Reads/writes .env.local file
- **Validation** - Tests SmartThings PAT token
- **Error handling** - Comprehensive error messages and fallbacks
- **User experience** - Color-coded output with chalk
- **Code size:** ~430 lines (similar to target ~500 lines for install.ts)

**Key Patterns to Reuse:**

1. **ConfigManager class** - File reading/writing/merging pattern
2. **Interactive prompts** - readline interface
3. **Validation** - Test configuration before saving
4. **Error messages** - Color-coded, user-friendly
5. **CLI structure** - Menu-based or direct commands

### 3.3 Dual-Mode Architecture (Reference)

**From docs/research/dual-mode-mcp-architecture-2025-11-29.md:**

The architecture document (2,379 lines) provides comprehensive design for:

1. **Direct Mode API** - In-process function calls
2. **MCP Server Mode** - Standard MCP protocol
3. **Automation Tools** - Create/test/execute automations
4. **mcp-install Command** - Installation automation (Section 5)

**Relevant Sections:**

- **Section 5.1:** Command Structure (~300 lines of implementation)
- **Section 5.2:** Configuration File Formats
- **Section 5.3:** Installation Flow diagram

**Key Design Decisions:**

- Auto-detection via `which` command checks
- Config generation functions per system
- Non-destructive merging logic
- Clear installation instructions per system

**Limitations Identified:**

- Uses project-relative paths (`./dist/index.js`)
- Assumes JSON format for all systems (Codex uses TOML)
- Doesn't handle global npm installation detection
- Missing validation for config formats

---

## 4. Command Interface Design

### 4.1 CLI Commands

**Primary Command:**

```bash
mcp-smartthings install [system] [options]
```

**Arguments:**

- `system` (optional): Target system name
  - `claude-desktop` - Claude Desktop app
  - `claude-code` - Claude Code CLI
  - `codex` - Codex CLI
  - `gemini-cli` - Gemini CLI
  - `auggie` - Auggie (if validated)
  - Auto-detect if not specified

**Options:**

- `--help, -h` - Show help message
- `--list, -l` - List supported systems
- `--detect, -d` - Detect installed systems only (no installation)
- `--force, -f` - Overwrite existing config (not merge)
- `--global` - Use global npm package path
- `--local` - Use local project path
- `--dry-run` - Show what would be installed without making changes

**Examples:**

```bash
# Auto-detect and install for all found systems
mcp-smartthings install

# Install for specific system
mcp-smartthings install claude-desktop

# Detect installed systems
mcp-smartthings install --detect

# Dry run (show changes without applying)
mcp-smartthings install --dry-run

# Force overwrite (not merge)
mcp-smartthings install claude-code --force

# List supported systems
mcp-smartthings install --list
```

### 4.2 Help Output

```
mcp-smartthings install - Install MCP server for agentic systems

Usage:
  mcp-smartthings install [system] [options]

Arguments:
  system              Target system (optional, auto-detect if not specified)

Options:
  -h, --help          Show this help message
  -l, --list          List supported systems
  -d, --detect        Detect installed systems only
  -f, --force         Overwrite existing config (not merge)
  --global            Use global npm package path
  --local             Use local project path
  --dry-run           Preview changes without applying

Supported Systems:
  claude-desktop      Claude Desktop app
  claude-code         Claude Code CLI
  codex               Codex CLI
  gemini-cli          Gemini CLI
  auggie              Auggie

Examples:
  mcp-smartthings install                    # Auto-detect and install
  mcp-smartthings install claude-desktop     # Install for Claude Desktop
  mcp-smartthings install --detect           # List detected systems
  mcp-smartthings install --dry-run          # Preview installation

Documentation: https://github.com/bobmatnyc/mcp-smartthings/docs/installation.md
```

### 4.3 Output Examples

**Success Output:**

```
🔍 Detecting installed agentic systems...
✓ Found: Claude Desktop (~/Library/Application Support/Claude/)
✓ Found: Claude Code (~/.claude/)

📦 Installing MCP SmartThings for Claude Desktop...
✓ Configuration written to ~/Library/Application Support/Claude/claude_desktop_config.json

📦 Installing MCP SmartThings for Claude Code...
✓ Configuration written to ~/.claude/settings.local.json

✅ Installation complete!

Next Steps:
1. Restart Claude Desktop and Claude Code
2. Set SMARTTHINGS_TOKEN environment variable:
   export SMARTTHINGS_TOKEN=your-token-here
3. Test MCP tools in Claude interface

Need help? Run: mcp-smartthings config
```

**Dry Run Output:**

```
🔍 Detecting installed agentic systems...
✓ Found: Claude Desktop (~/Library/Application Support/Claude/)

📋 Dry Run - No changes will be made

Would install for: Claude Desktop
Config file: ~/Library/Application Support/Claude/claude_desktop_config.json
Changes:
  + Add mcpServers.mcp-smartthings
    command: node
    args: ["/opt/homebrew/lib/node_modules/@bobmatnyc/mcp-smarterthings/dist/index.js"]
    env: { SMARTTHINGS_TOKEN: "${SMARTTHINGS_TOKEN}" }

Existing servers preserved:
  - filesystem
  - git

Run without --dry-run to apply changes.
```

**Error Output:**

```
❌ Installation failed

Error: No supported agentic systems detected.

Supported systems:
  - Claude Desktop
  - Claude Code
  - Codex
  - Gemini CLI
  - Auggie

To install manually:
1. Create config file for your system
2. Add MCP server configuration
3. See: https://github.com/bobmatnyc/mcp-smartthings/docs/manual-install.md

Or specify system explicitly:
  mcp-smartthings install claude-desktop
```

---

## 5. Installation Workflow

### 5.1 Workflow Diagram

```
┌─────────────────────────────────────────────┐
│  User runs: mcp-smartthings install         │
└────────────┬────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Parse CLI arguments                        │
│  - System name (optional)                   │
│  - Options (--help, --detect, etc.)         │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Detect package installation location      │
│  - Check global: npm root -g               │
│  - Check local: process.cwd() + /dist      │
│  - Select path based on --global/--local   │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Detect installed agentic systems          │
│  - Claude Desktop: Check app or config dir │
│  - Claude Code: Check binary or ~/.claude  │
│  - Codex: Check binary or ~/.codex         │
│  - Gemini CLI: Check binary or ~/.gemini   │
│  - Auggie: Check binary or ~/.auggie       │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Filter systems                             │
│  - If system specified: Use that system    │
│  - If auto-detect: Use all found systems   │
│  - If none found: Show error and exit      │
└────────────┬───────────────────────────────┘
             │
             ▼
     ┌───────┴───────┐
     │  For each     │
     │  system:      │
     └───────┬───────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Generate system-specific config           │
│  - Load config template for system         │
│  - Insert package path                     │
│  - Add environment variables               │
│  - Format: JSON or TOML                    │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Read existing config (if exists)          │
│  - Parse JSON or TOML                      │
│  - Handle parse errors gracefully          │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Merge configurations                       │
│  - If --force: Replace completely          │
│  - If merge: Preserve existing servers     │
│  - Add/update mcp-smartthings entry        │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Validate merged config                     │
│  - Check JSON/TOML syntax                  │
│  - Verify required fields                  │
│  - Test package path exists                │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Write config file                          │
│  - Create directory if needed              │
│  - Write formatted JSON/TOML               │
│  - Set file permissions                    │
│  - Create backup if --force used           │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│  Display success message                    │
│  - Config file path                        │
│  - What was installed                      │
│  - Next steps                              │
│  - Environment variable setup              │
└────────────────────────────────────────────┘
```

### 5.2 Detection Logic

**Priority Order:**

1. **Explicit system argument** - Use specified system
2. **Auto-detection** - Check for all systems
3. **Interactive selection** - If multiple found, ask user

**Detection Methods:**

```typescript
// Method 1: Check for binary in PATH
function isBinaryAvailable(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Method 2: Check for config directory
function isConfigDirExists(path: string): boolean {
  return existsSync(path);
}

// Method 3: Check for app installation (macOS)
function isAppInstalled(appPath: string): boolean {
  return existsSync(appPath);
}

// Combined detection
function detectSystem(system: AgenticSystem): boolean {
  // Check binary first (most reliable)
  if (system.detectCommand && isBinaryAvailable(system.detectCommand)) {
    return true;
  }

  // Check config directory (indicates previous usage)
  if (isConfigDirExists(dirname(system.configPath))) {
    return true;
  }

  // Check app installation (platform-specific)
  if (system.appPath && isAppInstalled(system.appPath)) {
    return true;
  }

  return false;
}
```

### 5.3 Config Generation Logic

**JSON Systems (Claude Desktop, Claude Code, Gemini CLI, Auggie):**

```typescript
function generateJsonConfig(system: AgenticSystem, packagePath: string): object {
  const baseConfig = {
    command: 'node',
    args: [packagePath],
    env: {
      SMARTTHINGS_TOKEN: '${SMARTTHINGS_TOKEN}',
    },
  };

  // System-specific structure
  switch (system.name) {
    case 'claude-desktop':
    case 'claude-code':
    case 'gemini-cli':
      return {
        mcpServers: {
          'mcp-smartthings': baseConfig,
        },
      };

    case 'auggie':
      return {
        'mcp-smartthings': {
          ...baseConfig,
          transport: 'stdio',
        },
      };

    default:
      throw new Error(`Unknown system: ${system.name}`);
  }
}
```

**TOML System (Codex):**

```typescript
import TOML from '@iarna/toml';

function generateTomlConfig(system: AgenticSystem, packagePath: string): string {
  const config = {
    mcp_servers: {
      'mcp-smartthings': {
        command: 'node',
        args: [packagePath],
        env: {
          SMARTTHINGS_TOKEN: '${SMARTTHINGS_TOKEN}',
        },
      },
    },
  };

  return TOML.stringify(config);
}
```

### 5.4 Merging Logic

**Non-Destructive Merge (Default):**

```typescript
function mergeConfigs(existing: object, newConfig: object): object {
  // Deep merge preserving existing servers
  const merged = { ...existing };

  // For JSON configs with mcpServers
  if ('mcpServers' in existing && 'mcpServers' in newConfig) {
    merged.mcpServers = {
      ...(existing as any).mcpServers,
      ...(newConfig as any).mcpServers,
    };
  }

  // For flat configs (Auggie)
  else {
    Object.assign(merged, newConfig);
  }

  return merged;
}
```

**Force Overwrite:**

```typescript
function overwriteConfig(existing: object, newConfig: object, backupPath: string): void {
  // Create backup of existing config
  if (existsSync(configPath)) {
    const backup = readFileSync(configPath, 'utf-8');
    writeFileSync(backupPath, backup);
    console.log(chalk.yellow(`Backup created: ${backupPath}`));
  }

  // Write new config
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}
```

**TOML Merging:**

```typescript
import TOML from '@iarna/toml';

function mergeTomlConfigs(existingToml: string, newConfig: object): string {
  const existing = TOML.parse(existingToml);

  // Merge mcp_servers section
  if (!existing.mcp_servers) {
    existing.mcp_servers = {};
  }

  Object.assign(existing.mcp_servers, (newConfig as any).mcp_servers);

  return TOML.stringify(existing);
}
```

---

## 6. Configuration Management

### 6.1 Package Path Detection

**Strategy:**

1. Check if globally installed
2. Fall back to local project path
3. Allow explicit override with --global/--local

**Implementation:**

```typescript
function detectPackagePath(options: { global?: boolean; local?: boolean }): string {
  // Explicit override
  if (options.global) {
    return getGlobalPackagePath();
  }
  if (options.local) {
    return getLocalPackagePath();
  }

  // Auto-detect: prefer global if available
  const globalPath = getGlobalPackagePath();
  if (existsSync(globalPath)) {
    return globalPath;
  }

  // Fall back to local
  return getLocalPackagePath();
}

function getGlobalPackagePath(): string {
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    return join(npmRoot, '@bobmatnyc', 'mcp-smarterthings', 'dist', 'index.js');
  } catch {
    throw new Error('Global npm package not found. Install globally: npm install -g @bobmatnyc/mcp-smarterthings');
  }
}

function getLocalPackagePath(): string {
  return join(process.cwd(), 'dist', 'index.js');
}
```

### 6.2 Environment Variable Handling

**Approach:**

- Use environment variable placeholders in config
- Not actual values (security best practice)
- User sets actual values in shell profile

**Config Format:**

```json
{
  "env": {
    "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
  }
}
```

**User Instructions:**

```bash
# Add to ~/.zshrc or ~/.bashrc
export SMARTTHINGS_TOKEN=your-actual-token-here

# Or use .env file (if supported by system)
echo "SMARTTHINGS_TOKEN=your-actual-token-here" >> ~/.env
```

### 6.3 Config File Permissions

**Security Considerations:**

- Config files may contain sensitive paths
- Should be readable only by user

**Implementation:**

```typescript
import { chmodSync } from 'fs';

function writeConfigSecurely(path: string, content: string): void {
  // Write config
  writeFileSync(path, content, 'utf-8');

  // Set permissions: rw------- (600)
  chmodSync(path, 0o600);
}
```

---

## 7. Error Handling and Validation

### 7.1 Error Categories

**1. Detection Errors:**
- No systems found
- Invalid system name specified
- System binary found but config dir missing

**2. Path Errors:**
- Package not installed globally
- Local dist/ directory missing
- Package path not executable

**3. Config Errors:**
- Existing config malformed (invalid JSON/TOML)
- Permission denied (can't write config)
- Config directory doesn't exist (can't create)

**4. Merge Errors:**
- Conflicting server names
- Incompatible config structures
- TOML parse errors

### 7.2 Error Messages

**No Systems Detected:**

```
❌ No supported agentic systems detected.

Searched for:
  ✗ Claude Desktop - ~/Library/Application Support/Claude/ (not found)
  ✗ Claude Code - ~/.claude/ (not found)
  ✗ Codex - ~/.codex/ (not found)
  ✗ Gemini CLI - ~/.gemini/ (not found)
  ✗ Auggie - ~/.auggie/ (not found)

Options:
1. Install an agentic system first
2. Specify system explicitly: mcp-smartthings install claude-desktop
3. Manual installation: See docs/manual-install.md
```

**Package Not Found:**

```
❌ MCP SmartThings package not found.

Searched:
  ✗ Global: /opt/homebrew/lib/node_modules/@bobmatnyc/mcp-smarterthings (not found)
  ✗ Local: ./dist/index.js (not found)

Solutions:
1. Install globally: npm install -g @bobmatnyc/mcp-smarterthings
2. Build locally: npm run build
3. Use --global or --local to specify location
```

**Config Parse Error:**

```
⚠️  Existing config file is malformed.

File: ~/.claude/settings.local.json
Error: Unexpected token } in JSON at position 42

Options:
1. Fix the JSON manually
2. Use --force to overwrite (creates backup)
3. Delete the config and try again

Backup will be created at: ~/.claude/settings.local.json.backup
```

**Permission Denied:**

```
❌ Permission denied writing config file.

File: ~/Library/Application Support/Claude/claude_desktop_config.json
Error: EACCES: permission denied

Solutions:
1. Check file permissions: ls -l <file>
2. Fix permissions: chmod u+w <file>
3. Run with sudo (not recommended)
```

### 7.3 Validation

**Pre-Installation Validation:**

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateInstallation(
  system: AgenticSystem,
  packagePath: string
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check package path exists
  if (!existsSync(packagePath)) {
    result.valid = false;
    result.errors.push(`Package not found: ${packagePath}`);
  }

  // Check config directory exists or can be created
  const configDir = dirname(system.configPath);
  if (!existsSync(configDir)) {
    try {
      mkdirSync(configDir, { recursive: true });
      result.warnings.push(`Created config directory: ${configDir}`);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Cannot create config directory: ${configDir}`);
    }
  }

  // Check write permissions
  try {
    accessSync(configDir, constants.W_OK);
  } catch {
    result.valid = false;
    result.errors.push(`No write permission: ${configDir}`);
  }

  return result;
}
```

**Post-Installation Validation:**

```typescript
function validateConfig(system: AgenticSystem): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    // Read config
    const content = readFileSync(system.configPath, 'utf-8');

    // Parse based on format
    if (system.configType === 'json') {
      const config = JSON.parse(content);

      // Validate structure
      if (!config.mcpServers && !config['mcp-smartthings']) {
        result.warnings.push('Config structure unexpected');
      }

      // Check our entry exists
      const hasOurEntry =
        config.mcpServers?.['mcp-smartthings'] ||
        config['mcp-smartthings'];

      if (!hasOurEntry) {
        result.valid = false;
        result.errors.push('MCP SmartThings entry not found in config');
      }
    } else if (system.configType === 'toml') {
      const config = TOML.parse(content);

      // Check TOML structure
      if (!config.mcp_servers?.['mcp-smartthings']) {
        result.valid = false;
        result.errors.push('MCP SmartThings entry not found in TOML config');
      }
    }
  } catch (error) {
    result.valid = false;
    result.errors.push(`Config validation failed: ${error.message}`);
  }

  return result;
}
```

---

## 8. Implementation Roadmap

### Phase 1: Core Installation Logic (Day 1-2)

**Goal:** Implement basic install.ts with detection and config generation

**Tasks:**

1. Create src/cli/install.ts skeleton
2. Implement CLI argument parsing (util.parseArgs)
3. Implement system detection logic
4. Implement package path detection
5. Create AgenticSystem type definitions
6. Add TOML dependency: npm install @iarna/toml

**Deliverables:**

- [ ] src/cli/install.ts (basic structure)
- [ ] src/types/install.ts (type definitions)
- [ ] Detection logic working for all 4 systems
- [ ] Package path detection (global + local)

**Estimated Effort:** 2 days

### Phase 2: Config Generation (Day 2-3)

**Goal:** Implement config generators for each system

**Tasks:**

1. Implement JSON config generator (Claude Desktop, Claude Code, Gemini CLI, Auggie)
2. Implement TOML config generator (Codex)
3. Add system-specific config templates
4. Implement config file reading/parsing
5. Add error handling for malformed configs

**Deliverables:**

- [ ] Config generators for all systems
- [ ] TOML support for Codex
- [ ] Config parsing with error handling
- [ ] Unit tests for generators

**Estimated Effort:** 1 day

### Phase 3: Merging and Validation (Day 3-4)

**Goal:** Implement non-destructive merging and validation

**Tasks:**

1. Implement config merging logic (preserve existing)
2. Implement --force overwrite with backup
3. Add pre-installation validation
4. Add post-installation validation
5. Implement comprehensive error messages
6. Add --dry-run mode

**Deliverables:**

- [ ] Non-destructive merging working
- [ ] Validation functions complete
- [ ] Error messages user-friendly
- [ ] Dry-run mode functional

**Estimated Effort:** 1 day

### Phase 4: Testing and Polish (Day 4-5)

**Goal:** Test all systems and add documentation

**Tasks:**

1. Test installation on each system
2. Test auto-detection with multiple systems
3. Test error scenarios (no package, no permissions, etc.)
4. Add CLI help and documentation
5. Update README with installation instructions
6. Create docs/installation-guide.md
7. Add unit tests for core functions
8. Add integration tests

**Deliverables:**

- [ ] All systems tested and verified
- [ ] Error scenarios handled gracefully
- [ ] CLI help complete
- [ ] Documentation updated
- [ ] Tests passing (unit + integration)

**Estimated Effort:** 1-2 days

### Total Effort: 5 days

**Daily Breakdown:**

| Day | Tasks | Status |
|-----|-------|--------|
| Day 1 | Core structure, detection logic | Pending |
| Day 2 | Package detection, config generation | Pending |
| Day 3 | Merging logic, validation | Pending |
| Day 4 | Error handling, dry-run mode | Pending |
| Day 5 | Testing, documentation, polish | Pending |

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test Coverage:**

```typescript
// tests/cli/install.test.ts

describe('System Detection', () => {
  it('detects Claude Desktop from app installation', () => {});
  it('detects Claude Code from binary', () => {});
  it('detects Codex from config directory', () => {});
  it('detects Gemini CLI from binary', () => {});
  it('returns empty array when no systems found', () => {});
});

describe('Package Path Detection', () => {
  it('finds global package path', () => {});
  it('falls back to local path', () => {});
  it('respects --global flag', () => {});
  it('respects --local flag', () => {});
  it('throws error if package not found', () => {});
});

describe('Config Generation', () => {
  it('generates JSON config for Claude Desktop', () => {});
  it('generates JSON config for Claude Code', () => {});
  it('generates TOML config for Codex', () => {});
  it('generates JSON config for Gemini CLI', () => {});
  it('includes correct package path', () => {});
  it('includes environment variables', () => {});
});

describe('Config Merging', () => {
  it('preserves existing servers', () => {});
  it('adds new mcp-smartthings entry', () => {});
  it('updates existing mcp-smartthings entry', () => {});
  it('handles empty existing config', () => {});
  it('merges TOML configs correctly', () => {});
});

describe('Validation', () => {
  it('validates package path exists', () => {});
  it('validates config directory writable', () => {});
  it('validates JSON config structure', () => {});
  it('validates TOML config structure', () => {});
  it('reports validation errors', () => {});
});
```

### 9.2 Integration Tests

**Test Scenarios:**

```typescript
// tests/integration/install.integration.test.ts

describe('End-to-End Installation', () => {
  it('installs for single detected system', async () => {
    // Setup: Create mock config directory
    // Run: mcp-smartthings install
    // Verify: Config file created with correct content
    // Cleanup: Remove test config
  });

  it('installs for multiple systems', async () => {
    // Setup: Create mock directories for multiple systems
    // Run: mcp-smartthings install
    // Verify: All systems have correct configs
  });

  it('handles --dry-run without making changes', async () => {
    // Run: mcp-smartthings install --dry-run
    // Verify: No config files created
    // Verify: Output shows what would be done
  });

  it('merges with existing config', async () => {
    // Setup: Create existing config with other servers
    // Run: mcp-smartthings install
    // Verify: Existing servers preserved
    // Verify: New server added
  });

  it('overwrites with --force', async () => {
    // Setup: Create existing config
    // Run: mcp-smartthings install --force
    // Verify: Old config backed up
    // Verify: New config written
  });
});
```

### 9.3 Manual Testing Checklist

**Pre-Release Testing:**

- [ ] Test on macOS with Claude Desktop
- [ ] Test on macOS with Claude Code
- [ ] Test on macOS with Codex
- [ ] Test on macOS with Gemini CLI
- [ ] Test with global installation
- [ ] Test with local installation
- [ ] Test auto-detection with multiple systems
- [ ] Test --detect flag
- [ ] Test --dry-run flag
- [ ] Test --force flag
- [ ] Test error: No systems found
- [ ] Test error: Package not found
- [ ] Test error: Permission denied
- [ ] Test error: Malformed existing config
- [ ] Verify config files valid after installation
- [ ] Verify MCP server starts correctly after install

**Cross-Platform Testing (Future):**

- [ ] Test on Windows with Claude Desktop
- [ ] Test on Linux with Claude Code
- [ ] Test on Linux with Codex
- [ ] Test on Linux with Gemini CLI

---

## 10. File Structure and Changes

### 10.1 New Files

```
src/
├── cli/
│   ├── install.ts                    # NEW: Installation command (~500 lines)
│   └── ...
├── types/
│   ├── install.ts                    # NEW: Installation types
│   └── ...
└── ...

tests/
├── cli/
│   ├── install.test.ts               # NEW: Unit tests
│   └── ...
└── integration/
    ├── install.integration.test.ts   # NEW: Integration tests
    └── ...

docs/
├── installation-guide.md             # NEW: Installation documentation
├── manual-install.md                 # NEW: Manual installation guide
└── research/
    └── mcp-install-command-architecture-2025-11-30.md  # This document
```

### 10.2 Modified Files

**package.json:**

```json
{
  "scripts": {
    "install": "pnpm run build && node dist/cli/install.js",
    "install:dev": "tsx src/cli/install.ts"
  },
  "dependencies": {
    "@iarna/toml": "^2.2.5"  // NEW: TOML support for Codex
  }
}
```

**src/index.ts:**

```typescript
// Add install command to CLI router
if (process.argv[2] === 'install') {
  import('./cli/install.js');
} else if (process.argv[2] === 'config') {
  import('./cli/config.js');
} else if (process.argv[2] === 'chat') {
  import('./cli/chat.js');
} else {
  // Start MCP server
  import('./server.js');
}
```

**README.md:**

- Add installation instructions using mcp-install command
- Add link to installation-guide.md
- Add troubleshooting section

### 10.3 File Size Estimates

| File | Estimated Lines | Notes |
|------|----------------|-------|
| src/cli/install.ts | ~500 | Main implementation |
| src/types/install.ts | ~100 | Type definitions |
| tests/cli/install.test.ts | ~300 | Unit tests |
| tests/integration/install.integration.test.ts | ~200 | Integration tests |
| docs/installation-guide.md | ~200 | User documentation |
| **Total** | **~1,300 lines** | Excluding dependencies |

### 10.4 Dependencies

**New Dependencies:**

```json
{
  "dependencies": {
    "@iarna/toml": "^2.2.5"
  }
}
```

**Existing Dependencies (Reused):**

- chalk - Color output
- fs - File system operations
- path - Path manipulation
- child_process - Execute system commands
- util - CLI argument parsing

---

## Conclusion

This research document provides comprehensive analysis and design specifications for implementing the `mcp-install` command (ticket 1M-413). Key findings include:

**Critical Corrections:**

1. Claude Desktop uses `claude_desktop_config.json`, not `mcp_settings.json`
2. Codex uses TOML format, not JSON
3. Package paths should reference global npm installation
4. Support both Claude Desktop and Claude Code (different systems)

**Implementation Approach:**

- 5-day implementation matching ticket estimate
- Phased approach: detection → generation → merging → testing
- Non-destructive merging preserves existing configs
- Comprehensive validation and error handling
- Interactive and CLI-driven modes

**Key Features:**

- Auto-detection of installed systems
- System-specific config generation (JSON + TOML)
- Non-destructive config merging
- Dry-run mode for preview
- Force overwrite with backup
- Comprehensive error messages
- CLI help and documentation

**Next Steps:**

1. Review and approve architecture
2. Add TOML dependency
3. Begin Phase 1 implementation
4. Create ticket 1M-413 subtasks
5. Implement, test, and document

**Questions for Review:**

1. Should we support Claude Desktop AND Claude Code (separate systems)?
2. Is Auggie format validated? (No official docs found)
3. Should we add uninstall command?
4. Should we add update/repair commands?

---

**End of Document**
