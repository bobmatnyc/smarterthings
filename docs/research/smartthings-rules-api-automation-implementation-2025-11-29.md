# SmartThings Rules API and Automation Implementation Research

**Research Date:** 2025-11-29
**Ticket:** 1M-411 - Phase 4.1: Implement automation script building MCP tools
**Priority:** High
**Estimated Effort:** 5 days
**Deliverables:** 6 MCP tools + 6 automation templates
**Related Architecture:** docs/research/dual-mode-mcp-architecture-2025-11-29.md

---

## Executive Summary

This research provides comprehensive analysis of SmartThings Rules API and implementation patterns for Phase 4.1 automation MCP tools. The project already has robust automation infrastructure (AutomationService, SmartThingsAdapter with Rules API integration), requiring only:

1. **Expose existing Rules API methods** - create, update, delete, execute
2. **Create 6 MCP automation tools** - Implementing handler functions following established patterns
3. **Develop 6 automation templates** - Common scenarios with device capability requirements
4. **Add Zod validation schemas** - Input validation for automation configurations

**Key Findings:**

✅ **AutomationService** already implements:
- Rule listing and caching (5-minute TTL, <10ms cache hits)
- Device-to-rule indexing for fast lookup
- Rule detail queries

⚠️ **SmartThingsAdapter** has Rules API access but methods not exposed:
- SDK supports `rules.create()`, `rules.update()`, `rules.delete()`, `rules.execute()`
- Need to add wrapper methods with error handling and retry logic

✅ **MCP Tool Patterns** are well-established:
- Handler functions with Zod validation
- ServiceContainer dependency injection
- Consistent error handling via `createMcpError()`
- Tool metadata registration in `server.ts`

**SmartThings Rules API Structure:**

```typescript
interface Rule {
  id: string;                    // UUID
  name: string;                  // Rule name (max 100 chars)
  actions: RuleAction[];         // Action tree (executed when triggered)
  sequence?: RuleActionSequence; // Serial (default) | Parallel
  timeZoneId?: string;           // Override location timezone
  status?: 'Enabled' | 'Disabled';
  executionLocation?: 'Cloud' | 'Local';
}

type RuleAction =
  | { command: CommandAction }   // Device commands
  | { if: IfAction }             // Conditional logic
  | { sleep: SleepAction }       // Delay execution
  | { every: EveryAction }       // Recurring actions
  | { location: LocationAction }; // Location mode changes

interface CommandAction {
  devices: string[];             // Device UUIDs
  commands: DeviceCommand[];     // Commands to execute
  sequence?: CommandSequence;    // Execution order
}

interface DeviceCommand {
  component: string;             // default: 'main'
  capability: string;            // e.g., 'switch', 'switchLevel'
  command: string;               // e.g., 'on', 'setLevel'
  arguments?: RuleOperand[];     // Command arguments
}
```

**Triggers vs Conditions:**

- **Triggers**: Device operands with `trigger: 'Always'` or `trigger: 'Auto'`
- **Conditions**: Additional checks evaluated during execution
- **Auto-detection**: SDK automatically determines which conditions should trigger (default)

**Implementation Recommendations:**

1. **Phase 4.1a (2 days)**: Add Rules API methods to SmartThingsAdapter and AutomationService
2. **Phase 4.1b (2 days)**: Implement 6 MCP automation tools with Zod schemas
3. **Phase 4.1c (1 day)**: Create 6 automation templates and integration tests

**Total Effort:** 5 days (matches ticket estimate)

---

## Table of Contents

