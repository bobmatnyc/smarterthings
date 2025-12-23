// src/rules/conflict-detector.ts

/**
 * Rule Conflict Detection
 *
 * Identifies potential conflicts between rules that target the same devices,
 * helping users avoid unintended behavior from competing rules.
 *
 * Conflict Types:
 * - Opposing commands: Multiple rules send contradictory commands (on vs off)
 * - Duplicate commands: Multiple rules send same command (potential race conditions)
 * - Priority conflicts: Same-priority rules with conflicting actions
 *
 * Design Decision: Proactive conflict detection
 * Rationale: Catch conflicts during rule creation/update rather than runtime.
 * Helps users understand rule interactions before they cause issues.
 */

import logger from '../utils/logger.js';
import { getRulesStorage } from './storage.js';
import { Rule, DeviceCommandAction, isDeviceCommandAction } from './types.js';

/**
 * Severity levels for conflicts
 */
export type ConflictSeverity = 'warning' | 'error';

/**
 * Rule conflict information
 */
export interface RuleConflict {
  deviceId: string;
  deviceName?: string;
  rules: Array<{
    ruleId: string;
    ruleName: string;
    command: string;
    priority: number;
  }>;
  severity: ConflictSeverity;
  message: string;
  conflictType: 'opposing_commands' | 'duplicate_commands' | 'priority_conflict';
}

/**
 * Helper type for device command action with rule context
 */
interface RuleActionPair {
  rule: Rule;
  action: DeviceCommandAction;
}

/**
 * Detect potential conflicts between all enabled rules
 *
 * Analyzes all enabled rules to find:
 * - Rules sending opposing commands to the same device (on vs off)
 * - Multiple rules sending the same command (may execute redundantly)
 * - Priority conflicts (same priority rules with different commands)
 *
 * @returns Array of detected conflicts
 */
export function detectConflicts(): RuleConflict[] {
  const storage = getRulesStorage();
  const enabledRules = storage.getEnabled();
  const conflicts: RuleConflict[] = [];

  // Group rules by target device
  const deviceRules = new Map<string, RuleActionPair[]>();

  for (const rule of enabledRules) {
    for (const action of rule.actions) {
      if (isDeviceCommandAction(action)) {
        const deviceId = action.deviceId;
        if (!deviceRules.has(deviceId)) {
          deviceRules.set(deviceId, []);
        }
        deviceRules.get(deviceId)!.push({ rule, action });
      }
    }
  }

  // Check for conflicts on each device
  for (const [deviceId, ruleActions] of deviceRules) {
    if (ruleActions.length < 2) continue;

    // Check for opposing commands (on vs off)
    const commands = new Set(ruleActions.map((ra) => ra.action.command));

    if (commands.has('on') && commands.has('off')) {
      const onRules = ruleActions.filter((ra) => ra.action.command === 'on');
      const offRules = ruleActions.filter((ra) => ra.action.command === 'off');
      const firstAction = ruleActions[0];

      if (firstAction) {
        conflicts.push({
          deviceId,
          deviceName: firstAction.action.deviceName,
          rules: [...onRules, ...offRules].map((ra) => ({
            ruleId: ra.rule.id,
            ruleName: ra.rule.name,
            command: ra.action.command,
            priority: ra.rule.priority,
          })),
          severity: 'warning',
          message: `Multiple rules send opposing commands (on/off) to device ${firstAction.action.deviceName || deviceId}`,
          conflictType: 'opposing_commands',
        });
      }
    }

    // Check for same command from multiple rules (potential race)
    const commandCounts = new Map<string, number>();
    for (const ra of ruleActions) {
      const cmd = ra.action.command;
      commandCounts.set(cmd, (commandCounts.get(cmd) || 0) + 1);
    }

    for (const [cmd, count] of commandCounts) {
      if (count > 1) {
        const relevantRules = ruleActions.filter((ra) => ra.action.command === cmd);
        const firstAction = ruleActions[0];

        if (firstAction) {
          conflicts.push({
            deviceId,
            deviceName: firstAction.action.deviceName,
            rules: relevantRules.map((ra) => ({
              ruleId: ra.rule.id,
              ruleName: ra.rule.name,
              command: ra.action.command,
              priority: ra.rule.priority,
            })),
            severity: 'warning',
            message: `${count} rules send '${cmd}' command to same device (may execute multiple times)`,
            conflictType: 'duplicate_commands',
          });
        }
      }
    }

    // Check for priority conflicts (same priority, different commands)
    const priorityMap = new Map<number, RuleActionPair[]>();
    for (const ra of ruleActions) {
      const priority = ra.rule.priority;
      if (!priorityMap.has(priority)) {
        priorityMap.set(priority, []);
      }
      priorityMap.get(priority)!.push(ra);
    }

    for (const [priority, rules] of priorityMap) {
      if (rules.length < 2) continue;

      const uniqueCommands = new Set(rules.map((ra) => ra.action.command));
      if (uniqueCommands.size > 1) {
        const firstAction = ruleActions[0];

        if (firstAction) {
          conflicts.push({
            deviceId,
            deviceName: firstAction.action.deviceName,
            rules: rules.map((ra) => ({
              ruleId: ra.rule.id,
              ruleName: ra.rule.name,
              command: ra.action.command,
              priority: ra.rule.priority,
            })),
            severity: 'warning',
            message: `Multiple rules with same priority (${priority}) send different commands to device`,
            conflictType: 'priority_conflict',
          });
        }
      }
    }
  }

  if (conflicts.length > 0) {
    logger.warn(`[ConflictDetector] Found ${conflicts.length} potential rule conflicts`);
  }

  return conflicts;
}

