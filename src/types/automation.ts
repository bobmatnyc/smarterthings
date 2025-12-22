/**
 * Automation and rule building type definitions.
 *
 * Ticket: 1M-411 - Phase 4.1: Implement automation script building MCP tools
 *
 * Types for creating and managing SmartThings automation rules via Rules API.
 * Supports 6 common automation templates with device capability requirements.
 *
 * @module types/automation
 */

/**
 * Automation template scenarios.
 *
 * Each template defines a common automation pattern with specific
 * device capability requirements and configuration options.
 */
export type AutomationTemplate =
  | 'motion_lights' // Motion-activated lights
  | 'door_notification' // Door/window notifications
  | 'temperature_control' // Temperature-based HVAC control
  | 'scheduled_action' // Time-based scheduled actions
  | 'sunrise_sunset' // Sunrise/sunset triggers
  | 'battery_alert'; // Low battery notifications

/**
 * Trigger type for automation conditions.
 */
export type TriggerMode = 'Auto' | 'Always' | 'Never';

/**
 * Action sequence execution mode.
 */
export type ActionSequence = 'Serial' | 'Parallel';

/**
 * Time reference for scheduling.
 */
export type TimeReference = 'Now' | 'Midnight' | 'Sunrise' | 'Noon' | 'Sunset';

/**
 * Day of week for schedules.
 */
export type DayOfWeek = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/**
 * Interval unit for delays and durations.
 */
export type IntervalUnit = 'Second' | 'Minute' | 'Hour' | 'Day' | 'Week' | 'Month' | 'Year';

/**
 * Rule execution result status.
 */
export type ExecutionResultStatus = 'Success' | 'Failure' | 'Ignored';

/**
 * Comparison operator for conditions.
 */
export type ComparisonOperator =
  | 'equals'
  | 'greaterThan'
  | 'greaterThanOrEquals'
  | 'lessThan'
  | 'lessThanOrEquals'
  | 'between';

/**
 * Configuration for creating an automation rule.
 *
 * High-level configuration that will be transformed into SmartThings Rule structure.
 */
export interface AutomationConfig {
  /** Rule name (max 100 characters) */
  name: string;

  /** Location UUID where rule will be created */
  locationId: string;

  /** Template scenario to use (determines structure) */
  template: AutomationTemplate;

  /** Trigger device configuration */
  trigger: TriggerDeviceConfig;

  /** Action device configuration */
  action: ActionDeviceConfig;

  /** Optional conditions for execution */
  conditions?: ConditionConfig[];

  /** Optional delay before action execution (in seconds) */
  delaySeconds?: number;

  /** Optional timezone override (Java timezone ID) */
  timeZoneId?: string;
}

/**
 * Trigger device configuration.
 *
 * Defines which device attribute change triggers the automation.
 */
export interface TriggerDeviceConfig {
  /** Device UUID to monitor */
  deviceId: string;

  /** Capability to monitor (e.g., 'motionSensor', 'contactSensor') */
  capability: string;

  /** Attribute to watch (e.g., 'motion', 'contact') */
  attribute: string;

  /** Value that triggers the rule (e.g., 'active', 'open') */
  value: string | number | boolean;

  /** Comparison operator (default: 'equals') */
  operator?: ComparisonOperator;

  /** Component ID (default: 'main') */
  component?: string;
}

/**
 * Action device configuration.
 *
 * Defines what command to execute on target device.
 */
export interface ActionDeviceConfig {
  /** Device UUID to control */
  deviceId: string;

  /** Capability to use (e.g., 'switch', 'switchLevel') */
  capability: string;

  /** Command to execute (e.g., 'on', 'off', 'setLevel') */
  command: string;

  /** Command arguments (e.g., [75] for setLevel) */
  arguments?: Array<string | number | boolean>;

  /** Component ID (default: 'main') */
  component?: string;
}

/**
 * Additional condition configuration.
 *
 * Adds extra checks beyond the main trigger.
 */
