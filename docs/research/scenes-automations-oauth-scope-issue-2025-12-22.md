# Scenes and Automations OAuth Scope Issue - Investigation Report

**Date**: 2025-12-22
**Investigator**: Research Agent
**Status**: Root Cause Identified
**Severity**: HIGH - Feature completely non-functional

## Executive Summary

The Scenes and Automations feature in Smarter Things is **completely broken** due to missing OAuth scopes. The application requests scenes data from the SmartThings API but the OAuth token lacks the required `r:scenes:*` and `x:scenes:*` permissions, resulting in 403 Forbidden errors.

**Impact**:
- Users cannot view their SmartThings scenes (manually run routines)
- Scenes cannot be executed through the UI
- Automations page shows errors instead of scene list

**Root Cause**: OAuth scope configuration mismatch between code documentation and actual implementation.

---

## Investigation Findings

### 1. API Endpoint Analysis

**Backend Health Check**: ✅ PASSED
```bash
curl http://localhost:5182/health
# Response: {"status":"healthy","smartthings":{"initialized":true,"hasTokens":true}}
```

**Automations Endpoint**: ❌ FAILED
```bash
curl http://localhost:5182/api/automations
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "UNKNOWN_ERROR",
    "message": "Request failed with status code 403: Token does not have the l/r:scenes:* scope"
  }
}
```

**Scenes Endpoint**: ❌ NOT IMPLEMENTED
```bash
curl http://localhost:5182/api/scenes
# Response: {"error":"Not Found","message":"Route GET /api/scenes not found"}
```

### 2. Code Analysis

#### OAuth Scope Configuration

**Location**: `src/smartthings/oauth-service.ts:331-337`

**Current Implementation**:
```typescript
export const DEFAULT_SCOPES = [
  'r:devices:$',
  'r:devices:*',
  'x:devices:$',
  'x:devices:*',
  'r:locations:*',
  // ❌ MISSING: 'r:scenes:*'
  // ❌ MISSING: 'x:scenes:*'
];
```

**Documentation Says** (lines 320-326):
```typescript
/**
 * - r:scenes:* - Read all scenes
 * - x:scenes:* - Execute scenes
 */
```

**Discrepancy**: The code comments document `r:scenes:*` and `x:scenes:*` as required scopes, but they are **NOT included** in the actual `DEFAULT_SCOPES` array.

#### Backend Route Implementation

**Location**: `src/server-alexa.ts:828-868`

The `/api/automations` endpoint is implemented and tries to fetch scenes:

```typescript
server.get('/api/automations', async (request, reply) => {
  const executor = getToolExecutor();
  const result = await executor.listScenes(); // ❌ Fails with 403
  // ...
});
```

**Missing Route**: No `/api/scenes` endpoint exists (404 Not Found).

#### Frontend Implementation

**Location**: `web/src/lib/stores/automationStore.svelte.ts`

The frontend correctly fetches from `/api/automations`:

```typescript
export async function loadAutomations(): Promise<void> {
  const response = await fetch('/api/automations');
  // Expects: { success: true, data: [...] }
}
```

**Location**: `web/src/routes/automations/+page.svelte`

Simple page component that delegates to `AutomationsGrid.svelte`.

### 3. SmartThings API Error Details

**Error Code**: `NotAllowedError`
**Message**: "Token does not have the l/r:scenes:* scope"
**HTTP Status**: 403 Forbidden

**SmartThings API Requirement**:
- **Read Scenes**: Requires `r:scenes:*` scope
- **Execute Scenes**: Requires `x:scenes:*` scope

**Current Token**: Only has device and location scopes, missing scene permissions.

### 4. Documentation vs. Reality

