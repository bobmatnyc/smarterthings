# SmartThings MCP Deployment Options Analysis (Expired PAT Token)

**Research Date:** 2025-12-03
**Context:** Understanding deployment options when SmartThings PAT token is expired/invalid
**Status:** ✅ Complete

---

## Executive Summary

The SmartThings MCP project **cannot run without valid authentication** due to hard requirements in the configuration layer. However, **OAuth2 tokens are already stored** and can be used instead of PAT. The project has THREE authentication options:

1. ✅ **OAuth2 (RECOMMENDED)** - Already configured with stored tokens in database
2. ⚠️ **Personal Access Token (PAT)** - Currently expired, hard requirement in code
3. ❌ **Frontend-only mode** - Not supported (frontend requires backend API)

**Recommended Action:** Use OAuth2 flow, which has valid tokens stored in `/Users/masa/Projects/mcp-smartthings/data/tokens.db`

---

## Authentication Options Available

### Option 1: OAuth2 Flow (RECOMMENDED - Already Working)

**Status:** ✅ Fully implemented and tokens stored
**Location:** `data/tokens.db`
**Expires:** 2025-12-03 16:56:02 UTC (Unix: 1764797762)

**Current OAuth2 Configuration:**
```bash
# From .env.local
SMARTTHINGS_CLIENT_ID=5abef37e-ad42-4e50-b234-9df787d7df6b
SMARTTHINGS_CLIENT_SECRET=e0c305bc-b415-4bad-9c29-aadd4c2e351d
OAUTH_REDIRECT_URI=https://smarty.ngrok.app/auth/smartthings/callback
OAUTH_STATE_SECRET=45592298643ca2f341e69edb24cffd1b9f2e56868f696497e34a19c5dbcc473d
TOKEN_ENCRYPTION_KEY=16ee2f49242e66a299a8779436c7fa0fcb239d81c262c438bf95e781414ac60a
```

**Stored Token Details (from database):**
```sql
user_id: default
expires_at: 1764797762 (2025-12-03 16:56:02 UTC)
scope: x:devices:* r:devices:*
```

**Implementation Details:**
- **Service:** `SmartThingsOAuthService` (`src/smartthings/oauth-service.ts`)
- **Storage:** `TokenStorage` with AES-256-GCM encryption (`src/storage/token-storage.ts`)
- **Auto-refresh:** `TokenRefresher` service runs background token refresh
- **Routes:** `/auth/smartthings`, `/auth/smartthings/callback`, `/auth/smartthings/disconnect`, `/auth/smartthings/status`

**How It Works:**
1. User initiates OAuth flow via `/auth/smartthings`
2. Redirected to SmartThings authorization page
3. User authorizes, SmartThings redirects back with code
4. Server exchanges code for access + refresh tokens
5. Tokens encrypted and stored in SQLite database
6. Background service auto-refreshes tokens every 23 hours

**Security Features (Sprint 1.2):**
- ✅ PKCE (Proof Key for Code Exchange) implemented
- ✅ State parameter CSRF protection
- ✅ AES-256-GCM token encryption at rest
- ✅ Token revocation on disconnect
- ✅ Input validation (CVE-2024-OAUTH-003 fix)

**Documentation:**
- Setup guide: `docs/SMARTAPP_SETUP.md`
- Security fixes: `docs/security/OAUTH2-SECURITY-FIXES-1M-543.md`
- QA report: `docs/qa/OAUTH2-SECURITY-VERIFICATION-REPORT.md`

**How to Use OAuth Instead of PAT:**

The issue is that **PAT is still required** in `src/config/environment.ts`:

```typescript
// Line 51
SMARTTHINGS_PAT: z.string().min(1, 'SmartThings Personal Access Token is required'),
```

**Workaround Options:**

**A) Make PAT Optional (Code Change Required):**
```typescript
// Change required to optional in src/config/environment.ts
SMARTTHINGS_PAT: z.string().min(1).optional(),
```

**B) Use Expired PAT as Placeholder:**
```bash
# .env.local - keep expired PAT to satisfy validation
SMARTTHINGS_PAT=8866dd7a-d9e0-449d-86f4-d3c8ba2169fd
```
Then modify code to prefer OAuth tokens when available.

**C) Update SmartThingsService to Use OAuth (Architecture Change):**
Currently `SmartThingsService` hardcodes PAT usage:
```typescript
// src/smartthings/client.ts:60
this.client = new SmartThingsClient(
  new BearerTokenAuthenticator(environment.SMARTTHINGS_PAT)
);
```

