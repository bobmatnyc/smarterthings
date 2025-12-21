#!/bin/bash

echo "=================================================="
echo "OAuth Startup Fix - Verification Script"
echo "=================================================="
echo ""

# Start server without PAT
echo "[1/5] Starting server without SmartThings PAT..."
SMARTTHINGS_PAT="" node dist/server-alexa.js > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "      Server PID: $SERVER_PID"

# Wait for server to start
sleep 5

# Test health endpoint
echo "[2/5] Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:5182/health)
echo "      Response: $HEALTH_RESPONSE" | head -c 100
echo "..."

# Test OAuth status endpoint
echo "[3/5] Testing OAuth status endpoint..."
OAUTH_RESPONSE=$(curl -s http://localhost:5182/auth/smartthings/status)
echo "      Response: $OAUTH_RESPONSE"

# Test API endpoint (should return 503)
echo "[4/5] Testing API endpoint (should return 503)..."
API_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:5182/api/devices)
echo "      Response: $API_RESPONSE"

# Cleanup
echo "[5/5] Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null || true
echo "      Server stopped"

echo ""
echo "=================================================="
echo "✓ Verification complete!"
echo "=================================================="
echo ""
echo "Expected results:"
echo "  - Health endpoint: status=healthy, smartthings.initialized=false"
echo "  - OAuth status: connected=false"
echo "  - API endpoint: HTTP 503 with SERVICE_UNAVAILABLE error"
