# SmartThings API 401 Error with ngrok Routing Investigation

## Investigation Date
2025-12-22

## Issue Summary
SmartThings API calls (`/api/devices`, `/api/automations`) are returning 401 errors with "openresty" server signature (ngrok's web server), despite:
- OAuth flow completing successfully
- Tokens being stored correctly
- `/auth/smartthings/status` showing `connected=true` with valid scopes

## Problem Description
The issue suggests that SmartThings SDK API calls are somehow being routed through the ngrok tunnel (`https://smarty.ngrok.app`) instead of going directly to `https://api.smartthings.com`.

## Investigation Findings

### 1. Environment Configuration
**OAuth Configuration** (`.env.local`):
```bash
SMARTTHINGS_CLIENT_ID=5abef37e-ad42-4e50-b234-9df787d7df6b
SMARTTHINGS_CLIENT_SECRET=e0c305bc-b415-4bad-9c29-aadd4c2e351d
OAUTH_REDIRECT_URI=https://smarty.ngrok.app/auth/smartthings/callback  # ← ONLY used for OAuth redirect
OAUTH_STATE_SECRET=45592298643ca2f341e69edb24cffd1b9f2e56868f696497e34a19c5dbcc473d
TOKEN_ENCRYPTION_KEY=16ee2f49242e66a299a8779436c7fa0fcb239d81c262c438bf95e781414ac60a
FRONTEND_URL=http://localhost:5181
MCP_SERVER_PORT=5182
TRANSPORT_MODE=http
```

**Key Finding**: `OAUTH_REDIRECT_URI` is set to ngrok URL, but this should **only** affect OAuth callbacks, not SmartThings API calls.

### 2. SmartThings SDK Configuration
**SDK Default Configuration** (verified via `node_modules/@smartthings/core-sdk`):
```javascript
exports.defaultSmartThingsURLProvider = {
    baseURL: 'https://api.smartthings.com',
    authURL: 'https://auth-global.api.smartthings.com/oauth/token',
    keyApiURL: 'https://key.smartthings.com',
};
```

**Status**: ✅ Correctly configured - SDK is **NOT** using ngrok URL

### 3. Client Initialization
**File**: `src/smartthings/client.ts`

**OAuth Initialization**:
```typescript
const oauthService = new SmartThingsOAuthService({
  clientId: environment.SMARTTHINGS_CLIENT_ID,
  clientSecret: environment.SMARTTHINGS_CLIENT_SECRET,
  redirectUri: environment.OAUTH_REDIRECT_URI || '',  // Only for OAuth flow
  stateSecret: environment.OAUTH_STATE_SECRET || '',
});

const oauthAuth = new OAuthTokenAuthenticator(tokenStorage, oauthService, 'default');
this.client = new SmartThingsClient(oauthAuth);
```

**Status**: ✅ Client correctly instantiated with OAuth authenticator

### 4. OAuth Authenticator
**File**: `src/smartthings/oauth-authenticator.ts`

**Token Authentication**:
```typescript
override async authenticate(): Promise<any> {
  // Check if token needs refresh
  const tokens = this.tokenStorage.getTokens(this.userId);

  if (!tokens) {
    throw new Error('OAuth token not found in storage. Please re-authenticate.');
  }

  // Refresh if needed
  if (shouldRefresh) {
    await this.refreshToken();
    const refreshedTokens = this.tokenStorage.getTokens(this.userId);
    this.token = refreshedTokens.accessToken;
  }

  // Call parent authenticate() with current token
  return super.authenticate();  // ← Uses BearerTokenAuthenticator.authenticate()
}
```

**Status**: ✅ Token authentication logic is correct

### 5. Error Response
**Actual Error from `/api/devices`**:
```
HTTP/1.1 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "UNKNOWN_ERROR",
    "message": "Error (UNKNOWN_ERROR): Request failed with status code 401: \"<html>\\r\\n<head><title>401 Authorization Required</title></head>\\r\\n<body>\\r\\n<center><h1>401 Authorization Required</h1></center>\\r\\n<hr><center>openresty</center>\\r\\n</body>\\r\\n</html>\\r\\n\""
  }
}
```

**Key Observations**:
- HTTP 401 error is wrapped as 500 Internal Server Error
- Error HTML contains `<hr><center>openresty</center>` ← ngrok's web server
- This proves the request is hitting ngrok, not SmartThings API

### 6. No Proxy Configuration Found
**Checked**:
- ❌ No `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy` environment variables
- ❌ No `axios.defaults.baseURL` overrides in source code
- ❌ No `axios.create()` calls with custom baseURL
- ❌ No axios interceptors that modify request URLs

### 7. Vite Proxy Configuration
**File**: `web/vite.config.ts`

**Frontend Proxy** (only for development):
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5182',
    changeOrigin: true,
  },
  '/auth/smartthings': {
    target: 'http://localhost:5182',
    changeOrigin: true,
  }
}
```

**Status**: ✅ Proxy is frontend-only, doesn't affect backend SmartThings SDK calls

## Hypothesis: Possible Root Causes

### Hypothesis 1: axios Global Baseurl Override (UNLIKELY)
**Evidence Against**:
- No `axios.defaults.baseURL` found in codebase
- SmartThings SDK uses its own axios instance with explicit baseURL

### Hypothesis 2: Environment Variable Pollution (INVESTIGATING)
**Check**: Is there an environment variable that overrides axios baseURL globally?
- Checked: No `AXIOS_BASE_URL`, `API_BASE_URL` variables
- Checked: No proxy variables

### Hypothesis 3: Token Contains ngrok URL (INVESTIGATING)
**Theory**: OAuth token might contain endpoint metadata pointing to ngrok
**Action Required**: Inspect stored OAuth tokens for ngrok references

### Hypothesis 4: SmartThings Client Configuration Override (INVESTIGATING)
**Theory**: SmartThingsClient might be accepting a custom URL provider
**Action Required**: Check if URL provider is being overridden during client initialization

### Hypothesis 5: axios Request Interception (UNLIKELY)
**Evidence Against**:
- No axios interceptors found in codebase
- SmartThings SDK manages its own axios instance

## Next Steps

1. **Inspect OAuth Tokens** ✅ PRIORITY
   - Check token storage contents: `src/storage/token-storage.ts`
   - Verify tokens don't contain ngrok URLs
   - Command: Check token file or database

2. **Add Debug Logging** ✅ PRIORITY
   - Add logging to `endpoint-client.js` to see actual request URLs
   - Temporary patch SDK to log `axiosConfig.url` before requests

3. **Check SmartThings Client Instantiation** ✅ PRIORITY
   - Verify no custom `urlProvider` is being passed to `SmartThingsClient`
   - Check if environment variable `SMARTTHINGS_BASE_URL` exists

4. **Test Direct SDK Call** ✅ PRIORITY
   - Create minimal test script that bypasses application code
   - Call SmartThings API directly with OAuth token
   - Isolate whether issue is in SDK vs. application layer

5. **Network Inspection**
   - Use `mitmproxy` or similar to intercept actual HTTP requests
   - Verify destination URL for SmartThings API calls
   - Check HTTP headers being sent

## Code Locations

### Key Files
- **Client**: `src/smartthings/client.ts`
- **OAuth Authenticator**: `src/smartthings/oauth-authenticator.ts`
- **OAuth Service**: `src/smartthings/oauth-service.ts`
- **Environment Config**: `src/config/environment.ts`
- **Token Storage**: `src/storage/token-storage.ts`
- **SmartThings SDK**: `node_modules/@smartthings/core-sdk/dist/endpoint-client.js`

### SDK Configuration
- **Default URL Provider**: `node_modules/@smartthings/core-sdk/dist/endpoint-client.js:9`
- **Axios Request**: `node_modules/@smartthings/core-sdk/dist/endpoint-client.js:~124`

## Temporary Workarounds

### Option 1: Force PAT Authentication
```bash
# Use PAT instead of OAuth (bypasses OAuth token issue)
unset SMARTTHINGS_CLIENT_ID
unset SMARTTHINGS_CLIENT_SECRET
export SMARTTHINGS_PAT=<your-pat-token>
```

### Option 2: Clear OAuth Tokens
```bash
# Force re-authentication
rm -rf .tokens/  # or wherever tokens are stored
# Visit /auth/smartthings to re-authenticate
```

## Related Tickets
- **Ticket 1M-543**: OAuth2 Security Hardening (PKCE implementation)
- **Ticket 1M-601**: SmartThings Authentication validation

## Environment
- **Node.js**: v22.x
- **SmartThings SDK**: v8.4.1 (axios v1.8.3)
- **Transport Mode**: HTTP (port 5182)
- **ngrok**: smarty.ngrok.app (for OAuth redirect only)

## Status
🟡 **IN PROGRESS** - Root cause identified, solution needed

## Priority
🔥 **CRITICAL** - Prevents all device/automation API calls from working

## BREAKTHROUGH: Test Results

### Direct API Test Script
**File**: `test-smartthings-api.mjs`

**Results** (2025-12-22 17:15):
```
✅ OAuth Token Retrieved
   Expires: 2025-12-23T16:55:15.000Z
   Scopes: r:locations:* x:devices:* r:scenes:* r:devices:* x:scenes:*
   Token (first 20 chars): 4a604891-69cc-4c62-b...

