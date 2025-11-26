/**
 * Device state type definitions.
 *
 * Defines types for representing and managing device state across
 * different platforms with caching, change tracking, and event support.
 *
 * Design Principles:
 * - Normalized structure: Flat attribute map for easy access
 * - Timestamped: Track when state was captured
 * - Type-safe: Attributes keyed by capability.attribute pattern
 * - Immutable: Readonly properties prevent accidental modifications
 * - Event-driven: State changes emit events for subscribers
 *
 * @module types/device-state
 */

import type { UniversalDeviceId } from './unified-device.js';
import type { DeviceCommand } from './commands.js';

/**
 * Device state represents the current attribute values of all capabilities.
 *
 * Attribute Naming Convention:
 * - Key format: "{capability}.{attribute}"
 * - Examples:
 *   - "switch.switch": "on" | "off"
 *   - "dimmer.level": 0-100
 *   - "temperatureSensor.temperature": number
 *   - "thermostat.heatingSetpoint": number
 *
 * Design Rationale:
 * - Flat structure: Easier to query and update than nested
 * - Capability prefix: Prevents attribute name collisions
 * - Type-safe values: TypeScript enforces correct types
 * - Platform-agnostic: Works across SmartThings, Tuya, Lutron
 *
 * @example
 * ```typescript
 * const state: DeviceState = {
 *   deviceId: 'smartthings:abc-123' as UniversalDeviceId,
 *   timestamp: new Date(),
 *   attributes: {
 *     'switch.switch': 'on',
 *     'dimmer.level': 75,
 *     'temperatureSensor.temperature': 22.5,
 *     'temperatureSensor.unit': 'C',
 *   }
 * };
 * ```
 */
export interface DeviceState {
  /** Device this state belongs to */
  readonly deviceId: UniversalDeviceId;

  /** When this state was captured */
  readonly timestamp: Date;

  /**
   * Attribute values keyed by "{capability}.{attribute}".
   *
   * Value types vary by attribute:
   * - string: Enums and text values
   * - number: Numeric measurements and levels
   * - boolean: Binary states
   * - object: Complex values (rare, prefer flattening)
   *
   * Examples:
   * - 'switch.switch': 'on' | 'off'
   * - 'dimmer.level': 75 (number)
   * - 'lock.lock': 'locked' | 'unlocked'
   * - 'thermostat.mode': 'heat' | 'cool' | 'auto'
   */
  attributes: Record<string, unknown>;

  /**
   * Platform-specific state information (escape hatch).
   *
   * Use cases:
   * - SmartThings: Component structure, health info
   * - Tuya: DP codes, product info
   * - Lutron: Zone info, integration details
   *
   * Warning: Using platformSpecific reduces portability.
   */
  platformSpecific?: Record<string, unknown>;
}

/**
 * Device attribute metadata.
 *
 * Describes a single attribute including its type, range, and units.
 * Used for validation and UI generation.
 */
export interface DeviceAttribute {
  /** Attribute name within its capability */
  name: string;

  /** Capability this attribute belongs to */
  capability: string;

  /**
   * Attribute value type.
   *
   * - string: Enum values, text
   * - number: Measurements, levels, percentages
   * - boolean: Binary states
   * - enum: Fixed set of string values
   * - object: Complex structured data (avoid if possible)
   */
  type: 'string' | 'number' | 'boolean' | 'enum' | 'object';

  /**
   * Possible values (for enum type).
   *
   * Example: ['on', 'off'] for switch
   * Example: ['locked', 'unlocked', 'jammed'] for lock
   */
  enumValues?: string[];

  /**
   * Minimum value (for number type).
   */
  min?: number;

  /**
   * Maximum value (for number type).
   */
  max?: number;

  /**
   * Unit of measurement.
   *
   * Examples: '%', 'C', 'F', 'lux', 'W', 'kWh'
   */
  unit?: string;

  /**
   * Whether attribute is read-only.
   *
   * True for sensors, false for actuators.
   */
  readonly?: boolean;

