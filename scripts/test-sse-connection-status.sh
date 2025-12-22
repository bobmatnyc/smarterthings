#!/bin/bash
#
# SSE Connection Status Manual Testing Script
#
# This script helps manually verify the SSE connection status bug fix.
# It starts the dev servers and provides instructions for testing.
#
# Bug: SSE-CONNECTION-STATUS-BUG-2025-12-21
# Fix: Use $derived.by() for module-level state reactivity

set -e

echo "🔍 SSE Connection Status Bug Fix - Manual Testing"
echo "=================================================="
echo ""
echo "This script will:"
echo "1. Start the backend server (port 5182)"
echo "2. Start the frontend server (port 5181)"
echo "3. Provide testing instructions"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if servers are already running
if lsof -Pi :5182 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend server already running on port 5182${NC}"
else
    echo -e "${BLUE}🚀 Starting backend server...${NC}"
    cd "$(dirname "$0")/.."
    pnpm dev > /tmp/backend-dev.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    sleep 2
fi

if lsof -Pi :5181 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Frontend server already running on port 5181${NC}"
else
    echo -e "${BLUE}🚀 Starting frontend server...${NC}"
    cd "$(dirname "$0")/../web"
    pnpm dev > /tmp/frontend-dev.log 2>&1 &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"
    sleep 3
fi

echo ""
echo -e "${GREEN}✅ Servers started successfully!${NC}"
echo ""
echo "📋 TESTING INSTRUCTIONS"
echo "======================="
echo ""
echo "1. Open your browser to: ${BLUE}http://localhost:5181${NC}"
echo ""
echo "2. Look at the SubNav header (top right)"
echo "   - Initially: ${YELLOW}\"Reconnecting...\"${NC} (amber badge with pulsing dot)"
echo "   - After 1-2 seconds: ${GREEN}\"Connected\"${NC} (green badge with pulsing dot)"
echo ""
echo "3. Open Browser DevTools Console (F12)"
echo "   - Look for: ${GREEN}[SSE] Connected to device event stream${NC}"
echo "   - Look for: ${GREEN}[SSE] Connection acknowledged: <timestamp>${NC}"
echo ""
echo "4. Test reconnection:"
echo "   a. Stop backend: ${RED}Ctrl+C in backend terminal${NC}"
echo "   b. UI should show: ${YELLOW}\"Reconnecting...\"${NC}"
echo "   c. Restart backend: ${BLUE}pnpm dev${NC} (in project root)"
echo "   d. UI should show: ${GREEN}\"Connected\"${NC} (within 1-2 seconds)"
echo ""
echo "5. Verify console logs during reconnect:"
echo "   - ${RED}[SSE] Connection error: ...${NC}"
echo "   - ${YELLOW}[SSE] Reconnecting in 1000ms (attempt 1/10)${NC}"
echo "   - ${GREEN}[SSE] Connected to device event stream${NC}"
echo ""
echo "📊 EXPECTED BEHAVIOR"
echo "===================="
echo ""
echo "✅ PASS: Status changes from \"Reconnecting...\" to \"Connected\""
echo "✅ PASS: Green badge with pulsing dot when connected"
echo "✅ PASS: Amber badge with pulsing dot when reconnecting"
echo "✅ PASS: Console shows connection success logs"
echo "✅ PASS: Reconnection works after backend restart"
echo ""
echo "❌ FAIL: Status stuck on \"Reconnecting...\" (old bug)"
echo "❌ FAIL: No color change on connection"
echo "❌ FAIL: Console errors or no SSE logs"
echo ""
echo "🔧 TECHNICAL DETAILS"
echo "===================="
echo ""
echo "Bug Fix: Changed ConnectionStatus.svelte line 30"
echo "  - Before: ${RED}let connected = \$derived(deviceStore.sseConnected);${NC}"
echo "  - After:  ${GREEN}let connected = \$derived.by(() => deviceStore.sseConnected);${NC}"
echo ""
echo "Reason: \$derived() doesn't track getter changes when getter returns module-level \$state"
echo "Solution: \$derived.by() re-evaluates function on dependency changes"
echo ""
echo "📝 LOGS"
echo "======="
echo "Backend logs:  /tmp/backend-dev.log"
echo "Frontend logs: /tmp/frontend-dev.log"
echo ""
echo "View logs: ${BLUE}tail -f /tmp/backend-dev.log /tmp/frontend-dev.log${NC}"
echo ""
echo "Press ${RED}Ctrl+C${NC} to stop servers and exit"
echo ""

# Wait for user interrupt
trap 'echo ""; echo "🛑 Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo "✅ Servers stopped"; exit 0' INT

# Keep script running
tail -f /dev/null
