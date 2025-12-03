# setLevel API Implementation Design (1M-560)

**Research Date:** 2025-12-03
**Ticket:** 1M-560 (BLOCKER)
**Researcher:** Research Agent
**Status:** CRITICAL - Blocks ALL dimmer devices (Brilliant, Lutron, Tuya, standard dimmers)

---

## Executive Summary

The `DimmerControl.svelte` component has an unimplemented `setLevel()` method (line 103) that prevents users from controlling dimmer brightness via the web UI. This affects ALL dimmer-capable devices across all platforms.

**Impact:**
- ❌ Brilliant dimmers (100% affected)
- ❌ Lutron dimmers (100% affected)
- ❌ Standard SmartThings dimmers (100% affected)
- ❌ Tuya dimmers (when implemented)

**Solution:** Add `POST /api/devices/:deviceId/level` endpoint following existing control patterns (on/off).

**Estimated Effort:** 1-2 hours (straightforward implementation following established patterns)

---

## 1. Current State Analysis

### 1.1 Frontend Component (DimmerControl.svelte)

**Location:** `web/src/lib/components/devices/controls/DimmerControl.svelte`

**Current Implementation:**
```typescript
// Lines 101-104
async function setBrightness(level: number) {
  console.log('Set brightness to', level);
  // API call will be implemented when setLevel endpoint is added
}
```

**Component Features:**
- ✅ On/off toggle (working via `apiClient.turnOnDevice/turnOffDevice`)
- ✅ Range slider (0-100%)
- ✅ Debouncing (300ms delay to reduce API calls)
- ✅ Optimistic UI updates
- ❌ **MISSING:** Brightness API integration

**User Flow:**
1. User drags brightness slider (0-100%)
2. UI updates immediately (optimistic)
3. Debounced call to `setBrightness(level)` after 300ms
4. **BLOCKED:** No API endpoint to call

### 1.2 Frontend API Client

**Location:** `web/src/lib/api/client.ts`

**Current Methods:**
```typescript
// Existing control methods
async turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>>
async turnOffDevice(deviceId: DeviceId): Promise<DirectResult<void>>
```

**Missing Method:**
```typescript
// NEEDED
async setDeviceLevel(deviceId: DeviceId, level: number): Promise<DirectResult<void>>
```

### 1.3 Backend Infrastructure

**Location:** `src/server-alexa.ts`

**Existing Control Endpoints:**
```typescript
// ✅ Implemented
POST /api/devices/:deviceId/on   // Lines 337-381
POST /api/devices/:deviceId/off  // Lines 384-428

// ❌ Missing
POST /api/devices/:deviceId/level
```

**Existing Pattern:**
1. Extract `deviceId` from route params
2. Get `ToolExecutor` instance
3. Call executor method (`turnOnDevice`, `turnOffDevice`)
4. Broadcast state change via SSE
5. Return `DirectResult<void>`

### 1.4 SmartThings Adapter

**Location:** `src/platforms/smartthings/SmartThingsAdapter.ts`

**Capability Mapping (Lines 661, 712):**
```typescript
// Platform → Unified
switchLevel: DeviceCapability.DIMMER

// Unified → Platform
[DeviceCapability.DIMMER]: 'switchLevel'
```

**Command Execution (Lines 458-550):**
The `executeCommand()` method already supports `switchLevel` capability via the generic command interface:

```typescript
await this.client!.devices.executeCommand(platformDeviceId, {
  capability: 'switchLevel',
  command: 'setLevel',
  arguments: [level],  // e.g., [50] for 50%
  component: 'main',
});
```

**SmartThings API Details:**
- **Endpoint:** `POST /devices/{deviceId}/commands`
- **Capability:** `switchLevel`
- **Command:** `setLevel`
- **Arguments:** `[level]` (integer 0-100)

---

## 2. SmartThings API Reference

### 2.1 Command Structure

