# Frontend UAT Test Report - December 5, 2025

**Test Date**: 2025-12-05
**Test Duration**: ~30 minutes
**Frontend URL**: http://localhost:5181
**Backend URL**: http://localhost:5182
**Tester**: Web QA Agent
**Test Type**: UAT (User Acceptance Testing) + Technical Validation

---

## Executive Summary

### ❌ CRITICAL ISSUE IDENTIFIED

**The wrong backend server is running on port 5182.**

- **Current State**: MCP server (Express with SSE) is running
- **Expected State**: REST API server (Fastify with full API routes) should be running
- **Impact**: Frontend cannot load data - all API endpoints return 404 errors
- **User Impact**: Application appears broken - rooms, devices, automations, rules cannot be displayed

### Test Results Overview

| Test Phase | Status | Critical Issues | Warnings |
|------------|--------|----------------|----------|
| Backend Server Verification | ✅ PASS | 0 | 1 |
| API Endpoint Validation | ❌ FAIL | 4 | 0 |
| Routes Testing | ❌ FAIL | 4 | 0 |
| Frontend Page Load | ⚠️ PARTIAL | 1 | 0 |
| Component Rendering | ⚠️ PARTIAL | 2 | 0 |
| SSE Connection | ❌ FAIL | 1 | 0 |

**Overall Status**: ❌ **FAILED** - Critical backend configuration issue

---

## Phase 1: API Endpoint Validation

### Test Results

