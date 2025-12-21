# OAuth Authentication UI - Testing Guide

**Feature**: Automatic OAuth authentication detection and flow on homepage
**Created**: 2025-12-05
**Status**: Ready for Testing

## Overview

This feature adds automatic SmartThings OAuth authentication detection to the homepage. Users are presented with a friendly connection UI if not authenticated, and the app automatically checks authentication status on every visit.

## Implementation Summary

### Files Created/Modified

**New Components:**
- `web/src/lib/components/auth/OAuthConnect.svelte` - OAuth connection UI
- `web/src/routes/auth/callback/+page.svelte` - OAuth callback handler

**Modified Files:**
- `web/src/routes/+page.svelte` - Added auth detection and conditional rendering

### Key Features

1. **Automatic Auth Detection**: Checks `/health` endpoint on page load
2. **Conditional Rendering**: Shows different UI based on auth state
3. **OAuth Flow**: Seamless redirect to SmartThings OAuth
4. **Success Feedback**: Success banner after authentication
5. **Error Handling**: Clear error messages with retry option
6. **Loading States**: Accessible loading indicators

## Testing Requirements

### Prerequisites

1. **Backend Server Running**: Port 5182
   ```bash
   pnpm dev
   ```

2. **Frontend Server Running**: Port 5181
   ```bash
   pnpm dev:web
   ```

3. **SmartThings OAuth Configured**: See `docs/SMARTAPP_SETUP.md`

## Test Cases

### Test Case 1: Unauthenticated State

**Objective**: Verify OAuth connection UI displays when not authenticated

**Steps**:
1. Clear browser storage and cookies (or use incognito mode)
2. Stop backend server (or ensure no `.env.local` with SmartThings token)
3. Navigate to `http://localhost:5181`
4. Wait for auth check to complete

**Expected Results**:
- ✅ Brief loading state appears ("Checking authentication...")
- ✅ OAuthConnect component displays after ~500ms
- ✅ Shows SmartThings logo
- ✅ Shows "Connect to SmartThings" heading
- ✅ Lists 4 features (view devices, manage rooms, automations, events)
- ✅ Security notice with lock icon
- ✅ Blue "Connect SmartThings Account" button
- ✅ Help text below button
- ✅ No console errors
- ✅ Responsive layout on mobile (320px-768px)

**Screenshot Locations**: `docs/screenshots/oauth-connect-desktop.png`, `oauth-connect-mobile.png`

---

### Test Case 2: OAuth Flow - Button Click

**Objective**: Verify OAuth flow initiates correctly

**Steps**:
1. From unauthenticated state (Test Case 1)
2. Click "Connect SmartThings Account" button
3. Observe redirect behavior

**Expected Results**:
- ✅ Redirects to `http://localhost:5182/auth/smartthings`
- ✅ Backend redirects to SmartThings OAuth consent screen
- ✅ Shows SmartThings login page (if not already logged in)
- ✅ Shows authorization consent screen with requested permissions
- ✅ No console errors before redirect

---

### Test Case 3: OAuth Callback - Success

**Objective**: Verify successful OAuth callback handling

**Steps**:
1. Complete OAuth flow (Test Case 2)
2. Authorize the application on SmartThings
3. SmartThings redirects back to callback URL
4. Observe callback page behavior

**Expected Results**:
- ✅ Lands on `/auth/callback` page
- ✅ Shows success checkmark icon (green)
- ✅ Shows "Authentication Successful!" heading
- ✅ Shows "Redirecting to dashboard in 3 seconds..." with countdown
- ✅ Countdown updates: 3 → 2 → 1
- ✅ Shows "Continue to Dashboard" button (manual override)
- ✅ Automatically redirects to homepage after 3 seconds
- ✅ Homepage shows success banner at top
- ✅ Success banner displays "Successfully connected!"
- ✅ Success banner auto-dismisses after 5 seconds
- ✅ RoomsGrid component loads (authenticated state)
- ✅ No console errors

**Screenshot Locations**: `docs/screenshots/oauth-callback-success.png`, `oauth-homepage-success-banner.png`

---

### Test Case 4: OAuth Callback - Manual Continue

**Objective**: Verify manual continue button works

