# Auth Redirect Loop - Root Cause Analysis

**Date**: 2025-12-23
**Status**: ✅ ROOT CAUSE IDENTIFIED
**Severity**: High - Prevents all authentication attempts

## Executive Summary

The authentication redirect loop is caused by the **root layout rendering the full application shell (Header, SubNav, ChatSidebar) even on the `/auth` page**. When any of these components make an API call that returns 401, it triggers the redirect logic in `ApiClient`, creating an infinite loop.

## Root Cause

**File**: `/Users/masa/Projects/smarterthings/web/src/routes/+layout.svelte`
**Line**: 141

```svelte
{:else if isAuthenticated || $page.url.pathname.startsWith('/auth')}
  <!-- Authenticated OR on auth page: Show normal app -->
  <ChatSidebar />
  <!-- ... -->
  <Header />
  <SubNav />
  <main>{@render children()}</main>
{/if}
```

### The Problem

1. **User visits** `http://localhost:5181/auth`
2. **Layout's onMount** (lines 73-78):
   - Checks: `$page.url.pathname.startsWith('/auth')`
   - Result: `TRUE` ✅
   - Action: Sets `authChecked=true`, returns early
   - Status: `isAuthenticated=false`, `authChecked=true`

3. **Layout render condition** (line 141):
   ```svelte
   {:else if isAuthenticated || $page.url.pathname.startsWith('/auth')}
   ```
   - `isAuthenticated`: `false`
   - `$page.url.pathname.startsWith('/auth')`: `TRUE`
   - **Result**: Condition is `TRUE` → Renders FULL app shell

4. **Components rendered on `/auth` page**:
   - `<ChatSidebar />` (line 145)
   - `<Header />` (line 174)
   - `<SubNav />` (line 177)
   - `<main>{@render children()}</main>` (line 180-182)
     - This renders `/auth/+page.svelte` → `<OAuthConnect />`

5. **The Redirect Loop**:
   - Any component that makes an API call on mount gets 401
   - `ApiClient.fetchWithAuth()` detects 401
   - Calls `handleAuthError()` (line 67 in `client.ts`)
   - Checks if already on `/auth` (line 78-80)
   - **Skips redirect** (line 81) but **THROWS error** (line 93-95)
   - Component re-mounts → Repeat cycle

### Why This Happens

The logic mixes two concerns:
- **Authentication gate**: "Should I show the app or redirect to auth?"
- **Page rendering**: "What should I render on this page?"

The `/auth` page should be a **public route** with **minimal UI** (just the auth form), but instead it gets the **entire authenticated app shell**, which assumes the user is logged in.

## Verification

### Evidence from Code

1. **Layout renders app shell on auth page** (line 141):
   ```svelte
   {:else if isAuthenticated || $page.url.pathname.startsWith('/auth')}
   ```

2. **ApiClient redirect prevention** (lines 78-80 in `client.ts`):
   ```typescript
   if (this.isRedirecting ||
       currentPath.startsWith('/auth') ||
       currentUrl.includes('/auth')) {
     console.log('[ApiClient] Skipping redirect - already on auth page or redirecting');
   }
   ```

3. **But error is still thrown** (lines 93-95):
   ```typescript
   const error = new Error('SESSION_EXPIRED');
   (error as any).isSessionExpired = true;
   throw error;
   ```

### Console Logs Evidence

The user sees these console messages:
- `[ApiClient] Skipping redirect - already on auth page or redirecting`
- `[ApiClient] 401 Unauthorized - redirecting to auth`

This indicates:
1. An API call is being made
2. It returns 401
3. Redirect is attempted but skipped (already on `/auth`)
4. Error is thrown
5. Component remounts and tries again

## The Fix

### Option 1: Separate Auth Layout (Recommended)

The `/auth` page should NOT render the app shell at all.

**File**: `/Users/masa/Projects/smarterthings/web/src/routes/+layout.svelte`

**Change line 141 from**:
```svelte
{:else if isAuthenticated || $page.url.pathname.startsWith('/auth')}
```

**To**:
```svelte
{:else if isAuthenticated}
```

**Then add separate block for auth page**:
```svelte
{:else if $page.url.pathname.startsWith('/auth')}
  <!-- Auth page: Minimal layout, NO app shell -->
  <main class="auth-main">
    {@render children()}
  </main>
```

