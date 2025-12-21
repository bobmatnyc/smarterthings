# OAuth Validation Fix - QA Verification Guide

**Date:** 2025-12-06
**Fix:** OAuth callback validation now accepts SmartThings authorization codes of any valid length
**Implementation:** [docs/implementation/OAUTH-VALIDATION-FIX.md](../implementation/OAUTH-VALIDATION-FIX.md)

## Quick Verification (5 minutes)

### 1. Run Unit Tests

```bash
npx vitest run tests/unit/routes/oauth-validation.test.ts --reporter=verbose
```

**Expected Result:**
```
✓ All 17 tests passed
✓ Key test: "should accept 6-character SmartThings code (regression test)"
```

### 2. Verify OAuth Flow

```bash
# Clear existing tokens
rm -f data/tokens.db

# Start backend
pnpm dev
```

**In browser:**
1. Navigate to: `http://localhost:5182/auth/smartthings`
2. Log in to SmartThings
3. Grant permissions
4. Verify redirect to dashboard with `?oauth=success`

**Expected Backend Logs:**
```
[info]: OAuth authorization flow initiated
[debug]: OAuth state stored
[info]: OAuth callback received
[info]: OAuth tokens stored successfully
[info]: Redirecting to dashboard
```

### 3. Verify Health Status

```bash
curl http://localhost:5182/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "initialized": true,
  "timestamp": "2025-12-06T...",
  "version": "..."
}
```

## Full Test Procedure (15 minutes)

### Prerequisites

- [ ] Backend server running (`pnpm dev`)
- [ ] Frontend server running (`pnpm dev:web`)
- [ ] ngrok tunnel active (for OAuth callback)
- [ ] SmartThings Developer Account with OAuth2 SmartApp
- [ ] Browser developer tools open (Network tab)

### Test Case 1: Valid OAuth Flow with Short Code

**Objective:** Verify 6-character authorization codes are accepted

**Steps:**
1. Clear token database:
   ```bash
   rm -f data/tokens.db
   ```

2. Initiate OAuth flow:
   - Navigate to `http://localhost:5182/auth/smartthings`
   - Verify redirect to SmartThings

3. Authorize application:
   - Log in to SmartThings account
   - Grant all requested permissions
   - Click "Authorize"

4. Monitor callback:
   - Check browser URL for callback parameters
   - Note authorization code length in URL
   - Verify redirect to `?oauth=success`

5. Check backend logs:
   ```
   [info]: OAuth callback received
   [info]: OAuth tokens stored successfully
   ```

6. Verify token storage:
   ```bash
   sqlite3 data/tokens.db "SELECT userId, LENGTH(accessToken) as tokenLen FROM oauth_tokens;"
   ```

**Expected Result:**
- ✅ Authorization code accepted regardless of length (6+ chars)
- ✅ Tokens stored successfully
- ✅ Redirect to dashboard
- ✅ Health endpoint returns `initialized: true`

**Pass/Fail:** ___________

### Test Case 2: Invalid Authorization Code Format

**Objective:** Verify malicious codes are rejected

**Steps:**
1. Construct malicious callback URLs:
   ```bash
   # Test 1: XSS attempt
   curl -i "http://localhost:5182/auth/smartthings/callback?code=<script>alert(1)</script>&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

   # Test 2: SQL injection attempt
   curl -i "http://localhost:5182/auth/smartthings/callback?code=1'%20OR%20'1'='1&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

   # Test 3: Command injection attempt
   curl -i "http://localhost:5182/auth/smartthings/callback?code=$(whoami)&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
   ```

2. Check responses:
   - Should redirect to `/?oauth=error&reason=invalid_params`

3. Check backend logs:
   ```
   [error]: Invalid OAuth callback parameters
   ```

**Expected Result:**
- ✅ All malicious codes rejected
- ✅ No code execution or injection
- ✅ Error logged appropriately
- ✅ User redirected to error page

**Pass/Fail:** ___________

### Test Case 3: Empty Authorization Code

**Objective:** Verify empty codes are rejected

**Steps:**
1. Construct callback with empty code:
   ```bash
   curl -i "http://localhost:5182/auth/smartthings/callback?code=&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
   ```

2. Check response:
   - Should redirect to `/?oauth=error&reason=invalid_params`

3. Check backend logs:
   ```
   [error]: Invalid OAuth callback parameters
   errors: [{ message: "Invalid authorization code format" }]
   ```

**Expected Result:**
- ✅ Empty code rejected
- ✅ Validation error logged
- ✅ User redirected to error page

**Pass/Fail:** ___________

### Test Case 4: Authorization Code Exceeding Max Length

**Objective:** Verify codes over 500 characters are rejected

**Steps:**
1. Generate 501-character code:
   ```bash
   LONG_CODE=$(python3 -c "print('a'*501)")
   curl -i "http://localhost:5182/auth/smartthings/callback?code=$LONG_CODE&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
   ```

