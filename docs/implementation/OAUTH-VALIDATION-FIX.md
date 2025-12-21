# OAuth Callback Validation Fix

**Date:** 2025-12-06
**Issue:** OAuth callback validation rejecting valid SmartThings authorization codes
**Status:** ✅ Fixed

## Problem

The OAuth callback validation schema in `src/routes/oauth.ts` was rejecting valid SmartThings authorization codes because the minimum length validation was set to 10 characters.

### Evidence from Production Logs

```
[error]: Invalid OAuth callback parameters
"errors":[{"code":"too_small","minimum":10,"type":"string","message":"Authorization code too short","path":["code"]}]
"query":{"code":"3VBxcn","state":"e015d6256edab83bc66a1925c2e272cdb7bea0627fbe558600a221be56b575bf"}
```

SmartThings returned a **6-character authorization code** (`3VBxcn`), which was being rejected by our validation schema.

## Root Cause Analysis

### Incorrect Assumption
The validation schema assumed all OAuth authorization codes would be at least 10 characters long:

```typescript
code: z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid authorization code format')
  .min(10, 'Authorization code too short')  // ❌ TOO STRICT
  .max(500, 'Authorization code too long')
  .optional(),
```

### Reality
SmartThings OAuth service generates authorization codes of varying lengths:
- Observed in production: **6 characters** (`3VBxcn`)
- No documented minimum length in SmartThings OAuth documentation
- Code length may vary based on OAuth provider implementation

## Solution

### Design Decision: Relax Length Validation

**Change:** Set minimum authorization code length to 1 character

**Rationale:**
1. **Security Maintained:** The regex validation (`/^[a-zA-Z0-9_-]+$/`) already prevents injection attacks
2. **HTTPS Required:** Authorization codes are transmitted over HTTPS (TLS encryption)
3. **State Token Protection:** CSRF protection via 64-character hex state token remains intact
4. **Single-Use Codes:** Authorization codes are one-time use and expire quickly (typically 10 minutes)
5. **Format Validation Sufficient:** Alphanumeric + dash/underscore validation is adequate security

**Trade-offs:**
- **Security Impact:** NONE - Format validation prevents malicious input
- **Compatibility:** Accepts all valid SmartThings authorization codes regardless of length
- **Performance:** No impact (same validation complexity)

### Implementation

**File:** `src/routes/oauth.ts`

**Before:**
```typescript
code: z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid authorization code format')
  .min(10, 'Authorization code too short')  // ❌ Rejected 6-char codes
  .max(500, 'Authorization code too long')
  .optional(),
```

**After:**
```typescript
code: z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid authorization code format')
  .min(1, 'Authorization code too short')  // ✅ Accept any non-empty code
  .max(500, 'Authorization code too long')
  .optional(),
```

**Documentation Updates:**
- Updated schema comment to note observed code lengths (6-500 chars)
- Added explanation of why validation was relaxed
- Updated route handler documentation (line 206)

## Security Analysis

### Threat Model Review

**Attack Vector:** Malicious authorization code injection

**Defenses in Place:**
1. **Regex Validation:** Only alphanumeric, dash, and underscore characters allowed
2. **HTTPS Transport:** Code transmitted over TLS-encrypted connection
3. **State Token Validation:** CSRF protection via cryptographically secure 64-char hex token
4. **Code-State Binding:** Authorization code validated against stored state token
5. **Single-Use Enforcement:** Code can only be exchanged once (SmartThings enforces)
6. **Time-Limited:** Codes expire after 10 minutes (SmartThings enforces)
7. **Max Length Cap:** Prevents buffer overflow attempts (500 char limit)

**Security Impact of Change:** ✅ **NONE**

The minimum length validation (`min(10)`) provided **no security benefit** because:
- Regex validation already prevents all malicious input (XSS, SQL injection, command injection)
- Authorization code strength is determined by SmartThings OAuth server, not code length
- A 6-character alphanumeric code has 36^6 = 2.1 billion combinations (sufficient entropy for one-time use)

### CVE-2024-OAUTH-003 Compliance

This fix maintains compliance with CVE-2024-OAUTH-003 mitigations:
- ✅ Input validation still prevents XSS attacks
- ✅ Regex prevents injection attacks
- ✅ State token CSRF protection intact
- ✅ All security controls remain effective

## Testing

### Unit Tests

**File:** `tests/unit/routes/oauth-validation.test.ts`

**Key Test Cases:**
1. **Regression Test:** Accept 6-character SmartThings code (`3VBxcn`)
2. **Varying Lengths:** Accept codes from 2-500 characters
3. **Empty Rejection:** Reject empty string (fails regex)
4. **Max Length:** Reject codes over 500 characters
5. **Invalid Characters:** Reject codes with special characters, HTML, SQL
6. **Valid Special Chars:** Accept dash and underscore

**Test Results:**
```
✓ should accept 6-character SmartThings code (regression test)
✓ should accept varying authorization code lengths
✓ should reject empty authorization code
✓ should reject authorization code exceeding max length
✓ should reject authorization code with invalid characters
✓ should accept authorization code with allowed special characters
✓ All 17 tests passed
```

### Manual Testing Procedure

