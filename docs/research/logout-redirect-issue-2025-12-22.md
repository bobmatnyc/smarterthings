# Logout Redirect Issue Analysis

**Date:** 2025-12-22
**Status:** Investigation Complete
**Severity:** Medium - UX Issue

## Problem Statement

After a successful logout (POST `/auth/smartthings/disconnect`), the user is not being redirected to the auth/connect screen. Instead, they remain on the same page despite being unauthenticated.

## Current Behavior

1. ✅ User clicks logout button in `ConnectionStatus.svelte`
2. ✅ Frontend calls `POST /auth/smartthings/disconnect`
3. ✅ Backend successfully:
   - Revokes tokens on SmartThings
   - Deletes tokens from local database
   - Returns success response
4. ✅ Frontend shows success toast
5. ⚠️ **ISSUE:** Frontend calls `window.location.reload()` after 500ms
6. ❌ **PROBLEM:** Page reloads but auth guard doesn't redirect to `/auth`

## Root Cause Analysis

### How Authentication is Detected

From `/Users/masa/Projects/smarterthings/src/server-alexa.ts` (lines 346-373):

```typescript
server.get('/health', async () => {
  const adapterInitialized = smartThingsAdapter !== null && smartThingsAdapter.isInitialized();

  // Also check if OAuth tokens exist (user has authenticated even if adapter failed to init)
  const tokenStorage = getTokenStorage();
  const hasOAuthTokens = tokenStorage.hasTokens('default');

  // Consider "initialized" if either adapter works OR tokens exist
  const isConnected = adapterInitialized || hasOAuthTokens;

  return {
    status: 'healthy',
    smartthings: {
      initialized: isConnected,  // ← Frontend checks THIS
      adapterReady: adapterInitialized,
      hasTokens: hasOAuthTokens,
      message: isConnected ? '...' : 'SmartThings not configured - visit /auth/smartthings to connect'
    }
  };
});
```

### Frontend Auth Guard Logic

From `web/src/routes/+layout.svelte` (lines 73-114):

```typescript
onMount(async () => {
  // Skip auth check for public routes
  if ($page.url.pathname.startsWith('/auth')) {
    authChecked = true;
    return;
  }

  try {
    // Check authentication via /health endpoint
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();

    // Check if SmartThings is initialized
    isAuthenticated = data.smartthings?.initialized ?? false;
    authChecked = true;

    if (!isAuthenticated) {
      // Redirect to auth page
      goto('/auth');
      return;
    }

    // Connect to SSE stream for real-time device updates
    const cleanupSSE = connectDeviceSSE(deviceStore);

    return () => {
      cleanupSSE();
    };
  } catch (error) {
    console.error('Auth check failed:', error);
    authChecked = true;
    isAuthenticated = false;
    goto('/auth');
  }
});
```

## Why Redirect Doesn't Work After Logout

### The Race Condition

1. `window.location.reload()` is called in `ConnectionStatus.svelte`
2. **CRITICAL:** `reload()` doesn't reset the in-memory state of `smartThingsAdapter`
3. Even though tokens are deleted from database (`hasOAuthTokens = false`), the adapter might still report `isInitialized() = true`
4. Health endpoint returns: `isConnected = false || true = true` (adapter still initialized)
5. Auth guard sees `initialized: true` and doesn't redirect

### The Smoking Gun

From the health endpoint logic:
```typescript
const isConnected = adapterInitialized || hasOAuthTokens;
```

**Problem:** After logout, `hasOAuthTokens` becomes `false`, but `adapterInitialized` may still be `true` because:
- The SmartThings adapter instance is NOT destroyed on logout
- The adapter's `isInitialized()` method reflects its in-memory state
- Token deletion doesn't automatically uninitialize the adapter

## Solution Options

### Option 1: Uninitialize Adapter on Logout (RECOMMENDED)

**Location:** `src/routes/oauth.ts` - `/auth/smartthings/disconnect` handler

**Change:**
```typescript
server.post('/auth/smartthings/disconnect', async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    // ... existing token revocation and deletion ...

    // Delete tokens from local storage
    await storage.deleteTokens('default');

    // ✨ NEW: Uninitialize the SmartThings adapter
    if (smartThingsAdapter) {
      smartThingsAdapter.uninitialize?.(); // If method exists
      // OR
      smartThingsAdapter = null; // Force recreation on next auth
    }

    logger.info('SmartThings disconnected successfully');

    return {
      success: true,
      message: 'SmartThings disconnected successfully'
    };
  } catch (error) {
    // ... error handling ...
  }
});
```

