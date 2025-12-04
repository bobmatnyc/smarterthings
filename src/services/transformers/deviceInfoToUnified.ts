/**
 * Device transformation from SmartThings DeviceInfo to UnifiedDevice.
 *
 * This module bridges the gap between SmartThings-specific DeviceInfo format
 * and the platform-agnostic UnifiedDevice model used by DeviceRegistry and SemanticIndex.
 *
 * Design Decisions:
 * - Capability Mapping: SmartThings capability strings → DeviceCapability enum
 * - Graceful Degradation: Unknown capabilities are skipped without errors
 * - Online Status: Default to true if no status provided (optimistic approach)
 * - Platform-Specific Preservation: Original metadata stored in platformSpecific field
 * - State Enrichment (Ticket 1M-604): Extract device state from DeviceStatus
 *
 * Trade-offs:
 * - Optimistic Online Status: Assumes devices are online by default
 *   - Pro: Better UX for devices that don't report status frequently
 *   - Con: May show offline devices as online briefly
 *   - Mitigation: Status polling should update this quickly
 *
 * Performance:
 * - Time Complexity: O(n) where n = number of capabilities
 * - Space Complexity: O(n) for capability array transformation
 * - Expected: <1ms for typical devices (10-20 capabilities)
 *
 * State Enrichment (Ticket 1M-604):
 * - Extracts current device state (on/off, level, sensor readings)
 * - Enables switch controls to display correct state
 * - Enables sensor display components to show readings
 * - Performance: O(m) where m = number of component capabilities (~constant)
 *
 * @module services/transformers/deviceInfoToUnified
 */

import type { DeviceInfo, DeviceStatus, DeviceState } from '../../types/smartthings.js';
import {
  Platform,
  DeviceCapability,
  createUniversalDeviceId,
  type UnifiedDevice,
} from '../../types/unified-device.js';

/**
 * Capability mapping from SmartThings capability strings to DeviceCapability enum.
 *
 * Design Rationale:
 * - Comprehensive Coverage: Maps 25+ common SmartThings capabilities
 * - Semantic Mapping: Names preserved where possible (switch→SWITCH)
 * - Multi-Source Handling: Some capabilities map from multiple ST sources
 *   (energyMeter OR powerMeter → ENERGY_METER)
 *
 * Maintenance Notes:
 * - Add new mappings when supporting new device types
 * - Keep in sync with DeviceCapability enum additions
 * - Document any non-obvious mappings
 */
const CAPABILITY_MAP: Record<string, DeviceCapability> = {
  // Control Capabilities
  switch: DeviceCapability.SWITCH,
  switchLevel: DeviceCapability.DIMMER,
  colorControl: DeviceCapability.COLOR,
  colorTemperature: DeviceCapability.COLOR_TEMPERATURE,
  thermostat: DeviceCapability.THERMOSTAT,
  lock: DeviceCapability.LOCK,
  windowShade: DeviceCapability.SHADE,
  fanSpeed: DeviceCapability.FAN,
  valve: DeviceCapability.VALVE,
  alarm: DeviceCapability.ALARM,
  doorControl: DeviceCapability.DOOR_CONTROL,
  garageDoorControl: DeviceCapability.DOOR_CONTROL, // Alias for garage doors

  // Sensor Capabilities
  temperatureMeasurement: DeviceCapability.TEMPERATURE_SENSOR,
  relativeHumidityMeasurement: DeviceCapability.HUMIDITY_SENSOR,
  motionSensor: DeviceCapability.MOTION_SENSOR,
  contactSensor: DeviceCapability.CONTACT_SENSOR,
  occupancySensor: DeviceCapability.OCCUPANCY_SENSOR,
  illuminanceMeasurement: DeviceCapability.ILLUMINANCE_SENSOR,
  battery: DeviceCapability.BATTERY,
  airQualitySensor: DeviceCapability.AIR_QUALITY_SENSOR,
  waterSensor: DeviceCapability.WATER_LEAK_SENSOR,
  smokeDetector: DeviceCapability.SMOKE_DETECTOR,
  button: DeviceCapability.BUTTON,
  pressureMeasurement: DeviceCapability.PRESSURE_SENSOR,
  carbonMonoxideDetector: DeviceCapability.CO_DETECTOR,
  soundSensor: DeviceCapability.SOUND_SENSOR,

  // Composite Capabilities
  energyMeter: DeviceCapability.ENERGY_METER,
  powerMeter: DeviceCapability.ENERGY_METER, // Both map to same capability
  audioVolume: DeviceCapability.SPEAKER,
  speaker: DeviceCapability.SPEAKER,
  mediaPlayback: DeviceCapability.MEDIA_PLAYER,
  videoCamera: DeviceCapability.CAMERA,
  robotCleanerCleaningMode: DeviceCapability.ROBOT_VACUUM, // SmartThings robot vacuum
  infraredLevel: DeviceCapability.IR_BLASTER,
};

