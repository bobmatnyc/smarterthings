# SmartApp OAuth Setup Guide

This guide walks you through creating a SmartApp in the SmartThings Developer Workspace to enable OAuth2 authentication for your MCP SmartThings application.

## Prerequisites

1. **SmartThings Account** - You need a Samsung account with SmartThings access
2. **SmartThings CLI** - Install the official CLI tool
3. **Node.js** - Required for the CLI (v14+ recommended)

## Step 1: Install SmartThings CLI

```bash
# Install globally with npm
npm install -g @smartthings/cli

# Or with yarn
yarn global add @smartthings/cli

# Verify installation
smartthings --version
```

Expected output: `@smartthings/cli/X.X.X`

## Step 2: Authenticate with SmartThings

```bash
# Login to SmartThings
smartthings login

# This will open a browser window for authentication
# Follow the prompts to log in with your Samsung account
```

**What happens:**
1. Browser opens to SmartThings authentication page
2. You log in with your Samsung account credentials
3. CLI receives an authentication token
4. Token is stored in `~/.config/@smartthings/cli/config.yaml`

**Verify authentication:**
```bash
# List your locations (this confirms you're authenticated)
smartthings locations
```

## Step 3: Create a SmartApp

### Option A: Interactive Creation (Recommended for First Time)

```bash
smartthings apps:create
```

You'll be prompted for:

1. **App Name**: `MCP SmartThings` (or your preferred name)
2. **Display Name**: `MCP SmartThings OAuth`
3. **Description**: `OAuth integration for MCP SmartThings server`
4. **App Type**: Select `WEBHOOK_SMART_APP`
5. **Target URL**: Your server URL (e.g., `https://your-ngrok-url.ngrok-free.app/smartapp`)
   - For local development: Use ngrok URL
   - For production: Use your actual domain
6. **Classifications**: Select appropriate categories (e.g., `CONNECTED_SERVICE`)

### Option B: Create from Configuration File

Create a file `smartapp-config.yaml`:

```yaml
appName: mcp-smartthings
displayName: MCP SmartThings OAuth
description: OAuth integration for MCP SmartThings server
appType: WEBHOOK_SMART_APP
webhookTargetUrl: https://your-server.com/smartapp
classifications:
  - CONNECTED_SERVICE
oauth:
  clientName: MCP SmartThings Client
  scope:
    - r:devices:*
    - x:devices:*
    - r:locations:*
    - r:rooms:*
```

Then create the app:

```bash
smartthings apps:create -i smartapp-config.yaml
```

## Step 4: Get OAuth Client Credentials

After creating the SmartApp, you need to generate OAuth credentials:

```bash
# List your apps to get the App ID
smartthings apps

# Note the App ID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

# Generate OAuth credentials
smartthings apps:oauth:generate <APP_ID>
```

**Expected output:**
```
Client Name: MCP SmartThings Client
Client ID: xxxxxxxxxxxxxxxxxxxx
Client Secret: xxxxxxxxxxxxxxxxxxxx
```

⚠️ **IMPORTANT:** Save these credentials immediately! The client secret is only shown once.

## Step 5: Configure OAuth Settings

### Set Redirect URIs

Your OAuth redirect URI must match what's configured in your application.

```bash
smartthings apps:oauth:update <APP_ID>
```

You'll be prompted for:

1. **Redirect URIs**: Enter your callback URL(s), one per line:
   ```
   https://your-server.com/auth/smartthings/callback
   http://localhost:3000/auth/smartthings/callback  # For local dev
   ```
   Press Enter twice when done.

2. **Scope**: The permissions your app requests:
   ```
   r:devices:*
   x:devices:*
   r:locations:*
   r:rooms:*
   ```
   Press Enter twice when done.

### Verify OAuth Configuration

```bash
smartthings apps:oauth <APP_ID>
```

This shows your current OAuth configuration including:
- Client ID
- Redirect URIs
- Scopes

## Step 6: Configure Your Application

Add the credentials to your `.env.local` file:

```bash
# SmartThings OAuth Configuration
SMARTTHINGS_CLIENT_ID=your-client-id-from-step-4
SMARTTHINGS_CLIENT_SECRET=your-client-secret-from-step-4
OAUTH_REDIRECT_URI=https://your-server.com/auth/smartthings/callback
OAUTH_STATE_SECRET=generate-a-random-secret-here
TOKEN_ENCRYPTION_KEY=generate-another-random-secret-here
```

**Generate secure secrets:**

