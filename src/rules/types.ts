// src/rules/types.ts

// =============================================================================
// Branded Types for Domain Safety
// =============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type RuleId = Brand<string, 'RuleId'>;
export type DeviceId = Brand<string, 'DeviceId'>;

export function createRuleId(id: string): RuleId {
  return id as RuleId;
}

// =============================================================================
// Trigger Types (MVP: device_state only, prepared for expansion)
// =============================================================================

export type TriggerOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'contains'
  | 'between';

export interface DeviceStateTrigger {
  type: 'device_state';
  deviceId: string;
  deviceName?: string;
  attribute: string;  // e.g., 'switch', 'motion', 'temperature', 'level'
  operator: TriggerOperator;
  value: unknown;
  valueEnd?: unknown;  // For 'between' operator
}

export interface TimeTrigger {
  type: 'time';
  time: string;  // HH:MM format
  days?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
}

export interface AstronomicalTrigger {
  type: 'astronomical';
  event: 'sunrise' | 'sunset';
  offsetMinutes?: number;  // +/- minutes from event
}

export interface CronTrigger {
  type: 'cron';
  expression: string;  // Standard cron format
}

// Union of all trigger types
export type RuleTrigger =
  | DeviceStateTrigger
  | TimeTrigger
  | AstronomicalTrigger
  | CronTrigger;

// =============================================================================
// Condition Types (for compound logic)
// =============================================================================

export interface DeviceStateCondition {
  type: 'device_state';
  deviceId: string;
  attribute: string;
  operator: TriggerOperator;
  value: unknown;
}

export interface TimeCondition {
  type: 'time';
  operator: 'before' | 'after' | 'between';
  value: string;  // HH:MM or 'sunrise' or 'sunset'
  valueEnd?: string;
}

export interface CompoundCondition {
  type: 'and' | 'or';
  conditions: RuleCondition[];
}

export interface NotCondition {
  type: 'not';
  condition: RuleCondition;
}

export type RuleCondition =
  | DeviceStateCondition
  | TimeCondition
  | CompoundCondition
  | NotCondition;

// =============================================================================
// Action Types
// =============================================================================

export interface DeviceCommandAction {
  type: 'device_command';
  deviceId: string;
  deviceName?: string;
  capability?: string;  // e.g., 'switch', 'switchLevel'
  command: string;      // e.g., 'on', 'off', 'setLevel'
  arguments?: Record<string, unknown>;  // e.g., { level: 50 }
}

export interface DelayAction {
  type: 'delay';
  seconds: number;
}

export interface SequenceAction {
  type: 'sequence';
  actions: RuleAction[];
  mode?: 'serial' | 'parallel';
}

export interface NotificationAction {
  type: 'notification';
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface ExecuteRuleAction {
  type: 'execute_rule';
  ruleId: string;
}

// Union of all action types
export type RuleAction =
  | DeviceCommandAction
  | DelayAction
  | SequenceAction
  | NotificationAction
  | ExecuteRuleAction;

// =============================================================================
// Rule Definition
// =============================================================================

export interface Rule {
  id: RuleId;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;  // Lower number = higher priority (1-100)

  // When to trigger
  triggers: RuleTrigger[];

  // Additional conditions (optional, AND with triggers)
  conditions?: RuleCondition[];

  // What to do
  actions: RuleAction[];

  // Metadata
  createdAt: string;  // ISO 8601
  updatedAt: string;
  lastExecutedAt?: string;
  executionCount: number;

  // Source tracking
  createdBy: 'user' | 'llm' | 'system';
  llmPrompt?: string;  // Original prompt if created by LLM
}

// =============================================================================
// Rule Execution Types
// =============================================================================

export interface RuleExecutionContext {
  triggeredBy: 'event' | 'manual' | 'schedule' | 'rule_chain';
  triggerEvent?: {
    type: string;
    deviceId?: string;
    value?: unknown;
    timestamp: string;
  };
  variables: Record<string, unknown>;
}

export interface RuleExecutionResult {
  ruleId: RuleId;
  ruleName: string;
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  triggeredBy: RuleExecutionContext['triggeredBy'];
  actionsExecuted: number;
  actionResults: ActionResult[];
  error?: string;
}

export interface ActionResult {
  actionType: RuleAction['type'];
  success: boolean;
  deviceId?: string;
  command?: string;
  error?: string;
  durationMs: number;
}

// =============================================================================
// Storage Types
// =============================================================================

export interface RulesStorage {
  version: string;
  rules: Rule[];
  lastModified: string;
}

// =============================================================================
// API Types
// =============================================================================

export interface CreateRuleRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  triggers: RuleTrigger[];
  conditions?: RuleCondition[];
  actions: RuleAction[];
}

export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  triggers?: RuleTrigger[];
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}

export interface GenerateRuleRequest {
  prompt: string;
  context?: {
    availableDevices?: Array<{ id: string; name: string; capabilities: string[] }>;
  };
}

// =============================================================================
// Type Guards
// =============================================================================

export function isDeviceStateTrigger(trigger: RuleTrigger): trigger is DeviceStateTrigger {
  return trigger.type === 'device_state';
}

export function isDeviceCommandAction(action: RuleAction): action is DeviceCommandAction {
  return action.type === 'device_command';
}

export function isCompoundCondition(condition: RuleCondition): condition is CompoundCondition {
  return condition.type === 'and' || condition.type === 'or';
}

export function isTimeTrigger(trigger: RuleTrigger): trigger is TimeTrigger {
  return trigger.type === 'time';
}

export function isAstronomicalTrigger(trigger: RuleTrigger): trigger is AstronomicalTrigger {
  return trigger.type === 'astronomical';
}

export function isCronTrigger(trigger: RuleTrigger): trigger is CronTrigger {
  return trigger.type === 'cron';
}

export function isDelayAction(action: RuleAction): action is DelayAction {
  return action.type === 'delay';
}

export function isSequenceAction(action: RuleAction): action is SequenceAction {
  return action.type === 'sequence';
}

export function isNotificationAction(action: RuleAction): action is NotificationAction {
  return action.type === 'notification';
}

export function isExecuteRuleAction(action: RuleAction): action is ExecuteRuleAction {
  return action.type === 'execute_rule';
}

export function isDeviceStateCondition(condition: RuleCondition): condition is DeviceStateCondition {
  return condition.type === 'device_state';
}

export function isTimeCondition(condition: RuleCondition): condition is TimeCondition {
  return condition.type === 'time';
}

export function isNotCondition(condition: RuleCondition): condition is NotCondition {
  return condition.type === 'not';
}
