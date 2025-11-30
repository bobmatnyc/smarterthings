# MCP SmartThings Installation Guide

This guide explains how to install MCP SmartThings for various agentic coding systems using the automated `mcp-smartthings install` command.

## Quick Start

1. **Install the package globally**:
   ```bash
   npm install -g @bobmatnyc/mcp-smarterthings
   ```

2. **Run the installation command**:
   ```bash
   mcp-smartthings install
   ```

3. **Configure your SmartThings token**:
   ```bash
   export SMARTTHINGS_TOKEN=your-smartthings-pat-token
   ```

4. **Restart your agentic coding system** (Claude Desktop, Claude Code, Codex, etc.)

That's it! The MCP server will now be available in your coding environment.

---

## Supported Systems

The install command supports automatic detection and installation for:

- **Claude Desktop** - Desktop application (macOS/Windows)
- **Claude Code** - Command-line interface
- **Codex** - CLI tool
- **Gemini CLI** - Google's CLI tool
- **Auggie** - Community CLI tool

---

## Installation Methods

### Method 1: Auto-Detection (Recommended)

Auto-detect all installed systems and install for each:

```bash
mcp-smartthings install
```

### Method 2: Specific System

Install for a specific system:

```bash
mcp-smartthings install claude-desktop
mcp-smartthings install claude-code
mcp-smartthings install codex
mcp-smartthings install gemini-cli
mcp-smartthings install auggie
```

### Method 3: Dry Run Preview

Preview changes without making them:

```bash
mcp-smartthings install --dry-run
```

---

## Command Options

### Help

```bash
mcp-smartthings install --help
```

Shows all available options and examples.

### List Supported Systems

```bash
mcp-smartthings install --list
```

Displays all supported agentic systems.

### Detect Installed Systems

```bash
mcp-smartthings install --detect
```

Shows which systems are detected on your machine without installing.

### Force Overwrite

```bash
mcp-smartthings install --force
```

Overwrites existing configuration instead of merging (creates backup first).

### Package Location

```bash
# Use global npm installation
mcp-smartthings install --global

# Use local project build
mcp-smartthings install --local
```

By default, the command auto-detects the package location (prefers global if available).

---

## Configuration Files

The install command creates/updates configuration files in system-specific locations:

### Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**Format**:
```json
{
  "mcpServers": {
    "mcp-smartthings": {
      "command": "node",
      "args": ["/path/to/mcp-smarterthings/dist/index.js"],
      "env": {
        "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
      }
    }
  }
}
```

### Claude Code

**Path**: `~/.claude/settings.local.json`

**Format**: Same as Claude Desktop

### Codex

**Path**: `~/.codex/config.toml`

**Format**:
```toml
[mcp_servers.mcp-smartthings]
command = "node"
args = ["/path/to/mcp-smarterthings/dist/index.js"]
env = { "SMARTTHINGS_TOKEN" = "${SMARTTHINGS_TOKEN}" }
```

### Gemini CLI

**Path**: `~/.gemini/settings.json`

**Format**: Same as Claude Desktop

### Auggie

**Path**: `~/.auggie/servers.json`

**Format**:
```json
{
  "mcp-smartthings": {
    "command": "node",
    "args": ["/path/to/mcp-smarterthings/dist/index.js"],
    "env": {
      "SMARTTHINGS_TOKEN": "${SMARTTHINGS_TOKEN}"
    },
    "transport": "stdio"
  }
}
```

---

## Environment Variables

After installation, you need to set the SmartThings token:

### Temporary (Current Session)

```bash
export SMARTTHINGS_TOKEN=your-token-here
```

### Permanent (Shell Profile)

Add to `~/.zshrc` or `~/.bashrc`:

```bash
echo 'export SMARTTHINGS_TOKEN=your-token-here' >> ~/.zshrc
source ~/.zshrc
```

### Get Your Token

1. Visit https://account.smartthings.com/tokens
2. Click "Generate new token"
3. Give it a name (e.g., "MCP Server")
4. Select scopes: `devices`, `locations`, `scenes`
5. Copy the token (you won't see it again!)

---

## Non-Destructive Merging

By default, the install command **preserves existing MCP servers** in your configuration:

```bash
# Before installation:
{
  "mcpServers": {
    "filesystem": { ... },
    "git": { ... }
  }
}

# After installation:
{
  "mcpServers": {
    "filesystem": { ... },  # Preserved
    "git": { ... },         # Preserved
    "mcp-smartthings": { ... }  # Added
  }
}
```

### Force Overwrite

To replace instead of merge (creates backup first):

```bash
mcp-smartthings install --force
```

Backup file: `config-file.backup-YYYY-MM-DD`

---

## Troubleshooting

### No Systems Detected

```
❌ No supported systems detected
```

**Solutions**:
1. Install an agentic system first
2. Specify system explicitly: `mcp-smartthings install claude-desktop`
3. See [manual installation guide](./manual-install.md)

### Package Not Found

```
❌ Package not found
```

**Solutions**:
1. Install globally: `npm install -g @bobmatnyc/mcp-smarterthings`
2. Build locally: `pnpm build`
3. Use `--global` or `--local` to specify location

### Config File Malformed

```
⚠️ Existing config file is malformed
```

**Solutions**:
1. Fix the JSON/TOML syntax manually
2. Use `--force` to overwrite (creates backup)
3. Delete the config and try again

### Permission Denied

```
❌ Permission denied writing config file
```

**Solutions**:
1. Check file permissions: `ls -l <file>`
2. Fix permissions: `chmod u+w <file>`
3. Check directory permissions

---

## Verification

After installation, verify the MCP server is working:

1. **Restart your agentic system**

2. **Check for MCP tools** in your coding interface:
   - `list_devices` - List SmartThings devices
   - `control_device` - Control a device
   - `get_device_status` - Get device status
   - etc.

3. **Test a command**:
   ```
   User: List my SmartThings devices
   Assistant: [calls list_devices MCP tool]
   ```

---

## Updates

To update to a new version:

1. **Update the package**:
   ```bash
   npm update -g @bobmatnyc/mcp-smarterthings
   ```

2. **Re-run installation**:
   ```bash
   mcp-smartthings install
   ```

   The command will update the package path in your configurations.

---

## Uninstallation

To remove MCP SmartThings:

1. **Manually edit config files** to remove the `mcp-smartthings` entry

2. **Or use --force with empty config** (future feature)

3. **Uninstall the package**:
   ```bash
   npm uninstall -g @bobmatnyc/mcp-smarterthings
   ```

---

## Support

- **Issues**: https://github.com/bobmatnyc/mcp-smartthings/issues
- **Discussions**: https://github.com/bobmatnyc/mcp-smartthings/discussions
- **Manual Installation**: [manual-install.md](./manual-install.md)

---

## Next Steps

- [Configure SmartThings API](./smartthings-setup.md)
- [Use MCP Tools](../README.md#usage)
- [Advanced Configuration](./advanced-config.md)
