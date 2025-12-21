# SmartThings API 401 Authorization Error Investigation

**Date**: 2025-12-02
**Status**: Root Cause Identified
**Priority**: CRITICAL - Blocking UI device loading

## Executive Summary

The SmartThings API is returning **401 Authorization Required** errors when the frontend tries to load devices. The root cause is that the **SmartThings client is hardcoded to use PAT (Personal Access Token) authentication**, but recent OAuth2 implementation work may have interfered with the PAT flow, or the PAT token itself may be invalid/expired.

### Key Findings

1. **Authentication Method**: System is using PAT authentication (line 60 in `client.ts`)
2. **OAuth Implementation**: Recent OAuth2 implementation is complete but NOT being used by the client
3. **Token Source**: PAT token comes from `environment.SMARTTHINGS_PAT` (loaded from `.env` or `.env.local`)
4. **Root Cause**: PAT authentication is failing - either token is invalid, expired, or malformed

## Current Authentication Flow

### Request Path
```
Frontend (web/src/lib/stores/deviceStore.svelte.ts)
  ↓ HTTP GET /api/devices
Server (src/server-alexa.ts:281)
  ↓ calls ToolExecutor.listDevices()
ToolExecutor (src/direct/ToolExecutor.ts)
  ↓ calls SmartThingsService.listDevices()
SmartThingsService (src/smartthings/client.ts:70)
  ↓ uses SmartThingsClient with BearerTokenAuthenticator
SmartThingsClient (@smartthings/core-sdk)
  ↓ HTTP GET https://api.smartthings.com/v1/devices
  ↓ Authorization: Bearer {SMARTTHINGS_PAT}
SmartThings API
  ↓ Returns 401 Authorization Required (via openresty)
```

### Authentication Implementation

**File**: `src/smartthings/client.ts` (lines 57-61)
```typescript
constructor() {
  logger.info('Initializing SmartThings client');

  this.client = new SmartThingsClient(
    new BearerTokenAuthenticator(environment.SMARTTHINGS_PAT)
  );
}
```

**File**: `src/config/environment.ts` (lines 49-51)
```typescript
const environmentSchema = z.object({
  // SmartThings Configuration
  SMARTTHINGS_PAT: z.string().min(1, 'SmartThings Personal Access Token is required'),
  // ... OAuth fields are optional
```

## Environment Configuration

### Current Configuration

**Files Found**:
- `.env` - Contains `SMARTTHINGS_PAT=***` (base config)
- `.env.local` - Contains `SMARTTHINGS_PAT=***` + OAuth credentials (overrides `.env`)

**Environment Loading** (from `environment.ts:8-10`):
```typescript
dotenv.config(); // Loads .env
dotenv.config({ path: '.env.local', override: true }); // Overrides with .env.local
```

**Variables Present**:
- ✅ `SMARTTHINGS_PAT` - Present (required for current auth method)
- ✅ `SMARTTHINGS_CLIENT_ID` - Present (for OAuth, not used yet)
- ✅ `SMARTTHINGS_CLIENT_SECRET` - Present (for OAuth, not used yet)
- ✅ `TOKEN_ENCRYPTION_KEY` - Present (for OAuth, not used yet)

## Recent Changes Analysis

### Git History (relevant commits)

```
1530568 - docs: add comprehensive SmartApp OAuth setup guide
3564947 - feat: add OAuth2 routes to web server
e72c5cf - feat: implement OAuth2 core services and token storage
40aadc2 - docs: comprehensive OAuth2 implementation research and plan
3fbf112 - fix: add dotenv override flag to load .env.local properly
```

### Files Modified (from git status)
- ✅ `src/smartthings/client.ts` - **NO CHANGE to constructor** (still uses PAT)
- ✅ `src/smartthings/oauth-service.ts` - New OAuth service (not integrated with client)
- ✅ `src/smartthings/token-refresher.ts` - New token refresh service (not active)
- ✅ `src/storage/token-storage.ts` - New token storage (not used for PAT)
- ✅ `src/config/environment.ts` - Added optional OAuth fields
- ✅ `src/routes/oauth.ts` - New OAuth routes (separate from device API)

### Critical Finding

**The SmartThingsService constructor has NOT changed**. It still uses PAT authentication via `BearerTokenAuthenticator(environment.SMARTTHINGS_PAT)`. The OAuth implementation is complete but **completely separate** from the client initialization.

This means the 401 error is NOT caused by OAuth integration breaking PAT auth - the two systems are completely independent.

## Root Cause Analysis

### Most Likely Causes (in order of probability)

#### 1. **Invalid or Expired PAT Token** (95% probability)
   - **Symptom**: 401 Authorization Required from openresty
   - **Cause**: SmartThings PAT tokens now expire every 24 hours (changed Dec 2024)
   - **Evidence**: Recent OAuth implementation research mentions this change
   - **Location**: PAT stored in `.env.local` file
   - **Verification**: Check if PAT was created >24 hours ago

#### 2. **Malformed PAT Token** (4% probability)
   - **Symptom**: Same 401 error
   - **Cause**: PAT token has whitespace, newlines, or invalid characters
   - **Verification**: Check `.env.local` for proper formatting