1. [Current Automation Code Analysis](#1-current-automation-code-analysis)
2. [SmartThings Rules API Structure](#2-smartthings-rules-api-structure)
3. [Existing MCP Tool Patterns](#3-existing-mcp-tool-patterns)
4. [Automation Template Specifications](#4-automation-template-specifications)
5. [Tool Implementation Patterns](#5-tool-implementation-patterns)
6. [Zod Schema Definitions](#6-zod-schema-definitions)
7. [File Modification Plan](#7-file-modification-plan)
8. [Integration Points](#8-integration-points)
9. [Testing Strategy](#9-testing-strategy)
10. [Implementation Recommendations](#10-implementation-recommendations)

---

## 1. Current Automation Code Analysis

### 1.1 AutomationService.ts - Existing Capabilities

**File:** `src/services/AutomationService.ts` (444 lines)

**Current Implementation:**

```typescript
export class AutomationService {
  private cache: Map<LocationId, CachedLocationRules> = new Map();
  private readonly CACHE_TTL_MS: number;

  constructor(private adapter: SmartThingsAdapter) {
    this.CACHE_TTL_MS = parseInt(process.env['AUTOMATION_CACHE_TTL_MS'] || '300000', 10);
  }

  // ✅ IMPLEMENTED: Query operations
  async listRules(locationId: LocationId): Promise<Rule[]>
  async getRule(ruleId: string, locationId: LocationId): Promise<Rule | null>
  async findRulesForDevice(deviceId: DeviceId, locationId: LocationId): Promise<RuleMatch[]>
  clearCache(locationId?: LocationId): void

  // ⚠️ NOT IMPLEMENTED: Mutation operations
  // async createRule(locationId: LocationId, rule: RuleRequest): Promise<Rule>
  // async updateRule(ruleId: string, locationId: LocationId, updates: Partial<Rule>): Promise<Rule>
  // async deleteRule(ruleId: string, locationId: LocationId): Promise<void>
  // async executeRule(ruleId: string, locationId: LocationId): Promise<RuleExecutionResponse>
}
```

**Key Design Decisions:**

- **Caching Strategy**: 5-minute TTL with device-to-rule indexing
  - Cache hit: O(1) lookup, <10ms
  - Cache miss: O(R×A) where R=rules, A=actions per rule, ~500ms
  - Memory footprint: ~100KB per location

- **Device Index Building**:
  ```typescript
  private buildDeviceIndex(rules: Rule[]): Map<DeviceId, RuleMatch[]> {
    // Scans rule actions for device references
    // Creates Map<DeviceId, RuleMatch[]> for O(1) device lookups
  }
  ```

- **Error Handling**: Graceful degradation on API failures (non-blocking diagnostic workflows)

**What Needs to Be Added:**

```typescript
// Add to AutomationService.ts
async createRule(locationId: LocationId, rule: RuleRequest): Promise<Rule> {
  const createdRule = await this.adapter.createRule(locationId as string, rule);
  this.clearCache(locationId); // Invalidate cache
  return createdRule;
}

async updateRule(ruleId: string, locationId: LocationId, updates: Partial<Rule>): Promise<Rule> {
  const updatedRule = await this.adapter.updateRule(ruleId, locationId as string, updates);
  this.clearCache(locationId);
  return updatedRule;
}

async deleteRule(ruleId: string, locationId: LocationId): Promise<void> {
  await this.adapter.deleteRule(ruleId, locationId as string);
  this.clearCache(locationId);
}

async executeRule(ruleId: string, locationId: LocationId): Promise<RuleExecutionResponse> {
  return await this.adapter.executeRule(ruleId, locationId as string);
}
```

### 1.2 SmartThingsAdapter.ts - Rules API Integration

**File:** `src/platforms/smartthings/SmartThingsAdapter.ts` (1307 lines)

**Current Implementation:**

```typescript
export class SmartThingsAdapter extends EventEmitter implements IDeviceAdapter {
  private client: SmartThingsClient | null = null;

  // ✅ IMPLEMENTED: Read operations (lines 947-1024)
  async listRules(locationId: string): Promise<Rule[]> {
    return await this.client!.rules.list(locationId);
  }

  async getRule(ruleId: string, locationId: string): Promise<Rule> {
    return await this.client!.rules.get(ruleId, locationId);
  }

  // ⚠️ NOT IMPLEMENTED: Mutation operations
  // SmartThings SDK supports:
  // - this.client!.rules.create(data: RuleRequest, locationId?: string)
  // - this.client!.rules.update(id: string, data: RuleRequest, locationId?: string)
  // - this.client!.rules.delete(id: string, locationId?: string)
  // - this.client!.rules.execute(id: string, locationId?: string)
}
```

**SmartThings SDK Version:** `@smartthings/core-sdk@8.4.1`

**SDK Rules API Methods:**

```typescript
// From node_modules/@smartthings/core-sdk/dist/endpoint/rules.d.ts
export declare class RulesEndpoint extends Endpoint {
  list(locationId?: string): Promise<Rule[]>;
  get(id: string, locationId?: string): Promise<Rule>;
  delete(id: string, locationId?: string): Promise<Rule>;
  create(data: RuleRequest, locationId?: string): Promise<Rule>;
  update(id: string, data: RuleRequest, locationId?: string): Promise<Rule>;
  execute(id: string, locationId?: string): Promise<RuleExecutionResponse>;
}
```

**What Needs to Be Added:**

```typescript
// Add to SmartThingsAdapter.ts (after line 1024)
async createRule(locationId: string, rule: RuleRequest): Promise<Rule> {
  this.ensureInitialized();

  logger.debug('Creating rule', { platform: this.platform, locationId, ruleName: rule.name });

  try {
    const createdRule = await retryWithBackoff(async () => {
      return await this.client!.rules.create(rule, locationId);
    });

    this.lastHealthCheck = new Date();
    this.errorCount = 0;

    logger.info('Rule created successfully', {
      platform: this.platform,
      ruleId: createdRule.id,
      locationId,
    });

    return createdRule;
  } catch (error) {
    const wrappedError = this.wrapError(error, 'createRule', { locationId, rule });
    this.errorCount++;
    this.emitError(wrappedError, 'createRule');
    throw wrappedError;
  }
}

async updateRule(ruleId: string, locationId: string, updates: RuleRequest): Promise<Rule> {
  this.ensureInitialized();

  logger.debug('Updating rule', { platform: this.platform, ruleId, locationId });

  try {
    const updatedRule = await retryWithBackoff(async () => {
      return await this.client!.rules.update(ruleId, updates, locationId);
    });

    this.lastHealthCheck = new Date();
    this.errorCount = 0;

    logger.info('Rule updated successfully', {
      platform: this.platform,
      ruleId,
      locationId,
    });

    return updatedRule;
  } catch (error) {
    const wrappedError = this.wrapError(error, 'updateRule', { ruleId, locationId });
    this.errorCount++;
    this.emitError(wrappedError, 'updateRule');
    throw wrappedError;
  }
}

async deleteRule(ruleId: string, locationId: string): Promise<void> {
  this.ensureInitialized();

  logger.debug('Deleting rule', { platform: this.platform, ruleId, locationId });

  try {
    await retryWithBackoff(async () => {
      await this.client!.rules.delete(ruleId, locationId);
    });

    this.lastHealthCheck = new Date();
    this.errorCount = 0;

    logger.info('Rule deleted successfully', {
      platform: this.platform,
      ruleId,
      locationId,
    });
  } catch (error) {
    const wrappedError = this.wrapError(error, 'deleteRule', { ruleId, locationId });
    this.errorCount++;
    this.emitError(wrappedError, 'deleteRule');
    throw wrappedError;
  }
}

async executeRule(ruleId: string, locationId: string): Promise<RuleExecutionResponse> {
  this.ensureInitialized();

  logger.debug('Executing rule', { platform: this.platform, ruleId, locationId });

  try {
    const executionResult = await retryWithBackoff(async () => {
      return await this.client!.rules.execute(ruleId, locationId);
    });

    this.lastHealthCheck = new Date();
    this.errorCount = 0;

    logger.info('Rule executed successfully', {
      platform: this.platform,
      ruleId,
      executionId: executionResult.executionId,
      result: executionResult.result,
    });

    return executionResult;
  } catch (error) {
    const wrappedError = this.wrapError(error, 'executeRule', { ruleId, locationId });
    this.errorCount++;
    this.emitError(wrappedError, 'executeRule');
    throw wrappedError;
  }
}
```

**Pattern Consistency:**

- ✅ Uses `retryWithBackoff` for transient failure handling
- ✅ Calls `ensureInitialized()` for safety checks
- ✅ Updates `lastHealthCheck` and `errorCount` tracking
- ✅ Wraps errors with `wrapError()` for standardization
- ✅ Emits error events via `emitError()`
- ✅ Logs debug and info messages

---

## 2. SmartThings Rules API Structure

### 2.1 Rule Data Model

**Core Rule Structure:**

```typescript
interface Rule {
  id: string;                    // UUID - Unique rule identifier
  name: string;                  // Human-readable name (max 100 chars)
  actions: RuleAction[];         // Action tree (evaluated when triggered)
  sequence?: RuleActionSequence; // Serial (default) | Parallel
  timeZoneId?: string;           // Java timezone ID (overrides location)

  // Metadata (read-only)
  ownerType: 'Location' | 'User';
  ownerId: string;
  dateCreated: string;
  dateUpdated: string;
  status?: 'Enabled' | 'Disabled';
  executionLocation?: 'Cloud' | 'Local';
  creator?: 'SMARTTHINGS' | 'ARB' | 'RECIPE' | 'UNDEFINED';
}

interface RuleRequest {
  name: string;
  actions: RuleAction[];
  sequence?: RuleActionSequence;
  timeZoneId?: string;
}
```

### 2.2 Rule Actions

**Action Types:**

```typescript
type RuleAction =
  | { command: CommandAction }   // Execute device commands
  | { if: IfAction }             // Conditional branching
  | { sleep: SleepAction }       // Delay execution
  | { every: EveryAction }       // Recurring actions (schedule)
  | { location: LocationAction }; // Change location mode

// 1. Command Action - Most common for automations
interface CommandAction {
  devices: string[];             // Device UUIDs to control
  commands: DeviceCommand[];     // Commands to execute
  sequence?: CommandSequence;    // commands: Serial/Parallel, devices: Serial/Parallel
}

interface DeviceCommand {
  component: string;             // Component ID (default: 'main')
  capability: string;            // Capability ID (e.g., 'switch', 'switchLevel')
  command: string;               // Command name (e.g., 'on', 'off', 'setLevel')
  arguments?: RuleOperand[];     // Command arguments (typed)
}

// 2. If Action - Conditional logic
interface IfAction extends RuleCondition {
  then?: RuleAction[];           // Actions if condition true
  else?: RuleAction[];           // Actions if condition false
  sequence?: IfActionSequence;   // then/else sequence modes
}

// 3. Sleep Action - Delay
interface SleepAction {
  duration: RuleInterval;        // { value: RuleOperand, unit: IntervalUnit }
}

// 4. Every Action - Recurring schedule
interface EveryAction {
  interval?: RuleInterval;       // Recurring interval
  specific?: DateTimeOperand;    // Specific time (cron-like)
  actions: RuleAction[];         // Actions to repeat
  sequence?: RuleActionSequence;
}

// 5. Location Action - Mode changes
interface LocationAction {
  locationId: string;            // Location UUID (required for user-level rules)
  mode?: string;                 // Mode ID to set
}
```

### 2.3 Triggers and Conditions

**Key Concept:** Triggers are device operands with `trigger` property set.

```typescript
interface DeviceOperand {
  devices: string[];             // Device UUIDs to monitor
  component: string;             // Component ID (default: 'main')
  capability: string;            // Capability to monitor
  attribute: string;             // Attribute to watch (e.g., 'switch', 'motion')
  path?: string;                 // JSON path for nested attributes
  aggregation?: 'None';          // Aggregation mode for multiple devices
  trigger?: 'Auto' | 'Always' | 'Never'; // Trigger mode (default: Auto)
}

// Trigger Modes:
// - Auto: SDK determines if this should trigger (smart detection)
// - Always: This operand always triggers the rule
// - Never: This operand never triggers (condition only)

// Example: Motion-activated lights
{
  if: {
    equals: {
      left: {
        device: {
          devices: ['motion-sensor-uuid'],
          component: 'main',
          capability: 'motionSensor',
          attribute: 'motion',
          trigger: 'Always'  // This triggers the rule
        }
      },
      right: { string: 'active' }
    },
    then: [
      {
        command: {
          devices: ['light-uuid'],
          commands: [{
            component: 'main',
            capability: 'switch',
            command: 'on'
          }]
        }
      }
    ]
  }
}
```

**Condition Operators:**

```typescript
interface RuleCondition {
  // Logical operators
  and?: RuleCondition[];
  or?: RuleCondition[];
  not?: RuleCondition;

  // Comparison operators
  equals?: SimpleCondition;
  greaterThan?: SimpleCondition;
  greaterThanOrEquals?: SimpleCondition;
  lessThan?: SimpleCondition;
  lessThanOrEquals?: SimpleCondition;
  between?: BetweenCondition;

  // Temporal operators
  changes?: ChangesCondition;    // true when value transitions false→true
  remains?: RemainsCondition;    // true if condition holds for duration
  was?: WasCondition;            // true if condition was true within duration
}
```

### 2.4 Rule Operands

**Operand Types:**

```typescript
interface RuleOperand {
  boolean?: boolean;
  decimal?: number;
  integer?: number;
  string?: string;
  array?: ArrayOperand;
  map?: MapOperand;
  device?: DeviceOperand;        // Device attribute
  location?: LocationOperand;    // Location attribute
  date?: DateOperand;            // Date value
  time?: TimeOperand;            // Time value (with Sunrise/Sunset support)
  datetime?: DateTimeOperand;    // Combined date/time
}

// Time References (for schedules)
type TimeReference = 'Now' | 'Midnight' | 'Sunrise' | 'Noon' | 'Sunset';

// Time Operand (for sunrise/sunset triggers)
interface TimeOperand {
  timeZoneId?: string;
  daysOfWeek?: DayOfWeek[];      // ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  reference: TimeReference;      // Sunrise, Sunset, Midnight, etc.
  offset?: RuleInterval;         // Offset from reference (e.g., +30 minutes after sunrise)
}

// Interval (for delays and durations)
type IntervalUnit = 'Second' | 'Minute' | 'Hour' | 'Day' | 'Week' | 'Month' | 'Year';

interface RuleInterval {
  value: RuleOperand;
  unit: IntervalUnit;
}
```

### 2.5 Rule Execution

**Execute Rule Response:**

```typescript
interface RuleExecutionResponse {
  executionId: string;           // Execution UUID
  id: string;                    // Rule UUID
  result: 'Success' | 'Failure' | 'Ignored';
  actions?: ActionExecutionResult[];
}

interface ActionExecutionResult {
  actionId: string;
  if?: IfActionExecutionResult;
  location?: LocationActionExecutionResult;
  command?: CommandActionExecutionResult[];
  sleep?: SleepActionExecutionResult;
}

interface CommandActionExecutionResult {
  result: 'Success' | 'Failure' | 'Offline';
  deviceId: string;
}
```

---

## 3. Existing MCP Tool Patterns

### 3.1 Tool Module Structure

**Example:** `src/mcp/tools/device-control.ts` (200 lines)

```typescript
import { z } from 'zod';
import type { ServiceContainer } from '../../services/ServiceContainer.js';
import type { McpToolInput } from '../../types/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpResponse, createMcpError } from '../../types/mcp.js';
import { classifyError } from '../../utils/error-handler.js';
import { deviceIdSchema } from '../../utils/validation.js';

// 1. Service container (injected during initialization)
let serviceContainer: ServiceContainer;

// 2. Zod input schemas
const turnOnDeviceSchema = z.object({
  deviceId: deviceIdSchema,
});

// 3. Handler function
export async function handleTurnOnDevice(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { deviceId } = turnOnDeviceSchema.parse(input);

    await turnOn(deviceId as DeviceId);

    return createMcpResponse(`Device ${deviceId} turned on successfully`, {
      deviceId,
      action: 'turn_on',
      success: true,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

// 4. Initialization function
export function initializeDeviceControlTools(container: ServiceContainer): void {
  serviceContainer = container;
}

// 5. Tool metadata export
export const deviceControlTools = {
  turn_on_device: {
    description: 'Turn on a SmartThings device (requires switch capability)',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: {
          type: 'string',
          description: 'SmartThings device UUID',
        },
      },
      required: ['deviceId'],
    },
    handler: handleTurnOnDevice,
  },
} as const;
```

**Pattern Elements:**

1. ✅ **Zod Validation** - Type-safe input parsing
2. ✅ **Handler Functions** - Pure functions returning `CallToolResult`
3. ✅ **ServiceContainer Injection** - Dependency injection via `initialize*Tools()`
4. ✅ **Error Classification** - Standardized error codes
5. ✅ **MCP Response Format** - Consistent response structure
6. ✅ **Tool Metadata** - JSON Schema + description + handler

### 3.2 Tool Registration

**File:** `src/server.ts` (150 lines)

```typescript
import {
  deviceControlTools,
  deviceQueryTools,
  deviceEventTools,
  sceneTools,
  systemTools,
  managementTools,
  diagnosticTools,
  systemStatusTools,
  initializeDeviceControlTools,
  initializeDeviceQueryTools,
  initializeDeviceEventTools,
  initializeSceneTools,
  initializeManagementTools,
  initializeDiagnosticTools,
  initializeSystemStatusTools,
} from './mcp/tools/index.js';

export function createMcpServer(): Server {
  const serviceContainer = new ServiceContainer(smartThingsService);

  // Initialize all tool modules with ServiceContainer
  initializeDeviceControlTools(serviceContainer);
  initializeDeviceQueryTools(serviceContainer);
  initializeDeviceEventTools(serviceContainer);
  initializeSceneTools(serviceContainer);
  initializeManagementTools(serviceContainer);
  initializeDiagnosticTools(serviceContainer);
  initializeSystemStatusTools(serviceContainer);

  // Combine all tools
  const allTools = {
    ...deviceControlTools,
    ...deviceQueryTools,
    ...deviceEventTools,
    ...sceneTools,
    ...systemTools,
    ...managementTools,
    ...diagnosticTools,
    ...systemStatusTools,
  };

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.entries(allTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = allTools[name as keyof typeof allTools];

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return await tool.handler(args ?? {});
  });

  return server;
}
```

**To Add Automation Tools:**

1. Import `automationTools` and `initializeAutomationTools`
2. Call `initializeAutomationTools(serviceContainer)` during initialization
3. Spread `...automationTools` into `allTools` object

### 3.3 Error Handling Patterns

**Error Classification:**

```typescript
// src/utils/error-handler.ts
export function classifyError(error: unknown): string {
  if (error instanceof DeviceNotFoundError) return 'DEVICE_NOT_FOUND';
  if (error instanceof CapabilityNotSupportedError) return 'CAPABILITY_NOT_SUPPORTED';
  if (error instanceof NetworkError) return 'NETWORK_ERROR';
  if (error instanceof RateLimitError) return 'RATE_LIMIT_ERROR';
  if (error instanceof AuthenticationError) return 'AUTHENTICATION_ERROR';
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  if (error instanceof z.ZodError) return 'VALIDATION_ERROR';
  return 'UNKNOWN_ERROR';
}

export function createMcpError(error: unknown, errorCode: string): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Error [${errorCode}]: ${message}`,
      },
    ],
  };
}
```

---

## 4. Automation Template Specifications

### 4.1 Template 1: Motion-Activated Lights

**Scenario:** Turn on lights when motion detected, turn off after 5 minutes of no motion.

**Required Device Capabilities:**
- Trigger device: `motionSensor` capability
- Action device: `switch` capability

**Rule Structure:**

```typescript
{
  name: 'Motion-Activated Lights',
  actions: [
    {
      if: {
        equals: {
          left: {
            device: {
              devices: ['${MOTION_SENSOR_ID}'],
              component: 'main',
              capability: 'motionSensor',
              attribute: 'motion',
              trigger: 'Always'
            }
          },
          right: { string: 'active' }
        },
        then: [
          {
            command: {
              devices: ['${LIGHT_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'switch',
                command: 'on'
              }]
            }
          }
        ]
      }
    },
    {
      if: {
        and: [
          {
            equals: {
              left: {
                device: {
                  devices: ['${MOTION_SENSOR_ID}'],
                  component: 'main',
                  capability: 'motionSensor',
                  attribute: 'motion',
                  trigger: 'Always'
                }
              },
              right: { string: 'inactive' }
            }
          },
          {
            remains: {
              id: 'motion-inactive',
              duration: { value: { integer: 5 }, unit: 'Minute' },
              equals: {
                left: {
                  device: {
                    devices: ['${MOTION_SENSOR_ID}'],
                    component: 'main',
                    capability: 'motionSensor',
                    attribute: 'motion'
                  }
                },
                right: { string: 'inactive' }
              }
            }
          }
        ],
        then: [
          {
            command: {
              devices: ['${LIGHT_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'switch',
                command: 'off'
              }]
            }
          }
        ]
      }
    }
  ]
}
```

**Template Parameters:**

```typescript
interface MotionLightsParams {
  motionSensorId: string;        // Motion sensor device UUID
  lightDeviceId: string;         // Light device UUID
  inactivityTimeout?: number;    // Minutes (default: 5)
}
```

### 4.2 Template 2: Door/Window Notifications

**Scenario:** Send notification when door/window opened.

**Required Device Capabilities:**
- Trigger device: `contactSensor` capability

**Rule Structure:**

```typescript
{
  name: 'Door Open Notification',
  actions: [
    {
      if: {
        equals: {
          left: {
            device: {
              devices: ['${CONTACT_SENSOR_ID}'],
              component: 'main',
              capability: 'contactSensor',
              attribute: 'contact',
              trigger: 'Always'
            }
          },
          right: { string: 'open' }
        },
        then: [
          {
            command: {
              devices: ['${NOTIFICATION_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'notification',
                command: 'deviceNotification',
                arguments: [{ string: '${NOTIFICATION_MESSAGE}' }]
              }]
            }
          }
        ]
      }
    }
  ]
}
```

**Template Parameters:**

```typescript
interface DoorNotificationParams {
  contactSensorId: string;       // Door/window sensor UUID
  notificationDeviceId: string;  // Notification device (phone/speaker)
  message?: string;              // Notification message (default: "Door opened")
}
```

### 4.3 Template 3: Temperature Control

**Scenario:** Turn on fan when temperature exceeds threshold, turn off when below threshold.

**Required Device Capabilities:**
- Trigger device: `temperatureMeasurement` capability
- Action device: `switch` capability (for fan)

**Rule Structure:**

```typescript
{
  name: 'Temperature Control',
  actions: [
    {
      if: {
        greaterThan: {
          left: {
            device: {
              devices: ['${TEMPERATURE_SENSOR_ID}'],
              component: 'main',
              capability: 'temperatureMeasurement',
              attribute: 'temperature',
              trigger: 'Always'
            }
          },
          right: { decimal: ${TEMPERATURE_THRESHOLD} }
        },
        then: [
          {
            command: {
              devices: ['${FAN_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'switch',
                command: 'on'
              }]
            }
          }
        ]
      }
    },
    {
      if: {
        lessThan: {
          left: {
            device: {
              devices: ['${TEMPERATURE_SENSOR_ID}'],
              component: 'main',
              capability: 'temperatureMeasurement',
              attribute: 'temperature',
              trigger: 'Always'
            }
          },
          right: { decimal: ${TEMPERATURE_THRESHOLD} }
        },
        then: [
          {
            command: {
              devices: ['${FAN_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'switch',
                command: 'off'
              }]
            }
          }
        ]
      }
    }
  ]
}
```

**Template Parameters:**

```typescript
interface TemperatureControlParams {
  temperatureSensorId: string;   // Temperature sensor UUID
  fanDeviceId: string;           // Fan/switch device UUID
  threshold: number;             // Temperature threshold (°F or °C)
  unit?: 'F' | 'C';              // Temperature unit (default: F)
}
```

### 4.4 Template 4: Scheduled Actions

**Scenario:** Execute device commands at specific time every day.

**Required Device Capabilities:**
- Action device: `switch` capability (or any controllable device)

**Rule Structure:**

```typescript
{
  name: 'Scheduled Action',
  actions: [
    {
      every: {
        specific: {
          timeZoneId: '${TIMEZONE_ID}',
          daysOfWeek: ${DAYS_OF_WEEK},
          reference: 'Midnight',
          offset: {
            value: { integer: ${HOUR_OFFSET} },
            unit: 'Hour'
          }
        },
        actions: [
          {
            command: {
              devices: ['${DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: '${CAPABILITY}',
                command: '${COMMAND}'
              }]
            }
          }
        ]
      }
    }
  ]
}
```

**Template Parameters:**

```typescript
interface ScheduledActionParams {
  deviceId: string;              // Device UUID
  capability: string;            // Device capability (e.g., 'switch')
  command: string;               // Command to execute (e.g., 'on')
  hour: number;                  // Hour (0-23)
  minute?: number;               // Minute (0-59, default: 0)
  daysOfWeek?: DayOfWeek[];      // Days to run (default: all days)
  timeZoneId?: string;           // Timezone (default: location timezone)
}
```

### 4.5 Template 5: Sunrise/Sunset Triggers

**Scenario:** Turn on lights at sunset, turn off at sunrise.

**Required Device Capabilities:**
- Action device: `switch` capability

**Rule Structure:**

```typescript
{
  name: 'Sunrise/Sunset Automation',
  actions: [
    {
      every: {
        specific: {
          timeZoneId: '${TIMEZONE_ID}',
          locationId: '${LOCATION_ID}',
          reference: 'Sunset',
          offset: {
            value: { integer: ${SUNSET_OFFSET} },
            unit: 'Minute'
          }
        },
        actions: [
          {
            command: {
              devices: ['${LIGHT_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'switch',
                command: 'on'
              }]
            }
          }
        ]
      }
    },
    {
      every: {
        specific: {
          timeZoneId: '${TIMEZONE_ID}',
          locationId: '${LOCATION_ID}',
          reference: 'Sunrise',
          offset: {
            value: { integer: ${SUNRISE_OFFSET} },
            unit: 'Minute'
          }
        },
        actions: [
          {
            command: {
              devices: ['${LIGHT_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'switch',
                command: 'off'
              }]
            }
          }
        ]
      }
    }
  ]
}
```

**Template Parameters:**

```typescript
interface SunriseSunsetParams {
  lightDeviceId: string;         // Light device UUID
  locationId: string;            // Location UUID (for sunrise/sunset calculation)
  sunsetOffset?: number;         // Minutes before/after sunset (default: 0)
  sunriseOffset?: number;        // Minutes before/after sunrise (default: 0)
  timeZoneId?: string;           // Timezone (default: location timezone)
}
```

### 4.6 Template 6: Battery Alerts

**Scenario:** Send notification when device battery drops below threshold.

**Required Device Capabilities:**
- Trigger device: `battery` capability

**Rule Structure:**

```typescript
{
  name: 'Battery Alert',
  actions: [
    {
      if: {
        lessThan: {
          left: {
            device: {
              devices: ['${DEVICE_ID}'],
              component: 'main',
              capability: 'battery',
              attribute: 'battery',
              trigger: 'Always'
            }
          },
          right: { integer: ${BATTERY_THRESHOLD} }
        },
        then: [
          {
            command: {
              devices: ['${NOTIFICATION_DEVICE_ID}'],
              commands: [{
                component: 'main',
                capability: 'notification',
                command: 'deviceNotification',
                arguments: [
                  { string: 'Battery low on ${DEVICE_NAME}: ${battery}%' }
                ]
              }]
            }
          }
        ]
      }
    }
  ]
}
```

**Template Parameters:**

```typescript
interface BatteryAlertParams {
  deviceId: string;              // Device UUID to monitor
  deviceName?: string;           // Device name for notification
  notificationDeviceId: string;  // Notification device UUID
  threshold?: number;            // Battery percentage threshold (default: 20)
}
```

---

## 5. Tool Implementation Patterns

### 5.1 Tool 1: create_automation

**Purpose:** Create a new SmartThings automation rule.

**Handler Signature:**

```typescript
export async function handleCreateAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const config = createAutomationSchema.parse(input);

    const automationService = serviceContainer.getAutomationService();

    // Build SmartThings Rule from config
    const rule: RuleRequest = buildRuleFromConfig(config);

    // Create rule via AutomationService
    const createdRule = await automationService.createRule(
      config.locationId as LocationId,
      rule
    );

    return createMcpResponse(`Automation "${config.name}" created successfully`, {
      ruleId: createdRule.id,
      name: createdRule.name,
      status: createdRule.status,
      executionLocation: createdRule.executionLocation,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}
```

**Input Schema (Zod):**

See section 6.1 for detailed schema.

**Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Automation \"Motion Lights\" created successfully"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "smartthings://rule/abc-123-def",
        "mimeType": "application/json",
        "text": "{\"ruleId\":\"abc-123-def\",\"name\":\"Motion Lights\",\"status\":\"Enabled\"}"
      }
    }
  ]
}
```

### 5.2 Tool 2: update_automation

**Purpose:** Update existing automation rule.

**Handler Signature:**

```typescript
export async function handleUpdateAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { ruleId, locationId, ...updates } = updateAutomationSchema.parse(input);

    const automationService = serviceContainer.getAutomationService();

    // Fetch existing rule
    const existingRule = await automationService.getRule(ruleId, locationId as LocationId);
    if (!existingRule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    // Build updated rule request
    const updatedRule: RuleRequest = {
      name: updates.name ?? existingRule.name,
      actions: updates.actions ? buildActionsFromConfig(updates.actions) : existingRule.actions,
      sequence: updates.sequence,
      timeZoneId: updates.timeZoneId,
    };

    // Update rule
    const result = await automationService.updateRule(
      ruleId,
      locationId as LocationId,
      updatedRule
    );

    return createMcpResponse(`Automation "${result.name}" updated successfully`, {
      ruleId: result.id,
      name: result.name,
      status: result.status,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}
```

### 5.3 Tool 3: delete_automation

**Purpose:** Delete automation rule.

**Handler Signature:**

```typescript
export async function handleDeleteAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { ruleId, locationId } = deleteAutomationSchema.parse(input);

    const automationService = serviceContainer.getAutomationService();

    // Fetch rule name before deletion
    const rule = await automationService.getRule(ruleId, locationId as LocationId);
    const ruleName = rule?.name ?? 'Unknown';

    // Delete rule
    await automationService.deleteRule(ruleId, locationId as LocationId);

    return createMcpResponse(`Automation "${ruleName}" deleted successfully`, {
      ruleId,
      locationId,
      deleted: true,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}
```

### 5.4 Tool 4: test_automation

**Purpose:** Validate automation configuration without creating it.

**Handler Signature:**

```typescript
export async function handleTestAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const config = testAutomationSchema.parse(input);

    const deviceService = serviceContainer.getDeviceService();

    const validationErrors: string[] = [];

    // Validate trigger devices
    for (const trigger of config.triggers) {
      const device = await deviceService.getDevice(trigger.deviceId as DeviceId);
      if (!device) {
        validationErrors.push(`Trigger device ${trigger.deviceId} not found`);
        continue;
      }

      const hasCapability = device.capabilities?.some(c =>
        c === trigger.capability ||
        mapCapabilityToUnified(trigger.capability) === c
      );
      if (!hasCapability) {
        validationErrors.push(
          `Device ${device.name} does not support ${trigger.capability}`
        );
      }
    }

    // Validate action devices
    for (const action of config.actions) {
      const device = await deviceService.getDevice(action.deviceId as DeviceId);
      if (!device) {
        validationErrors.push(`Action device ${action.deviceId} not found`);
        continue;
      }

      const hasCapability = device.capabilities?.some(c =>
        c === action.capability ||
        mapCapabilityToUnified(action.capability) === c
      );
      if (!hasCapability) {
        validationErrors.push(
          `Device ${device.name} does not support ${action.capability}`
        );
      }
    }

    if (validationErrors.length > 0) {
      return createMcpResponse('Automation validation failed', {
        valid: false,
        errors: validationErrors,
      });
    }

    return createMcpResponse('Automation validation successful', {
      valid: true,
      triggers: config.triggers.length,
      actions: config.actions.length,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}
```

### 5.5 Tool 5: execute_automation

**Purpose:** Manually trigger automation rule execution.

**Handler Signature:**

```typescript
export async function handleExecuteAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { ruleId, locationId } = executeAutomationSchema.parse(input);

    const automationService = serviceContainer.getAutomationService();

    // Execute rule
    const executionResult = await automationService.executeRule(
      ruleId,
      locationId as LocationId
    );

    return createMcpResponse(`Automation executed (${executionResult.result})`, {
      executionId: executionResult.executionId,
      ruleId: executionResult.id,
      result: executionResult.result,
      actions: executionResult.actions?.map(a => ({
        actionId: a.actionId,
        commandResults: a.command?.map(c => ({
          deviceId: c.deviceId,
          result: c.result,
        })),
      })),
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}
```

### 5.6 Tool 6: get_automation_template

**Purpose:** Get pre-configured automation template for common scenarios.

**Handler Signature:**

```typescript
export async function handleGetAutomationTemplate(
  input: McpToolInput
): Promise<CallToolResult> {
  try {
    const { scenario, parameters } = getTemplateSchema.parse(input);

    const template = getTemplateForScenario(scenario, parameters);

    return createMcpResponse(`Template for "${scenario}" scenario`, {
      scenario,
      template: template.config,
      instructions: template.instructions,
      requiredCapabilities: template.requiredCapabilities,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

function getTemplateForScenario(
  scenario: string,
  parameters?: Record<string, unknown>
): AutomationTemplate {
  const templates: Record<string, AutomationTemplate> = {
    motion_lights: {
      config: {
        name: 'Motion-Activated Lights',
        triggers: [
          {
            deviceId: '${MOTION_SENSOR_ID}',
            capability: 'motionSensor',
            attribute: 'motion',
            value: 'active',
          },
        ],
        actions: [
          {
            deviceId: '${LIGHT_DEVICE_ID}',
            capability: 'switch',
            command: 'on',
          },
        ],
      },
      instructions: [
        'Replace ${MOTION_SENSOR_ID} with your motion sensor UUID',
        'Replace ${LIGHT_DEVICE_ID} with your light device UUID',
        'Optional: Add delay action to turn off after inactivity',
      ],
      requiredCapabilities: {
        trigger: ['motionSensor'],
        action: ['switch'],
      },
    },
    // ... more templates
  };

  return templates[scenario];
}
```

---

## 6. Zod Schema Definitions

### 6.1 Create Automation Schema

```typescript
import { z } from 'zod';

// Device operand for triggers/conditions
const deviceOperandSchema = z.object({
  deviceId: z.string().uuid('Invalid device UUID'),
  capability: z.string().min(1, 'Capability required'),
  attribute: z.string().min(1, 'Attribute required'),
  component: z.string().default('main'),
  value: z.unknown().optional(),
  operator: z.enum(['equals', 'greaterThan', 'lessThan', 'greaterThanOrEquals', 'lessThanOrEquals']).optional(),
  trigger: z.enum(['Auto', 'Always', 'Never']).default('Auto'),
});

// Device command for actions
const deviceCommandSchema = z.object({
  deviceId: z.string().uuid('Invalid device UUID'),
  capability: z.string().min(1, 'Capability required'),
  command: z.string().min(1, 'Command required'),
  component: z.string().default('main'),
  arguments: z.array(z.unknown()).optional(),
});

// Schedule configuration
const scheduleConfigSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59).default(0),
  daysOfWeek: z.array(z.enum(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])).optional(),
  timeZoneId: z.string().optional(),
});

// Sunrise/sunset configuration
const solarEventConfigSchema = z.object({
  event: z.enum(['Sunrise', 'Sunset']),
  offsetMinutes: z.number().int().default(0),
  locationId: z.string().uuid('Invalid location UUID'),
  timeZoneId: z.string().optional(),
});

// Main create automation schema
export const createAutomationSchema = z.object({
  name: z.string().min(1, 'Name required').max(100, 'Name too long (max 100 chars)'),
  locationId: z.string().uuid('Invalid location UUID'),

  // Simplified trigger/action format (converted to Rules API format internally)
  triggers: z.array(deviceOperandSchema).min(1, 'At least one trigger required'),
  conditions: z.array(deviceOperandSchema).optional(),
  actions: z.array(deviceCommandSchema).min(1, 'At least one action required'),

  // Optional schedule
  schedule: scheduleConfigSchema.optional(),
  solarEvent: solarEventConfigSchema.optional(),

  // Advanced options
  sequence: z.enum(['Serial', 'Parallel']).default('Serial'),
  timeZoneId: z.string().optional(),
  enabled: z.boolean().default(true),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
```

### 6.2 Update Automation Schema

```typescript
export const updateAutomationSchema = z.object({
  ruleId: z.string().uuid('Invalid rule UUID'),
  locationId: z.string().uuid('Invalid location UUID'),

  // All fields optional (partial update)
  name: z.string().min(1).max(100).optional(),
  triggers: z.array(deviceOperandSchema).optional(),
  conditions: z.array(deviceOperandSchema).optional(),
  actions: z.array(deviceCommandSchema).optional(),
  schedule: scheduleConfigSchema.optional(),
  solarEvent: solarEventConfigSchema.optional(),
  sequence: z.enum(['Serial', 'Parallel']).optional(),
  timeZoneId: z.string().optional(),
  enabled: z.boolean().optional(),
});

export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
```

### 6.3 Delete Automation Schema

```typescript
export const deleteAutomationSchema = z.object({
  ruleId: z.string().uuid('Invalid rule UUID'),
  locationId: z.string().uuid('Invalid location UUID'),
});

export type DeleteAutomationInput = z.infer<typeof deleteAutomationSchema>;
```

### 6.4 Test Automation Schema

```typescript
export const testAutomationSchema = z.object({
  locationId: z.string().uuid('Invalid location UUID'),
  triggers: z.array(deviceOperandSchema).min(1, 'At least one trigger required'),
  conditions: z.array(deviceOperandSchema).optional(),
  actions: z.array(deviceCommandSchema).min(1, 'At least one action required'),
});

export type TestAutomationInput = z.infer<typeof testAutomationSchema>;
```

### 6.5 Execute Automation Schema

```typescript
export const executeAutomationSchema = z.object({
  ruleId: z.string().uuid('Invalid rule UUID'),
  locationId: z.string().uuid('Invalid location UUID'),
});

export type ExecuteAutomationInput = z.infer<typeof executeAutomationSchema>;
```

### 6.6 Get Template Schema

```typescript
export const getTemplateSchema = z.object({
  scenario: z.enum([
    'motion_lights',
    'door_notification',
    'temperature_control',
    'scheduled_action',
    'sunrise_sunset',
    'battery_alert',
  ]),
  parameters: z.record(z.unknown()).optional(),
});

export type GetTemplateInput = z.infer<typeof getTemplateSchema>;
```

---

## 7. File Modification Plan

### 7.1 Files to Modify

**1. `src/services/AutomationService.ts` (+80 lines)**
- Add `createRule()` method
- Add `updateRule()` method
- Add `deleteRule()` method
- Add `executeRule()` method

**2. `src/platforms/smartthings/SmartThingsAdapter.ts` (+120 lines)**
- Add `createRule()` method with retry logic
- Add `updateRule()` method with retry logic
- Add `deleteRule()` method with retry logic
- Add `executeRule()` method with retry logic

**3. `src/mcp/tools/automation.ts` (NEW FILE, ~800 lines)**
- Import dependencies (Zod, ServiceContainer, types)
- Define Zod schemas (6 schemas)
- Implement 6 handler functions
- Implement helper functions (buildRuleFromConfig, getTemplateForScenario)
- Export tool metadata object
- Export initialization function

**4. `src/mcp/tools/index.ts` (+2 lines)**
- Export `automationTools`
- Export `initializeAutomationTools`

**5. `src/server.ts` (+3 lines)**
- Import `automationTools` and `initializeAutomationTools`
- Call `initializeAutomationTools(serviceContainer)`
- Add `...automationTools` to `allTools` object

### 7.2 New Type Definitions

**File:** `src/types/automation.ts` (NEW FILE, ~200 lines)

```typescript
import type { Rule, RuleRequest, RuleAction, DeviceCommand } from '@smartthings/core-sdk';

// Simplified automation config for MCP tools
export interface AutomationConfig {
  name: string;
  locationId: string;
  triggers: TriggerConfig[];
  conditions?: ConditionConfig[];
  actions: ActionConfig[];
  schedule?: ScheduleConfig;
  solarEvent?: SolarEventConfig;
  sequence?: 'Serial' | 'Parallel';
  timeZoneId?: string;
  enabled?: boolean;
}

export interface TriggerConfig {
  deviceId: string;
  capability: string;
  attribute: string;
  component?: string;
  value?: unknown;
  operator?: 'equals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEquals' | 'lessThanOrEquals';
  trigger?: 'Auto' | 'Always' | 'Never';
}

export interface ConditionConfig {
  deviceId: string;
  capability: string;
  attribute: string;
  component?: string;
  value: unknown;
  operator: 'equals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEquals' | 'lessThanOrEquals';
}

export interface ActionConfig {
  deviceId: string;
  capability: string;
  command: string;
  component?: string;
  arguments?: unknown[];
}

export interface ScheduleConfig {
  hour: number;
  minute?: number;
  daysOfWeek?: DayOfWeek[];
  timeZoneId?: string;
}

export type DayOfWeek = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface SolarEventConfig {
  event: 'Sunrise' | 'Sunset';
  offsetMinutes?: number;
  locationId: string;
  timeZoneId?: string;
}

// Automation template
export interface AutomationTemplate {
  config: Partial<AutomationConfig>;
  instructions: string[];
  requiredCapabilities: {
    trigger: string[];
    action: string[];
  };
}

// Helper functions for converting between formats
export function buildRuleFromConfig(config: AutomationConfig): RuleRequest;
export function buildActionsFromConfig(actions: ActionConfig[]): RuleAction[];
```

### 7.3 Helper Functions

**File:** `src/mcp/tools/automation.ts` (part of)

```typescript
/**
 * Convert simplified AutomationConfig to SmartThings RuleRequest.
 *
 * Handles conversion from user-friendly trigger/action format to
 * SmartThings Rules API action tree structure.
 */
function buildRuleFromConfig(config: AutomationConfig): RuleRequest {
  const actions: RuleAction[] = [];

  // Build trigger conditions
  for (const trigger of config.triggers) {
    const condition = buildConditionFromTrigger(trigger);
    const actionCommands = buildCommandActions(config.actions);

    actions.push({
      if: {
        ...condition,
        then: actionCommands,
      },
    });
  }

  // Add schedule if specified
  if (config.schedule) {
    actions.push(buildScheduleAction(config.schedule, config.actions));
  }

  // Add solar event if specified
  if (config.solarEvent) {
    actions.push(buildSolarEventAction(config.solarEvent, config.actions));
  }

  return {
    name: config.name,
    actions,
    sequence: config.sequence ? { actions: config.sequence } : undefined,
    timeZoneId: config.timeZoneId,
  };
}

function buildConditionFromTrigger(trigger: TriggerConfig): RuleCondition {
  const operator = trigger.operator ?? 'equals';
  const operatorKey = operatorToConditionKey(operator);

  return {
    [operatorKey]: {
      left: {
        device: {
          devices: [trigger.deviceId],
          component: trigger.component ?? 'main',
          capability: trigger.capability,
          attribute: trigger.attribute,
          trigger: trigger.trigger ?? 'Auto',
        },
      },
      right: buildOperandFromValue(trigger.value),
    },
  };
}

function buildCommandActions(actions: ActionConfig[]): RuleAction[] {
  return actions.map(action => ({
    command: {
      devices: [action.deviceId],
      commands: [
        {
          component: action.component ?? 'main',
          capability: action.capability,
          command: action.command,
          arguments: action.arguments?.map(buildOperandFromValue),
        },
      ],
    },
  }));
}

function buildOperandFromValue(value: unknown): RuleOperand {
  if (typeof value === 'boolean') return { boolean: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integer: value } : { decimal: value };
  }
  if (typeof value === 'string') return { string: value };
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function operatorToConditionKey(operator: string): string {
  const map: Record<string, string> = {
    equals: 'equals',
    greaterThan: 'greaterThan',
    lessThan: 'lessThan',
    greaterThanOrEquals: 'greaterThanOrEquals',
    lessThanOrEquals: 'lessThanOrEquals',
  };
  return map[operator] ?? 'equals';
}
```

---

## 8. Integration Points

### 8.1 ServiceContainer Integration

**No changes required** - AutomationService already accessible via:

```typescript
const automationService = serviceContainer.getAutomationService();
```

**After adding methods to AutomationService:**

```typescript
// In automation.ts tool handlers
const automationService = serviceContainer.getAutomationService();

const createdRule = await automationService.createRule(locationId, ruleRequest);
const updatedRule = await automationService.updateRule(ruleId, locationId, updates);
await automationService.deleteRule(ruleId, locationId);
const executionResult = await automationService.executeRule(ruleId, locationId);
```

### 8.2 SmartThingsAdapter Integration

**AutomationService already has adapter reference:**

```typescript
// In AutomationService.ts
constructor(private adapter: SmartThingsAdapter) {
  this.CACHE_TTL_MS = parseInt(process.env['AUTOMATION_CACHE_TTL_MS'] || '300000', 10);
}

// New methods delegate to adapter
async createRule(locationId: LocationId, rule: RuleRequest): Promise<Rule> {
  const createdRule = await this.adapter.createRule(locationId as string, rule);
  this.clearCache(locationId);
  return createdRule;
}
```

### 8.3 MCP Server Registration

**Update `src/server.ts`:**

```typescript
import {
  // ... existing imports
  automationTools,  // NEW
  initializeAutomationTools,  // NEW
} from './mcp/tools/index.js';

export function createMcpServer(): Server {
  const serviceContainer = new ServiceContainer(smartThingsService);

  // Initialize all tool modules
  // ... existing initializations
  initializeAutomationTools(serviceContainer);  // NEW

  // Combine all tools
  const allTools = {
    // ... existing tools
    ...automationTools,  // NEW
  };

  // ... rest of server configuration
}
```

### 8.4 Error Handling Integration

**Leverage existing error classification:**

```typescript
// In automation.ts handlers
try {
  // ... handler logic
} catch (error) {
  const errorCode = classifyError(error);  // Uses existing error classifier
  return createMcpError(error, errorCode);
}

// classifyError() handles:
// - DeviceNotFoundError
// - CapabilityNotSupportedError
// - NetworkError
// - RateLimitError
// - AuthenticationError
// - ValidationError (Zod)
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**File:** `src/mcp/tools/__tests__/automation.test.ts` (NEW FILE)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCreateAutomation,
  handleUpdateAutomation,
  handleDeleteAutomation,
  handleTestAutomation,
  handleExecuteAutomation,
  handleGetAutomationTemplate,
  initializeAutomationTools,
} from '../automation.js';
import { ServiceContainer } from '../../../services/ServiceContainer.js';

describe('Automation Tools', () => {
  let mockServiceContainer: ServiceContainer;
  let mockAutomationService: any;

  beforeEach(() => {
    mockAutomationService = {
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      executeRule: vi.fn(),
      getRule: vi.fn(),
    };

    mockServiceContainer = {
      getAutomationService: vi.fn(() => mockAutomationService),
      getDeviceService: vi.fn(() => mockDeviceService),
    } as any;

    initializeAutomationTools(mockServiceContainer);
  });

  describe('handleCreateAutomation', () => {
    it('should create automation with valid config', async () => {
      const input = {
        name: 'Test Automation',
        locationId: 'loc-123',
        triggers: [
          {
            deviceId: 'device-1',
            capability: 'motionSensor',
            attribute: 'motion',
            value: 'active',
          },
        ],
        actions: [
          {
            deviceId: 'device-2',
            capability: 'switch',
            command: 'on',
          },
        ],
      };

      mockAutomationService.createRule.mockResolvedValue({
        id: 'rule-123',
        name: 'Test Automation',
        status: 'Enabled',
      });

      const result = await handleCreateAutomation(input);

      expect(result).not.toHaveProperty('isError');
      expect(result.content[0].text).toContain('created successfully');
      expect(mockAutomationService.createRule).toHaveBeenCalledOnce();
    });

    it('should return validation error for missing name', async () => {
      const input = {
        locationId: 'loc-123',
        triggers: [],
        actions: [],
      };

      const result = await handleCreateAutomation(input);

      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('VALIDATION_ERROR');
    });
  });

  describe('handleTestAutomation', () => {
    it('should validate automation config successfully', async () => {
      const input = {
        locationId: 'loc-123',
        triggers: [
          {
            deviceId: 'device-1',
            capability: 'motionSensor',
            attribute: 'motion',
          },
        ],
        actions: [
          {
            deviceId: 'device-2',
            capability: 'switch',
            command: 'on',
          },
        ],
      };

      mockDeviceService.getDevice
        .mockResolvedValueOnce({
          id: 'device-1',
          name: 'Motion Sensor',
          capabilities: [DeviceCapability.MOTION_SENSOR],
        })
        .mockResolvedValueOnce({
          id: 'device-2',
          name: 'Light',
          capabilities: [DeviceCapability.SWITCH],
        });

      const result = await handleTestAutomation(input);

      expect(result).not.toHaveProperty('isError');
      expect(result.content[0].text).toContain('validation successful');
    });

    it('should return validation errors for missing capabilities', async () => {
      const input = {
        locationId: 'loc-123',
        triggers: [
          {
            deviceId: 'device-1',
            capability: 'motionSensor',
            attribute: 'motion',
          },
        ],
        actions: [
          {
            deviceId: 'device-2',
            capability: 'dimmer',
            command: 'setLevel',
          },
        ],
      };

      mockDeviceService.getDevice
        .mockResolvedValueOnce({
          id: 'device-1',
          name: 'Motion Sensor',
          capabilities: [DeviceCapability.MOTION_SENSOR],
        })
        .mockResolvedValueOnce({
          id: 'device-2',
          name: 'Light',
          capabilities: [DeviceCapability.SWITCH],  // Missing DIMMER
        });

      const result = await handleTestAutomation(input);

      expect(result).not.toHaveProperty('isError');
      expect(result.content[0].text).toContain('validation failed');
    });
  });

  describe('handleGetAutomationTemplate', () => {
    it('should return motion_lights template', async () => {
      const input = { scenario: 'motion_lights' };

      const result = await handleGetAutomationTemplate(input);

      expect(result).not.toHaveProperty('isError');
      expect(result.content[0].text).toContain('motion_lights');
    });

    it('should return all 6 templates', async () => {
      const scenarios = [
        'motion_lights',
        'door_notification',
        'temperature_control',
        'scheduled_action',
        'sunrise_sunset',
        'battery_alert',
      ];

      for (const scenario of scenarios) {
        const result = await handleGetAutomationTemplate({ scenario });
        expect(result).not.toHaveProperty('isError');
      }
    });
  });
});
```

### 9.2 Integration Tests

**File:** `src/mcp/tools/__tests__/automation-integration.test.ts` (NEW FILE)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMcpServer } from '../../../server.js';
import { smartThingsService } from '../../../smartthings/client.js';