Should be updated to:
```typescript
// Prefer OAuth tokens over PAT
const tokenStorage = new TokenStorage('./data/tokens.db');
const oauthToken = await tokenStorage.getTokens('default');

this.client = new SmartThingsClient(
  new BearerTokenAuthenticator(
    oauthToken?.accessToken ?? environment.SMARTTHINGS_PAT
  )
);
```

---

### Option 2: Personal Access Token (PAT)

**Status:** ⚠️ Currently expired, hard requirement in code
**Current PAT:** `8866dd7a-d9e0-449d-86f4-d3c8ba2169fd` (expired)

**Why PAT is Required:**
- Hard requirement in `src/config/environment.ts` line 51
- Used to initialize `SmartThingsClient` in `src/smartthings/client.ts` line 60
- Also used in `SmartThingsAdapter` in `src/platforms/smartthings/SmartThingsAdapter.ts`

**Files That Enforce PAT Requirement:**
```
src/config/environment.ts:51
src/cli/alexa-server.ts:16, 40, 50
src/cli/chat.ts:114, 182
src/smartthings/client.ts:60
src/platforms/smartthings/SmartThingsAdapter.ts:81 (config interface)
```

**How to Get New PAT:**
1. Visit https://account.smartthings.com/tokens
2. Create new Personal Access Token
3. Select scopes: `r:devices:*`, `x:devices:*`, `r:scenes:*`, `x:scenes:*`, `r:locations:*`
4. Copy token and update `.env.local`

**PAT Limitations (Why OAuth is Better):**
- ⚠️ **Expires every 24 hours** (SmartThings policy change Dec 2024)
- ⚠️ Requires manual renewal daily
- ⚠️ No automatic refresh mechanism
- ⚠️ Less secure than OAuth2 with PKCE

---

### Option 3: Frontend-Only Mode

**Status:** ❌ Not supported

**Why It Won't Work:**
The frontend (Svelte 5 + SvelteKit) **requires backend API** for all functionality:

```typescript
// web/vite.config.ts - Proxies all API calls to backend
server: {
  port: 5181,
  proxy: {
    '/api': {
      target: 'http://localhost:5182',  // Backend required
      changeOrigin: true,
    },
    '/auth': {
      target: 'http://localhost:5182',  // Backend required
      changeOrigin: true,
    }
  }
}
```

**Frontend Dependencies on Backend:**
- Device list: `GET /api/devices` (fetches from SmartThings API)
- Device control: `POST /api/devices/:id/commands` (executes SmartThings commands)
- Scenes: `GET /api/scenes`, `POST /api/scenes/:id/execute`
- Automations: `GET /api/automations`, `POST /api/automations/:id/execute`
- Rules: `GET /api/rules`, `POST /api/rules/:id/execute`
- OAuth: `/auth/smartthings/*` routes

**No Mock Mode Available:**
- No demo mode or mock data configuration
- No environment variable for mock mode
- All stores (devices, scenes, automations, rules) fetch from live API

**Frontend Can Run Independently But Will Fail:**
```bash
# Frontend starts but shows errors
pnpm dev:web  # Runs on port 5181

# Error: All API calls return 502 Bad Gateway (no backend)
```

---

## Deployment Scenarios

### Scenario A: Use Stored OAuth2 Tokens (QUICKEST)

**Prerequisites:** Valid OAuth2 tokens in database (✅ Already present)

**Steps:**
1. Check token expiry:
   ```bash
   sqlite3 data/tokens.db "SELECT datetime(expires_at, 'unixepoch') FROM oauth_tokens;"
   # Output: 2025-12-03 16:56:02
   ```

2. If expired, re-authorize via OAuth:
   ```bash
   # Start backend server
   pnpm dev

   # Visit in browser (triggers OAuth flow)
   open http://localhost:5182/auth/smartthings
   ```

3. **WORKAROUND for PAT requirement:**

   Keep expired PAT in `.env.local` to satisfy validation, then modify code to prefer OAuth:

   ```typescript
   // src/smartthings/client.ts - Add token preference logic
   import { TokenStorage } from '../storage/token-storage.js';

   async getAuthToken(): Promise<string> {
     // Try OAuth first
     const tokenStorage = new TokenStorage('./data/tokens.db');
     const oauthToken = await tokenStorage.getTokens('default');

     if (oauthToken && oauthToken.expiresAt > Date.now() / 1000) {
       return oauthToken.accessToken;
     }

     // Fallback to PAT
     return environment.SMARTTHINGS_PAT;
   }
   ```

