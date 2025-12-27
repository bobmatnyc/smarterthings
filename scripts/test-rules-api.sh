#!/bin/bash
# Test the local rules API

BASE_URL="http://localhost:5182"

echo "=== Testing Local Rules API ==="
echo ""

echo "Step 1: Get list of existing rules"
echo "GET $BASE_URL/api/rules/local"
RULES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/rules/local")
echo "$RULES_RESPONSE" | jq '.'
echo ""

echo "Step 2: Create a simple test rule"
echo "POST $BASE_URL/api/rules/local"
echo ""

# Create a simple rule with hardcoded device IDs for testing
# We'll use placeholder IDs that can be updated once we know actual device IDs
CREATE_RULE_REQUEST='{
  "name": "Test Rule - Manual Trigger",
  "description": "Simple test rule for API verification",
  "enabled": false,
  "priority": 50,
  "triggers": [
    {
      "type": "time",
      "time": "09:00",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }
  ],
  "actions": [
    {
      "type": "device_command",
      "deviceId": "test-device-123",
      "deviceName": "Test Device",
      "command": "on",
      "capability": "switch"
    }
  ]
}'

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/local" \
  -H "Content-Type: application/json" \
  -d "$CREATE_RULE_REQUEST")

echo "$CREATE_RESPONSE" | jq '.'
RULE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id // empty')
echo ""

if [ -n "$RULE_ID" ]; then
  echo "Step 3: Verify rule was created"
  echo "GET $BASE_URL/api/rules/local/$RULE_ID"
  GET_RULE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/rules/local/$RULE_ID")
  echo "$GET_RULE_RESPONSE" | jq '.'
  echo ""

  echo "Step 4: List all rules to confirm"
  echo "GET $BASE_URL/api/rules/local"
  LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/rules/local")
  echo "$LIST_RESPONSE" | jq '.data | {count, enabledCount, rules: .rules | map({id, name, enabled})}'
  echo ""

  echo "=== API Test Complete ==="
  echo "Rule created: $RULE_ID"
else
  echo "Failed to create rule"
  echo "Response: $CREATE_RESPONSE"
fi
