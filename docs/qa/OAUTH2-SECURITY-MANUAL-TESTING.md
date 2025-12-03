# OAuth2 Security Fixes - Manual Testing Guide

**Ticket:** 1M-543 - OAuth2 Flow Testing
**Date:** 2025-12-03
**Priority:** SECURITY CRITICAL
**Estimated Time:** 2 hours

---

## Prerequisites

Before starting manual testing:

- [ ] Backend server running on port 5182
- [ ] Frontend server running on port 5181
- [ ] SmartThings OAuth2 credentials configured in `.env.local`:
  - `SMARTTHINGS_CLIENT_ID`
  - `SMARTTHINGS_CLIENT_SECRET`
  - `OAUTH_REDIRECT_URI`
  - `OAUTH_STATE_SECRET`
  - `TOKEN_ENCRYPTION_KEY`
- [ ] SQLite database accessible: `./data/tokens.db`
- [ ] Log files accessible: `./logs/combined.log`
- [ ] Browser with developer tools (Chrome/Firefox recommended)
- [ ] Command-line access for database queries

---

## Test Suite Overview

1. **CVE-2024-OAUTH-001:** Token Revocation (30 minutes)
2. **CVE-2024-OAUTH-002:** Concurrent Refresh Protection (30 minutes)
3. **CVE-2024-OAUTH-003:** Input Validation (45 minutes)
4. **Regression Testing:** End-to-End OAuth Flow (15 minutes)

**Total Time:** ~2 hours

---

## Test 1: Token Revocation (CVE-2024-OAUTH-001)

### Objective
Verify that tokens are revoked on SmartThings API when user disconnects.

### Test 1.1: Successful Token Revocation

**Steps:**

1. **Connect SmartThings Account**
   ```bash
   # Open browser
   open http://localhost:5181

   # Click "Connect SmartThings" button
   # Authorize application on SmartThings
   # Wait for redirect to dashboard with "oauth=success"
   ```

2. **Verify Tokens Stored**
   ```bash
   # Check database for encrypted tokens
   sqlite3 ./data/tokens.db "SELECT user_id, created_at, expires_at, scope FROM oauth_tokens;"

   # Expected output: One row with user_id='default'
   ```

3. **Monitor Logs During Disconnect**
   ```bash
   # Open log tail in separate terminal
   tail -f ./logs/combined.log | grep -E "(disconnect|revok)"
   ```

4. **Disconnect SmartThings**
   ```bash
   # Use curl or Postman
   curl -X POST http://localhost:5182/auth/smartthings/disconnect

   # Or click "Disconnect" button in UI
   ```

5. **Verify Logs Show Revocation**
   ```bash
   # Check for revocation logs (should appear in tail)
   grep "Revoking OAuth token" ./logs/combined.log | tail -5
   grep "Token revoked successfully" ./logs/combined.log | tail -5
   ```

**Expected Results:**
- ✅ Logs show: `"Revoking OAuth token", { tokenTypeHint: 'access_token' }`
- ✅ Logs show: `"Revoking OAuth token", { tokenTypeHint: 'refresh_token' }`
- ✅ Logs show: `"Token revoked successfully"` (twice, once for each token)
- ✅ Logs show: `"SmartThings disconnected successfully"`
- ✅ HTTP response: `{ "success": true, "message": "SmartThings disconnected successfully" }`

6. **Verify Tokens Deleted Locally**
   ```bash
   sqlite3 ./data/tokens.db "SELECT COUNT(*) FROM oauth_tokens;"

   # Expected output: 0
   ```

7. **Verify Revoked Token Fails on SmartThings**
   ```bash
   # Extract access token before disconnect (from step 2)
   # Note: You'll need to capture this during step 2

   # Try to use old access token
   curl -H "Authorization: Bearer OLD_ACCESS_TOKEN" \
        https://api.smartthings.com/v1/devices

   # Expected: 401 Unauthorized or 403 Forbidden
   ```

**Pass Criteria:**
- [x] Both access and refresh tokens revoked on SmartThings
- [x] Revocation logged successfully
- [x] Tokens deleted from local database
- [x] Old tokens return 401/403 from SmartThings API

### Test 1.2: Revocation Failure Handling

**Objective:** Verify disconnect succeeds even if SmartThings API is unreachable.

**Steps:**