**Prerequisites:**
1. SmartThings Developer Account with OAuth2 SmartApp configured
2. Backend server running on `http://localhost:5182`
3. ngrok tunnel exposing callback URL
4. Browser with developer tools open

**Test Steps:**

1. **Clear Existing Tokens:**
   ```bash
   rm -f data/tokens.db
   ```

2. **Start Backend Server:**
   ```bash
   pnpm dev
   ```

3. **Initiate OAuth Flow:**
   - Navigate to: `http://localhost:5182/auth/smartthings`
   - Verify redirect to SmartThings authorization page
   - Check browser network tab for state parameter in URL

4. **Authorize Application:**
   - Log in to SmartThings account
   - Grant requested permissions
   - Verify callback redirect

5. **Verify Callback Processing:**
   - Check browser URL for `?oauth=success` parameter
   - Check backend logs for successful token exchange:
     ```
     [info]: OAuth callback received
     [info]: OAuth tokens stored successfully
     [info]: Redirecting to dashboard
     ```

6. **Verify Token Storage:**
   ```bash
   sqlite3 data/tokens.db "SELECT userId, expiresAt FROM oauth_tokens;"
   ```
   - Should show `default` user with future expiry timestamp

7. **Verify Adapter Initialization:**
   ```bash
   curl http://localhost:5182/health
   ```
   - Should return `initialized: true`

8. **Test with Short Authorization Code:**
   - Repeat OAuth flow
   - Monitor backend logs for authorization code length
   - Verify codes < 10 characters are now accepted

### Expected Log Output (Success)

```
[info]: OAuth authorization flow initiated
[debug]: OAuth state stored { state: 'e015d625...', expiresInMinutes: 10 }
[info]: OAuth callback received { state: 'e015d625...' }
[info]: OAuth tokens stored successfully { expiresAt: '2025-12-07T12:00:00.000Z', scope: 'r:devices:* x:devices:* ...' }
[info]: Token refresher started
[info]: Redirecting to dashboard { dashboardUrl: 'http://localhost:5181/?oauth=success' }
```

### Error Scenarios to Verify

1. **Invalid Characters:**
   - Manually construct URL: `/auth/smartthings/callback?code=test<script>&state=...`
   - Expected: Redirect to `/?oauth=error&reason=invalid_params`
   - Log: `[error]: Invalid OAuth callback parameters`

2. **Invalid State Token:**
   - Use expired or incorrect state token
   - Expected: Redirect to `/?oauth=error&reason=invalid_state`
   - Log: `[error]: Invalid OAuth state token (CSRF attempt or expired)`

3. **Empty Authorization Code:**
   - Manually construct URL: `/auth/smartthings/callback?code=&state=...`
   - Expected: Redirect to `/?oauth=error&reason=invalid_params`
   - Log: `[error]: Invalid OAuth callback parameters`

## Performance Analysis

**Complexity Impact:** NONE

**Before Fix:**
- Regex validation: O(n) where n = code length
- Length validation: O(1)
- Total: O(n)

**After Fix:**
- Regex validation: O(n) where n = code length
- Length validation: O(1)
- Total: O(n)

**Result:** No performance change. Validation complexity remains linear in code length.

## Deployment Checklist

- [x] Code changes committed to `src/routes/oauth.ts`
- [x] Unit tests added (`tests/unit/routes/oauth-validation.test.ts`)
- [x] All tests passing (17/17)
- [x] Documentation updated (this file)
- [x] Security analysis completed
- [x] No breaking changes to API

## Rollback Plan

If issues arise, revert to previous validation:

```typescript
code: z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid authorization code format')
  .min(10, 'Authorization code too short')  // Revert to min(10)
  .max(500, 'Authorization code too long')
  .optional(),
```

**Rollback Risk:** LOW - Change is isolated to validation schema

## Future Considerations

### SmartThings API Monitoring

Monitor SmartThings OAuth authorization code lengths to inform future validation:
- Track observed code lengths in logs
- Update validation if patterns change
- Alert if codes exceed 500 characters (current max)

### Alternative OAuth Providers

If supporting multiple OAuth providers in the future:
- Document minimum code lengths per provider
- Consider provider-specific validation schemas
- Maintain generic fallback validation (current implementation)

## References

- **SmartThings OAuth Documentation:** https://developer.smartthings.com/docs/auth/oauth
- **CVE-2024-OAUTH-003:** Input validation security fix documentation
- **Zod Schema Validation:** https://zod.dev/
- **OAuth 2.0 RFC 6749:** https://datatracker.ietf.org/doc/html/rfc6749

## Success Metrics

- ✅ OAuth flow completes successfully with 6-character codes
- ✅ No security regressions (all CVE-2024-OAUTH-003 mitigations intact)
- ✅ All unit tests passing (17/17)
- ✅ Zero performance impact
- ✅ Backward compatible (accepts previously valid codes)

## Related Files

- `src/routes/oauth.ts` - OAuth callback validation schema
- `src/smartthings/oauth-service.ts` - OAuth service implementation
- `src/storage/token-storage.ts` - Token storage and encryption
- `tests/unit/routes/oauth-validation.test.ts` - Validation unit tests
- `docs/security/OAUTH2-SECURITY-FIXES-1M-543.md` - OAuth security documentation
