// src/rules/event-listener.ts

/**
 * Rules Engine Event Listener
 *
 * Integrates the local rules engine with the device polling service to automatically
 * trigger rules when device states change.
 *
 * Design Decision: Event-driven rule execution
 * Rationale: Rules should react to real-time device state changes detected by polling
 * service or webhooks, enabling true automation without manual triggers.
 *
 * Architecture:
 * - Subscribes to 'deviceEvent' events from DevicePollingService
 * - Evaluates all enabled rules for matching conditions
 * - Executes matching rules automatically
 * - Tracks statistics and errors gracefully
 *
 * Integration Points:
 * - DevicePollingService: Emits deviceEvent when state changes detected
 * - RulesStorage: Provides findMatchingRules() to identify triggered rules
 * - RulesExecutor: Executes rules with proper context
 *
 * Event Flow:
 * 1. Device state changes (detected by polling or webhook)
 * 2. DevicePollingService emits 'deviceEvent' → { deviceId, attribute, value, ... }
 * 3. RulesEventListener receives event
 * 4. Find matching rules via storage.findMatchingRules()
 * 5. Execute each matching rule via executeRule()
 * 6. Track results and broadcast success/failure
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { initializeRulesStorage } from './storage.js';
import { executeMatchingRules, setSmartThingsAdapter } from './executor.js';
import { getEventAnalyzer } from './event-analyzer.js';
import type { DeviceEvent } from '../services/device-polling-service.js';

/**
 * Statistics tracked by event listener
 */
export interface EventListenerStats {
  initialized: boolean;
  enabled: boolean;
  connected: boolean;
  processedEvents: number;
  rulesTriggered: number;
  rulesFailed: number;
}

/**
 * Rules Engine Event Listener
 *
 * Connects to device polling service and executes rules on device state changes.
 *
 * Usage:
 * ```typescript
 * const listener = getRulesEventListener();
 * await listener.initialize(smartThingsAdapter);
 * listener.connectToPollingService(pollingService);
 *
 * // Later, to disconnect
 * listener.disconnect();
 * ```
 */
export class RulesEventListener {
  private initialized = false;
  private enabled = true;
  private pollingService: EventEmitter | null = null;
  private processedEvents = 0;
  private rulesTriggered = 0;
  private rulesFailed = 0;

  /**
   * Initialize the event listener
   *
   * @param adapter SmartThings adapter for rule execution (optional, can be set later)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async initialize(adapter?: any): Promise<void> {
    if (this.initialized) {
      logger.debug('[RulesEventListener] Already initialized');
      return;
    }

    // Initialize rules storage
    await initializeRulesStorage();

    // Set adapter for executor if provided
    if (adapter) {
      setSmartThingsAdapter(adapter);
      logger.debug('[RulesEventListener] SmartThings adapter configured');
    }

    this.initialized = true;
    logger.info('[RulesEventListener] Initialized and ready');
  }

  /**
   * Connect to the polling service event emitter
   *
   * Subscribes to 'deviceEvent' events from the polling service.
   *
   * @param pollingService DevicePollingService instance (EventEmitter)
   */
  connectToPollingService(pollingService: EventEmitter): void {
    if (this.pollingService) {
      logger.warn('[RulesEventListener] Already connected to polling service');
      return;
    }

    this.pollingService = pollingService;

    // Subscribe to device events from polling service
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    pollingService.on('deviceEvent', this.handleDeviceEvent.bind(this));

    logger.info('[RulesEventListener] Connected to polling service');
  }