**Request Format:**
```json
POST https://api.smartthings.com/v1/devices/{deviceId}/commands

{
  "commands": [
    {
      "component": "main",
      "capability": "switchLevel",
      "command": "setLevel",
      "arguments": [75]
    }
  ]
}
```

**Response Format:**
```json
{
  "results": [
    {
      "status": "ACCEPTED"
    }
  ]
}
```

### 2.2 Capability: switchLevel

**Commands:**
- `setLevel(level)`: Set brightness (0-100)
- `setLevel(level, duration)`: Set brightness with transition time

**Attributes:**
- `level`: Current brightness (0-100)

**Example Usage:**
```typescript
// Set to 50% brightness
await adapter.executeCommand(deviceId, {
  capability: DeviceCapability.DIMMER,
  command: 'setLevel',
  parameters: { level: 50 }
});
```

---

## 3. Implementation Plan

### 3.1 Backend: Add ToolExecutor Method

**File:** `src/direct/ToolExecutor.ts`

**Add Method:**
```typescript
/**
 * Set device brightness level (dimmers only)
 *
 * @param deviceId Universal device ID
 * @param level Brightness level (0-100)
 * @returns DirectResult indicating success
 */
async setDeviceLevel(deviceId: DeviceId, level: number): Promise<DirectResult<void>> {
  // Validate level range
  if (level < 0 || level > 100) {
    return {
      success: false,
      error: {
        code: 'INVALID_PARAMETER',
        message: `Level must be between 0 and 100, got ${level}`
      }
    };
  }

  // Execute command via device adapter
  const result = await handleSetLevel({ deviceId, level });
  return unwrapMcpResult<void>(result);
}
```

**Estimated Lines:** ~20 lines

### 3.2 Backend: Add MCP Tool Handler

**File:** `src/mcp/tools/device-control.ts`

**Add Schema:**
```typescript
const setLevelSchema = z.object({
  deviceId: deviceIdSchema,
  level: z.number().min(0).max(100).describe('Brightness level (0-100)'),
});
```

**Add Handler:**
```typescript
export async function handleSetLevel(
  input: z.infer<typeof setLevelSchema>
): Promise<McpToolResult> {
  try {
    const { deviceId, level } = setLevelSchema.parse(input);

    const command: DeviceCommand = {
      capability: DeviceCapability.DIMMER,
      command: 'setLevel',
      parameters: { level },
    };

    await getAdapter().executeCommand(deviceId as string, command);

    return createMcpSuccessResult(
      `Set device ${deviceId} to ${level}% brightness`
    );
  } catch (error) {
    return createMcpErrorResult(
      error instanceof Error ? error.message : 'Failed to set level'
    );
  }
}
```

**Estimated Lines:** ~30 lines

### 3.3 Backend: Add API Endpoint

**File:** `src/server-alexa.ts`

**Add Route (after line 428):**
```typescript
/**
 * POST /api/devices/:deviceId/level - Set device brightness level
 *
 * Request Body:
 * {
 *   "level": 75  // 0-100
 * }
 */
server.post('/api/devices/:deviceId/level', async (request, reply) => {
  const startTime = Date.now();
  const { deviceId } = request.params as { deviceId: string };
  const { level } = request.body as { level: number };

  try {
    logger.debug('POST /api/devices/:deviceId/level', { deviceId, level });

    // Validate level
    if (level === undefined || level < 0 || level > 100) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'Level must be a number between 0 and 100',
        },
      });
    }

    const executor = getToolExecutor();
    const result = await executor.setDeviceLevel(deviceId as DeviceId, level);

    const duration = Date.now() - startTime;

    if (result.success) {
      // Broadcast state change to SSE clients
      broadcastDeviceStateChange(deviceId, { level });

      logger.debug('Device level set', { deviceId, level, duration });
      return { success: true, data: null };
    } else {
      // Error case
      logger.error('Failed to set device level', {
        deviceId,
        level,
        error: result.error.message,
        duration,
      });
      return reply.code(500).send(result);
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Error setting device level', {
      deviceId,
      level,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});
```

**Estimated Lines:** ~55 lines

