#!/bin/bash
# Test script for /health endpoint OAuth detection
#
# Usage: bash scripts/test-health-endpoint.sh
#
# This script tests the /health endpoint to ensure it returns
# the correct smartthings.initialized status.

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:5182}"
HEALTH_ENDPOINT="${BACKEND_URL}/health"

echo "============================================"
echo "Testing /health endpoint OAuth detection"
echo "============================================"
echo ""
echo "Backend URL: ${BACKEND_URL}"
echo "Health endpoint: ${HEALTH_ENDPOINT}"
echo ""

# Check if backend is running
echo "1. Checking if backend is reachable..."
if curl -sf "${HEALTH_ENDPOINT}" > /dev/null 2>&1; then
  echo "   ✅ Backend is running"
else
  echo "   ❌ Backend is NOT running at ${BACKEND_URL}"
  echo "   Please start backend with: pnpm dev"
  exit 1
fi

echo ""
echo "2. Fetching health status..."
RESPONSE=$(curl -s "${HEALTH_ENDPOINT}")

echo ""
echo "3. Raw response:"
echo "${RESPONSE}" | jq '.'

echo ""
echo "4. Validating response structure..."

# Check for required fields
STATUS=$(echo "${RESPONSE}" | jq -r '.status')
SERVICE=$(echo "${RESPONSE}" | jq -r '.service')
VERSION=$(echo "${RESPONSE}" | jq -r '.version')
ST_INITIALIZED=$(echo "${RESPONSE}" | jq -r '.smartthings.initialized')
ST_AUTH_METHOD=$(echo "${RESPONSE}" | jq -r '.smartthings.authMethod')

if [ "${STATUS}" = "healthy" ]; then
  echo "   ✅ status: ${STATUS}"
else
  echo "   ❌ status: ${STATUS} (expected 'healthy')"
fi

if [ -n "${SERVICE}" ] && [ "${SERVICE}" != "null" ]; then
  echo "   ✅ service: ${SERVICE}"
else
  echo "   ❌ service: missing or null"
fi

if [ -n "${VERSION}" ] && [ "${VERSION}" != "null" ]; then
  echo "   ✅ version: ${VERSION}"
else
  echo "   ❌ version: missing or null"
fi

if [ "${ST_INITIALIZED}" = "true" ] || [ "${ST_INITIALIZED}" = "false" ]; then
  echo "   ✅ smartthings.initialized: ${ST_INITIALIZED}"
else
  echo "   ❌ smartthings.initialized: ${ST_INITIALIZED} (expected boolean)"
fi

if [ "${ST_AUTH_METHOD}" = "oauth" ] || [ "${ST_AUTH_METHOD}" = "pat" ] || [ "${ST_AUTH_METHOD}" = "none" ]; then
  echo "   ✅ smartthings.authMethod: ${ST_AUTH_METHOD}"
else
  echo "   ❌ smartthings.authMethod: ${ST_AUTH_METHOD} (expected 'oauth', 'pat', or 'none')"
fi

echo ""
echo "5. Authentication status summary:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "${ST_INITIALIZED}" = "true" ]; then
  echo "   ✅ SmartThings is AUTHENTICATED"
  echo "   📝 Auth method: ${ST_AUTH_METHOD}"
  echo ""
  echo "   Expected behavior:"
  echo "   - Frontend should show RoomsGrid (dashboard)"
  echo "   - OAuth UI should NOT be visible"
else
  echo "   ⚠️  SmartThings is NOT authenticated"
  echo "   📝 Auth method: ${ST_AUTH_METHOD}"
  echo ""
  echo "   Expected behavior:"
  echo "   - Frontend should show OAuthConnect component"
  echo "   - 'Connect to SmartThings' button should be visible"
  echo "   - NO 'Failed to Load Rooms' error"
fi

echo ""
echo "6. Frontend verification steps:"
echo "   1. Open http://localhost:5181 in browser"
echo "   2. Open DevTools → Network tab"
echo "   3. Verify '/health' request is made"
echo "   4. Check response matches above output"
if [ "${ST_INITIALIZED}" = "false" ]; then
  echo "   5. Verify OAuthConnect UI is displayed"
  echo "   6. Verify 'Connect to SmartThings' button exists"
else
  echo "   5. Verify dashboard/rooms are displayed"
  echo "   6. Verify NO OAuth UI is shown"
fi

echo ""
echo "============================================"
echo "Health endpoint test complete!"
echo "============================================"
