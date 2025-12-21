# OAuth Token Recovery Guide

## Problem Summary

**Issue**: Empty token database (0 bytes) + Expired PAT = Cannot start any server
**Root Cause**: Token database was corrupted/emptied, and PAT token expired
**Impact**: Both MCP server and REST API server cannot authenticate with SmartThings

## Chicken-and-Egg Problem

1. **OAuth routes** are in REST API server (`pnpm alexa-server:dev`)
2. **REST API server** requires valid authentication (OAuth OR PAT) to start
3. **OAuth tokens** are empty/corrupted
4. **PAT token** is expired (401 errors)
5. **Cannot get new OAuth tokens** without server running
6. **Cannot start server** without valid authentication

## Solution: Get New SmartThings PAT

### Step 1: Generate New PAT Token

1. Go to SmartThings Developer Portal:
   https://account.smartthings.com/tokens

2. Click **"Generate new token"**

3. Give it a name: `mcp-smarterthings-dev`

4. Select scopes:
   - ✅ `r:devices:*` (read devices)
   - ✅ `x:devices:*` (execute device commands)
   - ✅ `r:scenes:*` (read scenes)
   - ✅ `x:scenes:*` (execute scenes)
   - ✅ `r:locations:*` (read locations)
   - ✅ `r:rooms:*` (read rooms)
   - ✅ `r:rules:*` (read rules - if needed)

5. **Copy the token** (you won't see it again!)

### Step 2: Update `.env.local`

```bash
# Replace the expired token
SMARTTHINGS_PAT=<your-new-token-here>
```

### Step 3: Start REST API Server

```bash
# Kill any existing servers
pkill -f "tsx"

# Start REST API server
pnpm alexa-server:dev
```

**Expected Output**:
```
Server configuration:
  Port: 5182
  Local URL: http://localhost:5182

Endpoints:
  POST /alexa  - Alexa Smart Home directives
  GET  /health - Health check
  GET  /auth/smartthings - OAuth authentication
```

### Step 4: Verify Server is Running

```bash
curl http://localhost:5182/health
# Should return: {"status":"healthy","service":"smartthings-mcp","version":"0.7.2"}
```

### Step 5: Re-Authenticate via OAuth (Optional)

If you want to use OAuth instead of PAT:

```bash
# 1. Open OAuth authentication page
open http://localhost:5182/auth/smartthings

# 2. Login to SmartThings in browser
# 3. Grant permissions
# 4. You'll be redirected to callback URL

# 5. Verify OAuth tokens stored
curl http://localhost:5182/auth/smartthings/status | jq
```

**Expected Response**:
```json
{
  "authenticated": true,
  "method": "oauth",
  "hasTokens": true,
  "expiresAt": "2025-12-06T..."
}
```

### Step 6: Switch to OAuth Mode (Optional)

If OAuth authentication succeeded:

```bash
# 1. Stop server (Ctrl+C)

# 2. Remove PAT from .env.local (make it optional)
# SMARTTHINGS_PAT=  # Leave blank

# 3. Restart server - will use OAuth tokens
pnpm alexa-server:dev
```

Server logs should show:
```
SmartThings client initialized with OAuth {"authMethod":"oauth"}
```

## Verification Commands

### Check Authentication Method
```bash
# MCP Mode
curl http://localhost:5182/health

# REST API Mode
curl http://localhost:5182/api/devices | jq '.items[0].label'
```

### Check OAuth Token Status
```bash
# Check if tokens exist
ls -lh ./data/tokens.db

# Check token expiry
curl http://localhost:5182/auth/smartthings/status | jq '.expiresAt'
```

### Test SmartThings API
```bash
# List devices
curl http://localhost:5182/api/devices | jq '.items[].label'

# List rooms
curl http://localhost:5182/api/rooms | jq '.items[].name'
```

## Prevention

### 1. Token Database Backup

Add to your backup strategy:
```bash
# Backup tokens database
cp ./data/tokens.db ./data/tokens.db.backup-$(date +%Y%m%d)

# Restore from backup
cp ./data/tokens.db.backup-20251205 ./data/tokens.db
```

### 2. PAT as Fallback

Always keep a valid PAT in `.env.local` as fallback:
```bash
# Primary: OAuth tokens (in database)
# Fallback: PAT (in .env.local)
SMARTTHINGS_PAT=<valid-token-here>
```

### 3. Token Expiry Monitoring

Add monitoring for token expiry:
```bash
# Check token expiry
curl http://localhost:5182/auth/smartthings/status | jq -r '.expiresAt'

# Alert if expiring in < 24 hours
```

## Related Documentation

- [OAuth2 Security Fixes](./security/OAUTH2-SECURITY-FIXES-1M-543.md)
- [OAuth Token Integration](./implementation/OAUTH-TOKEN-INTEGRATION-1M-601.md)
- [Token Decryption Failure Analysis](./research/oauth-token-decryption-failure-analysis-2025-12-05.md)

---

**Last Updated**: December 5, 2025
**Status**: Awaiting user to provide new SmartThings PAT token