**Advantages:**
- ✅ No manual daily token renewal
- ✅ Auto-refresh every 23 hours
- ✅ Secure (PKCE + encryption)
- ✅ Tokens already stored

**Disadvantages:**
- ⚠️ Requires code change to bypass PAT requirement
- ⚠️ Need to modify `SmartThingsService` constructor

---

### Scenario B: Get New PAT Token

**Prerequisites:** SmartThings account access

**Steps:**
1. Visit https://account.smartthings.com/tokens
2. Click "Generate new token"
3. Select scopes:
   - `r:devices:*` (read all devices)
   - `x:devices:*` (execute device commands)
   - `r:scenes:*` (read scenes)
   - `x:scenes:*` (execute scenes)
   - `r:locations:*` (read locations)
4. Copy token
5. Update `.env.local`:
   ```bash
   SMARTTHINGS_PAT=your_new_token_here
   ```
6. Start server:
   ```bash
   pnpm dev
   ```

**Advantages:**
- ✅ No code changes required
- ✅ Works immediately

**Disadvantages:**
- ⚠️ **Expires every 24 hours**
- ⚠️ Requires manual renewal daily
- ⚠️ Less secure than OAuth

---

### Scenario C: Make PAT Optional (Architecture Fix)

**Prerequisites:** Code modification skills

**Steps:**
1. Make PAT optional in environment config:
   ```typescript
   // src/config/environment.ts
   SMARTTHINGS_PAT: z.string().min(1).optional(),
   ```

2. Update SmartThingsService to prefer OAuth:
   ```typescript
   // src/smartthings/client.ts
   async initialize() {
     let authToken: string;

     // Try OAuth first
     const tokenStorage = new TokenStorage('./data/tokens.db');
     const oauthToken = await tokenStorage.getTokens('default');

     if (oauthToken && oauthToken.expiresAt > Date.now() / 1000) {
       authToken = oauthToken.accessToken;
       logger.info('Using OAuth2 token for authentication');
     } else if (environment.SMARTTHINGS_PAT) {
       authToken = environment.SMARTTHINGS_PAT;
       logger.info('Using PAT token for authentication');
     } else {
       throw new Error('No valid authentication found. Please configure OAuth or PAT.');
     }

     this.client = new SmartThingsClient(
       new BearerTokenAuthenticator(authToken)
     );
   }
   ```

3. Update SmartThingsAdapter similarly:
   ```typescript
   // src/platforms/smartthings/SmartThingsAdapter.ts
   export interface SmartThingsAdapterConfig {
     /** Personal Access Token for SmartThings API (optional if OAuth configured) */
     token?: string;
   }
   ```

4. Handle missing PAT in CLI tools:
   ```typescript
   // src/cli/alexa-server.ts
   if (!environment.SMARTTHINGS_PAT) {
     console.log(chalk.yellow('⚠️  PAT not configured, using OAuth tokens'));
   }
   ```

**Advantages:**
- ✅ Best long-term solution
- ✅ Seamless OAuth/PAT fallback
- ✅ No manual token renewal needed

**Disadvantages:**
- ⚠️ Requires code changes in 5+ files
- ⚠️ Needs testing to ensure backward compatibility

---

## Environment Variables Reference

### Required Variables (Current State)

```bash
# SmartThings Authentication (PAT - REQUIRED)
SMARTTHINGS_PAT=8866dd7a-d9e0-449d-86f4-d3c8ba2169fd

# OAuth Configuration (OPTIONAL but RECOMMENDED)
SMARTTHINGS_CLIENT_ID=5abef37e-ad42-4e50-b234-9df787d7df6b
SMARTTHINGS_CLIENT_SECRET=e0c305bc-b415-4bad-9c29-aadd4c2e351d
OAUTH_REDIRECT_URI=https://smarty.ngrok.app/auth/smartthings/callback
OAUTH_STATE_SECRET=45592298643ca2f341e69edb24cffd1b9f2e56868f696497e34a19c5dbcc473d
TOKEN_ENCRYPTION_KEY=16ee2f49242e66a299a8779436c7fa0fcb239d81c262c438bf95e781414ac60a
FRONTEND_URL=http://localhost:5181

# Server Configuration (LOCKED)
MCP_SERVER_PORT=5182
ALEXA_SERVER_PORT=5182
TRANSPORT_MODE=http

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
```

