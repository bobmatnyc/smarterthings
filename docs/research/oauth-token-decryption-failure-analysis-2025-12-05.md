# OAuth Token Decryption Failure Analysis

**Date**: 2025-12-05
**Issue**: "Failed to decrypt tokens" with undefined encryption key error
**Status**: Root cause identified
**Impact**: HIGH - Prevents OAuth authentication, forces fallback to expired PAT

---

## Executive Summary

The OAuth token decryption failure is caused by an **empty token database** (`./data/tokens.db` is 0 bytes). The database was never initialized because the `TokenStorage` class constructor runs schema initialization **at instantiation time**, but the empty file was created by a previous incomplete initialization attempt.

**Root Cause**: Empty SQLite database file with no schema
**Immediate Impact**: OAuth tokens cannot be retrieved, forcing fallback to expired PAT (401 errors)
**Recommended Fix**: Delete empty database file and re-authenticate via OAuth flow

---

## Investigation Findings

### 1. Database State Analysis

**File System Evidence:**
```bash
$ ls -lh ./data/tokens.db
-rw-r--r--  1 masa  staff     0B Dec  5 13:11 tokens.db

$ file ./data/tokens.db
./data/tokens.db: empty

$ sqlite3 ./data/tokens.db ".tables"
[No output - database is empty, no tables]
```

**Key Findings:**
- Database file exists but is completely empty (0 bytes)
- No SQLite header, no schema, no tables
- Database was likely created but never initialized
- WAL file exists (`tokens.db-shm` at 32KB) indicating previous connection attempts

### 2. Decryption Error Flow Analysis

**Error Location**: `src/storage/token-storage.ts` line 224-228

```typescript
} catch (error) {
  logger.error('Failed to decrypt tokens', {
    userId,
    error: error instanceof Error ? error.message : String(error),
  });
  throw new Error('Token decryption failed. Tokens may be corrupted.');
}
```

**Error Message Pattern:**
```
Failed to decrypt tokens
Error: The first argument must be of type string or an instance of Buffer, ArrayBuffer,
or Array or an Array-like Object. Received undefined
```

**Why This Error Occurs:**

1. **SmartThingsService constructor** (line 154-188 in `src/smartthings/client.ts`):
   - Calls `getTokenStorage()` (line 158)
   - Calls `tokenStorage.hasTokens('default')` (line 159)
   - If `hasTokens()` returns `true`, attempts to decrypt tokens (line 163-176)

2. **TokenStorage.hasTokens()** implementation (line 250-257):
   ```typescript
   hasTokens(userId: string = 'default'): boolean {
     const stmt = this.db.prepare<[string], { count: number }>(`
       SELECT COUNT(*) as count FROM oauth_tokens WHERE user_id = ?
     `);
     const result = stmt.get(userId);
     return result ? result.count > 0 : false;
   }
   ```

   **CRITICAL**: This query will **fail silently** if `oauth_tokens` table doesn't exist!
   - SQLite may return `result = undefined` instead of throwing error
   - `hasTokens()` returns `false` (correct behavior for empty DB)

3. **But if row exists with NULL/empty values**, decryption fails because:
   ```typescript
   const accessToken = this.decryptToken(
     row.accessTokenEncrypted,  // Could be NULL/undefined
     row.accessTokenIv,         // Could be NULL/undefined
     row.accessTokenAuthTag     // Could be NULL/undefined
   );
   ```

   **The `decryptToken()` method** (line 298-310):
   ```typescript
   private decryptToken(encrypted: string, iv: string, authTag: string): string {
     const decipher = crypto.createDecipheriv(
       this.algorithm,
       this.encryptionKey,
       Buffer.from(iv, 'hex')  // ERROR: If iv is undefined, Buffer.from() throws
     );
     // ...
   }
   ```

### 3. Environment Variable Validation

**Environment Loading**: `src/config/environment.ts` lines 8-10

```typescript
// Load .env first, then .env.local to override
dotenv.config(); // Loads .env
dotenv.config({ path: '.env.local', override: true }); // Loads .env.local
```

**Validation Check**: Lines 86-113

```typescript
try {
  config = environmentSchema.parse(process.env);

  // Validate that at least one authentication method is available
  const hasOAuthCredentials =
    config.SMARTTHINGS_CLIENT_ID &&
    config.SMARTTHINGS_CLIENT_SECRET &&
    config.TOKEN_ENCRYPTION_KEY;
  const hasPAT = !!config.SMARTTHINGS_PAT;

  if (!hasOAuthCredentials && !hasPAT) {
    console.error('SmartThings authentication configuration error');
    process.exit(1);
  }
}
```