| Source | r:scenes:* | x:scenes:* | Status |
|--------|------------|------------|--------|
| `oauth-service.ts` comments | ✅ Documented | ✅ Documented | Code comments mention it |
| `DEFAULT_SCOPES` array | ❌ Missing | ❌ Missing | **NOT IMPLEMENTED** |
| `docs/SMARTAPP_SETUP.md` | ❌ Missing | ❌ Missing | Documentation doesn't mention scenes |
| `CLAUDE.md` | ✅ Listed | ✅ Listed | Project guide mentions scenes in required scopes |

**Gap**: Documentation is inconsistent. `CLAUDE.md` mentions scenes scopes, but `SMARTAPP_SETUP.md` setup guide omits them.

---

## Root Cause

**Primary Issue**: OAuth scope configuration incomplete

1. **Code Intent**: Comments in `oauth-service.ts` show developers intended to include scene scopes
2. **Implementation Gap**: `DEFAULT_SCOPES` array never actually added `r:scenes:*` and `x:scenes:*`
3. **Testing Gap**: Feature was implemented (UI, backend routes, stores) but never tested against real API
4. **Documentation Gap**: Setup guide doesn't mention scene scopes in SmartApp OAuth configuration

**Chain of Failures**:
```
Missing OAuth Scopes
  ↓
SmartThings API Returns 403
  ↓
Backend Returns Error to Frontend
  ↓
Automations Page Shows Empty/Error State
  ↓
Feature Completely Broken
```

---

## Impact Assessment

### Affected Components

**Backend**:
- ❌ `GET /api/automations` - Returns 403 error
- ❌ `POST /api/automations/:id/execute` - Would fail with 403
- ❌ Scene listing functionality (ToolExecutor.listScenes)

**Frontend**:
- ❌ `/automations` page - Cannot load scenes
- ❌ `AutomationsGrid.svelte` - Shows error state
- ❌ `AutomationCard.svelte` - Never renders with data
- ❌ Scene execution buttons - Non-functional

**User Experience**:
- Users see error message instead of their scenes
- Cannot trigger SmartThings routines from the app
- Feature marketed in Sprint 1.2 summary is unusable

### Severity Classification

**Severity**: HIGH (P1)

**Rationale**:
1. **Complete Feature Failure**: Feature is 100% non-functional
2. **User-Facing**: Directly impacts user experience
3. **Sprint 1.2 Deliverable**: Listed as completed feature in Sprint 1.2 summary
4. **Simple Fix**: Requires only 2-line code change + OAuth re-authorization

**Not Critical (P0) Because**:
- Doesn't affect core device control functionality
- Doesn't cause crashes or data loss
- Only affects optional automation/scenes feature

---

## Resolution Plan

### Required Changes

#### 1. Fix OAuth Scope Configuration

**File**: `src/smartthings/oauth-service.ts`

**Change**:
```typescript
export const DEFAULT_SCOPES = [
  'r:devices:$',
  'r:devices:*',
  'x:devices:$',
  'x:devices:*',
  'r:locations:*',
  'r:scenes:*',    // ✅ ADD THIS
  'x:scenes:*',    // ✅ ADD THIS
];
```

#### 2. Update SmartApp Configuration

**Action**: Re-configure SmartApp OAuth scopes via SmartThings CLI

```bash
smartthings apps:oauth <APP_ID>

# When prompted for scopes, enter:
r:devices:$
r:devices:*
x:devices:$
x:devices:*
r:locations:*
r:scenes:*    # ✅ ADD
x:scenes:*    # ✅ ADD
```

#### 3. Re-Authorize OAuth Flow

**Action**: Users must re-authorize the application to grant new scopes

**Steps**:
1. Visit: `http://localhost:5182/auth/smartthings`
2. Authorize with updated scopes
3. Redirect back to app with new token
4. Token now includes `r:scenes:*` and `x:scenes:*` permissions

#### 4. Update Documentation

**Files to Update**:
- `docs/SMARTAPP_SETUP.md` - Add scenes scopes to setup instructions
- `docs/QUICKSTART.md` - Update required scopes section
- `CLAUDE.md` - Verify scenes scopes are documented

