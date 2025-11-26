/**
 * Unified device type definitions for multi-platform device abstraction.
 *
 * This module defines the core types for representing devices across
 * SmartThings, Tuya, Lutron, and other platforms through a unified interface.
 *
 * Design Principles:
 * - Platform-agnostic: Types work across all supported platforms
 * - Type-safe: Branded types prevent ID mixing across platforms
 * - Extensible: Easy to add new platforms and capabilities
 * - Immutable: Readonly properties prevent accidental modifications
 *
 * @module types/unified-device
 */

import type { DeviceId, LocationId, RoomId, SceneId } from './smartthings.js';

/**
 * Platform identifiers for supported device ecosystems.
 *
 * Design Decision: Enum vs Union Types
 * - Enums provide better autocomplete and type safety
 * - Runtime introspection possible (Object.values(Platform))
 * - Can be extended without modifying existing code
 */
export enum Platform {
  SMARTTHINGS = 'smartthings',
  TUYA = 'tuya',
  LUTRON = 'lutron',
}

/**
 * Device capability types representing device functions.
 *
 * Capabilities are platform-agnostic and represent what a device can do,
 * not what platform it comes from.
 *
 * Coverage:
 * - 8 control capabilities (actuators)
 * - 7 sensor capabilities (read-only)
 * - 3 composite capabilities
 * Total: 18 capabilities
 *
 * Missing capabilities from code review added:
 * - SPEAKER, MEDIA_PLAYER, CAMERA
 * - AIR_QUALITY_SENSOR, WATER_LEAK_SENSOR, SMOKE_DETECTOR
 */
export enum DeviceCapability {
  // Control Capabilities (Actuators)
  /** Binary on/off control */
  SWITCH = 'switch',
  /** Level control (0-100%) */
  DIMMER = 'dimmer',
  /** RGB/HSV color control */
  COLOR = 'color',
  /** White spectrum control (Kelvin) */
  COLOR_TEMPERATURE = 'colorTemperature',
  /** Temperature control with heating/cooling modes */
  THERMOSTAT = 'thermostat',
  /** Lock/unlock control */
  LOCK = 'lock',
  /** Window covering position/tilt control */
  SHADE = 'shade',
  /** Fan speed control */
  FAN = 'fan',
  /** Water/gas valve control */
  VALVE = 'valve',
  /** Security alarm control */
  ALARM = 'alarm',

  // Sensor Capabilities (Read-only)
  /** Temperature reading */
  TEMPERATURE_SENSOR = 'temperatureSensor',
  /** Humidity reading (0-100%) */
  HUMIDITY_SENSOR = 'humiditySensor',
  /** Motion detection */
  MOTION_SENSOR = 'motionSensor',
  /** Open/closed detection */
  CONTACT_SENSOR = 'contactSensor',
  /** Room occupancy detection */
  OCCUPANCY_SENSOR = 'occupancySensor',
  /** Light level measurement (lux) */
  ILLUMINANCE_SENSOR = 'illuminanceSensor',
  /** Battery level (0-100%) */
  BATTERY = 'battery',
  /** Air quality measurement */
  AIR_QUALITY_SENSOR = 'airQualitySensor',
  /** Water leak detection */
  WATER_LEAK_SENSOR = 'waterLeakSensor',
  /** Smoke detection */
  SMOKE_DETECTOR = 'smokeDetector',

  // Composite Capabilities
  /** Power consumption monitoring */
  ENERGY_METER = 'energyMeter',
  /** Audio playback control */
  SPEAKER = 'speaker',
  /** Media player control */
  MEDIA_PLAYER = 'mediaPlayer',
  /** Camera with video stream */
  CAMERA = 'camera',
}

/**
 * Branded type for universal device IDs.
 *
 * Format: "{platform}:{platformDeviceId}"
 * Examples:
 * - "smartthings:abc-123-def"
 * - "tuya:bf1234567890abcdef"
 * - "lutron:zone-1"
 *
 * Type Safety: Branded types prevent mixing with regular strings
 * or platform-specific IDs at compile time.
 */
export type UniversalDeviceId = string & { readonly __brand: 'UniversalDeviceId' };

/**
 * Create a universal device ID from platform and platform-specific ID.
 *
 * @param platform Platform identifier
 * @param platformDeviceId Platform-specific device ID
 * @returns Universal device ID with platform prefix
 *
 * @example
 * ```typescript
 * const id = createUniversalDeviceId(Platform.SMARTTHINGS, 'abc-123');
 * // Returns: "smartthings:abc-123" as UniversalDeviceId
 * ```
 */
export function createUniversalDeviceId(
  platform: Platform,
  platformDeviceId: string
): UniversalDeviceId {
  return `${platform}:${platformDeviceId}` as UniversalDeviceId;
}