**Steps**:
1. Complete OAuth flow to callback page
2. Click "Continue to Dashboard" button before auto-redirect

**Expected Results**:
- ✅ Immediately redirects to homepage
- ✅ Success banner appears
- ✅ RoomsGrid loads normally

---

### Test Case 5: OAuth Callback - Error State

**Objective**: Verify error handling in OAuth flow

**Steps**:
1. Manually navigate to: `http://localhost:5181/auth/callback?error=access_denied&error_description=User%20denied%20authorization`
2. Observe error state

**Expected Results**:
- ✅ Shows error icon (red)
- ✅ Shows "Authentication Failed" heading (red text)
- ✅ Shows error description: "User denied authorization"
- ✅ Shows red "Try Again" button
- ✅ Clicking "Try Again" redirects to homepage
- ✅ Homepage shows OAuthConnect component (retry flow)
- ✅ No console errors

**Screenshot Locations**: `docs/screenshots/oauth-callback-error.png`

---

### Test Case 6: Authenticated State

**Objective**: Verify authenticated users see normal dashboard

**Steps**:
1. Ensure SmartThings token exists (complete OAuth flow or set in `.env.local`)
2. Navigate to `http://localhost:5181`
3. Wait for auth check

**Expected Results**:
- ✅ Brief loading state ("Checking authentication...")
- ✅ RoomsGrid component loads (no OAuthConnect UI)
- ✅ Rooms displayed in grid layout
- ✅ Device counts shown per room
- ✅ No OAuth-related UI elements
- ✅ Normal app navigation works (Devices, Automations, Rules)
- ✅ No console errors

---

### Test Case 7: Backend Offline

**Objective**: Verify error handling when backend unreachable

**Steps**:
1. Stop backend server (`pnpm dev`)
2. Navigate to `http://localhost:5181`
3. Wait for auth check timeout

**Expected Results**:
- ✅ Brief loading state
- ✅ Error card displays after timeout (~5 seconds)
- ✅ Shows red error icon
- ✅ Shows "Connection Failed" heading
- ✅ Shows error message: "Unable to connect to backend server..."
- ✅ Shows blue "Try Again" button with retry icon
- ✅ Clicking "Try Again" re-attempts auth check
- ✅ Console shows fetch error (expected)

**Screenshot Locations**: `docs/screenshots/oauth-backend-offline.png`

---

### Test Case 8: Success Banner Dismissal

**Objective**: Verify success banner can be manually dismissed

**Steps**:
1. Complete OAuth flow to show success banner
2. Click X (dismiss) button on success banner

**Expected Results**:
- ✅ Success banner disappears immediately
- ✅ Banner does not reappear
- ✅ Rooms grid remains visible
- ✅ No console errors

---

### Test Case 9: Responsive Design - Mobile

**Objective**: Verify responsive layouts on mobile devices

**Steps**:
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test various viewports: iPhone SE (375px), iPhone 12 Pro (390px), Galaxy S20 (360px)
4. Test unauthenticated state, callback page, error state

**Expected Results**:
- ✅ OAuthConnect component fits mobile viewport
- ✅ Text remains readable (no truncation)
- ✅ Buttons remain accessible (44px touch target minimum)
- ✅ Success banner adjusts to mobile layout
- ✅ Error cards fit mobile viewport
- ✅ No horizontal scrolling
- ✅ All interactive elements reachable

---

### Test Case 10: Keyboard Navigation

**Objective**: Verify full keyboard accessibility

**Steps**:
1. Navigate to OAuthConnect page
2. Press Tab key to navigate through interactive elements
3. Use Enter/Space to activate buttons
4. Test all states (loading, error, callback)

**Expected Results**:
- ✅ All interactive elements focusable via Tab
- ✅ Focus indicators clearly visible (blue outline)
- ✅ Logical tab order (logo → button → help text)
- ✅ Enter key activates "Connect" button
- ✅ Enter key activates "Try Again" button
- ✅ Enter key activates "Continue to Dashboard" button
- ✅ Escape key does not close (no modal behavior)

---

### Test Case 11: Screen Reader Support

**Objective**: Verify screen reader compatibility (WCAG 2.1 AA)

