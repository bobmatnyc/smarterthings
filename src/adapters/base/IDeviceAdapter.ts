/**
 * Device adapter interface - Platform abstraction layer.
 *
 * This interface defines the contract that all platform adapters
 * (SmartThings, Tuya, Lutron) must implement to provide unified
 * device control and monitoring.
 *
 * Design Principles:
 * - Async-first: All operations return Promises
 * - Type-safe: Branded types prevent cross-platform ID mixing
 * - Event-driven: State changes propagated via EventEmitter
 * - Error-handled: Standardized error types with context
 * - Testable: Interface enables mocking for unit tests
 * - Lifecycle-managed: Initialize → operate → dispose pattern
 *
 * Lifecycle:
 * 1. Construction: new SmartThingsAdapter(config)
 * 2. Initialization: await adapter.initialize()
 * 3. Operation: await adapter.listDevices(), executeCommand(), etc.
 * 4. Event handling: adapter.on('stateChange', handler)
 * 5. Cleanup: await adapter.dispose()
 *
 * @module adapters/base/IDeviceAdapter
 */

import type { EventEmitter } from 'events';
import type {
  Platform,
  DeviceCapability,
  UnifiedDevice,
  LocationId,
  RoomId,
  SceneId,
} from '../../types/unified-device.js';
import type {
  DeviceCommand,
  CommandResult,
  CommandExecutionOptions,
  BatchCommandOptions,
  BatchCommandInput,
} from '../../types/commands.js';
import type { DeviceState } from '../../types/device-state.js';

//
// Adapter Metadata Types
//

/**
 * Adapter health status.
 *
 * Reports current health and connectivity of the adapter.
 */
export interface AdapterHealthStatus {
  /** Overall health status */
  healthy: boolean;
  /** Platform identifier */
  platform: Platform;
  /** Whether platform API is reachable */
  apiReachable: boolean;
  /** Whether credentials are valid */
  authenticated: boolean;
  /** Last successful API call timestamp */
  lastSuccessfulCall?: Date;
  /** Recent error count (rolling window) */
  errorCount: number;
  /** Human-readable status message */
  message?: string;
  /** Platform-specific health details */
  details?: Record<string, unknown>;
}

//
// Filter and Query Types
//

/**
 * Device filters for narrowing search results.
 *
 * All filters are optional and can be combined.
 * Filters use AND logic (all must match).
 */
export interface DeviceFilters {
  /** Filter by room ID */
  roomId?: string;
  /** Filter by location ID */
  locationId?: string;
  /** Filter by capability (device must have this capability) */
  capability?: DeviceCapability;
  /** Filter by online status */
  online?: boolean;
  /** Filter by manufacturer name */
  manufacturer?: string;
  /** Filter by device name pattern (regex) */
  namePattern?: RegExp;
  /** Filter by device type (platform-specific) */
  deviceType?: string;
}

//
// Location, Room, and Scene Types
//

/**
 * Location information.
 *
 * Represents a physical location (home, building) containing devices.
 */
export interface LocationInfo {
  /** Platform-specific location ID */
  locationId: LocationId | string;
  /** Location name */
  name: string;
  /** Number of rooms in location */
  roomCount?: number;
  /** Number of devices in location */
  deviceCount?: number;
}

/**
 * Room information.
 *
 * Represents a room within a location.
 */
export interface RoomInfo {
  /** Platform-specific room ID */
  roomId: RoomId | string;
  /** Room name */
  name: string;
  /** Parent location ID */
  locationId: LocationId | string;
  /** Number of devices in room */
  deviceCount?: number;
}

/**
 * Scene information.
 *
 * Represents an automation or scene that can be executed.
 */
export interface SceneInfo {
  /** Platform-specific scene ID */
  sceneId: SceneId | string;
  /** Scene name */
  name: string;
  /** Scene description */
  description?: string;
  /** Parent location ID */
  locationId?: LocationId | string;
  /** Creation timestamp */
  createdAt?: Date;
  /** Last execution timestamp */
  lastExecutedAt?: Date;
}

//
// Event Data Types
//

/**
 * State change event data.
 *
 * Emitted when device state changes are detected.
 */