  /**
   * Human-readable description.
   */
  description?: string;
}

/**
 * State change event data.
 *
 * Emitted when device state changes, either from:
 * - Command execution
 * - Polling update
 * - Webhook/push notification
 * - Manual refresh
 */
export interface StateChangeEvent {
  /** Device whose state changed */
  deviceId: UniversalDeviceId;

  /** Previous state (before change) */
  oldState: DeviceState;

  /** New state (after change) */
  newState: DeviceState;

  /** When the change was detected */
  timestamp: Date;

  /**
   * Command that triggered the change (if applicable).
   *
   * Undefined for:
   * - External state changes (manual control)
   * - Sensor updates
   * - Scheduled operations
   */
  triggeringCommand?: DeviceCommand;

  /**
   * Changed attributes with before/after values.
   *
   * Only includes attributes that actually changed.
   * Format: Map of "capability.attribute" to {old, new} values
   *
   * @example
   * ```typescript
   * {
   *   'switch.switch': { old: 'off', new: 'on' },
   *   'dimmer.level': { old: 50, new: 75 }
   * }
   * ```
   */
  changedAttributes: Record<string, { old: unknown; new: unknown }>;

  /**
   * Source of the state change.
   *
   * - command: Result of executeCommand()
   * - poll: Detected via polling
   * - webhook: Received via webhook/push
   * - refresh: Manual refreshDeviceState() call
   * - event: Platform event (SmartThings SSE, Tuya webhook)
   */
  source: 'command' | 'poll' | 'webhook' | 'refresh' | 'event';
}

/**
 * Cached state with metadata.
 *
 * Internal type used by DeviceStateCache.
 * Includes timestamp for TTL expiration checking.
 */
export interface CachedState {
  /** Cached device state */
  state: DeviceState;

  /** When this state was cached */
  cachedAt: Date;

  /**
   * When this cache entry expires.
   *
   * After expiration, next access will trigger refresh.
   */
  expiresAt: Date;

  /**
   * Number of cache hits since last refresh.
   *
   * Used for cache effectiveness metrics.
   */
  hitCount: number;
}

/**
 * State cache configuration.
 *
 * Controls caching behavior for device state.
 */
export interface StateCacheConfig {
  /**
   * Time-to-live for cached state (milliseconds).
   *
   * Default: 60000 (60 seconds)
   * Range: 5000-300000 (5 seconds - 5 minutes)
   *
   * Shorter TTL:
   * - More API calls
   * - Fresher data
   * - Higher accuracy
   *
   * Longer TTL:
   * - Fewer API calls
   * - Stale data risk
   * - Better performance
   */
  ttl: number;

  /**
   * Maximum cache size (number of devices).
   *
   * Default: 1000
   *
   * When exceeded, oldest entries are evicted (LRU).
   * Prevents unbounded memory growth.
   */
  maxSize: number;

  /**
   * Enable cache metrics collection.
   *
   * Default: true
   *
   * Tracks:
   * - Hit rate
   * - Miss rate
   * - Eviction count
   * - Average age
   */
  enableMetrics: boolean;

  /**
   * Automatically invalidate cache on state change events.
   *
   * Default: true
   *
   * When true:
   * - StateChangeEvent → invalidate cache
   * - Next read triggers refresh
   * - Ensures consistency
   *
   * When false:
   * - Manual invalidation required
   * - Risk of stale reads
   * - Better performance
   */
  autoInvalidateOnChange: boolean;
}

/**
 * State cache metrics.
 *
 * Performance and effectiveness metrics for monitoring.
 */
export interface StateCacheMetrics {
  /** Total cache hits (returned without API call) */
  hits: number;

  /** Total cache misses (required API call) */
  misses: number;

  /** Cache hit rate (0-1) */
  hitRate: number;

  /** Total cache invalidations */
  invalidations: number;

  /** Total cache evictions (due to size limit) */
  evictions: number;

  /** Current cache size (number of entries) */
  currentSize: number;