```bash
# Generate OAUTH_STATE_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate TOKEN_ENCRYPTION_KEY (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 7: Test OAuth Flow

1. **Start your server:**
   ```bash
   pnpm alexa-server:dev
   ```

2. **Navigate to OAuth initiation:**
   ```
   http://localhost:3000/auth/smartthings
   ```
   Or click the "Connect SmartThings" button in your web UI.

3. **Authorize the app:**
   - You'll be redirected to SmartThings authorization page
   - Log in with your Samsung account
   - Review and accept the requested permissions
   - You'll be redirected back to your app

4. **Verify connection:**
   ```bash
   curl http://localhost:3000/auth/smartthings/status
   ```

   Expected response:
   ```json
   {
     "success": true,
     "connected": true,
     "expiresAt": "2025-12-01T15:30:00.000Z",
     "scope": "r:devices:* x:devices:* r:locations:* r:rooms:*",
     "needsRefresh": false
   }
   ```

## Common Issues and Solutions

### Issue: "Invalid redirect_uri"

**Problem:** The redirect URI in your OAuth request doesn't match what's configured in SmartThings.

**Solution:**
1. Check your `.env.local` file: `OAUTH_REDIRECT_URI` must exactly match
2. Update SmartApp OAuth settings:
   ```bash
   smartthings apps:oauth:update <APP_ID>
   ```
3. Add the exact URI you're using (including http/https, domain, port, path)

### Issue: "Invalid client credentials"

**Problem:** Client ID or Client Secret is incorrect.

**Solution:**
1. Verify credentials in `.env.local` match the output from Step 4
2. If lost, regenerate OAuth credentials:
   ```bash
   smartthings apps:oauth:generate <APP_ID> --regenerate
   ```
   ⚠️ This invalidates old credentials!

### Issue: "Insufficient permissions"

**Problem:** Requested scopes don't match what the SmartApp is authorized for.

**Solution:**
1. Update SmartApp scopes:
   ```bash
   smartthings apps:oauth:update <APP_ID>
   ```
2. Add the required scopes when prompted
3. Users may need to re-authorize the app

### Issue: "Token refresh failing"

**Problem:** Refresh token expired or was revoked.

**Solution:**
1. User needs to re-authorize the app
2. Navigate to `/auth/smartthings` to start OAuth flow again
3. Check logs for specific error messages

## Development vs Production

### Development Setup (localhost)

```bash
# .env.local for development
OAUTH_REDIRECT_URI=http://localhost:3000/auth/smartthings/callback
```

**Redirect URI in SmartApp:**
```
http://localhost:3000/auth/smartthings/callback
```

### Production Setup (with ngrok)

```bash
# Start ngrok tunnel
ngrok http 3000 --subdomain=your-subdomain

# .env.local for production
OAUTH_REDIRECT_URI=https://your-subdomain.ngrok-free.app/auth/smartthings/callback
```

**Redirect URI in SmartApp:**
```
https://your-subdomain.ngrok-free.app/auth/smartthings/callback
```

### Production Setup (with custom domain)

```bash
# .env.local for production
OAUTH_REDIRECT_URI=https://yourdomain.com/auth/smartthings/callback
```

**Redirect URI in SmartApp:**
```
https://yourdomain.com/auth/smartthings/callback
```

## Useful CLI Commands Reference

```bash
# List all your apps
smartthings apps

# Get app details
smartthings apps <APP_ID>

# Update app configuration
smartthings apps:update <APP_ID>

# View OAuth configuration
smartthings apps:oauth <APP_ID>

# Update OAuth configuration
smartthings apps:oauth:update <APP_ID>

# Generate OAuth credentials
smartthings apps:oauth:generate <APP_ID>

# Regenerate OAuth credentials (invalidates old ones)
smartthings apps:oauth:generate <APP_ID> --regenerate

# Delete an app
smartthings apps:delete <APP_ID>

# View CLI configuration
smartthings config

# Logout
smartthings logout
```

## Security Best Practices

1. **Never commit credentials to git:**
   - Add `.env.local` to `.gitignore`
   - Use environment variables for production

2. **Use strong secrets:**
   - Generate random 32-byte secrets for `OAUTH_STATE_SECRET` and `TOKEN_ENCRYPTION_KEY`
   - Never reuse secrets across environments

3. **HTTPS only in production:**
   - Always use HTTPS for redirect URIs in production
   - HTTP is acceptable for `localhost` development only

4. **Rotate credentials periodically:**
   - Regenerate OAuth credentials every 90 days
   - Update all environments when rotating

5. **Monitor token usage:**
   - Check `/auth/smartthings/status` endpoint regularly
   - Watch for unusual refresh patterns in logs

## Next Steps

After completing SmartApp setup:

1. ✅ OAuth flow should work end-to-end
2. ✅ Tokens automatically refresh every 23 hours
3. ✅ Users can disconnect and reconnect via web UI
4. ✅ All API calls use OAuth tokens instead of PAT

**Migration from PAT:**
- Old PAT tokens can coexist with OAuth
- OAuth takes precedence when configured
- Remove `SMARTTHINGS_PAT` from `.env.local` after OAuth is working

## Support

- **SmartThings CLI Documentation:** https://github.com/SmartThingsCommunity/smartthings-cli
- **OAuth Integration Guide:** https://developer.smartthings.com/docs/connected-services/oauth-integrations
- **Developer Portal:** https://smartthings.developer.samsung.com/

---

**Last Updated:** 2025-11-30
**OAuth Implementation Version:** 1.0.0
