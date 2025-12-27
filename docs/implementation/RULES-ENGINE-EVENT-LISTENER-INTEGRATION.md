# Rules Engine Event Listener Integration

**Implementation Date:** 2025-12-22
**Component:** Rules Engine Event-Driven Automation
**Status:** ✅ Complete

## Overview

Integrated the Rules Engine with the Device Polling Service to enable automatic rule triggering on device state changes. This transforms the local rules engine from manual-only execution to a fully event-driven automation system.

## Architecture

### Event Flow

```
Device State Change
    ↓
DevicePollingService detects change
    ↓
Emits 'deviceEvent' → { deviceId, attribute, value, previousValue, ... }
    ↓
RulesEventListener receives event
    ↓
Find matching rules (storage.findMatchingRules)
    ↓
Execute each matching rule (executeMatchingRules)
    ↓
Track statistics and log results
```

### Integration Points

1. **DevicePollingService** (`src/services/device-polling-service.ts`)
   - Emits `'deviceEvent'` when device state changes detected
   - Event format includes device ID, attribute, old/new values

2. **RulesEventListener** (`src/rules/event-listener.ts`) 🆕
   - Singleton service that bridges polling and rules execution
   - Subscribes to polling service events
   - Evaluates and executes matching rules automatically

3. **RulesExecutor** (`src/rules/executor.ts`)
   - Provides `executeMatchingRules()` to find and execute rules
   - Already supported device event context

4. **Server Initialization** (`src/server-alexa.ts`)
   - Initializes listener on startup (if adapter ready)
   - Connects listener to polling service
   - Handles graceful shutdown

## Implementation Details

### New File: `src/rules/event-listener.ts`

**Key Features:**
- **Event Subscription:** Listens to `'deviceEvent'` from polling service
- **Automatic Execution:** Evaluates and executes matching rules on every state change
- **Statistics Tracking:** Counts processed events, triggered rules, failures
- **Enable/Disable:** Can be toggled on/off without disconnecting
- **Graceful Shutdown:** Properly disconnects on server shutdown

**API:**
```typescript
// Singleton access
const listener = getRulesEventListener();

// Initialize with SmartThings adapter
await listener.initialize(smartThingsAdapter);

// Connect to polling service
listener.connectToPollingService(pollingService);

// Get statistics
const stats = listener.getStats();
// { initialized, enabled, connected, processedEvents, rulesTriggered, rulesFailed }

// Enable/disable rule processing
listener.setEnabled(false); // Pause rule execution

// Disconnect
listener.disconnect();
```

### Server Integration

**Startup Sequence (`src/server-alexa.ts`):**
1. Initialize SmartThings adapter (if credentials available)
2. Auto-start device polling (if `AUTO_START_POLLING` env var set)
3. **Initialize rules event listener** 🆕
4. **Connect listener to polling service** 🆕
5. Start listening on port

**Graceful Shutdown:**
1. **Disconnect rules event listener** 🆕
2. Stop device polling service
3. Close message queue
4. Close event store
5. Close server

## Usage Example

### Create a Rule via API

```bash
curl -X POST http://localhost:3000/api/rules/local \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Motion Alert - Turn On Lights",
    "description": "When motion detected, turn on all lights",
    "enabled": true,
    "trigger": {
      "type": "device_state",
      "deviceId": "motion-sensor-id",
      "attribute": "motion",
      "comparison": "equals",
      "value": "active"
    },
    "actions": [
      {
        "type": "device_command",
        "deviceId": "light-1",
        "command": "on"
      },
      {
        "type": "device_command",
        "deviceId": "light-2",
        "command": "on"
      }
    ]
  }'
```

### Automatic Execution

Once created, the rule will **automatically execute** when:
1. Device polling service detects motion sensor state change (`inactive` → `active`)
2. Polling service emits `deviceEvent`
3. Rules event listener receives event
4. Listener finds matching rule (device ID + attribute + value match)
5. Listener executes rule → turns on lights
6. Result logged and tracked in statistics

**No manual triggering required!**

## Logging

**On Successful Rule Execution:**
```
[RulesEventListener] Connected to polling service - rules will auto-trigger on device events
[DevicePolling] State change detected { deviceId, deviceName, attribute, previousValue, newValue }
[RulesEventListener] Executed rules for device event { deviceId, attribute, value, totalRules: 1, successful: 1, failed: 0 }
[RulesExecutor] Rule Motion Alert - Turn On Lights completed in 245ms
```

**On No Matching Rules:**
```
[DevicePolling] State change detected { deviceId, attribute, value }
[RulesEventListener] No matching rules for event { deviceId, attribute, value }
```

**On Rule Execution Failure:**
```
[RulesEventListener] Executed rules for device event { totalRules: 1, successful: 0, failed: 1 }
[RulesEventListener] Rule execution failed { ruleId, ruleName, error: "Device not found" }
```

## Configuration

**Environment Variable:**
```bash
# Enable auto-start of device polling (which enables rule auto-triggering)
AUTO_START_POLLING=true
```

**Default Polling Configuration:**
- **Interval:** 5 seconds (5000ms)
- **Monitored Capabilities:**
  - `motionSensor` (motion: active/inactive)
  - `contactSensor` (contact: open/closed)
  - `switch` (switch: on/off)
  - `dimmer` (level: 0-100)
  - `lock` (lock: locked/unlocked)
  - `temperatureSensor` (temperature: number)

## Statistics API

**Endpoint:** `GET /api/polling/status`

```json
{
  "running": true,
  "pollCount": 150,
  "changeCount": 5,
  "trackedDevices": 42,
  "intervalMs": 5000,
  "rulesListener": {
    "initialized": true,
    "enabled": true,
    "connected": true,
    "processedEvents": 5,
    "rulesTriggered": 3,
    "rulesFailed": 0
  }
}
```

## Error Handling

- **No Adapter:** Listener initializes but logs warning if adapter not available
- **Event Processing Error:** Logs error but continues processing future events
- **Rule Execution Failure:** Tracks in `rulesFailed` counter, logs warning
- **Graceful Degradation:** If listener fails to initialize, polling still works (just no auto-rules)

## Testing Recommendations

1. **Unit Tests:** Test event listener in isolation with mock polling service
2. **Integration Tests:** Test end-to-end flow from polling → listener → executor
3. **Manual Testing:**
   - Create a rule via API
   - Manually trigger device state change
   - Verify rule executes automatically
   - Check logs for execution confirmation

## Future Enhancements

1. **Webhook Integration:** Also listen to webhook events for real-time triggering
2. **Rule Priorities:** Execute high-priority rules first
3. **Rate Limiting:** Prevent rule spam if device flaps
4. **Conditional Delays:** "If motion active for 30 seconds, then..."
5. **Event Buffering:** Batch multiple events before rule evaluation

## Related Documentation

- [Local Rules Engine Implementation](./LOCAL-RULES-ENGINE-IMPLEMENTATION.md)
- [Device Polling Service Implementation](./DEVICE-POLLING-IMPLEMENTATION.md)
- [Rules API Documentation](../api/rules-api.md)

## Migration Notes

No breaking changes. This is an additive feature:
- Existing manual rule execution via API still works
- Rules can be executed both manually AND automatically
- No changes required to rule schema or storage