2. Check response and logs

**Expected Result:**
- ✅ Long code rejected
- ✅ Error: "Authorization code too long"
- ✅ User redirected to error page

**Pass/Fail:** ___________

### Test Case 5: Valid Authorization Code with Special Characters

**Objective:** Verify dash and underscore are accepted

**Steps:**
1. Test codes with allowed special characters:
   ```bash
   # Test with dash
   curl -i "http://localhost:5182/auth/smartthings/callback?code=abc-123&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

   # Test with underscore
   curl -i "http://localhost:5182/auth/smartthings/callback?code=abc_123&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

   # Test with both
   curl -i "http://localhost:5182/auth/smartthings/callback?code=ABC-xyz_789&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
   ```

**Note:** These will fail state validation (invalid state), but should pass code format validation.

**Expected Result:**
- ✅ Code format validation passes
- ❌ State validation fails (expected)
- ✅ Error: "Invalid state parameter" (NOT "Invalid authorization code format")

**Pass/Fail:** ___________

### Test Case 6: Invalid State Token

**Objective:** Verify CSRF protection still works

**Steps:**
1. Use invalid state token:
   ```bash
   curl -i "http://localhost:5182/auth/smartthings/callback?code=validcode&state=invalid_state_token"
   ```

2. Check response:
   - Should redirect to `/?oauth=error&reason=invalid_state`

3. Check backend logs:
   ```
   [error]: Invalid OAuth state token (CSRF attempt or expired)
   ```

**Expected Result:**
- ✅ Invalid state rejected
- ✅ CSRF protection active
- ✅ Error logged as potential CSRF attempt

**Pass/Fail:** ___________

## Security Validation

### CVE-2024-OAUTH-003 Compliance Check

Verify all mitigations remain effective:

- [ ] **Input Validation:** Regex prevents injection attacks
- [ ] **CSRF Protection:** State token validation active
- [ ] **XSS Prevention:** HTML/script tags rejected
- [ ] **SQL Injection Prevention:** Special chars outside [a-zA-Z0-9_-] rejected
- [ ] **Command Injection Prevention:** Shell metacharacters rejected
- [ ] **Max Length Enforcement:** Codes over 500 chars rejected
- [ ] **Empty String Rejection:** Empty codes rejected

### Attack Vector Testing

- [ ] **XSS:** `<script>` tags rejected
- [ ] **SQL Injection:** `' OR '1'='1` rejected
- [ ] **Command Injection:** `$(whoami)` rejected
- [ ] **Path Traversal:** `../../etc/passwd` rejected (if code used in file ops)
- [ ] **CSRF:** Invalid state tokens rejected

## Performance Validation

### Response Time Benchmarks

```bash
# Benchmark OAuth callback processing
time curl -i "http://localhost:5182/auth/smartthings/callback?code=validcode&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
```

**Expected:**
- Response time: < 100ms (validation only)
- No performance regression from previous implementation

**Actual:** _________ ms

## Regression Testing

### Verify No Breaking Changes

- [ ] Previous OAuth flows still work
- [ ] Long authorization codes (>100 chars) still accepted
- [ ] Token storage still works
- [ ] Token refresh still works
- [ ] Health endpoint still reports status
- [ ] Disconnect endpoint still works

## Sign-off

**QA Engineer:** ___________________
**Date:** ___________________
**Overall Status:** [ ] PASS [ ] FAIL [ ] BLOCKED

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Blocker Issues:**
_________________________________________________________________
_________________________________________________________________

**Follow-up Tickets:**
_________________________________________________________________
_________________________________________________________________

## Appendix: Test Data

### Valid State Tokens (64 hex chars)

```
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
e015d6256edab83bc66a1925c2e272cdb7bea0627fbe558600a221be56b575bf
1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### Valid Authorization Codes (varying lengths)

```
3VBxcn                          # 6 chars (observed in production)
abc123                          # 6 chars
ABC-xyz_789                     # 11 chars (with special chars)
a1b2c3d4e5f6g7h8i9j0            # 20 chars
```

### Invalid Authorization Codes

```
<script>alert(1)</script>       # HTML/XSS
1' OR '1'='1                    # SQL injection
$(whoami)                       # Command injection
../../etc/passwd                # Path traversal
code with spaces                # Whitespace
code;DROP TABLE users           # SQL command
```

## Reference Links

- [Implementation Documentation](../implementation/OAUTH-VALIDATION-FIX.md)
- [OAuth Security Fixes](../security/OAUTH2-SECURITY-FIXES-1M-543.md)
- [SmartThings OAuth Docs](https://developer.smartthings.com/docs/auth/oauth)
- [Unit Test Source](../../tests/unit/routes/oauth-validation.test.ts)