**Prerequisites**: NVDA (Windows) or VoiceOver (Mac)

**Steps**:
1. Enable screen reader
2. Navigate to OAuthConnect page
3. Listen to announcements
4. Test callback success and error states

**Expected Results**:
- ✅ "Connect to SmartThings" heading announced
- ✅ Feature list items announced correctly
- ✅ Security notice announced
- ✅ Button label "Connect SmartThings Account" announced
- ✅ Loading state "Checking authentication" announced (role="status")
- ✅ Success state "Authentication Successful!" announced (role="status")
- ✅ Error state announced with role="alert"
- ✅ Countdown updates announced
- ✅ No unlabeled interactive elements

---

### Test Case 12: Reduced Motion

**Objective**: Verify animations respect `prefers-reduced-motion`

**Steps**:
1. Enable reduced motion in OS settings:
   - **macOS**: System Preferences → Accessibility → Display → Reduce motion
   - **Windows**: Settings → Ease of Access → Display → Show animations
2. Navigate through all states (loading, OAuthConnect, callback)

**Expected Results**:
- ✅ No animations on button hover
- ✅ No slide-down animation on success banner
- ✅ No scale animation on callback card
- ✅ No icon pop animation
- ✅ Functionality remains intact
- ✅ UI still visually clear without animations

---

### Test Case 13: Page Refresh During Auth Check

**Objective**: Verify auth check re-runs on refresh

**Steps**:
1. Navigate to homepage in unauthenticated state
2. Wait for OAuthConnect to appear
3. Refresh page (F5 or Cmd+R)

**Expected Results**:
- ✅ Auth check runs again (loading state appears)
- ✅ OAuthConnect component displays again
- ✅ No cached authentication state
- ✅ No console errors

---

### Test Case 14: Direct URL Navigation

**Objective**: Verify auth check works with direct URL access

**Steps**:
1. Close all browser tabs
2. Directly navigate to `http://localhost:5181/`
3. Directly navigate to `http://localhost:5181/devices`
4. Directly navigate to `http://localhost:5181/automations`

**Expected Results**:
- ✅ Homepage runs auth check and shows appropriate state
- ✅ Other pages continue to work (auth check isolated to homepage)
- ✅ Navigation between pages works normally
- ✅ No authentication required for other pages (device data may fail if not authenticated)

---

### Test Case 15: Console Error Monitoring

**Objective**: Ensure no console errors during normal operation

**Steps**:
1. Open browser DevTools Console (F12)
2. Execute all test cases 1-14
3. Monitor console output

**Expected Results**:
- ✅ No console errors during authenticated flow
- ✅ No console errors during OAuth flow
- ✅ No console errors on callback page
- ✅ Expected fetch error when backend offline (Test Case 7)
- ✅ No React/Svelte warnings
- ✅ No TypeScript type errors
- ✅ No CSP violations

---

## Browser Compatibility Testing

### Required Browsers

Test all scenarios above on:
- ✅ Chrome 120+ (Desktop)
- ✅ Firefox 120+ (Desktop)
- ✅ Safari 16+ (macOS)
- ✅ Edge 120+ (Desktop)
- ✅ Chrome Mobile (Android)
- ✅ Safari Mobile (iOS)

### Known Issues

- None identified during implementation

---

## Performance Testing

### Load Time Metrics

**Target**: Auth check completes within 500ms

**Steps**:
1. Open Chrome DevTools Network tab
2. Navigate to homepage
3. Measure time from page load to auth check completion

**Expected Results**:
- ✅ `/health` request completes < 500ms (p95)
- ✅ Total auth check duration < 500ms (p95)
- ✅ No render blocking during auth check
- ✅ Loading spinner appears immediately

---

## Accessibility Testing

### WCAG 2.1 AA Compliance

**Requirements**:
- ✅ Color contrast ratio ≥ 4.5:1 (text)
- ✅ Color contrast ratio ≥ 3:1 (UI components)
- ✅ All interactive elements keyboard accessible
- ✅ Focus indicators clearly visible
- ✅ Screen reader support (tested with NVDA/VoiceOver)
- ✅ No reliance on color alone for information
- ✅ Touch targets ≥ 44x44px

