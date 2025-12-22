/**
 * Device Polling Service
 *
 * Polls SmartThings devices for state changes and emits events.
 * Used as an alternative to webhook subscriptions when SmartApp is not installed.
 *
 * Design Decision: Polling-based event detection
 * Rationale: Webhook subscriptions require SmartApp installation (user action in mobile app),
 * which creates chicken-and-egg problem. Polling provides immediate event detection without
 * requiring manual SmartApp configuration.
 *
 * Architecture:
 * - Polls devices every N seconds (default: 5s)
 * - Detects state changes by comparing previous vs current state
 * - Emits 'deviceEvent' events for integration with existing event pipeline
 * - Tracks previous state in memory for change detection
 *
 * Performance:
 * - Configurable polling interval (default: 5000ms)
 * - Single API call per poll cycle (fetches all devices at once)
 * - Memory-efficient state tracking (only monitored capabilities)
 * - Overlap prevention (skips poll if previous one still running)
 *
 * Capabilities Monitored (default):
 * - motionSensor (motion: active/inactive)
 * - contactSensor (contact: open/closed)
 * - switch (switch: on/off)
 * - switchLevel (level: 0-100)
 * - lock (lock: locked/unlocked)
 * - temperatureMeasurement (temperature: number)
 *
 * Event Format:
 * ```typescript
 * {
 *   eventType: 'device_event',
 *   deviceId: string,
 *   deviceName: string,
 *   capability: string,
 *   attribute: string,
 *   value: any,
 *   previousValue: any,
 *   timestamp: Date,
 *   source: 'polling'
 * }
 * ```
 */

import { EventEmitter } from 'events';
import type { UnifiedDevice } from '../types/unified-device.js';
import logger from '../utils/logger.js';

/**
 * Device state snapshot for change detection
 */
interface DeviceState {
  deviceId: string;
  deviceName: string;
  capability: string;
  attribute: string;
  value: any;
  timestamp: Date;
}

/**
 * Device event emitted on state change
 */
export interface DeviceEvent {
  eventType: 'device_event';
  deviceId: string;
  deviceName: string;
  capability: string;
  attribute: string;
  value: any;
  previousValue: any;
  timestamp: Date;
  source: 'polling';
}

/**
 * Polling configuration
 */
export interface PollConfig {
  /** Polling interval in milliseconds (default: 5000ms) */
  intervalMs: number;
  /** Capabilities to monitor for changes */
  capabilities: string[];
}

/**
 * Default polling configuration
 */
const DEFAULT_CONFIG: PollConfig = {
  intervalMs: 5000, // 5 seconds
  capabilities: [
    'motionSensor',     // Motion sensors
    'contactSensor',    // Door/window sensors
    'switch',           // Switches and lights
    'dimmer',           // Dimmable lights (unified name for switchLevel)
    'lock',             // Door locks
    'temperatureSensor', // Temperature sensors (unified name)
  ],
};

/**
 * Device Polling Service
 *
 * Polls devices for state changes and emits events.
 *
 * Usage:
 * ```typescript
 * const pollingService = new DevicePollingService(
 *   async () => {
 *     const adapter = getSmartThingsAdapter();
 *     return await adapter.listDevices();
 *   },
 *   { intervalMs: 5000 }
 * );
 *
 * pollingService.on('deviceEvent', (event) => {
 *   console.log('Device state changed:', event);
 *   // Broadcast to SSE clients, store in EventStore, etc.
 * });
 *
 * pollingService.start();
 * ```
 */
