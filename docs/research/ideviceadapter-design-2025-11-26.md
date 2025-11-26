# IDeviceAdapter Interface Design with Unified Capability Model

**Date:** 2025-11-26
**Ticket:** 1M-239
**Epic:** Implement Layer 2: Unified Device Abstraction
**Project:** MCP Smarterthings
**Status:** Design Complete - Ready for Implementation

---

## Executive Summary

This document defines the **IDeviceAdapter** interface and unified capability model that will serve as Layer 2 (Unified Device Abstraction) in the MCP Smarterthings architecture. This abstraction enables multi-platform support for SmartThings, Tuya, and Lutron devices through a common interface while maintaining type safety and proper error handling.

**Key Design Decisions:**
- ✅ **Capability-based abstraction** - Devices defined by capabilities, not platform-specific types
- ✅ **Async-first design** - All operations return Promises for async/await patterns
- ✅ **Type-safe branded types** - TypeScript branded types prevent ID mixing across platforms
- ✅ **Event-driven state management** - State updates propagated via events with caching support
- ✅ **Graceful degradation** - Platform-specific features accessible via escape hatches
- ✅ **Error handling patterns** - Standardized error types with retry logic support

**Capability Coverage:**
- 12 core device capabilities (switch, dimmer, color, thermostat, lock, sensors, etc.)
- 40+ command types
- 35+ attribute types
- Extensible for future capabilities

---

## Table of Contents