/**
 * Map SmartThings capability string to unified DeviceCapability enum.
 *
 * @param stCapability SmartThings capability string (e.g., "switch", "switchLevel")
 * @returns DeviceCapability enum value, or undefined if not mapped
 *
 * @example
 * ```typescript
 * mapCapability("switch")          // DeviceCapability.SWITCH
 * mapCapability("switchLevel")     // DeviceCapability.DIMMER
 * mapCapability("unknownCapability") // undefined
 * ```
 */
function mapCapability(stCapability: string): DeviceCapability | undefined {
  return CAPABILITY_MAP[stCapability];
}

/**
 * Capability Inference Rule for handling platform bugs and missing capabilities.
 *
 * Design Rationale:
 * - Enables declarative rules for capability inference
 * - Each rule documents the bug/issue it addresses
 * - Easy to add/remove rules as platform bugs are fixed
 * - Testable in isolation
 *
 * @property match - Predicate function to identify affected devices
 * @property addCapabilities - Capabilities to add if match succeeds
 * @property reason - Documentation explaining why this rule exists
 */
interface CapabilityInferenceRule {
  match: (device: DeviceInfo) => boolean;
  addCapabilities: string[];
  reason: string;
}

/**
 * Capability Inference Rules for SmartThings platform bugs.
 *
 * These rules handle known issues where SmartThings Edge drivers or integrations
 * fail to report device capabilities correctly. Each rule is documented with:
 * - Bug description and affected devices
 * - Inference logic and safety checks
 * - Link to upstream issue (if available)
 *
 * Maintenance Notes:
 * - Rules can be removed when upstream bugs are fixed
 * - Add new rules for newly discovered platform bugs
 * - Keep rules conservative to avoid false positives
 *
 * SmartThings Edge Driver Bug - Lutron Caséta Integration:
 * - Issue: Edge driver only reports "refresh" capability for all Lutron devices
 * - Affected: All Lutron Caséta dimmers and switches via SmartThings integration
 * - Root Cause: Driver initialization bug in SmartThings Edge Lutron driver
 * - Safety: Only applies when ONLY "refresh" capability exists
 * - Expected Fix: SmartThings will fix in future Edge driver update
 * - Upstream: https://github.com/SmartThingsCommunity/SmartThingsEdgeDrivers/issues/...
 */
const CAPABILITY_INFERENCE_RULES: CapabilityInferenceRule[] = [
  {
    // Lutron Caséta Wall Dimmer - Missing switch + switchLevel capabilities
    match: (device: DeviceInfo) => {
      const isLutronDimmer =
        device.name.toLowerCase().includes('lutron') &&
        device.name.toLowerCase().includes('dimmer');
      const hasOnlyRefresh =
        device.capabilities.length === 1 && device.capabilities.includes('refresh');
      return isLutronDimmer && hasOnlyRefresh;
    },
    addCapabilities: ['switch', 'switchLevel'],
    reason: 'Lutron Edge driver bug - Caséta dimmers missing switch/switchLevel capabilities',
  },
  {
    // Lutron Caséta Wall Switch - Missing switch capability
    match: (device: DeviceInfo) => {
      const isLutronSwitch =
        device.name.toLowerCase().includes('lutron') &&
        device.name.toLowerCase().includes('switch');
      const hasOnlyRefresh =
        device.capabilities.length === 1 && device.capabilities.includes('refresh');
      return isLutronSwitch && hasOnlyRefresh;
    },
    addCapabilities: ['switch'],
    reason: 'Lutron Edge driver bug - Caséta switches missing switch capability',
  },
];