export interface StateChangeEvent {
  /** Device whose state changed */
  device: UnifiedDevice;
  /** Previous state */
  oldState: DeviceState;
  /** New state */
  newState: DeviceState;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Device added event data.
 *
 * Emitted when a new device is discovered.
 */
export interface DeviceAddedEvent {
  /** Newly added device */
  device: UnifiedDevice;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Device removed event data.
 *
 * Emitted when a device is removed or becomes unavailable.
 */
export interface DeviceRemovedEvent {
  /** ID of removed device */
  deviceId: string;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Device online status change event data.
 *
 * Emitted when device comes online or goes offline.
 */
export interface DeviceOnlineChangeEvent {
  /** Device whose status changed */
  deviceId: string;
  /** New online status */
  online: boolean;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Adapter error event data.
 *
 * Emitted for non-fatal errors that should be logged/monitored.
 */
export interface AdapterErrorEvent {
  /** Error that occurred */
  error: Error;
  /** Context describing where error occurred */
  context: string;
  /** Event timestamp */
  timestamp: Date;
}

//
// Main Adapter Interface
//

/**
 * Device adapter interface.
 *
 * Each platform (SmartThings, Tuya, Lutron) implements this interface
 * to provide unified device control and monitoring.
 *
 * All methods that can fail should throw DeviceError or subclass.
 * All async operations should respect AbortSignal if provided.
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
   *
   * @returns True if adapter is initialized
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
    commands: BatchCommandInput[],
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
   *
   * @returns True if scenes are supported
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
   * @throws {DeviceError} If scene doesn't exist or execution fails
   */
  executeScene(sceneId: string): Promise<void>;

  //
  // Event Handling
  //
  // Note: These event methods are inherited from EventEmitter
  // but we declare them here for type safety and documentation.
  //

  /**
   * Event: Device state changed.
   *
   * Emitted when:
   * - Device state changes (detected via polling or webhook)
   * - After command execution (if platform provides confirmation)
   *
   * Note: Not all platforms support real-time events.
   * Polling-based platforms may have delayed updates.
   *
   * @event stateChange
   */
  on(event: 'stateChange', listener: (data: StateChangeEvent) => void): this;

  /**
   * Event: Device added to platform.
   *
   * Emitted when a new device is detected.
   *
   * @event deviceAdded
   */
  on(event: 'deviceAdded', listener: (data: DeviceAddedEvent) => void): this;

  /**
   * Event: Device removed from platform.
   *
   * Emitted when a device is removed or becomes unavailable.
   *
   * @event deviceRemoved
   */
  on(event: 'deviceRemoved', listener: (data: DeviceRemovedEvent) => void): this;

  /**
   * Event: Device online status changed.
   *
   * Emitted when device comes online or goes offline.
   *
   * @event deviceOnlineChange
   */
  on(
    event: 'deviceOnlineChange',
    listener: (data: DeviceOnlineChangeEvent) => void
  ): this;

  /**
   * Event: Adapter error occurred.
   *
   * Emitted for non-fatal errors that don't cause operation failure
   * but should be logged/monitored.
   *
   * @event error
   */
  on(event: 'error', listener: (data: AdapterErrorEvent) => void): this;

  // EventEmitter method overloads for type safety
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  once(event: string | symbol, listener: (...args: unknown[]) => void): this;
  emit(event: string | symbol, ...args: unknown[]): boolean;
  removeListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
  removeAllListeners(event?: string | symbol): this;
  listenerCount(event: string | symbol): number;
}

/**
 * Platform registry for managing multiple adapters.
 *
 * Provides unified access to devices across all registered platforms.
 */
export interface IPlatformRegistry {
  /**
   * Register an adapter for a platform.
   *
   * @param adapter Adapter instance to register
   */
  registerAdapter(adapter: IDeviceAdapter): void;

  /**
   * Unregister an adapter.
   *
   * @param platform Platform to unregister
   */
  unregisterAdapter(platform: Platform): void;

  /**
   * Get adapter for a platform.
   *
   * @param platform Platform identifier
   * @returns Adapter instance or undefined
   */
  getAdapter(platform: Platform): IDeviceAdapter | undefined;

  /**
   * Get all registered adapters.
   *
   * @returns Array of all adapters
   */
  getAllAdapters(): IDeviceAdapter[];

  /**
   * List all devices across all platforms.
   *
   * @param filters Optional filters to narrow results
   * @returns Array of unified devices from all platforms
   */
  listAllDevices(filters?: DeviceFilters): Promise<UnifiedDevice[]>;

  /**
   * Get device by universal ID (routes to correct adapter).
   *
   * @param universalId Universal device ID
   * @returns Device information
   */
  getDevice(universalId: string): Promise<UnifiedDevice>;

  /**
   * Execute command (routes to correct adapter by device ID).
   *
   * @param deviceId Universal device ID or platform-specific ID
   * @param command Command to execute
   * @param options Execution options
   * @returns Command result
   */
  executeCommand(
    deviceId: string,
    command: DeviceCommand,
    options?: CommandExecutionOptions
  ): Promise<CommandResult>;
}
