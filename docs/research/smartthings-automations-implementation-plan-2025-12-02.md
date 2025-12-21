# SmartThings Automations Implementation Research

**Research Date:** 2025-12-02
**Priority:** High
**Context:** Frontend has mock automations, need to connect to real SmartThings automations data
**Related Files:**
- `/web/src/lib/stores/automationStore.svelte.ts` - Frontend mock implementation
- `/src/services/AutomationService.ts` - Backend automation service
- `/src/platforms/smartthings/SmartThingsAdapter.ts` - SmartThings API integration
- `/src/mcp/tools/automation.ts` - MCP automation tools

---

## Executive Summary

The MCP SmartThings project **already has comprehensive backend automation infrastructure** but lacks a REST API to connect the frontend to real SmartThings automations data. The implementation requires:

1. ✅ **Backend Infrastructure (COMPLETE)**: AutomationService + SmartThings Rules API integration
2. ✅ **MCP Tools (COMPLETE)**: 6 automation tools for create/update/delete/execute operations
3. ❌ **REST API Endpoints (MISSING)**: No `/api/automations` routes exist for frontend
4. ✅ **Frontend Store (READY)**: automationStore.svelte.ts with graceful API fallback

**Key Finding:** The backend is **production-ready** with SmartThings Rules API fully integrated. The missing piece is a **SvelteKit API route** (`/web/src/routes/api/automations/+server.ts`) to bridge frontend and backend.

**Recommended Approach:**
1. Create SvelteKit API routes for automations (GET, POST for toggle)
2. Integrate with existing AutomationService via ServiceContainer
3. Transform SmartThings Rules to frontend Automation format
4. Remove mock data from automationStore.svelte.ts

