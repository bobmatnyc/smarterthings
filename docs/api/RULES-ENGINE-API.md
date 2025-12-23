# Rules Engine API

REST API endpoints for managing local rule execution in Smarter Things.

## Overview

The Rules Engine API provides CRUD operations for creating and managing automation rules that execute locally. Rules can trigger based on device state changes, time schedules, or manual execution.

**Base URL**: `http://localhost:5182/api/rules/local`

## Endpoints

### List All Rules

**GET** `/api/rules/local`

List all local rules with metadata.

**Response:**
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule_abc123",
        "name": "Turn on lights at sunset",
        "description": "Automatically turn on living room lights at sunset",
        "enabled": true,
        "priority": 50,
        "triggers": [...],
        "actions": [...],
        "createdAt": "2025-12-22T10:00:00Z",
        "updatedAt": "2025-12-22T10:00:00Z",
        "executionCount": 0,
        "createdBy": "user"
      }
    ],
    "count": 1,
    "enabledCount": 1
  }
}
```

**Performance**: < 10ms for 100 rules

---

### Get Single Rule

**GET** `/api/rules/local/:id`

Get details for a specific rule.

**Path Parameters:**
- `id` (string, required): Rule ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_abc123",
    "name": "Turn on lights at sunset",
    "description": "Automatically turn on living room lights at sunset",
    "enabled": true,
    "priority": 50,
    "triggers": [
      {
        "type": "astronomical",
        "event": "sunset",
        "offsetMinutes": 0
      }
    ],
    "actions": [
      {
        "type": "device_command",
        "deviceId": "device123",
        "deviceName": "Living Room Lights",
        "command": "on"
      }
    ],
    "createdAt": "2025-12-22T10:00:00Z",
    "updatedAt": "2025-12-22T10:00:00Z",
    "executionCount": 5,
    "createdBy": "user"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Rule not found"
  }
}
```

---

### Create Rule

**POST** `/api/rules/local`

Create a new automation rule.

**Request Body:**
```json
{
  "name": "Turn on lights at sunset",
  "description": "Automatically turn on living room lights at sunset",
  "enabled": true,
  "priority": 50,
  "triggers": [
    {
      "type": "astronomical",
      "event": "sunset",
      "offsetMinutes": 0
    }
  ],
  "actions": [
    {
      "type": "device_command",
      "deviceId": "device123",
      "deviceName": "Living Room Lights",
      "command": "on"
    }
  ]
}
```

**Required Fields:**
- `name` (string, 1-100 chars)
- `triggers` (array, min 1 trigger)
- `actions` (array, min 1 action)