1. **Simulate Network Failure**
   ```bash
   # Add SmartThings API to hosts file to simulate failure
   sudo sh -c 'echo "127.0.0.1 api.smartthings.com" >> /etc/hosts'
   ```

2. **Connect SmartThings** (if not already connected from Test 1.1)

3. **Monitor Logs**
   ```bash
   tail -f ./logs/combined.log | grep -E "(disconnect|revok|warn)"
   ```

4. **Attempt Disconnect**
   ```bash
   curl -X POST http://localhost:5182/auth/smartthings/disconnect
   ```

5. **Verify Graceful Failure**
   ```bash
   # Check for warning logs
   grep "Token revocation failed, continuing with local deletion" ./logs/combined.log | tail -1
   ```

6. **Verify Local Deletion Still Succeeded**
   ```bash
   sqlite3 ./data/tokens.db "SELECT COUNT(*) FROM oauth_tokens;"

   # Expected output: 0
   ```

7. **Cleanup**
   ```bash
   # Remove hosts file entry
   sudo sed -i '' '/api.smartthings.com/d' /etc/hosts
   ```

**Expected Results:**
- ✅ Warning logged: "Token revocation failed, continuing with local deletion"
- ✅ HTTP response: `{ "success": true, "message": "SmartThings disconnected successfully" }`
- ✅ Tokens deleted from local database despite revocation failure

**Pass Criteria:**
- [x] Disconnect succeeds even when revocation fails
- [x] Warning logged with failure reason
- [x] User not blocked from disconnecting

---

## Test 2: Concurrent Refresh Protection (CVE-2024-OAUTH-002)

### Objective
Verify that concurrent token refresh operations are protected by mutex.

### Test 2.1: Single Refresh Operation (Baseline)

**Steps:**

1. **Connect SmartThings Account** (if not already connected)

2. **Trigger Manual Refresh**
   ```bash
   # Create test script: test-refresh.js
   cat > test-refresh.js << 'EOF'
   import { getTokenRefresher } from './src/routes/oauth.js';

   const refresher = getTokenRefresher();

   console.time('Single Refresh');
   await refresher.manualRefresh('default');
   console.timeEnd('Single Refresh');

   console.log('Refresh completed successfully');
   EOF

   # Run test
   node --loader ts-node/esm test-refresh.js
   ```

3. **Verify Logs**
   ```bash
   grep "Token refresh successful" ./logs/combined.log | tail -1
   ```

**Expected Results:**
- ✅ Refresh completes in <5 seconds
- ✅ Log shows: "Token refresh successful"
- ✅ No errors or warnings

### Test 2.2: Concurrent Refresh Detection

**Steps:**

1. **Create Concurrent Test Script**
   ```bash
   cat > test-concurrent-refresh.js << 'EOF'
   import { getTokenRefresher } from './src/routes/oauth.js';

   const refresher = getTokenRefresher();

   console.log('Starting concurrent refresh test...');

   // Start two refreshes simultaneously
   const start = Date.now();
   const promise1 = refresher.manualRefresh('default');
   const promise2 = refresher.manualRefresh('default');

   await Promise.all([promise1, promise2]);
   const duration = Date.now() - start;

   console.log(`Concurrent refreshes completed in ${duration}ms`);
   console.log('Both promises resolved successfully');
   EOF

   # Run test
   node --loader ts-node/esm test-concurrent-refresh.js
   ```

2. **Monitor Logs During Test**
   ```bash
   tail -f ./logs/combined.log | grep -E "(Refresh|concurrent|progress)"
   ```

3. **Verify Concurrent Detection**
   ```bash
   # Check for debug log indicating second refresh waited
   grep "Refresh already in progress, waiting for completion" ./logs/combined.log | tail -1
   ```

4. **Verify Only One API Call**
   ```bash
   # Count refresh attempts in logs
   grep "Refreshing access token" ./logs/combined.log | tail -2

   # Should show only ONE refresh attempt during concurrent test
   ```

**Expected Results:**
- ✅ Second refresh detects first in progress
- ✅ Log shows: "Refresh already in progress, waiting for completion"
- ✅ Only one POST to SmartThings token endpoint
- ✅ Both promises resolve successfully
- ✅ No "Token refresh failed" errors

**Pass Criteria:**
- [x] Concurrent refresh detection works
- [x] Mutex prevents duplicate API calls
- [x] No token invalidation errors
- [x] Both callers receive successful result

