import {
  SmartThingsClient,
  BearerTokenAuthenticator,
  InstalledAppStatus,
} from '@smartthings/core-sdk';
import { environment } from '../config/environment.js';
import { getTokenStorage } from '../storage/token-storage.js';
import { OAuthTokenAuthenticator } from './oauth-authenticator.js';
import { SmartThingsOAuthService } from './oauth-service.js';
import logger from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';
import type {
  DeviceId,
  DeviceInfo,
  DeviceStatus,
  RoomInfo,
  RoomId,
  LocationInfo,
  LocationId,
  SceneInfo,
  SceneId,
  CapabilityName,
} from '../types/smartthings.js';
import type { ISmartThingsService } from '../services/interfaces.js';
import type { DeviceEventOptions, DeviceEventResult, DeviceEvent } from '../types/device-events.js';
import {
  parseTimeRange,
  validateRetentionLimit,
  detectEventGaps,
  createDeviceEvent,
  formatDuration,
} from '../types/device-events.js';
import { parseUniversalDeviceId, isUniversalDeviceId } from '../types/unified-device.js';
import type { DeviceState } from '../types/smartthings.js';

/**
 * SmartThings API client wrapper with retry logic and error handling.
 *
 * Design Decision: Wrapper pattern for API client
 * Rationale: Provides centralized error handling, retry logic, and logging
 * for all SmartThings API interactions. Simplifies testing via dependency injection.
 *
 * Performance: Retry logic adds latency only on failures (exponential backoff)
 *
 * Error Handling:
 * - Network errors: Automatic retry with exponential backoff
 * - Authentication errors: Immediate failure (no retry)
 * - API errors: Logged and propagated with context
 *
 * Architecture: Implements ISmartThingsService interface
 * Current: Single class implements all service interfaces (IDeviceService, ILocationService, ISceneService)
 * Future: Split into separate DeviceService, LocationService, SceneService classes
 *
 * TODO Migration Path:
 * 1. ✅ Define service interfaces (interfaces.ts)
 * 2. ✅ Implement interfaces in SmartThingsService (current step)
 * 3. TODO: Extract DeviceService from SmartThingsService
 * 4. TODO: Extract LocationService from SmartThingsService
 * 5. TODO: Extract SceneService from SmartThingsService
 * 6. TODO: Create ServiceFactory/Container for DI
 */
/**
 * Extract device state from DeviceStatus.
 *
 * Ticket 1M-604: State Enrichment Helper
 * - Extracts state values from SmartThings API status response
 * - Returns DeviceState interface for platformSpecific.state
 * - Graceful degradation: Returns undefined if no usable state
 *
 * @param status SmartThings DeviceStatus object
 * @returns DeviceState with extracted values, or undefined
 */
function extractDeviceState(status?: DeviceStatus): DeviceState | undefined {
  if (!status?.components?.['main']) {
    return undefined;
  }

  const main = status.components['main'];
  const state: DeviceState = {
    timestamp: new Date().toISOString(),
  };

  // Extract all state values
  if (main['switch']?.['switch']?.value !== undefined) {
    state.switch = main['switch']['switch'].value as 'on' | 'off';
  }
  if (main['switchLevel']?.['level']?.value !== undefined) {
    state.level = Number(main['switchLevel']['level'].value);
  }
  if (main['temperatureMeasurement']?.['temperature']?.value !== undefined) {
    state.temperature = Number(main['temperatureMeasurement']['temperature'].value);
  }
  if (main['relativeHumidityMeasurement']?.['humidity']?.value !== undefined) {
    state.humidity = Number(main['relativeHumidityMeasurement']['humidity'].value);
  }
  if (main['motionSensor']?.['motion']?.value !== undefined) {
    state.motion = main['motionSensor']['motion'].value as 'active' | 'inactive';
  }
  if (main['illuminanceMeasurement']?.['illuminance']?.value !== undefined) {
    state.illuminance = Number(main['illuminanceMeasurement']['illuminance'].value);
  }
  if (main['battery']?.['battery']?.value !== undefined) {
    state.battery = Number(main['battery']['battery'].value);
  }
  if (main['contactSensor']?.['contact']?.value !== undefined) {
    state.contact = main['contactSensor']['contact'].value as 'open' | 'closed';
  }
  if (main['occupancySensor']?.['occupancy']?.value !== undefined) {
    state.occupancy = main['occupancySensor']['occupancy'].value as 'occupied' | 'unoccupied';
  }
  if (main['waterSensor']?.['water']?.value !== undefined) {
    state.water = main['waterSensor']['water'].value as 'dry' | 'wet';
  }
  if (main['smokeDetector']?.['smoke']?.value !== undefined) {
    state.smoke = main['smokeDetector']['smoke'].value as 'clear' | 'detected';
  }
  if (main['carbonMonoxideDetector']?.['carbonMonoxide']?.value !== undefined) {
    state.carbonMonoxide = main['carbonMonoxideDetector']['carbonMonoxide'].value as
      | 'clear'
      | 'detected';
  }
  if (main['airQualitySensor']?.['airQuality']?.value !== undefined) {
    state.airQuality = Number(main['airQualitySensor']['airQuality'].value);
  }
  if (main['pressureMeasurement']?.['pressure']?.value !== undefined) {
    state.pressure = Number(main['pressureMeasurement']['pressure'].value);
  }
  if (main['soundSensor']?.['soundPressureLevel']?.value !== undefined) {
    state.soundPressureLevel = Number(main['soundSensor']['soundPressureLevel'].value);
  }

  // Return state only if we extracted at least one value (besides timestamp)
  const hasStateData = Object.keys(state).length > 1;
  return hasStateData ? state : undefined;
}