**Tools**:
- Chrome Lighthouse Accessibility Audit
- axe DevTools browser extension
- WAVE Web Accessibility Evaluation Tool

---

## Security Testing

### OAuth Flow Security

**Verified**:
- ✅ PKCE implementation in backend (ticket 1M-543)
- ✅ State parameter validation (CSRF protection)
- ✅ Secure token storage (backend only, not exposed to frontend)
- ✅ No credentials in URL parameters
- ✅ HTTPS required for production

**Documentation**: See `docs/security/OAUTH2-SECURITY-FIXES-1M-543.md`

---

## Regression Testing

### Existing Features to Verify

After implementing OAuth authentication UI, verify these features still work:

1. **Rooms Navigation**: Homepage → Rooms grid loads correctly
2. **Devices Page**: `/devices` page loads and displays devices
3. **Automations Page**: `/automations` page loads and displays automations
4. **Rules Page**: `/rules` page loads and displays rules
5. **Device Controls**: Device on/off controls still work
6. **Real-time Updates**: Device events SSE still updates UI
7. **Room Filtering**: Device filtering by room still works
8. **Search**: Device search functionality intact

---

## Known Limitations

1. **Auth Check on Every Page Load**: Currently only homepage checks auth
   - Other pages will fail gracefully if not authenticated
   - Future: Consider global auth store or layout-level check

2. **No Token Refresh UI**: Token refresh happens automatically in backend
   - Users won't see any UI during token refresh
   - Future: Consider adding "Reconnecting..." indicator

3. **Backend URL Hardcoded**: Uses `VITE_API_URL` or `localhost:5182`
   - Works for development
   - Production: Must set `VITE_API_URL` environment variable

---

## Testing Checklist

Use this checklist to verify all test cases:

- [ ] Test Case 1: Unauthenticated State
- [ ] Test Case 2: OAuth Flow - Button Click
- [ ] Test Case 3: OAuth Callback - Success
- [ ] Test Case 4: OAuth Callback - Manual Continue
- [ ] Test Case 5: OAuth Callback - Error State
- [ ] Test Case 6: Authenticated State
- [ ] Test Case 7: Backend Offline
- [ ] Test Case 8: Success Banner Dismissal
- [ ] Test Case 9: Responsive Design - Mobile
- [ ] Test Case 10: Keyboard Navigation
- [ ] Test Case 11: Screen Reader Support
- [ ] Test Case 12: Reduced Motion
- [ ] Test Case 13: Page Refresh During Auth Check
- [ ] Test Case 14: Direct URL Navigation
- [ ] Test Case 15: Console Error Monitoring
- [ ] Browser Compatibility (6 browsers)
- [ ] Performance Testing (< 500ms auth check)
- [ ] Accessibility Testing (WCAG 2.1 AA)
- [ ] Regression Testing (8 existing features)

---

## Bug Reporting Template

If issues are found, report using this template:

```markdown
**Test Case**: [Number and name]
**Browser**: [Chrome 120/Firefox 120/Safari 16/etc.]
**OS**: [macOS 14/Windows 11/iOS 17/Android 14]
**Viewport**: [Desktop 1920x1080 / Mobile 375x667 / etc.]

**Steps to Reproduce**:
1.
2.
3.

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshots**:
[Attach screenshots if applicable]

**Console Output**:
[Copy any console errors or warnings]

**Severity**:
[Critical / High / Medium / Low]
```

---

## Testing Sign-Off

**Tested By**: ______________________
**Date**: ______________________
**Result**: ⬜ Pass  ⬜ Fail (with issues documented)

**Notes**:
```
[Add any additional observations or concerns]
```

---

## Next Steps

After testing completes:

1. **If Pass**: Ready for production deployment
2. **If Fail**:
   - Document all issues with bug reports
   - Prioritize critical/high severity issues
   - Fix issues and re-test
   - Update this document with any new test cases

---

**Related Documentation**:
- OAuth Implementation: `docs/security/OAUTH2-SECURITY-FIXES-1M-543.md`
- SmartApp Setup: `docs/SMARTAPP_SETUP.md`
- CLAUDE.md: `/Users/masa/Projects/mcp-smarterthings/CLAUDE.md`
