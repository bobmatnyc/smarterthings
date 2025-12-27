#!/bin/bash

# OAuth HTTP Transport Fix Verification Script
# Tests that API routes work after OAuth callback completes

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:5182}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test API endpoint
test_endpoint() {
    local endpoint="$1"
    local expected_status="$2"
    local description="$3"

    echo ""
    log_info "Testing: $description"
    log_info "Endpoint: $endpoint"

    response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$VERBOSE" = "true" ]; then
        echo "Response body: $body"
    fi

    if [ "$http_code" = "$expected_status" ]; then
        log_info "✅ PASS - Status code: $http_code"
        return 0
    else
        log_error "❌ FAIL - Expected: $expected_status, Got: $http_code"
        if [ "$http_code" = "401" ]; then
            log_error "   Possible cause: ServiceContainer not updated after OAuth"
        fi
        return 1
    fi
}

main() {
    echo "========================================="
    echo "OAuth HTTP Transport Fix Verification"
    echo "========================================="
    echo ""
    log_info "Target API: $API_BASE_URL"
    echo ""

    # Check if server is running
    if ! curl -s -f "$API_BASE_URL/health" > /dev/null 2>&1; then
        log_error "Server is not responding at $API_BASE_URL"
        log_error "Please start the server first: npm start"
        exit 1
    fi

    log_info "✅ Server is running"
    echo ""

    # Test critical endpoints
    total_tests=0
    passed_tests=0

    # Test 1: Health endpoint (should always work)
    ((total_tests++))
    if test_endpoint "/health" "200" "Health endpoint (no auth required)"; then
        ((passed_tests++))
    fi

    # Test 2: Devices endpoint (requires valid OAuth tokens)
    ((total_tests++))
    if test_endpoint "/api/devices" "200" "Devices API (requires OAuth)"; then
        ((passed_tests++))
    else
        log_warn "If OAuth was completed, this indicates the ServiceContainer was not updated"
    fi

    # Test 3: Rooms endpoint (requires valid OAuth tokens)
    ((total_tests++))
    if test_endpoint "/api/rooms" "200" "Rooms API (requires OAuth)"; then
        ((passed_tests++))
    fi

    # Test 4: Scenes endpoint (requires valid OAuth tokens)
    ((total_tests++))
    if test_endpoint "/api/scenes" "200" "Scenes API (requires OAuth)"; then
        ((passed_tests++))
    fi

    # Summary
    echo ""
    echo "========================================="
    echo "Test Summary"
    echo "========================================="
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $((total_tests - passed_tests))"
    echo ""

    if [ "$passed_tests" -eq "$total_tests" ]; then
        log_info "✅ All tests passed!"
        log_info "OAuth HTTP transport fix is working correctly"
        exit 0
    else
        log_error "❌ Some tests failed"
        if [ "$passed_tests" -eq 1 ]; then
            log_warn "Only health endpoint works - OAuth tokens may not be configured"
            log_warn "Complete OAuth flow: $API_BASE_URL/auth/smartthings"
        else
            log_error "API routes failing after OAuth - ServiceContainer may not be updated"
        fi
        exit 1
    fi
}

# Run main
main