#### 5. Add Missing `/api/scenes` Endpoint (Optional)

**Question**: Should we add a dedicated `/api/scenes` endpoint separate from `/api/automations`?

**Current Architecture**:
- `/api/automations` returns scenes (manually run routines)
- No separate `/api/scenes` endpoint

**Recommendation**: Keep current architecture unless there's a business need to separate concerns.

---

## Testing Verification Plan

### Pre-Fix Verification (Reproduce Issue)

1. ✅ Verify 403 error on `/api/automations`
2. ✅ Confirm missing scopes in `DEFAULT_SCOPES`
3. ✅ Check frontend error state

### Post-Fix Verification

**Backend Tests**:
```bash
# 1. Verify scope configuration
grep -A 10 "DEFAULT_SCOPES" src/smartthings/oauth-service.ts
# Should include r:scenes:* and x:scenes:*

# 2. Test automations endpoint
curl http://localhost:5182/api/automations
# Should return: { "success": true, "data": [...] }

# 3. Test scene execution
curl -X POST http://localhost:5182/api/automations/{SCENE_ID}/execute
# Should return: { "success": true }
```

**Frontend Tests**:
1. Navigate to `http://localhost:5181/automations`
2. Verify scenes load without errors
3. Click scene card to execute
4. Verify toast notification confirms execution

**Integration Tests**:
```bash
pnpm test:integration
# Should pass OAuth scope tests
# Should pass scene listing tests
# Should pass scene execution tests
```

---

## Related Issues

### Previously Completed Work (Sprint 1.2)

**Ticket 1M-546**: Automations list view with filtering
**Ticket 1M-547**: Automation detail view with status monitoring
**Status**: ✅ Code implemented, ❌ Feature broken due to OAuth scopes

**Observation**: UI and backend were fully implemented but never tested against real SmartThings API with proper OAuth scopes.

### Documentation Improvements Needed

1. **OAuth Setup Guide** (`docs/SMARTAPP_SETUP.md`)
   - Add scenes scopes to required permissions
   - Update scope verification checklist

2. **Quick Reference** (`docs/QUICKSTART.md`)
   - List all required scopes including scenes
   - Add troubleshooting section for 403 errors

3. **Testing Guides**
   - Add OAuth scope verification to pre-deployment checklist
   - Create manual testing guide for scenes/automations

---

## Recommendations

### Immediate Actions (P0 - Do Now)

1. ✅ **Add scene scopes to `DEFAULT_SCOPES`** (2-line code change)
2. ✅ **Update SmartApp OAuth configuration** (CLI command)
3. ✅ **Re-authorize OAuth flow** (get new token with scopes)
4. ✅ **Test automations endpoint** (verify 200 response)
5. ✅ **Update documentation** (SMARTAPP_SETUP.md, QUICKSTART.md)

### Short-Term Actions (P1 - This Sprint)

1. Add integration tests for OAuth scope validation
2. Create automated scope verification in health check endpoint
3. Add user-facing error messages for missing scopes
4. Document OAuth troubleshooting procedures

### Long-Term Actions (P2 - Future Sprint)

1. Implement OAuth scope migration/refresh flow
2. Add scope validation to deployment checklist
3. Create automated smoke tests for all API endpoints
4. Implement feature flags to disable UI for missing scopes

---

## Lessons Learned

### What Went Wrong

1. **Code Review Gap**: Comments documented scopes but implementation didn't include them
2. **Testing Gap**: Feature merged without end-to-end testing against real API
3. **Documentation Gap**: Setup guide incomplete, didn't reflect actual requirements
4. **Integration Testing Gap**: No tests validate OAuth scopes grant required permissions

### Process Improvements

1. **Mandatory E2E Testing**: All API-dependent features must have integration tests
2. **OAuth Scope Checklist**: Add scope verification to PR review checklist
3. **Documentation Review**: Cross-reference setup guides with code constants
4. **Automated Scope Validation**: Health check endpoint should validate token scopes