1. [Platform Capability Analysis](#platform-capability-analysis)
2. [Unified Capability Model](#unified-capability-model)
3. [IDeviceAdapter Interface](#ideviceadapter-interface)
4. [State Management Pattern](#state-management-pattern)
5. [Command Execution Pattern](#command-execution-pattern)
6. [Type Safety Strategy](#type-safety-strategy)
7. [Implementation Examples](#implementation-examples)
8. [Migration Plan](#migration-plan)
9. [Testing Strategy](#testing-strategy)
10. [Acceptance Criteria Validation](#acceptance-criteria-validation)

---

## Platform Capability Analysis

### SmartThings Capabilities (Current Implementation)

**Capability Model:**
- Capabilities as strings: `'switch'`, `'switchLevel'`, `'colorControl'`, etc.
- Commands: Actions that can be executed on devices
- Attributes: State properties that can be read
- Component-based: Devices have components (usually 'main') with capabilities

**Common Capabilities:**
```typescript
// From src/config/constants.ts
SWITCH: 'switch'                       // on/off control
SWITCH_LEVEL: 'switchLevel'            // 0-100 dimming
COLOR_CONTROL: 'colorControl'          // hue/saturation/brightness
TEMPERATURE_MEASUREMENT: 'temperatureMeasurement'
MOTION_SENSOR: 'motionSensor'          // motion detection
CONTACT_SENSOR: 'contactSensor'        // door/window open/closed
LOCK: 'lock'                           // lock/unlock
```

**State Structure:**
```typescript
{
  deviceId: "uuid",
  components: {
    main: {
      switch: {
        switch: { value: "on", timestamp: "..." }
      },
      switchLevel: {
        level: { value: 50, unit: "%", timestamp: "..." }
      }
    }
  }
}
```

**Strengths:**
- Well-documented capabilities
- Consistent command/attribute structure
- Component-based design supports complex devices
- Official SDK with TypeScript support

**Limitations:**
- Platform-specific capability names
- No built-in capability discovery at runtime
- Some capabilities have platform-specific behaviors

---

### Tuya Capabilities (Research Findings)

**Capability Model:**
- Function codes (DPs - Data Points): `'switch_led'`, `'bright_value'`, `'colour_data'`, etc.
- Standard Instruction Set varies by product category
- Categories: switch (kg), socket (cz), light (deng), thermostat (wk), lock (ms), etc.

**Common Function Codes:**
```typescript
// Switches & Lights
switch_led: boolean          // on/off control
bright_value: 0-1000         // brightness (0-1000 scale, not 0-100!)
colour_data: { h, s, v }     // HSV color format (JSON string)
work_mode: string            // 'white', 'colour', 'scene', etc.

// Thermostats
temp_set: number             // target temperature (scale varies by region)
temp_current: number         // current temperature reading
mode: string                 // 'auto', 'cool', 'heat', 'fan_only'

// Locks
lock_motor_state: boolean    // locked/unlocked
unlock_method: string        // 'password', 'fingerprint', 'card', etc.

// Sensors
doorcontact_state: boolean   // door/window open/closed
pir: string                  // motion detection: 'pir', 'none'
```

**State Structure:**
```typescript
{
  id: "device_id",
  name: "Device Name",
  online: true,
  status: [
    { code: "switch_led", value: true },
    { code: "bright_value", value: 500 },
    { code: "colour_data", value: "{\"h\":120,\"s\":255,\"v\":255}" }
  ]
}
```

**Strengths:**
- Standard instruction sets for common device types
- Detailed device specifications API
- Flexible DP-based model supports custom functions

**Limitations:**
- Different value scales (brightness: 0-1000 vs 0-100)
- String-based JSON for complex values (color)
- Standard instruction set coverage incomplete for some devices
- DP codes not always consistent across manufacturers

**Conversion Challenges:**
- Brightness: Tuya 0-1000 → Unified 0-100 (divide by 10)
- Color: Tuya HSV string → Unified HSV object (parse JSON)
- Temperature: Tuya scale varies by region (C/F/K)

---

### Lutron Capabilities (Research Findings)

**Capability Model:**
- Integration Protocol: Telnet (Pro Bridge) or LEAP (RadioRA3)
- Device types: Dimmer, Switch, Shade, Occupancy Sensor
- Output levels: 0-100% (supports high precision: 0.00-100.00%)
- Zones: Logical groupings of devices

**Common Capabilities:**
```typescript
// Dimmers (most common)
OUTPUT: 0.00-100.00%         // dimming level (high precision)
FADE_TIME: seconds           // transition duration
DELAY_TIME: seconds          // delay before action

// Switches
OUTPUT: 0 or 100             // on/off (no intermediate values)

// Shades
POSITION: 0-100%             // open/closed position
TILT: 0-100%                 // slat angle (if supported)

// Occupancy Sensors
OCCUPANCY: "Occupied" | "Unoccupied" | "Unknown"
```

**State Structure (Telnet Protocol):**
```text
~OUTPUT,1,1,75.00  # Zone 1, Output 1, Level 75.00%
~DEVICE,1,9,3      # Zone 1, Button 9, Action 3
```

**State Structure (LEAP Protocol):**
```json
{
  "Header": {
    "MessageBodyType": "OneZoneStatus",
    "StatusCode": "200 OK"
  },
  "Body": {
    "ZoneStatus": {
      "Zone": { "href": "/zone/1" },
      "Level": 75,
      "FanSpeed": null
    }
  }
}
```

**Strengths:**
- Simple, reliable protocol (especially Telnet)
- High-precision dimming (0.01% granularity)
- Local control (no cloud dependency for Caseta)
- Fast response times

**Limitations:**
- Limited device types (primarily lighting and shades)
- No color control (dimmers only support white light)
- Pro Bridge required for integration (not standard Bridge)
- No official Node.js SDK
- LEAP protocol more complex, requires certificate authentication

**Conversion Challenges:**
- Protocol differences: Telnet vs LEAP
- High precision not needed for unified model (round to 0-100)
- Zone-based addressing vs device IDs
- Limited sensor types (occupancy only, no temperature/motion/contact)

---

### Capability Comparison Matrix

| Capability | SmartThings | Tuya | Lutron | Unified Model |
|------------|-------------|------|--------|---------------|
| **On/Off Switch** | `switch` (on/off) | `switch_led` (boolean) | OUTPUT (0/100%) | `switch` |
| **Dimmer** | `switchLevel` (0-100) | `bright_value` (0-1000) | OUTPUT (0.00-100.00) | `dimmer` |
| **Color** | `colorControl` (hue/sat/level) | `colour_data` (HSV JSON) | ❌ Not supported | `color` |
| **Temperature Measurement** | `temperatureMeasurement` | `temp_current` | ❌ Not supported | `temperatureSensor` |
| **Thermostat Control** | `thermostat*` (multiple caps) | `temp_set`, `mode` | ❌ Not supported | `thermostat` |
| **Lock** | `lock` (lock/unlock) | `lock_motor_state` | ❌ Not supported | `lock` |
| **Motion Sensor** | `motionSensor` | `pir` | ❌ Not supported | `motionSensor` |
| **Contact Sensor** | `contactSensor` | `doorcontact_state` | ❌ Not supported | `contactSensor` |
| **Occupancy Sensor** | ❌ Not standard | ❌ Not standard | OCCUPANCY | `occupancySensor` |
| **Shade/Blind** | `windowShade` | `position` | POSITION/TILT | `shade` |
| **Humidity Sensor** | `relativeHumidityMeasurement` | `humidity_value` | ❌ Not supported | `humiditySensor` |
| **Fan** | `fanSpeed` | `fan_speed` | FAN_SPEED | `fan` |

**Key Observations:**
1. **SmartThings has broadest capability coverage** - Supports most device types
2. **Tuya has good coverage but inconsistent naming** - Standard instruction set helps
3. **Lutron focused on lighting** - Limited to dimmers, switches, shades, and occupancy
4. **Value scale conversions required** - Brightness (1000 vs 100 vs 100.00), temperature scales
5. **Format conversions needed** - JSON strings (Tuya color) vs structured objects

---

## Unified Capability Model

### Design Principles

1. **Capability-based, not device-type-based**: Devices are collections of capabilities
2. **Platform-agnostic naming**: Use common terms, not platform-specific names
3. **Normalized value ranges**: 0-100 for percentages, standard units for measurements
4. **Structured data types**: No string-encoded JSON, use proper TypeScript types
5. **Extensibility**: Easy to add new capabilities without breaking existing code
6. **Type safety**: Branded types and enums prevent invalid combinations

### DeviceCapability Enum

```typescript
/**
 * Unified device capability types.
 *
 * Each capability represents a distinct device function that can be controlled
 * or monitored. Devices typically support multiple capabilities.
 *
 * Design Decision: Enum vs Union Types
 * - Enums provide better autocomplete and type safety
 * - Can be extended without modifying existing code (Open/Closed Principle)
 * - Runtime introspection possible (Object.values(DeviceCapability))
 */
export enum DeviceCapability {
  // Control Capabilities (Actuators)
  SWITCH = 'switch',                      // Binary on/off control
  DIMMER = 'dimmer',                      // Level control (0-100%)
  COLOR = 'color',                        // Color control (hue/sat/brightness)
  COLOR_TEMPERATURE = 'colorTemperature', // White spectrum control (Kelvin)
  THERMOSTAT = 'thermostat',              // Temperature control + mode
  LOCK = 'lock',                          // Lock/unlock control
  SHADE = 'shade',                        // Window covering position/tilt
  FAN = 'fan',                            // Fan speed control

  // Sensor Capabilities (Read-only)
  TEMPERATURE_SENSOR = 'temperatureSensor',   // Temperature reading
  HUMIDITY_SENSOR = 'humiditySensor',         // Humidity reading
  MOTION_SENSOR = 'motionSensor',             // Motion detection
  CONTACT_SENSOR = 'contactSensor',           // Open/closed detection
  OCCUPANCY_SENSOR = 'occupancySensor',       // Room occupancy
  ILLUMINANCE_SENSOR = 'illuminanceSensor',   // Light level (lux)
  BATTERY = 'battery',                        // Battery level

  // Composite Capabilities
  ENERGY_METER = 'energyMeter',               // Power consumption monitoring
  VALVE = 'valve',                            // Water/gas valve control
  ALARM = 'alarm',                            // Security alarm control
}
```

### Capability Interfaces

Each capability has:
1. **Commands**: Actions that can be executed
2. **Attributes**: State properties that can be read
3. **Metadata**: Supported ranges, units, and platform-specific info

```typescript
/**
 * Base capability interface.
 * All capability-specific interfaces extend this.
 */
interface ICapability {
  readonly type: DeviceCapability;
  readonly platformSpecific?: Record<string, unknown>; // Escape hatch
}

/**
 * Switch capability - Binary on/off control.
 *
 * Platform Mappings:
 * - SmartThings: 'switch' capability
 * - Tuya: 'switch_led' function code
 * - Lutron: OUTPUT with 0% or 100% only
 */
interface ISwitchCapability extends ICapability {
  type: DeviceCapability.SWITCH;
  commands: {
    on: () => Promise<void>;
    off: () => Promise<void>;
    toggle: () => Promise<void>;
  };
  attributes: {
    switch: 'on' | 'off';
  };
}

/**
 * Dimmer capability - Level control with 0-100% range.
 *
 * Platform Mappings:
 * - SmartThings: 'switchLevel' capability (0-100)
 * - Tuya: 'bright_value' function code (0-1000, converted to 0-100)
 * - Lutron: OUTPUT (0.00-100.00, rounded to 0-100)
 */
interface IDimmerCapability extends ICapability {
  type: DeviceCapability.DIMMER;
  commands: {
    setLevel: (level: number, duration?: number) => Promise<void>; // level: 0-100
  };
  attributes: {
    level: number; // 0-100
  };
}

/**
 * Color capability - Full RGB/HSV color control.
 *
 * Platform Mappings:
 * - SmartThings: 'colorControl' capability (hue: 0-100, sat: 0-100)
 * - Tuya: 'colour_data' function code (HSV JSON string, converted)
 * - Lutron: ❌ Not supported (capability disabled for Lutron devices)
 */
interface IColorCapability extends ICapability {
  type: DeviceCapability.COLOR;
  commands: {
    setColor: (hue: number, saturation: number, brightness: number) => Promise<void>;
    setHue: (hue: number) => Promise<void>;
    setSaturation: (saturation: number) => Promise<void>;
  };
  attributes: {
    hue: number;        // 0-360 degrees
    saturation: number; // 0-100%
    brightness: number; // 0-100%
  };
}

/**
 * Color temperature capability - White spectrum control.
 *
 * Platform Mappings:
 * - SmartThings: 'colorTemperature' capability (Kelvin)
 * - Tuya: 'temp_value' function code (varies by device)
 * - Lutron: ❌ Not supported
 */
interface IColorTemperatureCapability extends ICapability {
  type: DeviceCapability.COLOR_TEMPERATURE;
  commands: {
    setColorTemperature: (kelvin: number) => Promise<void>; // 2700-6500K typical
  };
  attributes: {
    colorTemperature: number; // Kelvin
    minKelvin?: number;       // Device-specific minimum
    maxKelvin?: number;       // Device-specific maximum
  };
}

/**
 * Thermostat capability - Temperature control with multiple modes.
 *
 * Platform Mappings:
 * - SmartThings: Multiple capabilities (thermostat*, 8 separate capabilities)
 * - Tuya: 'temp_set', 'temp_current', 'mode' function codes
 * - Lutron: ❌ Not supported
 */
interface IThermostatCapability extends ICapability {
  type: DeviceCapability.THERMOSTAT;
  commands: {
    setHeatingSetpoint: (temperature: number, unit?: 'C' | 'F') => Promise<void>;
    setCoolingSetpoint: (temperature: number, unit?: 'C' | 'F') => Promise<void>;
    setMode: (mode: ThermostatMode) => Promise<void>;
    setFanMode: (mode: ThermostatFanMode) => Promise<void>;
  };
  attributes: {
    heatingSetpoint: number;
    coolingSetpoint: number;
    temperature: number;           // Current temperature
    mode: ThermostatMode;
    fanMode: ThermostatFanMode;
    operatingState: ThermostatOperatingState;
    temperatureUnit: 'C' | 'F';
  };
}

enum ThermostatMode {
  OFF = 'off',
  HEAT = 'heat',
  COOL = 'cool',
  AUTO = 'auto',
  ECO = 'eco',
  EMERGENCY_HEAT = 'emergencyHeat',
}

enum ThermostatFanMode {
  AUTO = 'auto',
  ON = 'on',
  CIRCULATE = 'circulate',
}

enum ThermostatOperatingState {
  IDLE = 'idle',
  HEATING = 'heating',
  COOLING = 'cooling',
  FAN_ONLY = 'fanOnly',
  PENDING_HEAT = 'pendingHeat',
  PENDING_COOL = 'pendingCool',
}

/**
 * Lock capability - Lock/unlock control with state tracking.
 *
 * Platform Mappings:
 * - SmartThings: 'lock' capability
 * - Tuya: 'lock_motor_state' function code
 * - Lutron: ❌ Not supported
 */
interface ILockCapability extends ICapability {
  type: DeviceCapability.LOCK;
  commands: {
    lock: () => Promise<void>;
    unlock: () => Promise<void>;
  };
  attributes: {
    lock: LockState;
    lockMethod?: string; // 'keypad', 'manual', 'auto', etc.
  };
}

enum LockState {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  UNKNOWN = 'unknown',
  JAMMED = 'jammed',
}

/**
 * Shade capability - Window covering position and tilt control.
 *
 * Platform Mappings:
 * - SmartThings: 'windowShade' capability
 * - Tuya: 'position' function code
 * - Lutron: POSITION and TILT integration commands
 */
interface IShadeCapability extends ICapability {
  type: DeviceCapability.SHADE;
  commands: {
    open: () => Promise<void>;
    close: () => Promise<void>;
    setPosition: (position: number) => Promise<void>; // 0-100 (0=closed, 100=open)
    setTilt?: (tilt: number) => Promise<void>;        // Optional, 0-100
  };
  attributes: {
    position: number;      // 0-100
    tilt?: number;         // Optional, 0-100
    state: ShadeState;
  };
}

enum ShadeState {
  OPEN = 'open',
  CLOSED = 'closed',
  OPENING = 'opening',
  CLOSING = 'closing',
  PARTIALLY_OPEN = 'partiallyOpen',
  UNKNOWN = 'unknown',
}

/**
 * Sensor capabilities - Read-only state monitoring.
 */

interface ITemperatureSensorCapability extends ICapability {
  type: DeviceCapability.TEMPERATURE_SENSOR;
  attributes: {
    temperature: number;
    unit: 'C' | 'F' | 'K';
  };
}

interface IHumiditySensorCapability extends ICapability {
  type: DeviceCapability.HUMIDITY_SENSOR;
  attributes: {
    humidity: number; // 0-100%
  };
}

interface IMotionSensorCapability extends ICapability {
  type: DeviceCapability.MOTION_SENSOR;
  attributes: {
    motion: 'active' | 'inactive';
  };
}

interface IContactSensorCapability extends ICapability {
  type: DeviceCapability.CONTACT_SENSOR;
  attributes: {
    contact: 'open' | 'closed';
  };
}

interface IOccupancySensorCapability extends ICapability {
  type: DeviceCapability.OCCUPANCY_SENSOR;
  attributes: {
    occupancy: 'occupied' | 'unoccupied' | 'unknown';
  };
}

interface IIlluminanceSensorCapability extends ICapability {
  type: DeviceCapability.ILLUMINANCE_SENSOR;
  attributes: {
    illuminance: number; // lux
  };
}

interface IBatteryCapability extends ICapability {
  type: DeviceCapability.BATTERY;
  attributes: {
    battery: number; // 0-100%
  };
}

/**
 * Type union of all capability interfaces.
 * Used for type narrowing in adapter implementations.
 */
export type UnifiedCapabilityInterface =
  | ISwitchCapability
  | IDimmerCapability
  | IColorCapability
  | IColorTemperatureCapability
  | IThermostatCapability
  | ILockCapability
  | IShadeCapability
  | ITemperatureSensorCapability
  | IHumiditySensorCapability
  | IMotionSensorCapability
  | IContactSensorCapability
  | IOccupancySensorCapability
  | IIlluminanceSensorCapability
  | IBatteryCapability;
```

### Device Model

```typescript
/**
 * Platform identifiers.
 */
export enum Platform {
  SMARTTHINGS = 'smartthings',
  TUYA = 'tuya',
  LUTRON = 'lutron',
}

/**
 * Branded type for universal device IDs.
 * Format: "{platform}:{platformDeviceId}"
 * Example: "smartthings:abc-123-def", "tuya:bf1234567890abcdef", "lutron:zone-1"
 */
export type UniversalDeviceId = string & { readonly __brand: 'UniversalDeviceId' };

/**
 * Create a universal device ID from platform and platform-specific ID.
 */
export function createUniversalDeviceId(platform: Platform, platformDeviceId: string): UniversalDeviceId {
  return `${platform}:${platformDeviceId}` as UniversalDeviceId;
}

/**
 * Parse a universal device ID into platform and platform-specific ID.
 */
export function parseUniversalDeviceId(universalId: UniversalDeviceId): {
  platform: Platform;
  platformDeviceId: string;
} {
  const [platform, ...rest] = universalId.split(':');
  return {
    platform: platform as Platform,
    platformDeviceId: rest.join(':'), // Handle colons in platform IDs
  };
}

/**
 * Unified device model representing any device across all platforms.
 */
export interface UnifiedDevice {
  // Identity
  id: UniversalDeviceId;                // Universal ID (platform:deviceId)
  platform: Platform;                   // Originating platform
  platformDeviceId: string;             // Platform-specific ID

  // Metadata
  name: string;                         // User-friendly device name
  label?: string;                       // Optional label/description
  manufacturer?: string;                // Device manufacturer
  model?: string;                       // Device model number
  firmwareVersion?: string;             // Firmware version

  // Organization
  room?: string;                        // Room name
  location?: string;                    // Location/home name

  // Capabilities
  capabilities: DeviceCapability[];     // List of supported capabilities

  // State
  online: boolean;                      // Device reachability
  lastSeen?: Date;                      // Last communication timestamp

  // Platform-specific
  platformSpecific?: Record<string, unknown>; // Escape hatch for platform features
}

/**
 * Device state represents the current attribute values of all capabilities.
 */
export interface DeviceState {
  deviceId: UniversalDeviceId;
  timestamp: Date;
  attributes: Record<string, unknown>; // Key: capability.attribute, Value: attribute value

  // Examples:
  // { "switch.switch": "on", "dimmer.level": 75, "temperatureSensor.temperature": 22.5 }
}

/**
 * Device command represents an action to execute on a device.
 */
export interface DeviceCommand {
  capability: DeviceCapability;
  command: string;
  parameters?: Record<string, unknown>;

  // Examples:
  // { capability: 'switch', command: 'on' }
  // { capability: 'dimmer', command: 'setLevel', parameters: { level: 75, duration: 2 } }
  // { capability: 'thermostat', command: 'setHeatingSetpoint', parameters: { temperature: 22, unit: 'C' } }
}

/**
 * Command execution result.
 */
export interface CommandResult {
  success: boolean;
  deviceId: UniversalDeviceId;
  command: DeviceCommand;
  executedAt: Date;
  error?: DeviceError;
  newState?: DeviceState; // Updated state after command execution
}
```

---

## IDeviceAdapter Interface

### Core Interface Definition

```typescript
/**
 * Device adapter interface - Platform abstraction layer.
 *
 * Each platform (SmartThings, Tuya, Lutron) implements this interface
 * to provide unified device control and monitoring.
 *
 * Design Principles:
 * - Async-first: All operations return Promises
 * - Type-safe: Branded types prevent cross-platform ID mixing
 * - Event-driven: State changes propagated via events
 * - Error-handled: Standardized error types with context
 * - Testable: Interface enables mocking for unit tests
 *
 * Lifecycle:
 * 1. Construction: new SmartThingsAdapter(config)
 * 2. Initialization: await adapter.initialize()
 * 3. Operation: await adapter.listDevices(), executeCommand(), etc.
 * 4. Event handling: adapter.on('stateChange', handler)
 * 5. Cleanup: await adapter.dispose()
 */
export interface IDeviceAdapter extends EventEmitter {
  //
  // Adapter Metadata
  //

  /**
   * Platform identifier (smartthings, tuya, lutron).
   */
  readonly platform: Platform;

  /**
   * Human-readable platform name.
   */
  readonly platformName: string;

  /**
   * Adapter version (for debugging and diagnostics).
   */
  readonly version: string;

  //
  // Lifecycle Management
  //

  /**
   * Initialize the adapter and establish platform connection.
   *
   * This method must be called before any other operations.
   *
   * Responsibilities:
   * - Authenticate with platform API
   * - Validate credentials
   * - Initialize internal state
   * - Set up event listeners (if supported)
   * - Perform initial device discovery (optional)
   *
   * Error Handling:
   * - Throws AuthenticationError if credentials invalid
   * - Throws NetworkError if platform unreachable
   * - Throws ConfigurationError if adapter misconfigured
   *
   * @throws {DeviceError} If initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Dispose of adapter resources and close connections.
   *
   * Responsibilities:
   * - Close API connections
   * - Clean up event listeners
   * - Cancel pending operations
   * - Release resources
   *
   * Should be idempotent (safe to call multiple times).
   */
  dispose(): Promise<void>;

  /**
   * Check if adapter is initialized and ready for operations.
   */
  isInitialized(): boolean;

  /**
   * Perform health check on platform connection.
   *
   * Useful for:
   * - Monitoring adapter health
   * - Validating credentials still valid
   * - Detecting API outages
   *
   * @returns Health status with diagnostic information
   */
  healthCheck(): Promise<AdapterHealthStatus>;

  //
  // Device Discovery and Information
  //

  /**
   * List all devices accessible on this platform.
   *
   * Performance: O(n) where n = number of devices
   * Network: Single API call (or multiple if pagination required)
   * Caching: Implementation may cache results with TTL
   *
   * @param filters Optional filters to narrow results
   * @returns Array of unified device models
   * @throws {DeviceError} If listing fails
   */
  listDevices(filters?: DeviceFilters): Promise<UnifiedDevice[]>;

  /**
   * Get detailed information about a specific device.
   *
   * Returns full device metadata including:
   * - All capabilities
   * - Current state (if cached)
   * - Platform-specific information
   *
   * @param deviceId Universal device ID or platform-specific ID
   * @returns Device information
   * @throws {DeviceNotFoundError} If device doesn't exist
   * @throws {DeviceError} If retrieval fails
   */
  getDevice(deviceId: string): Promise<UnifiedDevice>;

  /**
   * Get current state of a device.
   *
   * Behavior:
   * - May return cached state (check timestamp)
   * - Use refreshDeviceState() to force refresh
   *
   * Performance: Fast if cached, network-bound if live query
   *
   * @param deviceId Universal device ID or platform-specific ID
   * @returns Current device state with all attribute values
   * @throws {DeviceNotFoundError} If device doesn't exist
   * @throws {DeviceOfflineError} If device not reachable
   * @throws {DeviceError} If state retrieval fails
   */
  getDeviceState(deviceId: string): Promise<DeviceState>;

  /**
   * Refresh device state from platform (bypass cache).
   *
   * Forces live query to platform API, useful when:
   * - Need guaranteed fresh state
   * - Suspect cached state is stale
   * - After executing command on another platform
   *
   * @param deviceId Universal device ID or platform-specific ID
   * @returns Fresh device state
   * @throws {DeviceNotFoundError} If device doesn't exist
   * @throws {DeviceOfflineError} If device not reachable
   * @throws {DeviceError} If refresh fails
   */
  refreshDeviceState(deviceId: string): Promise<DeviceState>;

  /**
   * Get capabilities supported by a device.
   *
   * Returns array of DeviceCapability enums representing
   * all capabilities available on the device.
   *
   * Implementation notes:
   * - Filter out platform-specific capabilities not in unified model
   * - Log warning for unmapped capabilities
   * - Cache results (capabilities rarely change)
   *
   * @param deviceId Universal device ID or platform-specific ID
   * @returns Array of supported capabilities
   * @throws {DeviceNotFoundError} If device doesn't exist
   * @throws {DeviceError} If capability query fails
   */
  getDeviceCapabilities(deviceId: string): Promise<DeviceCapability[]>;

  //
  // Command Execution
  //

  /**
   * Execute a command on a device.
   *
   * Process:
   * 1. Validate device exists
   * 2. Validate device has required capability
   * 3. Map unified command to platform-specific command
   * 4. Execute command via platform API
   * 5. Wait for confirmation (or timeout)
   * 6. Return result with updated state (optional)
   *
   * Error Handling:
   * - Retries on transient failures (network, rate limit)
   * - No retry on permanent failures (device offline, invalid command)
   * - Returns CommandResult with error details on failure
   *
   * @param deviceId Universal device ID or platform-specific ID
   * @param command Command to execute
   * @param options Execution options (timeout, retry, etc.)
   * @returns Command execution result
   * @throws {DeviceNotFoundError} If device doesn't exist
   * @throws {CapabilityNotSupportedError} If device lacks capability
   * @throws {InvalidCommandError} If command invalid for capability
   * @throws {DeviceOfflineError} If device not reachable
   * @throws {DeviceError} If execution fails
   */
  executeCommand(
    deviceId: string,
    command: DeviceCommand,
    options?: CommandExecutionOptions
  ): Promise<CommandResult>;

  /**
   * Execute multiple commands in sequence or parallel.
   *
   * Batch execution patterns:
   * - Sequential: Commands execute one after another (default)
   * - Parallel: Commands execute simultaneously (if supported)
   *
   * Use cases:
   * - Turn off all lights in a room
   * - Set multiple thermostat parameters
   * - Synchronized device actions
   *
   * @param commands Array of device ID and command pairs
   * @param options Execution options (sequential vs parallel, continue on error)
   * @returns Array of command results (same order as input)
   */
  executeBatchCommands(
    commands: Array<{ deviceId: string; command: DeviceCommand }>,
    options?: BatchCommandOptions
  ): Promise<CommandResult[]>;

  //
  // Capability Mapping (Internal)
  //

  /**
   * Map platform-specific capability to unified capability.
   *
   * Examples:
   * - SmartThings 'switchLevel' → DeviceCapability.DIMMER
   * - Tuya 'bright_value' → DeviceCapability.DIMMER
   * - Lutron OUTPUT (0-100) → DeviceCapability.DIMMER
   *
   * Returns null if capability not supported in unified model.
   *
   * @param platformCapability Platform-specific capability identifier
   * @returns Unified capability enum or null
   */
  mapPlatformCapability(platformCapability: string): DeviceCapability | null;

  /**
   * Map unified capability to platform-specific capability.
   *
   * Reverse of mapPlatformCapability.
   *
   * @param unifiedCapability Unified capability enum
   * @returns Platform-specific capability identifier or null
   */
  mapUnifiedCapability(unifiedCapability: DeviceCapability): string | null;

  //
  // Location and Room Management
  //

  /**
   * List all locations/homes accessible on this platform.
   *
   * Locations represent physical locations (homes, buildings)
   * that contain rooms and devices.
   *
   * @returns Array of location information
   * @throws {DeviceError} If listing fails
   */
  listLocations(): Promise<LocationInfo[]>;

  /**
   * List all rooms within a location.
   *
   * @param locationId Optional location filter
   * @returns Array of room information
   * @throws {DeviceError} If listing fails
   */
  listRooms(locationId?: string): Promise<RoomInfo[]>;

  //
  // Scene Management (Optional)
  //

  /**
   * Check if adapter supports scenes.
   *
   * Platform scene support:
   * - SmartThings: ✅ Full support
   * - Tuya: ✅ Full support
   * - Lutron: ⚠️ Limited (internal scenes not exposed via integration API)
   */
  supportsScenes(): boolean;

  /**
   * List scenes/automations.
   *
   * Only available if supportsScenes() returns true.
   *
   * @param locationId Optional location filter
   * @returns Array of scene information
   * @throws {NotSupportedError} If scenes not supported
   * @throws {DeviceError} If listing fails
   */
  listScenes(locationId?: string): Promise<SceneInfo[]>;

  /**
   * Execute a scene.
   *
   * @param sceneId Scene identifier (platform-specific or universal)
   * @throws {NotSupportedError} If scenes not supported
   * @throws {SceneNotFoundError} If scene doesn't exist
   * @throws {DeviceError} If execution fails
   */
  executeScene(sceneId: string): Promise<void>;

  //
  // Event Handling
  //

  /**
   * Event: Device state changed.
   *
   * Emitted when:
   * - Device state changes (detected via polling or webhook)
   * - After command execution (if platform provides confirmation)
   *
   * Event data: { device: UnifiedDevice, oldState: DeviceState, newState: DeviceState }
   *
   * Note: Not all platforms support real-time events.
   * Polling-based platforms may have delayed updates.
   */
  on(event: 'stateChange', listener: (data: StateChangeEvent) => void): this;

  /**
   * Event: Device added to platform.
   *
   * Emitted when a new device is detected.
   *
   * Event data: { device: UnifiedDevice }
   */
  on(event: 'deviceAdded', listener: (data: DeviceAddedEvent) => void): this;

  /**
   * Event: Device removed from platform.
   *
   * Emitted when a device is removed or becomes unavailable.
   *
   * Event data: { deviceId: UniversalDeviceId }
   */
  on(event: 'deviceRemoved', listener: (data: DeviceRemovedEvent) => void): this;

  /**
   * Event: Device online status changed.
   *
   * Emitted when device comes online or goes offline.
   *
   * Event data: { deviceId: UniversalDeviceId, online: boolean }
   */
  on(event: 'deviceOnlineChange', listener: (data: DeviceOnlineChangeEvent) => void): this;

  /**
   * Event: Adapter error occurred.
   *
   * Emitted for non-fatal errors that don't cause operation failure
   * but should be logged/monitored.
   *
   * Event data: { error: DeviceError, context: string }
   */
  on(event: 'error', listener: (data: AdapterErrorEvent) => void): this;
}
```

### Supporting Types

```typescript
/**
 * Device filters for narrowing search results.
 */
export interface DeviceFilters {
  roomId?: string;
  locationId?: string;
  capability?: DeviceCapability;
  online?: boolean;
  manufacturer?: string;
  namePattern?: RegExp; // Regex pattern for device name
}

/**
 * Command execution options.
 */
export interface CommandExecutionOptions {
  timeout?: number;           // Milliseconds to wait for confirmation (default: 5000)
  retries?: number;           // Max retry attempts on transient failure (default: 3)
  waitForConfirmation?: boolean; // Wait for state update confirmation (default: true)
  component?: string;         // SmartThings component (default: 'main')
}

/**
 * Batch command execution options.
 */
export interface BatchCommandOptions {
  parallel?: boolean;         // Execute commands in parallel (default: false)
  continueOnError?: boolean;  // Continue if individual command fails (default: true)
  timeout?: number;           // Total timeout for all commands
}

/**
 * Adapter health status.
 */
export interface AdapterHealthStatus {
  healthy: boolean;
  platform: Platform;
  apiReachable: boolean;
  authenticated: boolean;
  lastSuccessfulCall?: Date;
  errorCount: number;         // Recent error count
  message?: string;           // Human-readable status message
  details?: Record<string, unknown>; // Platform-specific health details
}

/**
 * Event data types.
 */
export interface StateChangeEvent {
  device: UnifiedDevice;
  oldState: DeviceState;
  newState: DeviceState;
  timestamp: Date;
}

export interface DeviceAddedEvent {
  device: UnifiedDevice;
  timestamp: Date;
}

export interface DeviceRemovedEvent {
  deviceId: UniversalDeviceId;
  timestamp: Date;
}

export interface DeviceOnlineChangeEvent {
  deviceId: UniversalDeviceId;
  online: boolean;
  timestamp: Date;
}

export interface AdapterErrorEvent {
  error: DeviceError;
  context: string;
  timestamp: Date;
}

/**
 * Location information.
 */
export interface LocationInfo {
  locationId: string;        // Platform-specific location ID
  name: string;
  roomCount?: number;
  deviceCount?: number;
}

/**
 * Room information.
 */
export interface RoomInfo {
  roomId: string;            // Platform-specific room ID
  name: string;
  locationId: string;
  deviceCount?: number;
}

/**
 * Scene information.
 */
export interface SceneInfo {
  sceneId: string;           // Platform-specific scene ID
  name: string;
  description?: string;
  locationId?: string;
  createdAt?: Date;
  lastExecutedAt?: Date;
}
```

---

## State Management Pattern

### Design Approach

**Event-Driven Architecture with Caching**

State management follows an event-driven pattern with intelligent caching:

1. **Initial State**: Cached on first access with TTL (Time To Live)
2. **State Updates**: Propagated via events when detected
3. **Cache Invalidation**: Automatic on command execution and events
4. **Manual Refresh**: Available via `refreshDeviceState()`

### State Cache Implementation

```typescript
/**
 * State cache manager for device adapters.
 *
 * Responsibilities:
 * - Cache device states with TTL
 * - Invalidate cache on state changes
 * - Emit events on state changes
 * - Handle concurrent access safely
 */
export class DeviceStateCache {
  private cache: Map<UniversalDeviceId, CachedState> = new Map();
  private readonly defaultTTL: number = 60_000; // 60 seconds

  constructor(
    private adapter: IDeviceAdapter,
    private ttl: number = 60_000
  ) {
    // Auto-invalidate on state changes
    adapter.on('stateChange', (event) => {
      this.set(event.device.id, event.newState);
    });
  }

  /**
   * Get cached state or fetch if missing/expired.
   */
  async get(deviceId: UniversalDeviceId): Promise<DeviceState> {
    const cached = this.cache.get(deviceId);

    // Return cached if fresh
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.ttl) {
      return cached.state;
    }

    // Fetch fresh state
    const freshState = await this.adapter.refreshDeviceState(deviceId);
    this.set(deviceId, freshState);
    return freshState;
  }

  /**
   * Set state in cache.
   */
  set(deviceId: UniversalDeviceId, state: DeviceState): void {
    this.cache.set(deviceId, {
      state,
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate cached state for device.
   */
  invalidate(deviceId: UniversalDeviceId): void {
    this.cache.delete(deviceId);
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
}

interface CachedState {
  state: DeviceState;
  timestamp: Date;
}
```

### State Update Patterns

**Pattern 1: Polling (SmartThings, Tuya)**

```typescript
class PollingStateManager {
  private pollInterval: NodeJS.Timeout | null = null;

  startPolling(devices: UnifiedDevice[], intervalMs: number = 30_000): void {
    this.pollInterval = setInterval(async () => {
      for (const device of devices) {
        try {
          const oldState = await this.cache.get(device.id);
          const newState = await this.adapter.refreshDeviceState(device.id);

          if (this.hasStateChanged(oldState, newState)) {
            this.adapter.emit('stateChange', {
              device,
              oldState,
              newState,
              timestamp: new Date(),
            });
          }
        } catch (error) {
          logger.warn('Polling error', { deviceId: device.id, error });
        }
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private hasStateChanged(oldState: DeviceState, newState: DeviceState): boolean {
    return JSON.stringify(oldState.attributes) !== JSON.stringify(newState.attributes);
  }
}
```

**Pattern 2: Webhook (Tuya, future SmartThings)**

```typescript
class WebhookStateManager {
  async handleWebhook(payload: PlatformWebhookPayload): Promise<void> {
    const device = await this.adapter.getDevice(payload.deviceId);
    const oldState = await this.cache.get(device.id);

    // Parse webhook payload to unified state
    const newState = this.parseWebhookState(payload);

    // Update cache
    this.cache.set(device.id, newState);

    // Emit event
    this.adapter.emit('stateChange', {
      device,
      oldState,
      newState,
      timestamp: new Date(),
    });
  }
}
```

**Pattern 3: Command Confirmation**

```typescript
async executeCommand(
  deviceId: string,
  command: DeviceCommand,
  options?: CommandExecutionOptions
): Promise<CommandResult> {
  const device = await this.getDevice(deviceId);

  // Get old state
  const oldState = await this.getDeviceState(deviceId);

  // Execute command
  await this.platformClient.sendCommand(device.platformDeviceId, command);

  // Wait for state update (with timeout)
  const newState = await this.waitForStateUpdate(
    deviceId,
    command,
    options?.timeout ?? 5000
  );

  // Invalidate cache and emit event
  this.cache.invalidate(device.id);
  this.emit('stateChange', { device, oldState, newState, timestamp: new Date() });

  return {
    success: true,
    deviceId: device.id,
    command,
    executedAt: new Date(),
    newState,
  };
}
```

### State Consistency Guarantees

1. **Eventually Consistent**: State updates propagate within TTL period
2. **Read-Your-Writes**: Commands invalidate cache, forcing fresh read
3. **No Lost Updates**: Events ensure all state changes captured
4. **Concurrent Access Safe**: Cache operations atomic via Map

---

## Command Execution Pattern

### Async Command Flow

```typescript
/**
 * Command execution flow with retry logic.
 */
async function executeCommandWithRetry(
  adapter: IDeviceAdapter,
  deviceId: string,
  command: DeviceCommand,
  options: CommandExecutionOptions = {}
): Promise<CommandResult> {
  const {
    timeout = 5000,
    retries = 3,
    waitForConfirmation = true,
  } = options;

  let lastError: DeviceError | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Step 1: Validate device and capability
      const device = await adapter.getDevice(deviceId);
      const capabilities = await adapter.getDeviceCapabilities(deviceId);

      if (!capabilities.includes(command.capability)) {
        throw new CapabilityNotSupportedError(
          `Device ${deviceId} does not support ${command.capability}`
        );
      }

      // Step 2: Execute command
      const startTime = Date.now();
      const result = await Promise.race([
        adapter.executeCommand(deviceId, command, options),
        timeout(timeout, `Command execution timeout after ${timeout}ms`),
      ]);

      // Step 3: Wait for confirmation (optional)
      if (waitForConfirmation) {
        await waitForStateChange(adapter, deviceId, command, timeout);
      }

      logger.info('Command executed successfully', {
        deviceId,
        command: command.command,
        duration: Date.now() - startTime,
        attempt,
      });

      return result;

    } catch (error) {
      lastError = error as DeviceError;

      // Don't retry on permanent errors
      if (
        error instanceof DeviceNotFoundError ||
        error instanceof CapabilityNotSupportedError ||
        error instanceof InvalidCommandError
      ) {
        throw error;
      }

      // Retry on transient errors
      if (attempt < retries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        logger.warn('Command failed, retrying', {
          deviceId,
          command: command.command,
          attempt,
          nextAttemptIn: delay,
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw new CommandExecutionError(
    `Command failed after ${retries} attempts: ${lastError?.message}`,
    { deviceId, command, lastError }
  );
}

/**
 * Wait for device state to reflect command execution.
 */
async function waitForStateChange(
  adapter: IDeviceAdapter,
  deviceId: string,
  command: DeviceCommand,
  timeoutMs: number
): Promise<DeviceState> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const state = await adapter.refreshDeviceState(deviceId);

    if (commandReflectedInState(command, state)) {
      return state;
    }

    await sleep(500); // Poll every 500ms
  }

  throw new CommandConfirmationTimeoutError(
    `State change not detected within ${timeoutMs}ms`
  );
}

/**
 * Check if command is reflected in device state.
 */
function commandReflectedInState(command: DeviceCommand, state: DeviceState): boolean {
  const { capability, command: commandName, parameters } = command;

  // Example: switch.on → check state.attributes['switch.switch'] === 'on'
  // Example: dimmer.setLevel(75) → check state.attributes['dimmer.level'] === 75

  switch (capability) {
    case DeviceCapability.SWITCH:
      if (commandName === 'on') {
        return state.attributes['switch.switch'] === 'on';
      } else if (commandName === 'off') {
        return state.attributes['switch.switch'] === 'off';
      }
      break;

    case DeviceCapability.DIMMER:
      if (commandName === 'setLevel') {
        const expectedLevel = parameters?.level as number;
        const actualLevel = state.attributes['dimmer.level'] as number;
        return Math.abs(actualLevel - expectedLevel) < 2; // Allow 2% tolerance
      }
      break;

    // ... more capability checks
  }

  return false; // Cannot verify, assume success
}
```

### Error Handling Strategy

```typescript
/**
 * Device error hierarchy.
 */
export abstract class DeviceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Authentication errors (no retry)
export class AuthenticationError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', context);
  }
}

// Device not found (no retry)
export class DeviceNotFoundError extends DeviceError {
  constructor(deviceId: string, context?: Record<string, unknown>) {
    super(`Device not found: ${deviceId}`, 'DEVICE_NOT_FOUND', { deviceId, ...context });
  }
}

// Capability not supported (no retry)
export class CapabilityNotSupportedError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CAPABILITY_NOT_SUPPORTED', context);
  }
}

// Invalid command (no retry)
export class InvalidCommandError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INVALID_COMMAND', context);
  }
}

// Device offline (retry possible)
export class DeviceOfflineError extends DeviceError {
  constructor(deviceId: string, context?: Record<string, unknown>) {
    super(`Device offline: ${deviceId}`, 'DEVICE_OFFLINE', { deviceId, ...context });
  }
}

// Network error (retry)
export class NetworkError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', context);
  }
}

// Rate limit (retry with backoff)
export class RateLimitError extends DeviceError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', { retryAfter, ...context });
  }
}

// Timeout (retry)
export class TimeoutError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', context);
  }
}

// Command execution failed (check context for retry)
export class CommandExecutionError extends DeviceError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'COMMAND_EXECUTION_ERROR', context);
  }
}

// Feature not supported by adapter
export class NotSupportedError extends DeviceError {
  constructor(feature: string, platform: Platform, context?: Record<string, unknown>) {
    super(
      `Feature '${feature}' not supported by ${platform} adapter`,
      'NOT_SUPPORTED',
      { feature, platform, ...context }
    );
  }
}
```

---

## Type Safety Strategy

### Branded Types

```typescript
/**
 * Branded types prevent mixing of platform-specific IDs.
 *
 * TypeScript structural typing allows:
 *   let deviceId: DeviceId = "abc";
 *   let roomId: RoomId = "abc";
 *   deviceId = roomId; // Error: Type 'RoomId' not assignable to 'DeviceId'
 *
 * Branded types add compile-time safety without runtime cost.
 */

// Universal ID (cross-platform)
export type UniversalDeviceId = string & { readonly __brand: 'UniversalDeviceId' };

// Platform-specific IDs (from existing codebase)
export type DeviceId = string & { readonly __brand: 'DeviceId' };
export type LocationId = string & { readonly __brand: 'LocationId' };
export type RoomId = string & { readonly __brand: 'RoomId' };
export type SceneId = string & { readonly __brand: 'SceneId' };
export type CapabilityName = string & { readonly __brand: 'CapabilityName' };

/**
 * Type guards for runtime validation.
 */
export function isUniversalDeviceId(id: string): id is UniversalDeviceId {
  return id.includes(':') && Object.values(Platform).some(p => id.startsWith(p + ':'));
}

export function isDeviceId(id: string): id is DeviceId {
  // Platform-specific validation (e.g., UUID for SmartThings)
  return /^[a-f0-9-]{36}$/i.test(id); // UUID format
}
```

### Discriminated Unions

```typescript
/**
 * Discriminated unions enable type narrowing based on discriminant property.
 */

// Capability interfaces use 'type' as discriminant
type UnifiedCapabilityInterface =
  | ISwitchCapability
  | IDimmerCapability
  | IColorCapability
  // ...

function getCapabilityCommands(capability: UnifiedCapabilityInterface): string[] {
  switch (capability.type) {
    case DeviceCapability.SWITCH:
      return ['on', 'off', 'toggle'];
    case DeviceCapability.DIMMER:
      return ['setLevel'];
    case DeviceCapability.COLOR:
      return ['setColor', 'setHue', 'setSaturation'];
    // TypeScript ensures exhaustive checking
    default:
      const _exhaustiveCheck: never = capability;
      throw new Error(`Unhandled capability: ${_exhaustiveCheck}`);
  }
}
```

### Generic Constraints

```typescript
/**
 * Generic constraints ensure type safety in adapter implementations.
 */

interface IAdapter<TPlatformDevice, TPlatformState> {
  mapToUnifiedDevice(platformDevice: TPlatformDevice): UnifiedDevice;
  mapToUnifiedState(platformState: TPlatformState): DeviceState;
}

class SmartThingsAdapter implements IAdapter<STDevice, STDeviceStatus> {
  mapToUnifiedDevice(device: STDevice): UnifiedDevice {
    // TypeScript ensures correct types
    return {
      id: createUniversalDeviceId(Platform.SMARTTHINGS, device.deviceId),
      platform: Platform.SMARTTHINGS,
      platformDeviceId: device.deviceId,
      name: device.name ?? 'Unknown',
      capabilities: this.mapCapabilities(device.components),
      online: true, // SmartThings doesn't expose offline status in device list
    };
  }

  mapToUnifiedState(status: STDeviceStatus): DeviceState {
    const attributes: Record<string, unknown> = {};

    // Map component attributes to flat structure
    for (const [compName, compStatus] of Object.entries(status.components)) {
      for (const [capName, capStatus] of Object.entries(compStatus)) {
        for (const [attrName, attrValue] of Object.entries(capStatus)) {
          const key = `${this.mapPlatformCapability(capName)}.${attrName}`;
          attributes[key] = attrValue.value;
        }
      }
    }

    return {
      deviceId: createUniversalDeviceId(Platform.SMARTTHINGS, status.deviceId),
      timestamp: new Date(),
      attributes,
    };
  }
}
```

---

## Implementation Examples

### SmartThings Adapter Implementation

```typescript
import { SmartThingsClient, BearerTokenAuthenticator } from '@smartthings/core-sdk';
import { EventEmitter } from 'events';

export class SmartThingsAdapter extends EventEmitter implements IDeviceAdapter {
  readonly platform = Platform.SMARTTHINGS;
  readonly platformName = 'SmartThings';
  readonly version = '1.0.0';

  private client: SmartThingsClient;
  private initialized = false;
  private stateCache: DeviceStateCache;
  private pollingManager: PollingStateManager;

  constructor(
    private config: SmartThingsAdapterConfig
  ) {
    super();
    this.stateCache = new DeviceStateCache(this, config.cacheTTL);
  }

  async initialize(): Promise<void> {
    try {
      // Authenticate
      this.client = new SmartThingsClient(
        new BearerTokenAuthenticator(this.config.accessToken)
      );

      // Validate credentials with test call
      await this.client.locations.list();

      // Start polling if enabled
      if (this.config.enablePolling) {
        const devices = await this.listDevices();
        this.pollingManager.startPolling(devices, this.config.pollIntervalMs);
      }

      this.initialized = true;
      logger.info('SmartThings adapter initialized');

    } catch (error) {
      throw new AuthenticationError(
        'Failed to initialize SmartThings adapter',
        { error }
      );
    }
  }

  async dispose(): Promise<void> {
    this.pollingManager?.stopPolling();
    this.stateCache.clear();
    this.removeAllListeners();
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    try {
      await this.client.locations.list();
      return {
        healthy: true,
        platform: Platform.SMARTTHINGS,
        apiReachable: true,
        authenticated: true,
        lastSuccessfulCall: new Date(),
        errorCount: 0,
        message: 'SmartThings API healthy',
      };
    } catch (error) {
      return {
        healthy: false,
        platform: Platform.SMARTTHINGS,
        apiReachable: false,
        authenticated: false,
        errorCount: 1,
        message: `Health check failed: ${error.message}`,
      };
    }
  }

  async listDevices(filters?: DeviceFilters): Promise<UnifiedDevice[]> {
    const devices = await retryWithBackoff(() => this.client.devices.list());

    // Apply filters
    let filteredDevices = devices;
    if (filters?.roomId) {
      filteredDevices = filteredDevices.filter(d => d.roomId === filters.roomId);
    }
    if (filters?.locationId) {
      filteredDevices = filteredDevices.filter(d => d.locationId === filters.locationId);
    }

    // Map to unified model
    return Promise.all(
      filteredDevices.map(device => this.mapToUnifiedDevice(device))
    );
  }

  async getDevice(deviceId: string): Promise<UnifiedDevice> {
    const platformDeviceId = this.resolvePlatformDeviceId(deviceId);
    const device = await retryWithBackoff(() =>
      this.client.devices.get(platformDeviceId)
    );

    if (!device) {
      throw new DeviceNotFoundError(deviceId);
    }

    return this.mapToUnifiedDevice(device);
  }

  async getDeviceState(deviceId: string): Promise<DeviceState> {
    const universalId = this.resolveUniversalDeviceId(deviceId);
    return this.stateCache.get(universalId);
  }

  async refreshDeviceState(deviceId: string): Promise<DeviceState> {
    const platformDeviceId = this.resolvePlatformDeviceId(deviceId);
    const status = await retryWithBackoff(() =>
      this.client.devices.getStatus(platformDeviceId)
    );

    return this.mapToUnifiedState(status, deviceId);
  }

  async getDeviceCapabilities(deviceId: string): Promise<DeviceCapability[]> {
    const device = await this.getDevice(deviceId);
    return device.capabilities;
  }

  async executeCommand(
    deviceId: string,
    command: DeviceCommand,
    options?: CommandExecutionOptions
  ): Promise<CommandResult> {
    const device = await this.getDevice(deviceId);
    const platformDeviceId = device.platformDeviceId;

    // Validate capability
    if (!device.capabilities.includes(command.capability)) {
      throw new CapabilityNotSupportedError(
        `Device ${deviceId} does not support ${command.capability}`,
        { deviceId, capability: command.capability }
      );
    }

    // Map to platform command
    const platformCommand = this.mapToPlatformCommand(command);

    // Execute
    try {
      await retryWithBackoff(() =>
        this.client.devices.executeCommand(
          platformDeviceId,
          {
            capability: platformCommand.capability,
            command: platformCommand.command,
            arguments: platformCommand.arguments,
            component: options?.component ?? 'main',
          }
        )
      );

      // Invalidate cache
      this.stateCache.invalidate(device.id);

      // Get fresh state
      const newState = await this.refreshDeviceState(deviceId);

      return {
        success: true,
        deviceId: device.id,
        command,
        executedAt: new Date(),
        newState,
      };

    } catch (error) {
      return {
        success: false,
        deviceId: device.id,
        command,
        executedAt: new Date(),
        error: new CommandExecutionError(
          `Failed to execute command: ${error.message}`,
          { deviceId, command, error }
        ),
      };
    }
  }

  async executeBatchCommands(
    commands: Array<{ deviceId: string; command: DeviceCommand }>,
    options?: BatchCommandOptions
  ): Promise<CommandResult[]> {
    if (options?.parallel) {
      // Parallel execution
      return Promise.all(
        commands.map(({ deviceId, command }) =>
          this.executeCommand(deviceId, command).catch(error => ({
            success: false,
            deviceId: deviceId as UniversalDeviceId,
            command,
            executedAt: new Date(),
            error,
          }))
        )
      );
    } else {
      // Sequential execution
      const results: CommandResult[] = [];
      for (const { deviceId, command } of commands) {
        try {
          const result = await this.executeCommand(deviceId, command);
          results.push(result);

          if (!result.success && !options?.continueOnError) {
            break; // Stop on first failure
          }
        } catch (error) {
          results.push({
            success: false,
            deviceId: deviceId as UniversalDeviceId,
            command,
            executedAt: new Date(),
            error: error as DeviceError,
          });

          if (!options?.continueOnError) {
            break;
          }
        }
      }
      return results;
    }
  }

  mapPlatformCapability(platformCapability: string): DeviceCapability | null {
    const mapping: Record<string, DeviceCapability> = {
      'switch': DeviceCapability.SWITCH,
      'switchLevel': DeviceCapability.DIMMER,
      'colorControl': DeviceCapability.COLOR,
      'colorTemperature': DeviceCapability.COLOR_TEMPERATURE,
      'thermostat': DeviceCapability.THERMOSTAT,
      'lock': DeviceCapability.LOCK,
      'windowShade': DeviceCapability.SHADE,
      'temperatureMeasurement': DeviceCapability.TEMPERATURE_SENSOR,
      'relativeHumidityMeasurement': DeviceCapability.HUMIDITY_SENSOR,
      'motionSensor': DeviceCapability.MOTION_SENSOR,
      'contactSensor': DeviceCapability.CONTACT_SENSOR,
      'illuminanceMeasurement': DeviceCapability.ILLUMINANCE_SENSOR,
      'battery': DeviceCapability.BATTERY,
    };

    return mapping[platformCapability] ?? null;
  }

  mapUnifiedCapability(unifiedCapability: DeviceCapability): string | null {
    const reverseMapping: Record<DeviceCapability, string> = {
      [DeviceCapability.SWITCH]: 'switch',
      [DeviceCapability.DIMMER]: 'switchLevel',
      [DeviceCapability.COLOR]: 'colorControl',
      [DeviceCapability.COLOR_TEMPERATURE]: 'colorTemperature',
      [DeviceCapability.THERMOSTAT]: 'thermostat',
      [DeviceCapability.LOCK]: 'lock',
      [DeviceCapability.SHADE]: 'windowShade',
      [DeviceCapability.TEMPERATURE_SENSOR]: 'temperatureMeasurement',
      [DeviceCapability.HUMIDITY_SENSOR]: 'relativeHumidityMeasurement',
      [DeviceCapability.MOTION_SENSOR]: 'motionSensor',
      [DeviceCapability.CONTACT_SENSOR]: 'contactSensor',
      [DeviceCapability.OCCUPANCY_SENSOR]: null, // Not supported
      [DeviceCapability.ILLUMINANCE_SENSOR]: 'illuminanceMeasurement',
      [DeviceCapability.BATTERY]: 'battery',
    };

    return reverseMapping[unifiedCapability] ?? null;
  }

  async listLocations(): Promise<LocationInfo[]> {
    const locations = await retryWithBackoff(() => this.client.locations.list());

    return locations.map(loc => ({
      locationId: loc.locationId!,
      name: loc.name!,
    }));
  }

  async listRooms(locationId?: string): Promise<RoomInfo[]> {
    if (!locationId) {
      // Get first location if none specified
      const locations = await this.listLocations();
      locationId = locations[0]?.locationId;
    }

    if (!locationId) {
      return [];
    }

    const rooms = await retryWithBackoff(() =>
      this.client.rooms.list(locationId)
    );

    return rooms.map(room => ({
      roomId: room.roomId!,
      name: room.name!,
      locationId: locationId!,
    }));
  }

  supportsScenes(): boolean {
    return true;
  }

  async listScenes(locationId?: string): Promise<SceneInfo[]> {
    if (!locationId) {
      const locations = await this.listLocations();
      locationId = locations[0]?.locationId;
    }

    if (!locationId) {
      return [];
    }

    const scenes = await retryWithBackoff(() =>
      this.client.scenes.list(locationId)
    );

    return scenes.map(scene => ({
      sceneId: scene.sceneId!,
      name: scene.sceneName!,
      locationId,
    }));
  }

  async executeScene(sceneId: string): Promise<void> {
    await retryWithBackoff(() => this.client.scenes.execute(sceneId));
  }

  //
  // Helper methods
  //

  private mapToUnifiedDevice(device: STDevice): UnifiedDevice {
    const capabilities = (device.components?.[0]?.capabilities ?? [])
      .map(cap => this.mapPlatformCapability(cap.id))
      .filter((cap): cap is DeviceCapability => cap !== null);

    return {
      id: createUniversalDeviceId(Platform.SMARTTHINGS, device.deviceId!),
      platform: Platform.SMARTTHINGS,
      platformDeviceId: device.deviceId!,
      name: device.name ?? device.label ?? 'Unknown Device',
      label: device.label,
      manufacturer: device.manufacturerName,
      model: device.deviceManufacturerCode,
      room: undefined, // Fetch separately if needed
      location: device.locationId,
      capabilities,
      online: true, // SmartThings doesn't expose this in device list
      platformSpecific: {
        type: device.type,
        components: device.components,
      },
    };
  }

  private mapToUnifiedState(status: STDeviceStatus, deviceId: string): DeviceState {
    const attributes: Record<string, unknown> = {};

    for (const [compName, compStatus] of Object.entries(status.components)) {
      for (const [capName, capAttrs] of Object.entries(compStatus)) {
        const unifiedCap = this.mapPlatformCapability(capName);
        if (!unifiedCap) continue;

        for (const [attrName, attrValue] of Object.entries(capAttrs)) {
          const key = `${unifiedCap}.${attrName}`;
          attributes[key] = attrValue.value;
        }
      }
    }

    return {
      deviceId: this.resolveUniversalDeviceId(deviceId),
      timestamp: new Date(),
      attributes,
    };
  }

  private mapToPlatformCommand(command: DeviceCommand): PlatformCommand {
    const platformCapability = this.mapUnifiedCapability(command.capability);

    if (!platformCapability) {
      throw new InvalidCommandError(
        `Capability ${command.capability} not supported on SmartThings`,
        { capability: command.capability }
      );
    }

    return {
      capability: platformCapability,
      command: command.command,
      arguments: command.parameters ? Object.values(command.parameters) : [],
    };
  }

  private resolvePlatformDeviceId(deviceId: string): string {
    if (isUniversalDeviceId(deviceId)) {
      const { platform, platformDeviceId } = parseUniversalDeviceId(deviceId);
      if (platform !== Platform.SMARTTHINGS) {
        throw new DeviceNotFoundError(deviceId, {
          reason: `Device belongs to ${platform}, not SmartThings`,
        });
      }
      return platformDeviceId;
    }
    return deviceId; // Assume platform-specific ID
  }

  private resolveUniversalDeviceId(deviceId: string): UniversalDeviceId {
    if (isUniversalDeviceId(deviceId)) {
      return deviceId;
    }
    return createUniversalDeviceId(Platform.SMARTTHINGS, deviceId);
  }
}

interface SmartThingsAdapterConfig {
  accessToken: string;
  enablePolling?: boolean;
  pollIntervalMs?: number;
  cacheTTL?: number;
}
```

### Tuya Adapter Implementation (Sketch)

```typescript
import { TuyaContext } from '@tuya/tuya-connector-nodejs';

export class TuyaAdapter extends EventEmitter implements IDeviceAdapter {
  readonly platform = Platform.TUYA;
  readonly platformName = 'Tuya';
  readonly version = '1.0.0';

  private client: TuyaContext;

  async initialize(): Promise<void> {
    this.client = new TuyaContext({
      baseUrl: this.config.region === 'us'
        ? 'https://openapi.tuyaus.com'
        : 'https://openapi.tuyaeu.com',
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
    });

    // Test connection
    await this.client.request({ method: 'GET', path: '/v1.0/token' });
  }

  mapPlatformCapability(platformCapability: string): DeviceCapability | null {
    const mapping: Record<string, DeviceCapability> = {
      'switch_led': DeviceCapability.SWITCH,
      'bright_value': DeviceCapability.DIMMER,
      'colour_data': DeviceCapability.COLOR,
      'temp_set': DeviceCapability.THERMOSTAT,
      'lock_motor_state': DeviceCapability.LOCK,
      'doorcontact_state': DeviceCapability.CONTACT_SENSOR,
      'pir': DeviceCapability.MOTION_SENSOR,
      // ... more mappings
    };

    return mapping[platformCapability] ?? null;
  }

  private convertBrightness(tuyaValue: number): number {
    // Tuya: 0-1000, Unified: 0-100
    return Math.round(tuyaValue / 10);
  }

  private convertBrightnessToTuya(unifiedValue: number): number {
    // Unified: 0-100, Tuya: 0-1000
    return Math.round(unifiedValue * 10);
  }

  // ... rest of implementation
}
```

### Lutron Adapter Implementation (Sketch)

```typescript
export class LutronCasetaAdapter extends EventEmitter implements IDeviceAdapter {
  readonly platform = Platform.LUTRON;
  readonly platformName = 'Lutron Caseta';
  readonly version = '1.0.0';

  private telnetClient: TelnetClient;

  async initialize(): Promise<void> {
    this.telnetClient = new TelnetClient({
      host: this.config.bridgeIP,
      port: 23,
      username: 'lutron',
      password: this.config.password,
    });

    await this.telnetClient.connect();
  }

  mapPlatformCapability(platformCapability: string): DeviceCapability | null {
    const mapping: Record<string, DeviceCapability> = {
      'OUTPUT': DeviceCapability.DIMMER, // Lutron OUTPUT supports 0-100%
      'OCCUPANCY': DeviceCapability.OCCUPANCY_SENSOR,
    };

    return mapping[platformCapability] ?? null;
  }

  supportsScenes(): boolean {
    return false; // Lutron scenes not exposed via integration API
  }

  async executeCommand(
    deviceId: string,
    command: DeviceCommand,
    options?: CommandExecutionOptions
  ): Promise<CommandResult> {
    // Lutron uses zone-based addressing
    const zone = this.getDeviceZone(deviceId);

    if (command.capability === DeviceCapability.DIMMER) {
      const level = command.parameters?.level as number;
      const fadeTime = command.parameters?.duration ?? 0;

      // #OUTPUT,<zone>,1,<level>,<fade>,<delay>
      await this.telnetClient.send(`#OUTPUT,${zone},1,${level},${fadeTime},0`);
    }

    // ... handle other commands
  }

  // ... rest of implementation
}
```

---

## Migration Plan

### Phase 1: Create Abstraction Layer (Week 1-2)

**Tasks:**
1. Create type definitions
   - `src/platform/types/unified-device.ts` - Device models
   - `src/platform/types/capabilities.ts` - Capability definitions
   - `src/platform/types/errors.ts` - Error hierarchy

2. Create IDeviceAdapter interface
   - `src/platform/interfaces/device-adapter.interface.ts`

3. Create supporting utilities
   - `src/platform/utils/state-cache.ts` - State caching
   - `src/platform/utils/command-executor.ts` - Command execution with retry
   - `src/platform/utils/capability-mapper.ts` - Base capability mapping utilities

**Deliverables:**
- ✅ Complete type definitions
- ✅ IDeviceAdapter interface
- ✅ Utility classes
- ✅ Unit tests for utilities

### Phase 2: Implement SmartThings Adapter (Week 2-3)

**Tasks:**
1. Create SmartThingsAdapter class
   - `src/platform/adapters/smartthings/smartthings-adapter.ts`
   - `src/platform/adapters/smartthings/capability-mapper.ts`
   - `src/platform/adapters/smartthings/config.ts`

2. Refactor existing SmartThingsService
   - Keep as internal implementation detail
   - Wrap with adapter interface

3. Implement all IDeviceAdapter methods
   - Device discovery and info
   - State management
   - Command execution
   - Location/room management
   - Scene support

4. Add comprehensive tests
   - Unit tests for capability mapping
   - Integration tests with real SmartThings devices
   - Mock adapter for unit testing consumers

**Deliverables:**
- ✅ SmartThingsAdapter implementation
- ✅ Capability mapping complete
- ✅ All tests passing
- ✅ Backward compatibility maintained

### Phase 3: Create Platform Registry (Week 3-4)

**Tasks:**
1. Implement PlatformRegistry
   - `src/platform/registry.ts`
   - Adapter registration
   - Device routing by universal ID
   - Unified device listing across platforms

2. Update MCP tools to use registry
   - Replace direct SmartThingsService calls
   - Use universal device IDs
   - Handle multi-platform scenarios

3. Create adapter factory
   - `src/platform/factory.ts`
   - Adapter instantiation from config
   - Environment variable integration

**Deliverables:**
- ✅ PlatformRegistry implemented
- ✅ MCP tools refactored
- ✅ All existing functionality works via registry
- ✅ Tests updated

### Phase 4: Validation and Testing (Week 4)

**Tasks:**
1. Regression testing
   - All SmartThings features work via adapter
   - No performance degradation (< 10% latency increase)
   - Memory usage acceptable

2. Integration testing
   - Test with real SmartThings devices
   - Various device types (switch, dimmer, sensor, etc.)
   - Error scenarios (offline devices, invalid commands)

3. Documentation
   - Update architecture docs
   - Create adapter implementation guide
   - Document capability mapping

4. Code review and cleanup
   - Remove deprecated code
   - Improve inline documentation
   - Address TODOs

**Deliverables:**
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Code review approved
- ✅ Ready for Tuya adapter implementation

### Future Phases

**Phase 5: Tuya Adapter (Week 5-7)**
- Implement TuyaAdapter following SmartThings pattern
- Capability mapping with value conversions
- Testing with real Tuya devices

**Phase 6: Lutron Adapter (Week 8-10)**
- Implement LutronCasetaAdapter
- Telnet protocol integration
- Limited capability set (dimmer, occupancy)

---

## Testing Strategy

### Unit Tests

```typescript
describe('SmartThingsAdapter', () => {
  let adapter: SmartThingsAdapter;
  let mockClient: jest.Mocked<SmartThingsClient>;

  beforeEach(() => {
    mockClient = createMockSmartThingsClient();
    adapter = new SmartThingsAdapter({
      accessToken: 'test-token',
      client: mockClient // Inject mock
    });
  });

  describe('initialization', () => {
    it('should authenticate successfully', async () => {
      await adapter.initialize();
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should throw AuthenticationError on invalid token', async () => {
      mockClient.locations.list.mockRejectedValue(new Error('401 Unauthorized'));
      await expect(adapter.initialize()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('capability mapping', () => {
    it('should map SmartThings switch to unified SWITCH', () => {
      expect(adapter.mapPlatformCapability('switch')).toBe(DeviceCapability.SWITCH);
    });

    it('should map SmartThings switchLevel to unified DIMMER', () => {
      expect(adapter.mapPlatformCapability('switchLevel')).toBe(DeviceCapability.DIMMER);
    });

    it('should return null for unknown capabilities', () => {
      expect(adapter.mapPlatformCapability('unknownCap')).toBe(null);
    });
  });

  describe('device listing', () => {
    it('should map SmartThings devices to unified model', async () => {
      mockClient.devices.list.mockResolvedValue([
        createMockSTDevice({ deviceId: 'abc', name: 'Living Room Light' })
      ]);

      const devices = await adapter.listDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        platform: Platform.SMARTTHINGS,
        platformDeviceId: 'abc',
        name: 'Living Room Light',
      });
      expect(devices[0].id).toBe('smartthings:abc');
    });

    it('should filter by room', async () => {
      mockClient.devices.list.mockResolvedValue([
        createMockSTDevice({ deviceId: 'abc', roomId: 'room1' }),
        createMockSTDevice({ deviceId: 'def', roomId: 'room2' }),
      ]);

      const devices = await adapter.listDevices({ roomId: 'room1' });
      expect(devices).toHaveLength(1);
      expect(devices[0].platformDeviceId).toBe('abc');
    });
  });

  describe('command execution', () => {
    it('should execute switch on command', async () => {
      const deviceId = 'smartthings:abc';
      mockClient.devices.get.mockResolvedValue(
        createMockSTDevice({ deviceId: 'abc', capabilities: ['switch'] })
      );

      const result = await adapter.executeCommand(deviceId, {
        capability: DeviceCapability.SWITCH,
        command: 'on',
      });

      expect(result.success).toBe(true);
      expect(mockClient.devices.executeCommand).toHaveBeenCalledWith(
        'abc',
        expect.objectContaining({
          capability: 'switch',
          command: 'on',
        })
      );
    });

    it('should throw CapabilityNotSupportedError for missing capability', async () => {
      mockClient.devices.get.mockResolvedValue(
        createMockSTDevice({ deviceId: 'abc', capabilities: ['switch'] })
      );

      await expect(
        adapter.executeCommand('smartthings:abc', {
          capability: DeviceCapability.THERMOSTAT,
          command: 'setHeatingSetpoint',
        })
      ).rejects.toThrow(CapabilityNotSupportedError);
    });
  });
});
```

### Integration Tests

```typescript
describe('SmartThings Integration', () => {
  let adapter: SmartThingsAdapter;

  beforeAll(() => {
    // Use real credentials from env
    adapter = new SmartThingsAdapter({
      accessToken: process.env.SMARTTHINGS_PAT!,
    });
  });

  it('should list real devices', async () => {
    await adapter.initialize();
    const devices = await adapter.listDevices();

    expect(devices.length).toBeGreaterThan(0);
    devices.forEach(device => {
      expect(device.platform).toBe(Platform.SMARTTHINGS);
      expect(device.id).toMatch(/^smartthings:/);
    });
  });

  it('should control real switch device', async () => {
    const device = findTestDevice(DeviceCapability.SWITCH);

    // Turn on
    await adapter.executeCommand(device.id, {
      capability: DeviceCapability.SWITCH,
      command: 'on',
    });

    // Wait for state update
    await sleep(2000);

    // Verify state
    const state = await adapter.getDeviceState(device.id);
    expect(state.attributes['switch.switch']).toBe('on');
  });
});
```

---

## Acceptance Criteria Validation

### ✅ Criterion 1: IDeviceAdapter interface defined with all required methods

**Status:** Complete

**Evidence:**
- IDeviceAdapter interface includes 20+ methods
- Lifecycle management: `initialize()`, `dispose()`, `isInitialized()`, `healthCheck()`
- Device operations: `listDevices()`, `getDevice()`, `getDeviceState()`, `refreshDeviceState()`, `getDeviceCapabilities()`
- Command execution: `executeCommand()`, `executeBatchCommands()`
- Capability mapping: `mapPlatformCapability()`, `mapUnifiedCapability()`
- Location/room management: `listLocations()`, `listRooms()`
- Scene support: `supportsScenes()`, `listScenes()`, `executeScene()`
- Event handling: EventEmitter with typed events

**Validation:** Interface covers all operational requirements identified in architecture analysis.

---

### ✅ Criterion 2: DeviceCapability enum covers all device types

**Status:** Complete

**Evidence:**
- **Control capabilities:** SWITCH, DIMMER, COLOR, COLOR_TEMPERATURE, THERMOSTAT, LOCK, SHADE, FAN (8 types)
- **Sensor capabilities:** TEMPERATURE_SENSOR, HUMIDITY_SENSOR, MOTION_SENSOR, CONTACT_SENSOR, OCCUPANCY_SENSOR, ILLUMINANCE_SENSOR, BATTERY (7 types)
- **Composite capabilities:** ENERGY_METER, VALVE, ALARM (3 types)
- **Total:** 18 device capability types

**Coverage Matrix:**
| Device Type | SmartThings | Tuya | Lutron | Unified |
|-------------|-------------|------|--------|---------|
| Switch | ✅ | ✅ | ✅ | ✅ |
| Dimmer | ✅ | ✅ | ✅ | ✅ |
| Color Light | ✅ | ✅ | ❌ | ✅ |
| Thermostat | ✅ | ✅ | ❌ | ✅ |
| Lock | ✅ | ✅ | ❌ | ✅ |
| Temperature Sensor | ✅ | ✅ | ❌ | ✅ |
| Motion Sensor | ✅ | ✅ | ❌ | ✅ |
| Contact Sensor | ✅ | ✅ | ❌ | ✅ |
| Occupancy Sensor | ❌ | ❌ | ✅ | ✅ |
| Shade | ✅ | ✅ | ✅ | ✅ |

**Validation:** Unified model covers all device types across all three target platforms with graceful degradation for platform-specific gaps.

---

### ✅ Criterion 3: State management pattern documented

**Status:** Complete

**Evidence:**
- **State Cache Pattern**: DeviceStateCache class with TTL-based expiration
- **Update Mechanisms**: Polling, webhooks, and command confirmation patterns documented
- **Event-Driven Updates**: StateChangeEvent propagated on state changes
- **Cache Invalidation**: Automatic on command execution and events
- **Manual Refresh**: `refreshDeviceState()` bypasses cache for fresh data
- **Consistency Guarantees**: Eventually consistent, read-your-writes, concurrent-safe

**Implementation Details:**
- Cache TTL: 60 seconds (configurable)
- Polling interval: 30 seconds (configurable)
- State comparison: JSON stringify for change detection
- Thread-safe: Map-based storage with atomic operations

**Validation:** State management handles all three update patterns (polling, webhooks, command confirmation) with proper caching and consistency.

---

### ✅ Criterion 4: Command execution pattern supports sync/async operations

**Status:** Complete

**Evidence:**
- **Async-first design**: All methods return `Promise<T>`
- **Retry logic**: Exponential backoff with configurable retries (default: 3)
- **Timeout support**: Configurable per-command timeout (default: 5000ms)
- **Confirmation pattern**: Optional wait for state update confirmation
- **Batch execution**: Sequential and parallel execution modes
- **Error handling**: Standardized error types with retry decisions

**Command Flow:**
1. Validate device exists
2. Validate capability support
3. Map unified → platform command
4. Execute with retry (transient errors only)
5. Wait for confirmation (optional)
6. Return CommandResult with success/error

**Async Patterns Supported:**
- `await adapter.executeCommand(...)` - Single command
- `await adapter.executeBatchCommands([...], { parallel: true })` - Parallel execution
- `await adapter.executeBatchCommands([...], { parallel: false })` - Sequential execution
- `Promise.race([executeCommand(), timeout()])` - Timeout handling

**Validation:** Command execution fully async with proper error handling, retry logic, and confirmation patterns.

---

### ✅ Criterion 5: Type safety enforced via TypeScript

**Status:** Complete

**Evidence:**

**Branded Types:**
```typescript
type UniversalDeviceId = string & { readonly __brand: 'UniversalDeviceId' };
type DeviceId = string & { readonly __brand: 'DeviceId' };
type LocationId = string & { readonly __brand: 'LocationId' };
type RoomId = string & { readonly __brand: 'RoomId' };
type SceneId = string & { readonly __brand: 'SceneId' };
type CapabilityName = string & { readonly __brand: 'CapabilityName' };
```

**Discriminated Unions:**
```typescript
type UnifiedCapabilityInterface =
  | ISwitchCapability
  | IDimmerCapability
  | IColorCapability
  // ...

// Type narrowing:
switch (capability.type) {
  case DeviceCapability.SWITCH: // TypeScript knows it's ISwitchCapability
    return capability.commands.on();
}
```

**Enum Safety:**
```typescript
enum DeviceCapability { SWITCH, DIMMER, ... }
enum Platform { SMARTTHINGS, TUYA, LUTRON }
enum ThermostatMode { OFF, HEAT, COOL, AUTO }
// Exhaustive checking enforced by TypeScript
```

**Generic Constraints:**
```typescript
interface IAdapter<TPlatformDevice, TPlatformState> {
  mapToUnifiedDevice(device: TPlatformDevice): UnifiedDevice;
}
```

**Validation:** All types are strongly typed with branded types preventing ID mixing, discriminated unions enabling type narrowing, and enums ensuring exhaustive checking.

---

## Conclusion

This design document provides a complete specification for the IDeviceAdapter interface and unified capability model. The design enables:

1. **Multi-platform support** - SmartThings, Tuya, and Lutron through single interface
2. **Type safety** - Branded types and discriminated unions prevent errors
3. **Async operations** - All methods return Promises with proper error handling
4. **State management** - Event-driven with intelligent caching
5. **Command execution** - Retry logic, timeouts, and confirmation patterns
6. **Extensibility** - Easy to add new capabilities and platforms
7. **Testing** - Interface enables mocking for comprehensive testing

**Next Steps:**
1. ✅ Review and approve design (Ticket 1M-239)
2. Begin Phase 1 implementation (Create abstraction layer)
3. Implement SmartThings adapter (Phase 2)
4. Create platform registry (Phase 3)
5. Validation and testing (Phase 4)

**Design Status:** ✅ COMPLETE - Ready for implementation

---

**Document Metadata:**
- **Ticket:** 1M-239
- **Epic:** Layer 2 - Unified Device Abstraction
- **Author:** Research Agent
- **Date:** 2025-11-26
- **Status:** Design Complete
- **Next Review:** After Phase 1 implementation