### Minimum Required (After Making PAT Optional)

```bash
# OAuth Configuration (REQUIRED after PAT made optional)
SMARTTHINGS_CLIENT_ID=5abef37e-ad42-4e50-b234-9df787d7df6b
SMARTTHINGS_CLIENT_SECRET=e0c305bc-b415-4bad-9c29-aadd4c2e351d
OAUTH_REDIRECT_URI=https://smarty.ngrok.app/auth/smartthings/callback
OAUTH_STATE_SECRET=45592298643ca2f341e69edb24cffd1b9f2e56868f696497e34a19c5dbcc473d
TOKEN_ENCRYPTION_KEY=16ee2f49242e66a299a8779436c7fa0fcb239d81c262c438bf95e781414ac60a

# Server Configuration (LOCKED)
MCP_SERVER_PORT=5182
TRANSPORT_MODE=http

# Optional
NODE_ENV=development
LOG_LEVEL=info
```

---

## Code Locations for Modification

### Files That Need Changes to Support OAuth-Only

1. **Environment Configuration (CRITICAL)**
   ```
   src/config/environment.ts:51
   Change: SMARTTHINGS_PAT from required to optional
   ```

2. **SmartThings Client (HIGH PRIORITY)**
   ```
   src/smartthings/client.ts:60
   Change: Add OAuth token preference logic
   ```

3. **SmartThings Adapter (HIGH PRIORITY)**
   ```
   src/platforms/smartthings/SmartThingsAdapter.ts:81
   Change: Make token optional in config interface
   ```

4. **CLI Tools (LOW PRIORITY - Can skip for web mode)**
   ```
   src/cli/alexa-server.ts:40, 50
   src/cli/chat.ts:182
   Change: Handle missing PAT gracefully
   ```

5. **Integration Tests (LOW PRIORITY)**
   ```
   src/services/__tests__/DiagnosticWorkflow.integration.test.ts:52
   Change: Skip if neither PAT nor OAuth available
   ```

---

## OAuth2 Implementation Status

### Implemented Features (Sprint 1.2)

✅ **Authorization Flow**
- `GET /auth/smartthings` - Initiate OAuth
- `GET /auth/smartthings/callback` - Handle callback
- PKCE implementation for security
- State parameter CSRF protection

✅ **Token Management**
- AES-256-GCM encryption at rest
- SQLite database storage (`data/tokens.db`)
- Automatic token refresh (23-hour cycle)
- Token revocation on disconnect

✅ **Security Hardening**
- Input validation (CVE-2024-OAUTH-003)
- Token revocation (CVE-2024-OAUTH-001)
- PKCE implementation
- State token validation
- Secure token storage

✅ **API Endpoints**
- `POST /auth/smartthings/disconnect` - Revoke tokens
- `GET /auth/smartthings/status` - Check connection

✅ **Background Services**
- `TokenRefresher` - Auto-refresh before expiry
- `TokenStorage` - Encrypted persistence

### Missing Integration

❌ **SmartThingsService OAuth Support**
- Still uses PAT token directly
- No fallback to OAuth tokens
- Constructor needs refactoring

❌ **SmartThingsAdapter OAuth Support**
- Config requires token parameter
- No OAuth token retrieval logic

❌ **Service Factory**
- No OAuth token injection
- Hard-coded PAT dependency

---

## Testing OAuth Token Validity

### Check Stored Token Expiry

```bash
# Query database
sqlite3 data/tokens.db "SELECT
  user_id,
  datetime(expires_at, 'unixepoch') AS expires_at_utc,
  CASE
    WHEN expires_at > strftime('%s', 'now') THEN 'VALID'
    ELSE 'EXPIRED'
  END AS status,
  scope
FROM oauth_tokens;"

# Expected output (example)
# user_id|expires_at_utc|status|scope
# default|2025-12-03 16:56:02|VALID|x:devices:* r:devices:*
```

### Test OAuth Status Endpoint

```bash
# Start server
pnpm dev

# Check OAuth status
curl http://localhost:5182/auth/smartthings/status

# Expected response (if valid)
{
  "success": true,
  "connected": true,
  "expiresAt": "2025-12-03T16:56:02.000Z",
  "scope": "x:devices:* r:devices:*",
  "needsRefresh": false
}
```