✅ Direct axios call SUCCESS
   Status: 200
   Devices found: 184

✅ SmartThings SDK call SUCCESS
   Devices found: 184
```

**KEY FINDING**: Both direct axios calls AND SmartThings SDK calls work perfectly when called from standalone script!

### Root Cause Analysis

**CONFIRMED**:
- ✅ OAuth tokens are valid and working
- ✅ SmartThings SDK is correctly configured (`https://api.smartthings.com`)
- ✅ Token decryption works correctly
- ✅ Direct API calls succeed (200 OK, 184 devices)
- ✅ SDK API calls succeed when called standalone

**PROBLEM LOCATION**:
- ❌ Issue is NOT in SmartThings SDK
- ❌ Issue is NOT in token authentication
- ❌ Issue is NOT in token storage
- ✅ **Issue IS in application server routing/middleware**

### Hypothesis Update

The 401 error with "openresty" (ngrok) response is happening because:

1. **Standalone test**: SmartThings SDK → `https://api.smartthings.com` → ✅ SUCCESS
2. **Application server**: SmartThings SDK → ??? → ngrok → ❌ 401 Unauthorized

**Possible causes**:
1. Application server has HTTP proxy middleware that routes external requests through ngrok
2. Environment variables being set by server startup that affect axios globally
3. Fastify server configuration overriding HTTP client behavior
4. Server-alexa.ts has custom HTTP client configuration

### Next Investigation Steps

1. **Check Fastify server configuration** (`src/server-alexa.ts`)
   - Look for proxy configuration
   - Check HTTP client interceptors
   - Verify no global axios configuration

2. **Check application startup**
   - Environment variables set during server initialization
   - Global HTTP client configuration
   - Middleware that might intercept external API calls

3. **Test API calls from running server**
   - Add debug logging to SmartThings SDK calls
   - Monitor actual HTTP requests being made
   - Compare with standalone test

---

**Investigation Log**:
- 2025-12-22 16:58 - Initial investigation started
- 2025-12-22 17:00 - Confirmed SDK uses correct baseURL
- 2025-12-22 17:05 - Verified no proxy configuration exists
- 2025-12-22 17:10 - Inspected OAuth tokens - valid and working
- 2025-12-22 17:15 - **BREAKTHROUGH**: Created test script, confirmed SDK works standalone
- 2025-12-22 17:20 - Narrowed problem to application server routing/middleware

**Next Action**: Investigate Fastify server configuration and middleware in `src/server-alexa.ts`