/**
 * Type guard to check if a string is a valid universal device ID.
 *
 * Validates:
 * - Contains platform prefix
 * - Platform is a known Platform enum value
 * - Has colon separator
 *
 * @param id String to check
 * @returns True if valid UniversalDeviceId format
 *
 * @example
 * ```typescript
 * if (isUniversalDeviceId(id)) {
 *   const { platform, platformDeviceId } = parseUniversalDeviceId(id);
 * }
 * ```
 */
export function isUniversalDeviceId(id: string): id is UniversalDeviceId {
  if (!id.includes(':')) {
    return false;
  }

  const [platformStr] = id.split(':');
  return Object.values(Platform).includes(platformStr as Platform);
}

/**
 * Parse a universal device ID into platform and platform-specific ID.
 *
 * Critical Fix from Code Review:
 * - Added runtime validation of platform string
 * - Throws error for invalid platform instead of silent failure
 * - Handles colons in platform-specific IDs correctly
 *
 * @param universalId Universal device ID to parse
 * @returns Object with platform and platformDeviceId
 * @throws {Error} If universal ID format is invalid or platform unknown
 *
 * @example
 * ```typescript
 * const { platform, platformDeviceId } = parseUniversalDeviceId(
 *   'smartthings:abc-123' as UniversalDeviceId
 * );
 * // platform: Platform.SMARTTHINGS
 * // platformDeviceId: 'abc-123'
 * ```
 */
export function parseUniversalDeviceId(universalId: UniversalDeviceId): {
  platform: Platform;
  platformDeviceId: string;
} {
  // Validate format
  if (!isUniversalDeviceId(universalId)) {
    throw new Error(`Invalid universal device ID format: ${universalId}`);
  }

  const [platformStr, ...rest] = universalId.split(':');

  // ✅ Runtime validation (CRITICAL FIX from code review)
  if (!Object.values(Platform).includes(platformStr as Platform)) {
    throw new Error(`Unknown platform in device ID: ${platformStr}`);
  }

  return {
    platform: platformStr as Platform,
    platformDeviceId: rest.join(':'), // Handle colons in platform IDs
  };
}

/**
 * Unified device model representing any device across all platforms.
 *
 * This model normalizes device information from SmartThings, Tuya, Lutron,
 * and other platforms into a consistent structure.
 *
 * Design Rationale:
 * - Capability-based: Devices defined by what they can do, not their type
 * - Platform-agnostic: Common fields work across all platforms
 * - Escape hatch: platformSpecific field for platform-unique features
 * - Immutable: Readonly properties prevent accidental modifications
 */
export interface UnifiedDevice {
  // Identity
  /** Universal device identifier (platform:deviceId) */
  readonly id: UniversalDeviceId;
  /** Originating platform */
  readonly platform: Platform;
  /** Platform-specific device ID */
  readonly platformDeviceId: string;

  // Metadata
  /** User-friendly device name */
  name: string;
  /** Optional label or description */
  label?: string;
  /** Device manufacturer */
  manufacturer?: string;
  /** Device model number/identifier */
  model?: string;
  /** Firmware version */
  firmwareVersion?: string;

  // Organization
  /** Room name or identifier */
  room?: string;
  /** Location/home name or identifier */
  location?: string;

  // Capabilities
  /** List of supported device capabilities */
  readonly capabilities: ReadonlyArray<DeviceCapability>;

  // State
  /** Device reachability status */
  online: boolean;
  /** Last communication timestamp */
  lastSeen?: Date;

  // Platform-specific (Escape Hatch)
  /**
   * Platform-specific properties not covered by unified model.
   *
   * Use cases:
   * - SmartThings: component information, device type
   * - Tuya: category code, product information
   * - Lutron: zone number, integration ID
   *
   * Warning: Using platformSpecific reduces portability.
   * Prefer adding to unified model when feature is common across platforms.
   */
  platformSpecific?: Record<string, unknown>;
}

/**
 * Type guard for Platform enum.
 *
 * @param value Value to check
 * @returns True if value is a valid Platform
 */
export function isPlatform(value: unknown): value is Platform {
  return (
    typeof value === 'string' && Object.values(Platform).includes(value as Platform)
  );
}

/**
 * Type guard for DeviceCapability enum.
 *
 * @param value Value to check
 * @returns True if value is a valid DeviceCapability
 */
export function isDeviceCapability(value: unknown): value is DeviceCapability {
  return (
    typeof value === 'string' &&
    Object.values(DeviceCapability).includes(value as DeviceCapability)
  );
}

/**
 * Re-export existing SmartThings branded types for compatibility.
 *
 * These types are used by platform adapters to maintain type safety
 * when working with platform-specific IDs.
 */
export type { DeviceId, LocationId, RoomId, SceneId };