**Optional Fields:**
- `description` (string, max 500 chars)
- `enabled` (boolean, default: true)
- `priority` (number, 1-100, default: 50)
- `conditions` (array, additional conditions)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "rule_abc123",
    "name": "Turn on lights at sunset",
    ...
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid rule data",
    "details": [
      {
        "path": ["name"],
        "message": "String must contain at least 1 character(s)"
      }
    ]
  }
}
```

---

### Update Rule

**PATCH** `/api/rules/local/:id`

Update an existing rule. Only provided fields are updated.

**Path Parameters:**
- `id` (string, required): Rule ID

**Request Body:**
```json
{
  "name": "Turn on lights 30 minutes before sunset",
  "triggers": [
    {
      "type": "astronomical",
      "event": "sunset",
      "offsetMinutes": -30
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_abc123",
    "name": "Turn on lights 30 minutes before sunset",
    ...
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Rule not found"
  }
}
```

---

### Delete Rule

**DELETE** `/api/rules/local/:id`

Delete a rule permanently.

**Path Parameters:**
- `id` (string, required): Rule ID

**Response:**
```json
{
  "success": true,
  "message": "Rule deleted"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Rule not found"
  }
}
```

---

### Execute Rule

**POST** `/api/rules/local/:id/execute`

Manually execute a rule immediately, bypassing trigger conditions.

**Path Parameters:**
- `id` (string, required): Rule ID

**Response:**
```json
{
  "success": true,
  "data": {
    "ruleId": "rule_abc123",
    "ruleName": "Turn on lights at sunset",
    "success": true,
    "startedAt": "2025-12-22T18:30:00Z",
    "completedAt": "2025-12-22T18:30:01Z",
    "durationMs": 150,
    "triggeredBy": "manual",
    "actionsExecuted": 1,
    "actionResults": [
      {
        "actionType": "device_command",
        "success": true,
        "deviceId": "device123",
        "command": "on",
        "durationMs": 120
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Rule not found"
  }
}
```

**Performance**: < 100ms for simple device commands

---

### Enable Rule

**POST** `/api/rules/local/:id/enable`

Enable a disabled rule to start responding to triggers.

**Path Parameters:**
- `id` (string, required): Rule ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_abc123",
    "name": "Turn on lights at sunset",
    "enabled": true,
    ...
  }
}
```

---

### Disable Rule

**POST** `/api/rules/local/:id/disable`

Disable a rule to stop responding to triggers (keeps rule in system).

**Path Parameters:**
- `id` (string, required): Rule ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_abc123",
    "name": "Turn on lights at sunset",
    "enabled": false,
    ...
  }
}
```

---

## Trigger Types

### Device State Trigger
```json
{
  "type": "device_state",
  "deviceId": "device123",
  "deviceName": "Motion Sensor",
  "attribute": "motion",
  "operator": "equals",
  "value": "active"
}
```

**Operators:**
- `equals` - Exact match
- `notEquals` - Not equal to
- `greaterThan` - Numeric comparison
- `lessThan` - Numeric comparison
- `contains` - String contains
- `between` - Numeric range (requires `valueEnd`)

### Time Trigger
```json
{
  "type": "time",
  "time": "18:00",
  "days": ["mon", "tue", "wed", "thu", "fri"]
}
```

### Astronomical Trigger
```json
{
  "type": "astronomical",
  "event": "sunset",
  "offsetMinutes": -30
}
```

**Events:**
- `sunrise`
- `sunset`

### Cron Trigger
```json
{
  "type": "cron",
  "expression": "0 18 * * 1-5"
}
```

---

## Action Types

### Device Command
```json
{
  "type": "device_command",
  "deviceId": "device123",
  "deviceName": "Living Room Lights",
  "capability": "switchLevel",
  "command": "setLevel",
  "arguments": {
    "level": 75
  }
}
```

### Delay
```json
{
  "type": "delay",
  "seconds": 30
}
```

### Sequence
```json
{
  "type": "sequence",
  "mode": "serial",
  "actions": [
    { "type": "device_command", ... },
    { "type": "delay", "seconds": 5 },
    { "type": "device_command", ... }
  ]
}
```

**Modes:**
- `serial` - Execute actions one at a time
- `parallel` - Execute all actions simultaneously

### Notification
```json
{
  "type": "notification",
  "title": "Motion Detected",
  "message": "Motion detected in living room",
  "priority": "high"
}
```

### Execute Rule
```json
{
  "type": "execute_rule",
  "ruleId": "rule_xyz456"
}
```

---

## Condition Types

### Device State Condition
```json
{
  "type": "device_state",
  "deviceId": "device456",
  "attribute": "illuminance",
  "operator": "lessThan",
  "value": 50
}
```

### Time Condition
```json
{
  "type": "time",
  "operator": "between",
  "value": "18:00",
  "valueEnd": "23:00"
}
```

### Compound Condition
```json
{
  "type": "and",
  "conditions": [
    { "type": "device_state", ... },
    { "type": "time", ... }
  ]
}
```

**Types:**
- `and` - All conditions must be true
- `or` - At least one condition must be true

### Not Condition
```json
{
  "type": "not",
  "condition": { "type": "device_state", ... }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `NOT_FOUND` | 404 | Rule not found |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Examples

### Motion-Activated Lights
```json
{
  "name": "Turn on lights on motion",
  "description": "Turn on hallway lights when motion detected at night",
  "enabled": true,
  "priority": 50,
  "triggers": [
    {
      "type": "device_state",
      "deviceId": "motion-sensor-1",
      "deviceName": "Hallway Motion Sensor",
      "attribute": "motion",
      "operator": "equals",
      "value": "active"
    }
  ],
  "conditions": [
    {
      "type": "time",
      "operator": "between",
      "value": "sunset",
      "valueEnd": "sunrise"
    }
  ],
  "actions": [
    {
      "type": "device_command",
      "deviceId": "light-1",
      "deviceName": "Hallway Lights",
      "command": "on"
    },
    {
      "type": "delay",
      "seconds": 300
    },
    {
      "type": "device_command",
      "deviceId": "light-1",
      "command": "off"
    }
  ]
}
```

### Scheduled Dimming
```json
{
  "name": "Dim lights at bedtime",
  "description": "Gradually dim living room lights at 10 PM",
  "enabled": true,
  "priority": 50,
  "triggers": [
    {
      "type": "time",
      "time": "22:00"
    }
  ],
  "actions": [
    {
      "type": "sequence",
      "mode": "serial",
      "actions": [
        {
          "type": "device_command",
          "deviceId": "light-2",
          "capability": "switchLevel",
          "command": "setLevel",
          "arguments": { "level": 50 }
        },
        { "type": "delay", "seconds": 300 },
        {
          "type": "device_command",
          "deviceId": "light-2",
          "capability": "switchLevel",
          "command": "setLevel",
          "arguments": { "level": 25 }
        },
        { "type": "delay", "seconds": 300 },
        {
          "type": "device_command",
          "deviceId": "light-2",
          "command": "off"
        }
      ]
    }
  ]
}
```

---

## Client Libraries

### JavaScript/TypeScript
```typescript
// List all rules
const response = await fetch('http://localhost:5182/api/rules/local');
const { data } = await response.json();
console.log(`Found ${data.count} rules, ${data.enabledCount} enabled`);

// Create rule
const newRule = {
  name: "Turn on lights at sunset",
  enabled: true,
  triggers: [{ type: "astronomical", event: "sunset" }],
  actions: [{ type: "device_command", deviceId: "light-1", command: "on" }]
};

const createResponse = await fetch('http://localhost:5182/api/rules/local', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newRule)
});
const { data: createdRule } = await createResponse.json();

// Execute rule
const executeResponse = await fetch(
  `http://localhost:5182/api/rules/local/${createdRule.id}/execute`,
  { method: 'POST' }
);
const { data: result } = await executeResponse.json();
console.log(`Executed ${result.actionsExecuted} actions in ${result.durationMs}ms`);

