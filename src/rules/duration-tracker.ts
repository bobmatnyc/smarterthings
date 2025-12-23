// src/rules/duration-tracker.ts

/**
 * Duration Tracker for Rules Engine
 *
 * Tracks how long devices have been in specific states to enable:
 * - Duration-based triggers (device on for X minutes)
 * - Sustained state conditions (motion active for > 5 min)
 * - Idle detection (no motion for > 30 min)
 *
 * Design Decision: In-memory state tracking with event integration
 * Rationale: Tracks state durations without persistent storage.
 * State is reconstructed from device events on initialization.
 *
 * Architecture:
 * - Subscribes to device events from polling service
 * - Maintains map of device states with timestamps
 * - Evaluates duration conditions on demand
 * - Fires duration triggers when thresholds are met
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { getRulesStorage } from './storage.js';
import { executeRule } from './executor.js';
import {
  Rule,
  RuleExecutionContext,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

interface DeviceStateEntry {
  deviceId: string;
  deviceName?: string;
  attribute: string;
  value: unknown;
  startTime: Date;
  durationMs: number;  // Auto-updated by timer
}

interface DurationTrigger {
  type: 'state_duration';
  deviceId: string;
  attribute: string;
  operator: 'equals' | 'notEquals';
  value: unknown;
  durationMinutes: number;  // How long state must be held
}

interface TrackedDurationTrigger {
  ruleId: string;
  trigger: DurationTrigger;
  lastChecked: Date;
  triggered: boolean;
}

export interface DurationTrackerStats {
  trackedDevices: number;
  trackedStates: number;
  pendingTriggers: number;
  triggeredRules: number;
}

// ============================================================================
// Duration Tracker Class
// ============================================================================

export class DurationTracker extends EventEmitter {
  private initialized = false;
  private deviceStates: Map<string, DeviceStateEntry> = new Map();
  private durationTriggers: Map<string, TrackedDurationTrigger[]> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private triggeredRules = 0;

  // Check interval in milliseconds (default: 30 seconds)
  private readonly CHECK_INTERVAL = 30 * 1000;

  /**
   * Initialize the duration tracker
   *
   * Starts periodic duration checking and loads duration triggers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[DurationTracker] Already initialized');
      return;
    }

    // Load rules with duration triggers
    this.loadDurationTriggers();

    // Start periodic duration check
    this.checkInterval = setInterval(() => {
      this.checkDurations();
    }, this.CHECK_INTERVAL);

    this.initialized = true;
    logger.info('[DurationTracker] Initialized');
  }

  /**
   * Load all duration triggers from rules
   */
  private loadDurationTriggers(): void {
    const storage = getRulesStorage();
    const rules = storage.getEnabled();

    this.durationTriggers.clear();

    for (const rule of rules) {
      // Look for duration triggers in conditions
      // Duration triggers are defined as extended triggers in the rule
      const durationTriggers = this.extractDurationTriggers(rule);

      if (durationTriggers.length > 0) {
        this.durationTriggers.set(rule.id, durationTriggers.map((trigger) => ({
          ruleId: rule.id,
          trigger,
          lastChecked: new Date(),
          triggered: false,
        })));
      }
    }

    logger.debug(`[DurationTracker] Loaded ${this.durationTriggers.size} rules with duration triggers`);
  }

  /**
   * Extract duration triggers from a rule
   *
   * Duration triggers are stored as extended device_state triggers with duration field.
   */
  private extractDurationTriggers(rule: Rule): DurationTrigger[] {
    const triggers: DurationTrigger[] = [];

    for (const trigger of rule.triggers) {
      // Check for extended trigger with duration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extTrigger = trigger as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (trigger.type === 'device_state' && extTrigger.durationMinutes !== undefined) {
        triggers.push({
          type: 'state_duration',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          deviceId: extTrigger.deviceId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          attribute: extTrigger.attribute,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          operator: extTrigger.operator === 'equals' ? 'equals' : 'notEquals',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          value: extTrigger.value,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          durationMinutes: extTrigger.durationMinutes,
        });
      }
    }

    return triggers;
  }

  /**
   * Update device state when event received
   *
   * @param deviceId Device ID
   * @param deviceName Device name
   * @param attribute Attribute that changed
   * @param value New value
   * @param previousValue Previous value
   */
  updateDeviceState(
    deviceId: string,
    deviceName: string | undefined,
    attribute: string,
    value: unknown,
    previousValue?: unknown
  ): void {
    const key = `${deviceId}:${attribute}`;
    const existing = this.deviceStates.get(key);

    // Only reset timer if value actually changed
    if (!existing || existing.value !== value) {
      const entry: DeviceStateEntry = {
        deviceId,
        deviceName,
        attribute,
        value,
        startTime: new Date(),
        durationMs: 0,
      };

      this.deviceStates.set(key, entry);

      logger.debug(`[DurationTracker] State changed: ${deviceName || deviceId}.${attribute} = ${String(value)}`);

      // Reset any triggered flags for this device/attribute combo
      this.resetTriggeredFlags(deviceId, attribute);

      // Emit event for listeners
      this.emit('stateChanged', {
        deviceId,
        deviceName,
        attribute,
        value,
        previousValue,
        timestamp: entry.startTime,
      });
    }
  }

  /**
   * Reset triggered flags when state changes
   */
  private resetTriggeredFlags(deviceId: string, attribute: string): void {
    for (const triggers of this.durationTriggers.values()) {
      for (const tracked of triggers) {
        if (tracked.trigger.deviceId === deviceId && tracked.trigger.attribute === attribute) {
          tracked.triggered = false;
        }
      }
    }
  }

  /**
   * Get current duration for a device state
   *
   * @param deviceId Device ID
   * @param attribute Attribute name
   * @returns Duration in milliseconds, or null if not tracked
   */
  getStateDuration(deviceId: string, attribute: string): number | null {
    const key = `${deviceId}:${attribute}`;
    const entry = this.deviceStates.get(key);

    if (!entry) return null;

    return Date.now() - entry.startTime.getTime();
  }

  /**
   * Check if device has been in state for specified duration
   *
   * @param deviceId Device ID
   * @param attribute Attribute name
   * @param value Expected value
   * @param durationMinutes Minimum duration in minutes
   * @returns True if condition is met
   */
  hasBeenInStateFor(
    deviceId: string,
    attribute: string,
    value: unknown,
    durationMinutes: number
  ): boolean {
    const key = `${deviceId}:${attribute}`;
    const entry = this.deviceStates.get(key);

    if (!entry) return false;
    if (entry.value !== value) return false;

    const durationMs = Date.now() - entry.startTime.getTime();
    const requiredMs = durationMinutes * 60 * 1000;

    return durationMs >= requiredMs;
  }

  /**
   * Check all duration triggers and execute rules
   */
  private async checkDurations(): Promise<void> {
    const now = Date.now();

    for (const [ruleId, triggers] of this.durationTriggers) {
      for (const tracked of triggers) {
        if (tracked.triggered) continue; // Already triggered

        const { trigger } = tracked;
        const key = `${trigger.deviceId}:${trigger.attribute}`;
        const entry = this.deviceStates.get(key);

        if (!entry) continue;

        // Check if value matches
        const valueMatches = trigger.operator === 'equals'
          ? entry.value === trigger.value
          : entry.value !== trigger.value;

        if (!valueMatches) continue;

        // Check duration
        const durationMs = now - entry.startTime.getTime();
        const requiredMs = trigger.durationMinutes * 60 * 1000;

        if (durationMs >= requiredMs) {
          // Duration threshold met - execute rule
          logger.info(`[DurationTracker] Duration trigger met: ${entry.deviceName || trigger.deviceId}.${trigger.attribute} = ${String(trigger.value)} for ${trigger.durationMinutes} minutes`);

          tracked.triggered = true;
          await this.executeTriggeredRule(ruleId, trigger, entry);
        }
      }
    }
  }

  /**
   * Execute a rule triggered by duration condition
   */
  private async executeTriggeredRule(
    ruleId: string,
    trigger: DurationTrigger,
    entry: DeviceStateEntry
  ): Promise<void> {
    const storage = getRulesStorage();
    const rule = storage.get(ruleId as Rule['id']);

    if (!rule || !rule.enabled) {
      logger.debug(`[DurationTracker] Rule ${ruleId} not found or disabled`);
      return;
    }

    const context: RuleExecutionContext = {
      triggeredBy: 'event',
      triggerEvent: {
        type: 'state_duration',
        deviceId: trigger.deviceId,
        value: entry.value,
        timestamp: new Date().toISOString(),
      },
      variables: {
        durationMinutes: Math.floor((Date.now() - entry.startTime.getTime()) / 60000),
      },
    };

    try {
      const result = await executeRule(rule, context);

      if (result.success) {
        this.triggeredRules++;
        logger.info(`[DurationTracker] Rule executed: ${rule.name}`);
      } else {
        logger.error(`[DurationTracker] Rule failed: ${result.error}`);
      }

      this.emit('ruleExecuted', { rule, result, trigger });
    } catch (error) {
      logger.error(`[DurationTracker] Error executing rule:`, error);
    }
  }

  /**
   * Get all tracked device states
   */
  getTrackedStates(): Array<{
    deviceId: string;
    deviceName?: string;
    attribute: string;
    value: unknown;
    durationMinutes: number;
  }> {
    const now = Date.now();
    return Array.from(this.deviceStates.values()).map((entry) => ({
      deviceId: entry.deviceId,
      deviceName: entry.deviceName,
      attribute: entry.attribute,
      value: entry.value,
      durationMinutes: Math.floor((now - entry.startTime.getTime()) / 60000),
    }));
  }

  /**
   * Get tracker statistics
   */
  getStats(): DurationTrackerStats {
    let pendingTriggers = 0;
    for (const triggers of this.durationTriggers.values()) {
      pendingTriggers += triggers.filter((t) => !t.triggered).length;
    }

    return {
      trackedDevices: new Set(Array.from(this.deviceStates.values()).map((e) => e.deviceId)).size,
      trackedStates: this.deviceStates.size,
      pendingTriggers,
      triggeredRules: this.triggeredRules,
    };
  }

  /**
   * Reload triggers from rules storage
   */
  reloadTriggers(): void {
    this.loadDurationTriggers();
  }

  /**
   * Shutdown the duration tracker
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.deviceStates.clear();
    this.durationTriggers.clear();
    this.initialized = false;

    logger.info('[DurationTracker] Shutdown complete');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: DurationTracker | null = null;

export function getDurationTracker(): DurationTracker {
  if (!instance) {
    instance = new DurationTracker();
  }
  return instance;
}

export async function initializeDurationTracker(): Promise<DurationTracker> {
  const tracker = getDurationTracker();
  await tracker.initialize();
  return tracker;
}