export class DevicePollingService extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private previousStates: Map<string, DeviceState> = new Map();
  private config: PollConfig;
  private getDevices: () => Promise<UnifiedDevice[]>;
  private isPolling = false;
  private pollCount = 0;
  private changeCount = 0;

  /**
   * Create a new device polling service
   *
   * @param getDevices - Function to fetch current device list
   * @param config - Optional polling configuration
   */
  constructor(getDevices: () => Promise<UnifiedDevice[]>, config?: Partial<PollConfig>) {
    super();
    this.getDevices = getDevices;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start polling for device changes
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('[DevicePolling] Already started');
      return;
    }

    logger.info('[DevicePolling] Starting device polling service', {
      intervalMs: this.config.intervalMs,
      capabilities: this.config.capabilities,
    });

    // Initial poll (async, don't wait)
    void this.poll();

    // Schedule recurring polls
    this.intervalId = setInterval(() => {
      void this.poll();
    }, this.config.intervalMs);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[DevicePolling] Stopped', {
        totalPolls: this.pollCount,
        totalChanges: this.changeCount,
      });
    }
  }

  /**
   * Poll devices and detect changes
   */
  private async poll(): Promise<void> {
    // Prevent overlapping polls
    if (this.isPolling) {
      logger.debug('[DevicePolling] Skipping poll (previous poll still running)');
      return;
    }

    this.isPolling = true;
    const pollStartTime = Date.now();

    try {
      this.pollCount++;

      // Fetch current device list
      const devices = await this.getDevices();
      const devicesFetchTime = Date.now() - pollStartTime;

      logger.debug('[DevicePolling] Poll cycle started', {
        pollNumber: this.pollCount,
        deviceCount: devices.length,
        fetchTime: `${devicesFetchTime}ms`,
      });

      // Check each device for state changes
      let changesInThisPoll = 0;
      for (const device of devices) {
        const changes = await this.checkDeviceState(device);
        changesInThisPoll += changes;
      }

      const pollDuration = Date.now() - pollStartTime;

      if (changesInThisPoll > 0) {
        logger.info('[DevicePolling] Poll cycle complete', {
          pollNumber: this.pollCount,
          changes: changesInThisPoll,
          duration: `${pollDuration}ms`,
        });
      } else {
        logger.debug('[DevicePolling] Poll cycle complete (no changes)', {
          pollNumber: this.pollCount,
          duration: `${pollDuration}ms`,
        });
      }
    } catch (error) {
      logger.error('[DevicePolling] Poll failed', {
        error: error instanceof Error ? error.message : String(error),
        pollNumber: this.pollCount,
      });
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Check a device's state for changes
   *
   * @param device - Device to check
   * @returns Number of changes detected
   */
  private async checkDeviceState(device: UnifiedDevice): Promise<number> {
    let changesDetected = 0;

    // Check each configured capability
    for (const capName of this.config.capabilities) {
      const currentState = this.extractState(device, capName);
      if (!currentState) {
        continue; // Device doesn't have this capability
      }

      const key = `${device.platformDeviceId}:${capName}`;
      const previousState = this.previousStates.get(key);

      // Detect change (only if we have previous state and value changed)
      if (previousState && !this.statesEqual(previousState.value, currentState.value)) {
        const event: DeviceEvent = {
          eventType: 'device_event',
          deviceId: device.platformDeviceId,
          deviceName: device.name,
          capability: capName,
          attribute: currentState.attribute,
          value: currentState.value,
          previousValue: previousState.value,
          timestamp: new Date(),
          source: 'polling',
        };

        logger.info('[DevicePolling] State change detected', {
          deviceId: device.platformDeviceId,
          deviceName: device.name,
          capability: capName,
          attribute: currentState.attribute,
          previousValue: previousState.value,
          newValue: currentState.value,
        });

        this.emit('deviceEvent', event);
        this.changeCount++;
        changesDetected++;
      }

      // Update stored state
      this.previousStates.set(key, currentState);
    }

    return changesDetected;
  }

  /**
   * Extract current state for a capability from a unified device
   *
   * @param device - Unified device
   * @param capability - Capability name
   * @returns Device state or null if capability not supported
   */
  private extractState(device: UnifiedDevice, capability: string): DeviceState | null {
    // Check if device has this capability
    const hasCapability = device.capabilities.some((cap) => {
      // Convert DeviceCapability enum to string for comparison
      return String(cap).toLowerCase() === capability.toLowerCase();
    });

    if (!hasCapability) {
      return null;
    }

    // Map capability to primary attribute (state object key)
    const attributeMap: Record<string, string> = {
      motionSensor: 'motion',
      contactSensor: 'contact',
      switch: 'switch',
      dimmer: 'level',           // Unified name for switchLevel
      switchLevel: 'level',      // SmartThings native name
      lock: 'lock',
      temperatureSensor: 'temperature',  // Unified name
      temperatureMeasurement: 'temperature', // SmartThings native name
    };

    const attribute = attributeMap[capability];
    if (!attribute) {
      logger.warn('[DevicePolling] Unknown capability mapping', {
        capability,
        deviceId: device.platformDeviceId,
      });
      return null;
    }

    // Extract state from platformSpecific.state (SmartThings stores status here)
    const state = device.platformSpecific?.['state'] as Record<string, any> | undefined;
    if (!state || typeof state !== 'object') {
      return null; // No state available
    }

    // SmartThings stores capability state as flat structure: state.switch = "off", state.level = 90
    // Map attribute to the actual key in state object
    const value = state[attribute];
    if (value === undefined) {
      return null; // No current value available
    }

    return {
      deviceId: device.platformDeviceId,
      deviceName: device.name,
      capability,
      attribute,
      value,
      timestamp: new Date(),
    };
  }

  /**
   * Compare two state values for equality
   *
   * Handles different value types appropriately.
   *
   * @param a - First value
   * @param b - Second value
   * @returns True if values are equal
   */
  private statesEqual(a: any, b: any): boolean {
    // Handle null/undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // Handle numbers (with small tolerance for floating point)
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.01;
    }

    // Handle strings and booleans
    return a === b;
  }

  /**
   * Get current polling status
   *
   * @returns Polling status information
   */
  getStatus(): {
    running: boolean;
    pollCount: number;
    changeCount: number;
    trackedDevices: number;
    intervalMs: number;
  } {
    return {
      running: !!this.intervalId,
      pollCount: this.pollCount,
      changeCount: this.changeCount,
      trackedDevices: this.previousStates.size,
      intervalMs: this.config.intervalMs,
    };
  }

  /**
   * Clear all tracked state
   *
   * Useful for resetting the service or after device list changes.
   */
  clearState(): void {
    this.previousStates.clear();
    logger.info('[DevicePolling] State cleared');
  }
}