### 3.4 Frontend: Add API Client Method

**File:** `web/src/lib/api/client.ts`

**Add Method (after line 64):**
```typescript
/**
 * Set device brightness level (dimmers only)
 *
 * @param deviceId Device ID
 * @param level Brightness level (0-100)
 * @returns DirectResult indicating success
 */
async setDeviceLevel(deviceId: DeviceId, level: number): Promise<DirectResult<void>> {
  const response = await fetch(`${this.baseUrl}/devices/${deviceId}/level`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level }),
  });
  return response.json();
}
```

**Estimated Lines:** ~15 lines

### 3.5 Frontend: Integrate API Call

**File:** `web/src/lib/components/devices/controls/DimmerControl.svelte`

**Update Method (lines 101-104):**
```typescript
/**
 * Set brightness via API
 */
async function setBrightness(level: number) {
  if (!device.online || loading) return;

  loading = true;
  const originalLevel = brightness;

  try {
    const result = await apiClient.setDeviceLevel(
      device.platformDeviceId as any,
      level
    );

    if (!result.success) {
      // Revert on error
      brightness = originalLevel;
      console.error('Failed to set brightness:', result.error.message);
    }
  } catch (error) {
    // Revert on error
    brightness = originalLevel;
    console.error('Error setting brightness:', error);
  } finally {
    loading = false;
  }
}
```

**Estimated Lines:** ~25 lines (replaces 4 existing lines)

---

## 4. Testing Requirements

### 4.1 Backend Unit Tests

**File:** `tests/unit/mcp/tools/device-control.test.ts`

**Test Cases:**
```typescript
describe('handleSetLevel', () => {
  it('should set device level to 50%', async () => {
    const result = await handleSetLevel({
      deviceId: 'test-dimmer-123',
      level: 50,
    });

    expect(result.success).toBe(true);
  });

  it('should reject level > 100', async () => {
    const result = await handleSetLevel({
      deviceId: 'test-dimmer-123',
      level: 150,
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_PARAMETER');
  });

  it('should reject level < 0', async () => {
    const result = await handleSetLevel({
      deviceId: 'test-dimmer-123',
      level: -10,
    });

    expect(result.success).toBe(false);
  });
});
```

### 4.2 Integration Tests

**File:** `tests/integration/dimmer-control.test.ts`

**Test Cases:**
```typescript
describe('Dimmer Control Integration', () => {
  it('should set brightness via API endpoint', async () => {
    const response = await fetch(
      'http://localhost:5182/api/devices/test-dimmer/level',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 75 }),
      }
    );

    const result = await response.json();
    expect(result.success).toBe(true);
  });

  it('should reject invalid level', async () => {
    const response = await fetch(
      'http://localhost:5182/api/devices/test-dimmer/level',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 150 }),
      }
    );

    expect(response.status).toBe(400);
  });
});
```

### 4.3 Manual Testing

**Test Devices:**
1. Brilliant dimmer switch
2. Lutron Caséta dimmer
3. Standard SmartThings dimmer

**Test Steps:**
1. Open web UI at http://localhost:5181
2. Navigate to device with DIMMER capability
3. Verify brightness slider appears when device is ON
4. Drag slider to 75%
5. Wait 300ms (debounce)
6. Verify device brightness changes physically
7. Verify slider shows loading indicator
8. Verify no console errors

**Expected Results:**
- ✅ Device brightness changes to 75%
- ✅ Slider updates smoothly without lag
- ✅ API calls debounced (max 1 call per 300ms)
- ✅ Loading indicator shows during API call
- ✅ SSE broadcasts state change to other clients

---

## 5. Error Handling

### 5.1 Validation Errors

**Invalid Level:**
```json
POST /api/devices/abc-123/level
{ "level": 150 }

Response: 400 Bad Request
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Level must be a number between 0 and 100"
  }
}
```

### 5.2 Device Errors

**Device Not Found:**
```json
POST /api/devices/nonexistent/level
{ "level": 50 }

Response: 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device 'nonexistent' not found"
  }
}
```

