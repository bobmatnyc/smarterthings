# Port Configuration Guide

## Overview

This application uses **locked port configuration** to ensure consistency across all development sessions:

- **Frontend (Vite/SvelteKit)**: Port `5181`
- **Backend (MCP Server)**: Port `5182`

## Why These Ports?

These ports were chosen to:
1. Avoid conflicts with common development ports (3000, 8080, etc.)
2. Be easy to remember (sequential: 5181, 5182)
3. Be consistent across all environments

## Quick Start

### Recommended: Use the Startup Script

The easiest way to start the development environment with correct ports:

```bash
# Option 1: Use the script directly
./dev-start.sh

# Option 2: Use npm/pnpm script
pnpm start:dev
```

The startup script will:
- ✅ Verify environment configuration
- ✅ Check for port conflicts
- ✅ Start backend on port 5182
- ✅ Start frontend on port 5181
- ✅ Show health status
- ✅ Provide combined log output

### Manual Start (Not Recommended)

If you need to start servers separately:

```bash
# Terminal 1: Backend (port 5182)
pnpm dev

# Terminal 2: Frontend (port 5181)
pnpm dev:web
```

## Port Configuration Files

### Backend Configuration

**File**: `src/config/environment.ts`

```typescript
MCP_SERVER_PORT: z.coerce.number().int().positive().default(5182),
```

**Environment Variable**: `.env.local`

```bash
MCP_SERVER_PORT=5182
TRANSPORT_MODE=http
```

### Frontend Configuration

**File**: `web/vite.config.ts`

```typescript
server: {
  port: 5181,
  proxy: {
    '/api': {
      target: 'http://localhost:5182',
      changeOrigin: true,
    },
    '/auth': {
      target: 'http://localhost:5182',
      changeOrigin: true,
    }
  }
}
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Check what's using the ports
lsof -i :5181
lsof -i :5182

# Kill processes on those ports
lsof -ti :5181 | xargs kill -9
lsof -ti :5182 | xargs kill -9
```

The `dev-start.sh` script handles this automatically with a confirmation prompt.

### Backend Not Starting on 5182

**Cause**: Environment variable not set or being overridden

**Solution**: Verify `.env.local` contains:

```bash
MCP_SERVER_PORT=5182
TRANSPORT_MODE=http
```

### Frontend Proxy Not Working

**Cause**: Backend not running or wrong port configuration

**Verification**:

```bash
# Check backend is running
curl http://localhost:5182/health

# Should return:
# {"status":"healthy","service":"smartthings-mcp","version":"0.7.2"}
```

**Fix**: Ensure `web/vite.config.ts` proxy targets `http://localhost:5182`

### Ports Keep Changing

**Root Cause**: One of the following:

1. Environment variable not set in `.env.local`
2. Cached environment from previous session
3. Multiple instances of servers running

**Solution**:

1. Run the startup script: `./dev-start.sh`
2. OR manually verify:
   - `.env.local` has `MCP_SERVER_PORT=5182`
   - Kill all existing node processes
   - Restart servers

## Configuration Validation

### Check Current Configuration

```bash
# Backend port
grep MCP_SERVER_PORT .env.local

# Frontend port
grep "port:" web/vite.config.ts

# Proxy target
grep "target:" web/vite.config.ts
```

### Expected Output

```bash
# Backend (.env.local)
MCP_SERVER_PORT=5182

# Frontend (web/vite.config.ts)
port: 5181,
target: 'http://localhost:5182',
```

## Development Workflow

### Standard Workflow

```bash
# 1. Start development environment
./dev-start.sh

# 2. Open browser
open http://localhost:5181

# 3. Verify backend
curl http://localhost:5182/health

# 4. Work on code (both servers auto-reload)

# 5. Stop servers
# Press Ctrl+C in terminal running dev-start.sh
```

### Production Build

```bash
# Build both backend and frontend
pnpm build:all

# Preview production build
pnpm preview:web
```

## URLs Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5181 | Main web interface |
| Backend API | http://localhost:5182/api/* | API endpoints |
| Backend Auth | http://localhost:5182/auth/* | OAuth endpoints |
| Backend Health | http://localhost:5182/health | Health check |

## Architecture Diagram

```
┌─────────────────────────────────────┐
│  Browser: http://localhost:5181     │
│  (Vite Dev Server)                  │
└────────────┬────────────────────────┘
             │
             │ Proxy: /api/* → :5182
             │ Proxy: /auth/* → :5182
             │
             ▼
┌─────────────────────────────────────┐
│  Backend: http://localhost:5182     │
│  (Express + MCP Server)             │
│                                     │
│  Routes:                            │
│  - /health                          │
│  - /api/*                           │
│  - /auth/*                          │
└─────────────────────────────────────┘
```

## Security Notes

- **Development Only**: These ports are for local development
- **Production**: Use environment-specific port configuration
- **Firewall**: Ensure ports 5181-5182 are not exposed publicly
- **OAuth Redirect**: Update OAuth callback URLs when deploying

## Maintenance

### Changing Ports (Not Recommended)

If you absolutely must change ports:

1. Update `src/config/environment.ts` default value
2. Update `web/vite.config.ts` server.port
3. Update `web/vite.config.ts` proxy targets
4. Update `.env.local` MCP_SERVER_PORT
5. Update `dev-start.sh` port variables
6. Update this documentation

### Adding New Proxy Routes

To add new backend routes to frontend proxy:

**File**: `web/vite.config.ts`

```typescript
server: {
  port: 5181,
  proxy: {
    '/api': {
      target: 'http://localhost:5182',
      changeOrigin: true,
    },
    '/auth': {
      target: 'http://localhost:5182',
      changeOrigin: true,
    },
    // Add new route here
    '/your-route': {
      target: 'http://localhost:5182',
      changeOrigin: true,
    }
  }
}
```

## Testing

### Verify Port Configuration

```bash
# Start servers
./dev-start.sh

# In another terminal, run tests
curl http://localhost:5182/health
curl http://localhost:5181/api/some-endpoint

# Expected: Both should work without CORS errors
```

### Common Test Scenarios

1. **Fresh Start**: Kill all node processes, run `./dev-start.sh`
2. **Port Conflict**: Start script should detect and offer to kill existing processes
3. **Environment Missing**: Script should detect missing `.env.local`
4. **Backend Health**: Health endpoint should respond immediately
5. **Frontend Proxy**: API calls from frontend should reach backend

## Support

If you continue to experience port configuration issues:

1. Check this document's Troubleshooting section
2. Run `./dev-start.sh` with `-x` flag for debug output: `bash -x dev-start.sh`
3. Review log files: `backend.log` and `frontend.log`
4. Verify no other applications are using ports 5181-5182

## Related Documentation

- [Environment Configuration](.env.example)
- [Backend Configuration](src/config/environment.ts)
- [Frontend Configuration](web/vite.config.ts)
- [OAuth Setup](docs/oauth-setup.md)
