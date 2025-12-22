# Browser Console Error Investigation Report

**Date**: 2025-12-21
**URL**: http://localhost:5181/devices?room=35ebee2a-3993-4eff-acb6-8667ab04a568
**Report Type**: UAT - Web QA Investigation
**Status**: Manual inspection required (MCP Browser not configured)

---

## Executive Summary

Investigation of reported "many console errors" on the devices page with room filter. Backend systems are confirmed healthy, but a **known SSE connection status bug** may be generating console warnings. Manual browser inspection is required for complete diagnosis.

**Key Findings**:
- ✅ Backend servers operational (both frontend and backend)
- ✅ SSE endpoint responding correctly
- ⚠️ Known SSE connection status bug documented (see analysis below)
- ⚠️ Potential console warnings during SSE initialization
- ❓ Chrome DevTools MCP not configured (manual inspection needed)

---

## Investigation Methodology

### Tools Used
1. **Backend Health Checks**: Verified server status via curl
2. **SSE Endpoint Testing**: Direct connection test to event stream
3. **Code Analysis**: Reviewed SSE client, device store, and event handlers
4. **Documentation Review**: Found existing bug analysis document
5. **Log Analysis**: Checked for console.error/warn patterns in codebase

### Limitations
- Chrome DevTools MCP integration not configured in project
- Unable to connect directly to browser console
- Manual inspection required for actual error messages

---

## Backend System Status

### ✅ Backend Server (Port 5182)
**Status**: Healthy and operational

```json
{
  "status": "healthy",
  "service": "mcp-smarterthings-alexa",
  "version": "0.7.2",
  "uptime": 5396.977320542,
  "smartthings": {
    "initialized": true,
    "adapterReady": true,
    "hasTokens": true,
    "message": "SmartThings connected and ready"
  }
}
```

### ✅ SSE Endpoint (Port 5182)
**Endpoint**: `http://localhost:5182/api/events/stream`
**Status**: Responding correctly

**Test Result**:
```
event: connected
data: {"timestamp":"2025-12-21T23:35:20.029Z","message":"Connected to event stream"}
```

**Analysis**: Backend SSE implementation is working correctly. Server properly sends:
- `connected` event on initial connection
- `heartbeat` events every 30 seconds
- `new-event` broadcasts for device state changes

### ✅ Frontend Server (Port 5181)
**Status**: Running (Vite dev server)
- Process ID: 81238
- No build errors detected

---

## Known Issues Analysis

### 🔴 Critical Finding: SSE Connection Status Bug

A **documented bug** exists in the SSE connection status handling that causes console warnings and UI inconsistencies.

**Reference**: `/docs/research/sse-connection-status-bug-analysis-2025-12-21.md`

#### Bug Summary
**File**: `/web/src/lib/sse/deviceStream.svelte.ts`
**Line**: 68
**Issue**: Premature `setSSEConnected(false)` call before connection opens

**Problematic Code**:
```typescript
// Line 67-68 (BUGGY)
eventSource = new EventSource('http://localhost:5182/api/events/stream');
store.setSSEConnected(false);  // ❌ Sets false BEFORE onopen fires

// Line 72-76 (Correct, but races with line 68)
eventSource.onopen = () => {
  console.log('[SSE] Connected to device event stream');
  store.setSSEConnected(true);  // ✅ Sets true when connection opens
  reconnectAttempts = 0;
  lastHeartbeat = Date.now();
};
```

#### Expected Console Output (From This Bug)
```
[SSE] Connected to device event stream
[SSE] Connection acknowledged: 2025-12-21T...
[SSE] Heartbeat received: { timestamp: ..., clients: 1 }
```

**Potential Console Warnings**:
- Repeated connection state changes
- "Reconnecting..." status when actually connected
- Timing-related console logs showing state transitions

**User Impact**:
- Visual "Reconnecting..." status shown even when working
- Console may show misleading connection state changes
- No functional impact (events still work), but confusing UX

---

## Potential Error Sources

Based on code analysis, these are the **most likely** sources of console errors:

### 1. SSE Connection Errors (HIGH PROBABILITY)
**File**: `/web/src/lib/sse/deviceStream.svelte.ts`