export interface ConditionConfig {
  /** Device UUID to check */
  deviceId: string;

  /** Capability to check */
  capability: string;

  /** Attribute to check */
  attribute: string;

  /** Expected value */
  value: string | number | boolean;

  /** Comparison operator (default: 'equals') */
  operator?: ComparisonOperator;

  /** Component ID (default: 'main') */
  component?: string;
}

/**
 * Scheduled action configuration.
 *
 * For time-based automation templates.
 */
export interface ScheduleConfig {
  /** Time reference (e.g., 'Sunrise', 'Sunset', 'Midnight') */
  reference: TimeReference;

  /** Offset from reference in minutes (positive or negative) */
  offsetMinutes?: number;

  /** Days of week to run (omit for every day) */
  daysOfWeek?: DayOfWeek[];

  /** Timezone override */
  timeZoneId?: string;
}

/**
 * Template metadata and requirements.
 *
 * Defines what capabilities are required for each template.
 */
export interface TemplateMetadata {
  /** Template identifier */
  template: AutomationTemplate;

  /** Human-readable template name */
  name: string;

  /** Template description */
  description: string;

  /** Required trigger device capabilities */
  requiredTriggerCapabilities: string[];

  /** Required action device capabilities */
  requiredActionCapabilities: string[];

  /** Example configuration for this template */
  exampleConfig: Partial<AutomationConfig>;
}

/**
 * Rule execution result from SmartThings API.
 */
export interface RuleExecutionResponse {
  /** Execution UUID */
  executionId: string;

  /** Rule UUID */
  id: string;

  /** Overall execution result */
  result: ExecutionResultStatus;

  /** Individual action results */
  actions?: ActionExecutionResult[];
}

/**
 * Individual action execution result.
 */
export interface ActionExecutionResult {
  /** Action identifier */
  actionId: string;

  /** If action result */
  if?: IfActionExecutionResult;

  /** Location action result */
  location?: LocationActionExecutionResult;

  /** Command action results */
  command?: CommandActionExecutionResult[];

  /** Sleep action result */
  sleep?: SleepActionExecutionResult;
}

/**
 * If action execution result.
 */
export interface IfActionExecutionResult {
  /** Condition evaluation result */
  conditionResult: boolean;

  /** Then branch results (if condition was true) */
  then?: ActionExecutionResult[];

  /** Else branch results (if condition was false) */
  else?: ActionExecutionResult[];
}

/**
 * Location action execution result.
 */
export interface LocationActionExecutionResult {
  /** Result status */
  result: ExecutionResultStatus;

  /** Location UUID */
  locationId: string;

  /** Mode that was set */
  mode?: string;
}

/**
 * Command action execution result.
 */
export interface CommandActionExecutionResult {
  /** Result status */
  result: 'Success' | 'Failure' | 'Offline';

  /** Device UUID */
  deviceId: string;
}

/**
 * Sleep action execution result.
 */
export interface SleepActionExecutionResult {
  /** Result status */
  result: ExecutionResultStatus;

  /** Duration that was slept (in milliseconds) */
  duration: number;
}

/**
 * Validation result for automation configuration.
 */
export interface ValidationResult {
  /** Whether configuration is valid */
  valid: boolean;

  /** Validation error messages (if any) */
  errors: string[];

  /** Validation warnings (non-blocking) */
  warnings: string[];
}

/**
 * Template availability for a location.
 *
 * Used to determine which templates can be used based on available devices.
 */
export interface TemplateAvailability {
  /** Template identifier */
  template: AutomationTemplate;

  /** Whether template is available (has required devices) */
  available: boolean;

  /** Devices that can be used for triggers */
  triggerDevices: Array<{ deviceId: string; name: string; capabilities: string[] }>;

  /** Devices that can be used for actions */
  actionDevices: Array<{ deviceId: string; name: string; capabilities: string[] }>;

  /** Reason why template is unavailable (if applicable) */
  unavailableReason?: string;
}
