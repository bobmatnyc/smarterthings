#!/bin/bash

# Test script for Rule Deletion API (Ticket 1M-538)
# Tests DELETE /api/rules/:id endpoint

set -e

API_BASE="http://localhost:5182/api"
TEST_RESULTS_FILE="test-results/rule-deletion-api-test-results.json"

echo "============================================"
echo "Rule Deletion API Test Suite (1M-538)"
echo "============================================"
echo ""

# Check if server is running
if ! curl -s -f "${API_BASE%/api}/health" > /dev/null 2>&1; then
    echo "❌ ERROR: Server is not running on localhost:5182"
    echo "   Please start the server with: pnpm dev"
    exit 1
fi

echo "✅ Server health check passed"
echo ""

# Initialize test results
mkdir -p test-results
echo "{" > "$TEST_RESULTS_FILE"
echo "  \"testSuite\": \"Rule Deletion API\"," >> "$TEST_RESULTS_FILE"
echo "  \"ticket\": \"1M-538\"," >> "$TEST_RESULTS_FILE"
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> "$TEST_RESULTS_FILE"
echo "  \"tests\": [" >> "$TEST_RESULTS_FILE"

# Test 1: List rules to get a valid rule ID
echo "Test 1: Get list of rules to find a test candidate"
echo "=================================================="
RULES_RESPONSE=$(curl -s "${API_BASE}/rules")
echo "Response: $RULES_RESPONSE" | head -c 200
echo "..."
echo ""

