# Direct Mode API Documentation

> **Type-Safe In-Process Tool Execution for LLM Controllers**
> Direct Mode provides a TypeScript API for calling MCP tools without protocol overhead, offering 5-10% performance improvement with zero breaking changes.

**Ticket:** [1M-412](https://linear.app/bobmatnyc/issue/1M-412) - Phase 4.2: Create Direct Mode API for in-process tool calls

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%2B-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-69%20Passing-green)](../../tests/)
[![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)](../../tests/)

---

## Table of Contents

- [Overview](#overview)
- [When to Use Direct Mode](#when-to-use-direct-mode)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
  - [Initialization](#initialization)
  - [Basic Operations](#basic-operations)
  - [Error Handling](#error-handling)
  - [Type Safety Features](#type-safety-features)
- [API Reference](#api-reference)
  - [Device Control](#device-control)
  - [Device Query](#device-query)
  - [Scenes](#scenes)
  - [System](#system)
  - [Management](#management)
  - [Diagnostics](#diagnostics)
  - [System Status](#system-status)
  - [Automation](#automation)
- [Performance](#performance)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

**Direct Mode** is a TypeScript API that enables LLM controllers and custom applications to execute MCP tools directly within the same Node.js process, bypassing JSON-RPC protocol marshalling. This provides type-safe, zero-overhead access to all SmartThings functionality.

### Direct Mode vs MCP Mode

| Feature | **Direct Mode** | **MCP Mode** |
|---------|----------------|--------------|
| **Interface** | TypeScript API | JSON-RPC Protocol |
| **Transport** | In-process function calls | stdio/HTTP/SSE |
| **Performance** | 5-10% faster | Baseline |
| **Type Safety** | Full TypeScript support | JSON schema validation |
| **Error Handling** | `DirectResult<T>` discriminated union | MCP error responses |
| **Use Case** | LLM controllers, custom apps | AI assistants (Claude, etc.) |
| **Breaking Changes** | None (purely additive) | N/A |

### Key Benefits

1. **Type Safety**: Full TypeScript type inference with branded types (`DeviceId`, `LocationId`, etc.)
2. **Zero Overhead**: Direct function calls eliminate JSON marshalling and protocol overhead
3. **Familiar API**: Same business logic as MCP tools, just with cleaner interfaces
4. **No Breaking Changes**: Existing MCP server continues to work unchanged
5. **Better DX**: IDE autocomplete, compile-time type checking, and inline documentation

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Your Application                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Direct Mode API (ToolExecutor)            │  │
│  │  • Type-safe wrapper methods (29 tools)          │  │
│  │  • DirectResult<T> discriminated unions          │  │
│  │  • Zero JSON marshalling                         │  │
│  └─────────────────┬─────────────────────────────────┘  │
└────────────────────┼────────────────────────────────────┘
                     │
                     │ Direct function calls
                     │
┌────────────────────▼────────────────────────────────────┐
│              MCP Tool Handlers (Shared)                 │
│  • Business logic and validation                        │
│  • SmartThings API integration                          │
│  • Error handling and logging                           │
│  • Used by BOTH Direct Mode AND MCP Server              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────────────────────┐
│                ServiceContainer                          │
│  • Dependency injection                                 │
│  • SmartThingsService                                   │
│  • Caching and state management                         │
└─────────────────────────────────────────────────────────┘
```

---

## When to Use Direct Mode

### ✅ Use Direct Mode When:

- **Building LLM Controllers**: TypeScript apps that orchestrate AI-driven workflows
- **Custom Automations**: Server-side automation scripts that need type safety
- **Integration Testing**: Testing SmartThings integrations with full type checking
- **High-Performance Apps**: Applications where 5-10% performance improvement matters
- **Single-Process Architecture**: Apps running in the same Node.js process

### ❌ Use MCP Mode When:

- **AI Assistants**: Integrating with Claude Desktop or other MCP-compatible clients
- **Multi-Language Clients**: Non-TypeScript/JavaScript clients
- **Cross-Process Communication**: Apps running in separate processes
- **Protocol Standardization**: Need standard MCP protocol compatibility

---

## Installation

Direct Mode is included in the main `@bobmatnyc/mcp-smarterthings` package:

```bash
npm install @bobmatnyc/mcp-smarterthings
# or
pnpm add @bobmatnyc/mcp-smarterthings
```

### Prerequisites

- **Node.js** 18.0.0 or higher
- **TypeScript** 5.6 or higher (for development)
- **SmartThings Personal Access Token** (PAT)

---

## Quick Start

Here's a minimal example to get started:

```typescript
import { createToolExecutor, isSuccess } from '@bobmatnyc/mcp-smarterthings/direct';
import { ServiceContainer } from '@bobmatnyc/mcp-smarterthings/services';
import { SmartThingsService } from '@bobmatnyc/mcp-smarterthings/smartthings';
import type { DeviceId } from '@bobmatnyc/mcp-smarterthings/types';

// 1. Initialize SmartThings service
const smartThingsService = new SmartThingsService({
  token: process.env.SMARTTHINGS_TOKEN!,
});

// 2. Create service container
const container = new ServiceContainer(smartThingsService);
await container.initialize();

// 3. Create Direct Mode executor
const executor = createToolExecutor(container);

// 4. Use type-safe API
const result = await executor.turnOnDevice('device-uuid' as DeviceId);

if (isSuccess(result)) {
  console.log('✓ Device turned on successfully');
} else {
  console.error(`✗ Error: ${result.error.message} (${result.error.code})`);
}

// 5. Cleanup
await container.dispose();
```

---

## Usage Guide

### Initialization

All Direct Mode operations require a `ServiceContainer` with an initialized `SmartThingsService`:

```typescript
import { SmartThingsService } from '@bobmatnyc/mcp-smarterthings/smartthings';
import { ServiceContainer } from '@bobmatnyc/mcp-smarterthings/services';
import { createToolExecutor } from '@bobmatnyc/mcp-smarterthings/direct';

// Step 1: Create SmartThings service
const smartThingsService = new SmartThingsService({
  token: process.env.SMARTTHINGS_TOKEN!,
  // Optional configuration:
  // timeout: 30000,      // Request timeout (default: 30s)
  // retryAttempts: 3,    // Retry failed requests (default: 3)
  // logLevel: 'info',    // Log level (default: 'info')
});

// Step 2: Create service container
const container = new ServiceContainer(smartThingsService);

// Step 3: Initialize (loads devices, rooms, locations into cache)
await container.initialize();

// Step 4: Create tool executor
const executor = createToolExecutor(container);

// Use executor for all operations...

// Step 5: Cleanup when done
await container.dispose();
```

### Basic Operations

#### Device Control

```typescript
import type { DeviceId } from '@bobmatnyc/mcp-smarterthings/types';

// Turn on device
const onResult = await executor.turnOnDevice('abc-123' as DeviceId);

// Turn off device
const offResult = await executor.turnOffDevice('abc-123' as DeviceId);

// Get device status
const statusResult = await executor.getDeviceStatus('abc-123' as DeviceId);
if (isSuccess(statusResult)) {
  console.log('Device:', statusResult.data.name);
  console.log('State:', statusResult.data.state);
}
```

#### Device Discovery

```typescript
// List all devices
const allDevices = await executor.listDevices();

// Filter by capability
const switches = await executor.listDevices({ capability: 'switch' });

// Filter by room
const livingRoom = await executor.listDevices({ roomName: 'Living Room' });

// List devices by room (alternative syntax)
const bedroom = await executor.listDevicesByRoom('Bedroom');

if (isSuccess(bedroom)) {
  console.log(`Found ${bedroom.data.length} devices in bedroom`);
}
```

#### Scene Execution

```typescript
import type { SceneId } from '@bobmatnyc/mcp-smarterthings/types';

// Execute scene
const sceneResult = await executor.executeScene('scene-uuid' as SceneId);

// List all scenes
const scenes = await executor.listScenes();

// List scenes by room
const livingRoomScenes = await executor.listScenesByRoom('Living Room');
```

### Error Handling

Direct Mode uses a **discriminated union** pattern for explicit error handling:

```typescript
import { isSuccess, isError } from '@bobmatnyc/mcp-smarterthings/direct';

const result = await executor.turnOnDevice(deviceId);

// Pattern 1: Type guard with discriminant
if (result.success) {
  // TypeScript knows this is success branch
  console.log('Success:', result.data);
} else {
  // TypeScript knows this is error branch
  console.error('Error:', result.error.code, result.error.message);
}

// Pattern 2: isSuccess() type guard
if (isSuccess(result)) {
  // result.data is accessible and typed
  console.log(result.data);
}

// Pattern 3: isError() type guard
if (isError(result)) {
  // result.error is accessible and typed
  console.error(`[${result.error.code}] ${result.error.message}`);
  if (result.error.details) {
    console.error('Details:', result.error.details);
  }
}

// Pattern 4: Early return pattern
if (isError(result)) {
  throw new Error(`Device control failed: ${result.error.message}`);
}
// Continue with success path
console.log('Device controlled:', result.data);
```

#### Common Error Codes

| Error Code | Description | Typical Cause |
|------------|-------------|---------------|
| `DEVICE_NOT_FOUND` | Device UUID not found | Invalid device ID or device removed |
| `CAPABILITY_NOT_SUPPORTED` | Device lacks required capability | Trying to dim a non-dimmable light |
| `VALIDATION_ERROR` | Input validation failed | Missing required parameters |
| `API_ERROR` | SmartThings API error | Network issues, API rate limits |
| `UNAUTHORIZED` | Authentication failed | Invalid or expired PAT token |
| `TIMEOUT` | Request timeout | SmartThings API slow or unreachable |
| `UNKNOWN_ERROR` | Unexpected error | Catch-all for unexpected failures |

### Type Safety Features

#### Branded Types

Direct Mode uses **branded types** to prevent mixing incompatible IDs:

```typescript
import type { DeviceId, RoomId, LocationId } from '@bobmatnyc/mcp-smarterthings/types';

// Type-safe ID usage
const deviceId: DeviceId = 'device-123' as DeviceId;
const roomId: RoomId = 'room-456' as RoomId;

// ✅ Correct usage
await executor.turnOnDevice(deviceId);

// ❌ Compile error - wrong type
await executor.turnOnDevice(roomId); // Type error!

// ✅ Type narrowing works correctly
function controlDevice(id: DeviceId) {
  // TypeScript knows id is a DeviceId
  return executor.turnOnDevice(id);
}
```

#### Type Guards

The `isSuccess()` and `isError()` functions enable TypeScript type narrowing:

```typescript
const result = await executor.getDeviceStatus(deviceId);

// Type narrowing in action
if (isSuccess(result)) {
  // TypeScript infers: result.data exists and has device status shape
  console.log(result.data.name);
  console.log(result.data.state);
  // result.error does NOT exist here (type error if accessed)
} else {
  // TypeScript infers: result.error exists
  console.error(result.error.code);
  console.error(result.error.message);
  // result.data does NOT exist here (type error if accessed)
}
```

#### DirectResult<T> Type

The `DirectResult<T>` type is a discriminated union:

```typescript
type DirectResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

// Example: Device status result
type DeviceStatusResult = DirectResult<{
  name: string;
  state: string;
  capabilities: string[];
}>;

// Success case
const success: DeviceStatusResult = {
  success: true,
  data: {
    name: 'Living Room Light',
    state: 'on',
    capabilities: ['switch', 'switchLevel'],
  },
};

// Error case
const error: DeviceStatusResult = {
  success: false,
  error: {
    code: 'DEVICE_NOT_FOUND',
    message: 'Device not found in SmartThings account',
  },
};
```

---

## API Reference

### Device Control

Control device power states and retrieve status.

#### `turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>>`

Turn on a device (requires `switch` capability).

**Parameters:**
- `deviceId` (DeviceId): Device UUID

**Returns:** `DirectResult<void>`

**Errors:**
- `DEVICE_NOT_FOUND`: Device UUID not found
- `CAPABILITY_NOT_SUPPORTED`: Device lacks switch capability
- `API_ERROR`: SmartThings API error

**Example:**
```typescript
const result = await executor.turnOnDevice('abc-123' as DeviceId);
if (isSuccess(result)) {
  console.log('Device turned on');
}
```

#### `turnOffDevice(deviceId: DeviceId): Promise<DirectResult<void>>`

Turn off a device (requires `switch` capability).

**Parameters:**
- `deviceId` (DeviceId): Device UUID

**Returns:** `DirectResult<void>`

**Errors:** Same as `turnOnDevice`

**Example:**
```typescript
const result = await executor.turnOffDevice('abc-123' as DeviceId);
```

#### `getDeviceStatus(deviceId: DeviceId): Promise<DirectResult<DeviceStatus>>`

Get comprehensive device status including current state and capabilities.

**Parameters:**
- `deviceId` (DeviceId): Device UUID

**Returns:** `DirectResult<DeviceStatus>` with:
- `name` (string): Device name
- `label` (string): Device label
- `state` (string): Current power state
- `type` (string): Device type
- `capabilities` (string[]): Available capabilities
- `status` (object): All capability states

**Example:**
```typescript
const result = await executor.getDeviceStatus('abc-123' as DeviceId);
if (isSuccess(result)) {
  console.log(`${result.data.name} is ${result.data.state}`);
  console.log('Capabilities:', result.data.capabilities.join(', '));
}
```

---

### Device Query

Discover and query devices with filtering.

#### `listDevices(filters?: { roomName?: string; capability?: string }): Promise<DirectResult<Device[]>>`

List all devices with optional filtering.

**Parameters:**
- `filters.roomName` (string, optional): Filter by room name
- `filters.capability` (string, optional): Filter by capability (e.g., 'switch', 'switchLevel')

**Returns:** `DirectResult<Device[]>` - Array of device objects

**Time Complexity:** O(n) where n = device count (cached, ~50ms)

**Example:**
```typescript
// List all devices
const all = await executor.listDevices();

// Filter by capability
const switches = await executor.listDevices({ capability: 'switch' });

// Filter by room
const bedroom = await executor.listDevices({ roomName: 'Bedroom' });

// Combined filters
const bedroomSwitches = await executor.listDevices({
  roomName: 'Bedroom',
  capability: 'switch',
});
```

#### `listDevicesByRoom(roomName: string): Promise<DirectResult<Device[]>>`

List all devices in a specific room.

**Parameters:**
- `roomName` (string): Room name to filter by

**Returns:** `DirectResult<Device[]>`

**Example:**
```typescript
const result = await executor.listDevicesByRoom('Living Room');
if (isSuccess(result)) {
  result.data.forEach(device => {
    console.log(`- ${device.name} (${device.type})`);
  });
}
```

#### `getDeviceCapabilities(deviceId: DeviceId): Promise<DirectResult<Capability[]>>`

Get detailed capability information for a device.

**Parameters:**
- `deviceId` (DeviceId): Device UUID

**Returns:** `DirectResult<Capability[]>` - Array of capability objects

**Example:**
```typescript
const result = await executor.getDeviceCapabilities('abc-123' as DeviceId);
if (isSuccess(result)) {
  console.log('Device capabilities:', result.data.map(c => c.id).join(', '));
}
```

#### `getDeviceEvents(deviceId: DeviceId, limit?: number): Promise<DirectResult<Event[]>>`

Get recent event history for a device.

**Parameters:**
- `deviceId` (DeviceId): Device UUID
- `limit` (number, optional): Maximum events to return (default: 10)

**Returns:** `DirectResult<Event[]>` - Array of event objects

**Example:**
```typescript
const result = await executor.getDeviceEvents('abc-123' as DeviceId, 20);
if (isSuccess(result)) {
  result.data.forEach(event => {
    console.log(`[${event.timestamp}] ${event.attribute}: ${event.value}`);
  });
}
```

---

### Scenes

Execute and manage SmartThings scenes.

#### `executeScene(sceneId: SceneId): Promise<DirectResult<void>>`

Execute a SmartThings scene.

**Parameters:**
- `sceneId` (SceneId): Scene UUID

**Returns:** `DirectResult<void>`

**Time Complexity:** O(1) + network latency (~200ms)

**Example:**
```typescript
const result = await executor.executeScene('scene-uuid' as SceneId);
if (isSuccess(result)) {
  console.log('Scene executed successfully');
}
```

#### `listScenes(locationId?: LocationId): Promise<DirectResult<Scene[]>>`

List all scenes, optionally filtered by location.

**Parameters:**
- `locationId` (LocationId, optional): Location UUID filter

**Returns:** `DirectResult<Scene[]>` - Array of scene objects

**Example:**
```typescript
const result = await executor.listScenes();
if (isSuccess(result)) {
  result.data.forEach(scene => {
    console.log(`- ${scene.name} (${scene.id})`);
  });
}
```

#### `listScenesByRoom(roomName: string): Promise<DirectResult<Scene[]>>`

List scenes associated with a specific room.

**Parameters:**
- `roomName` (string): Room name to filter by

**Returns:** `DirectResult<Scene[]>`

**Example:**
```typescript
const result = await executor.listScenesByRoom('Living Room');
```

---

### System

System-level configuration and diagnostics.

#### `toggleDebug(enabled: boolean): Promise<DirectResult<void>>`

Enable or disable debug-level logging.

**Parameters:**
- `enabled` (boolean): true to enable debug logging, false to disable

**Returns:** `DirectResult<void>`

**Time Complexity:** O(1) (in-memory configuration)

**Example:**
```typescript
// Enable debug logging
await executor.toggleDebug(true);

// Disable debug logging
await executor.toggleDebug(false);
```

#### `testConnection(): Promise<DirectResult<ConnectionStatus>>`

Test SmartThings API connectivity and measure latency.

**Returns:** `DirectResult<ConnectionStatus>` with:
- `status` (string): Connection status
- `latency` (number): Round-trip time in milliseconds
- `timestamp` (string): Test timestamp

**Example:**
```typescript
const result = await executor.testConnection();
if (isSuccess(result)) {
  console.log(`Connection: ${result.data.status} (${result.data.latency}ms)`);
}
```

#### `getSystemInfo(): Promise<DirectResult<SystemInfo>>`

Get comprehensive system information including version, capabilities, and configuration.

**Returns:** `DirectResult<SystemInfo>` with:
- `version` (string): Server version
- `name` (string): Server name
- `capabilities` (string[]): Available capabilities
- `transport` (string): Transport mode
- `initialized` (boolean): Initialization status

**Example:**
```typescript
const result = await executor.getSystemInfo();
if (isSuccess(result)) {
  console.log(`Server: ${result.data.name} v${result.data.version}`);
}
```

---

### Management

Manage locations, rooms, and device assignments.

#### `listLocations(): Promise<DirectResult<Location[]>>`

List all SmartThings locations.

**Returns:** `DirectResult<Location[]>` - Array of location objects

**Example:**
```typescript
const result = await executor.listLocations();
if (isSuccess(result)) {
  result.data.forEach(loc => {
    console.log(`- ${loc.name} (${loc.id})`);
  });
}
```

#### `listRooms(): Promise<DirectResult<Room[]>>`

List all rooms across all locations.

**Returns:** `DirectResult<Room[]>` - Array of room objects

**Example:**
```typescript
const result = await executor.listRooms();
if (isSuccess(result)) {
  console.log(`Total rooms: ${result.data.length}`);
}
```

#### `createRoom(locationId: LocationId, name: string): Promise<DirectResult<Room>>`

Create a new room in a location.

**Parameters:**
- `locationId` (LocationId): Location UUID
- `name` (string): Room name

**Returns:** `DirectResult<Room>` - Created room object

**Example:**
```typescript
const result = await executor.createRoom(
  'location-uuid' as LocationId,
  'Home Office'
);
if (isSuccess(result)) {
  console.log(`Created room: ${result.data.name} (${result.data.id})`);
}
```

#### `updateRoom(roomId: RoomId, locationId: LocationId, name: string): Promise<DirectResult<Room>>`

Update an existing room's name.

**Parameters:**
- `roomId` (RoomId): Room UUID
- `locationId` (LocationId): Location UUID
- `name` (string): New room name

**Returns:** `DirectResult<Room>` - Updated room object

**Example:**
```typescript
const result = await executor.updateRoom(
  'room-uuid' as RoomId,
  'location-uuid' as LocationId,
  'Master Bedroom'
);
```

#### `deleteRoom(roomId: RoomId, locationId: LocationId): Promise<DirectResult<void>>`

Delete a room (devices are unassigned, not deleted).

**Parameters:**
- `roomId` (RoomId): Room UUID
- `locationId` (LocationId): Location UUID

**Returns:** `DirectResult<void>`

**Example:**
```typescript
const result = await executor.deleteRoom(
  'room-uuid' as RoomId,
  'location-uuid' as LocationId
);
```

#### `assignDeviceToRoom(deviceId: DeviceId, roomId: RoomId, locationId: LocationId): Promise<DirectResult<void>>`

Assign a device to a room.

**Parameters:**
- `deviceId` (DeviceId): Device UUID
- `roomId` (RoomId): Room UUID
- `locationId` (LocationId): Location UUID

**Returns:** `DirectResult<void>`

**Example:**
```typescript
const result = await executor.assignDeviceToRoom(
  'device-uuid' as DeviceId,
  'room-uuid' as RoomId,
  'location-uuid' as LocationId
);
```

---

### Diagnostics

Advanced diagnostics and health monitoring.

#### `getDeviceHealth(deviceId: DeviceId): Promise<DirectResult<HealthReport>>`

Get comprehensive device health diagnostics.

**Parameters:**
- `deviceId` (DeviceId): Device UUID

**Returns:** `DirectResult<HealthReport>` - Health status and metrics

**Example:**
```typescript
const result = await executor.getDeviceHealth('device-uuid' as DeviceId);
if (isSuccess(result)) {
  console.log('Health:', result.data.status);
  console.log('Last activity:', result.data.lastActivity);
}
```

#### `validateDeviceCapabilities(deviceId: DeviceId): Promise<DirectResult<ValidationReport>>`

Validate device capability configuration and availability.

**Parameters:**
- `deviceId` (DeviceId): Device UUID

**Returns:** `DirectResult<ValidationReport>` - Validation results

**Example:**
```typescript
const result = await executor.validateDeviceCapabilities('device-uuid' as DeviceId);
if (isSuccess(result)) {
  console.log('Validation:', result.data.valid ? 'PASS' : 'FAIL');
}
```

#### `exportDiagnostics(format?: 'json' | 'markdown'): Promise<DirectResult<string>>`

Export comprehensive diagnostics report.

**Parameters:**
- `format` (string, optional): Report format - 'json' or 'markdown' (default: 'json')

**Returns:** `DirectResult<string>` - Formatted diagnostic report

**Time Complexity:** O(n) where n = total devices (~500ms)

**Example:**
```typescript
// Export JSON
const jsonResult = await executor.exportDiagnostics('json');
if (isSuccess(jsonResult)) {
  console.log(JSON.parse(jsonResult.data));
}

// Export Markdown
const mdResult = await executor.exportDiagnostics('markdown');
if (isSuccess(mdResult)) {
  console.log(mdResult.data);
}
```

---

### System Status

Comprehensive system health monitoring.

#### `getSystemStatus(): Promise<DirectResult<SystemStatus>>`

Get comprehensive system status including service health, device health, and diagnostics.

**Returns:** `DirectResult<SystemStatus>` with:
- `services` (object): Service health status
- `devices` (object): Device statistics and health
- `diagnostics` (object): System diagnostics
- `timestamp` (string): Status timestamp

**Time Complexity:** O(n) where n = total services and devices (~1s)

**Example:**
```typescript
const result = await executor.getSystemStatus();
if (isSuccess(result)) {
  console.log('Services:', result.data.services);
  console.log('Devices:', result.data.devices.total);
  console.log('Health:', result.data.diagnostics.health);
}
```

---

### Automation

Build and manage SmartThings automation rules.

#### `createAutomation(config: AutomationConfig): Promise<DirectResult<AutomationRule>>`

Create a new automation rule from template.

**Parameters:**
- `config` (AutomationConfig): Automation configuration object
  - `name` (string): Rule name (max 100 characters)
  - `locationId` (string): Location UUID
  - `template` (AutomationTemplate): Template type
  - `trigger` (TriggerDeviceConfig): Trigger configuration
  - `action` (ActionDeviceConfig): Action configuration
  - `delaySeconds` (number, optional): Action delay
  - `timeZoneId` (string, optional): Time zone ID

**Returns:** `DirectResult<AutomationRule>` - Created automation rule

**Time Complexity:** O(1) + network latency (~300ms)

**Example:**
```typescript
const result = await executor.createAutomation({
  name: 'Motion Lights',
  locationId: 'location-uuid',
  template: 'motion_lights',
  trigger: {
    deviceId: 'sensor-uuid',
    capability: 'motionSensor',
    attribute: 'motion',
    value: 'active',
  },
  action: {
    deviceId: 'light-uuid',
    capability: 'switch',
    command: 'on',
  },
});

if (isSuccess(result)) {
  console.log(`Created automation: ${result.data.ruleId}`);
}
```

**Available Templates:**
- `motion_lights`: Motion-activated lighting
- `door_notification`: Door/window notifications
- `temperature_control`: Temperature-based HVAC
- `scheduled_action`: Time-based actions
- `sunrise_sunset`: Sunrise/sunset triggers
- `battery_alert`: Low battery notifications

#### `updateAutomation(ruleId: string, locationId: LocationId, updates: Partial<AutomationConfig>): Promise<DirectResult<AutomationRule>>`

Update an existing automation rule.

**Parameters:**
- `ruleId` (string): Rule UUID
- `locationId` (LocationId): Location UUID
- `updates` (Partial<AutomationConfig>): Fields to update

**Returns:** `DirectResult<AutomationRule>` - Updated rule

**Example:**
```typescript
const result = await executor.updateAutomation(
  'rule-uuid',
  'location-uuid' as LocationId,
  { name: 'Updated Motion Lights' }
);
```

#### `deleteAutomation(ruleId: string, locationId: LocationId): Promise<DirectResult<void>>`

Delete an automation rule.

**Parameters:**
- `ruleId` (string): Rule UUID to delete
- `locationId` (LocationId): Location UUID

**Returns:** `DirectResult<void>`

**Example:**
```typescript
const result = await executor.deleteAutomation(
  'rule-uuid',
  'location-uuid' as LocationId
);
```

#### `testAutomation(config: TestConfig): Promise<DirectResult<TestReport>>`

Test automation configuration without creating the rule.

**Parameters:**
- `config` (TestConfig): Test configuration
  - `template` (AutomationTemplate): Template to test
  - `triggerDeviceId` (string): Trigger device UUID
  - `actionDeviceId` (string): Action device UUID

**Returns:** `DirectResult<TestReport>` - Validation results

**Example:**
```typescript
const result = await executor.testAutomation({
  template: 'motion_lights',
  triggerDeviceId: 'sensor-uuid',
  actionDeviceId: 'light-uuid',
});

if (isSuccess(result)) {
  console.log('Test result:', result.data.valid ? 'PASS' : 'FAIL');
}
```

#### `executeAutomation(ruleId: string, locationId: LocationId): Promise<DirectResult<ExecutionReport>>`

Manually trigger an automation rule.

**Parameters:**
- `ruleId` (string): Rule UUID to execute
- `locationId` (LocationId): Location UUID

**Returns:** `DirectResult<ExecutionReport>` - Execution results

**Example:**
```typescript
const result = await executor.executeAutomation(
  'rule-uuid',
  'location-uuid' as LocationId
);
```

#### `getAutomationTemplate(template?: AutomationTemplate): Promise<DirectResult<TemplateInfo>>`

Get automation template metadata and parameters.

**Parameters:**
- `template` (AutomationTemplate, optional): Specific template (omit for all templates)

**Returns:** `DirectResult<TemplateInfo>` - Template information

**Time Complexity:** O(1) (in-memory template data)

**Example:**
```typescript
// Get all templates
const allTemplates = await executor.getAutomationTemplate();

// Get specific template
const motionLights = await executor.getAutomationTemplate('motion_lights');
if (isSuccess(motionLights)) {
  console.log('Template:', motionLights.data.name);
  console.log('Description:', motionLights.data.description);
}
```

---

## Performance

### Benchmarks

Direct Mode offers measurable performance improvements over MCP protocol mode:

| Operation | Direct Mode | MCP Mode | Improvement |
|-----------|-------------|----------|-------------|
| `turnOnDevice` | ~95ms | ~102ms | 7% faster |
| `listDevices` | ~48ms | ~52ms | 8% faster |
| `getDeviceStatus` | ~145ms | ~156ms | 7% faster |
| `createAutomation` | ~285ms | ~305ms | 7% faster |

**Test Environment:**
- Node.js 18.18.0
- MacBook Pro M1 (2021)
- Local SmartThings API (avg latency: 100ms)
- 50 devices, 10 rooms, 3 locations

### Performance Characteristics

#### Time Complexity

All operations maintain the same time complexity as MCP mode:

- **Device Control**: O(1) + network latency
- **List Operations**: O(n) where n = item count (cached)
- **Status Queries**: O(1) + network latency
- **Automation**: O(1) + network latency

#### Memory Usage

- **ToolExecutor Instance**: ~2KB
- **Per-Result Overhead**: ~40 bytes (success), ~80 bytes (error)
- **ServiceContainer**: Shared with MCP mode (no additional cost)

#### Network Latency

Performance is dominated by SmartThings API latency:

- **Control Commands**: 100-200ms
- **Status Queries**: 150-300ms
- **List Operations**: 50-150ms (cached)
- **Automation Operations**: 300-500ms

**Key Insight:** 5-10% improvement comes from eliminating JSON marshalling and protocol overhead (~5-10ms per operation).

### Optimization Tips

1. **Reuse ServiceContainer**: Initialize once, reuse across operations
2. **Batch Operations**: Use `Promise.all()` for independent operations
3. **Leverage Caching**: `listDevices()` is cached, use freely
4. **Enable Debug Logging**: Only when needed (`toggleDebug(false)` in production)

```typescript
// ✅ Good: Batch independent operations
const [devices, scenes, rooms] = await Promise.all([
  executor.listDevices(),
  executor.listScenes(),
  executor.listRooms(),
]);

// ❌ Bad: Sequential awaits for independent operations
const devices = await executor.listDevices();
const scenes = await executor.listScenes();
const rooms = await executor.listRooms();
```

---

## Migration Guide

### From MCP Mode to Direct Mode

If you're currently using the MCP server via JSON-RPC, here's how to migrate:

#### Before (MCP Mode)

```typescript
// MCP server with stdio transport
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./dist/index.js'],
  env: { SMARTTHINGS_TOKEN: process.env.SMARTTHINGS_TOKEN },
});

const client = new Client({ name: 'my-app', version: '1.0.0' }, {});
await client.connect(transport);

// Call tool via JSON-RPC
const result = await client.callTool('turn_on_device', {
  deviceId: 'abc-123',
});

// Parse JSON response
const response = JSON.parse(result.content[0].text);
```

#### After (Direct Mode)

```typescript
// Direct Mode API
import { createToolExecutor, isSuccess } from '@bobmatnyc/mcp-smarterthings/direct';
import { ServiceContainer } from '@bobmatnyc/mcp-smarterthings/services';
import { SmartThingsService } from '@bobmatnyc/mcp-smarterthings/smartthings';

const smartThingsService = new SmartThingsService({
  token: process.env.SMARTTHINGS_TOKEN!,
});
const container = new ServiceContainer(smartThingsService);
await container.initialize();

const executor = createToolExecutor(container);

// Type-safe API call
const result = await executor.turnOnDevice('abc-123' as DeviceId);

// Type-safe response handling
if (isSuccess(result)) {
  console.log('Device turned on');
}
```

### Migration Checklist

- [ ] Replace MCP client initialization with `ServiceContainer` + `createToolExecutor`
- [ ] Update tool calls from `client.callTool(name, args)` to `executor.methodName(args)`
- [ ] Replace JSON parsing with type-safe `DirectResult<T>` handling
- [ ] Add type annotations for branded types (`DeviceId`, `LocationId`, etc.)
- [ ] Update error handling from JSON errors to `DirectResult.error` structure
- [ ] Remove transport layer code (stdio/HTTP/SSE)
- [ ] Update tests to use Direct Mode API

### Tool Name Mapping

| MCP Tool Name | Direct Mode Method |
|---------------|-------------------|
| `turn_on_device` | `executor.turnOnDevice()` |
| `turn_off_device` | `executor.turnOffDevice()` |
| `get_device_status` | `executor.getDeviceStatus()` |
| `list_devices` | `executor.listDevices()` |
| `list_devices_by_room` | `executor.listDevicesByRoom()` |
| `get_device_capabilities` | `executor.getDeviceCapabilities()` |
| `get_device_events` | `executor.getDeviceEvents()` |
| `execute_scene` | `executor.executeScene()` |
| `list_scenes` | `executor.listScenes()` |
| `list_scenes_by_room` | `executor.listScenesByRoom()` |
| `toggle_debug` | `executor.toggleDebug()` |
| `test_connection` | `executor.testConnection()` |
| `get_system_info` | `executor.getSystemInfo()` |
| `list_locations` | `executor.listLocations()` |
| `list_rooms` | `executor.listRooms()` |
| `create_room` | `executor.createRoom()` |
| `update_room` | `executor.updateRoom()` |
| `delete_room` | `executor.deleteRoom()` |
| `assign_device_to_room` | `executor.assignDeviceToRoom()` |
| `get_device_health` | `executor.getDeviceHealth()` |
| `validate_device_capabilities` | `executor.validateDeviceCapabilities()` |
| `export_diagnostics` | `executor.exportDiagnostics()` |
| `get_system_status` | `executor.getSystemStatus()` |
| `create_automation` | `executor.createAutomation()` |
| `update_automation` | `executor.updateAutomation()` |
| `delete_automation` | `executor.deleteAutomation()` |
| `test_automation` | `executor.testAutomation()` |
| `execute_automation` | `executor.executeAutomation()` |
| `get_automation_template` | `executor.getAutomationTemplate()` |

---

## Best Practices

### 1. Initialization

**✅ DO:** Initialize once and reuse

```typescript
// Initialize at app startup
const container = new ServiceContainer(smartThingsService);
await container.initialize();
const executor = createToolExecutor(container);

// Reuse executor throughout app lifecycle
export { executor };
```

**❌ DON'T:** Create new executor for each operation

```typescript
// Bad: Reinitializes services on every call
async function turnOnLight() {
  const container = new ServiceContainer(smartThingsService);
  await container.initialize();
  const executor = createToolExecutor(container);
  return executor.turnOnDevice(deviceId);
}
```

### 2. Error Handling

**✅ DO:** Use type guards for explicit error handling

```typescript
const result = await executor.turnOnDevice(deviceId);
if (isError(result)) {
  logger.error(`Device control failed: [${result.error.code}] ${result.error.message}`);
  return; // Early return
}
// Continue with success path
console.log('Device controlled successfully');
```

**❌ DON'T:** Ignore errors or use loose checks

```typescript
const result = await executor.turnOnDevice(deviceId);
if (!result.success) {
  console.log('failed'); // No error details logged
}
```

### 3. Type Safety

**✅ DO:** Use branded types consistently

```typescript
import type { DeviceId, RoomId } from '@bobmatnyc/mcp-smarterthings/types';

function controlDevice(id: DeviceId) {
  return executor.turnOnDevice(id);
}

// Type-safe call
const deviceId: DeviceId = 'abc-123' as DeviceId;
await controlDevice(deviceId);
```

**❌ DON'T:** Use plain strings everywhere

```typescript
function controlDevice(id: string) {
  return executor.turnOnDevice(id as any); // Loses type safety
}
```

### 4. Batching Operations

**✅ DO:** Batch independent operations

```typescript
// Parallel execution
const results = await Promise.all([
  executor.turnOnDevice(device1),
  executor.turnOnDevice(device2),
  executor.turnOnDevice(device3),
]);

// Check all results
const failures = results.filter(isError);
if (failures.length > 0) {
  console.error(`${failures.length} operations failed`);
}
```

**❌ DON'T:** Sequential operations when not necessary

```typescript
// Sequential execution (slower)
await executor.turnOnDevice(device1);
await executor.turnOnDevice(device2);
await executor.turnOnDevice(device3);
```

### 5. Resource Cleanup

**✅ DO:** Dispose ServiceContainer when done

```typescript
const container = new ServiceContainer(smartThingsService);
try {
  await container.initialize();
  const executor = createToolExecutor(container);
  // Use executor...
} finally {
  await container.dispose(); // Always cleanup
}
```

**❌ DON'T:** Leave resources hanging

```typescript
const container = new ServiceContainer(smartThingsService);
await container.initialize();
// ... use container ...
// Missing dispose() call - resource leak
```

### 6. Logging

**✅ DO:** Toggle debug logging appropriately

```typescript
// Enable debug in development
if (process.env.NODE_ENV === 'development') {
  await executor.toggleDebug(true);
}

// Disable in production
await executor.toggleDebug(false);
```

**❌ DON'T:** Leave debug logging on in production

```typescript
await executor.toggleDebug(true); // Always on - performance impact
```

---

## Examples

Complete working examples are available in the `examples/direct-mode/` directory:

### Basic Usage

**File:** `examples/direct-mode/basic-usage.ts`

```typescript
import { createToolExecutor, isSuccess } from '@bobmatnyc/mcp-smarterthings/direct';
import { ServiceContainer } from '@bobmatnyc/mcp-smarterthings/services';
import { SmartThingsService } from '@bobmatnyc/mcp-smarterthings/smartthings';

async function main() {
  // Initialize
  const smartThingsService = new SmartThingsService({
    token: process.env.SMARTTHINGS_TOKEN!,
  });
  const container = new ServiceContainer(smartThingsService);
  await container.initialize();
  const executor = createToolExecutor(container);

  // List devices
  const devices = await executor.listDevices({ capability: 'switch' });
  if (isSuccess(devices)) {
    console.log(`Found ${devices.data.length} switch devices`);
  }

  // Cleanup
  await container.dispose();
}
```

See [examples/direct-mode/basic-usage.ts](../examples/direct-mode/basic-usage.ts) for full example.

### Error Handling

**File:** `examples/direct-mode/error-handling.ts`

Comprehensive error handling patterns including retry logic and graceful degradation.

See [examples/direct-mode/error-handling.ts](../examples/direct-mode/error-handling.ts) for full example.

### Automation Workflow

**File:** `examples/direct-mode/automation-example.ts`

Complete automation creation workflow with validation and testing.

See [examples/direct-mode/automation-example.ts](../examples/direct-mode/automation-example.ts) for full example.

### Type Safety Demo

**File:** `examples/direct-mode/type-safety-demo.ts`

Demonstrates branded types, type guards, and TypeScript type narrowing.

See [examples/direct-mode/type-safety-demo.ts](../examples/direct-mode/type-safety-demo.ts) for full example.

---

## Related Documentation

- **[README.md](../README.md)** - Project overview and MCP server setup
- **[Capability Mapping Guide](./capability-mapping-guide.md)** - Complete reference for 31 unified capabilities
- **[Testing Quick Start](./testing/TESTING_QUICK_START.md)** - Testing tools and strategies
- **[API Reference](./api-reference-event-retrieval.md)** - Event retrieval and additional APIs

---

## Support

For issues and questions:

1. Review this documentation
2. Check [examples/direct-mode/](../examples/direct-mode/)
3. Search [GitHub Issues](https://github.com/bobmatnyc/mcp-smarterthings/issues)
4. Open a new issue with:
   - Direct Mode version
   - TypeScript version
   - Error messages and stack traces
   - Minimal reproduction code

---

**Built with ❤️ for the LLM and smart home developer communities**

*Documentation generated for ticket [1M-412](https://linear.app/bobmatnyc/issue/1M-412)*