### Test 2.3: Lock Release on Error

**Steps:**

1. **Simulate Refresh Failure**
   ```bash
   # Temporarily invalidate refresh token in database
   sqlite3 ./data/tokens.db "UPDATE oauth_tokens SET refresh_token_encrypted='invalid' WHERE user_id='default';"
   ```

2. **Trigger Refresh**
   ```bash
   cat > test-refresh-error.js << 'EOF'
   import { getTokenRefresher } from './src/routes/oauth.js';

   const refresher = getTokenRefresher();

   console.log('Triggering refresh with invalid token...');
   try {
     await refresher.manualRefresh('default');
   } catch (error) {
     console.log('Refresh failed as expected:', error.message);
   }

   // Try second refresh to verify lock released
   console.log('Attempting second refresh to verify lock released...');
   try {
     await refresher.manualRefresh('default');
   } catch (error) {
     console.log('Second refresh also failed (lock was released correctly)');
   }
   EOF

   node --loader ts-node/esm test-refresh-error.js
   ```

3. **Verify Lock Released**
   ```bash
   # Check logs for multiple refresh attempts (proves lock was released)
   grep "Token refresh failed" ./logs/combined.log | tail -2
   ```

4. **Restore Valid Token**
   ```bash
   # Reconnect SmartThings to get valid token
   # Or restore from backup if available
   ```

**Expected Results:**
- ✅ First refresh fails with "Token refresh failed"
- ✅ Second refresh also attempts (proves lock was released)
- ✅ No deadlock or hung promises

**Pass Criteria:**
- [x] Lock released even when refresh fails
- [x] Subsequent refreshes can be attempted
- [x] No deadlock scenario

---

## Test 3: Input Validation (CVE-2024-OAUTH-003)

### Objective
Verify that all OAuth callback parameters are validated and malicious inputs are rejected.

### Test 3.1: Valid Authorization Code

**Steps:**

1. **Initiate OAuth Flow**
   ```bash
   # Visit authorization URL
   open http://localhost:5182/auth/smartthings

   # Authorize on SmartThings (will redirect back with code)
   ```

2. **Capture Valid Callback URL**
   ```bash
   # Example valid callback:
   # http://localhost:5182/auth/smartthings/callback?code=ABC123def456&state=a1b2c3...

   # Note: Code should be alphanumeric with dashes/underscores only
   # Note: State should be exactly 64 hex characters
   ```

3. **Verify Successful Processing**
   ```bash
   # Check logs
   grep "OAuth callback received" ./logs/combined.log | tail -1
   grep "OAuth tokens stored successfully" ./logs/combined.log | tail -1
   ```

**Expected Results:**
- ✅ Valid code and state accepted
- ✅ Token exchange succeeds
- ✅ Redirect to `/?oauth=success`

### Test 3.2: XSS Attack via Code Parameter

**Steps:**

1. **Initiate OAuth to Get Valid State**
   ```bash
   # Start OAuth flow
   open http://localhost:5182/auth/smartthings

   # Capture state token from redirect URL
   # Example: state=abc123def456...
   ```

2. **Craft XSS Payload**
   ```bash
   # Create malicious callback URL with script tag
   VALID_STATE="abc123def456..." # Replace with actual state from step 1

   # Attempt 1: HTML script tag
   open "http://localhost:5182/auth/smartthings/callback?code=<script>alert(1)</script>&state=$VALID_STATE"
   ```

3. **Verify Rejection**
   ```bash
   # Check logs for validation error
   grep "Invalid OAuth callback parameters" ./logs/combined.log | tail -1

   # Check browser redirect
   # Expected: http://localhost:5181/?oauth=error&reason=invalid_params
   ```

4. **Try Additional XSS Payloads**
   ```bash
   # Attempt 2: Event handler
   open "http://localhost:5182/auth/smartthings/callback?code=<img src=x onerror=alert(1)>&state=$VALID_STATE"

   # Attempt 3: JavaScript URL
   open "http://localhost:5182/auth/smartthings/callback?code=javascript:alert(1)&state=$VALID_STATE"
   ```

**Expected Results:**
- ✅ All XSS payloads rejected
- ✅ Log shows: "Invalid OAuth callback parameters"
- ✅ Redirect to error page with `invalid_params`
- ✅ No JavaScript execution in browser
- ✅ No database modifications