/**
 * Infer missing capabilities for devices affected by platform bugs.
 *
 * Design Decision: Rule-Based Inference
 * - Uses declarative rules instead of hardcoded device checks
 * - Each rule documents the bug it addresses
 * - Rules can be easily added/removed as bugs are discovered/fixed
 * - Conservative matching prevents false positives
 *
 * Trade-offs:
 * - Precision vs. Recall: Strict matching (only when hasOnlyRefresh) prevents
 *   adding duplicate capabilities if driver is fixed
 * - Maintenance: Rules need manual removal when upstream bugs are fixed
 * - Safety: All rules check multiple conditions to avoid false matches
 *
 * Error Handling:
 * - Invalid rules: Caught and logged, inference continues
 * - No matches: Original capabilities returned unchanged
 * - Multiple matches: All matching rules applied (capabilities deduplicated)
 *
 * Performance:
 * - Time Complexity: O(r) where r = number of rules (~constant, 2-5 rules expected)
 * - Space Complexity: O(c) where c = number of capabilities added
 * - Expected: <0.1ms per device
 *
 * @param deviceInfo SmartThings device information
 * @returns Enhanced capabilities array with inferred capabilities added
 *
 * @example
 * ```typescript
 * // Lutron dimmer with only "refresh" capability (bug)
 * const device: DeviceInfo = {
 *   name: 'Lutron Caseta Wall Dimmer',
 *   capabilities: ['refresh']
 * };
 *
 * const enhanced = inferMissingCapabilities(device);
 * // ['refresh', 'switch', 'switchLevel']
 * // Logs: "[Capability Inference] Lutron Edge driver bug - added switch, switchLevel to AR Lights"
 * ```
 */
function inferMissingCapabilities(deviceInfo: DeviceInfo): string[] {
  const capabilities = [...deviceInfo.capabilities];
  const addedCapabilities: string[] = [];

  for (const rule of CAPABILITY_INFERENCE_RULES) {
    try {
      if (rule.match(deviceInfo)) {
        // Check which capabilities are actually missing before adding
        const missingCapabilities = rule.addCapabilities.filter(
          (cap) => !capabilities.includes(cap)
        );

        if (missingCapabilities.length > 0) {
          capabilities.push(...missingCapabilities);
          addedCapabilities.push(...missingCapabilities);

          console.debug(
            `[Capability Inference] ${rule.reason} - Added ${missingCapabilities.join(', ')} to "${deviceInfo.label || deviceInfo.name}"`
          );
        }
      }
    } catch (error) {
      // Defensive: Log rule errors but continue processing other rules
      console.error(
        `[Capability Inference] Rule failed for device "${deviceInfo.label || deviceInfo.name}":`,
        error
      );
    }
  }

  return capabilities;
}

/**
 * Extract online status from DeviceStatus.
 *
 * Design Decision: Default to True
 * - SmartThings doesn't always provide explicit online/offline status
 * - Most devices are online when they have recent status updates
 * - False positives (showing offline device as online) are rare and temporary
 * - False negatives (showing online device as offline) would be worse UX
 *
 * Status Extraction Logic:
 * 1. Check for explicit "healthCheck" capability with "online" attribute
 * 2. Check for "DeviceHealth" component (older SmartThings pattern)
 * 3. Default to true if no status provided or no health indicators
 *
 * @param status Optional DeviceStatus from SmartThings API
 * @returns Online status (true if online or unknown)
 */
function extractOnlineStatus(status?: DeviceStatus): boolean {
  if (!status?.components) {
    return true; // Optimistic default
  }

  // Check main component for health status
  const mainComponent = status.components['main'];
  if (mainComponent) {
    // Modern health check capability
    if (mainComponent['healthCheck']?.['healthStatus']?.value === 'offline') {
      return false;
    }

    // Legacy device health
    if (mainComponent['DeviceHealth']?.['DeviceWatch_DeviceStatus']?.value === 'offline') {
      return false;
    }
  }

  // No offline indicators found → assume online
  return true;
}

/**
 * Extract last seen timestamp from DeviceStatus.
 *
 * Looks for most recent timestamp across all component capabilities.
 * Used to determine when device last communicated with platform.
 *
 * @param status Optional DeviceStatus from SmartThings API
 * @returns Most recent timestamp as Date, or undefined if no timestamps
 */
function extractLastSeen(status?: DeviceStatus): Date | undefined {
  if (!status?.components) {
    return undefined;
  }

  let mostRecent: Date | undefined;

  for (const component of Object.values(status.components)) {
    for (const capability of Object.values(component)) {
      for (const attribute of Object.values(capability)) {
        if (attribute.timestamp) {
          const timestamp = new Date(attribute.timestamp);
          if (!mostRecent || timestamp > mostRecent) {
            mostRecent = timestamp;
          }
        }
      }
    }
  }

  return mostRecent;
}

