# QA Fixes Required - Ticket 1M-550
**Priority:** Critical (Blocks Production)
**Estimated Time:** 15-30 minutes

---

## Critical Fix (MUST DO)

### ❌ Add InstalledApps API Route

**File:** `src/server-alexa.ts`
**Location:** After rules routes (around line 824)
**Severity:** P1 - Blocks feature

**Add this code:**
```typescript
/**
 * GET /api/installedapps - List all installed apps
 * 
 * Returns SmartApp integrations (Alexa, Google Home, etc.)
 * running in the user's SmartThings account.
 */
server.get('/api/installedapps', async (_request, reply) => {
  try {
    logger.debug('GET /api/installedapps');
    
    // Use existing method from smartThingsService
    const installedApps = await smartThingsService.listInstalledApps();
    
    return reply.send({
      success: true,
      data: {
        count: installedApps.length,
        installedApps: installedApps
      }
    });
  } catch (error) {
    logger.error('Failed to fetch installed apps:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch installed apps'
      }
    });
  }
});
```

**Test After Fix:**
```bash
# Should return list of installed apps
curl http://localhost:5182/api/installedapps

# Should see success response
# Expected: { "success": true, "data": { "count": N, "installedApps": [...] } }
```

**Re-test:**
1. Restart backend server
2. Navigate to http://localhost:5181/installedapps
3. Verify apps load (no error toast)
4. Verify statistics show correct counts
5. Verify app cards display

---

## Recommended Fixes (SHOULD DO)

### ⚠️ Remove Demo Mode Banner

**File:** `web/src/lib/components/automations/AutomationsGrid.svelte`
**Reason:** Banner says "demo data" but page uses real API
**Severity:** P4 - Cosmetic/UX confusion

**Current Code (Around line 110-120):**
```svelte
<!-- Demo Mode Notice -->
<div class="demo-notice">
  <svg ...>...</svg>
  <div>
    <strong>Demo Mode:</strong> Showing sample automations. Backend API integration coming soon.
  </div>
</div>
```

**Option 1: Remove Entirely**
Delete the demo notice section.

**Option 2: Update Message**
```svelte
<!-- Live Data Notice -->
<div class="info-notice">
  <svg ...>...</svg>
  <div>
    <strong>Live Data:</strong> Showing your SmartThings scenes. Click any scene to execute.
  </div>
</div>
```

---

## Optional Improvements (NICE TO HAVE)

### 📝 Create Test Rules
**Reason:** Cannot test Rules execution without data
**Severity:** P3 - Testing limitation

**Steps:**
1. Open SmartThings mobile app
2. Go to Automations → Create Automation
3. Create 2-3 simple rules (e.g., "Turn on light at 6 PM")
4. Re-run QA tests for Rules execution
5. Verify execute button works
6. Verify enable/disable toggle works

---

### 📱 Mobile Testing
**Reason:** Desktop-only testing performed
**Severity:** P3 - Quality assurance

**Test On:**
- iPhone (Safari)
- Android (Chrome)
- iPad (landscape and portrait)

**Check:**
- Touch targets >= 44px
- Execute buttons work
- Toast notifications visible
- Layout adapts to viewport
- No horizontal scrolling

---

## Verification Checklist

After implementing fixes, verify:

- [ ] Backend server restarts without errors
- [ ] `/api/installedapps` returns 200 status
- [ ] InstalledApps page loads without error toast
- [ ] App cards display (if apps exist)
- [ ] Statistics show correct counts
- [ ] Refresh button works
- [ ] Demo Mode banner removed/updated (if applicable)
- [ ] No console errors in browser
- [ ] All navigation working
- [ ] Toast notifications working

---

## Testing Commands

**Backend API Test:**
```bash
# Test InstalledApps endpoint
curl http://localhost:5182/api/installedapps | jq '.'

# Should return:
# {
#   "success": true,
#   "data": {
#     "count": N,
#     "installedApps": [...]
#   }
# }
```

**Frontend Test:**
```bash
# Open browser
open http://localhost:5181/installedapps

# Should see:
# - No error toast
# - App cards displayed (if apps exist)
# - Statistics showing counts
# - No console errors
```

---

## Support

**QA Report:** `QA-REPORT-TICKET-1M-550.md`
**Summary:** `QA-SUMMARY-1M-550.md`
**Ticket:** 1M-550

Questions? Check the full QA report for detailed test results and screenshots.