**Endpoint**: `GET /api/rooms`
**Status**: ❌ 404 Not Found
**Response**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/rooms</pre>
</body>
</html>
```

**Endpoint**: `GET /api/devices`
**Status**: ❌ 404 Not Found
**Response**: Same HTML error page

**Endpoint**: `GET /api/automations`
**Status**: ❌ 404 Not Found
**Response**: Same HTML error page

**Endpoint**: `GET /api/rules`
**Status**: ❌ 404 Not Found
**Response**: Same HTML error page

### Root Cause Analysis

**Current Running Server**:
- Process: `tsx src/index.ts` (PID 22244)
- Framework: Express
- Transport: MCP with SSE
- Available endpoints:
  - ✅ `/health` - Health check (working)
  - ✅ `/sse` - MCP protocol endpoint
  - ✅ `/message` - MCP message endpoint
  - ✅ `/api/events/stream` - Device events SSE endpoint
  - ❌ `/api/rooms` - **Missing**
  - ❌ `/api/devices` - **Missing**
  - ❌ `/api/automations` - **Missing**
  - ❌ `/api/rules` - **Missing**

**Expected Running Server**:
- Script: `src/server-alexa.ts` or equivalent REST API server
- Framework: Fastify
- Purpose: REST API + Alexa endpoints
- Required endpoints:
  - ✅ All MCP endpoints (OAuth, Webhook, Events)
  - ✅ `/api/rooms` (line 653 in server-alexa.ts)
  - ✅ `/api/devices` (line 354 in server-alexa.ts)
  - ✅ `/api/automations` (line 735 in server-alexa.ts)
  - ✅ `/api/rules` (line 835 in server-alexa.ts)

### Framework Mismatch

**Route Files** (`src/routes/`):
- `events.ts` - Uses Fastify types
- `oauth.ts` - Uses Fastify types
- `webhook.ts` - Uses Fastify types

**Current HTTP Transport** (`src/transport/http.ts`):
- Uses Express framework
- Only registers MCP and SSE endpoints
- Does NOT import or register route files

**Conclusion**: Route files were designed for Fastify but HTTP transport uses Express. Routes are never registered.

---

## Phase 2: Routes Testing

### Frontend Behavior

**Test Method**: Playwright browser automation
**URL**: http://localhost:5181

**Network Requests Captured**:
- Total requests: 98
- API requests: 3
- Failed requests: 1

**API Requests Observed**:
```
GET http://localhost:5181/src/lib/api/chat.ts - Status: 200
GET http://localhost:5181/src/lib/api/client.ts - Status: 200
GET http://localhost:5181/api/rooms - Status: 404
```

**Failed Request Details**:
```
URL: http://localhost:5181/api/rooms
Status: 404
Method: GET
Error: Cannot GET /api/rooms (HTML error page)
```

### Frontend Proxy Behavior

The frontend (Vite dev server on port 5181) proxies `/api/*` requests to the backend on port 5182. However, the backend doesn't have these routes, resulting in 404 errors.

**Expected Flow**:
```
Frontend (5181) → Vite Proxy → Backend (5182) → Fastify REST API → Data
```

**Actual Flow**:
```
Frontend (5181) → Vite Proxy → Backend (5182) → Express MCP Server → 404
```

---

## Phase 3: Frontend Page Load

### Test Results

**URL**: http://localhost:5181
**HTTP Status**: 200 OK
**Page Title**: "Rooms - Smarter Things"
**Load Time**: < 2 seconds
**HTML Delivery**: ✅ Success

### Console Errors

**Total Console Messages**: 5
**Console Errors**: 1
**Console Warnings**: 0

**Error Details**:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
```

### Component Rendering

**Navigation Elements**: 1 (✅ present)
**Main Content Elements**: 1 (✅ present)
**Buttons**: 4
**Links**: 8
**Loading Indicators**: 0
**Error Messages Visible**: 2 (⚠️ API failure messages)

### UI State

The page loads successfully but displays error messages where data should appear. This is expected behavior given the API failures.

---

## Phase 4: SSE Connection Verification

### Test Results

**SSE Connection Attempts**: 0
**EventSource Logs**: None detected

### Analysis

No SSE connection to `/api/events/stream` was observed during testing. This suggests:

1. Frontend may not be attempting SSE connection yet
2. SSE connection may be conditional on successful initial data load
3. SSE connection may be implemented but not activated during test period

**Note**: The backend DOES provide `/api/events/stream` endpoint (confirmed in http.ts line 45), so if the frontend attempts connection, it should work.

---

## Phase 5: Business Requirements Validation

### Business Intent: Smart Home Dashboard

**Goal**: Display smart home devices, rooms, automations, and rules in a user-friendly interface.

**Current Status**: ❌ **Failed to meet business requirements**

### User Journey Analysis

**Journey**: New user opens application for first time

**Expected Experience**:
1. ✅ Page loads quickly
2. ✅ Navigation is visible
3. ❌ Rooms list displays (currently shows error)
4. ❌ Can browse devices by room
5. ❌ Can view automations and rules
6. ❌ Can control devices

**Actual Experience**:
1. ✅ Page loads quickly
2. ✅ Navigation is visible
3. ❌ "Failed to Load Rooms" error message
4. ❌ No data displayed
5. ❌ Application appears broken
6. ❌ No functionality available

### User Value Assessment

**Value Delivery**: ❌ **None** - Application is non-functional
**User Experience**: 2/10 - Technical error, not user error
**Business Impact**: **Critical** - Application cannot be used

---

## Detailed Findings

### Issue 1: Missing REST API Server

**Severity**: 🔴 **CRITICAL**
**Category**: Configuration / Deployment
**Affects**: All API-dependent features (100% of application)

**Description**:
The MCP server (`src/index.ts`) is running instead of the REST API server (`src/server-alexa.ts`). This means all REST API endpoints are unavailable.

**Evidence**:
```bash
# Process running on port 5182
PID 22244: tsx src/index.ts

# Endpoint verification
curl http://localhost:5182/api/rooms
# Result: Cannot GET /api/rooms (404 HTML error)

curl http://localhost:5182/health
# Result: {"status":"healthy","service":"smartthings-mcp","version":"0.7.2"}
# (Confirms MCP server is running)
```

**Impact**:
- All frontend data loading fails
- No devices, rooms, automations, or rules can be displayed
- Application is completely non-functional for end users
- Only health check endpoint works

**Recommendation**: Start the correct server (`src/server-alexa.ts`) instead of MCP server

---

### Issue 2: Server Mode Confusion

**Severity**: 🟡 **MEDIUM**
**Category**: Architecture / Documentation
**Affects**: Developer operations, deployment

**Description**:
There are two separate servers with overlapping responsibilities:

1. **MCP Server** (`src/index.ts`):
   - Transport: Express with SSE
   - Purpose: Model Context Protocol integration
   - Endpoints: `/health`, `/sse`, `/message`, `/api/events/stream`
   - Port: 5182 (configurable via MCP_SERVER_PORT)

2. **Alexa/REST API Server** (`src/server-alexa.ts`):
   - Transport: Fastify
   - Purpose: Alexa integration + REST API for frontend
   - Endpoints: Alexa handlers + ALL REST API routes + OAuth + Webhook + Events
   - Port: 3000 default (configurable via ALEXA_SERVER_PORT)

**Evidence**:
```bash
# .env.local configuration
MCP_SERVER_PORT=5182
ALEXA_SERVER_PORT=5182
TRANSPORT_MODE=http
```

Both servers are configured for the same port (5182), which is incorrect.

**Impact**:
- Confusion about which server to run
- Both servers cannot run simultaneously on same port
- `pnpm dev` command starts wrong server
- Deployment complexity

**Recommendations**:
1. **Immediate**: Set different ports for each server OR
2. **Long-term**: Merge servers into single Fastify server with all endpoints OR
3. **Long-term**: Document clear separation and update dev scripts

---

### Issue 3: Framework Inconsistency

**Severity**: 🟡 **MEDIUM**
**Category**: Architecture
**Affects**: Maintenance, extensibility

**Description**:
Route files in `src/routes/` are designed for Fastify, but the MCP HTTP transport (`src/transport/http.ts`) uses Express.

**Evidence**:
```typescript
// src/routes/events.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// src/transport/http.ts
import express from 'express';
const app = express();
// Routes are never imported or registered
```

**Impact**:
- Routes cannot be registered with Express server
- New route development must choose framework
- Code duplication between servers
- Maintenance burden

**Recommendation**: Standardize on single framework (Fastify preferred based on existing routes)

---

### Issue 4: Development Workflow Gap

**Severity**: 🟡 **MEDIUM**
**Category**: Developer Experience
**Affects**: Development productivity

**Description**:
The `pnpm dev` and `pnpm start:dev` commands start the MCP server, but frontend development requires the REST API server.

**Evidence**:
```json
// package.json
"scripts": {
  "dev": "tsx watch src/index.ts",  // ← Starts MCP server
  "alexa-server:dev": "tsx src/cli/alexa-server.ts",  // ← Starts REST API server
}
```

**Impact**:
- Developers follow documentation and run `pnpm dev`
- Frontend doesn't work because wrong server is running
- Confusion and wasted debugging time
- Poor first-run experience

**Recommendation**: Update dev scripts to start correct server for frontend development

---

## Recommendations

### Immediate Actions (Required to Fix)

#### 1. Start Correct Server ⚡ **URGENT**

**Problem**: MCP server running instead of REST API server

**Solution**:
```bash
# Stop current server (Ctrl+C or kill PID 22244)
kill 22244

# Start REST API server
pnpm alexa-server:dev
# OR
tsx src/cli/alexa-server.ts
```

**Verification**:
```bash
curl http://localhost:5182/api/rooms
# Should return JSON array of rooms, not HTML error
```

#### 2. Update Port Configuration

**Problem**: Both servers configured for same port

**Solution** (Choose ONE):

**Option A**: Different ports (Quick fix)
```bash
# .env.local
MCP_SERVER_PORT=5183        # MCP on 5183
ALEXA_SERVER_PORT=5182      # REST API stays on 5182 (frontend expects this)
TRANSPORT_MODE=http
```

**Option B**: Single server (Better long-term)
- Merge MCP endpoints into Fastify server
- Remove separate MCP HTTP transport
- Document in architecture docs

#### 3. Update Development Scripts

**Problem**: `pnpm dev` starts wrong server

**Solution**:
```json
// package.json
{
  "scripts": {
    "dev": "tsx src/cli/alexa-server.ts",  // Start REST API server
    "dev:mcp": "tsx watch src/index.ts",    // Rename MCP server command
    "dev:web": "pnpm --filter web dev",
    "start:dev": "bash scripts/dev-start.sh"  // Update script to start alexa-server
  }
}
```

Update `scripts/dev-start.sh`:
```bash
#!/bin/bash
# Start REST API server (not MCP server)
tsx src/cli/alexa-server.ts &
BACKEND_PID=$!

# Start frontend
pnpm dev:web &
FRONTEND_PID=$!

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
```

### Medium-Term Actions (Recommended)

#### 4. Consolidate Server Architecture

**Current State**: Two servers with overlapping functionality

**Recommended State**: Single Fastify server

**Benefits**:
- Simplified deployment
- Reduced configuration complexity
- Single framework (Fastify)
- Easier to maintain

**Migration Path**:
1. Move MCP SSE endpoints to Fastify server
2. Ensure all routes are Fastify-compatible
3. Update documentation
4. Deprecate Express HTTP transport
5. Update startup scripts

#### 5. Improve Documentation

**Add to CLAUDE.md**:
```markdown
## Running the Application

### Full Stack Development

bash
pnpm start:dev  # Starts both REST API server (5182) and frontend (5181)


### Backend Only (REST API)

bash
pnpm dev  # Starts Fastify server with all API endpoints


### MCP Server Only (for Claude Desktop integration)

bash
pnpm dev:mcp  # Starts MCP server with stdio or SSE transport


### Frontend Only

bash
pnpm dev:web  # Starts Vite dev server (requires backend running separately)


## Servers

This project has two backend servers:

1. REST API Server (src/cli/alexa-server.ts):
   - Port: 5182
   - Framework: Fastify
   - Purpose: Frontend API, Alexa endpoints, OAuth, Webhooks
   - Required for: Web UI functionality

2. MCP Server (src/index.ts):
   - Port: 5183 (or stdio mode)
   - Framework: Express (SSE) or stdio
   - Purpose: Model Context Protocol integration
   - Required for: Claude Desktop integration
```

#### 6. Add Health Check to Frontend

**Current**: Frontend silently fails when backend is wrong

**Recommended**: Add startup health check

```typescript
// web/src/lib/api/client.ts
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();

    // Check if this is the correct server
    if (!data.hasRestApi) {
      console.error('Wrong backend server detected. Please start REST API server.');
      console.error('Run: pnpm alexa-server:dev');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}
```

#### 7. Add Visual Error State

**Current**: Generic error messages

**Recommended**: Specific configuration error UI

When `/api/rooms` returns HTML instead of JSON, show:

```
⚠️ Backend Configuration Error

The backend server is not configured correctly.
Please ensure the REST API server is running.

For developers:
Run: pnpm alexa-server:dev

For users:
Please contact support with error code: BACKEND_WRONG_SERVER
```

### Testing Recommendations

#### Automated Health Checks

Add pre-flight checks to test suite:

```typescript
// tests/setup/backend-check.ts
export async function verifyBackendServer() {
  const response = await fetch('http://localhost:5182/api/rooms');

  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Backend server is running in MCP mode. Start REST API server with: pnpm alexa-server:dev');
  }

  if (response.status === 404) {
    throw new Error('REST API endpoints not available. Wrong server running.');
  }
}
```

#### CI/CD Checks

Add to deployment pipeline:

```yaml
# .github/workflows/test.yml
- name: Verify Backend Server
  run: |
    pnpm alexa-server:dev &
    sleep 5
    curl -f http://localhost:5182/api/rooms || exit 1
```

---

## Test Evidence

### API Endpoint Tests

```bash
# Health endpoint (works)
$ curl http://localhost:5182/health
{"status":"healthy","service":"smartthings-mcp","version":"0.7.2"}

# Rooms endpoint (fails)
$ curl http://localhost:5182/api/rooms
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/rooms</pre>
</body>
</html>

# Devices endpoint (fails)
$ curl http://localhost:5182/api/devices
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/devices</pre>
</body>
</html>
```

### Process Verification

```bash
# Server running on port 5182
$ lsof -i :5182
COMMAND   PID USER   FD   TYPE   NODE NAME
node    22244 masa   29u  IPv6   TCP *:5182 (LISTEN)

# Process details
$ ps -p 22244 -o command=
/opt/homebrew/bin/node tsx src/index.ts

# Confirms MCP server is running, not REST API server
```

### Playwright Test Results

```
=== TEST 1: PAGE LOAD VERIFICATION ===
Page title: Rooms - Smarter Things
Console errors: 1
Errors: ['Failed to load resource: the server responded with a status of 404 (Not Found)']

=== TEST 2: API INTEGRATION TESTING ===
Total network requests: 98
API requests: 3
Failed requests: 1

API Requests:
  GET http://localhost:5181/src/lib/api/chat.ts - Status: 200
  GET http://localhost:5181/src/lib/api/client.ts - Status: 200
  GET http://localhost:5181/api/rooms - Status: 404

Failed Requests:
  http://localhost:5181/api/rooms - Status: 404
  Error: Cannot GET /api/rooms (HTML error page)

=== TEST 3: COMPONENT RENDERING ===
Navigation elements: 1
Main content elements: 1
Buttons: 4
Links: 8
Loading indicators: 0
Error messages visible: 2

=== TEST 4: SSE CONNECTION VERIFICATION ===
SSE connection attempts: 0

=== TEST 5: CONSOLE LOGS ANALYSIS ===
Total console messages: 5
Errors: 1
Warnings: 0

=== CONSOLE ERRORS ===
1. Failed to load resource: the server responded with a status of 404 (Not Found)
```

---

## Summary

### Critical Issue

**The application is completely non-functional because the wrong backend server is running.**

- **Root Cause**: `pnpm dev` starts MCP server (`src/index.ts`) instead of REST API server (`src/server-alexa.ts`)
- **Impact**: All API endpoints return 404, frontend cannot load any data
- **Fix**: Start `src/cli/alexa-server.ts` on port 5182 instead of `src/index.ts`

### Test Coverage

✅ **Completed**:
- Phase 1: API endpoint validation
- Phase 2: Routes testing with fetch API
- Phase 5: Playwright comprehensive testing
- Business requirements validation
- Console logs analysis

⏭️ **Skipped** (due to critical blocker):
- Phase 3: Links2 HTML structure validation (not valuable when API broken)
- Phase 4: Safari browser testing (not valuable when API broken)

### Next Steps

1. ⚡ **URGENT**: Start correct server (`pnpm alexa-server:dev`)
2. ⚡ **URGENT**: Verify API endpoints return JSON
3. ⚡ **URGENT**: Re-test frontend functionality
4. Update port configuration to avoid conflicts
5. Update development scripts
6. Add backend health checks
7. Update documentation

### User Impact

**Current State**: Application appears completely broken to users
**With Fix Applied**: Application should work correctly
**Estimated Fix Time**: 5-10 minutes (configuration change)

---

## Appendix: Configuration Files

### Current .env.local
```bash
MCP_SERVER_PORT=5182
ALEXA_SERVER_PORT=5182      # ❌ Conflict
TRANSPORT_MODE=http
```

### Recommended .env.local
```bash
MCP_SERVER_PORT=5183        # MCP on different port
ALEXA_SERVER_PORT=5182      # REST API (required by frontend)
TRANSPORT_MODE=http
```

### Server File Locations

- **MCP Server**: `src/index.ts` (Express)
- **REST API Server**: `src/server-alexa.ts` (Fastify)
- **CLI Entry Point**: `src/cli/alexa-server.ts`
- **Route Files**: `src/routes/*.ts` (Fastify)
- **HTTP Transport**: `src/transport/http.ts` (Express)

---

**Report Generated**: 2025-12-05 12:45 PST
**QA Agent**: Web QA Agent v1.0
**Test Framework**: Playwright + Manual API Testing
**Total Test Duration**: ~30 minutes
