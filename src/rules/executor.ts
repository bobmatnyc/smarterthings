// src/rules/executor.ts

import logger from '../utils/logger.js';
import { logEvent } from '../utils/event-logger.js';
import {
  Rule,
  RuleAction,
  DeviceCommandAction,
  DelayAction,
  SequenceAction,
  RuleExecutionContext,
  RuleExecutionResult,
  ActionResult,
} from './types.js';
import { getRulesStorage } from './storage.js';

// We'll need to import the SmartThings adapter dynamically to avoid circular deps
let smartThingsAdapter: any = null;

export function setSmartThingsAdapter(adapter: any): void {
  smartThingsAdapter = adapter;
}

/**
 * Execute a single rule
 */
export async function executeRule(
  rule: Rule,
  context: RuleExecutionContext
): Promise<RuleExecutionResult> {
  const startTime = Date.now();
  const actionResults: ActionResult[] = [];
  let success = true;
  let error: string | undefined;

  logger.info(`[RuleExecutor] Executing rule: ${rule.name} (${rule.id})`);

  try {
    // Execute all actions
    for (const action of rule.actions) {
      const result = await executeAction(action);
      actionResults.push(result);

      if (!result.success) {
        success = false;
        error = result.error;
        // Continue executing remaining actions even if one fails
      }
    }

    // Record execution
    await getRulesStorage().recordExecution(rule.id);

  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
    logger.error(`[RuleExecutor] Rule execution failed: ${error}`);
  }

  const completedAt = new Date().toISOString();
  const result: RuleExecutionResult = {
    ruleId: rule.id,
    ruleName: rule.name,
    success,
    startedAt: new Date(startTime).toISOString(),
    completedAt,
    durationMs: Date.now() - startTime,
    triggeredBy: context.triggeredBy,
    actionsExecuted: actionResults.length,
    actionResults,
    error,
  };

  // Log execution event
  await logExecutionEvent(rule, result, context);

  logger.info(
    `[RuleExecutor] Rule ${rule.name} ${success ? 'completed' : 'failed'} in ${result.durationMs}ms`
  );

  return result;
}

/**
 * Execute a single action
 */
async function executeAction(action: RuleAction): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    switch (action.type) {
      case 'device_command':
        return await executeDeviceCommand(action);

      case 'delay':
        return await executeDelay(action);

      case 'sequence':
        return await executeSequence(action);

      case 'notification':
        // MVP: Just log notifications
        logger.info(`[RuleExecutor] Notification: ${action.title} - ${action.message}`);
        return {
          actionType: 'notification',
          success: true,
          durationMs: Date.now() - startTime,
        };

      case 'execute_rule':
        return await executeRuleChain(action.ruleId);

      default:
        return {
          actionType: (action as any).type,
          success: false,
          error: `Unknown action type: ${(action as any).type}`,
          durationMs: Date.now() - startTime,
        };
    }
  } catch (err) {
    return {
      actionType: action.type,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Execute device command action
 */
async function executeDeviceCommand(action: DeviceCommandAction): Promise<ActionResult> {
  const startTime = Date.now();

  if (!smartThingsAdapter) {
    return {
      actionType: 'device_command',
      success: false,
      deviceId: action.deviceId,
      command: action.command,
      error: 'SmartThings adapter not available',
      durationMs: Date.now() - startTime,
    };
  }

  try {
    logger.info(
      `[RuleExecutor] Executing command: ${action.command} on device ${action.deviceId}`
    );

    // Build command arguments
    const args = action.arguments || {};

    // Execute via SmartThings adapter
    await smartThingsAdapter.executeDeviceCommand(
      action.deviceId,
      action.capability || inferCapability(action.command),
      action.command,
      Object.values(args)
    );

    return {
      actionType: 'device_command',
      success: true,
      deviceId: action.deviceId,
      command: action.command,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      actionType: 'device_command',
      success: false,
      deviceId: action.deviceId,
      command: action.command,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Infer capability from command name
 */
function inferCapability(command: string): string {
  const commandToCapability: Record<string, string> = {
    on: 'switch',
    off: 'switch',
    setLevel: 'switchLevel',
    setColor: 'colorControl',
    setColorTemperature: 'colorTemperature',
    lock: 'lock',
    unlock: 'lock',
    open: 'doorControl',
    close: 'doorControl',
  };
  return commandToCapability[command] || 'switch';
}

/**
 * Execute delay action
 */
async function executeDelay(action: DelayAction): Promise<ActionResult> {
  const startTime = Date.now();

  logger.info(`[RuleExecutor] Waiting ${action.seconds} seconds`);
  await new Promise(resolve => setTimeout(resolve, action.seconds * 1000));

  return {
    actionType: 'delay',
    success: true,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute sequence of actions
 */
async function executeSequence(action: SequenceAction): Promise<ActionResult> {
  const startTime = Date.now();
  const mode = action.mode || 'serial';

  try {
    if (mode === 'parallel') {
      await Promise.all(action.actions.map(a => executeAction(a)));
    } else {
      for (const a of action.actions) {
        await executeAction(a);
      }
    }

    return {
      actionType: 'sequence',
      success: true,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      actionType: 'sequence',
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Execute another rule (rule chaining)
 */
async function executeRuleChain(ruleId: string): Promise<ActionResult> {
  const startTime = Date.now();
  const storage = getRulesStorage();
  const rule = storage.get(ruleId as any);

  if (!rule) {
    return {
      actionType: 'execute_rule',
      success: false,
      error: `Rule not found: ${ruleId}`,
      durationMs: Date.now() - startTime,
    };
  }

  const context: RuleExecutionContext = {
    triggeredBy: 'rule_chain',
    variables: {},
  };

  const result = await executeRule(rule, context);

  return {
    actionType: 'execute_rule',
    success: result.success,
    error: result.error,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Log rule execution event
 */
async function logExecutionEvent(
  rule: Rule,
  result: RuleExecutionResult,
  context: RuleExecutionContext
): Promise<void> {
  const event = {
    type: 'rule_execution' as const,
    source: 'rules_engine' as const,
    deviceId: undefined,
    deviceName: undefined,
    value: {
      ruleId: rule.id,
      ruleName: rule.name,
      success: result.success,
      triggeredBy: context.triggeredBy,
      actionsExecuted: result.actionsExecuted,
      durationMs: result.durationMs,
      error: result.error,
    },
    timestamp: new Date(),
    metadata: {
      actionResults: result.actionResults,
    },
  };

  // Log to file
  logEvent(event);
}

/**
 * Execute rules matching a device event
 */
export async function executeMatchingRules(
  deviceId: string,
  deviceName: string,
  attribute: string,
  value: unknown
): Promise<RuleExecutionResult[]> {
  const storage = getRulesStorage();
  const matchingRules = storage.findMatchingRules(deviceId, attribute, value);

  if (matchingRules.length === 0) {
    return [];
  }

  logger.info(
    `[RuleExecutor] Found ${matchingRules.length} matching rules for ${deviceName}.${attribute}=${value}`
  );

  const results: RuleExecutionResult[] = [];

  for (const rule of matchingRules) {
    const context: RuleExecutionContext = {
      triggeredBy: 'event',
      triggerEvent: {
        type: 'device_state',
        deviceId,
        value,
        timestamp: new Date().toISOString(),
      },
      variables: {},
    };

    const result = await executeRule(rule, context);
    results.push(result);
  }

  return results;
}
