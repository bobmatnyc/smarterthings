# OAuth Adapter Initialization Fix - Verification Guide

**Ticket**: Fix SmartThings adapter initialization to check OAuth tokens before PAT fallback
**Date**: 2025-12-05
**Status**: Implemented, Pending Verification

## Problem Summary

The `initializeSmartThingsAdapter()` function in `src/server-alexa.ts` was only checking for PAT tokens in environment variables. It never checked the token storage for OAuth tokens, causing the adapter to remain uninitialized even after successful OAuth authentication.

**Broken Flow:**
1. OAuth completes → tokens stored in database
2. Adapter initialization skipped (no PAT in environment)
3. Health endpoint returns `initialized: false`
4. Frontend shows OAuth button again → **REDIRECT LOOP**

## Implementation Changes

### 1. Added TokenStorage Import

**File**: `src/server-alexa.ts` (line 75)

```typescript
import { getTokenStorage } from './storage/token-storage.js';
```

### 2. Modified Initialization Function

**File**: `src/server-alexa.ts` (lines 1620-1683)

**Key Changes:**
- Check OAuth tokens FIRST (from TokenStorage)
- Fall back to PAT if no OAuth tokens exist
- Initialize adapter with whichever credential is available
- Clear log messages distinguishing OAuth vs PAT initialization
- Proper error handling for token retrieval failures

**Initialization Priority:**
1. **Priority 1**: OAuth tokens from database (`TokenStorage.getTokens('default')`)
2. **Priority 2**: PAT from environment (`environment.SMARTTHINGS_PAT`)
3. **Priority 3**: Skip initialization, OAuth routes available for user authentication

### 3. Enhanced Logging

**OAuth Initialization Log:**
```
SmartThings adapter initialized with OAuth tokens
  expiresAt: 2025-12-05T12:00:00.000Z
  scope: r:devices:* x:devices:* r:scenes:* x:scenes:*
```

**PAT Initialization Log:**
```
SmartThings adapter initialized with PAT
```

**No Credentials Log:**
```
No SmartThings credentials available (neither OAuth nor PAT)
Users can authenticate via /auth/smartthings OAuth flow
```

## Verification Steps

### Pre-Verification Checklist

- [ ] TypeScript type check passes (`pnpm run typecheck`)
- [ ] No new linting errors introduced
- [ ] OAuth tokens stored in database (after OAuth flow)

### Manual Testing Procedure

#### Test 1: OAuth Tokens Present (Primary Case)

**Setup:**
1. Ensure `data/tokens.db` contains OAuth tokens:
   ```bash
   sqlite3 data/tokens.db "SELECT COUNT(*) FROM oauth_tokens WHERE user_id = 'default';"
   # Expected: 1 (or higher)
   ```

2. Ensure NO PAT in environment:
   ```bash
   grep SMARTTHINGS_PAT .env.local
   # Expected: Empty or commented out
   ```

**Test:**
1. Start backend server:
   ```bash
   pnpm dev
   ```

2. Check server logs for initialization message:
   ```
   SmartThings adapter initialized with OAuth tokens
     expiresAt: <timestamp>
     scope: <scopes>
   ```

3. Check health endpoint:
   ```bash
   curl http://localhost:5182/health | jq
   ```

   **Expected Response:**
   ```json
   {
     "status": "ok",
     "timestamp": "<timestamp>",
     "smartthings": {
       "initialized": true,
       "authMethod": "oauth"
     }
   }
   ```