**Pass Criteria:**
- [x] HTML tags rejected
- [x] JavaScript URLs rejected
- [x] Event handlers rejected
- [x] Validation error logged

### Test 3.3: SQL Injection via State Parameter

**Steps:**

1. **Craft SQL Injection Payload**
   ```bash
   # Note: Use valid code from previous authorization
   VALID_CODE="ABC123def456" # Replace with actual code

   # Attempt SQL injection in state parameter
   open "http://localhost:5182/auth/smartthings/callback?code=$VALID_CODE&state='; DROP TABLE oauth_tokens; --"
   ```

2. **Verify Rejection**
   ```bash
   grep "Invalid OAuth callback parameters" ./logs/combined.log | tail -1
   ```

3. **Verify Database Intact**
   ```bash
   # Check if oauth_tokens table still exists
   sqlite3 ./data/tokens.db ".tables"

   # Expected: oauth_tokens table should exist
   ```

**Expected Results:**
- ✅ SQL injection payload rejected (invalid state format)
- ✅ Validation error logged
- ✅ Database table intact (not dropped)
- ✅ Redirect to error page

**Pass Criteria:**
- [x] SQL injection prevented
- [x] Database remains intact
- [x] Invalid state format rejected

### Test 3.4: Extremely Long Code Parameter (DoS)

**Steps:**

1. **Generate Long Code**
   ```bash
   # Generate 10,000 character code
   LONG_CODE=$(python3 -c "print('A' * 10000)")
   VALID_STATE="abc123def456..." # Replace with valid state

   # Attempt callback with extremely long code
   curl -v "http://localhost:5182/auth/smartthings/callback?code=$LONG_CODE&state=$VALID_STATE"
   ```

2. **Verify Rejection**
   ```bash
   grep "Invalid OAuth callback parameters" ./logs/combined.log | tail -1
   ```

3. **Check Response Time**
   ```bash
   # Response should be immediate (< 100ms)
   # Long parameter should not cause processing delay
   ```

**Expected Results:**
- ✅ Long code rejected (exceeds 500 char limit)
- ✅ Validation error logged
- ✅ Response returned quickly (no DoS)
- ✅ Server remains responsive

**Pass Criteria:**
- [x] Length limit enforced (500 chars)
- [x] DoS attack prevented
- [x] Server performance unaffected

### Test 3.5: Invalid State Token Format

**Steps:**

1. **Test Various Invalid State Formats**
   ```bash
   VALID_CODE="ABC123def456"

   # Too short
   curl "http://localhost:5182/auth/smartthings/callback?code=$VALID_CODE&state=abc123"

   # Too long
   curl "http://localhost:5182/auth/smartthings/callback?code=$VALID_CODE&state=$(python3 -c 'print(\"a\" * 100)')"

   # Non-hex characters
   curl "http://localhost:5182/auth/smartthings/callback?code=$VALID_CODE&state=GGGGGGGG..."

   # Special characters
   curl "http://localhost:5182/auth/smartthings/callback?code=$VALID_CODE&state=<script>alert(1)</script>..."
   ```

2. **Verify All Rejected**
   ```bash
   grep "Invalid OAuth callback parameters" ./logs/combined.log | tail -4
   ```

**Expected Results:**
- ✅ All invalid state formats rejected
- ✅ Only 64-char hex strings accepted
- ✅ Validation errors logged for each attempt

**Pass Criteria:**
- [x] State format strictly validated
- [x] Non-hex characters rejected
- [x] Incorrect length rejected

### Test 3.6: Error Parameter Validation

**Steps:**

1. **Test Valid Error Parameter**
   ```bash
   # Simulate user denial
   open "http://localhost:5182/auth/smartthings/callback?error=access_denied&state=abc123..."

   # Expected: Redirect to /?oauth=denied
   ```

2. **Test Invalid Error Format**
   ```bash
   # HTML tags in error parameter
   curl "http://localhost:5182/auth/smartthings/callback?error=<script>alert(1)</script>&state=abc123..."

   # Special characters
   curl "http://localhost:5182/auth/smartthings/callback?error=access denied&state=abc123..."
   ```

**Expected Results:**
- ✅ Valid error codes (lowercase + underscore) accepted
- ✅ Invalid error formats rejected
- ✅ HTML tags in error parameter rejected

**Pass Criteria:**
- [x] Error parameter validated
- [x] Only lowercase + underscore allowed
- [x] XSS payloads in error rejected

