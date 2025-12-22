# SmartThings Command Format Fix

**Date**: 2025-12-21
**Issue**: Device toggle failing with SmartThings API error 422
**Root Cause**: Missing `component` field in command payload

## Problem

Device toggle operations were failing with this error from SmartThings API:

```json
{
  "code": "ConstraintViolationError",
  "message": "The request is malformed.",
  "details": [{
    "code": "NotValidValue",
    "target": "commands[0].capability",
    "message": "switch is not a valid value."
  }]
}
```

## Root Cause

The SmartThings SDK's `executeCommand` method was being called **without** the required `component` field.

### SmartThings API Requirements

According to [SmartThings API documentation](https://developer.smartthings.com/docs/api/public#operation/executeDeviceCommands), commands must include:

```json
{
  "commands": [
    {
      "component": "main",
      "capability": "switch",
      "command": "on"
    }
  ]
}
```

### Code Issue

In `src/smartthings/client.ts` (line 379), the command was missing the `component` field:

**BEFORE (broken):**
```typescript
await this.client.devices.executeCommand(platformDeviceId, {
  capability,
  command,
  arguments: args as (string | number | object)[] | undefined,
});
```

**AFTER (fixed):**
```typescript
await this.client.devices.executeCommand(platformDeviceId, {
  component: 'main',
  capability,
  command,
  arguments: args as (string | number | object)[] | undefined,
});
```

## Fix Applied

**File**: `src/smartthings/client.ts`
**Line**: 379
**Change**: Added `component: 'main'` to the command payload

## Testing

### Manual Testing Steps

1. Start the backend server: `pnpm dev`
2. Open the web UI: http://localhost:5181
3. Navigate to a room with switchable devices
4. Click the toggle switch on any device
5. Verify the device toggles successfully
6. Check browser console - should see no errors
7. Check server logs - should see successful command execution

### Expected Behavior

- ✅ Device should toggle on/off successfully
- ✅ UI should update to reflect new state
- ✅ No 422 errors in server logs
- ✅ No console errors in browser

## Impact

- **Scope**: All device control operations (on/off, setLevel, etc.)
- **Severity**: High - device control was completely broken
- **User Impact**: Device toggles now work as expected

## Related Files

- `src/smartthings/client.ts` - SmartThings service client (fixed)
- `src/platforms/smartthings/SmartThingsAdapter.ts` - Platform adapter (already had component field)
- `src/server-alexa.ts` - API endpoints for device control
- `web/src/lib/components/devices/DeviceCard.svelte` - UI component

## Notes

- The `SmartThingsAdapter.ts` already had the `component` field correctly set (line 550)
- Only `SmartThingsService` in `client.ts` was missing it
- Default component is `'main'` for most SmartThings devices
- Multi-component devices (e.g., switches with multiple outlets) may need different component IDs in future

## References

- [SmartThings API - Execute Device Commands](https://developer.smartthings.com/docs/api/public#operation/executeDeviceCommands)
- [SmartThings Device Capabilities](https://developer.smartthings.com/docs/devices/capabilities/capabilities-reference)