**Potential Errors**:
```javascript
// Line 59
console.error('[SSE] Max reconnection attempts reached, giving up');

// Line 81
console.error('[SSE] Connection error:', error);

// Line 90-92
console.log(`[SSE] Reconnecting in ${backoffMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

// Line 111, 128, 145, 162, 176, 190, 225
console.error('[SSE] Failed to parse [event-type] event:', error);

// Line 241
console.warn('[SSE] No heartbeat for 60s, connection may be stale, reconnecting...');

// Line 251
console.error('[SSE] Failed to create EventSource:', error);
```

### 2. Device Store Errors (MEDIUM PROBABILITY)
**File**: `/web/src/lib/stores/deviceStore.svelte.ts`

**Potential Warnings**:
```javascript
// Device not found warning
console.warn(`[DeviceStore] Device ${deviceId} not found, skipping SSE update`);

// SSE connection error
console.error('[DeviceStore] SSE connection error:', error);
```

### 3. Room Loading Errors (MEDIUM PROBABILITY)
**URL Context**: Room ID `35ebee2a-3993-4eff-acb6-8667ab04a568` in URL

**Potential Issues**:
- Room ID doesn't exist or failed to load
- Room filter causing device list filtering errors
- Breadcrumb component errors loading room data

### 4. Event Store Errors (LOW PROBABILITY)
**Files**:
- `/web/src/lib/stores/eventsStore.svelte.ts`
- `/web/src/lib/stores/automationStore.svelte.ts`
- `/web/src/lib/stores/scenesStore.svelte.ts`
- `/web/src/lib/stores/rulesStore.svelte.ts`

**Potential Errors**:
```javascript
console.error('[EventsStore] Load error:', error);
console.error('[EventsStore] SSE connection error');
console.error('[EventsStore] SSE connection failed:', err);
console.error('Failed to load scenes:', err);
console.error('Failed to execute scene:', err);
console.error('Failed to load rules:', err);
console.error('Failed to execute rule:', err);
```

---

## Error Categories Expected

### JavaScript Runtime Errors
- `TypeError` - Object/property access errors
- `ReferenceError` - Undefined variable access
- `SyntaxError` - Malformed JSON parsing (SSE events)

### Network Errors
- CORS violations (unlikely - same origin)
- EventSource connection failures
- API request failures (`/api/devices`, `/api/rooms`)
- Timeout errors

### Console Warnings
- SSE connection state transitions
- Device not found in store
- Stale connection detection
- Reconnection attempts

### Expected Normal Logs
```javascript
[SSE] Connected to device event stream
[SSE] Connection acknowledged: <timestamp>
[SSE] Heartbeat received: { timestamp: ..., clients: 1 }
[SSE] Device state updated: { deviceId: ..., state: { ... } }
[SSE] new-event received: { ... }
[SSE] Processing device state change: { ... }
```

---

## Manual Inspection Guide

Since chrome-devtools-mcp is not configured, manual inspection is required.

### Step-by-Step Instructions

#### 1. Open Developer Tools
**Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac)

#### 2. Console Tab Inspection
Look for errors matching these patterns:

**SSE Errors** (Most likely):
- `[SSE] Connection error:`
- `[SSE] Failed to parse`
- `[SSE] Reconnecting in`
- `[SSE] Max reconnection attempts`

**Device Store Warnings**:
- `[DeviceStore] Device ... not found`
- `[DeviceStore] SSE connection error`

**General Errors**:
- `TypeError:`
- `Uncaught (in promise):`
- `Failed to fetch`

#### 3. Network Tab Inspection
Filter to "EventStream" or search for "stream"

**Check**:
- `/api/events/stream` - Should show "pending" (ongoing)
- Click on it → **EventStream** sub-tab should show:
  - `connected` event
  - `heartbeat` events (every 30s)
  - `new-event` events (when devices change)

**Also check**:
- `/api/devices` - Should be 200 OK
- `/api/rooms` - Should be 200 OK
- Any red (failed) requests

#### 4. Error Collection
For each error found, capture:
- Full error message
- Stack trace (if available)
- Timestamp
- Context (what action triggered it)

---

## Expected vs Actual Behavior

### Expected Behavior (Healthy System)

**Console Output**:
```
[SSE] Connected to device event stream
[SSE] Connection acknowledged: 2025-12-21T23:35:20.029Z
[SSE] Heartbeat received: { timestamp: "...", clients: 1 }
```

**UI Status**:
- Connection badge: "Live" (green) or "Connected" (green)
- No "Reconnecting..." or "Connecting..." messages
- Devices load and display correctly
- Room filter works (shows devices in room)

### Potential Actual Behavior (With Known Bug)

**Console Output**:
```
[SSE] Connected to device event stream
[SSE] Connection acknowledged: 2025-12-21T23:35:20.029Z
[SSE] Heartbeat received: { timestamp: "...", clients: 1 }
... (some warnings about connection state changes)
```

**UI Status**:
- May show "Reconnecting..." briefly on load
- Then switches to "Connected"
- Functionality works despite misleading status

---

## Diagnostic Questions for User

To help narrow down the errors, please provide:

### 1. Error Frequency
- How many errors appear in console?
- Do they repeat continuously or occur once?
- Do new errors appear over time?

### 2. Error Types
- Are they red errors or yellow warnings?
- Do they include stack traces?
- What are the first few words of each error?

### 3. Timing
- Do errors appear on page load?
- Do they appear when clicking/interacting?
- Do they appear periodically (every 30s)?

### 4. Screenshots
Please provide screenshots of:
- Browser console showing all errors
- Network tab filtered to show `/api/events/stream`
- Connection status badge in UI

### 5. Room-Specific Issues
- Does the error only occur with this specific room ID?
- Do errors disappear when navigating to `/devices` (without room filter)?
- Does the room name display correctly in the UI?

---

## Testing Recommendations

### Quick Tests to Run

**Test 1: Remove Room Filter**
Navigate to: `http://localhost:5181/devices` (no room parameter)
- Do errors persist without room filter?
- This isolates room-related vs general SSE errors

**Test 2: Check Network Tab**
- Open Network tab → Filter "stream"
- Look for `/api/events/stream` request
- Status should be "pending" (ongoing connection)
- Click on it → EventStream tab should show events

**Test 3: Wait 60 Seconds**
- Keep console open for 60+ seconds
- Check for heartbeat events every 30 seconds
- Look for "stale connection" warnings

**Test 4: Trigger Device State Change**
- Turn on/off a light via SmartThings app (not the web UI)
- Check console for `[SSE] Device state updated:` log
- Verify UI updates reactively

---

## Remediation Plan

### Immediate Actions

1. **User**: Provide console screenshots and error messages
2. **QA**: Analyze actual errors against predicted patterns
3. **Engineering**: Implement SSE connection status bug fix (line 68 removal)

### Short-term Fixes

**Fix #1: SSE Connection Status Bug**
**File**: `/web/src/lib/sse/deviceStream.svelte.ts`
**Line**: 68
**Change**: Remove `store.setSSEConnected(false);`

```diff
  try {
    eventSource = new EventSource('http://localhost:5182/api/events/stream');
-   store.setSSEConnected(false);  // ❌ Remove this line

    eventSource.onopen = () => {
      console.log('[SSE] Connected to device event stream');
      store.setSSEConnected(true);  // ✅ Only set true on onopen
```

**Fix #2: Add Better Error Context**
Enhance console.error calls with more context:
```javascript
console.error('[SSE] Connection error:', {
  error,
  reconnectAttempts,
  maxAttempts: MAX_RECONNECT_ATTEMPTS,
  backoffMs
});
```

### Long-term Improvements

1. **Browser Console Logging System**
   - Set up `.claude-mpm/logs/client/` directory
   - Implement browser monitoring script injection
   - Automated console capture for QA testing

2. **Enhanced SSE State Management**
   - Add `SSEState` enum (DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING)
   - Better UI feedback for each state
   - More granular error tracking

3. **MCP Browser Extension Setup**
   - Install and configure chrome-devtools-mcp
   - Enable remote console inspection
   - Automated error collection

---

## Related Documentation

**Bug Analysis**:
- `/docs/research/sse-connection-status-bug-analysis-2025-12-21.md` (Comprehensive analysis)

**Implementation Files**:
- `/web/src/lib/sse/deviceStream.svelte.ts` (SSE client)
- `/web/src/lib/stores/deviceStore.svelte.ts` (Device state)
- `/src/routes/events.ts` (Backend SSE endpoint)
- `/web/src/lib/components/layout/ConnectionStatus.svelte` (UI status)

**Testing Guides**:
- `/docs/qa/BROWSER-CONSOLE-INSPECTION-GUIDE.md` (Manual inspection steps)

---

## Next Steps

### For User
1. Open browser DevTools (F12)
2. Navigate to Console tab
3. Screenshot all errors
4. Navigate to Network tab → Filter "stream"
5. Screenshot `/api/events/stream` status
6. Report findings with:
   - Error messages (full text)
   - Screenshots
   - Any patterns observed

### For QA Agent
1. Await user's console screenshots
2. Correlate actual errors with predicted patterns
3. Create detailed bug report if new issues found
4. Verify SSE connection status bug matches analysis

### For Engineering
1. Prioritize SSE connection status bug fix (line 68)
2. Add E2E tests for connection status accuracy
3. Consider implementing browser console logging system
4. Review error handling in SSE event parsers

---

## Conclusion

Based on code analysis, backend health checks, and existing bug documentation, the reported console errors are **most likely** related to the known SSE connection status bug documented on 2025-12-21. The backend systems are healthy and the SSE endpoint is responding correctly.

**Confidence Level**: Medium-High
- Backend confirmed operational
- SSE endpoint confirmed working
- Known bug matches symptom description
- Manual inspection required for confirmation

**Severity**: Low-Medium (UI/UX issue)
- Functionality works correctly
- Events flow properly
- Console warnings may be misleading
- User experience affected by incorrect status display

**Recommendation**: Proceed with manual console inspection to confirm error messages match predicted patterns, then implement SSE connection status bug fix.

---

**Report By**: Web QA Agent (Claude)
**Date**: 2025-12-21
**Investigation Status**: Awaiting manual browser inspection
**Follow-up Required**: User console screenshots