export class SmartThingsService implements ISmartThingsService {
  private client: SmartThingsClient;

  /**
   * Initialize SmartThings client with OAuth or PAT authentication.
   *
   * Design Decision: OAuth-first with PAT fallback
   * Rationale: OAuth tokens auto-refresh (24h expiry), PAT requires daily manual updates.
   * Checks OAuth token storage first, falls back to PAT if unavailable.
   *
   * Authentication Priority:
   * 1. OAuth token (if available in token storage)
   * 2. Personal Access Token (from environment variable)
   *
   * Error Handling:
   * - OAuth token unavailable + no PAT: Clear error message
   * - OAuth token expired: Automatic refresh before API calls
   * - PAT invalid: Runtime error on first API call
   *
   * @throws Error if neither OAuth token nor PAT is available
   */
  constructor() {
    logger.info('Initializing SmartThings client');

    // Try OAuth token first
    const tokenStorage = getTokenStorage();
    const hasOAuthToken = tokenStorage.hasTokens('default');

    if (hasOAuthToken) {
      try {
        // Create OAuth service for token refresh
        if (!environment.SMARTTHINGS_CLIENT_ID || !environment.SMARTTHINGS_CLIENT_SECRET) {
          throw new Error('OAuth credentials not configured');
        }

        const oauthService = new SmartThingsOAuthService({
          clientId: environment.SMARTTHINGS_CLIENT_ID,
          clientSecret: environment.SMARTTHINGS_CLIENT_SECRET,
          redirectUri: environment.OAUTH_REDIRECT_URI || '',
          stateSecret: environment.OAUTH_STATE_SECRET || '',
        });

        // Use OAuth authenticator with automatic refresh
        const oauthAuth = new OAuthTokenAuthenticator(tokenStorage, oauthService, 'default');
        this.client = new SmartThingsClient(oauthAuth);

        logger.info('SmartThings client initialized with OAuth token', {
          authMethod: 'oauth',
        });
        return;
      } catch (error) {
        logger.warn('OAuth token initialization failed, falling back to PAT', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback to PAT
    if (environment.SMARTTHINGS_PAT) {
      this.client = new SmartThingsClient(
        new BearerTokenAuthenticator(environment.SMARTTHINGS_PAT)
      );
      logger.info('SmartThings client initialized with Personal Access Token', {
        authMethod: 'pat',
      });
    } else {
      throw new Error(
        'SmartThings authentication required: Either configure OAuth ' +
          '(visit /auth/smartthings) or set SMARTTHINGS_PAT environment variable'
      );
    }
  }

  /**
   * List all devices accessible with the current token.
   *
   * Ticket 1M-604: State Enrichment
   * - Fetches device status for all devices in parallel
   * - Enriches DeviceInfo with state data for UI display
   * - Graceful degradation: Individual status failures don't break list
   *
   * @param roomId Optional room ID to filter devices by room
   * @returns Array of device information enriched with status
   * @throws Error if API request fails after retries
   */
  async listDevices(roomId?: RoomId): Promise<DeviceInfo[]> {
    logger.debug('Fetching device list', { roomId });

    const devices = await retryWithBackoff(async () => {
      return await this.client.devices.list();
    });

    // Filter by room if specified
    const filteredDevices = roomId ? devices.filter((device) => device.roomId === roomId) : devices;

    // Fetch room names for all devices with roomId
    // Use rooms.list(locationId) instead of rooms.get(roomId) since the SmartThings API
    // requires location context for room operations
    const roomMap = new Map<string, string>();
    const locationIds = [...new Set(filteredDevices.map((d) => d.locationId).filter(Boolean))];

    for (const locationId of locationIds) {
      try {
        const rooms = await retryWithBackoff(async () => {
          return await this.client.rooms.list(locationId as string);
        });

        // Build room map from all rooms in this location
        for (const room of rooms) {
          if (room.roomId) {
            roomMap.set(room.roomId, room.name ?? 'Unknown Room');
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch rooms for location', { locationId, error });
      }
    }

    // Ticket 1M-604: Fetch status for all devices in parallel and extract state
    const statusStartTime = Date.now();
    const deviceInfosWithState = await Promise.all(
      filteredDevices.map(async (device) => {
        try {
          // Fetch status for this device
          const status = await this.getDeviceStatus(device.deviceId as DeviceId);

          // Extract state from status
          const state = extractDeviceState(status);

          return {
            deviceId: device.deviceId as DeviceId,
            name: device.name ?? 'Unknown Device',
            label: device.label,
            type: device.type,
            capabilities: (device.components?.[0]?.capabilities?.map((cap) => cap.id) ??
              []) as unknown as string[],
            components: device.components?.map((comp) => comp.id),
            locationId: device.locationId,
            roomId: device.roomId,
            roomName: device.roomId ? roomMap.get(device.roomId) : undefined,
            online: true,
            platformSpecific: {
              type: device.type,
              components: device.components?.map((c) => c.id),
              roomId: device.roomId,
              ...(state && { state }), // Add extracted state if available
            },
          };
        } catch (error) {
          // Graceful degradation: Log warning but return device without status
          logger.warn(`Failed to fetch status for device ${device.deviceId}`, {
            deviceName: device.name,
            error: error instanceof Error ? error.message : String(error),
          });

          // Return device without status/state
          return {
            deviceId: device.deviceId as DeviceId,
            name: device.name ?? 'Unknown Device',
            label: device.label,
            type: device.type,
            capabilities: (device.components?.[0]?.capabilities?.map((cap) => cap.id) ??
              []) as unknown as string[],
            components: device.components?.map((comp) => comp.id),
            locationId: device.locationId,
            roomId: device.roomId,
            roomName: device.roomId ? roomMap.get(device.roomId) : undefined,
            online: true,
            platformSpecific: {
              type: device.type,
              components: device.components?.map((c) => c.id),
              roomId: device.roomId,
            },
          };
        }
      })
    );

    const statusDuration = Date.now() - statusStartTime;
    logger.info('Devices retrieved with state enrichment', {
      count: deviceInfosWithState.length,
      roomFilter: !!roomId,
      statusFetchDuration: `${statusDuration}ms`,
    });

    return deviceInfosWithState;
  }

  /**
   * Get detailed status of a specific device.
   *
   * @param deviceId Device UUID or universal device ID
   * @returns Device status with capability states
   * @throws Error if device not found or API request fails
   */
  async getDeviceStatus(deviceId: DeviceId): Promise<DeviceStatus> {
    logger.debug('Fetching device status', { deviceId });

    // Extract platform-specific ID if universal ID provided
    const platformDeviceId = isUniversalDeviceId(deviceId)
      ? parseUniversalDeviceId(deviceId).platformDeviceId
      : deviceId;

    const status = await retryWithBackoff(async () => {
      return await this.client.devices.getStatus(platformDeviceId);
    });

    logger.info('Device status retrieved', { deviceId });
    return status as DeviceStatus;
  }

  /**
   * Execute a command on a device.
   *
   * @param deviceId Device UUID or universal device ID
   * @param capability Capability name (e.g., "switch")
   * @param command Command name (e.g., "on", "off")
   * @param args Optional command arguments
   * @throws Error if command execution fails
   */
  async executeCommand(
    deviceId: DeviceId,
    capability: string,
    command: string,
    args?: unknown[]
  ): Promise<void> {
    logger.debug('Executing device command', { deviceId, capability, command, args });

    // Extract platform-specific ID if universal ID provided
    const platformDeviceId = isUniversalDeviceId(deviceId)
      ? parseUniversalDeviceId(deviceId).platformDeviceId
      : deviceId;

    const startTime = Date.now();
    let deviceName: string | undefined;

    try {
      // Get device name for better diagnostic tracking (non-blocking)
      try {
        const device = await this.getDevice(deviceId);
        deviceName = device.name;
      } catch {
        // Ignore errors getting device name - don't fail command execution
        deviceName = undefined;
      }

      // Execute command with retry logic
      await retryWithBackoff(async () => {
        await this.client.devices.executeCommand(platformDeviceId, {
          component: 'main',
          capability,
          command,
          arguments: args as (string | number | object)[] | undefined,
        });
      });

      const duration = Date.now() - startTime;

      // Track successful command execution
      const { diagnosticTracker } = await import('../utils/diagnostic-tracker.js');
      diagnosticTracker.recordCommand({
        timestamp: new Date(),
        deviceId,
        deviceName,
        capability,
        command,
        success: true,
        duration,
      });

      logger.info('Device command executed successfully', {
        deviceId,
        capability,
        command,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track failed command execution
      const { diagnosticTracker } = await import('../utils/diagnostic-tracker.js');
      diagnosticTracker.recordCommand({
        timestamp: new Date(),
        deviceId,
        deviceName,
        capability,
        command,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      logger.error('Device command failed', { deviceId, capability, command, error });
      throw error;
    }
  }

  /**
   * Get detailed information about a specific device.
   *
   * @param deviceId Device UUID or universal device ID
   * @returns Device information
   * @throws Error if device not found
   */
  async getDevice(deviceId: DeviceId): Promise<DeviceInfo> {
    logger.debug('Fetching device details', { deviceId });

    // Extract platform-specific ID if universal ID provided
    const platformDeviceId = isUniversalDeviceId(deviceId)
      ? parseUniversalDeviceId(deviceId).platformDeviceId
      : deviceId;

    const device = await retryWithBackoff(async () => {
      return await this.client.devices.get(platformDeviceId);
    });

    const deviceInfo: DeviceInfo = {
      deviceId: device.deviceId as DeviceId,
      name: device.name ?? 'Unknown Device',
      label: device.label,
      type: device.type,
      capabilities: (device.components?.[0]?.capabilities?.map((cap) => cap.id) ??
        []) as unknown as string[],
      components: device.components?.map((comp) => comp.id),
      locationId: device.locationId,
    };

    logger.info('Device details retrieved', { deviceId });
    return deviceInfo;
  }

  /**
   * Get capabilities of a specific device.
   *
   * @param deviceId Device UUID or universal device ID
   * @returns Array of capability names
   * @throws Error if device not found
   */
  async getDeviceCapabilities(deviceId: DeviceId): Promise<string[]> {
    logger.debug('Fetching device capabilities', { deviceId });

    // Note: getDevice already handles universal ID extraction
    const device = await this.getDevice(deviceId);
    const capabilities = device.capabilities ?? [];

    logger.info('Device capabilities retrieved', { deviceId, count: capabilities.length });
    return capabilities;
  }

  /**
   * List all locations accessible with the current token.
   *
   * @returns Array of location information
   * @throws Error if API request fails after retries
   */
  async listLocations(): Promise<LocationInfo[]> {
    logger.debug('Fetching location list');

    const locations = await retryWithBackoff(async () => {
      return await this.client.locations.list();
    });

    const locationInfos: LocationInfo[] = locations.map((location) => ({
      locationId: location.locationId as LocationId,
      name: location.name,
    }));

    logger.info('Locations retrieved', { count: locationInfos.length });
    return locationInfos;
  }

  /**
   * List all rooms in a location or all accessible rooms.
   *
   * @param locationId Optional location ID to filter rooms
   * @returns Array of room information with device counts
   * @throws Error if API request fails after retries
   */
  async listRooms(locationId?: LocationId): Promise<RoomInfo[]> {
    logger.debug('Fetching room list', { locationId });

    let rooms: Array<{ roomId?: string; name?: string; locationId?: string }> = [];

    if (locationId) {
      // Fetch rooms for specific location
      rooms = await retryWithBackoff(async () => {
        return await this.client.rooms.list(locationId);
      });
    } else {
      // Fetch all locations and their rooms
      const locations = await this.listLocations();
      for (const location of locations) {
        const locationRooms = await retryWithBackoff(async () => {
          return await this.client.rooms.list(location.locationId);
        });
        rooms.push(...locationRooms);
      }
    }

    // Get device counts for each room
    const devices = await this.listDevices();
    const deviceCountByRoom = new Map<string, number>();

    for (const device of devices) {
      if (device.roomId) {
        deviceCountByRoom.set(device.roomId, (deviceCountByRoom.get(device.roomId) ?? 0) + 1);
      }
    }

    const roomInfos: RoomInfo[] = rooms
      .filter((room) => room.roomId && room.name && room.locationId)
      .map((room) => ({
        roomId: room.roomId as RoomId,
        name: room.name as string,
        locationId: room.locationId as LocationId,
        deviceCount: deviceCountByRoom.get(room.roomId as string) ?? 0,
      }));

    logger.info('Rooms retrieved', { count: roomInfos.length, locationFilter: !!locationId });
    return roomInfos;
  }

  /**
   * Find a room by name (case-insensitive partial match).
   *
   * @param roomName Room name to search for
   * @returns Room information if found
   * @throws Error if room not found or multiple matches
   */
  async findRoomByName(roomName: string): Promise<RoomInfo> {
    logger.debug('Finding room by name', { roomName });

    const rooms = await this.listRooms();
    const normalizedSearch = roomName.toLowerCase().trim();

    // Try exact match first
    const exactMatch = rooms.find((room) => room.name.toLowerCase() === normalizedSearch);
    if (exactMatch) {
      logger.info('Room found (exact match)', { roomId: exactMatch.roomId, roomName });
      return exactMatch;
    }

    // Try partial match
    const partialMatches = rooms.filter((room) =>
      room.name.toLowerCase().includes(normalizedSearch)
    );

    if (partialMatches.length === 0) {
      throw new Error(`Room not found: "${roomName}"`);
    }

    if (partialMatches.length === 1) {
      const match = partialMatches[0]!; // Safe: length check ensures element exists
      logger.info('Room found (partial match)', {
        roomId: match.roomId,
        roomName,
        actualName: match.name,
      });
      return match;
    }

    // Multiple matches
    const matchNames = partialMatches.map((r) => r.name).join(', ');
    throw new Error(`Multiple rooms match "${roomName}": ${matchNames}. Please be more specific.`);
  }

  /**
   * List all scenes accessible with the current token.
   *
   * @param locationId Optional location ID to filter scenes
   * @returns Array of scene information
   * @throws Error if API request fails after retries
   */
  async listScenes(locationId?: LocationId): Promise<SceneInfo[]> {
    logger.debug('Fetching scene list', { locationId });

    const options = locationId ? { locationId: [locationId] } : undefined;

    const scenes = await retryWithBackoff(async () => {
      return await this.client.scenes.list(options);
    });

    const sceneInfos: SceneInfo[] = scenes.map((scene) => ({
      sceneId: scene.sceneId as SceneId,
      sceneName: scene.sceneName ?? 'Unnamed Scene',
      sceneIcon: scene.sceneIcon,
      sceneColor: scene.sceneColor,
      locationId: scene.locationId as LocationId | undefined,
      createdBy: scene.createdBy,
      createdDate: scene.createdDate,
      lastUpdatedDate: scene.lastUpdatedDate,
      lastExecutedDate: scene.lastExecutedDate,
      editable: scene.editable,
    }));

    logger.info('Scenes retrieved', { count: sceneInfos.length, locationFilter: !!locationId });
    return sceneInfos;
  }

  /**
   * Execute a scene by ID.
   *
   * @param sceneId Scene UUID
   * @throws Error if scene not found or execution fails
   */
  async executeScene(sceneId: SceneId): Promise<void> {
    logger.debug('Executing scene', { sceneId });

    await retryWithBackoff(async () => {
      await this.client.scenes.execute(sceneId);
    });

    logger.info('Scene executed successfully', { sceneId });
  }

  /**
   * Find a scene by name (case-insensitive partial match).
   *
   * @param sceneName Scene name to search for
   * @returns Scene information if found
   * @throws Error if scene not found or multiple matches
   */
  async findSceneByName(sceneName: string): Promise<SceneInfo> {
    logger.debug('Finding scene by name', { sceneName });

    const scenes = await this.listScenes();
    const normalizedSearch = sceneName.toLowerCase().trim();

    // Try exact match first
    const exactMatch = scenes.find((scene) => scene.sceneName.toLowerCase() === normalizedSearch);
    if (exactMatch) {
      logger.info('Scene found (exact match)', { sceneId: exactMatch.sceneId, sceneName });
      return exactMatch;
    }

    // Try partial match
    const partialMatches = scenes.filter((scene) =>
      scene.sceneName.toLowerCase().includes(normalizedSearch)
    );

    if (partialMatches.length === 0) {
      throw new Error(`Scene not found: "${sceneName}"`);
    }

    if (partialMatches.length === 1) {
      const match = partialMatches[0]!; // Safe: length check ensures element exists
      logger.info('Scene found (partial match)', {
        sceneId: match.sceneId,
        sceneName,
        actualName: match.sceneName,
      });
      return match;
    }

    // Multiple matches
    const matchNames = partialMatches.map((s) => s.sceneName).join(', ');
    throw new Error(
      `Multiple scenes match "${sceneName}": ${matchNames}. Please be more specific.`
    );
  }

  /**
   * Get device event history with filtering and metadata.
   *
   * Design Decision: Client-side filtering for capabilities and attributes
   * Rationale: SmartThings API doesn't support capability/attribute filtering.
   * Client-side filtering provides flexibility while maintaining API compatibility.
   *
   * Performance Considerations:
   * - AsyncIterable processing: Efficient streaming of events
   * - Early limit application: Stop processing after limit reached
   * - Gap detection: Only performed if includeMetadata=true
   * - Location caching: Device lookup cached within request scope
   *
   * Error Handling:
   * - Device not found: Clear error message with deviceId
   * - Invalid time range: Validation error with expected format
   * - API errors: Handled by retryWithBackoff wrapper
   * - Empty results: Valid result with empty events array
   *
   * Trade-offs:
   * - Flexibility: Client-side filtering more flexible than API filters
   * - Network: May fetch more events than needed (then filter)
   * - Accuracy: SDK handles pagination and rate limiting
   *
   * @param deviceId Device to query events for
   * @param options Query options (time range, filters, limits)
   * @returns Event result with events, metadata, and summary
   * @throws Error if device not found or time range invalid
   *
   * @example
   * ```typescript
   * // Get last 24 hours of switch events
   * const result = await smartThingsService.getDeviceEvents(
   *   deviceId,
   *   {
   *     startTime: '24h',
   *     capabilities: ['switch' as CapabilityName],
   *     includeMetadata: true
   *   }
   * );
   *
   * console.log(result.summary); // "Found 15 switch events in last 24 hours"
   * console.log(result.metadata.gaps); // [{ start, end, duration }]
   * ```
   */
  async getDeviceEvents(
    deviceId: DeviceId,
    options: DeviceEventOptions
  ): Promise<DeviceEventResult> {
    logger.debug('Fetching device events', { deviceId, options });

    // Extract platform-specific ID if universal ID provided
    const platformDeviceId = isUniversalDeviceId(deviceId)
      ? parseUniversalDeviceId(deviceId).platformDeviceId
      : deviceId;

    // Step 1: Validate and prepare options
    const startTime = options.startTime ? parseTimeRange(options.startTime) : undefined;
    const endTime = options.endTime ? parseTimeRange(options.endTime) : new Date();
    const limit = Math.min(options.limit ?? 100, 500); // Cap at 500 for safety
    const includeMetadata = options.includeMetadata ?? true;

    // Validate retention limit if startTime provided
    let retentionWarning: string | undefined;
    let adjustedStart = startTime;

    if (startTime) {
      const validation = validateRetentionLimit(startTime);
      if (!validation.valid && validation.adjustedStart) {
        adjustedStart = validation.adjustedStart;
        retentionWarning = validation.message;
        logger.warn('Time range exceeds retention limit', {
          original: startTime.toISOString(),
          adjusted: adjustedStart.toISOString(),
        });
      }
    }

    // Get device info for locationId if not provided
    let locationId: LocationId | undefined = options.locationId;
    let deviceName: string | undefined;

    if (!locationId) {
      try {
        const device = await this.getDevice(deviceId);
        locationId = device.locationId ? (device.locationId as LocationId) : undefined;
        deviceName = device.name;
        logger.debug('Retrieved locationId from device', { deviceId, locationId });
      } catch (error) {
        throw new Error(`Failed to get device information for ${deviceId}. Device may not exist.`);
      }
    }

    if (!locationId) {
      throw new Error(
        `Unable to determine locationId for device ${deviceId}. Please provide locationId in options.`
      );
    }

    // Step 2: Call SmartThings SDK with retry logic
    const rawEvents: DeviceEvent[] = [];
    let hasMore = false;

    try {
      const result = await retryWithBackoff(async () => {
        const historyOptions = {
          deviceId: platformDeviceId, // Use extracted platform-specific ID
          locationId,
          startTime: adjustedStart,
          endTime: endTime,
          oldestFirst: options.oldestFirst ?? false,
        };

        logger.debug('Calling SmartThings history API', historyOptions);

        // Call SDK history API (returns PaginatedList)
        return await this.client.history.devices(historyOptions);
      });

      // Process the items from the paginated result
      const activities = result.items ?? [];

      for (const activity of activities) {
        // Early exit if limit reached
        if (rawEvents.length >= limit) {
          hasMore = true;
          break;
        }

        // Convert to DeviceEvent
        const event = createDeviceEvent({
          deviceId: activity.deviceId ?? deviceId,
          deviceName: activity.deviceName ?? deviceName,
          locationId: activity.locationId ?? locationId,
          locationName: activity.locationName,
          time: activity.time ?? new Date().toISOString(),
          epoch: activity.epoch ?? Date.now(),
          component: activity.component ?? 'main',
          componentLabel: activity.componentLabel,
          capability: (activity.capability ?? 'unknown') as CapabilityName,
          attribute: activity.attribute ?? 'unknown',
          value: activity.value,
          unit: activity.unit,
          text: activity.text,
          hash: activity.hash ? String(activity.hash) : undefined,
          translatedAttributeName: activity.translatedAttributeName,
          translatedAttributeValue: activity.translatedAttributeValue,
        });

        rawEvents.push(event);
      }

      // Check if we hit the limit (indicates more events available)
      if (activities.length > 0 && rawEvents.length >= limit) {
        hasMore = true;
      }
    } catch (error) {
      logger.error('Failed to fetch device events', { deviceId, error });
      throw new Error(`Failed to fetch events for device ${deviceId}: ${error}`);
    }

    logger.info('Raw events retrieved', {
      deviceId,
      count: rawEvents.length,
      hasMore,
    });

    // Step 3: Apply client-side filters
    let filteredEvents = rawEvents;

    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      const capabilitySet = new Set(options.capabilities);
      filteredEvents = filteredEvents.filter((event) => capabilitySet.has(event.capability));
      logger.debug('Applied capability filter', {
        before: rawEvents.length,
        after: filteredEvents.length,
        capabilities: options.capabilities,
      });
    }

    // Filter by attributes
    if (options.attributes && options.attributes.length > 0) {
      const attributeSet = new Set(options.attributes);
      filteredEvents = filteredEvents.filter((event) => attributeSet.has(event.attribute));
      logger.debug('Applied attribute filter', {
        before: rawEvents.length,
        after: filteredEvents.length,
        attributes: options.attributes,
      });
    }

    // Step 4: Detect gaps if metadata requested
    let gaps: ReturnType<typeof detectEventGaps> | undefined;
    let gapDetected = false;
    let largestGapMs: number | undefined;

    if (includeMetadata && filteredEvents.length > 1) {
      gaps = detectEventGaps(filteredEvents);
      gapDetected = gaps.length > 0;
      if (gapDetected) {
        largestGapMs = Math.max(...gaps.map((g) => g.durationMs));
        logger.info('Event gaps detected', {
          gapCount: gaps.length,
          largestGapMs,
          gaps: gaps.map((g) => ({
            start: g.gapStart,
            end: g.gapEnd,
            duration: g.durationText,
          })),
        });
      }
    }

    // Step 5: Build metadata
    const metadata: DeviceEventResult['metadata'] = {
      totalCount: filteredEvents.length,
      hasMore,
      dateRange: {
        earliest:
          filteredEvents.length > 0
            ? filteredEvents[filteredEvents.length - 1]!.time
            : new Date().toISOString(),
        latest: filteredEvents.length > 0 ? filteredEvents[0]!.time : new Date().toISOString(),
        durationMs:
          filteredEvents.length > 0
            ? filteredEvents[0]!.epoch - filteredEvents[filteredEvents.length - 1]!.epoch
            : 0,
      },
      appliedFilters: {
        capabilities: options.capabilities,
        attributes: options.attributes,
        timeRange: adjustedStart
          ? {
              start: adjustedStart.toISOString(),
              end: endTime.toISOString(),
            }
          : undefined,
      },
      reachedRetentionLimit: !!retentionWarning,
      gapDetected,
      largestGapMs,
      gaps: gaps
        ? gaps.map((gap) => ({
            gapStart: new Date(gap.gapStart).getTime(),
            gapEnd: new Date(gap.gapEnd).getTime(),
            durationMs: gap.durationMs,
            durationText: gap.durationText,
            likelyConnectivityIssue: gap.likelyConnectivityIssue,
          }))
        : [],
    };

    // Step 6: Generate summary for LLM
    let summary = `Found ${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`;

    if (options.capabilities && options.capabilities.length > 0) {
      summary += ` for ${options.capabilities.join(', ')}`;
    }

    if (adjustedStart) {
      const durationText = formatDuration(Date.now() - adjustedStart.getTime());
      summary += ` in last ${durationText}`;
    }

    if (hasMore) {
      summary += ` (limit reached, more events available)`;
    }

    if (retentionWarning) {
      summary += `. Warning: ${retentionWarning}`;
    }

    if (gapDetected && gaps && gaps.length > 0) {
      summary += `. Detected ${gaps.length} gap${gaps.length !== 1 ? 's' : ''} in event history`;
      const connectivityIssues = gaps.filter((g) => g.likelyConnectivityIssue);
      if (connectivityIssues.length > 0) {
        summary += ` (${connectivityIssues.length} suggest connectivity issues)`;
      }
    }

    logger.info('Device events retrieved successfully', {
      deviceId,
      totalEvents: filteredEvents.length,
      hasMore,
      gapDetected,
      retentionLimitReached: metadata.reachedRetentionLimit,
    });

    return {
      events: filteredEvents,
      metadata,
      summary,
    };
  }

  /**
   * List all installed SmartApps (legacy apps installed in the user's account).
   *
   * @param locationId Optional location ID to filter installed apps
   * @returns Array of installed app information
   * @throws Error if API request fails after retries
   */
  async listInstalledApps(locationId?: LocationId): Promise<any[]> {
    logger.debug('Fetching installed apps list', { locationId });

    const installedApps = await retryWithBackoff(async () => {
      return await this.client.installedApps.list({
        locationId: locationId as string | undefined,
        installedAppStatus: InstalledAppStatus.AUTHORIZED,
      });
    });

    logger.info('Installed apps retrieved', { count: installedApps.length });

    return installedApps.map((app) => ({
      id: app.installedAppId,
      name: app.displayName ?? 'Unnamed App',
      type: app.installedAppType,
      status: app.installedAppStatus,
      classification: app.classifications?.[0] ?? 'AUTOMATION',
      locationId: app.locationId,
      createdDate: app.createdDate,
      lastUpdatedDate: app.lastUpdatedDate,
    }));
  }
}

/**
 * Singleton instance of SmartThings service.
 * Initialized once per application lifecycle.
 */
export const smartThingsService = new SmartThingsService();