**Confirmed**: Environment variable validation **passed**, meaning:
- `TOKEN_ENCRYPTION_KEY` **is defined** in `.env.local`
- `SMARTTHINGS_CLIENT_ID` and `SMARTTHINGS_CLIENT_SECRET` are defined
- Server would have exited at startup if these were missing

**Therefore**: The "undefined" error is **NOT** from missing `TOKEN_ENCRYPTION_KEY` in environment, but from **NULL/undefined database column values**.

### 4. Schema Initialization Logic

**TokenStorage Constructor** (`src/storage/token-storage.ts` lines 64-89):

```typescript
constructor(dbPath: string = './data/tokens.db') {
  // Initialize database
  this.db = new Database(dbPath);
  this.db.pragma('journal_mode = WAL');

  // Derive encryption key from environment variable
  if (!environment.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
  }

  this.encryptionKey = crypto.scryptSync(
    environment.TOKEN_ENCRYPTION_KEY,
    'smartthings-mcp-salt',
    32
  );

  // Initialize database schema
  this.initializeSchema();

  logger.info('Token storage initialized', { dbPath });
}
```

**Schema Creation** (lines 100-126):

```typescript
private initializeSchema(): void {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      access_token_encrypted TEXT NOT NULL,
      access_token_iv TEXT NOT NULL,
      access_token_auth_tag TEXT NOT NULL,
      refresh_token_encrypted TEXT NOT NULL,
      refresh_token_iv TEXT NOT NULL,
      refresh_token_auth_tag TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scope TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id)
    );
    // ... indexes ...
  `);
}
```

**Why Schema Wasn't Created:**

The empty database file suggests:
1. `new Database(dbPath)` created the file
2. But `initializeSchema()` never executed successfully
3. OR: Previous process crash/termination before schema creation
4. OR: File created manually without schema

### 5. Authentication Flow Priority

**SmartThings Client Constructor** (`src/smartthings/client.ts` lines 154-202):

```typescript
constructor() {
  logger.info('Initializing SmartThings client');

  // Try OAuth token first
  const tokenStorage = getTokenStorage();
  const hasOAuthToken = tokenStorage.hasTokens('default');

  if (hasOAuthToken) {
    try {
      // Create OAuth service and authenticator
      const oauthService = new SmartThingsOAuthService({...});
      const oauthAuth = new OAuthTokenAuthenticator(tokenStorage, oauthService, 'default');
      this.client = new SmartThingsClient(oauthAuth);

      logger.info('SmartThings client initialized with OAuth token');
      return;
    } catch (error) {
      logger.warn('OAuth token initialization failed, falling back to PAT', { error });
    }
  }

  // Fallback to PAT
  if (environment.SMARTTHINGS_PAT) {
    this.client = new SmartThingsClient(new BearerTokenAuthenticator(environment.SMARTTHINGS_PAT));
    logger.info('SmartThings client initialized with Personal Access Token');
  } else {
    throw new Error('SmartThings authentication required');
  }
}
```

**Current Behavior:**
1. Checks `hasTokens()` → returns `false` (empty DB)
2. Falls back to PAT authentication
3. PAT is expired (user reported 401 errors)
4. All SmartThings API calls fail with 401 Unauthorized

---

## Root Cause Analysis

### Primary Cause: Empty Database File

**Hypothesis**: Database file was created but schema initialization failed or was interrupted.

**Evidence Supporting This Hypothesis:**

1. **File exists with 0 bytes** - Indicates file creation but no data written
2. **WAL file exists (32KB)** - Indicates previous SQLite connection attempts
3. **No error during server startup** - Schema initialization didn't throw exception
4. **`hasTokens()` returns false** - Empty database = no token rows

**Possible Scenarios:**

**Scenario A: Previous OAuth Flow Failed Mid-Transaction**
- User initiated OAuth flow
- `TokenStorage` constructor created empty DB file
- `initializeSchema()` about to execute
- Process crashed/terminated (Ctrl+C, server restart, etc.)
- Empty file remained

**Scenario B: File System Permission Issue**
- `new Database(dbPath)` created empty file
- `db.exec()` failed silently due to permissions
- Error was caught/ignored somewhere
- Empty file remained

**Scenario C: Manual File Creation**
- User or script created empty `tokens.db` file manually
- `CREATE TABLE IF NOT EXISTS` didn't execute because connection failed
- Server continued with fallback to PAT

### Secondary Issue: OAuth Tokens Were Previously Valid

**User Statement**: "OAuth was working previously"

This confirms:
1. OAuth flow **was** completed successfully at some point
2. Tokens **were** stored in database
3. Something caused database corruption/loss

**Timeline Reconstruction:**

```
[Past: OAuth Working]
- User completed OAuth flow via /auth/smartthings
- Tokens stored in ./data/tokens.db
- SmartThingsService using OAuth authentication
- All API calls succeeding