  /**
   * Disconnect from polling service
   *
   * Removes event listeners and clears reference.
   */
  disconnect(): void {
    if (this.pollingService) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.pollingService.removeListener('deviceEvent', this.handleDeviceEvent.bind(this));
      this.pollingService = null;
      logger.info('[RulesEventListener] Disconnected from polling service');
    }
  }

  /**
   * Handle device event from polling service
   *
   * Event format from DevicePollingService:
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
   *
   * @param event Device event from polling service
   */
  private async handleDeviceEvent(event: DeviceEvent): Promise<void> {
    if (!this.enabled) {
      logger.debug('[RulesEventListener] Rule processing disabled, ignoring event');
      return;
    }

    if (!this.initialized) {
      logger.warn('[RulesEventListener] Not initialized, ignoring event');
      return;
    }

    this.processedEvents++;

    try {
      logger.debug('[RulesEventListener] Processing device event', {
        deviceId: event.deviceId,
        deviceName: event.deviceName,
        attribute: event.attribute,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value: event.value,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        previousValue: event.previousValue,
      });

      // Record event for pattern analysis
      const analyzer = getEventAnalyzer();
      analyzer.recordEvent({
        deviceId: event.deviceId,
        deviceName: event.deviceName,
        attribute: event.attribute,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value: event.value,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        previousValue: event.previousValue,
        timestamp: event.timestamp,
      });

      // Find and execute matching rules
      // executeMatchingRules(deviceId, deviceName, attribute, value)
      const results = await executeMatchingRules(
        event.deviceId,
        event.deviceName,
        event.attribute,
        event.value
      );

      if (results.length > 0) {
        // Count successes and failures
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const successful = results.filter((r) => r.success).length;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const failed = results.filter((r) => !r.success).length;

        this.rulesTriggered += successful;
        this.rulesFailed += failed;

        logger.info('[RulesEventListener] Executed rules for device event', {
          deviceId: event.deviceId,
          deviceName: event.deviceName,
          attribute: event.attribute,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          value: event.value,
          totalRules: results.length,
          successful,
          failed,
        });

        // Log individual rule results at debug level
        results.forEach((result) => {
          if (result.success) {
            logger.debug('[RulesEventListener] Rule executed successfully', {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              ruleId: result.ruleId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              ruleName: result.ruleName,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              durationMs: result.durationMs,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              actionsExecuted: result.actionsExecuted,
            });
          } else {
            logger.warn('[RulesEventListener] Rule execution failed', {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              ruleId: result.ruleId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              ruleName: result.ruleName,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              error: result.error,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              durationMs: result.durationMs,
            });
          }
        });
      } else {
        logger.debug('[RulesEventListener] No matching rules for event', {
          deviceId: event.deviceId,
          attribute: event.attribute,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          value: event.value,
        });
      }
    } catch (error) {
      logger.error('[RulesEventListener] Error processing device event', {
        deviceId: event.deviceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Enable/disable rule processing
   *
   * When disabled, events are received but rules are not evaluated or executed.
   *
   * @param enabled True to enable rule processing, false to disable
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`[RulesEventListener] Rule processing ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get listener statistics
   *
   * @returns Current statistics
   */
  getStats(): EventListenerStats {
    return {
      initialized: this.initialized,
      enabled: this.enabled,
      connected: this.pollingService !== null,
      processedEvents: this.processedEvents,
      rulesTriggered: this.rulesTriggered,
      rulesFailed: this.rulesFailed,
    };
  }

  /**
   * Reset statistics
   *
   * Useful for testing or periodic reporting.
   */
  resetStats(): void {
    this.processedEvents = 0;
    this.rulesTriggered = 0;
    this.rulesFailed = 0;
    logger.debug('[RulesEventListener] Statistics reset');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of the rules event listener
 */
let instance: RulesEventListener | null = null;

/**
 * Get or create the singleton RulesEventListener instance
 *
 * @returns Singleton instance
 */
export function getRulesEventListener(): RulesEventListener {
  if (!instance) {
    instance = new RulesEventListener();
  }
  return instance;
}

/**
 * Initialize the rules event listener
 *
 * Convenience function for initialization with adapter.
 *
 * @param adapter SmartThings adapter for rule execution (optional)
 * @returns Promise resolving to initialized listener
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeRulesEventListener(adapter?: any): Promise<RulesEventListener> {
  const listener = getRulesEventListener();
  await listener.initialize(adapter);
  return listener;
}