### Manually Trigger OAuth Flow

```bash
# Start server
pnpm dev

# Visit OAuth initiation (opens browser)
open http://localhost:5182/auth/smartthings

# After authorization, check database
sqlite3 data/tokens.db "SELECT * FROM oauth_tokens;"
```

---

## Recommendations

### Short-term (Quick Deployment)

**Priority: Get server running ASAP**

1. **Use Scenario B: Get New PAT**
   - Takes 5 minutes
   - No code changes
   - Works immediately
   - ⚠️ Downside: Expires in 24 hours

2. **Steps:**
   ```bash
   # Get new PAT from SmartThings
   open https://account.smartthings.com/tokens

   # Update .env.local
   echo "SMARTTHINGS_PAT=new_token_here" >> .env.local

   # Start server
   pnpm dev
   ```

### Medium-term (Sustainable Solution)

**Priority: Eliminate daily PAT renewal**

1. **Use Scenario C: Make PAT Optional**
   - Modify 3 key files (environment.ts, client.ts, SmartThingsAdapter.ts)
   - Enable OAuth-first authentication
   - Keep PAT as fallback
   - Leverage existing OAuth implementation

2. **Implementation Plan:**
   ```
   Phase 1: Configuration (1 hour)
   - Make PAT optional in environment.ts
   - Update validation logic

   Phase 2: Service Layer (2 hours)
   - Refactor SmartThingsService constructor
   - Add OAuth token preference logic
   - Add token refresh awareness

   Phase 3: Adapter Layer (1 hour)
   - Update SmartThingsAdapter config
   - Add OAuth token retrieval

   Phase 4: Testing (2 hours)
   - Test OAuth-only mode
   - Test PAT fallback mode
   - Test token refresh
   ```

### Long-term (Architecture Improvement)

**Priority: Clean architecture**

1. **Create Authentication Abstraction Layer**
   - Interface: `IAuthenticationProvider`
   - Implementations: `OAuthProvider`, `PATProvider`
   - Dependency injection via ServiceFactory

2. **Token Management Service**
   - Centralized token retrieval
   - Automatic refresh handling
   - Multi-user support

3. **Configuration Validation**
   - Validate either OAuth OR PAT configured
   - Better error messages
   - Auto-detection of auth method

---

## Files to Review/Modify

### Critical Path (For Scenario C)

```
src/config/environment.ts          # Make PAT optional
src/smartthings/client.ts          # Add OAuth preference
src/platforms/smartthings/SmartThingsAdapter.ts  # Update config interface
```

### Supporting Files

```
src/storage/token-storage.ts       # OAuth token retrieval (already implemented)
src/smartthings/oauth-service.ts   # OAuth service (already implemented)
src/smartthings/token-refresher.ts # Auto-refresh (already implemented)
src/routes/oauth.ts                # OAuth routes (already implemented)
```

### Documentation

```
docs/SMARTAPP_SETUP.md            # OAuth setup guide
docs/security/OAUTH2-SECURITY-FIXES-1M-543.md  # Security fixes
.env.example                       # Update to show OAuth as primary
```

---

## Conclusion

**The project CANNOT run without valid authentication**, but you have **TWO working options**:

1. **Quick Fix (5 minutes):** Get new PAT token from SmartThings
   - ✅ No code changes
   - ⚠️ Expires daily

2. **Sustainable Fix (6 hours):** Make PAT optional, use OAuth
   - ✅ No daily renewal
   - ✅ Leverages existing OAuth implementation
   - ✅ Stored tokens already valid
   - ⚠️ Requires code modifications

**Recommended:** Start with **Quick Fix** to unblock development, then implement **Sustainable Fix** to eliminate daily maintenance burden.

**OAuth tokens are already working and stored** - just need to integrate them into the SmartThingsService layer to replace PAT dependency.

---

## Next Steps

1. ✅ Review this document
2. Choose deployment scenario (A, B, or C)
3. If Scenario B: Get new PAT token (5 minutes)
4. If Scenario C: Follow implementation plan (6 hours)
5. Test server startup
6. Verify frontend connectivity
7. Check OAuth status endpoint
8. Monitor token refresh logs

---

**Research Completed:** 2025-12-03
**Stored OAuth Token Expiry:** 2025-12-03 16:56:02 UTC
**Recommendation:** Implement Scenario C for long-term sustainability