describe('Automation Tools Integration', () => {
  let server: any;
  let locationId: string;

  beforeAll(async () => {
    server = createMcpServer();

    // Get location ID from SmartThings
    const locations = await smartThingsService.listLocations();
    locationId = locations[0].locationId;
  });

  it('should create, list, execute, and delete automation', async () => {
    // 1. Create automation
    const createResult = await server.callTool('create_automation', {
      name: 'Integration Test Automation',
      locationId,
      triggers: [
        {
          deviceId: 'test-motion-sensor',
          capability: 'motionSensor',
          attribute: 'motion',
          value: 'active',
        },
      ],
      actions: [
        {
          deviceId: 'test-light',
          capability: 'switch',
          command: 'on',
        },
      ],
    });

    expect(createResult).not.toHaveProperty('isError');
    const ruleId = JSON.parse(createResult.content[1].resource.text).ruleId;

    // 2. List automations (verify creation)
    const automationService = server.serviceContainer.getAutomationService();
    const rules = await automationService.listRules(locationId);
    expect(rules.some(r => r.id === ruleId)).toBe(true);

    // 3. Execute automation
    const executeResult = await server.callTool('execute_automation', {
      ruleId,
      locationId,
    });
    expect(executeResult).not.toHaveProperty('isError');

    // 4. Delete automation
    const deleteResult = await server.callTool('delete_automation', {
      ruleId,
      locationId,
    });
    expect(deleteResult).not.toHaveProperty('isError');

    // 5. Verify deletion
    const rulesAfterDelete = await automationService.listRules(locationId);
    expect(rulesAfterDelete.some(r => r.id === ruleId)).toBe(false);
  });
});
```

### 9.3 SmartThings Sandbox Testing

**Manual Testing Checklist:**

1. **Create Automation**
   - [ ] Create motion-activated lights automation
   - [ ] Verify rule appears in SmartThings app
   - [ ] Verify rule status is "Enabled"

2. **Test Automation**
   - [ ] Validate automation with valid devices
   - [ ] Validate automation with invalid device IDs (should fail)
   - [ ] Validate automation with missing capabilities (should fail)

3. **Execute Automation**
   - [ ] Execute rule manually
   - [ ] Verify device commands executed
   - [ ] Check execution result

4. **Update Automation**
   - [ ] Update rule name
   - [ ] Update rule actions
   - [ ] Verify changes in SmartThings app

5. **Delete Automation**
   - [ ] Delete rule
   - [ ] Verify rule removed from SmartThings app

6. **Templates**
   - [ ] Get all 6 templates
   - [ ] Verify template instructions
   - [ ] Verify required capabilities

---

## 10. Implementation Recommendations

### 10.1 Development Phases

**Phase 4.1a: Enhance Adapter and Service (2 days)**

Tasks:
1. Add 4 methods to `SmartThingsAdapter.ts` (create, update, delete, execute)
2. Add 4 methods to `AutomationService.ts` (create, update, delete, execute)
3. Write unit tests for new methods
4. Test against SmartThings sandbox

Deliverables:
- ✅ `SmartThingsAdapter.ts` with Rules API CRUD operations
- ✅ `AutomationService.ts` with cache invalidation
- ✅ Unit tests passing

**Phase 4.1b: Implement MCP Tools (2 days)**

Tasks:
1. Create `src/types/automation.ts` with type definitions
2. Create `src/mcp/tools/automation.ts` with 6 tools
3. Implement Zod schemas for validation
4. Implement helper functions (buildRuleFromConfig, getTemplateForScenario)
5. Write unit tests for tool handlers
6. Register tools in `server.ts`

Deliverables:
- ✅ 6 MCP tools implemented
- ✅ Zod schemas for validation
- ✅ Helper functions tested
- ✅ Tools registered in server

**Phase 4.1c: Templates and Testing (1 day)**

Tasks:
1. Implement 6 automation templates with instructions
2. Write integration tests
3. Manual testing with SmartThings sandbox
4. Update documentation

Deliverables:
- ✅ 6 automation templates
- ✅ Integration tests passing
- ✅ Manual test checklist completed
- ✅ Documentation updated

### 10.2 Code Review Checklist

Before submitting PR:

- [ ] All unit tests passing (100% coverage for handlers)
- [ ] Integration tests passing
- [ ] Manual testing completed with SmartThings sandbox
- [ ] Error handling tested (invalid inputs, API failures)
- [ ] Zod validation tested (edge cases)
- [ ] Cache invalidation verified (create/update/delete operations)
- [ ] Logging added for all operations
- [ ] Documentation updated (README, API docs)
- [ ] Type definitions exported correctly
- [ ] Tool metadata accurate (descriptions, schemas)

### 10.3 Performance Considerations

**Cache Management:**

- ✅ `clearCache()` called after create/update/delete operations
- ✅ 5-minute TTL prevents stale data
- ✅ Device index rebuilt on cache miss

**API Rate Limiting:**

- ✅ `retryWithBackoff` handles transient failures
- ✅ SmartThings rate limits: 1000 req/min per token
- ✅ Batch operations not applicable (Rules API doesn't support)

**Memory Usage:**

- ✅ Automation config validation happens before API call
- ✅ Helper functions create temporary objects (GC-friendly)
- ✅ Cache memory footprint: ~100KB per location

### 10.4 Security Considerations

**Input Validation:**

- ✅ Zod schemas validate all inputs
- ✅ UUID validation for device/location/rule IDs
- ✅ String length limits (rule name max 100 chars)

**Authentication:**

- ✅ SmartThings token required (handled by adapter)
- ✅ Location-level rules require location ownership
- ✅ Device access controlled by SmartThings permissions

**Error Information Disclosure:**

- ✅ Error messages sanitized (no token/credential leaks)
- ✅ Device UUIDs safe to expose (non-sensitive)
- ✅ Location UUIDs safe to expose (user's own locations)

### 10.5 Documentation Requirements

**README Updates:**

- Add "Automation Tools" section
- Document all 6 MCP tools with examples
- Link to SmartThings Rules API documentation

**API Documentation:**

- Document Zod schemas
- Document helper functions
- Document automation templates

**Examples:**

- Example automation configs for each template
- Example MCP tool calls (curl/MCP Inspector)
- Example error responses

---

## Conclusion

This research provides a complete blueprint for implementing Phase 4.1 automation MCP tools. The existing codebase has excellent foundations:

✅ **AutomationService** - Robust caching and device indexing
✅ **SmartThingsAdapter** - Clean error handling and retry logic
✅ **MCP Tool Patterns** - Consistent, well-documented patterns
✅ **SmartThings SDK** - Full Rules API support (v8.4.1)

**Implementation is straightforward:**

1. **Expose SDK methods** - Add 4 wrapper methods to adapter (120 lines)
2. **Delegate to adapter** - Add 4 methods to service (80 lines)
3. **Create MCP tools** - Implement 6 handlers with Zod validation (800 lines)
4. **Register tools** - Update server.ts (3 lines)

**Total LOC:** ~1,000 lines (mostly tool handlers and templates)
**Estimated Effort:** 5 days (matches ticket estimate)
**Risk Level:** Low (leveraging existing patterns)

**Next Steps:**

1. Create implementation tickets for each phase
2. Begin Phase 4.1a (adapter enhancement)
3. Review and iterate during development

---

**End of Research Document**
