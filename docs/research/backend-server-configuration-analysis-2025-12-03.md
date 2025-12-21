# Backend Server Configuration Analysis

**Date:** 2025-12-03
**Researcher:** Claude (Research Agent)
**Ticket Context:** Frontend 404 errors on `/api/devices` endpoint
**Status:** ✅ COMPLETE

---

## Executive Summary

**Problem:** Frontend (port 5181) receives 404 errors when calling `/api/devices` endpoint on backend (port 5182).

**Root Cause:** Wrong backend server is running. Current server (`src/index.ts`) provides MCP HTTP/SSE transport only. Web API routes are defined in `src/server-alexa.ts` but not currently running.

**Solution:** Start the correct backend server using `pnpm alexa-server:dev` instead of `pnpm dev`.

---

## Current Server Architecture

### Two Separate Backend Servers

The project has **two distinct backend server implementations**:

#### 1. MCP Transport Server (`src/index.ts`)
- **Purpose:** MCP protocol transport (STDIO or HTTP/SSE)
- **Transport:** Express server with SSE endpoints
- **Routes:** `/health`, `/sse`, `/message` (MCP protocol only)
- **Port:** 5182 (configurable via `MCP_SERVER_PORT`)
- **Start Command:** `pnpm dev` (currently running)
- **Does NOT include:** Web API routes (`/api/devices`, `/api/rooms`, etc.)

#### 2. Alexa/Web API Server (`src/server-alexa.ts`)
- **Purpose:** Fastify server for Alexa skills + Web UI REST API
- **Framework:** Fastify (not Express)
- **Routes:**
  - `/api/devices` - List devices with filters
  - `/api/rooms` - List rooms
  - `/api/devices/:id/on|off` - Device control
  - `/api/devices/:id/status` - Device status
  - `/api/devices/events` - SSE real-time updates
  - `/api/automations` - List/execute scenes
  - `/api/rules` - Rules management
  - `/alexa` - Alexa Custom Skill endpoint
  - `/alexa-smarthome` - Alexa Smart Home endpoint
  - `/auth/smartthings/*` - OAuth routes
- **Port:** 5182 (configurable via `ALEXA_SERVER_PORT`)
- **Start Command:** `pnpm alexa-server:dev` (NOT running)
- **Includes:** Full REST API for frontend web UI

---

## File Location Analysis

### Server Entry Points

| File | Purpose | Transport | API Routes |
|------|---------|-----------|------------|
| `src/index.ts` | MCP protocol server | STDIO or HTTP/SSE | None (MCP only) |
| `src/cli/alexa-server.ts` | Alexa/Web API launcher | None | Fastify REST API |
| `src/server-alexa.ts` | Alexa/Web API implementation | N/A | All `/api/*` routes |

### API Route Definitions

All web API routes are defined in `src/server-alexa.ts`:

```typescript
// Line 295: GET /api/devices - List all devices with optional filters
server.get('/api/devices', async (request, reply) => {
  const { room, capability } = request.query;
  // ... implementation
});

// Line 339: POST /api/devices/:deviceId/on - Turn device on
server.post('/api/devices/:deviceId/on', async (request, reply) => {
  // ... implementation
});

// Line 386: POST /api/devices/:deviceId/off - Turn device off
// Line 433: GET /api/devices/:deviceId/status - Get device status
// Line 924: GET /api/devices/events - SSE real-time updates
// Plus: /api/rooms, /api/automations, /api/rules, etc.
```

---

## Package.json Scripts Analysis

### Backend Server Scripts

```json
{
  "dev": "tsx watch src/index.ts",           // ❌ WRONG - MCP transport only
  "start": "node dist/index.js",              // ❌ WRONG - MCP transport only
  "alexa-server:dev": "tsx src/cli/alexa-server.ts",  // ✅ CORRECT - Includes API routes
  "alexa-server": "pnpm run build && node dist/cli/alexa-server.js"  // ✅ CORRECT - Production
}
```