  /** Maximum cache size seen */
  peakSize: number;

  /** Average cache entry age (milliseconds) */
  averageAge: number;

  /** Oldest cache entry age (milliseconds) */
  oldestAge: number;
}

/**
 * State comparison result.
 *
 * Result of comparing two device states.
 */
export interface StateComparisonResult {
  /** Whether states are identical */
  identical: boolean;

  /** Attributes that changed */
  changedAttributes: Record<string, { old: unknown; new: unknown }>;

  /** Attributes added in new state */
  addedAttributes: string[];

  /** Attributes removed in new state */
  removedAttributes: string[];
}

/**
 * State filter options.
 *
 * Filter which attributes to include in state queries.
 */
export interface StateFilterOptions {
  /**
   * Only include these capabilities.
   *
   * Example: ['switch', 'dimmer'] - only switch and dimmer attributes
   */
  capabilities?: string[];

  /**
   * Exclude these capabilities.
   *
   * Takes precedence over capabilities (exclude wins).
   */
  excludeCapabilities?: string[];

  /**
   * Only include attributes matching this pattern.
   *
   * Example: /^switch\./ - only switch attributes
   */
  attributePattern?: RegExp;

  /**
   * Include platform-specific data.
   *
   * Default: false
   */
  includePlatformSpecific?: boolean;
}

/**
 * Helper function to compare two device states.
 *
 * @param oldState Previous state
 * @param newState New state
 * @returns Comparison result with changed attributes
 *
 * @example
 * ```typescript
 * const comparison = compareStates(oldState, newState);
 * if (!comparison.identical) {
 *   console.log('Changed:', comparison.changedAttributes);
 * }
 * ```
 */
export function compareStates(
  oldState: DeviceState,
  newState: DeviceState
): StateComparisonResult {
  const changedAttributes: Record<string, { old: unknown; new: unknown }> = {};
  const addedAttributes: string[] = [];
  const removedAttributes: string[] = [];

  // Find changed and removed attributes
  for (const [key, oldValue] of Object.entries(oldState.attributes)) {
    const newValue = newState.attributes[key];

    if (newValue === undefined) {
      removedAttributes.push(key);
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedAttributes[key] = { old: oldValue, new: newValue };
    }
  }

  // Find added attributes
  for (const key of Object.keys(newState.attributes)) {
    if (oldState.attributes[key] === undefined) {
      addedAttributes.push(key);
    }
  }

  return {
    identical:
      changedAttributes &&
      Object.keys(changedAttributes).length === 0 &&
      addedAttributes.length === 0 &&
      removedAttributes.length === 0,
    changedAttributes,
    addedAttributes,
    removedAttributes,
  };
}

/**
 * Helper function to filter device state attributes.
 *
 * @param state Device state to filter
 * @param options Filter options
 * @returns Filtered device state
 *
 * @example
 * ```typescript
 * // Get only switch and dimmer attributes
 * const filtered = filterState(state, {
 *   capabilities: ['switch', 'dimmer']
 * });
 * ```
 */
export function filterState(
  state: DeviceState,
  options: StateFilterOptions
): DeviceState {
  const filteredAttributes: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state.attributes)) {
    const [capability] = key.split('.');

    // Type guard: Skip if capability is undefined (shouldn't happen with valid attribute keys)
    if (!capability) {
      continue;
    }

    // Check capability inclusion
    if (options.capabilities && !options.capabilities.includes(capability)) {
      continue;
    }

    // Check capability exclusion
    if (options.excludeCapabilities?.includes(capability)) {
      continue;
    }

    // Check pattern match
    if (options.attributePattern && !options.attributePattern.test(key)) {
      continue;
    }

    filteredAttributes[key] = value;
  }

  return {
    deviceId: state.deviceId,
    timestamp: state.timestamp,
    attributes: filteredAttributes,
    ...(options.includePlatformSpecific &&
      state.platformSpecific && { platformSpecific: state.platformSpecific }),
  };
}
