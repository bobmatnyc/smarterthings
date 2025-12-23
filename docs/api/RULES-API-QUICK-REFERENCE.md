# Rules Engine API - Quick Reference

Quick reference card for the Rules Engine REST API.

## Base URL

```
http://localhost:5182/api/rules/local
```

## Endpoints

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/` | List all rules | - |
| GET | `/:id` | Get single rule | - |
| POST | `/` | Create rule | CreateRuleRequest |
| PATCH | `/:id` | Update rule | UpdateRuleRequest |
| DELETE | `/:id` | Delete rule | - |
| POST | `/:id/execute` | Execute rule | - |
| POST | `/:id/enable` | Enable rule | - |
| POST | `/:id/disable` | Disable rule | - |

## Request Types

### CreateRuleRequest

```json
{
  "name": "string (required, 1-100 chars)",
  "description": "string (optional, max 500 chars)",
  "enabled": "boolean (optional, default: true)",
  "priority": "number (optional, 1-100, default: 50)",
  "triggers": "RuleTrigger[] (required, min 1)",
  "conditions": "RuleCondition[] (optional)",
  "actions": "RuleAction[] (required, min 1)"
}
```

### UpdateRuleRequest

```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "enabled": "boolean (optional)",
  "priority": "number (optional)",
  "triggers": "RuleTrigger[] (optional)",
  "conditions": "RuleCondition[] (optional)",
  "actions": "RuleAction[] (optional)"
}
```

## Trigger Types

### Device State

```json
{
  "type": "device_state",
  "deviceId": "string",
  "deviceName": "string (optional)",
  "attribute": "switch | motion | temperature | level | contact | etc.",
  "operator": "equals | notEquals | greaterThan | lessThan | contains | between",
  "value": "any",
  "valueEnd": "any (for 'between' operator)"
}
```

### Time

```json
{
  "type": "time",
  "time": "HH:MM",
  "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] // optional
}
```

### Astronomical

```json
{
  "type": "astronomical",
  "event": "sunrise | sunset",
  "offsetMinutes": "number (optional, +/- minutes)"
}
```

### Cron

```json
{
  "type": "cron",
  "expression": "string (standard cron format)"
}
```

## Action Types

### Device Command

```json
{
  "type": "device_command",
  "deviceId": "string",
  "deviceName": "string (optional)",
  "capability": "string (optional, e.g., 'switchLevel')",
  "command": "on | off | setLevel | etc.",
  "arguments": {
    "level": 75  // example for setLevel
  }
}
```

### Delay

```json
{
  "type": "delay",
  "seconds": "number"
}
```

### Sequence

```json
{
  "type": "sequence",
  "mode": "serial | parallel",
  "actions": "RuleAction[]"
}
```

### Notification

```json
{
  "type": "notification",
  "title": "string",
  "message": "string",
  "priority": "low | normal | high"
}
```

### Execute Rule

```json
{
  "type": "execute_rule",
  "ruleId": "string"
}
```

## Condition Types

### Device State Condition

```json
{
  "type": "device_state",
  "deviceId": "string",
  "attribute": "string",
  "operator": "equals | notEquals | greaterThan | lessThan | contains | between",
  "value": "any"
}
```

### Time Condition

```json
{
  "type": "time",
  "operator": "before | after | between",
  "value": "HH:MM | sunrise | sunset",
  "valueEnd": "HH:MM (for 'between')"
}
```

### Compound Condition (AND/OR)

```json
{
  "type": "and | or",
  "conditions": "RuleCondition[]"
}
```

### Not Condition

```json
{
  "type": "not",
  "condition": "RuleCondition"
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR",
    "message": "string",
    "details": [ ... ] // For validation errors
  }
}
```

## Common Examples

### Turn on lights at sunset

```bash
curl -X POST http://localhost:5182/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Lights",
    "triggers": [{"type": "astronomical", "event": "sunset"}],
    "actions": [{"type": "device_command", "deviceId": "light-1", "command": "on"}]
  }'
```

### Motion-activated lights (night only)

```bash
curl -X POST http://localhost:5182/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Night Motion Lights",
    "triggers": [{
      "type": "device_state",
      "deviceId": "motion-1",
      "attribute": "motion",
      "operator": "equals",
      "value": "active"
    }],
    "conditions": [{
      "type": "time",
      "operator": "between",
      "value": "sunset",
      "valueEnd": "sunrise"
    }],
    "actions": [
      {"type": "device_command", "deviceId": "light-1", "command": "on"},
      {"type": "delay", "seconds": 300},
      {"type": "device_command", "deviceId": "light-1", "command": "off"}
    ]
  }'
```

### Execute rule manually

```bash
curl -X POST http://localhost:5182/api/rules/local/<RULE_ID>/execute
```

### Disable rule

```bash
curl -X POST http://localhost:5182/api/rules/local/<RULE_ID>/disable
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PATCH, POST execute/enable/disable) |
| 201 | Created (POST create) |
| 400 | Validation error |
| 404 | Rule not found |
| 500 | Server error |

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| NOT_FOUND | 404 | Rule doesn't exist |
| INTERNAL_ERROR | 500 | Server error |

## Performance

| Operation | Expected Time |
|-----------|---------------|
| List rules | < 10ms |
| Get rule | < 5ms |
| Create rule | < 20ms |
| Update rule | < 20ms |
| Delete rule | < 10ms |
| Execute rule | < 100ms (simple) |

## Tips

### 1. Test with curl

```bash
# Save to variable
RULE_ID=$(curl -s -X POST http://localhost:5182/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","triggers":[...],"actions":[...]}' \
  | jq -r '.data.id')

# Use in subsequent requests
curl http://localhost:5182/api/rules/local/$RULE_ID
```

### 2. Pretty-print responses

```bash
curl http://localhost:5182/api/rules/local | jq
```

### 3. Watch for validation errors

```bash
curl -X POST http://localhost:5182/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{"name":""}' | jq '.error.details'
```

### 4. Check rule execution results

```bash
curl -X POST http://localhost:5182/api/rules/local/$RULE_ID/execute \
  | jq '.data.actionResults'
```

## TypeScript Client Example

```typescript
import type { Rule, CreateRuleRequest } from './types/rules';

const API_BASE = 'http://localhost:5182/api/rules/local';

// List all rules
async function listRules(): Promise<Rule[]> {
  const response = await fetch(API_BASE);
  const { data } = await response.json();
  return data.rules;
}

// Create rule
async function createRule(rule: CreateRuleRequest): Promise<Rule> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  const { data } = await response.json();
  return data;
}

// Execute rule
async function executeRule(ruleId: string): Promise<void> {
  await fetch(`${API_BASE}/${ruleId}/execute`, { method: 'POST' });
}
```

## Related Documentation

- [Full API Documentation](./RULES-ENGINE-API.md)
- [Implementation Summary](../implementation/RULES-ENGINE-API-IMPLEMENTATION-SUMMARY.md)
- [Integration Guide](../implementation/RULES-ENGINE-ROUTES-INTEGRATION.md)