---

## Test 4: Regression Testing - End-to-End OAuth Flow

### Objective
Verify that security fixes don't break normal OAuth functionality.

### Test 4.1: Complete OAuth Authorization Flow

**Steps:**

1. **Clean Start**
   ```bash
   # Delete existing tokens
   sqlite3 ./data/tokens.db "DELETE FROM oauth_tokens;"
   ```

2. **Initiate OAuth**
   ```bash
   open http://localhost:5181
   # Click "Connect SmartThings"
   ```

3. **Authorize on SmartThings**
   - Log in with SmartThings credentials
   - Grant requested permissions
   - Wait for redirect

4. **Verify Success**
   ```bash
   # Should redirect to: http://localhost:5181/?oauth=success

   # Check tokens stored
   sqlite3 ./data/tokens.db "SELECT user_id, scope FROM oauth_tokens;"

   # Check logs
   grep "OAuth tokens stored successfully" ./logs/combined.log | tail -1
   ```

5. **Test API Access**
   ```bash
   # Make API call using stored token
   curl http://localhost:5182/api/devices

   # Expected: List of SmartThings devices (not 401)
   ```

**Expected Results:**
- ✅ OAuth flow completes successfully
- ✅ Tokens stored encrypted in database
- ✅ API calls work with stored token
- ✅ No security errors in logs

**Pass Criteria:**
- [x] Normal OAuth flow unaffected by security fixes
- [x] Token storage works correctly
- [x] API access works after authorization

### Test 4.2: Token Refresh Flow

**Steps:**

1. **Manually Trigger Refresh**
   ```bash
   # Use test script from Test 2.1
   node --loader ts-node/esm test-refresh.js
   ```

2. **Verify New Tokens Stored**
   ```bash
   sqlite3 ./data/tokens.db "SELECT updated_at FROM oauth_tokens;"

   # Updated timestamp should be recent
   ```

3. **Verify API Still Works**
   ```bash
   curl http://localhost:5182/api/devices
   ```

**Expected Results:**
- ✅ Token refresh succeeds
- ✅ New tokens stored
- ✅ API access continues to work

---

## Test Results Summary

### CVE-2024-OAUTH-001: Token Revocation
- [ ] Test 1.1: Successful revocation
- [ ] Test 1.2: Graceful failure handling

### CVE-2024-OAUTH-002: Concurrent Refresh Protection
- [ ] Test 2.1: Single refresh baseline
- [ ] Test 2.2: Concurrent detection
- [ ] Test 2.3: Lock release on error

### CVE-2024-OAUTH-003: Input Validation
- [ ] Test 3.1: Valid code accepted
- [ ] Test 3.2: XSS payloads rejected
- [ ] Test 3.3: SQL injection prevented
- [ ] Test 3.4: DoS attack prevented
- [ ] Test 3.5: Invalid state rejected
- [ ] Test 3.6: Error parameter validated

### Regression Testing
- [ ] Test 4.1: End-to-end OAuth flow
- [ ] Test 4.2: Token refresh flow

---

## Troubleshooting

### Issue: Tokens Not Found in Database

**Symptom:** `SELECT * FROM oauth_tokens;` returns empty result

**Solution:**
```bash
# Check if database file exists
ls -la ./data/tokens.db

# Check if table exists
sqlite3 ./data/tokens.db ".schema oauth_tokens"

# If table doesn't exist, initialize database
# (Database should auto-create on first use)
```

### Issue: Log File Not Found

**Symptom:** `tail: ./logs/combined.log: No such file or directory`

**Solution:**
```bash
# Create logs directory
mkdir -p ./logs

# Restart backend server to create log file
pnpm dev
```

### Issue: "Cannot find module" Error in Test Scripts

**Symptom:** Node.js cannot import project modules

**Solution:**
```bash
# Use tsx instead of ts-node
npx tsx test-refresh.js

# Or compile TypeScript first
pnpm build
node dist/test-refresh.js
```

### Issue: SmartThings API Returns 401

**Symptom:** API calls fail with "Unauthorized" after token revocation test

**Expected:** This is correct behavior! Revoked tokens should return 401.

---

## Sign-Off

**Tester Name:** ________________
**Date:** ________________
**Test Results:** PASS / FAIL (circle one)

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

**Approved for Production:** YES / NO (circle one)

**Signature:** ________________