/**
 * Extract device state from DeviceStatus.
 *
 * Ticket 1M-604: State Enrichment
 * - Extracts current device state (on/off, level, sensor readings)
 * - Enables switch controls to display correct state
 * - Enables sensor components to display readings
 * - Graceful degradation: Returns undefined if no status provided
 *
 * State Extraction Logic:
 * - Only extracts from 'main' component (primary device component)
 * - Maps SmartThings attribute values to DeviceState interface
 * - Handles type-safe extraction with unknown value types
 *
 * Error Handling:
 * - Unknown capability attributes: Silently skipped (no errors)
 * - Missing main component: Returns undefined
 * - Invalid attribute values: Skipped (type guards prevent errors)
 *
 * Performance:
 * - Time Complexity: O(1) - Only checks main component attributes
 * - Space Complexity: O(1) - Fixed number of state fields
 * - Expected: <0.5ms per device
 *
 * @param status Optional DeviceStatus from SmartThings API
 * @returns DeviceState with current values, or undefined if no status
 *
 * @example
 * ```typescript
 * const status: DeviceStatus = {
 *   deviceId: 'abc-123',
 *   components: {
 *     main: {
 *       switch: { switch: { value: 'on' } },
 *       switchLevel: { level: { value: 75 } },
 *       temperatureMeasurement: { temperature: { value: 72 } }
 *     }
 *   }
 * };
 *
 * const state = extractDeviceState(status);
 * // { switch: 'on', level: 75, temperature: 72, timestamp: '...' }
 * ```
 */
function extractDeviceState(status?: DeviceStatus): DeviceState | undefined {
  if (!status?.components?.main) {
    return undefined;
  }

  const main = status.components.main;
  const state: DeviceState = {
    timestamp: new Date().toISOString(),
  };

  // Extract switch state
  if (main.switch?.switch?.value !== undefined) {
    state.switch = main.switch.switch.value as 'on' | 'off';
  }

  // Extract dimmer level
  if (main.switchLevel?.level?.value !== undefined) {
    state.level = Number(main.switchLevel.level.value);
  }

  // Extract temperature
  if (main.temperatureMeasurement?.temperature?.value !== undefined) {
    state.temperature = Number(main.temperatureMeasurement.temperature.value);
  }

  // Extract humidity
  if (main.relativeHumidityMeasurement?.humidity?.value !== undefined) {
    state.humidity = Number(main.relativeHumidityMeasurement.humidity.value);
  }

  // Extract motion
  if (main.motionSensor?.motion?.value !== undefined) {
    state.motion = main.motionSensor.motion.value as 'active' | 'inactive';
  }

  // Extract illuminance
  if (main.illuminanceMeasurement?.illuminance?.value !== undefined) {
    state.illuminance = Number(main.illuminanceMeasurement.illuminance.value);
  }

  // Extract battery
  if (main.battery?.battery?.value !== undefined) {
    state.battery = Number(main.battery.battery.value);
  }

  // Extract contact sensor
  if (main.contactSensor?.contact?.value !== undefined) {
    state.contact = main.contactSensor.contact.value as 'open' | 'closed';
  }

  // Extract occupancy
  if (main.occupancySensor?.occupancy?.value !== undefined) {
    state.occupancy = main.occupancySensor.occupancy.value as 'occupied' | 'unoccupied';
  }

  // Extract water sensor
  if (main.waterSensor?.water?.value !== undefined) {
    state.water = main.waterSensor.water.value as 'dry' | 'wet';
  }

  // Extract smoke detector
  if (main.smokeDetector?.smoke?.value !== undefined) {
    state.smoke = main.smokeDetector.smoke.value as 'clear' | 'detected';
  }

  // Extract carbon monoxide detector
  if (main.carbonMonoxideDetector?.carbonMonoxide?.value !== undefined) {
    state.carbonMonoxide = main.carbonMonoxideDetector.carbonMonoxide.value as
      | 'clear'
      | 'detected';
  }

  // Extract air quality
  if (main.airQualitySensor?.airQuality?.value !== undefined) {
    state.airQuality = Number(main.airQualitySensor.airQuality.value);
  }

  // Extract pressure
  if (main.pressureMeasurement?.pressure?.value !== undefined) {
    state.pressure = Number(main.pressureMeasurement.pressure.value);
  }

  // Extract sound pressure level
  if (main.soundSensor?.soundPressureLevel?.value !== undefined) {
    state.soundPressureLevel = Number(main.soundSensor.soundPressureLevel.value);
  }

  // Return state only if we extracted at least one value (besides timestamp)
  const hasStateData = Object.keys(state).length > 1;
  return hasStateData ? state : undefined;
}

