#!/bin/bash

###############################################################################
# Development Environment Startup Script
#
# Starts both backend (port 5182) and frontend (port 5181) servers
# Ensures consistent port configuration across restarts
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Port configuration (LOCKED)
BACKEND_PORT=5182
FRONTEND_PORT=5181

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SmartThings MCP Development Environment                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    local service=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Warning: Port $port is already in use by another process${NC}"
        echo -e "${YELLOW}   Service: $service${NC}"
        echo ""
        read -p "Kill existing process on port $port? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Killing process on port $port...${NC}"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
            sleep 1
            echo -e "${GREEN}✓ Port $port cleared${NC}"
        else
            echo -e "${RED}✗ Cannot start $service - port $port is in use${NC}"
            return 1
        fi
    fi
    return 0
}

# Function to verify environment file
verify_env() {
    if [ ! -f .env.local ]; then
        echo -e "${RED}✗ Error: .env.local file not found${NC}"
        echo -e "${YELLOW}  Please create .env.local from .env.example${NC}"
        exit 1
    fi

    # Check if port is set correctly in .env.local
    if ! grep -q "MCP_SERVER_PORT=5182" .env.local || ! grep -q "ALEXA_SERVER_PORT=5182" .env.local; then
        echo -e "${YELLOW}⚠️  Warning: Port configuration incomplete in .env.local${NC}"
        echo -e "${YELLOW}   Automatically adding correct port configuration...${NC}"

        # Remove any existing port settings
        grep -v "^MCP_SERVER_PORT=" .env.local | grep -v "^ALEXA_SERVER_PORT=" | grep -v "^TRANSPORT_MODE=" > .env.local.tmp || true
        mv .env.local.tmp .env.local

        # Add correct port configuration
        echo "" >> .env.local
        echo "# Port Configuration (LOCKED - Do not change)" >> .env.local
        echo "MCP_SERVER_PORT=5182" >> .env.local
        echo "ALEXA_SERVER_PORT=5182" >> .env.local
        echo "TRANSPORT_MODE=http" >> .env.local

        echo -e "${GREEN}✓ Port configuration updated in .env.local${NC}"
    fi

    echo -e "${GREEN}✓ Environment file verified${NC}"
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"

    # Kill all child processes
    jobs -p | xargs -r kill 2>/dev/null || true

    # Wait for processes to terminate
    sleep 2

    # Force kill if still running
    lsof -ti :$BACKEND_PORT | xargs -r kill -9 2>/dev/null || true
    lsof -ti :$FRONTEND_PORT | xargs -r kill -9 2>/dev/null || true

    echo -e "${GREEN}✓ Servers stopped${NC}"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM EXIT

echo -e "${BLUE}1. Checking environment...${NC}"
verify_env
echo ""

echo -e "${BLUE}2. Checking ports...${NC}"
check_port $BACKEND_PORT "Backend MCP Server" || exit 1
check_port $FRONTEND_PORT "Frontend Dev Server" || exit 1
echo ""

echo -e "${BLUE}3. Installing dependencies...${NC}"
if [ ! -d "node_modules" ] || [ ! -d "web/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies (this may take a minute)...${NC}"
    pnpm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

echo -e "${BLUE}4. Starting servers...${NC}"
echo ""

# Start backend server
echo -e "${GREEN}Starting Backend Server on port ${BACKEND_PORT}...${NC}"
echo -e "${BLUE}  URL: http://localhost:${BACKEND_PORT}${NC}"
echo -e "${BLUE}  Health Check: http://localhost:${BACKEND_PORT}/health${NC}"
echo ""

# Start backend in background, redirect output to log file
# Use alexa-server:dev which provides REST API endpoints for the web UI
pnpm alexa-server:dev > backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo -n "Waiting for backend to start"
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
        echo -e "\n${GREEN}✓ Backend server started successfully${NC}"
        break
    fi
    echo -n "."
    sleep 1

    # Check if backend process is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "\n${RED}✗ Backend server failed to start${NC}"
        echo -e "${YELLOW}Check backend.log for errors${NC}"
        tail -20 backend.log
        exit 1
    fi
done
echo ""

# Start frontend server
echo -e "${GREEN}Starting Frontend Server on port ${FRONTEND_PORT}...${NC}"
echo -e "${BLUE}  URL: http://localhost:${FRONTEND_PORT}${NC}"
echo ""

# Start frontend in background, redirect output to log file
pnpm dev:web > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
echo -n "Waiting for frontend to start"
for i in {1..30}; do
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e "\n${GREEN}✓ Frontend server started successfully${NC}"
        break
    fi
    echo -n "."
    sleep 1

    # Check if frontend process is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "\n${RED}✗ Frontend server failed to start${NC}"
        echo -e "${YELLOW}Check frontend.log for errors${NC}"
        tail -20 frontend.log
        exit 1
    fi
done
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🚀 Development Environment Ready!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Backend (MCP Server):${NC}  http://localhost:${BACKEND_PORT}"
echo -e "${BLUE}Frontend (Web UI):${NC}     http://localhost:${FRONTEND_PORT}"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Backend:  tail -f backend.log"
echo -e "  Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Keep script running and show combined logs
tail -f backend.log -f frontend.log