/**
 * Check if a new/updated rule would create conflicts
 *
 * Used during rule creation/update to warn users before saving.
 *
 * @param rule Rule to check for conflicts
 * @returns Array of conflicts this rule would create
 */
export function checkRuleConflicts(rule: Rule): RuleConflict[] {
  const storage = getRulesStorage();
  const otherRules = storage.getEnabled().filter((r) => r.id !== rule.id);
  const conflicts: RuleConflict[] = [];

  for (const action of rule.actions) {
    if (!isDeviceCommandAction(action)) continue;

    for (const other of otherRules) {
      for (const otherAction of other.actions) {
        if (!isDeviceCommandAction(otherAction)) continue;
        if (otherAction.deviceId !== action.deviceId) continue;

        // Opposing commands
        if (
          (action.command === 'on' && otherAction.command === 'off') ||
          (action.command === 'off' && otherAction.command === 'on')
        ) {
          conflicts.push({
            deviceId: action.deviceId,
            deviceName: action.deviceName,
            rules: [
              {
                ruleId: rule.id,
                ruleName: rule.name,
                command: action.command,
                priority: rule.priority,
              },
              {
                ruleId: other.id,
                ruleName: other.name,
                command: otherAction.command,
                priority: other.priority,
              },
            ],
            severity: 'warning',
            message: `Opposing commands to ${action.deviceName || action.deviceId}`,
            conflictType: 'opposing_commands',
          });
        }

        // Same command (duplicate)
        if (action.command === otherAction.command) {
          conflicts.push({
            deviceId: action.deviceId,
            deviceName: action.deviceName,
            rules: [
              {
                ruleId: rule.id,
                ruleName: rule.name,
                command: action.command,
                priority: rule.priority,
              },
              {
                ruleId: other.id,
                ruleName: other.name,
                command: otherAction.command,
                priority: other.priority,
              },
            ],
            severity: 'warning',
            message: `Duplicate '${action.command}' command to ${action.deviceName || action.deviceId}`,
            conflictType: 'duplicate_commands',
          });
        }

        // Priority conflict
        if (rule.priority === other.priority && action.command !== otherAction.command) {
          conflicts.push({
            deviceId: action.deviceId,
            deviceName: action.deviceName,
            rules: [
              {
                ruleId: rule.id,
                ruleName: rule.name,
                command: action.command,
                priority: rule.priority,
              },
              {
                ruleId: other.id,
                ruleName: other.name,
                command: otherAction.command,
                priority: other.priority,
              },
            ],
            severity: 'warning',
            message: `Same priority (${rule.priority}) but different commands`,
            conflictType: 'priority_conflict',
          });
        }
      }
    }
  }

  return conflicts;
}
