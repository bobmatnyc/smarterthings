# 🔴 CRITICAL: Frontend Non-Functional - Immediate Fix Required

**Date**: 2025-12-05
**Status**: ❌ **CRITICAL** - Application completely broken
**Estimated Fix Time**: 5-10 minutes

---

## Problem

**The wrong backend server is running on port 5182.**

All API endpoints return 404 errors, making the frontend completely non-functional.

---

## Current State

```bash
# What's running
$ ps -p 22244 -o command=
tsx src/index.ts    # ❌ MCP server (wrong)

# What this means
$ curl http://localhost:5182/api/rooms
Cannot GET /api/rooms  # ❌ 404 HTML error

# Frontend sees
"Failed to Load Rooms" error message
No devices, automations, or rules display
```

---

## Required Fix

### Step 1: Stop Current Server

```bash
# Find and kill the process
kill 22244

# OR if you don't know PID
pkill -f "tsx.*src/index.ts"

# Verify it's stopped
lsof -i :5182
# Should return nothing
```

### Step 2: Start Correct Server

```bash
# Start REST API server (Fastify with all endpoints)
pnpm alexa-server:dev

# OR directly with tsx
tsx src/cli/alexa-server.ts
```

### Step 3: Verify Fix

```bash
# Test API endpoint
curl http://localhost:5182/api/rooms

# Should return JSON array like:
# [{"id":"xxx","name":"Living Room"}, ...]

# NOT HTML error page
```

### Step 4: Test Frontend

```bash
# Open in browser
open http://localhost:5181

# Should see:
# ✅ Rooms list loads
# ✅ Devices display
# ✅ No error messages
```

---

## Root Cause

### Issue

Two backend servers exist with overlapping ports:

1. **MCP Server** (`src/index.ts`)
   - Purpose: Model Context Protocol for Claude Desktop
   - Framework: Express
   - Endpoints: `/health`, `/sse`, `/message`, `/api/events/stream`
   - Port: 5182 (configured)

2. **REST API Server** (`src/cli/alexa-server.ts`)
   - Purpose: Frontend API + Alexa integration
   - Framework: Fastify
   - Endpoints: `/api/rooms`, `/api/devices`, `/api/automations`, `/api/rules`, etc.
   - Port: 5182 (configured)

### Configuration Problem

```bash
# .env.local (WRONG - both on same port)
MCP_SERVER_PORT=5182
ALEXA_SERVER_PORT=5182      # ❌ Port conflict
```

### Dev Script Problem

```json
// package.json (WRONG - starts MCP server)
"scripts": {
  "dev": "tsx watch src/index.ts",  // ❌ Starts MCP server
}
```

When developer runs `pnpm dev`, wrong server starts.

---

## Permanent Fix (After Immediate Fix)

### Option 1: Update Port Configuration (Quick)

```bash
# .env.local
MCP_SERVER_PORT=5183        # Move MCP to different port
ALEXA_SERVER_PORT=5182      # REST API stays here (frontend expects 5182)
```

### Option 2: Update Dev Scripts (Better)

```json
// package.json
{
  "scripts": {
    "dev": "tsx src/cli/alexa-server.ts",      // ✅ Start REST API
    "dev:mcp": "tsx watch src/index.ts",        // Rename MCP command
    "start:dev": "bash scripts/dev-start.sh"    // Update to start correct server
  }
}
```

Update `scripts/dev-start.sh`:
```bash
#!/bin/bash
# Start REST API server (not MCP)
tsx src/cli/alexa-server.ts &
BACKEND_PID=$!

pnpm dev:web &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID
```

### Option 3: Merge Servers (Best Long-Term)

Consolidate both servers into single Fastify server with all endpoints.

---

## Verification Checklist

After applying fix, verify:

- [ ] Backend server running: `lsof -i :5182` shows correct process
- [ ] API endpoints work: `curl http://localhost:5182/api/rooms` returns JSON
- [ ] Frontend loads: http://localhost:5181 shows rooms and devices
- [ ] No console errors: Browser dev tools shows no 404 errors
- [ ] SSE works: EventSource connection established (if implemented)

---

## For Developers

### Quick Test Command

```bash
# Test all API endpoints
for endpoint in rooms devices automations rules; do
  echo "Testing /api/$endpoint..."
  curl -s http://localhost:5182/api/$endpoint | head -3
  echo ""
done
```

Expected: JSON responses
If you see HTML `<!DOCTYPE html>` → wrong server running

---

## Documentation Updates Needed

After fix is verified:

1. Update `CLAUDE.md` - clarify which server to run for what purpose
2. Update `README.md` - fix quick start instructions
3. Update `docs/QUICK-START.md` - document server differences
4. Add health check to startup scripts
5. Add warning in logs if wrong server detected

---

## Full Test Report

See: `docs/qa/FRONTEND-UAT-REPORT-2025-12-05.md`

---

**Priority**: 🔴 **CRITICAL**
**Assigned To**: PM / DevOps
**Next Action**: Stop MCP server, start REST API server
