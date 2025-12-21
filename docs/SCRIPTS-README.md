# Development Scripts Guide

This directory contains utility scripts for managing the development environment.

## 🚀 Startup Scripts

### `dev-start.sh` - Full Development Environment

**Purpose**: Start both backend and frontend servers with proper configuration and health checking.

**Usage**:
```bash
./dev-start.sh
# OR
pnpm start:dev
```

**Features**:
- ✅ Validates `.env.local` exists and has correct port configuration
- ✅ Detects port conflicts and offers to kill existing processes
- ✅ Starts backend on port 5182 with health check verification
- ✅ Starts frontend on port 5181 with readiness check
- ✅ Shows combined logs from both servers
- ✅ Graceful shutdown with Ctrl+C
- ✅ Colorized output for better readability

**Output Files**:
- `backend.log` - Backend server logs
- `frontend.log` - Frontend server logs

**Environment Variables**:
- Reads from `.env.local`
- Validates `MCP_SERVER_PORT=5182`
- Validates `TRANSPORT_MODE=http`

**Exit Codes**:
- `0` - Success (normal shutdown via Ctrl+C)
- `1` - Configuration error or startup failure

**Example Session**:
```bash
$ ./dev-start.sh

╔══════════════════════════════════════════════════════════════╗
║  SmartThings MCP Development Environment                    ║
╚══════════════════════════════════════════════════════════════╝

1. Checking environment...
✓ Environment file verified

2. Checking ports...
✓ Port 5182 available
✓ Port 5181 available

3. Installing dependencies...
✓ Dependencies already installed

4. Starting servers...

Starting Backend Server on port 5182...
  URL: http://localhost:5182
  Health Check: http://localhost:5182/health

Waiting for backend to start.........
✓ Backend server started successfully

Starting Frontend Server on port 5181...
  URL: http://localhost:5181

Waiting for frontend to start........
✓ Frontend server started successfully

╔══════════════════════════════════════════════════════════════╗
║  🚀 Development Environment Ready!                           ║
╚══════════════════════════════════════════════════════════════╝

Backend (MCP Server):  http://localhost:5182
Frontend (Web UI):     http://localhost:5181

Logs:
  Backend:  tail -f backend.log
  Frontend: tail -f frontend.log

Press Ctrl+C to stop both servers

[Combined log output follows...]
```

---

## ✅ Validation Scripts

### `check-ports.sh` - Configuration Validator

**Purpose**: Verify all port configurations are correct and consistent across all configuration files.

**Usage**:
```bash
./check-ports.sh
```

**Checks Performed**:
1. **`.env.local` validation**:
   - `MCP_SERVER_PORT=5182` is set
   - `TRANSPORT_MODE=http` is set
2. **`src/config/environment.ts` validation**:
   - Default port is 5182
3. **`web/vite.config.ts` validation**:
   - Server port is 5181
   - Proxy targets `http://localhost:5182`
4. **Port availability**:
   - Check if port 5182 is free
   - Check if port 5181 is free
5. **Package.json scripts**:
   - `start:dev` script exists

**Exit Codes**:
- `0` - All checks passed
- `1` - One or more checks failed

**Example Output (Success)**:
```bash
$ ./check-ports.sh

╔══════════════════════════════════════════════════════════════╗
║  Port Configuration Checker                                 ║
╚══════════════════════════════════════════════════════════════╝

Checking .env.local...
✓ Backend port correctly set to 5182
✓ Transport mode set to HTTP

Checking src/config/environment.ts...
✓ Backend default port is 5182

Checking web/vite.config.ts...
✓ Frontend port is 5181
✓ Frontend proxy targets backend at 5182

Checking port availability...
✓ Port 5182 is available
✓ Port 5181 is available

Checking package.json scripts...
✓ start:dev script exists

╔══════════════════════════════════════════════════════════════╗
║  ✓ All port configurations are correct!                     ║
╚══════════════════════════════════════════════════════════════╝

You can start the development environment with:
  ./dev-start.sh
  pnpm start:dev
```

**Example Output (Error)**:
```bash
$ ./check-ports.sh

Checking .env.local...
✗ Backend port not set to 5182 in .env.local
  Current value:
  MCP_SERVER_PORT=3000

╔══════════════════════════════════════════════════════════════╗
║  ✗ Found 1 configuration error(s)                           ║
╚══════════════════════════════════════════════════════════════╝

To fix configuration issues:
  1. Review PORT-CONFIGURATION.md
  2. Ensure .env.local has: MCP_SERVER_PORT=5182
  3. Run this script again to verify fixes
```

---

## 📊 Script Workflow

### Typical Development Day

```bash
# 1. Verify configuration (first time or after pulling changes)
./check-ports.sh

# 2. Start development environment
./dev-start.sh

# 3. Work on code
# - Both servers auto-reload on file changes
# - Logs visible in terminal

# 4. Check running servers (in another terminal)
lsof -i :5181  # Frontend
lsof -i :5182  # Backend

# 5. View separate logs (optional)
tail -f backend.log
tail -f frontend.log

# 6. Stop servers when done
# Press Ctrl+C in dev-start.sh terminal
```

### After Pulling Changes

```bash
# 1. Check if configuration is still valid
./check-ports.sh

# 2. Install any new dependencies
pnpm install

# 3. Start development
./dev-start.sh
```