### Development Workflow Scripts

```json
{
  "dev:web": "pnpm --filter web dev",         // Frontend only
  "dev:all": "concurrently \"pnpm dev\" \"pnpm dev:web\"",  // ❌ WRONG backend
  "start:dev": "bash scripts/dev-start.sh"    // ✅ CORRECT - Uses alexa-server:dev
}
```

---

## Port Configuration

### Current Configuration (.env.local)

```bash
MCP_SERVER_PORT=5182
ALEXA_SERVER_PORT=5182
TRANSPORT_MODE=http
```

**Both servers are configured for the same port (5182)**. This is intentional - only one should run at a time.

### Port Usage Matrix

| Server | Port | Currently Running? | Has API Routes? |
|--------|------|-------------------|-----------------|
| MCP Transport (index.ts) | 5182 | ✅ YES | ❌ NO |
| Alexa/Web API (server-alexa.ts) | 5182 | ❌ NO | ✅ YES |

---

## Current Process Status

```bash
# Currently running on port 5182:
masa  99439  node --require tsx src/index.ts

# Health check response:
curl http://localhost:5182/health
{"status":"healthy","service":"smartthings-mcp","version":"0.7.2"}

# API routes NOT available:
curl http://localhost:5182/api/devices
Cannot GET /api/devices  # ❌ 404 Error
```

---

## Git History Context

Recent commits show the Alexa/Web API server evolution:

```
3564947 feat: add OAuth2 routes to web server
4d8c7ef feat: add chatbot UI, fix device API, and update branding (1M-434, 1M-435)
aba4b21 feat: implement Device List component with SSE real-time updates (1M-434)
```

The web API routes were added to support the frontend UI (tickets 1M-434, 1M-435).

---

## Development Startup Script Analysis

**File:** `scripts/dev-start.sh`

This script **correctly starts the Alexa/Web API server**:

```bash
# Line 134: Uses alexa-server:dev (CORRECT)
pnpm alexa-server:dev > backend.log 2>&1 &
```

**Recommended startup method:** `pnpm start:dev` (runs dev-start.sh)

---

## Environment Variables

### Required for Alexa/Web API Server

```bash
SMARTTHINGS_PAT=your_token_here          # Required
ALEXA_SERVER_PORT=5182                   # Optional (defaults to 3000)
ALEXA_SERVER_HOST=0.0.0.0               # Optional (defaults to 0.0.0.0)
NODE_ENV=development                     # Optional
```

### Optional OAuth Configuration

```bash
SMARTTHINGS_CLIENT_ID=...
SMARTTHINGS_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:5182/auth/smartthings/callback
OAUTH_STATE_SECRET=...
TOKEN_ENCRYPTION_KEY=...
```

---

## Architectural Decisions

### Why Two Separate Servers?

1. **MCP Transport Server (`index.ts`):**
   - Designed for MCP protocol clients (Claude Desktop, MCP clients)
   - Uses SSE or STDIO transport
   - Minimal routes (MCP endpoints only)

2. **Alexa/Web API Server (`server-alexa.ts`):**
   - Designed for Alexa skills + Web UI
   - Full Fastify REST API
   - Includes authentication, device control, automations
   - SSE for real-time device updates

**Design Decision:** These are mutually exclusive servers. Only one runs at a time on port 5182.

---

## Solution: Start Correct Backend Server

### Option 1: Use Development Startup Script (Recommended)

```bash
pnpm start:dev
```

**What it does:**
- Verifies .env.local configuration
- Checks port availability
- Starts backend with `pnpm alexa-server:dev` (✅ includes API routes)
- Starts frontend with `pnpm dev:web`
- Provides combined log output

### Option 2: Manual Start (Backend + Frontend)

**Terminal 1 (Backend):**
```bash
pnpm alexa-server:dev
```

