# Rules Engine API - Integration Checklist

**Use this checklist when integrating the Rules Engine API into the server.**

## Pre-Integration

- [ ] Review implementation summary: `docs/implementation/RULES-ENGINE-API-IMPLEMENTATION-SUMMARY.md`
- [ ] Review API documentation: `docs/api/RULES-ENGINE-API.md`
- [ ] Verify all dependencies exist:
  - [ ] `src/rules/storage.ts`
  - [ ] `src/rules/executor.ts`
  - [ ] `src/rules/types.ts`
  - [ ] `src/utils/logger.ts`

## Code Integration

### Step 1: Add Import to `src/server-alexa.ts`

Location: Around line 82 (after other route imports)

```typescript
import { registerLocalRulesRoutes, setAdapterForRules } from './routes/rules-local.js';
```

- [ ] Import added
- [ ] No TypeScript errors

### Step 2: Register Routes in `registerRoutes()` Function

Location: Around line 1780 (after polling routes)

```typescript
  // ====================================================================
  // Local Rules Routes (for automation rules management)
  // ====================================================================
  try {
    await registerLocalRulesRoutes(server, smartThingsAdapter);
    logger.info('Local rules routes registered successfully');
  } catch (error) {
    logger.error('Failed to register local rules routes', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail server startup - rules engine is optional
  }
```

- [ ] Routes registered
- [ ] Try-catch includes error handling
- [ ] Logger messages added

### Step 3: Build and Type Check

```bash
# Type check
npx tsc --noEmit

# Build
pnpm build

# Or quick build
pnpm build:dev
```

- [ ] No TypeScript errors
- [ ] Build successful

## Testing

### Step 4: Start Server

```bash
# Full stack
pnpm start:dev

# Or backend only
pnpm dev
```

- [ ] Server starts without errors
- [ ] Logs show "Local rules routes registered successfully"

### Step 5: Health Check

```bash
curl http://localhost:5182/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "mcp-smarterthings-alexa",
  ...
}
```

- [ ] Health endpoint responds
- [ ] Server is healthy

### Step 6: Test List Rules Endpoint

```bash
curl http://localhost:5182/api/rules/local
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "rules": [],
    "count": 0,
    "enabledCount": 0
  }
}
```

- [ ] Endpoint responds with 200
- [ ] Response structure matches expected format
- [ ] Empty rules array (initial state)

### Step 7: Test Create Rule Endpoint

```bash
curl -X POST http://localhost:5182/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rule",
    "description": "Integration test rule",
    "triggers": [{
      "type": "device_state",
      "deviceId": "test-device",
      "attribute": "switch",
      "operator": "equals",
      "value": "on"
    }],
    "actions": [{
      "type": "device_command",
      "deviceId": "test-light",
      "command": "on"
    }]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_...",
    "name": "Test Rule",
    "enabled": true,
    ...
  }
}
```

- [ ] Endpoint responds with 201
- [ ] Response includes rule ID
- [ ] Rule fields match request

**Save Rule ID for next tests:**
```bash
export RULE_ID="<paste-rule-id-here>"
```

### Step 8: Test Get Rule Endpoint

```bash
curl http://localhost:5182/api/rules/local/$RULE_ID
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_...",
    "name": "Test Rule",
    ...
  }
}
```

- [ ] Endpoint responds with 200
- [ ] Rule details match created rule

### Step 9: Test Update Rule Endpoint

```bash
curl -X PATCH http://localhost:5182/api/rules/local/$RULE_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Test Rule"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_...",
    "name": "Updated Test Rule",
    ...
  }
}
```

- [ ] Endpoint responds with 200
- [ ] Rule name updated
- [ ] Other fields unchanged

### Step 10: Test Execute Rule Endpoint

```bash
curl -X POST http://localhost:5182/api/rules/local/$RULE_ID/execute
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "ruleId": "rule_...",
    "success": true,
    "actionsExecuted": 1,
    ...
  }
}
```