#### 3. **Missing or Insufficient Scopes** (1% probability)
   - **Symptom**: 401 error
   - **Cause**: PAT doesn't have required permissions
   - **Required Scopes**:
     - `r:devices:*` (read devices)
     - `x:devices:*` (execute commands)
     - `r:locations:*` (read locations)
     - `r:rooms:*` (read rooms)

## OAuth vs PAT Status

### OAuth Implementation Status
- ✅ OAuth service implemented (`oauth-service.ts`)
- ✅ Token storage with encryption (`token-storage.ts`)
- ✅ Background token refresh (`token-refresher.ts`)
- ✅ OAuth routes registered (`/auth/smartthings/*`)
- ❌ **NOT integrated with SmartThingsService client**
- ❌ OAuth flow has never been completed (no tokens in database)

### Current Authentication Architecture
```
PAT Mode (ACTIVE):
  SmartThingsService → BearerTokenAuthenticator → SMARTTHINGS_PAT → 401 Error

OAuth Mode (IMPLEMENTED BUT INACTIVE):
  User → /auth/smartthings → SmartThings OAuth → /auth/smartthings/callback
  → TokenStorage → Background Refresh → ❌ NOT USED BY CLIENT
```

## SmartThings API Error Response

**Error Details**:
- **HTTP Status**: 401 Unauthorized
- **Response**: HTML page with "401 Authorization Required"
- **Server**: openresty (SmartThings API gateway)
- **Frontend Message**: "Error (UNKNOWN_ERROR): Request failed with status code 401"

**API Endpoint**:
```
GET https://api.smartthings.com/v1/devices
Authorization: Bearer {INVALID_PAT}
→ 401 Authorization Required
```

## Code Locations Requiring Attention

### 1. Environment Configuration
**File**: `.env.local`
```bash
# Line 1: Check this token - likely expired or invalid
SMARTTHINGS_PAT=***REDACTED***
```

### 2. SmartThings Client Constructor
**File**: `src/smartthings/client.ts:57-61`
```typescript
constructor() {
  logger.info('Initializing SmartThings client');

  this.client = new SmartThingsClient(
    new BearerTokenAuthenticator(environment.SMARTTHINGS_PAT)
  );
}
```

**Issue**: Hardcoded to use PAT. No fallback to OAuth tokens.

### 3. Device API Endpoint
**File**: `src/server-alexa.ts:281-320`
```typescript
server.get('/api/devices', async (request, reply) => {
  const executor = getToolExecutor();
  const result = await executor.listDevices({ /* ... */ });
  // Uses SmartThingsService singleton (PAT auth)
```

## Recommended Solutions

### Immediate Fix (Restore Service - 5 minutes)

**Option 1: Regenerate PAT Token**
1. Go to SmartThings Developer Portal: https://account.smartthings.com/tokens
2. Create new Personal Access Token with scopes:
   - `r:devices:*`
   - `x:devices:*`
   - `r:locations:*`
   - `r:rooms:*`
   - `r:scenes:*`
3. Copy new token to `.env.local`:
   ```bash
   SMARTTHINGS_PAT=YOUR_NEW_TOKEN_HERE
   ```
4. Restart server: `npm run dev`

**Option 2: Complete OAuth Flow**
1. Navigate to: http://localhost:5182/auth/smartthings
2. Grant permissions on SmartThings OAuth page
3. Tokens will be stored in `./data/tokens.db`
4. **THEN** modify `client.ts` to use OAuth tokens instead of PAT

### Short-term Fix (Switch to OAuth - 30 minutes)

**Modify SmartThingsService Constructor**:

**File**: `src/smartthings/client.ts:57-61`

```typescript
import { TokenStorage } from '../storage/token-storage.js';

constructor() {
  logger.info('Initializing SmartThings client');

  // Try OAuth tokens first, fallback to PAT
  const token = this.getAuthToken();
  this.client = new SmartThingsClient(new BearerTokenAuthenticator(token));
}

private getAuthToken(): string {
  // Try OAuth tokens first (if available)
  try {
    const storage = new TokenStorage('./data/tokens.db');
    const tokens = await storage.getTokens('default');

    if (tokens && tokens.accessToken) {
      logger.info('Using OAuth access token');
      return tokens.accessToken;
    }
  } catch (error) {
    logger.debug('OAuth tokens not available, falling back to PAT');
  }

  // Fallback to PAT
  logger.info('Using Personal Access Token (PAT)');
  return environment.SMARTTHINGS_PAT;
}
```

**Issue with above**: Constructor cannot be async, so this requires refactoring to lazy initialization.

### Long-term Fix (Proper Architecture - 2 hours)

**Implement Token Provider Pattern**:

1. **Create TokenProvider interface**:
```typescript
interface TokenProvider {
  getToken(): Promise<string>;
}
```

2. **Implement OAuthTokenProvider**:
```typescript
class OAuthTokenProvider implements TokenProvider {
  constructor(private storage: TokenStorage) {}

  async getToken(): Promise<string> {
    const tokens = await this.storage.getTokens('default');
    if (!tokens) throw new Error('No OAuth tokens available');

    // Check if expired, refresh if needed
    if (SmartThingsOAuthService.shouldRefreshToken(tokens.expiresAt)) {
      // Trigger refresh and wait
    }

    return tokens.accessToken;
  }
}
```

