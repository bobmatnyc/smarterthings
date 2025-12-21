#!/bin/bash

###############################################################################
# Port Configuration Checker
#
# Verifies that all port configurations are correct and consistent
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Expected ports
EXPECTED_BACKEND=5182
EXPECTED_FRONTEND=5181

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Port Configuration Checker                                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0

# Check .env.local
echo -e "${BLUE}Checking .env.local...${NC}"
if [ -f .env.local ]; then
    if grep -q "MCP_SERVER_PORT=$EXPECTED_BACKEND" .env.local; then
        echo -e "${GREEN}✓ Backend port correctly set to $EXPECTED_BACKEND${NC}"
    else
        echo -e "${RED}✗ Backend port not set to $EXPECTED_BACKEND in .env.local${NC}"
        echo -e "${YELLOW}  Current value:${NC}"
        grep "MCP_SERVER_PORT" .env.local || echo -e "${RED}  Not set${NC}"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "TRANSPORT_MODE=http" .env.local; then
        echo -e "${GREEN}✓ Transport mode set to HTTP${NC}"
    else
        echo -e "${YELLOW}⚠  Transport mode not set to HTTP${NC}"
        echo -e "${YELLOW}  Current value:${NC}"
        grep "TRANSPORT_MODE" .env.local || echo -e "${YELLOW}  Not set (will use default)${NC}"
    fi
else
    echo -e "${RED}✗ .env.local file not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check backend environment.ts
echo -e "${BLUE}Checking src/config/environment.ts...${NC}"
if grep -q "default($EXPECTED_BACKEND)" src/config/environment.ts; then
    echo -e "${GREEN}✓ Backend default port is $EXPECTED_BACKEND${NC}"
else
    echo -e "${RED}✗ Backend default port is not $EXPECTED_BACKEND${NC}"
    echo -e "${YELLOW}  Current default:${NC}"
    grep "MCP_SERVER_PORT" src/config/environment.ts
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check frontend vite.config.ts
echo -e "${BLUE}Checking web/vite.config.ts...${NC}"
if grep -q "port: $EXPECTED_FRONTEND" web/vite.config.ts; then
    echo -e "${GREEN}✓ Frontend port is $EXPECTED_FRONTEND${NC}"
else
    echo -e "${RED}✗ Frontend port is not $EXPECTED_FRONTEND${NC}"
    echo -e "${YELLOW}  Current value:${NC}"
    grep "port:" web/vite.config.ts
    ERRORS=$((ERRORS + 1))
fi

if grep -q "target: 'http://localhost:$EXPECTED_BACKEND'" web/vite.config.ts; then
    echo -e "${GREEN}✓ Frontend proxy targets backend at $EXPECTED_BACKEND${NC}"
else
    echo -e "${RED}✗ Frontend proxy does not target backend at $EXPECTED_BACKEND${NC}"
    echo -e "${YELLOW}  Current targets:${NC}"
    grep "target:" web/vite.config.ts
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if ports are in use
echo -e "${BLUE}Checking port availability...${NC}"

if lsof -Pi :$EXPECTED_BACKEND -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠  Port $EXPECTED_BACKEND is in use by:${NC}"
    lsof -Pi :$EXPECTED_BACKEND -sTCP:LISTEN | grep -v COMMAND
else
    echo -e "${GREEN}✓ Port $EXPECTED_BACKEND is available${NC}"
fi

if lsof -Pi :$EXPECTED_FRONTEND -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠  Port $EXPECTED_FRONTEND is in use by:${NC}"
    lsof -Pi :$EXPECTED_FRONTEND -sTCP:LISTEN | grep -v COMMAND
else
    echo -e "${GREEN}✓ Port $EXPECTED_FRONTEND is available${NC}"
fi
echo ""

# Check package.json scripts
echo -e "${BLUE}Checking package.json scripts...${NC}"
if grep -q "\"start:dev\"" package.json; then
    echo -e "${GREEN}✓ start:dev script exists${NC}"
else
    echo -e "${YELLOW}⚠  start:dev script not found in package.json${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}║  ✓ All port configurations are correct!                     ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}You can start the development environment with:${NC}"
    echo -e "  ${BLUE}./dev-start.sh${NC}"
    echo -e "  ${BLUE}pnpm start:dev${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}║  ✗ Found $ERRORS configuration error(s)                        ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}To fix configuration issues:${NC}"
    echo -e "  1. Review PORT-CONFIGURATION.md"
    echo -e "  2. Ensure .env.local has: MCP_SERVER_PORT=5182"
    echo -e "  3. Run this script again to verify fixes"
    echo ""
    exit 1
fi