### Quality Gates to Add

```typescript
// Suggested: OAuth scope validator in health check
async function validateOAuthScopes(token: string): Promise<ScopeValidation> {
  const requiredScopes = DEFAULT_SCOPES;
  const grantedScopes = await getTokenScopes(token);

  return {
    valid: requiredScopes.every(scope => grantedScopes.includes(scope)),
    missing: requiredScopes.filter(scope => !grantedScopes.includes(scope)),
    granted: grantedScopes,
  };
}
```

---

## Appendix

### A. Error Stack Trace

```
SceneServiceError: Request failed with status code 403: {"requestId":"3995539202632902177","error":{"code":"NotAllowedError","message":"Token does not have the l/r:scenes:* scope","details":[]}}
    at ErrorHandler.transformApiError (/Users/masa/Projects/smarterthings/src/services/errors/ErrorHandler.ts:209:16)
    at SceneService.listScenes (/Users/masa/Projects/smarterthings/src/services/SceneService.ts:97:41)
    at async handleListScenes (/Users/masa/Projects/smarterthings/src/mcp/tools/scenes.ts:82:20)
    at async ToolExecutor.listScenes (/Users/masa/Projects/smarterthings/src/direct/ToolExecutor.ts:366:20)
    at async Object.<anonymous> (/Users/masa/Projects/smarterthings/src/server-alexa.ts:837:22)
```

### B. SmartThings OAuth Scope Reference

**Scope Format**: `permission:entity-type:entity-id`

**Permissions**:
- `r` - Read
- `x` - Execute
- `w` - Write
- `d` - Delete

**Entity Types**:
- `devices` - Smart devices
- `scenes` - Scenes/routines
- `locations` - Locations/hubs
- `rooms` - Rooms/zones

**Entity ID**:
- `*` - All entities
- `$` - User's own entities
- `{uuid}` - Specific entity

**Examples**:
- `r:devices:*` - Read all devices
- `x:devices:$` - Execute commands on user's devices
- `r:scenes:*` - Read all scenes ⬅️ **MISSING**
- `x:scenes:*` - Execute scenes ⬅️ **MISSING**

### C. File Locations

**Backend**:
- OAuth Service: `src/smartthings/oauth-service.ts`
- API Routes: `src/server-alexa.ts`
- Scene Service: `src/services/SceneService.ts`
- MCP Tools: `src/mcp/tools/scenes.ts`

**Frontend**:
- Automations Page: `web/src/routes/automations/+page.svelte`
- Automation Store: `web/src/lib/stores/automationStore.svelte.ts`
- Grid Component: `web/src/lib/components/automations/AutomationsGrid.svelte`
- Card Component: `web/src/lib/components/automations/AutomationCard.svelte`

**Documentation**:
- Setup Guide: `docs/SMARTAPP_SETUP.md`
- Quick Start: `docs/QUICKSTART.md`
- Project Guide: `CLAUDE.md`
- Sprint 1.2 Summary: `docs/summaries/AUTOMATION-INTEGRATION-SUMMARY.md`

---

## Conclusion

The Scenes and Automations feature is fully implemented from a code perspective but completely non-functional due to a simple OAuth scope configuration error. The fix requires:

1. Adding 2 lines to `DEFAULT_SCOPES` array
2. Updating SmartApp OAuth configuration
3. Re-authorizing the OAuth flow
4. Updating documentation

**Estimated Fix Time**: 15-30 minutes
**Risk Level**: LOW (simple configuration change)
**Testing Time**: 15 minutes (manual verification)

Once scopes are added, the existing implementation should work without any code changes to the backend or frontend. This is a straightforward configuration issue with a well-defined resolution path.

---

**Research Captured**: 2025-12-22
**Next Steps**: Implement fix per resolution plan, verify with testing checklist
**Priority**: HIGH (P1) - Fix in current sprint