**Effort Estimate:** 2-3 hours

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [SmartThings Automations API](#2-smartthings-automations-api)
3. [Backend Implementation (Existing)](#3-backend-implementation-existing)
4. [Frontend Implementation (Current)](#4-frontend-implementation-current)
5. [Missing Integration Layer](#5-missing-integration-layer)
6. [Implementation Plan](#6-implementation-plan)
7. [Data Transformation](#7-data-transformation)
8. [API Endpoint Design](#8-api-endpoint-design)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Checklist](#10-deployment-checklist)

---

## 1. Current State Analysis

### 1.1 Frontend Mock Implementation

**File:** `/web/src/lib/stores/automationStore.svelte.ts` (254 lines)

**Current Behavior:**
```typescript
export async function loadAutomations(): Promise<void> {
  loading = true;
  error = null;

  try {
    // Try to fetch from API endpoint
    try {
      const response = await fetch('/api/automations');
      if (response.ok) {
        const result: AutomationsResponse = await response.json();
        // Process real automations...
        return;
      }
    } catch (apiError) {
      // API endpoint not available, fall through to mock data
      console.info('Automations API not available, using mock data');
    }

    // Use mock data for development
    const mockAutomations: Automation[] = [
      {
        id: 'auto-1',
        name: 'Good Morning',
        enabled: true,
        triggers: ['Time: 7:00 AM'],
        actions: ['Turn on bedroom lights', 'Set temperature to 72°F'],
        lastExecuted: new Date(Date.now() - 3600000).toISOString()
      },
      // ... 5 more mock automations
    ];
  } finally {
    loading = false;
  }
}
```

**Frontend Data Model:**
```typescript
export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  triggers?: string[];      // Human-readable trigger descriptions
  actions?: string[];       // Human-readable action descriptions
  lastExecuted?: string;    // ISO timestamp
}

export interface AutomationsResponse {
  success: boolean;
  data: {
    count: number;
    automations: Automation[];
  };
  error?: {
    message: string;
  };
}
```

**Key Observations:**
- ✅ **Graceful degradation**: Falls back to mock data if API unavailable
- ✅ **Proper error handling**: Catches API errors without crashing
- ✅ **Expected API format**: Clear contract for backend to implement
- ❌ **Mock data hardcoded**: 6 fake automations in store

### 1.2 Backend Automation Service

**File:** `/src/services/AutomationService.ts` (579 lines)

**Existing Capabilities:**

```typescript
export class AutomationService {
  // ✅ IMPLEMENTED: Query operations
  async listRules(locationId: LocationId): Promise<Rule[]>
  async getRule(ruleId: string, locationId: LocationId): Promise<Rule | null>
  async findRulesForDevice(deviceId: DeviceId, locationId: LocationId): Promise<RuleMatch[]>

  // ✅ IMPLEMENTED: Mutation operations (Ticket 1M-411)
  async createRule(locationId: LocationId, rule: any): Promise<Rule>
  async updateRule(ruleId: string, locationId: LocationId, updates: any): Promise<Rule>
  async deleteRule(ruleId: string, locationId: LocationId): Promise<void>
  async executeRule(ruleId: string, locationId: LocationId): Promise<any>

  // ✅ IMPLEMENTED: Cache management
  clearCache(locationId?: LocationId): void
}
```

**Performance Characteristics:**
- **Cache TTL**: 5 minutes (configurable via `AUTOMATION_CACHE_TTL_MS`)
- **Cache hit**: O(1) lookup, <10ms
- **Cache miss**: O(R×A) where R=rules, A=actions per rule, ~500ms
- **Memory footprint**: ~100KB per location

**Design Decisions:**
- **Caching strategy**: Aggressive caching to minimize SmartThings API calls
- **Device indexing**: Builds Map<DeviceId, RuleMatch[]> for fast device lookups
- **Graceful degradation**: Returns empty array on API failures (non-blocking)

### 1.3 SmartThings Adapter Integration

**File:** `/src/platforms/smartthings/SmartThingsAdapter.ts` (Lines 960-1173)

**Rules API Methods:**

```typescript
export class SmartThingsAdapter extends EventEmitter implements IDeviceAdapter {
  // ✅ List all rules for location
  async listRules(locationId: string): Promise<Rule[]> {
    const rules = await retryWithBackoff(
      async () => {
        const rulesEndpoint = this.client!.rules;
        const result = await rulesEndpoint.list(locationId, {});
        return result.items || [];
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );
    return rules;
  }

  // ✅ Create new rule
  async createRule(locationId: string, rule: any): Promise<Rule> {
    return retryWithBackoff(
      async () => await this.client!.rules.create(rule, locationId),
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  }

  // ✅ Update existing rule
  async updateRule(ruleId: string, locationId: string, updates: any): Promise<Rule> {
    return retryWithBackoff(
      async () => await this.client!.rules.update(ruleId, updates, locationId),
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  }

  // ✅ Delete rule
  async deleteRule(ruleId: string, locationId: string): Promise<void> {
    await retryWithBackoff(
      async () => await this.client!.rules.delete(ruleId, locationId),
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  }

  // ✅ Execute rule manually
  async executeRule(ruleId: string, locationId: string): Promise<any> {
    return retryWithBackoff(
      async () => await this.client!.rules.execute(ruleId, locationId),
      { maxRetries: 3, baseDelayMs: 1000 }
    );
  }
}
```

**SDK Version:** `@smartthings/core-sdk@8.0.0`

**Error Handling:**
- Exponential backoff with 3 retries
- Wrapped errors with context (operation, locationId, ruleId)
- Error events emitted for non-fatal failures

---

## 2. SmartThings Automations API

### 2.1 Rules vs Scenes

**SmartThings Terminology:**
- **Rules**: Automation logic with triggers, conditions, and actions (IF-THEN)
- **Scenes**: One-time device state configurations (snapshot)

**For automations, we need RULES, not scenes.**

### 2.2 SmartThings Rule Structure

**From `@smartthings/core-sdk` types:**

```typescript
interface Rule {
  id: string;                    // Rule UUID
  name: string;                  // Rule name (max 100 chars)
  actions: RuleAction[];         // Action tree executed when triggered
  sequence?: RuleActionSequence; // 'Serial' (default) | 'Parallel'
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
  sequence?: 'Serial' | 'Parallel';
}

interface DeviceCommand {
  component: string;             // Default: 'main'
  capability: string;            // e.g., 'switch', 'switchLevel'
  command: string;               // e.g., 'on', 'setLevel'
  arguments?: RuleOperand[];     // Command arguments
}

interface IfAction {
  equals?: ComparisonOperand;    // Equality check
  greaterThan?: ComparisonOperand;
  lessThan?: ComparisonOperand;
  // ... more comparison operators
  then: RuleAction[];            // Actions if condition true
  else?: RuleAction[];           // Actions if condition false
}
```

### 2.3 Understanding Triggers vs Conditions

**Key Concept:** SmartThings Rules use "device operands with trigger mode" for triggers.

**Trigger Device Operand:**
```typescript
interface DeviceOperand {
  device: {
    devices: string[];           // Device UUIDs
    component: string;           // Component ID (default: 'main')
    capability: string;          // Capability name
    attribute: string;           // Attribute to monitor
    trigger: 'Always' | 'Auto' | 'Never';  // Trigger mode
  };
}
```

**Trigger Modes:**
- **Always**: This condition always triggers the rule (explicit trigger)
- **Auto**: SDK decides if this should trigger (recommended for most cases)
- **Never**: This is a condition check only, doesn't trigger

**Example - Motion-activated lights:**
```typescript
{
  name: "Hallway Motion Lights",
  actions: [{
    if: {
      equals: {
        left: {
          device: {
            devices: ["motion-sensor-uuid"],
            component: "main",
            capability: "motionSensor",
            attribute: "motion",
            trigger: "Always"  // ← This makes it a TRIGGER
          }
        },
        right: { string: "active" }
      },
      then: [{
        command: {
          devices: ["light-uuid"],
          commands: [{
            component: "main",
            capability: "switch",
            command: "on"
          }]
        }
      }]
    }
  }]
}
```

### 2.4 SmartThings Rules API Operations

**Available via SDK:**

```typescript
// From @smartthings/core-sdk RulesEndpoint
class RulesEndpoint {
  // List all rules for location
  async list(locationId: string, options?: RuleListOptions): Promise<PagedRule>

  // Get specific rule
  async get(ruleId: string, locationId: string): Promise<Rule>

  // Create new rule
  async create(rule: RuleRequest, locationId: string): Promise<Rule>

  // Update existing rule
  async update(ruleId: string, rule: RuleRequest, locationId: string): Promise<Rule>

  // Delete rule
  async delete(ruleId: string, locationId: string): Promise<void>

  // Execute rule manually
  async execute(ruleId: string, locationId: string): Promise<RuleExecutionResponse>
}
```

**List Options:**
```typescript
interface RuleListOptions {
  max?: number;        // Maximum results (default: 100)
  offset?: number;     // Pagination offset
}

interface PagedRule {
  items: Rule[];       // Array of rules
  _links?: {
    next?: { href: string };
    previous?: { href: string };
  };
}
```

### 2.5 Rule Execution Response

**Structure:**
```typescript
interface RuleExecutionResponse {
  executionId: string;          // Unique execution UUID
  id: string;                   // Rule ID
  result: 'Success' | 'Failure' | 'Ignored';
  actions?: ActionExecutionResult[];
}

interface ActionExecutionResult {
  actionId: string;
  command?: CommandActionExecutionResult[];
  if?: IfActionExecutionResult;
  sleep?: SleepActionExecutionResult;
}

interface CommandActionExecutionResult {
  result: 'Success' | 'Failure' | 'Offline';
  deviceId: string;
}
```

---

## 3. Backend Implementation (Existing)

### 3.1 Service Layer Architecture

**Dependency Flow:**
```
ServiceContainer
  ↓
AutomationService
  ↓
SmartThingsAdapter
  ↓
@smartthings/core-sdk (SmartThingsClient)
  ↓
SmartThings Cloud API
```

**ServiceContainer Initialization:**
```typescript
// From src/server.ts
import { ServiceContainer } from './services/ServiceContainer.js';
import { smartThingsService } from './smartthings/client.js';

const serviceContainer = new ServiceContainer(smartThingsService);
```

**Getting AutomationService:**
```typescript
// Within any service or route handler
const automationService = serviceContainer.getAutomationService();

// List all rules for a location
const rules = await automationService.listRules(locationId);

// Enable/disable rule
const rule = await automationService.getRule(ruleId, locationId);
const updates = { ...rule, status: rule.status === 'Enabled' ? 'Disabled' : 'Enabled' };
await automationService.updateRule(ruleId, locationId, updates);
```

### 3.2 MCP Automation Tools

**File:** `/src/mcp/tools/automation.ts` (923 lines)

**Available MCP Tools:**
1. `create_automation` - Create automation from template
2. `update_automation` - Update existing automation
3. `delete_automation` - Delete automation
4. `test_automation` - Test configuration without creating
5. `execute_automation` - Manually trigger automation
6. `get_automation_template` - Get template metadata

**Automation Templates:**
1. `motion_lights` - Motion-activated lights
2. `door_notification` - Door/window notifications
3. `temperature_control` - Temperature-based HVAC
4. `scheduled_action` - Time-based scheduled actions
5. `sunrise_sunset` - Sunrise/sunset triggers
6. `battery_alert` - Low battery notifications

**Example MCP Tool Handler:**
```typescript
export async function handleCreateAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const parsed = createAutomationSchema.parse(input);

    // Build automation config
    const config: AutomationConfig = {
      name: parsed.name,
      locationId: parsed.locationId,
      template: parsed.template,
      trigger: {
        deviceId: parsed.triggerDeviceId,
        capability: parsed.triggerCapability,
        attribute: parsed.triggerAttribute,
        value: parsed.triggerValue,
      },
      action: {
        deviceId: parsed.actionDeviceId,
        capability: parsed.actionCapability,
        command: parsed.actionCommand,
        arguments: parsed.actionArguments,
      },
    };

    // Validate and build rule
    const validation = validateConfig(config);
    if (!validation.valid) {
      return createMcpError(new Error(validation.errors.join(', ')), 'VALIDATION_ERROR');
    }

    const rule = buildRuleFromConfig(config);

    // Create via AutomationService
    const automationService = serviceContainer.getAutomationService();
    const createdRule = await automationService.createRule(config.locationId as LocationId, rule);

    return createMcpResponse(`Automation "${createdRule.name}" created successfully`, {
      ruleId: createdRule.id,
      ruleName: createdRule.name,
      template: config.template,
      status: createdRule.status,
    });
  } catch (error) {
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}
```

---

## 4. Frontend Implementation (Current)

### 4.1 Automation Store

**File:** `/web/src/lib/stores/automationStore.svelte.ts`

**Store Structure:**
```typescript
// State (Svelte 5 Runes)
let automationMap = $state<Map<string, Automation>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived state
let automations = $derived(
  Array.from(automationMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

let stats = $derived({
  total: automations.length,
  enabled: automations.filter((a) => a.enabled).length,
  disabled: automations.filter((a) => !a.enabled).length
});
```

**Store API:**
```typescript
export function getAutomationStore() {
  return {
    // Read-only state
    get automations() { return automations; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },

    // Actions
    loadAutomations,      // Fetch all automations
    toggleAutomation,     // Enable/disable automation
    getAutomationById,    // Get single automation
  };
}
```

### 4.2 Mock Automations Data

**Current mock data (6 automations):**

```typescript
const mockAutomations: Automation[] = [
  {
    id: 'auto-1',
    name: 'Good Morning',
    enabled: true,
    triggers: ['Time: 7:00 AM'],
    actions: ['Turn on bedroom lights', 'Set temperature to 72°F'],
    lastExecuted: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'auto-2',
    name: 'Movie Night',
    enabled: true,
    triggers: ['Manual trigger'],
    actions: ['Dim living room lights', 'Close curtains', 'Turn on TV'],
    lastExecuted: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'auto-3',
    name: 'Leaving Home',
    enabled: false,
    triggers: ['Location: Away from home'],
    actions: ['Turn off all lights', 'Set thermostat to away mode', 'Lock doors']
  },
  {
    id: 'auto-4',
    name: 'Bedtime',
    enabled: true,
    triggers: ['Time: 10:30 PM'],
    actions: ['Turn off all lights', 'Lock all doors', 'Set temperature to 68°F'],
    lastExecuted: new Date(Date.now() - 43200000).toISOString()
  },
  {
    id: 'auto-5',
    name: 'Security Alert',
    enabled: true,
    triggers: ['Motion detected when away'],
    actions: ['Send notification', 'Turn on all lights', 'Record camera']
  },
  {
    id: 'auto-6',
    name: 'Welcome Home',
    enabled: false,
    triggers: ['Location: Arriving home'],
    actions: ['Turn on entrance lights', 'Set temperature to 72°F', 'Unlock front door']
  }
];
```

### 4.3 Frontend Components

**AutomationsGrid.svelte** - Main layout component
**AutomationCard.svelte** - Individual automation cards

**Features:**
- Grid layout with responsive design
- Enable/disable toggle switches
- Visual status indicators
- Loading states
- Error handling

---

## 5. Missing Integration Layer

### 5.1 What's Missing?

**Gap:** No REST API endpoints to connect frontend store to backend service.

**Current State:**
```
Frontend (automationStore.svelte.ts)
  ↓ fetch('/api/automations')  ← 404 Not Found
  ❌ NO ROUTE EXISTS
  ↓
Backend (AutomationService.ts)  ← Fully implemented, unused
```

**Required:**
```
Frontend (automationStore.svelte.ts)
  ↓ fetch('/api/automations')
  ✅ SvelteKit API Route (+server.ts)
  ↓
Backend (AutomationService)
  ↓
SmartThings Rules API
```

### 5.2 SvelteKit API Routes

**SvelteKit Convention:**
- API routes live in `/web/src/routes/api/[endpoint]/+server.ts`
- Export `GET`, `POST`, `PUT`, `DELETE` functions
- Return `json()` responses

**Missing Files:**
1. `/web/src/routes/api/automations/+server.ts` - List/get automations
2. `/web/src/routes/api/automations/[id]/toggle/+server.ts` - Toggle automation

### 5.3 Backend Service Access

**Challenge:** How does SvelteKit access backend services?

**Options:**

**Option 1: Direct Import (Simple, works for same-process deployment)**
```typescript
// In +server.ts
import { ServiceContainer } from '$lib/server/services/ServiceContainer.js';
import { smartThingsService } from '$lib/server/smartthings/client.js';

const serviceContainer = new ServiceContainer(smartThingsService);
const automationService = serviceContainer.getAutomationService();
```

**Option 2: Shared Service Module (Cleaner, avoids duplication)**
```typescript
// Create /web/src/lib/server/services.ts
import { ServiceContainer } from '../../../src/services/ServiceContainer.js';
import { smartThingsService } from '../../../src/smartthings/client.js';

export const serviceContainer = new ServiceContainer(smartThingsService);
```

**Option 3: API Proxy (For separate frontend/backend deployments)**
```typescript
// Proxy to MCP server HTTP endpoint (if running in HTTP mode)
const response = await fetch('http://localhost:3000/api/automations');
```

**Recommended:** Option 2 (Shared Service Module) - Clean, efficient, works for monorepo.

---

## 6. Implementation Plan

### 6.1 Phase 1: Data Transformation Layer (30 mins)

**Goal:** Convert SmartThings Rules to Frontend Automation format

**File:** `/web/src/lib/server/transformers/ruleToAutomation.ts` (NEW)

```typescript
import type { Rule } from '@smartthings/core-sdk';
import type { Automation } from '$lib/stores/automationStore.svelte.js';

/**
 * Transform SmartThings Rule to frontend Automation format
 */
export function ruleToAutomation(rule: Rule): Automation {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.status !== 'Disabled',
    triggers: extractTriggers(rule),
    actions: extractActions(rule),
    lastExecuted: undefined, // SmartThings doesn't provide last execution time
  };
}

/**
 * Extract human-readable trigger descriptions from rule
 */
function extractTriggers(rule: Rule): string[] {
  const triggers: string[] = [];

  // Scan rule actions for trigger device operands
  for (const action of rule.actions || []) {
    if ('if' in action && action.if) {
      const ifAction = action.if as any;

      // Check for device operand with trigger: 'Always'
      const deviceOperand = findDeviceOperand(ifAction);
      if (deviceOperand && deviceOperand.trigger === 'Always') {
        triggers.push(formatDeviceTrigger(deviceOperand));
      }
    }
  }

  return triggers.length > 0 ? triggers : ['Manual trigger'];
}

/**
 * Extract human-readable action descriptions from rule
 */
function extractActions(rule: Rule): string[] {
  const actions: string[] = [];

  for (const action of rule.actions || []) {
    if ('command' in action && action.command) {
      const commandAction = action.command;

      // Format each device command
      for (const cmd of commandAction.commands || []) {
        actions.push(formatCommand(cmd));
      }
    }
  }

  return actions;
}

/**
 * Format device trigger as human-readable string
 */
function formatDeviceTrigger(deviceOperand: any): string {
  const { capability, attribute, value } = deviceOperand;

  // Map capability/attribute to human-readable format
  const triggerMap: Record<string, string> = {
    'motionSensor.motion.active': 'Motion detected',
    'contactSensor.contact.open': 'Door/window opened',
    'contactSensor.contact.closed': 'Door/window closed',
    'temperatureMeasurement.temperature': `Temperature ${value}°`,
  };

  const key = `${capability}.${attribute}.${value}`;
  return triggerMap[key] || `${attribute}: ${value}`;
}

/**
 * Format device command as human-readable string
 */
function formatCommand(cmd: any): string {
  const { capability, command, arguments: args } = cmd;

  // Map capability/command to human-readable format
  const commandMap: Record<string, string> = {
    'switch.on': 'Turn on lights',
    'switch.off': 'Turn off lights',
    'switchLevel.setLevel': `Set brightness to ${args?.[0] || 100}%`,
    'thermostat.setCoolingSetpoint': `Set cooling to ${args?.[0]}°`,
    'thermostat.setHeatingSetpoint': `Set heating to ${args?.[0]}°`,
  };

  const key = `${capability}.${command}`;
  return commandMap[key] || `${command}`;
}

/**
 * Find device operand in if-action comparison
 */
function findDeviceOperand(ifAction: any): any {
  // Check equality comparison
  if (ifAction.equals) {
    const { left, right } = ifAction.equals;
    if (left?.device) return left.device;
    if (right?.device) return right.device;
  }

  // Check other comparison operators
  const operators = ['greaterThan', 'lessThan', 'greaterThanOrEquals', 'lessThanOrEquals'];
  for (const op of operators) {
    if (ifAction[op]) {
      const { left, right } = ifAction[op];
      if (left?.device) return left.device;
      if (right?.device) return right.device;
    }
  }

  return null;
}
```

### 6.2 Phase 2: Shared Service Module (15 mins)

**File:** `/web/src/lib/server/services.ts` (NEW)

```typescript
import { ServiceContainer } from '../../../../src/services/ServiceContainer.js';
import { smartThingsService } from '../../../../src/smartthings/client.js';
import { environment } from '../../../../src/config/environment.js';

// Initialize ServiceContainer (singleton)
export const serviceContainer = new ServiceContainer(smartThingsService);

// Helper to get default location ID
export function getDefaultLocationId(): string {
  const locationId = environment.SMARTTHINGS_LOCATION_ID;

  if (!locationId) {
    throw new Error('SMARTTHINGS_LOCATION_ID not configured');
  }

  return locationId;
}
```

### 6.3 Phase 3: API Route - List Automations (30 mins)

**File:** `/web/src/routes/api/automations/+server.ts` (NEW)

```typescript
import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serviceContainer, getDefaultLocationId } from '$lib/server/services.js';
import { ruleToAutomation } from '$lib/server/transformers/ruleToAutomation.js';
import type { AutomationsResponse } from '$lib/stores/automationStore.svelte.js';

/**
 * GET /api/automations
 *
 * Returns all automations for the default location
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get location ID from query param or use default
    const locationId = url.searchParams.get('locationId') || getDefaultLocationId();

    // Get automation service
    const automationService = serviceContainer.getAutomationService();

    // List all rules from SmartThings
    const rules = await automationService.listRules(locationId);

    // Transform to frontend format
    const automations = rules.map(ruleToAutomation);

    // Return success response
    const response: AutomationsResponse = {
      success: true,
      data: {
        count: automations.length,
        automations,
      },
    };

    return json(response);
  } catch (err) {
    console.error('Failed to fetch automations:', err);

    // Return error response
    const response: AutomationsResponse = {
      success: false,
      data: {
        count: 0,
        automations: [],
      },
      error: {
        message: err instanceof Error ? err.message : 'Failed to fetch automations',
      },
    };

    return json(response, { status: 500 });
  }
};
```

### 6.4 Phase 4: API Route - Toggle Automation (30 mins)

**File:** `/web/src/routes/api/automations/[id]/toggle/+server.ts` (NEW)

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serviceContainer, getDefaultLocationId } from '$lib/server/services.js';

/**
 * POST /api/automations/{id}/toggle
 *
 * Toggles automation enabled/disabled state
 */
export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id: ruleId } = params;
    const { enabled } = await request.json();
    const locationId = getDefaultLocationId();

    // Get automation service
    const automationService = serviceContainer.getAutomationService();

    // Get current rule
    const rule = await automationService.getRule(ruleId, locationId);

    if (!rule) {
      return json(
        { success: false, error: { message: 'Automation not found' } },
        { status: 404 }
      );
    }

    // Update rule status
    const updates = {
      ...rule,
      status: enabled ? 'Enabled' : 'Disabled',
    };

    await automationService.updateRule(ruleId, locationId, updates);

    return json({
      success: true,
      data: {
        ruleId,
        enabled,
      },
    });
  } catch (err) {
    console.error('Failed to toggle automation:', err);

    return json(
      {
        success: false,
        error: {
          message: err instanceof Error ? err.message : 'Failed to toggle automation',
        },
      },
      { status: 500 }
    );
  }
};
```

### 6.5 Phase 5: Remove Mock Data (15 mins)

**File:** `/web/src/lib/stores/automationStore.svelte.ts` (MODIFY)

**Remove mock data section:**

```typescript
export async function loadAutomations(): Promise<void> {
  loading = true;
  error = null;

  try {
    // Fetch from API endpoint
    const response = await fetch('/api/automations');

    if (!response.ok) {
      throw new Error(`Failed to fetch automations: ${response.statusText}`);
    }

    const result: AutomationsResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Unknown error');
    }

    const newAutomationMap = new Map<string, Automation>();

    result.data.automations.forEach((automation) => {
      newAutomationMap.set(automation.id, automation);
    });

    automationMap = newAutomationMap;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load automations';
    console.error('Failed to load automations:', err);
  } finally {
    loading = false;
  }
}
```

**Remove mock fallback, throw real errors.**

---

## 7. Data Transformation

### 7.1 SmartThings Rule → Frontend Automation

**Mapping:**

| SmartThings Rule Field | Frontend Automation Field | Transformation |
|------------------------|---------------------------|----------------|
| `rule.id` | `automation.id` | Direct copy (UUID) |
| `rule.name` | `automation.name` | Direct copy (string) |
| `rule.status` | `automation.enabled` | `status !== 'Disabled'` |
| `rule.actions[].if.device` (trigger: 'Always') | `automation.triggers[]` | Extract device operands, format as human-readable |
| `rule.actions[].command` | `automation.actions[]` | Extract device commands, format as human-readable |
| N/A | `automation.lastExecuted` | Not available in Rules API (set to `undefined`) |

### 7.2 Trigger Extraction Logic

**Algorithm:**

1. Scan all `rule.actions[]` for `{ if: ... }` actions
2. For each if-action, check comparison operands (equals, greaterThan, etc.)
3. Find device operands with `trigger: 'Always'`
4. Extract `capability`, `attribute`, `value`
5. Format as human-readable string using capability mappings

**Example:**

```typescript
// SmartThings Rule
{
  if: {
    equals: {
      left: {
        device: {
          devices: ["motion-sensor-uuid"],
          capability: "motionSensor",
          attribute: "motion",
          trigger: "Always"  // ← TRIGGER
        }
      },
      right: { string: "active" }
    },
    then: [...]
  }
}

// Extracted Trigger
triggers: ["Motion detected"]
```

### 7.3 Action Extraction Logic

**Algorithm:**

1. Scan all `rule.actions[]` for `{ command: ... }` actions
2. Extract `devices[]`, `commands[]`
3. For each command, extract `capability`, `command`, `arguments`
4. Format as human-readable string using command mappings

**Example:**

```typescript
// SmartThings Rule
{
  command: {
    devices: ["light-uuid"],
    commands: [{
      component: "main",
      capability: "switch",
      command: "on"
    }]
  }
}

// Extracted Action
actions: ["Turn on lights"]
```

### 7.4 Capability Mappings

**Trigger Mappings:**

```typescript
const triggerMap: Record<string, string> = {
  // Motion sensors
  'motionSensor.motion.active': 'Motion detected',
  'motionSensor.motion.inactive': 'Motion stopped',

  // Contact sensors
  'contactSensor.contact.open': 'Door/window opened',
  'contactSensor.contact.closed': 'Door/window closed',

  // Temperature
  'temperatureMeasurement.temperature': 'Temperature changed',

  // Battery
  'battery.battery': 'Battery level changed',

  // Time-based (custom)
  'time.reference.Sunrise': 'Sunrise',
  'time.reference.Sunset': 'Sunset',
  'time.reference.Midnight': 'Midnight',
};
```

**Command Mappings:**

```typescript
const commandMap: Record<string, string> = {
  // Switch
  'switch.on': 'Turn on',
  'switch.off': 'Turn off',

  // Switch level (dimmer)
  'switchLevel.setLevel': 'Set brightness',

  // Thermostat
  'thermostat.setCoolingSetpoint': 'Set cooling',
  'thermostat.setHeatingSetpoint': 'Set heating',
  'thermostat.setThermostatMode': 'Set mode',

  // Lock
  'lock.lock': 'Lock',
  'lock.unlock': 'Unlock',

  // Notification
  'notification.push': 'Send notification',
};
```

---

## 8. API Endpoint Design

### 8.1 Endpoint Summary

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/automations` | List all automations | N/A | `AutomationsResponse` |
| POST | `/api/automations/{id}/toggle` | Toggle enabled state | `{ enabled: boolean }` | `{ success, data }` |

### 8.2 GET /api/automations

**Purpose:** Fetch all automations for default location

**Query Parameters:**
- `locationId` (optional) - Override default location

**Response Format:**
```typescript
interface AutomationsResponse {
  success: boolean;
  data: {
    count: number;
    automations: Automation[];
  };
  error?: {
    message: string;
  };
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "automations": [
      {
        "id": "uuid-1",
        "name": "Good Morning",
        "enabled": true,
        "triggers": ["Time: 7:00 AM"],
        "actions": ["Turn on bedroom lights", "Set temperature to 72°F"],
        "lastExecuted": undefined
      }
    ]
  }
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "success": false,
  "data": {
    "count": 0,
    "automations": []
  },
  "error": {
    "message": "Failed to fetch rules: Network timeout"
  }
}
```

### 8.3 POST /api/automations/{id}/toggle

**Purpose:** Enable or disable an automation

**Path Parameters:**
- `id` - Automation/Rule UUID

**Request Body:**
```json
{
  "enabled": true
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "ruleId": "uuid-1",
    "enabled": true
  }
}
```

**Error Responses:**

**404 Not Found:**
```json
{
  "success": false,
  "error": {
    "message": "Automation not found"
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": {
    "message": "Failed to update rule: API error"
  }
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test Data Transformer:**

**File:** `/web/src/lib/server/transformers/ruleToAutomation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ruleToAutomation } from './ruleToAutomation.js';
import type { Rule } from '@smartthings/core-sdk';

describe('ruleToAutomation', () => {
  it('should transform basic rule', () => {
    const rule: Rule = {
      id: 'rule-1',
      name: 'Test Rule',
      status: 'Enabled',
      actions: [],
    };

    const automation = ruleToAutomation(rule);

    expect(automation.id).toBe('rule-1');
    expect(automation.name).toBe('Test Rule');
    expect(automation.enabled).toBe(true);
  });

  it('should extract motion trigger', () => {
    const rule: Rule = {
      id: 'rule-1',
      name: 'Motion Lights',
      actions: [{
        if: {
          equals: {
            left: {
              device: {
                devices: ['motion-sensor-uuid'],
                component: 'main',
                capability: 'motionSensor',
                attribute: 'motion',
                trigger: 'Always',
              },
            },
            right: { string: 'active' },
          },
          then: [],
        },
      }],
    };

    const automation = ruleToAutomation(rule);

    expect(automation.triggers).toContain('Motion detected');
  });

  it('should extract switch command', () => {
    const rule: Rule = {
      id: 'rule-1',
      name: 'Turn On Lights',
      actions: [{
        command: {
          devices: ['light-uuid'],
          commands: [{
            component: 'main',
            capability: 'switch',
            command: 'on',
          }],
        },
      }],
    };

    const automation = ruleToAutomation(rule);

    expect(automation.actions).toContain('Turn on lights');
  });
});
```

### 9.2 Integration Tests

**Test API Routes:**

**File:** `/web/src/routes/api/automations/+server.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.js';

// Mock ServiceContainer
vi.mock('$lib/server/services', () => ({
  serviceContainer: {
    getAutomationService: vi.fn(() => ({
      listRules: vi.fn(async () => [
        {
          id: 'rule-1',
          name: 'Test Rule',
          status: 'Enabled',
          actions: [],
        },
      ]),
    })),
  },
  getDefaultLocationId: vi.fn(() => 'location-1'),
}));

describe('GET /api/automations', () => {
  it('should return automations', async () => {
    const url = new URL('http://localhost/api/automations');
    const request = new Request(url);

    const response = await GET({ url, request } as any);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.count).toBe(1);
    expect(data.data.automations[0].id).toBe('rule-1');
  });

  it('should handle errors gracefully', async () => {
    // Mock error
    vi.mocked(serviceContainer.getAutomationService).mockImplementation(() => ({
      listRules: vi.fn(() => Promise.reject(new Error('API error'))),
    }));

    const url = new URL('http://localhost/api/automations');
    const request = new Request(url);

    const response = await GET({ url, request } as any);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error.message).toContain('API error');
  });
});
```

### 9.3 Manual Testing

**Test Checklist:**

1. ✅ **List automations**: Visit `/automations` page, verify real data loads
2. ✅ **Toggle automation**: Click toggle switch, verify state changes
3. ✅ **Loading state**: Refresh page, verify loading indicator appears
4. ✅ **Error handling**: Disconnect from SmartThings, verify error message
5. ✅ **Empty state**: Delete all rules via SmartThings app, verify empty state
6. ✅ **Real-time updates**: Create rule via SmartThings app, refresh page, verify appears

**Test Data:**

Create test rules via SmartThings app or MCP tools:
- Motion-activated lights
- Scheduled action (sunset)
- Temperature control
- Door/window notification

---

## 10. Deployment Checklist

### 10.1 Pre-Deployment

- [ ] **Environment variables configured**
  - `SMARTTHINGS_LOCATION_ID` set in `.env`
  - `SMARTTHINGS_TOKEN` valid and not expired

- [ ] **Backend services running**
  - ServiceContainer initialized
  - AutomationService accessible
  - SmartThings API connection verified

- [ ] **Unit tests passing**
  - Data transformer tests
  - API route tests

- [ ] **Type checking passing**
  - `pnpm typecheck` in `/web`
  - No TypeScript errors

### 10.2 Deployment Steps

1. **Build web application**
   ```bash
   cd /Users/masa/Projects/mcp-smartthings
   pnpm build:web
   ```

2. **Start development server (testing)**
   ```bash
   pnpm dev:web
   ```

3. **Verify endpoints**
   - http://localhost:5173/api/automations
   - http://localhost:5173/automations

4. **Test frontend integration**
   - Load automations page
   - Toggle automation
   - Verify real data appears

5. **Production deployment**
   ```bash
   pnpm build:all
   pnpm start  # Or deploy to hosting platform
   ```

### 10.3 Post-Deployment Verification

- [ ] **Automations page loads without errors**
- [ ] **Real SmartThings rules appear (not mock data)**
- [ ] **Toggle switches work correctly**
- [ ] **Loading states appear during fetch**
- [ ] **Error handling works (disconnect test)**
- [ ] **Performance acceptable (<500ms for list)**

### 10.4 Rollback Plan

**If deployment fails:**

1. **Restore mock data**
   - Revert changes to `automationStore.svelte.ts`
   - Re-enable mock data fallback

2. **Remove API routes**
   - Delete `/web/src/routes/api/automations/+server.ts`
   - Delete `/web/src/routes/api/automations/[id]/toggle/+server.ts`

3. **Redeploy previous version**
   ```bash
   git revert HEAD
   pnpm build:web
   ```

---

## Key Findings Summary

### What Exists (Backend)

✅ **AutomationService.ts** (579 lines)
- Fully implemented rule CRUD operations
- 5-minute caching with device indexing
- SmartThings Rules API integration

✅ **SmartThingsAdapter.ts** (Rules API methods)
- `listRules()` - Fetch all rules for location
- `createRule()` - Create new automation
- `updateRule()` - Update existing automation
- `deleteRule()` - Delete automation
- `executeRule()` - Manually trigger automation

✅ **MCP Automation Tools** (923 lines)
- 6 automation tools for Claude integration
- 6 automation templates (motion_lights, door_notification, etc.)
- Zod validation schemas
- Template-based rule building

### What Exists (Frontend)

✅ **automationStore.svelte.ts** (254 lines)
- Svelte 5 Runes-based state management
- API-ready with graceful fallback to mock data
- Toggle automation support
- Loading/error state handling

✅ **UI Components**
- AutomationsGrid.svelte - Layout
- AutomationCard.svelte - Individual cards
- Responsive design with Tailwind CSS

### What's Missing

❌ **SvelteKit API Routes**
- No `/api/automations` endpoint
- No `/api/automations/{id}/toggle` endpoint

❌ **Data Transformation**
- No SmartThings Rule → Frontend Automation transformer
- Need capability/command → human-readable mappings

❌ **Service Integration**
- No shared service module for SvelteKit routes
- Backend ServiceContainer not accessible from frontend

### Implementation Effort

**Total Time:** 2-3 hours

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Data transformation layer | 30 mins |
| 2 | Shared service module | 15 mins |
| 3 | API route - List automations | 30 mins |
| 4 | API route - Toggle automation | 30 mins |
| 5 | Remove mock data | 15 mins |
| Testing | Manual testing + verification | 30 mins |

---

## Next Steps

1. **Create data transformer** (`/web/src/lib/server/transformers/ruleToAutomation.ts`)
2. **Create shared service module** (`/web/src/lib/server/services.ts`)
3. **Implement GET /api/automations** (`/web/src/routes/api/automations/+server.ts`)
4. **Implement POST /api/automations/{id}/toggle**
5. **Remove mock data** from `automationStore.svelte.ts`
6. **Test end-to-end** with real SmartThings account
7. **Deploy** and verify in production

---

## References

1. **SmartThings Rules API Documentation**
   - https://developer.smartthings.com/docs/api/public#tag/Rules

2. **@smartthings/core-sdk Documentation**
   - https://www.npmjs.com/package/@smartthings/core-sdk
   - Version: 8.0.0

3. **SvelteKit API Routes**
   - https://kit.svelte.dev/docs/routing#server
   - https://kit.svelte.dev/docs/load#making-fetch-requests

4. **Project Architecture Documents**
   - `/docs/research/smartthings-rules-api-automation-implementation-2025-11-29.md`
   - `/docs/research/dual-mode-mcp-architecture-2025-11-29.md`

5. **Existing Implementation**
   - `/src/services/AutomationService.ts` - Backend service
   - `/src/mcp/tools/automation.ts` - MCP automation tools
   - `/web/src/lib/stores/automationStore.svelte.ts` - Frontend store

---

**Research Complete - Ready for Implementation**