### Troubleshooting Port Conflicts

```bash
# 1. Check what's using the ports
lsof -i :5181
lsof -i :5182

# 2. Option A: Use dev-start.sh (handles conflicts automatically)
./dev-start.sh
# Script will detect conflicts and offer to kill processes

# 3. Option B: Manually kill processes
lsof -ti :5182 | xargs kill -9
lsof -ti :5181 | xargs kill -9

# 4. Verify ports are free
./check-ports.sh
```

---

## 🔧 Script Maintenance

### Modifying Port Configuration

If you need to change ports in the future:

1. **Update port constants in scripts**:
   ```bash
   # In dev-start.sh
   BACKEND_PORT=NEW_PORT
   FRONTEND_PORT=NEW_PORT

   # In check-ports.sh
   EXPECTED_BACKEND=NEW_PORT
   EXPECTED_FRONTEND=NEW_PORT
   ```

2. **Update application configuration**:
   - `src/config/environment.ts` - Backend default
   - `web/vite.config.ts` - Frontend port and proxy
   - `.env.local` - Environment override
   - `.env.example` - Documentation

3. **Verify changes**:
   ```bash
   ./check-ports.sh
   ```

### Adding New Checks to `check-ports.sh`

To add additional validation:

```bash
# Add check in appropriate section
echo -e "${BLUE}Checking new configuration...${NC}"
if grep -q "NEW_CONFIG=expected_value" .env.local; then
    echo -e "${GREEN}✓ New configuration is correct${NC}"
else
    echo -e "${RED}✗ New configuration is incorrect${NC}"
    ERRORS=$((ERRORS + 1))
fi
```

### Debugging Script Issues

Enable debug mode:

```bash
# Run with bash debug flag
bash -x ./dev-start.sh

# Or run with verbose output
bash -v ./check-ports.sh
```

---

## 📁 Generated Files

### Log Files

**Location**: Project root
**Files**:
- `backend.log` - Backend server output
- `frontend.log` - Frontend server output

**Gitignore**: These files should be in `.gitignore`

**Cleanup**:
```bash
# Remove old logs
rm backend.log frontend.log

# Or rotate logs
mv backend.log backend.log.old
mv frontend.log frontend.log.old
```

### Temporary Files

The scripts do not create temporary files. All output goes to:
- Standard output (terminal)
- Log files (backend.log, frontend.log)

---

## 🚨 Error Handling

### Common Errors

**Error**: `./dev-start.sh: Permission denied`
**Cause**: Script not executable
**Fix**:
```bash
chmod +x dev-start.sh
```

**Error**: `.env.local file not found`
**Cause**: Missing environment file
**Fix**:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

**Error**: `Backend server failed to start`
**Cause**: Various (check logs)
**Fix**:
```bash
# Check backend log for details
tail -20 backend.log

# Common causes:
# - Missing dependencies: pnpm install
# - Invalid environment: check .env.local
# - Port conflict: kill existing process
```

**Error**: `Port already in use`
**Cause**: Previous server instance still running
**Fix**:
```bash
# Dev-start.sh will offer to kill it
# Or manually:
lsof -ti :5182 | xargs kill -9
```

---

## 🔗 Related Documentation

- [PORT-CONFIGURATION.md](PORT-CONFIGURATION.md) - Comprehensive port configuration guide
- [QUICK-START.md](QUICK-START.md) - Quick reference for daily tasks
- [PORT-LOCK-SUMMARY.md](PORT-LOCK-SUMMARY.md) - Implementation summary
- [README.md](README.md) - Main project documentation

---

## 💡 Tips and Tricks

### Run in Background

```bash
# Start in background (not recommended - can't stop easily)
./dev-start.sh &

# Better: Use screen or tmux
screen -S dev
./dev-start.sh
# Press Ctrl+A, D to detach

# Reattach later
screen -r dev
```

### Monitor Specific Logs

```bash
# Watch backend logs only
tail -f backend.log | grep -i error

# Watch frontend logs only
tail -f frontend.log | grep -i warning

# Watch both with color
tail -f backend.log | sed 's/^/[BACKEND] /' &
tail -f frontend.log | sed 's/^/[FRONTEND] /' &
```

### Quick Health Check

```bash
# Check if servers are responding
curl -s http://localhost:5182/health | jq
curl -s http://localhost:5181 > /dev/null && echo "Frontend OK"
```

### Auto-restart on Crash

```bash
# Simple restart loop (use with caution)
while true; do
    ./dev-start.sh
    echo "Server crashed, restarting in 5 seconds..."
    sleep 5
done
```

---

## 📞 Support

If you encounter issues with the scripts:

1. **Run configuration checker first**:
   ```bash
   ./check-ports.sh
   ```

2. **Check log files**:
   ```bash
   tail -50 backend.log
   tail -50 frontend.log
   ```

3. **Verify environment**:
   ```bash
   cat .env.local | grep -E "PORT|TRANSPORT"
   ```

4. **Check for zombie processes**:
   ```bash
   ps aux | grep -E "node|tsx" | grep -v grep
   ```

5. **Review documentation**:
   - [PORT-CONFIGURATION.md](PORT-CONFIGURATION.md) - Troubleshooting section
   - [README.md](README.md) - Getting started guide

---

**Last Updated**: 2025-12-02
**Maintained By**: Development Team
**Version**: 1.0.0
