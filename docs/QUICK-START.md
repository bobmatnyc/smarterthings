# Quick Start Guide

## Start Development Environment

```bash
# Recommended: Use the startup script
./dev-start.sh

# Or use pnpm
pnpm start:dev
```

## Access Points

- **Frontend**: http://localhost:5181
- **Backend API**: http://localhost:5182/api
- **Backend Health**: http://localhost:5182/health

## Port Configuration (LOCKED)

| Service  | Port | Configuration File |
|----------|------|--------------------|
| Frontend | 5181 | `web/vite.config.ts` |
| Backend  | 5182 | `.env.local` |

## Common Tasks

### View Logs

```bash
# Backend logs
tail -f backend.log

# Frontend logs
tail -f frontend.log

# Both together
tail -f backend.log -f frontend.log
```

### Stop Servers

Press `Ctrl+C` in the terminal running `dev-start.sh`

### Check What's Running

```bash
# Check backend (should show process on port 5182)
lsof -i :5182

# Check frontend (should show process on port 5181)
lsof -i :5181
```

### Kill Hung Processes

```bash
# Kill backend
lsof -ti :5182 | xargs kill -9

# Kill frontend
lsof -ti :5181 | xargs kill -9
```

### Build for Production

```bash
# Build both backend and frontend
pnpm build:all

# Preview frontend build
pnpm preview:web
```

## Troubleshooting

**Problem**: Ports already in use
**Solution**: Run `./dev-start.sh` - it will offer to kill existing processes

**Problem**: Backend won't start on port 5182
**Solution**: Check `.env.local` has `MCP_SERVER_PORT=5182`

**Problem**: Frontend proxy not working
**Solution**: Verify backend is running: `curl http://localhost:5182/health`

## Need More Help?

See [PORT-CONFIGURATION.md](PORT-CONFIGURATION.md) for complete documentation.