4. Check frontend (http://localhost:5181):
   - Should load normally
   - Should NOT show OAuth authentication button
   - Devices should be visible

**Success Criteria:**
- ✅ Logs show "initialized with OAuth tokens"
- ✅ Health endpoint returns `initialized: true`
- ✅ Frontend loads without OAuth prompt
- ✅ No redirect loop

---

#### Test 2: PAT Fallback (Secondary Case)

**Setup:**
1. Clear OAuth tokens from database:
   ```bash
   sqlite3 data/tokens.db "DELETE FROM oauth_tokens WHERE user_id = 'default';"
   ```

2. Set PAT in environment:
   ```bash
   echo "SMARTTHINGS_PAT=your-pat-token-here" >> .env.local
   ```

**Test:**
1. Restart backend server:
   ```bash
   pnpm dev
   ```

2. Check server logs for initialization message:
   ```
   SmartThings adapter initialized with PAT
   ```

3. Check health endpoint:
   ```bash
   curl http://localhost:5182/health | jq
   ```

   **Expected Response:**
   ```json
   {
     "status": "ok",
     "timestamp": "<timestamp>",
     "smartthings": {
       "initialized": true,
       "authMethod": "pat"
     }
   }
   ```

**Success Criteria:**
- ✅ Logs show "initialized with PAT"
- ✅ Health endpoint returns `initialized: true`
- ✅ Adapter functions normally

---

#### Test 3: No Credentials (Tertiary Case)

**Setup:**
1. Clear OAuth tokens:
   ```bash
   sqlite3 data/tokens.db "DELETE FROM oauth_tokens WHERE user_id = 'default';"
   ```

2. Remove PAT from environment:
   ```bash
   # Comment out or remove SMARTTHINGS_PAT from .env.local
   ```

**Test:**
1. Restart backend server:
   ```bash
   pnpm dev
   ```

2. Check server logs for warning messages:
   ```
   No SmartThings credentials available (neither OAuth nor PAT)
   Users can authenticate via /auth/smartthings OAuth flow
   ```

3. Check health endpoint:
   ```bash
   curl http://localhost:5182/health | jq
   ```

   **Expected Response:**
   ```json
   {
     "status": "ok",
     "timestamp": "<timestamp>",
     "smartthings": {
       "initialized": false
     }
   }
   ```

4. Check OAuth endpoints are available:
   ```bash
   curl http://localhost:5182/auth/smartthings/start
   # Expected: 302 redirect to SmartThings OAuth page
   ```

**Success Criteria:**
- ✅ Logs show "No credentials available"
- ✅ Health endpoint returns `initialized: false`
- ✅ OAuth routes are accessible
- ✅ Frontend shows OAuth button

---

#### Test 4: OAuth Token Retrieval Failure (Error Case)

**Setup:**
1. Corrupt token encryption by changing `TOKEN_ENCRYPTION_KEY`:
   ```bash
   echo "TOKEN_ENCRYPTION_KEY=wrong-key-value" >> .env.local
   ```

2. Ensure tokens exist in database:
   ```bash
   sqlite3 data/tokens.db "SELECT COUNT(*) FROM oauth_tokens WHERE user_id = 'default';"
   # Expected: 1
   ```

**Test:**
1. Start backend server:
   ```bash
   pnpm dev
   ```

2. Check server logs for fallback message:
   ```
   Failed to retrieve or use OAuth tokens, falling back to PAT
   ```

3. Verify server continues to run (doesn't crash)

**Success Criteria:**
- ✅ Error is caught and logged
- ✅ Server falls back to PAT (if available)
- ✅ Server doesn't crash

---

## Automated Test Script

```bash
#!/bin/bash
# File: scripts/verify-oauth-initialization.sh

set -e

echo "OAuth Adapter Initialization Verification"
echo "========================================="

# Test 1: Check if OAuth tokens exist
echo -e "\n[Test 1] Checking OAuth token presence..."
TOKEN_COUNT=$(sqlite3 data/tokens.db "SELECT COUNT(*) FROM oauth_tokens WHERE user_id = 'default';")
if [ "$TOKEN_COUNT" -gt 0 ]; then
  echo "✅ OAuth tokens found ($TOKEN_COUNT)"
else
  echo "⚠️  No OAuth tokens found"
fi

# Test 2: Check if PAT is configured
echo -e "\n[Test 2] Checking PAT configuration..."
if grep -q "^SMARTTHINGS_PAT=" .env.local 2>/dev/null; then
  echo "✅ PAT configured in .env.local"
else
  echo "⚠️  No PAT configured"
fi

# Test 3: Start server and check health
echo -e "\n[Test 3] Starting server and checking health..."
pnpm dev &
SERVER_PID=$!
sleep 5

HEALTH_RESPONSE=$(curl -s http://localhost:5182/health)
INITIALIZED=$(echo $HEALTH_RESPONSE | jq -r '.smartthings.initialized')

if [ "$INITIALIZED" == "true" ]; then
  echo "✅ Adapter initialized successfully"
else
  echo "❌ Adapter NOT initialized"
fi

# Cleanup
kill $SERVER_PID

echo -e "\nVerification complete!"
```

## Expected Behavior After Fix

### Scenario 1: Fresh OAuth Authentication
1. User completes OAuth flow
2. Tokens stored in database
3. **NEW**: Server automatically detects OAuth tokens on next startup
4. Adapter initializes with OAuth credentials
5. Health endpoint returns `initialized: true`
6. Frontend loads normally (no OAuth button)

### Scenario 2: Existing OAuth Tokens
1. Server starts
2. **NEW**: Checks database for OAuth tokens BEFORE checking PAT
3. Finds OAuth tokens
4. Initializes adapter with OAuth credentials
5. Health endpoint returns `initialized: true`

### Scenario 3: No OAuth, PAT Available
1. Server starts
2. Checks database for OAuth tokens (none found)
3. **NEW**: Falls back to PAT from environment
4. Initializes adapter with PAT
5. Health endpoint returns `initialized: true`

### Scenario 4: No Credentials
1. Server starts
2. Checks database for OAuth tokens (none found)
3. Checks environment for PAT (not configured)
4. Logs warning but continues startup
5. OAuth routes available for user authentication
6. Health endpoint returns `initialized: false`

## Files Modified

- `src/server-alexa.ts` - Added TokenStorage import and modified initialization function

## Success Metrics

- [ ] OAuth tokens checked before PAT
- [ ] Adapter initializes with OAuth tokens if available
- [ ] Falls back to PAT if no OAuth tokens
- [ ] Logs clearly indicate which authentication method was used
- [ ] Health endpoint returns `initialized: true` after OAuth flow
- [ ] No redirect loop on frontend
- [ ] TypeScript type check passes
- [ ] No runtime errors during initialization

## Rollback Plan

If issues are discovered:
1. Revert changes to `src/server-alexa.ts`
2. Remove `getTokenStorage` import
3. Restore original initialization logic (PAT-only)

## Related Documentation

- [OAuth Recovery Guide](../OAUTH-RECOVERY-GUIDE.md)
- [OAuth Auto-Detection Fix](../implementation/OAUTH-AUTO-DETECTION-FIX.md)
- [Token Storage Implementation](../../src/storage/token-storage.ts)