**Capability Not Supported:**
```json
POST /api/devices/simple-switch/level
{ "level": 50 }

Response: 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "CAPABILITY_NOT_SUPPORTED",
    "message": "Device does not support DIMMER capability"
  }
}
```

### 5.3 Network Errors

**Frontend Handling:**
```typescript
try {
  const result = await apiClient.setDeviceLevel(deviceId, level);
  if (!result.success) {
    // Revert UI + show error
    brightness = originalLevel;
    showToast('Failed to set brightness', 'error');
  }
} catch (error) {
  // Network error - revert UI
  brightness = originalLevel;
  showToast('Connection error', 'error');
}
```

---

## 6. Implementation Checklist

### Backend
- [ ] Add `setDeviceLevel()` method to `ToolExecutor` class
- [ ] Add `handleSetLevel()` MCP tool handler
- [ ] Add `POST /api/devices/:deviceId/level` endpoint
- [ ] Add SSE broadcast for level changes
- [ ] Write unit tests for `handleSetLevel()`
- [ ] Write integration tests for API endpoint

### Frontend
- [ ] Add `setDeviceLevel()` method to `ApiClient` class
- [ ] Update `setBrightness()` in `DimmerControl.svelte`
- [ ] Add error handling and UI reversion
- [ ] Test with Brilliant dimmers
- [ ] Test with Lutron dimmers
- [ ] Test with standard SmartThings dimmers

### Documentation
- [ ] Update API documentation with `/level` endpoint
- [ ] Add JSDoc comments to new methods
- [ ] Update capability mapping guide (if needed)

---

## 7. Code Examples

### 7.1 Complete Backend Endpoint

```typescript
// src/server-alexa.ts (insert after line 428)

/**
 * POST /api/devices/:deviceId/level - Set device brightness level
 *
 * Body: { level: number }  // 0-100
 */
server.post('/api/devices/:deviceId/level', async (request, reply) => {
  const startTime = Date.now();
  const { deviceId } = request.params as { deviceId: string };
  const { level } = request.body as { level: number };

  try {
    logger.debug('POST /api/devices/:deviceId/level', { deviceId, level });

    // Validate level
    if (level === undefined || level < 0 || level > 100) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'Level must be a number between 0 and 100',
        },
      });
    }

    const executor = getToolExecutor();
    const result = await executor.setDeviceLevel(deviceId as DeviceId, level);

    const duration = Date.now() - startTime;

    if (result.success) {
      broadcastDeviceStateChange(deviceId, { level });
      logger.debug('Device level set', { deviceId, level, duration });
      return { success: true, data: null };
    } else {
      logger.error('Failed to set device level', {
        deviceId,
        level,
        error: result.error.message,
        duration,
      });
      return reply.code(500).send(result);
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Error setting device level', {
      deviceId,
      level,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});
```

### 7.2 Complete Frontend Integration

```typescript
// web/src/lib/components/devices/controls/DimmerControl.svelte
// Replace lines 101-104 with:

/**
 * Set brightness via API
 */
async function setBrightness(level: number) {
  if (!device.online || loading) return;

  loading = true;
  const originalLevel = brightness;

  try {
    const result = await apiClient.setDeviceLevel(
      device.platformDeviceId as any,
      level
    );

    if (!result.success) {
      brightness = originalLevel;
      console.error('Failed to set brightness:', result.error.message);
    }
  } catch (error) {
    brightness = originalLevel;
    console.error('Error setting brightness:', error);
  } finally {
    loading = false;
  }
}
```

---

## 8. Estimated Effort

| Task | Lines of Code | Time Estimate |
|------|--------------|---------------|
| Backend: ToolExecutor method | ~20 | 15 min |
| Backend: MCP tool handler | ~30 | 20 min |
| Backend: API endpoint | ~55 | 30 min |
| Frontend: API client method | ~15 | 10 min |
| Frontend: Component integration | ~25 | 15 min |
| Unit tests | ~50 | 20 min |
| Integration tests | ~40 | 20 min |
| Manual testing | N/A | 30 min |