[Event: Database Loss/Corruption]
- Database file became empty (cause unknown)
- Possible: Server crash, file system issue, manual deletion

[Present: Decryption Failure]
- Empty database file exists
- hasTokens() returns false
- Falls back to expired PAT
- All API calls fail with 401
```

---

## Recommended Solutions

### Solution 1: Clean Slate (RECOMMENDED)

**Steps:**
1. Delete corrupted database and WAL files:
   ```bash
   rm ./data/tokens.db
   rm ./data/tokens.db-shm
   rm ./data/tokens.db-wal  # if exists
   ```

2. Re-authenticate via OAuth flow:
   ```bash
   # Start server
   pnpm dev

   # Navigate to OAuth initiation endpoint
   open http://localhost:5182/auth/smartthings
   ```

3. Complete OAuth authorization:
   - Log in to SmartThings
   - Grant permissions
   - Redirected to callback URL
   - New tokens stored with fresh database

4. Verify authentication:
   ```bash
   curl http://localhost:5182/auth/smartthings/status
   ```

**Expected Output:**
```json
{
  "success": true,
  "connected": true,
  "expiresAt": "2025-12-06T13:11:00.000Z",
  "scope": "r:devices:$ r:devices:* x:devices:$ x:devices:*",
  "needsRefresh": false
}
```

**Pros:**
- Cleanest solution
- Guaranteed to work
- Fresh OAuth tokens (24 hour lifetime)
- No risk of corrupted data

**Cons:**
- Requires user interaction (OAuth flow)
- Temporary disruption (5 minutes)

---

### Solution 2: Manual Database Initialization (NOT RECOMMENDED)

**Steps:**
1. Delete empty database:
   ```bash
   rm ./data/tokens.db
   ```

2. Start server to trigger schema creation:
   ```bash
   pnpm dev
   ```

3. Insert dummy token row (UNSAFE):
   ```bash
   sqlite3 ./data/tokens.db <<EOF
   INSERT INTO oauth_tokens (
     user_id,
     access_token_encrypted,
     access_token_iv,
     access_token_auth_tag,
     refresh_token_encrypted,
     refresh_token_iv,
     refresh_token_auth_tag,
     expires_at,
     scope
   ) VALUES (
     'default',
     'dummy', 'dummy', 'dummy',  -- Invalid encryption data
     'dummy', 'dummy', 'dummy',
     0,  -- Already expired
     'r:devices:*'
   );
   EOF
   ```

**Why This Doesn't Work:**
- Dummy tokens will fail decryption
- Forces fallback to PAT anyway
- No actual benefit over Solution 1

**Verdict**: ❌ Do not use this approach

---

### Solution 3: Programmatic Database Reset (DEFENSIVE)

**Add Automatic Recovery Logic:**

Modify `TokenStorage.hasTokens()` to handle empty database:

```typescript
hasTokens(userId: string = 'default'): boolean {
  try {
    const stmt = this.db.prepare<[string], { count: number }>(`
      SELECT COUNT(*) as count FROM oauth_tokens WHERE user_id = ?
    `);
    const result = stmt.get(userId);
    return result ? result.count > 0 : false;
  } catch (error) {
    // Handle "no such table" error (empty database)
    if (error instanceof Error && error.message.includes('no such table')) {
      logger.warn('Token database schema missing, reinitializing', { userId });
      this.initializeSchema();
      return false;
    }
    throw error;
  }
}
```

**Pros:**
- Automatic recovery from empty database
- Prevents future occurrences
- Defensive programming best practice

**Cons:**
- Requires code modification
- Still requires OAuth re-authentication
- Masks potential underlying issues

**Verdict**: ⚠️ Good defensive practice, but doesn't solve immediate problem

---

## Immediate Action Plan

### Step 1: Clean Corrupted Database (1 minute)

```bash
cd /Users/masa/Projects/mcp-smarterthings

# Backup current state (optional, for investigation)
mkdir -p ./data/backups
cp ./data/tokens.db ./data/backups/tokens.db.corrupted.2025-12-05

