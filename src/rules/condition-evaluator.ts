// src/rules/condition-evaluator.ts

/**
 * Condition Evaluator for Rules Engine
 *
 * Evaluates complex conditions for rules including:
 * - Device state conditions (check current device values)
 * - Time conditions (before/after/between times)
 * - Compound conditions (AND/OR logic)
 * - NOT conditions (negation)
 *
 * Design Decision: Recursive evaluation with device state fetching
 * Rationale: Conditions need current device states, not event states.
 * Supports arbitrarily nested compound conditions.
 *
 * Integration:
 * - Used by executor to check conditions before running actions
 * - Queries device adapter for current state values
 * - Uses astronomical calculator for sunrise/sunset conditions
 */

import logger from '../utils/logger.js';
import { getAstronomicalCalculator } from './astronomical.js';
import {
  RuleCondition,
  DeviceStateCondition,
  TimeCondition,
  CompoundCondition,
  NotCondition,
  TriggerOperator,
  isDeviceStateCondition,
  isTimeCondition,
  isCompoundCondition,
  isNotCondition,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ConditionContext {
  // Function to get current device state
  getDeviceState?: (deviceId: string, attribute: string) => Promise<unknown>;

  // Current variables (from trigger event)
  variables?: Record<string, unknown>;

  // Override current time (for testing)
  currentTime?: Date;
}

export interface ConditionResult {
  satisfied: boolean;
  reason?: string;
  evaluatedConditions?: Array<{
    type: string;
    satisfied: boolean;
    details?: string;
  }>;
}

// ============================================================================
// Condition Evaluator
// ============================================================================

export class ConditionEvaluator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deviceAdapter: any = null;

  /**
   * Set the device adapter for fetching current states
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDeviceAdapter(adapter: any): void {
    this.deviceAdapter = adapter;
  }

  /**
   * Evaluate a list of conditions (all must be true)
   *
   * @param conditions List of conditions to evaluate
   * @param context Evaluation context
   * @returns Result with overall satisfaction and details
   */
  async evaluateAll(
    conditions: RuleCondition[],
    context: ConditionContext = {}
  ): Promise<ConditionResult> {
    if (conditions.length === 0) {
      return { satisfied: true, reason: 'No conditions specified' };
    }

    const results: ConditionResult['evaluatedConditions'] = [];
    let allSatisfied = true;

    for (const condition of conditions) {
      const result = await this.evaluate(condition, context);

      results.push({
        type: condition.type,
        satisfied: result.satisfied,
        details: result.reason,
      });

      if (!result.satisfied) {
        allSatisfied = false;
        // Don't short-circuit - evaluate all for logging
      }
    }

    return {
      satisfied: allSatisfied,
      reason: allSatisfied
        ? 'All conditions satisfied'
        : `${results.filter((r) => !r.satisfied).length} condition(s) not satisfied`,
      evaluatedConditions: results,
    };
  }

  /**
   * Evaluate a single condition
   *
   * @param condition Condition to evaluate
   * @param context Evaluation context
   * @returns Result with satisfaction and reason
   */
  async evaluate(
    condition: RuleCondition,
    context: ConditionContext = {}
  ): Promise<ConditionResult> {
    try {
      if (isDeviceStateCondition(condition)) {
        return await this.evaluateDeviceState(condition, context);
      }

      if (isTimeCondition(condition)) {
        return this.evaluateTime(condition, context);
      }

      if (isCompoundCondition(condition)) {
        return await this.evaluateCompound(condition, context);
      }

      if (isNotCondition(condition)) {
        return await this.evaluateNot(condition, context);
      }

      // Handle unknown condition type
      const unknownCondition = condition as { type?: string };
      return {
        satisfied: false,
        reason: `Unknown condition type: ${unknownCondition.type || 'unknown'}`,
      };
    } catch (error) {
      logger.error('[ConditionEvaluator] Error evaluating condition:', error);
      return {
        satisfied: false,
        reason: `Evaluation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Evaluate device state condition
   *
   * Fetches current device state and compares against expected value.
   */
  private async evaluateDeviceState(
    condition: DeviceStateCondition,
    context: ConditionContext
  ): Promise<ConditionResult> {
    const { deviceId, attribute, operator, value } = condition;

    // Get current device state
    let currentValue: unknown;

    if (context.getDeviceState) {
      currentValue = await context.getDeviceState(deviceId, attribute);
    } else if (this.deviceAdapter) {
      currentValue = await this.getDeviceAttributeValue(deviceId, attribute);
    } else {
      return {
        satisfied: false,
        reason: 'No device adapter available to check state',
      };
    }

    const result = this.evaluateOperator(operator, currentValue, value);

    return {
      satisfied: result,
      reason: result
        ? `Device ${deviceId}.${attribute} ${operator} ${String(value)}`
        : `Device ${deviceId}.${attribute} = ${String(currentValue)}, expected ${operator} ${String(value)}`,
    };
  }

  /**
   * Get device attribute value from adapter
   */
  private async getDeviceAttributeValue(
    deviceId: string,
    attribute: string
  ): Promise<unknown> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const status = await this.deviceAdapter.getDeviceStatus?.(deviceId);

      if (!status) return undefined;

      // Navigate the SmartThings status structure
      // Status is organized by component -> capability -> attribute
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const mainComponent = status.components?.main;
      if (!mainComponent) return undefined;

      // Search all capabilities for the attribute
      for (const capabilityStatus of Object.values(mainComponent)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attrValue = (capabilityStatus as any)?.[attribute]?.value;
        if (attrValue !== undefined) {
          return attrValue;
        }
      }

      return undefined;
    } catch (error) {
      logger.error(`[ConditionEvaluator] Failed to get device state:`, error);
      return undefined;
    }
  }

  /**
   * Evaluate time condition
   *
   * Supports before/after/between operators with time strings or astronomical events.
   */
  private evaluateTime(
    condition: TimeCondition,
    context: ConditionContext
  ): ConditionResult {
    const now = context.currentTime || new Date();
    const { operator, value, valueEnd } = condition;

    // Parse time value (HH:MM or 'sunrise'/'sunset')
    const targetTime = this.parseTimeValue(value, now);
    if (!targetTime) {
      return {
        satisfied: false,
        reason: `Invalid time value: ${value}`,
      };
    }

    let satisfied: boolean;
    let reason: string;

    switch (operator) {
      case 'before':
        satisfied = now < targetTime;
        reason = satisfied
          ? `Current time is before ${value}`
          : `Current time is after ${value}`;
        break;

      case 'after':
        satisfied = now > targetTime;
        reason = satisfied
          ? `Current time is after ${value}`
          : `Current time is before ${value}`;
        break;

      case 'between':
        if (!valueEnd) {
          return { satisfied: false, reason: 'Missing end time for between operator' };
        }
        const endTime = this.parseTimeValue(valueEnd, now);
        if (!endTime) {
          return { satisfied: false, reason: `Invalid end time: ${valueEnd}` };
        }

        // Handle overnight ranges (e.g., 22:00 to 06:00)
        if (endTime < targetTime) {
          satisfied = now >= targetTime || now <= endTime;
        } else {
          satisfied = now >= targetTime && now <= endTime;
        }
        reason = satisfied
          ? `Current time is between ${value} and ${valueEnd}`
          : `Current time is outside ${value} and ${valueEnd}`;
        break;

      default:
        return { satisfied: false, reason: `Unknown time operator: ${operator}` };
    }

    return { satisfied, reason };
  }

  /**
   * Parse time value (HH:MM or astronomical event)
   */
  private parseTimeValue(value: string, referenceDate: Date): Date | null {
    // Check for astronomical events
    if (value === 'sunrise' || value === 'sunset') {
      const astro = getAstronomicalCalculator();
      const times = astro.getTodaysTimes();
      if (!times) return null;
      return value === 'sunrise' ? times.sunrise : times.sunset;
    }

    // Parse HH:MM format
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match || !match[1] || !match[2]) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    const result = new Date(referenceDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Evaluate compound condition (AND/OR)
   */
  private async evaluateCompound(
    condition: CompoundCondition,
    context: ConditionContext
  ): Promise<ConditionResult> {
    const { type, conditions } = condition;

    if (conditions.length === 0) {
      return { satisfied: true, reason: 'Empty compound condition' };
    }

    const results: Array<{ satisfied: boolean; reason?: string }> = [];

    for (const subCondition of conditions) {
      const result = await this.evaluate(subCondition, context);
      results.push(result);

      // Short-circuit evaluation
      if (type === 'and' && !result.satisfied) {
        return {
          satisfied: false,
          reason: `AND condition failed: ${result.reason}`,
        };
      }

      if (type === 'or' && result.satisfied) {
        return {
          satisfied: true,
          reason: `OR condition passed: ${result.reason}`,
        };
      }
    }

    // Final result
    if (type === 'and') {
      return {
        satisfied: true,
        reason: 'All AND conditions satisfied',
      };
    } else {
      return {
        satisfied: false,
        reason: 'No OR conditions satisfied',
      };
    }
  }

  /**
   * Evaluate NOT condition
   */
  private async evaluateNot(
    condition: NotCondition,
    context: ConditionContext
  ): Promise<ConditionResult> {
    const innerResult = await this.evaluate(condition.condition, context);

    return {
      satisfied: !innerResult.satisfied,
      reason: `NOT(${innerResult.reason})`,
    };
  }

  /**
   * Evaluate operator for value comparison
   */
  private evaluateOperator(
    operator: TriggerOperator,
    actual: unknown,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;

      case 'notEquals':
        return actual !== expected;

      case 'greaterThan':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

      case 'lessThan':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.toLowerCase().includes(expected.toLowerCase());
        }
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return false;

      case 'between':
        // Note: 'between' for conditions should have both values in expected as array
        if (typeof actual === 'number' && Array.isArray(expected) && expected.length === 2) {
          return actual >= expected[0] && actual <= expected[1];
        }
        return false;

      default:
        return false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ConditionEvaluator | null = null;

export function getConditionEvaluator(): ConditionEvaluator {
  if (!instance) {
    instance = new ConditionEvaluator();
  }
  return instance;
}

/**
 * Convenience function to evaluate conditions
 */
export async function evaluateConditions(
  conditions: RuleCondition[],
  context: ConditionContext = {}
): Promise<ConditionResult> {
  return getConditionEvaluator().evaluateAll(conditions, context);
}

/**
 * Convenience function to evaluate a single condition
 */
export async function evaluateCondition(
  condition: RuleCondition,
  context: ConditionContext = {}
): Promise<ConditionResult> {
  return getConditionEvaluator().evaluate(condition, context);
}