# Extract first rule ID (if any exist)
RULE_ID=$(echo "$RULES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

if [ -z "$RULE_ID" ]; then
    echo "⚠️  WARNING: No rules found to test deletion"
    echo "   Skipping deletion tests (this is OK if no rules exist)"
    echo "  ]," >> "$TEST_RESULTS_FILE"
    echo "  \"summary\": \"No rules available for testing\"" >> "$TEST_RESULTS_FILE"
    echo "}" >> "$TEST_RESULTS_FILE"
    exit 0
fi

echo "✅ Found test rule ID: $RULE_ID"
echo ""

# Test 2: Invalid rule ID format (400 Bad Request)
echo "Test 2: DELETE with invalid rule ID format (expect 400)"
echo "=========================================================="
HTTP_CODE=$(curl -s -o /tmp/delete_response.json -w "%{http_code}" -X DELETE "${API_BASE}/rules/abc")
RESPONSE=$(cat /tmp/delete_response.json)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $RESPONSE"

if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ Test 2 PASSED: Correctly rejected invalid rule ID with 400"
else
    echo "❌ Test 2 FAILED: Expected 400, got $HTTP_CODE"
fi
echo ""

# Add test result
echo "    {" >> "$TEST_RESULTS_FILE"
echo "      \"name\": \"Invalid Rule ID Format\"," >> "$TEST_RESULTS_FILE"
echo "      \"status\": \"$([ "$HTTP_CODE" = "400" ] && echo "passed" || echo "failed")\"," >> "$TEST_RESULTS_FILE"
echo "      \"expectedCode\": 400," >> "$TEST_RESULTS_FILE"
echo "      \"actualCode\": $HTTP_CODE" >> "$TEST_RESULTS_FILE"
echo "    }," >> "$TEST_RESULTS_FILE"

# Test 3: Non-existent rule ID (404 Not Found)
echo "Test 3: DELETE with non-existent rule ID (expect 404)"
echo "======================================================"
HTTP_CODE=$(curl -s -o /tmp/delete_response.json -w "%{http_code}" -X DELETE "${API_BASE}/rules/00000000-0000-0000-0000-000000000000")
RESPONSE=$(cat /tmp/delete_response.json)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $RESPONSE"

if [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Test 3 PASSED: Correctly returned 404 for non-existent rule"
else
    echo "❌ Test 3 FAILED: Expected 404, got $HTTP_CODE"
fi
echo ""

# Add test result
echo "    {" >> "$TEST_RESULTS_FILE"
echo "      \"name\": \"Non-existent Rule ID\"," >> "$TEST_RESULTS_FILE"
echo "      \"status\": \"$([ "$HTTP_CODE" = "404" ] && echo "passed" || echo "failed")\"," >> "$TEST_RESULTS_FILE"
echo "      \"expectedCode\": 404," >> "$TEST_RESULTS_FILE"
echo "      \"actualCode\": $HTTP_CODE" >> "$TEST_RESULTS_FILE"
echo "    }," >> "$TEST_RESULTS_FILE"

# Test 4: Successful deletion (204 No Content)
echo "Test 4: DELETE valid rule (expect 204)"
echo "======================================="
echo "⚠️  WARNING: This will actually delete rule: $RULE_ID"
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    HTTP_CODE=$(curl -s -o /tmp/delete_response.json -w "%{http_code}" -X DELETE "${API_BASE}/rules/${RULE_ID}")
    RESPONSE=$(cat /tmp/delete_response.json)

    echo "HTTP Status: $HTTP_CODE"
    echo "Response: $RESPONSE (should be empty for 204)"

    if [ "$HTTP_CODE" = "204" ]; then
        echo "✅ Test 4 PASSED: Successfully deleted rule with 204 No Content"
    else
        echo "❌ Test 4 FAILED: Expected 204, got $HTTP_CODE"
    fi
    echo ""

    # Test 5: Verify rule is actually deleted (cache invalidation test)
    echo "Test 5: Verify rule no longer exists after deletion"
    echo "===================================================="
    RULES_RESPONSE_AFTER=$(curl -s "${API_BASE}/rules")

    if echo "$RULES_RESPONSE_AFTER" | grep -q "$RULE_ID"; then
        echo "❌ Test 5 FAILED: Rule still exists after deletion (cache invalidation issue?)"
    else
        echo "✅ Test 5 PASSED: Rule successfully removed from list (cache invalidated)"
    fi
    echo ""

    # Add test results
    echo "    {" >> "$TEST_RESULTS_FILE"
    echo "      \"name\": \"Successful Deletion\"," >> "$TEST_RESULTS_FILE"
    echo "      \"status\": \"$([ "$HTTP_CODE" = "204" ] && echo "passed" || echo "failed")\"," >> "$TEST_RESULTS_FILE"
    echo "      \"expectedCode\": 204," >> "$TEST_RESULTS_FILE"
    echo "      \"actualCode\": $HTTP_CODE," >> "$TEST_RESULTS_FILE"
    echo "      \"ruleId\": \"$RULE_ID\"" >> "$TEST_RESULTS_FILE"
    echo "    }," >> "$TEST_RESULTS_FILE"
    echo "    {" >> "$TEST_RESULTS_FILE"
    echo "      \"name\": \"Cache Invalidation\"," >> "$TEST_RESULTS_FILE"
    echo "      \"status\": \"$(echo "$RULES_RESPONSE_AFTER" | grep -q "$RULE_ID" && echo "failed" || echo "passed")\"," >> "$TEST_RESULTS_FILE"
    echo "      \"description\": \"Verify deleted rule no longer appears in list\"" >> "$TEST_RESULTS_FILE"
    echo "    }" >> "$TEST_RESULTS_FILE"
else
    echo "⏭️  Test 4 SKIPPED: User declined to delete real rule"
    echo "    {" >> "$TEST_RESULTS_FILE"
    echo "      \"name\": \"Successful Deletion\"," >> "$TEST_RESULTS_FILE"
    echo "      \"status\": \"skipped\"," >> "$TEST_RESULTS_FILE"
    echo "      \"reason\": \"User declined destructive test\"" >> "$TEST_RESULTS_FILE"
    echo "    }" >> "$TEST_RESULTS_FILE"
fi

# Finalize test results
echo "  ]" >> "$TEST_RESULTS_FILE"
echo "}" >> "$TEST_RESULTS_FILE"

echo ""
echo "============================================"
echo "Test Results Summary"
echo "============================================"
cat "$TEST_RESULTS_FILE"
echo ""
echo "Test results saved to: $TEST_RESULTS_FILE"
