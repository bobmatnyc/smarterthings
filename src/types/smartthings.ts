/**
 * SmartThings API type definitions.
 *
 * These types complement the @smartthings/core-sdk types
 * with additional branded types for domain safety.
 */

/**
 * Branded type for device IDs to prevent mixing with regular strings.
 */
export type DeviceId = string & { readonly __brand: 'DeviceId' };

/**
 * Branded type for location IDs.
 */
export type LocationId = string & { readonly __brand: 'LocationId' };

/**
 * Branded type for capability names.
 */
export type CapabilityName = string & { readonly __brand: 'CapabilityName' };

/**
 * Branded type for room IDs.
 */
export type RoomId = string & { readonly __brand: 'RoomId' };

/**
 * Branded type for scene IDs.
 */
export type SceneId = string & { readonly __brand: 'SceneId' };

/**
 * Device status response from SmartThings API.
 */
export interface DeviceStatus {
  deviceId: DeviceId;
  components: Record<string, ComponentStatus>;
}

/**
 * Component status with capability states.
 */
export interface ComponentStatus {
  [capability: string]: {
    [attribute: string]: {
      value: unknown;
      unit?: string;
      timestamp?: string;
    };
  };
}

/**
 * Device command execution request.
 */
export interface DeviceCommand {
  capability: CapabilityName;
  command: string;
  arguments?: unknown[];
  component?: string;
}

/**
 * Device state extracted from DeviceStatus.
 *
 * This interface represents the current state of a device's capabilities
 * (on/off, dimmer level, sensor readings, etc.). It's extracted from
 * DeviceStatus and stored in platformSpecific for efficient access.
 *
 * Design Decision: Flat structure for quick access
 * - All state values at top level (no nested capability groups)
 * - Optional fields for capability-specific values
 * - Timestamp indicates when state was last fetched
 *
 * Use Cases:
 * - Display current switch state in UI (on/off)
 * - Show dimmer level for brightness controls
 * - Display sensor readings (temperature, humidity, motion)
 * - Monitor battery levels for low-battery alerts
 *
 * @example
 * ```typescript
 * const state: DeviceState = {
 *   switch: 'on',
 *   level: 75,
 *   temperature: 72,
 *   humidity: 45,
 *   motion: 'inactive',
 *   battery: 95,
 *   timestamp: '2025-12-04T03:45:00Z'
 * };
 * ```
 */
export interface DeviceState {
  // Switch/Dimmer controls
  /** Switch state: 'on' or 'off' */
  switch?: 'on' | 'off';
  /** Dimmer level: 0-100 */
  level?: number;

  // Sensors
  /** Temperature in device's configured unit (Celsius or Fahrenheit) */
  temperature?: number;
  /** Relative humidity: 0-100% */
  humidity?: number;
  /** Motion detection: 'active' or 'inactive' */
  motion?: 'active' | 'inactive';
  /** Light level in lux */
  illuminance?: number;
  /** Battery level: 0-100% */
  battery?: number;

  // Contact/Occupancy
  /** Contact sensor: 'open' or 'closed' */
  contact?: 'open' | 'closed';
  /** Occupancy detection: 'occupied' or 'unoccupied' */
  occupancy?: 'occupied' | 'unoccupied';

  // Safety sensors
  /** Water leak detection: 'dry' or 'wet' */
  water?: 'dry' | 'wet';
  /** Smoke detection: 'clear' or 'detected' */
  smoke?: 'clear' | 'detected';
  /** Carbon monoxide detection: 'clear' or 'detected' */
  carbonMonoxide?: 'clear' | 'detected';

  // Environmental
  /** Air quality index (AQI) */
  airQuality?: number;
  /** Barometric pressure in configured unit */
  pressure?: number;
  /** Sound pressure level in decibels */
  soundPressureLevel?: number;

  // Timestamp when state was fetched
  timestamp?: string;
}

/**
 * Simplified device information for MCP responses.
 */
export interface DeviceInfo {
  deviceId: DeviceId;
  name: string;
  label?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  type?: string;
  capabilities?: string[];
  components?: string[];
  locationId?: string;
  roomId?: string;
  roomName?: string;
  online?: boolean;
  platformSpecific?: Record<string, unknown>;
}

/**
 * Device capability information.
 */
export interface CapabilityInfo {
  id: CapabilityName;
  version: number;
  commands?: string[];
  attributes?: string[];
}

/**
 * Creates a branded DeviceId from a string.
 *
 * @param id Raw device ID string
 * @returns Branded DeviceId
 */
export function createDeviceId(id: string): DeviceId {
  return id as DeviceId;
}

/**
 * Creates a branded LocationId from a string.
 *
 * @param id Raw location ID string
 * @returns Branded LocationId
 */
export function createLocationId(id: string): LocationId {
  return id as LocationId;
}

/**
 * Creates a branded CapabilityName from a string.
 *
 * @param name Raw capability name
 * @returns Branded CapabilityName
 */
export function createCapabilityName(name: string): CapabilityName {
  return name as CapabilityName;
}

/**
 * Creates a branded RoomId from a string.
 *
 * @param id Raw room ID string
 * @returns Branded RoomId
 */
export function createRoomId(id: string): RoomId {
  return id as RoomId;
}

/**
 * Creates a branded SceneId from a string.
 *
 * @param id Raw scene ID string
 * @returns Branded SceneId
 */
export function createSceneId(id: string): SceneId {
  return id as SceneId;
}

/**
 * Room information.
 */
export interface RoomInfo {
  roomId: RoomId;
  name: string;
  locationId: LocationId;
  deviceCount?: number;
}

/**
 * Location information.
 */
export interface LocationInfo {
  locationId: LocationId;
  name: string;
  roomCount?: number;
}

/**
 * Scene information from SmartThings API.
 */
export interface SceneInfo {
  sceneId: SceneId;
  sceneName: string;
  sceneIcon?: string;
  sceneColor?: string;
  locationId?: LocationId;
  createdBy?: string;
  createdDate?: Date;
  lastUpdatedDate?: Date;
  lastExecutedDate?: Date;
  editable?: boolean;
}

/**
 * Re-export event-related types for convenience.
 *
 * Event types are defined in separate module due to complexity.
 * See: src/types/device-events.ts
 */
export type {
  DeviceEvent,
  DeviceEventOptions,
  DeviceEventResult,
  DeviceEventMetadata,
  EventGap,
  EventPattern,
} from './device-events.js';