**Total Estimated Time:** 2 hours 40 minutes

**Confidence:** HIGH (following established patterns, no complex logic)

---

## 9. Related Tickets

- **1M-560:** Set dimmer level API implementation (THIS TICKET)
- **1M-559:** Brilliant device auto-detection (depends on dimmer working)
- Related to all dimmer device functionality

---

## 10. Next Steps

1. **Implement Backend** (1 hour):
   - Add `setDeviceLevel()` to `ToolExecutor`
   - Add `handleSetLevel()` MCP tool
   - Add `/level` API endpoint
   - Write unit tests

2. **Implement Frontend** (30 min):
   - Add `setDeviceLevel()` to `ApiClient`
   - Update `setBrightness()` in `DimmerControl`
   - Add error handling

3. **Test** (30 min):
   - Test with Brilliant dimmers
   - Test with Lutron dimmers
   - Test with standard SmartThings dimmers
   - Verify debouncing works
   - Verify SSE broadcasts state changes

4. **Document** (10 min):
   - Update API docs
   - Add JSDoc comments

---

## 11. Risk Assessment

**Technical Risks:** NONE
- Following proven patterns from existing `on/off` endpoints
- SmartThings adapter already supports `switchLevel` capability
- No complex state management required

**Testing Risks:** LOW
- Can test with multiple device types (Brilliant, Lutron, standard)
- Debouncing already implemented in component

**Deployment Risks:** NONE
- Non-breaking change (adds new endpoint)
- No database migrations required
- No configuration changes needed

---

## Appendix A: SmartThings Adapter Command Flow

```
Frontend Slider Change (0-100%)
    ↓
apiClient.setDeviceLevel(deviceId, level)
    ↓
POST /api/devices/:deviceId/level { level }
    ↓
executor.setDeviceLevel(deviceId, level)
    ↓
handleSetLevel({ deviceId, level })
    ↓
adapter.executeCommand(deviceId, {
  capability: DeviceCapability.DIMMER,
  command: 'setLevel',
  parameters: { level }
})
    ↓
SmartThings API: POST /devices/{id}/commands
{
  "commands": [{
    "component": "main",
    "capability": "switchLevel",
    "command": "setLevel",
    "arguments": [level]
  }]
}
    ↓
Device brightness changes physically
    ↓
SSE broadcast: { deviceId, level }
    ↓
Other clients update UI
```

---

## Appendix B: Existing Patterns

### Pattern 1: API Endpoint Structure

```typescript
server.post('/api/devices/:deviceId/:action', async (request, reply) => {
  const startTime = Date.now();
  const { deviceId } = request.params;

  try {
    logger.debug('POST /api/devices/:deviceId/:action', { deviceId });
    const executor = getToolExecutor();
    const result = await executor.someMethod(deviceId);
    const duration = Date.now() - startTime;

    if (result.success) {
      broadcastDeviceStateChange(deviceId, { newState });
      logger.debug('Action completed', { deviceId, duration });
      return { success: true, data: null };
    } else {
      logger.error('Action failed', { deviceId, error: result.error.message, duration });
      return reply.code(500).send(result);
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Error during action', {
      deviceId,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});
```

### Pattern 2: Frontend API Client

```typescript
async someMethod(deviceId: DeviceId): Promise<DirectResult<void>> {
  const response = await fetch(`${this.baseUrl}/devices/${deviceId}/action`, {
    method: 'POST'
  });
  return response.json();
}
```

### Pattern 3: Frontend Component

```typescript
async function performAction() {
  if (!device.online || loading) return;

  loading = true;
  const originalState = currentState;

  try {
    const result = await apiClient.someMethod(device.platformDeviceId as any);

    if (!result.success) {
      currentState = originalState;
      console.error('Failed:', result.error.message);
    }
  } catch (error) {
    currentState = originalState;
    console.error('Error:', error);
  } finally {
    loading = false;
  }
}
```

---

**End of Research Document**