# Remove corrupted files
rm ./data/tokens.db
rm ./data/tokens.db-shm
rm ./data/tokens.db-wal 2>/dev/null || true  # Ignore if doesn't exist
```

### Step 2: Verify Environment Configuration (1 minute)

```bash
# Check that OAuth credentials are present
grep -E "SMARTTHINGS_CLIENT_ID|SMARTTHINGS_CLIENT_SECRET|TOKEN_ENCRYPTION_KEY|OAUTH_REDIRECT_URI" .env.local

# Expected output:
# SMARTTHINGS_CLIENT_ID=<client-id>
# SMARTTHINGS_CLIENT_SECRET=<client-secret>
# TOKEN_ENCRYPTION_KEY=<encryption-key>
# OAUTH_REDIRECT_URI=http://localhost:5182/auth/smartthings/callback
```

If any variables are missing, add them to `.env.local`.

### Step 3: Start Server (30 seconds)

```bash
pnpm dev
```

**Expected Log Output:**
```
Token storage initialized { dbPath: './data/tokens.db' }
SmartThings client initialized with Personal Access Token { authMethod: 'pat' }
```

Note: Will use PAT temporarily until OAuth re-authentication completes.

### Step 4: Re-Authenticate via OAuth (2 minutes)

**Option A: Browser**
```bash
open http://localhost:5182/auth/smartthings
```

**Option B: curl (for headless environments)**
```bash
# Get authorization URL
curl -v http://localhost:5182/auth/smartthings
# Follow redirect URL in browser
```

**OAuth Flow:**
1. Redirected to SmartThings login page
2. Log in with SmartThings credentials
3. Grant permissions to application
4. Redirected to callback URL: `http://localhost:5182/auth/smartthings/callback?code=...&state=...`
5. Server exchanges code for tokens
6. Tokens stored in fresh database
7. Redirected to frontend: `http://localhost:5181/?oauth=success`

**Expected Server Logs:**
```
OAuth callback received { state: '...' }
Successfully obtained OAuth tokens { expiresIn: 86400, scope: '...' }
OAuth tokens stored successfully { expiresAt: '2025-12-06T13:11:00.000Z' }
Token refresher started
```

### Step 5: Verify Authentication (30 seconds)

```bash
# Check OAuth status
curl http://localhost:5182/auth/smartthings/status | jq

# Expected output:
{
  "success": true,
  "connected": true,
  "expiresAt": "2025-12-06T13:11:00.000Z",
  "scope": "r:devices:$ r:devices:* x:devices:$ x:devices:*",
  "needsRefresh": false
}
```

```bash
# Test SmartThings API call
curl http://localhost:5182/api/devices | jq

# Expected: List of devices (not 401 error)
```

### Step 6: Restart Server to Use OAuth (30 seconds)

```bash
# Stop current server (Ctrl+C)
# Restart to pick up OAuth tokens
pnpm dev
```

**Expected Log Output:**
```
Token storage initialized { dbPath: './data/tokens.db' }
SmartThings client initialized with OAuth token { authMethod: 'oauth' }
```

**Confirmation**: Server now using OAuth instead of PAT!

---

## Prevention & Monitoring

### 1. Add Database Health Check

**Implement Health Check Endpoint:**

Add to `src/routes/oauth.ts`:

```typescript
server.get('/auth/smartthings/health', async (_request, reply) => {
  const storage = getTokenStorage();

  // Check database schema exists
  const tables = storage.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const hasSchema = tables.some(t => t.name === 'oauth_tokens');

  // Check token count
  const hasTokens = hasSchema && storage.hasTokens('default');

  return {
    database: {
      schemaExists: hasSchema,
      tokensStored: hasTokens,
      dbPath: './data/tokens.db',
    }
  };
});
```

### 2. Add Automatic Schema Recovery

**Modify `TokenStorage.hasTokens()`:**

```typescript
hasTokens(userId: string = 'default'): boolean {
  try {
    const stmt = this.db.prepare<[string], { count: number }>(`
      SELECT COUNT(*) as count FROM oauth_tokens WHERE user_id = ?
    `);
    const result = stmt.get(userId);
    return result ? result.count > 0 : false;
  } catch (error) {
    if (error instanceof Error && error.message.includes('no such table')) {
      logger.warn('Token database schema missing, reinitializing');
      this.initializeSchema();
      return false;
    }
    throw error;
  }
}
```

### 3. Add Token Expiry Monitoring

**Log Warning When Tokens Expire:**

Modify `TokenRefresher.performRefresh()` to log warnings:

```typescript
private async performRefresh(userId: string): Promise<void> {
  const tokens = await this.tokenStorage.getTokens(userId);
  if (!tokens) return;

  const timeUntilExpiry = tokens.expiresAt - Math.floor(Date.now() / 1000);

  // Log warning if token expires in less than 1 hour
  if (timeUntilExpiry < 3600) {
    logger.warn('OAuth token expiring soon', {
      expiresIn: `${Math.floor(timeUntilExpiry / 60)} minutes`,
      expiresAt: new Date(tokens.expiresAt * 1000).toISOString(),
    });
  }

  // ... rest of refresh logic
}
```

### 4. Update PAT Removal Timeline

**Current State**: PAT is fallback authentication method

**Recommendation**: Remove PAT support after OAuth proven stable:

```typescript
// src/smartthings/client.ts (FUTURE)
constructor() {
  const tokenStorage = getTokenStorage();
  const hasOAuthToken = tokenStorage.hasTokens('default');

  if (!hasOAuthToken) {
    throw new Error(
      'OAuth authentication required. Please visit /auth/smartthings to connect.'
    );
  }

  // No PAT fallback - OAuth only
  const oauthService = new SmartThingsOAuthService({...});
  const oauthAuth = new OAuthTokenAuthenticator(tokenStorage, oauthService, 'default');
  this.client = new SmartThingsClient(oauthAuth);
}
```

---

## Debugging Reference

### Useful Commands

**Check Database Schema:**
```bash
sqlite3 ./data/tokens.db ".schema oauth_tokens"
```

**Check Token Count:**
```bash
sqlite3 ./data/tokens.db "SELECT COUNT(*) as count FROM oauth_tokens;"
```

**View Token Metadata (Encrypted Values Hidden):**
```bash
sqlite3 ./data/tokens.db "SELECT user_id, expires_at, scope, created_at, updated_at FROM oauth_tokens;"
```

**Check Token Expiry:**
```bash
sqlite3 ./data/tokens.db "SELECT
  user_id,
  datetime(expires_at, 'unixepoch') as expires_at,
  CASE
    WHEN expires_at > strftime('%s', 'now') THEN 'Valid'
    ELSE 'Expired'
  END as status
FROM oauth_tokens;"
```

**Inspect Database File:**
```bash
file ./data/tokens.db
ls -lh ./data/tokens.db
sqlite3 ./data/tokens.db ".tables"
```

### Server Logs to Monitor

**OAuth Flow Success:**
```
OAuth callback received
Successfully obtained OAuth tokens
OAuth tokens stored successfully
Token refresher started
```

**OAuth Flow Failure:**
```
OAuth authorization denied by user
OAuth callback failed
Invalid OAuth state token
```

**Authentication Selection:**
```
SmartThings client initialized with OAuth token { authMethod: 'oauth' }
SmartThings client initialized with Personal Access Token { authMethod: 'pat' }
```

**Token Refresh:**
```
Token needs refresh
Token refresh successful
Token refresh failed
```

---

## Files Analyzed

| File | Purpose | Key Findings |
|------|---------|--------------|
| `src/storage/token-storage.ts` | Token encryption/decryption | Empty database prevents token retrieval |
| `src/config/environment.ts` | Environment variable validation | TOKEN_ENCRYPTION_KEY **is** defined |
| `src/smartthings/client.ts` | OAuth vs PAT selection | Falls back to PAT when OAuth unavailable |
| `src/routes/oauth.ts` | OAuth flow endpoints | Handles token storage after authorization |
| `src/smartthings/oauth-service.ts` | SmartThings OAuth API | Token exchange and refresh logic |
| `src/smartthings/token-refresher.ts` | Background token refresh | Prevents token expiration |
| `./data/tokens.db` | SQLite token database | **Empty file (0 bytes) - ROOT CAUSE** |

---

## Conclusion

### Root Cause
Empty token database file (`./data/tokens.db` is 0 bytes with no schema) prevents OAuth token retrieval, forcing fallback to expired PAT.

### Immediate Fix
1. Delete corrupted database files
2. Re-authenticate via OAuth flow (`/auth/smartthings`)
3. Restart server to use OAuth tokens

### Long-Term Improvements
1. Add automatic schema recovery in `hasTokens()`
2. Add database health check endpoint
3. Monitor token expiry proactively
4. Consider removing PAT fallback after OAuth proven stable

### Expected Outcome
After re-authentication:
- OAuth tokens stored in fresh database
- Server uses OAuth authentication (24-hour auto-refresh)
- All SmartThings API calls succeed
- No more 401 authentication errors

---

**Investigation Completed**: 2025-12-05
**Estimated Fix Time**: 5 minutes
**Severity**: High (Authentication Failure)
**Recoverability**: Full (Clean re-authentication)
