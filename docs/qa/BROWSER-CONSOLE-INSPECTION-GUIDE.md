# Browser Console Error Inspection Guide

**URL Under Investigation**: http://localhost:5181/devices?room=35ebee2a-3993-4eff-acb6-8667ab04a568

**Generated**: 2025-12-21
**Status**: Manual inspection required (chrome-devtools-mcp not configured)

## Quick Inspection Steps

### 1. Open Browser Developer Tools
- **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Navigate to the **Console** tab

### 2. Check for JavaScript Errors
Look for errors in these categories:

#### A. SSE Connection Errors (Most Likely)
Based on code analysis, the SSE (Server-Sent Events) system may be generating errors:

**Expected Error Pattern:**
```
[SSE] Connection error: [error details]
[SSE] Failed to parse [event-type] event: [error]
```

**What to Check:**
- Does the console show `[SSE] Connected to device event stream`?
- Are there repeated reconnection attempts?
- Look for `EventSource` errors or CORS issues

**Backend Status**: ✅ Confirmed working
- Backend SSE endpoint at `http://localhost:5182/api/events/stream` is responding
- Tested with curl, returns `event: connected` successfully

**Likely Issue**: Frontend SSE client error or CORS misconfiguration

#### B. Device Store Errors
```
[DeviceStore] Device [id] not found, skipping SSE update
[DeviceStore] SSE connection error: [error]
```

**What to Check:**
- Are there warnings about missing devices?
- Is the device store initializing correctly?

#### C. Room Navigation Errors
Since the URL includes a room filter parameter, check for:
```
Failed to load room data
Room [id] not found
```

**What to Check:**
- Does room ID `35ebee2a-3993-4eff-acb6-8667ab04a568` exist?
- Are there errors loading room data from the backend?

#### D. API Request Failures
Check the **Network** tab for failed requests:
- `/api/devices` - Should return 200 OK
- `/api/rooms` - Should return 200 OK
- `/api/events/stream` - Should be in "pending" state (long-lived connection)

### 3. Network Tab Inspection

#### Check SSE Connection
1. Open **Network** tab
2. Filter by "EventStream" or search for "stream"
3. Look for `/api/events/stream` request
4. Status should be **"pending"** (ongoing connection)
5. Click on it and check **EventStream** sub-tab for events

**Expected Events:**
- `connected` - Initial connection
- `heartbeat` - Every 30 seconds
- `new-event` - When device state changes

#### Check API Requests
Look for these requests and their status:
- `GET /api/devices` - Should be 200 OK
- `GET /api/rooms` - Should be 200 OK
- Any 4xx or 5xx errors indicate API failures

### 4. Specific Error Categories to Report

When reporting errors, please capture:

#### Error Format:
```
[Timestamp] [Source] Error message
  Stack trace (if available)
```

#### Error Categories:
1. **JavaScript Runtime Errors**
   - `TypeError`, `ReferenceError`, `SyntaxError`
   - Uncaught exceptions
   - Promise rejections

2. **Network Errors**
   - CORS errors (cross-origin issues)
   - Failed fetch requests
   - Timeout errors
   - SSE connection failures

3. **Warnings**
   - Deprecation warnings
   - Performance warnings
   - React/Svelte warnings

4. **Console Logs**
   - Any `console.error()` calls
   - Any `console.warn()` calls

## Expected Console Output (Normal Operation)

If everything is working correctly, you should see:

```
[SSE] Connected to device event stream
[SSE] Connection acknowledged: 2025-12-21T...
[SSE] Heartbeat received: { timestamp: ..., clients: 1 }
```

And potentially some debug logs like:
```
[SSE] Device state updated: { deviceId: ..., state: { ... } }
```

## Common Error Scenarios

### Scenario 1: CORS Error
**Error:**
```
Access to fetch at 'http://localhost:5182/api/events/stream' from origin
'http://localhost:5181' has been blocked by CORS policy
```