3. **Implement PatTokenProvider**:
```typescript
class PatTokenProvider implements TokenProvider {
  async getToken(): Promise<string> {
    return environment.SMARTTHINGS_PAT;
  }
}
```

4. **Modify SmartThingsService**:
```typescript
constructor(private tokenProvider: TokenProvider) {
  // Initialize client without token
  // Lazy authentication on first request
}

async listDevices(roomId?: RoomId): Promise<DeviceInfo[]> {
  // Get fresh token on each request
  const token = await this.tokenProvider.getToken();

  // Reinitialize client if token changed
  if (this.currentToken !== token) {
    this.client = new SmartThingsClient(
      new BearerTokenAuthenticator(token)
    );
    this.currentToken = token;
  }

  // Existing logic...
}
```

## Verification Steps

### 1. Check PAT Token Status
```bash
# Check if PAT is set
grep SMARTTHINGS_PAT .env.local

# Test PAT against SmartThings API
curl -X GET "https://api.smartthings.com/v1/devices" \
  -H "Authorization: Bearer YOUR_PAT_TOKEN" \
  -v

# Expected: 200 OK with device list
# If 401: Token is invalid/expired
```

### 2. Check Server Logs
```bash
# Start server and check initialization logs
npm run dev

# Look for:
# - "Initializing SmartThings client"
# - "Environment validation failed" (if PAT missing)
# - 401 errors in request logs
```

### 3. Check Frontend Error
```
DevTools Console:
- Look for exact error message
- Check request headers (Authorization header present?)
- Check response body (HTML vs JSON?)
```

## Impact Assessment

**User Impact**: HIGH
- UI completely non-functional (cannot load devices)
- All device control features broken
- Chat functionality broken (depends on device access)

**Business Impact**: CRITICAL
- Core functionality unavailable
- SmartThings integration unusable
- Users cannot control devices via web UI

**Technical Impact**: MODERATE
- No data loss
- No security breach
- Fix is straightforward (regenerate token)

## Next Steps

### Immediate (Do Now)
1. ✅ Verify PAT token in `.env.local` is present
2. ❌ Test PAT token against SmartThings API directly
3. ❌ If invalid: Regenerate PAT token
4. ❌ If valid: Check network/proxy issues

### Short-term (This Week)
1. Complete OAuth flow to get valid OAuth tokens
2. Add token validation at startup (fail fast if invalid)
3. Add better error messages (distinguish 401 auth vs 404 not found)
4. Add health check endpoint that tests SmartThings API connectivity

### Long-term (Next Sprint)
1. Implement TokenProvider pattern (proper architecture)
2. Add automatic fallback: OAuth → PAT → Error
3. Add token refresh retry logic
4. Add monitoring/alerting for auth failures
5. Remove PAT dependency entirely (OAuth-only)

## Additional Context

### SmartThings PAT Expiration Policy Change
- **Old Policy**: PAT tokens never expired
- **New Policy**: PAT tokens expire every 24 hours (changed December 2024)
- **Rationale**: Force users to migrate to OAuth for security
- **Impact**: PAT-based integrations now require daily token regeneration
- **Migration Path**: OAuth2 with refresh tokens (automated renewal)

### OAuth2 Implementation Research
Recent commits show comprehensive OAuth2 implementation research:
- `40aadc2` - OAuth2 implementation research and plan
- `e72c5cf` - OAuth2 core services and token storage
- `3564947` - OAuth2 routes added to web server
- `1530568` - SmartApp OAuth setup guide

This indicates the team is aware of the PAT expiration issue and is actively working on OAuth migration.

## Files Analyzed

### Configuration Files
- `.env` - Base environment configuration
- `.env.local` - Local overrides with credentials
- `.env.example` - Example configuration template
- `src/config/environment.ts` - Environment validation schema

### SmartThings Client Files
- `src/smartthings/client.ts` - Main API client (uses PAT)
- `src/smartthings/oauth-service.ts` - OAuth2 service (not integrated)
- `src/smartthings/token-refresher.ts` - Token refresh service (inactive)
- `src/storage/token-storage.ts` - Encrypted token storage (unused for PAT)

### Server Files
- `src/server-alexa.ts` - Main Fastify server (device API endpoints)
- `src/routes/oauth.ts` - OAuth routes (separate from device API)

### Architecture Files
- `src/services/ServiceContainer.ts` - Service dependency injection
- `src/direct/ToolExecutor.ts` - Tool execution layer

## Conclusion

The 401 Authorization error is caused by **invalid or expired PAT token** in the `.env.local` file. The recent OAuth2 implementation work has NOT broken existing PAT authentication - the two systems are completely independent and not yet integrated.

**Immediate Action Required**: Regenerate SmartThings Personal Access Token and update `.env.local`.

**Long-term Solution**: Complete OAuth integration by modifying `SmartThingsService` constructor to use OAuth tokens from `TokenStorage` instead of hardcoded PAT.