- [ ] Endpoint responds with 200
- [ ] Execution result returned
- [ ] Actions executed (check logs)

### Step 11: Test Disable Rule Endpoint

```bash
curl -X POST http://localhost:5182/api/rules/local/$RULE_ID/disable
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_...",
    "enabled": false,
    ...
  }
}
```

- [ ] Endpoint responds with 200
- [ ] Rule disabled

### Step 12: Test Enable Rule Endpoint

```bash
curl -X POST http://localhost:5182/api/rules/local/$RULE_ID/enable
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule_...",
    "enabled": true,
    ...
  }
}
```

- [ ] Endpoint responds with 200
- [ ] Rule re-enabled

### Step 13: Test Delete Rule Endpoint

```bash
curl -X DELETE http://localhost:5182/api/rules/local/$RULE_ID
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Rule deleted"
}
```

- [ ] Endpoint responds with 200
- [ ] Rule deleted

### Step 14: Verify Rule Deleted

```bash
curl http://localhost:5182/api/rules/local/$RULE_ID
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Rule not found"
  }
}
```

- [ ] Endpoint responds with 404
- [ ] Error message correct

### Step 15: Test Validation Errors

```bash
curl -X POST http://localhost:5182/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "triggers": [],
    "actions": []
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid rule data",
    "details": [...]
  }
}
```

- [ ] Endpoint responds with 400
- [ ] Validation errors returned
- [ ] Error details include field paths

## Post-Integration

### Step 16: Check Server Logs

```bash
tail -f logs/combined.log
# Or check stdout if running with pnpm dev
```

**Look for:**
- [x] "Local rules routes registered successfully"
- [x] No errors during route registration
- [x] Request logs for each API call
- [x] Execution logs with timing

- [ ] Logs show successful initialization
- [ ] No errors in logs
- [ ] Request/response logs present

### Step 17: Performance Check

**Verify timing in logs:**
- [ ] List rules: < 10ms
- [ ] Get rule: < 5ms
- [ ] Create rule: < 20ms
- [ ] Update rule: < 20ms
- [ ] Delete rule: < 10ms

### Step 18: Storage Persistence

```bash
# Check storage file created
ls -lh data/rules.json

# Restart server
pnpm start:dev

# Verify rules persisted
curl http://localhost:5182/api/rules/local
```

- [ ] Storage file exists
- [ ] Rules survive server restart
- [ ] No data loss

## Integration Complete

- [ ] All endpoints working
- [ ] No errors in server logs
- [ ] Performance targets met
- [ ] Storage persistence verified
- [ ] Validation working correctly
- [ ] Error handling correct

## Rollback (If Needed)

If any issues occur, rollback by:

1. Comment out route registration in `src/server-alexa.ts`:
```typescript
  // TEMPORARILY DISABLED
  // try {
  //   await registerLocalRulesRoutes(server, smartThingsAdapter);
  //   ...
  // }
```

2. Restart server:
```bash
pnpm start:dev
```

3. Verify server works without rules routes:
```bash
curl http://localhost:5182/health
```

- [ ] Rollback successful (if needed)
- [ ] Server functional without rules routes

## Next Steps

After successful integration:

- [ ] Create frontend UI components
- [ ] Add integration tests
- [ ] Implement event triggers
- [ ] Add time-based triggers (cron)
- [ ] Connect to LLM for natural language rules

## Documentation

- [x] API Reference: `docs/api/RULES-ENGINE-API.md`
- [x] Quick Reference: `docs/api/RULES-API-QUICK-REFERENCE.md`
- [x] Implementation Summary: `docs/implementation/RULES-ENGINE-API-IMPLEMENTATION-SUMMARY.md`
- [x] Integration Guide: `docs/implementation/RULES-ENGINE-ROUTES-INTEGRATION.md`
- [x] Integration Checklist: This document

---

**Integration Date**: _____________

**Integrated By**: _____________

**Issues Encountered**: _____________

**Notes**: _____________