**Cause**: CORS misconfiguration on backend
**Solution**: Backend should allow origin `http://localhost:5181`

### Scenario 2: EventSource Connection Failed
**Error:**
```
EventSource's response has a MIME type ("application/json") that is not "text/event-stream"
```

**Cause**: SSE endpoint returning wrong content type
**Solution**: Backend must return `Content-Type: text/event-stream`

### Scenario 3: Repeated Reconnection Attempts
**Error:**
```
[SSE] Connection error: [error]
[SSE] Reconnecting in 1000ms (attempt 1/10)
[SSE] Reconnecting in 2000ms (attempt 2/10)
...
```

**Cause**: Backend SSE endpoint unreachable or returning errors
**Solution**: Check backend server status and logs

### Scenario 4: Device Not Found Warnings
**Warning:**
```
[DeviceStore] Device abc-123 not found, skipping SSE update
```

**Cause**: SSE event references a device that isn't loaded in the store
**Solution**: May indicate stale event data or device sync issue

### Scenario 5: Room Loading Errors
**Error:**
```
Failed to load room data
Room 35ebee2a-3993-4eff-acb6-8667ab04a568 not found
```

**Cause**: Room ID in URL doesn't exist or failed to load
**Solution**: Navigate to `/devices` (without room filter) to verify general functionality

## Code Analysis Summary

### Potential Error Sources Identified:

1. **SSE Client (`web/src/lib/sse/deviceStream.svelte.ts`)**
   - Line 67: Creates EventSource to `http://localhost:5182/api/events/stream`
   - Lines 80-97: Error handler with exponential backoff
   - Lines 106-227: Multiple event listeners that parse JSON (potential parse errors)

2. **Device Store (`web/src/lib/stores/deviceStore.svelte.ts`)**
   - Line 143: `updateDeviceState()` logs warning if device not found
   - SSE connection state tracking

3. **Backend SSE Endpoint (`src/routes/events.ts`)**
   - Lines 280-329: SSE stream implementation
   - ✅ **Verified working** via curl test

4. **Event Stores**
   - `eventsStore.svelte.ts`: Multiple `console.error()` calls for load/connection errors
   - `automationStore.svelte.ts`: Error logging for scene operations
   - `scenesStore.svelte.ts`: Error logging for scene operations
   - `rulesStore.svelte.ts`: Error logging for rule operations

## Next Steps for User

1. **Open Developer Tools** on the browser tab showing the URL
2. **Screenshot the Console** tab showing all errors
3. **Screenshot the Network** tab filtered to show:
   - `/api/events/stream` status
   - Any failed (red) requests
4. **Copy error messages** from console
5. **Report findings** with:
   - Error messages (full text)
   - Screenshots
   - Any error patterns (repeated errors)
   - Network request statuses

## Automated Testing Alternative

If chrome-devtools-mcp is configured in the future:

```bash
# Install chrome-devtools-mcp if not already installed
npm install -g chrome-devtools-mcp

# Configure MCP server in claude desktop
# Then use programmatic inspection
```

Currently, manual inspection is required since the chrome-devtools-mcp integration is not configured in this project's MCP setup.

## Backend Health Check Results

✅ **Backend Server**: Running and healthy
- Port: 5182
- Status: `{"status":"healthy","service":"mcp-smarterthings-alexa","version":"0.7.2"}`
- SmartThings: Connected and ready

✅ **SSE Endpoint**: Responding correctly
- URL: `http://localhost:5182/api/events/stream`
- Test Result: Returns `event: connected` successfully
- Content-Type: Correctly set to `text/event-stream`

✅ **Frontend Server**: Running
- Port: 5181
- Vite dev server: Active (PID 81238)

**Conclusion**: Backend is functioning correctly. Issues are likely in:
1. Frontend SSE client error handling
2. CORS configuration (unlikely, since same-origin)
3. Device/room data loading errors
4. JavaScript runtime errors in Svelte components