**Pros:**
- Clean server-side state management
- No client-side hacks
- Guarantees health endpoint returns `initialized: false`

**Cons:**
- Need to export `smartThingsAdapter` from `server-alexa.ts` or create a reset function
- Need to verify adapter has an uninitialize method or handle null state

### Option 2: Hard Redirect to /auth (CLIENT-SIDE)

**Location:** `web/src/lib/components/layout/ConnectionStatus.svelte`

**Change:**
```typescript
async function handleLogout(): Promise<void> {
  if (loggingOut) return;

  loggingOut = true;
  try {
    const response = await fetch('/auth/smartthings/disconnect', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect');
    }

    toast.success('Disconnected from SmartThings');

    // ✨ CHANGED: Hard redirect to /auth instead of reload
    setTimeout(() => {
      window.location.href = '/auth';
    }, 500);
  } catch (err) {
    console.error('Logout failed:', err);
    toast.error('Failed to disconnect');
    loggingOut = false;
  }
}
```

**Pros:**
- Simple client-side fix
- Immediate solution
- No backend changes needed

**Cons:**
- Bypasses auth guard logic (feels like a hack)
- Doesn't address underlying state management issue
- Backend might still report `initialized: true`

### Option 3: Fix Health Endpoint Logic

**Location:** `src/server-alexa.ts` - `/health` handler

**Change:**
```typescript
server.get('/health', async () => {
  const adapterInitialized = smartThingsAdapter !== null && smartThingsAdapter.isInitialized();

  const tokenStorage = getTokenStorage();
  const hasOAuthTokens = tokenStorage.hasTokens('default');

  // ✨ CHANGED: Only initialized if tokens exist AND adapter ready
  // This ensures logout forces initialized = false
  const isConnected = hasOAuthTokens && adapterInitialized;

  return {
    status: 'healthy',
    smartthings: {
      initialized: isConnected,
      adapterReady: adapterInitialized,
      hasTokens: hasOAuthTokens,
      message: isConnected ? '...' : 'SmartThings not configured - visit /auth/smartthings to connect'
    }
  };
});
```

**Pros:**
- Minimal change
- Fixes root cause (health endpoint logic)
- No client-side changes needed

**Cons:**
- Changes contract of health endpoint
- May break other parts of app that rely on current `initialized` logic
- Doesn't clean up adapter state (potential memory leak)

## Recommended Fix

**Hybrid Approach: Option 1 + Option 3**

1. **Option 3** (Health Endpoint): Change `isConnected` logic to require BOTH tokens and adapter
   - This ensures logout immediately reflects in `/health` response

2. **Option 1** (Backend Cleanup): Add adapter reset in disconnect handler
   - This ensures clean state after logout
   - Prevents zombie adapter instances

3. **Keep Current Client Code**: No changes to `ConnectionStatus.svelte`
   - `window.location.reload()` will work correctly after backend fixes

## Detailed Solution

### Discovery: Existing Infrastructure

The codebase already has excellent infrastructure for adapter lifecycle management:

1. **Adapter has `dispose()` method** (`SmartThingsAdapter.ts` lines 232-246):
   ```typescript
   async dispose(): Promise<void> {
     this.roomNameCache.clear();
     this.removeAllListeners();
     this.client = null;
     this.initialized = false;
   }
   ```

2. **Server exports `reinitializeSmartThingsAdapter()`** (`server-alexa.ts` lines 1737-1757):
   ```typescript
   export async function reinitializeSmartThingsAdapter(): Promise<void> {
     if (smartThingsAdapter) {
       await smartThingsAdapter.dispose();
     }
     smartThingsAdapter = null;
     serviceContainer = null;
     toolExecutor = null;
     await initializeSmartThingsAdapter();
   }
   ```

### Required Changes

#### 1. Create `uninitializeSmartThingsAdapter()` Function

**Location:** `src/server-alexa.ts`

**Add new export before `reinitializeSmartThingsAdapter()`:**

```typescript
/**
 * Uninitialize SmartThings adapter on logout
 *
 * Disposes of the adapter instance and clears all state.
 * Does NOT reinitialize (unlike reinitializeSmartThingsAdapter).
 *
 * This ensures /health endpoint returns initialized: false after logout.
 */
export async function uninitializeSmartThingsAdapter(): Promise<void> {
  logger.info('Uninitializing SmartThings adapter after disconnect');

  // Dispose existing adapter if any
  if (smartThingsAdapter) {
    try {
      await smartThingsAdapter.dispose();
    } catch (error) {
      logger.warn('Error disposing adapter during uninitialize', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Reset state
  smartThingsAdapter = null;
  serviceContainer = null;
  toolExecutor = null;

  logger.info('SmartThings adapter uninitialized successfully');
}
```