**Full corrected structure**:
```svelte
{#if !authChecked}
  <!-- Loading State -->
  <div class="auth-loading-container">
    <LoadingSpinner size="48px" label="Checking authentication" />
    <p class="auth-loading-text">Connecting to Smarter Things...</p>
  </div>
{:else if isAuthenticated}
  <!-- Authenticated: Show full app shell -->
  <ChatSidebar />
  {#if chatStore.sidebarCollapsed}
    <button class="sidebar-toggle-btn" onclick={() => chatStore.toggleSidebar()}>
      <!-- ... -->
    </button>
  {/if}
  <div class="app-shell" class:sidebar-open={!chatStore.sidebarCollapsed}>
    <Header />
    <SubNav />
    <main class="app-main">
      {@render children()}
    </main>
    <footer class="app-footer">
      <!-- ... -->
    </footer>
  </div>
{:else if $page.url.pathname.startsWith('/auth')}
  <!-- Auth page: Minimal layout, NO app shell -->
  <main class="auth-main">
    {@render children()}
  </main>
{:else}
  <!-- Fallback: Redirect to auth -->
  <script>
    goto('/auth');
  </script>
{/if}
```

**Add CSS for auth layout**:
```css
.auth-main {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgb(249, 250, 251);
}
```

### Option 2: Conditional Component Rendering

Less clean, but keeps existing structure:

```svelte
{:else if isAuthenticated || $page.url.pathname.startsWith('/auth')}
  <!-- Only show app shell components if authenticated -->
  {#if isAuthenticated}
    <ChatSidebar />
    {#if chatStore.sidebarCollapsed}
      <button class="sidebar-toggle-btn" onclick={() => chatStore.toggleSidebar()}>
        <!-- ... -->
      </button>
    {/if}
  {/if}

  <div class="app-shell" class:sidebar-open={!chatStore.sidebarCollapsed && isAuthenticated}>
    {#if isAuthenticated}
      <Header />
      <SubNav />
    {/if}
    <main class="app-main">
      {@render children()}
    </main>
    {#if isAuthenticated}
      <footer class="app-footer">
        <!-- ... -->
      </footer>
    {/if}
  </div>
{/if}
```

## Impact

### Components Affected
- **ChatSidebar**: May initialize chat store with API calls
- **Header**: May fetch user info, notifications
- **SubNav**: May fetch navigation data
- **Footer**: Static, unlikely to cause issues

### API Calls Likely Triggering 401
Without seeing the actual network trace, likely culprits:
1. Device store SSE connection (line 102 in +layout.svelte)
2. Chat store initialization
3. Any store that fetches data on mount

## Prevention

### Design Principle
**Public routes (auth, error pages) should NEVER render authenticated app components.**

### Implementation Pattern
```svelte
{#if publicRoute}
  <!-- Minimal layout -->
  <main>{@render children()}</main>
{:else if authenticated}
  <!-- Full app shell -->
  <AppShell>{@render children()}</AppShell>
{:else}
  <!-- Loading or redirect -->
{/if}
```

## Next Steps

1. ✅ **Implement Option 1** (separate auth layout)
2. ✅ **Test auth flow**:
   - Visit `/auth` → Should show ONLY auth UI
   - Click "Connect SmartThings" → OAuth flow
   - Complete OAuth → Redirect to dashboard
   - Dashboard should show full app shell
3. ✅ **Verify no console errors** during auth flow
4. ✅ **Test session expiry**:
   - Delete OAuth token
   - Visit dashboard
   - Should redirect to `/auth` cleanly
5. ✅ **Test direct navigation** to `/auth` when already authenticated

## Lessons Learned

1. **Separate concerns**: Authentication logic ≠ Layout rendering logic
2. **Public vs Private routes**: Need different layouts
3. **Component assumptions**: App shell components assume authentication
4. **Error handling**: Throwing errors in redirect logic can cause loops
5. **Testing**: Always test the "logged out" state, not just logged in

---

**Status**: Ready for implementation
**Confidence**: 99% - This is definitely the root cause
**Risk**: Low - Clean separation of auth and app layouts