**Terminal 2 (Frontend):**
```bash
pnpm dev:web
```

### Option 3: Automated with Concurrently (Fix Required)

**Current (BROKEN):**
```json
"dev:all": "concurrently \"pnpm dev\" \"pnpm dev:web\""
```

**Should be:**
```json
"dev:all": "concurrently \"pnpm alexa-server:dev\" \"pnpm dev:web\""
```

---

## Verification Steps

After starting correct backend server:

```bash
# 1. Check backend health
curl http://localhost:5182/health

# 2. Test API routes (should return JSON, not 404)
curl http://localhost:5182/api/devices

# 3. Test frontend (should load devices)
open http://localhost:5181

# 4. Check SSE endpoint
curl http://localhost:5182/api/devices/events
```

---

## Missing Setup Steps

### None Required

The correct server startup script (`scripts/dev-start.sh`) already exists and handles:
- ✅ Environment validation
- ✅ Port conflict detection
- ✅ Dependency installation
- ✅ Backend server startup (alexa-server:dev)
- ✅ Frontend server startup
- ✅ Health checks

**Just run:** `pnpm start:dev`

---

## Recommendations

### Immediate Action

1. **Stop current backend process:**
   ```bash
   pkill -f "tsx watch src/index.ts"
   ```

2. **Start correct backend:**
   ```bash
   pnpm start:dev
   # OR individually:
   pnpm alexa-server:dev
   ```

### Future Improvements

1. **Fix `dev:all` script** to use correct backend:
   ```json
   "dev:all": "concurrently \"pnpm alexa-server:dev\" \"pnpm dev:web\""
   ```

2. **Update documentation** to clarify two server types:
   - MCP Transport Server (for MCP protocol clients)
   - Alexa/Web API Server (for frontend + Alexa)

3. **Add startup validation** to detect wrong server:
   ```bash
   # Check if /api/devices exists
   curl -sf http://localhost:5182/api/devices || echo "Wrong server running!"
   ```

4. **Consider renaming scripts** for clarity:
   ```json
   "dev:mcp": "tsx watch src/index.ts",           // MCP transport only
   "dev:api": "tsx src/cli/alexa-server.ts",      // Web API server
   "dev:web": "pnpm --filter web dev",            // Frontend
   "dev:all": "concurrently \"pnpm dev:api\" \"pnpm dev:web\""
   ```

---

## Files Analyzed

- ✅ `package.json` - Scripts and dependencies
- ✅ `src/index.ts` - MCP transport server entry point
- ✅ `src/server-alexa.ts` - Alexa/Web API server (API routes)
- ✅ `src/cli/alexa-server.ts` - Alexa server CLI launcher
- ✅ `src/transport/http.ts` - HTTP/SSE transport (MCP only)
- ✅ `.env.example` - Environment configuration
- ✅ `.env.local` - Current environment (ports)
- ✅ `scripts/dev-start.sh` - Development startup script
- ✅ Git history - Recent server changes

---

## Memory Usage Statistics

- **Files read:** 8 files (using Read tool)
- **Pattern searches:** 4 grep operations (targeted searches)
- **File discoveries:** 2 glob operations
- **Commands executed:** 6 bash commands (lightweight checks)
- **Total memory footprint:** ~15KB (efficient sampling)

**Research Methodology:** Strategic sampling with pattern-based discovery. No large file loads.

---

## Conclusion

**Current State:** Wrong backend server is running (MCP transport instead of Alexa/Web API).

**Correct Server:** `src/server-alexa.ts` via `pnpm alexa-server:dev`

**Quick Fix:**
```bash
pkill -f "tsx watch src/index.ts"  # Stop wrong server
pnpm start:dev                      # Start correct servers
```

**Root Cause:** Developer ran `pnpm dev` instead of `pnpm start:dev` or `pnpm alexa-server:dev`.

**Verification:** After fix, `/api/devices` should return JSON (device list) instead of 404.