// Delete rule
await fetch(`http://localhost:5182/api/rules/local/${createdRule.id}`, {
  method: 'DELETE'
});
```

### Python
```python
import requests

BASE_URL = "http://localhost:5182/api/rules/local"

# List all rules
response = requests.get(BASE_URL)
data = response.json()["data"]
print(f"Found {data['count']} rules, {data['enabledCount']} enabled")

# Create rule
new_rule = {
    "name": "Turn on lights at sunset",
    "enabled": True,
    "triggers": [{"type": "astronomical", "event": "sunset"}],
    "actions": [{"type": "device_command", "deviceId": "light-1", "command": "on"}]
}

response = requests.post(BASE_URL, json=new_rule)
created_rule = response.json()["data"]

# Execute rule
response = requests.post(f"{BASE_URL}/{created_rule['id']}/execute")
result = response.json()["data"]
print(f"Executed {result['actionsExecuted']} actions in {result['durationMs']}ms")

# Delete rule
requests.delete(f"{BASE_URL}/{created_rule['id']}")
```

---

## Performance Guidelines

- **List query**: < 10ms for 100 rules (in-memory storage)
- **Rule execution**: < 100ms for simple device commands
- **Validation**: < 5ms using Zod schemas
- **Storage**: Automatic persistence to disk on every change

---

## Related Documentation

- [Rules Engine Architecture](../implementation/RULES-ENGINE-ARCHITECTURE.md)
- [Capability Mapping Guide](../capability-mapping-guide.md)
- [SmartThings API Documentation](https://developer.smartthings.com/docs/api/public)