/**
 * Transform SmartThings DeviceInfo to UnifiedDevice format.
 *
 * This is the primary transformation function that bridges SmartThings-specific
 * device representation to the platform-agnostic UnifiedDevice model.
 *
 * Transformation Strategy:
 * 1. Identity: Create universal ID with "smartthings:" prefix
 * 2. Capabilities: Map ST capability strings to DeviceCapability enum
 * 3. Status: Extract online/lastSeen from optional DeviceStatus
 * 4. Metadata: Preserve room, location, and ST-specific fields
 *
 * Error Handling:
 * - Unknown capabilities: Silently skipped (no errors thrown)
 * - Missing status: Defaults to online=true, lastSeen=undefined
 * - Missing optional fields: Handled gracefully with undefined
 *
 * Data Consistency:
 * - Universal ID format guaranteed: "smartthings:{deviceId}"
 * - Platform always set to Platform.SMARTTHINGS
 * - Capabilities array never includes undefined values
 *
 * @param deviceInfo SmartThings device information
 * @param status Optional device status for online/lastSeen data
 * @returns UnifiedDevice with normalized platform-agnostic structure
 *
 * @example
 * ```typescript
 * const deviceInfo: DeviceInfo = {
 *   deviceId: 'abc-123' as DeviceId,
 *   name: 'Living Room Light',
 *   label: 'Main Light',
 *   capabilities: ['switch', 'switchLevel', 'colorControl'],
 *   roomName: 'Living Room',
 * };
 *
 * const unified = toUnifiedDevice(deviceInfo);
 * // {
 * //   id: 'smartthings:abc-123',
 * //   platform: Platform.SMARTTHINGS,
 * //   name: 'Living Room Light',
 * //   capabilities: [SWITCH, DIMMER, COLOR],
 * //   online: true,
 * //   ...
 * // }
 * ```
 */
export function toUnifiedDevice(deviceInfo: DeviceInfo, status?: DeviceStatus): UnifiedDevice {
  // Apply capability inference to fix platform bugs (e.g., Lutron Edge driver)
  const enhancedCapabilities = inferMissingCapabilities(deviceInfo);

  // Map capabilities, filtering out unknown ones
  const capabilities: DeviceCapability[] = enhancedCapabilities
    .map(mapCapability)
    .filter((cap): cap is DeviceCapability => cap !== undefined);

  // Extract status information
  const online = extractOnlineStatus(status);
  const lastSeen = extractLastSeen(status);

  // Extract device state (Ticket 1M-604: State Enrichment)
  const state = extractDeviceState(status);

  // Build platform-specific metadata
  const platformSpecific: Record<string, unknown> = {};
  if (deviceInfo.type) platformSpecific['type'] = deviceInfo.type;
  if (deviceInfo.components) platformSpecific['components'] = deviceInfo.components;
  if (deviceInfo.locationId) platformSpecific['locationId'] = deviceInfo.locationId;
  if (deviceInfo.roomId) platformSpecific['roomId'] = deviceInfo.roomId;
  if (state) platformSpecific['state'] = state; // Add state to platformSpecific

  // CRITICAL FIX (Ticket 1M-603): SmartThings API semantics are inverted
  // - SmartThings "name" field = Device type/model (e.g., "Zooz 4-in-1 sensor")
  // - SmartThings "label" field = User-assigned name (e.g., "AR Motion Sensor")
  //
  // For correct UI display, we swap these fields so UnifiedDevice.name contains
  // the user-assigned name (primary display) and UnifiedDevice.label contains
  // the device type (subtitle).
  //
  // Fallback: If no label exists, use device type as name to ensure display.
  return {
    // Identity
    id: createUniversalDeviceId(Platform.SMARTTHINGS, deviceInfo.deviceId),
    platform: Platform.SMARTTHINGS,
    platformDeviceId: deviceInfo.deviceId,

    // Metadata (FIELD INVERSION FIX)
    name: deviceInfo.label || deviceInfo.name, // User-assigned name first, fallback to device type
    label: deviceInfo.name, // Device type stored in label for subtitle display
    manufacturer: undefined, // Not available in DeviceInfo
    model: undefined, // Not available in DeviceInfo
    firmwareVersion: undefined, // Not available in DeviceInfo

    // Organization
    room: deviceInfo.roomName,
    location: undefined, // Location name not available in DeviceInfo

    // Capabilities
    capabilities,

    // State
    online,
    lastSeen,

    // Platform-specific
    platformSpecific: Object.keys(platformSpecific).length > 0 ? platformSpecific : undefined,
  };
}