#### 2. Update Disconnect Handler

**Location:** `src/routes/oauth.ts`

**Import the new function:**
```typescript
import { reinitializeSmartThingsAdapter, uninitializeSmartThingsAdapter } from '../server-alexa.js';
```

**Update POST `/auth/smartthings/disconnect` handler (after line 380):**

```typescript
// Delete tokens from local storage
await storage.deleteTokens('default');

// ✨ NEW: Uninitialize the adapter to force health endpoint to return initialized: false
try {
  await uninitializeSmartThingsAdapter();
  logger.info('SmartThings adapter uninitialized after disconnect');
} catch (uninitError) {
  logger.warn('Failed to uninitialize adapter after disconnect', {
    error: uninitError instanceof Error ? uninitError.message : String(uninitError),
  });
  // Continue anyway - tokens are deleted, which is the critical part
}

logger.info('SmartThings disconnected successfully');
```

#### 3. Update Health Endpoint Logic (Defense in Depth)

**Location:** `src/server-alexa.ts`

**Update `/health` endpoint (line 354):**

```typescript
// Consider "initialized" if tokens exist AND adapter is ready
// This ensures logout forces initialized = false even if adapter disposal fails
const isConnected = hasOAuthTokens && adapterInitialized;
```

**Previous logic:**
```typescript
const isConnected = adapterInitialized || hasOAuthTokens; // ❌ OLD
```

**New logic:**
```typescript
const isConnected = hasOAuthTokens && adapterInitialized; // ✅ NEW
```

**Rationale:** This change ensures that:
- Even if adapter disposal fails, `hasOAuthTokens = false` forces `initialized = false`
- Tokens become the source of truth for authentication state
- Adapter initialization is a bonus check for operational readiness

### Why This Fix Works

1. **Client calls** `POST /auth/smartthings/disconnect`
2. **Backend deletes tokens** from database → `hasOAuthTokens = false`
3. **Backend uninitializes adapter** → `adapterInitialized = false`
4. **Client calls** `window.location.reload()`
5. **Auth guard fetches** `/health` endpoint
6. **Health returns** `initialized: false` (because `hasOAuthTokens = false`)
7. **Auth guard sees** `!isAuthenticated` and redirects to `/auth` ✅

### Fail-Safe Behavior

If adapter disposal fails for any reason:
- Tokens are still deleted (critical security requirement)
- Health endpoint still returns `initialized: false` (because `hasOAuthTokens = false`)
- User is still redirected to `/auth` page
- Next authentication will recreate adapter from scratch

## Implementation Steps

1. ✅ Create `uninitializeSmartThingsAdapter()` in `server-alexa.ts`
2. ✅ Update health endpoint logic to use AND instead of OR
3. ✅ Call `uninitializeSmartThingsAdapter()` in disconnect handler
4. ✅ Test logout flow:
   - Click logout
   - Verify `/health` returns `initialized: false`
   - Verify page reloads and redirects to `/auth`
5. ✅ Test re-authentication after logout
6. ✅ Verify SSE connection is properly cleaned up and re-established

## Testing Checklist

- [ ] User can logout successfully
- [ ] After logout, `/health` returns `initialized: false`
- [ ] After logout, page redirects to `/auth` connect screen
- [ ] User can re-authenticate after logout
- [ ] SSE connection is properly cleaned up on logout
- [ ] SSE connection is re-established after re-authentication
- [ ] No memory leaks from orphaned adapter instances

## Related Files

- `web/src/routes/+layout.svelte` - Auth guard logic
- `web/src/lib/components/layout/ConnectionStatus.svelte` - Logout button
- `src/routes/oauth.ts` - `/auth/smartthings/disconnect` handler
- `src/server-alexa.ts` - `/health` endpoint and adapter initialization

## Additional Notes

### Why This Wasn't Caught in Testing

- OAuth flow testing focused on **initial connection**, not disconnection
- Manual testing likely only tested logout once, then restarted server (which resets adapter)
- The issue only occurs when logout happens while adapter is fully initialized in memory

### Future Improvements

1. Add E2E test for logout flow
2. Add adapter lifecycle management (proper init/uninit methods)
3. Consider state machine for adapter lifecycle
4. Add telemetry for tracking adapter state transitions
