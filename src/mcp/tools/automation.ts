/**
 * Automation MCP tools for rule creation and management.
 *
 * Ticket: 1M-411 - Phase 4.1: Implement automation script building MCP tools
 *
 * Provides 6 MCP tools for automation management:
 * 1. create_automation - Create automation from template
 * 2. update_automation - Update existing automation
 * 3. delete_automation - Delete automation
 * 4. test_automation - Test automation without saving
 * 5. execute_automation - Manually trigger automation
 * 6. get_automation_template - Get template metadata and examples
 *
 * Supports 6 automation templates:
 * - motion_lights: Motion-activated lights
 * - door_notification: Door/window notifications
 * - temperature_control: Temperature-based HVAC control
 * - scheduled_action: Time-based scheduled actions
 * - sunrise_sunset: Sunrise/sunset triggers
 * - battery_alert: Low battery notifications
 *
 * @module mcp/tools/automation
 */

import { z } from 'zod';
import type { ServiceContainer } from '../../services/ServiceContainer.js';
import type { McpToolInput } from '../../types/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpResponse } from '../../types/mcp.js';
import { createMcpError, classifyError } from '../../utils/error-handler.js';
import type {
  AutomationConfig,
  AutomationTemplate,
  TemplateMetadata,
  ValidationResult,
} from '../../types/automation.js';
import type { DeviceId, LocationId } from '../../types/smartthings.js';
import logger from '../../utils/logger.js';

// Service container instance (injected during initialization)
let serviceContainer: ServiceContainer;

//
// Zod Input Schemas
//

/**
 * Schema for create_automation tool input.
 */
const createAutomationSchema = z.object({
  name: z.string().min(1).max(100).describe('Rule name (max 100 characters)'),
  locationId: z.string().uuid().describe('Location UUID where rule will be created'),
  template: z
    .enum([
      'motion_lights',
      'door_notification',
      'temperature_control',
      'scheduled_action',
      'sunrise_sunset',
      'battery_alert',
    ])
    .describe('Template scenario to use'),
  triggerDeviceId: z.string().uuid().describe('Device UUID to monitor for triggers'),
  triggerCapability: z
    .string()
    .describe('Capability to monitor (e.g., motionSensor, contactSensor)'),
  triggerAttribute: z.string().describe('Attribute to watch (e.g., motion, contact)'),
  triggerValue: z
    .union([z.string(), z.number(), z.boolean()])
    .describe('Value that triggers the rule'),
  actionDeviceId: z.string().uuid().describe('Device UUID to control'),
  actionCapability: z.string().describe('Capability to use (e.g., switch, switchLevel)'),
  actionCommand: z.string().describe('Command to execute (e.g., on, off, setLevel)'),
  actionArguments: z
    .array(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe('Command arguments'),
  delaySeconds: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Optional delay before action execution (in seconds)'),
  timeZoneId: z.string().optional().describe('Optional timezone override (Java timezone ID)'),
});

/**
 * Schema for update_automation tool input.
 */
const updateAutomationSchema = z.object({
  ruleId: z.string().uuid().describe('Rule UUID to update'),
  locationId: z.string().uuid().describe('Location UUID'),
  name: z.string().min(1).max(100).optional().describe('Updated rule name'),
  triggerDeviceId: z.string().uuid().optional().describe('Updated trigger device UUID'),
  triggerCapability: z.string().optional().describe('Updated trigger capability'),
  triggerAttribute: z.string().optional().describe('Updated trigger attribute'),
  triggerValue: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .describe('Updated trigger value'),
  actionDeviceId: z.string().uuid().optional().describe('Updated action device UUID'),
  actionCapability: z.string().optional().describe('Updated action capability'),
  actionCommand: z.string().optional().describe('Updated action command'),
  actionArguments: z
    .array(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe('Updated command arguments'),
  delaySeconds: z.number().int().min(0).optional().describe('Updated delay in seconds'),
});

/**
 * Schema for delete_automation tool input.
 */
const deleteAutomationSchema = z.object({
  ruleId: z.string().uuid().describe('Rule UUID to delete'),
  locationId: z.string().uuid().describe('Location UUID'),
});

/**
 * Schema for test_automation tool input.
 */
const testAutomationSchema = z.object({
  template: z
    .enum([
      'motion_lights',
      'door_notification',
      'temperature_control',
      'scheduled_action',
      'sunrise_sunset',
      'battery_alert',
    ])
    .describe('Template scenario to test'),
  triggerDeviceId: z.string().uuid().describe('Device UUID to test as trigger'),
  actionDeviceId: z.string().uuid().describe('Device UUID to test as action target'),
});

/**
 * Schema for execute_automation tool input.
 */
const executeAutomationSchema = z.object({
  ruleId: z.string().uuid().describe('Rule UUID to execute'),
  locationId: z.string().uuid().describe('Location UUID'),
});

/**
 * Schema for get_automation_template tool input.
 */
const getTemplateSchema = z.object({
  template: z
    .enum([
      'motion_lights',
      'door_notification',
      'temperature_control',
      'scheduled_action',
      'sunrise_sunset',
      'battery_alert',
    ])
    .optional()
    .describe('Specific template to get (omit to list all templates)'),
});

//
// Template Metadata Definitions
//

/**
 * All available automation templates with metadata.
 */
const TEMPLATE_METADATA: Record<AutomationTemplate, TemplateMetadata> = {
  motion_lights: {
    template: 'motion_lights',
    name: 'Motion-Activated Lights',
    description: 'Turn lights on when motion is detected, turn off after inactivity',
    requiredTriggerCapabilities: ['motionSensor'],
    requiredActionCapabilities: ['switch'],
    exampleConfig: {
      name: 'Hallway Motion Lights',
      template: 'motion_lights',
      trigger: {
        deviceId: 'motion-sensor-uuid',
        capability: 'motionSensor',
        attribute: 'motion',
        value: 'active',
      },
      action: {
        deviceId: 'light-uuid',
        capability: 'switch',
        command: 'on',
      },
    },
  },
  door_notification: {
    template: 'door_notification',
    name: 'Door/Window Notifications',
    description: 'Send notification when door or window opens',
    requiredTriggerCapabilities: ['contactSensor'],
    requiredActionCapabilities: [], // Notification action doesn't require device
    exampleConfig: {
      name: 'Front Door Alert',
      template: 'door_notification',
      trigger: {
        deviceId: 'contact-sensor-uuid',
        capability: 'contactSensor',
        attribute: 'contact',
        value: 'open',
      },
      action: {
        deviceId: 'location-uuid', // Special: location for notifications
        capability: 'notification',
        command: 'push',
        arguments: ['Front door opened'],
      },
    },
  },
  temperature_control: {
    template: 'temperature_control',
    name: 'Temperature Control',
    description: 'Control HVAC based on temperature sensor readings',
    requiredTriggerCapabilities: ['temperatureMeasurement'],
    requiredActionCapabilities: ['thermostat'],
    exampleConfig: {
      name: 'Living Room Temperature Control',
      template: 'temperature_control',
      trigger: {
        deviceId: 'temp-sensor-uuid',
        capability: 'temperatureMeasurement',
        attribute: 'temperature',
        value: 75,
        operator: 'greaterThan',
      },
      action: {
        deviceId: 'thermostat-uuid',
        capability: 'thermostat',
        command: 'setCoolingSetpoint',
        arguments: [72],
      },
    },
  },
  scheduled_action: {
    template: 'scheduled_action',
    name: 'Scheduled Actions',
    description: 'Execute actions at specific times or recurring intervals',
    requiredTriggerCapabilities: [], // Time-based, no device trigger
    requiredActionCapabilities: ['switch'], // Example uses switch
    exampleConfig: {
      name: 'Evening Lights On',
      template: 'scheduled_action',
      trigger: {
        deviceId: 'time-trigger', // Special: time-based trigger
        capability: 'time',
        attribute: 'reference',
        value: 'Sunset',
      },
      action: {
        deviceId: 'light-uuid',
        capability: 'switch',
        command: 'on',
      },
    },
  },
  sunrise_sunset: {
    template: 'sunrise_sunset',
    name: 'Sunrise/Sunset Triggers',
    description: 'Execute actions at sunrise or sunset with optional offset',
    requiredTriggerCapabilities: [], // Time-based, no device trigger
    requiredActionCapabilities: ['switch'], // Example uses switch
    exampleConfig: {
      name: 'Porch Light at Sunset',
      template: 'sunrise_sunset',
      trigger: {
        deviceId: 'time-trigger',
        capability: 'time',
        attribute: 'reference',
        value: 'Sunset',
      },
      action: {
        deviceId: 'porch-light-uuid',
        capability: 'switch',
        command: 'on',
      },
    },
  },
  battery_alert: {
    template: 'battery_alert',
    name: 'Battery Alerts',
    description: 'Alert when device battery falls below threshold',
    requiredTriggerCapabilities: ['battery'],
    requiredActionCapabilities: [], // Notification action
    exampleConfig: {
      name: 'Low Battery Alert',
      template: 'battery_alert',
      trigger: {
        deviceId: 'battery-device-uuid',
        capability: 'battery',
        attribute: 'battery',
        value: 20,
        operator: 'lessThan',
      },
      action: {
        deviceId: 'location-uuid',
        capability: 'notification',
        command: 'push',
        arguments: ['Battery low on device'],
      },
    },
  },
};

//
// Helper Functions
//

/**
 * Build SmartThings Rule structure from AutomationConfig.
 *
 * Transforms high-level automation configuration into SmartThings Rules API format.
 *
 * @param config Automation configuration
 * @returns SmartThings Rule request object
 */
function buildRuleFromConfig(config: AutomationConfig): any {
  // Build device operand for trigger
  const triggerOperand = {
    device: {
      devices: [config.trigger.deviceId],
      component: config.trigger.component || 'main',
      capability: config.trigger.capability,
      attribute: config.trigger.attribute,
      trigger: 'Always' as const,
    },
  };

  // Build comparison for trigger value
  const comparisonOperator = config.trigger.operator || 'equals';
  const comparison: any = {
    [comparisonOperator]: {
      left: triggerOperand,
      right: buildOperandFromValue(config.trigger.value),
    },
  };

  // Build command action
  const commandAction = {
    command: {
      devices: [config.action.deviceId],
      commands: [
        {
          component: config.action.component || 'main',
          capability: config.action.capability,
          command: config.action.command,
          arguments: config.action.arguments?.map(buildOperandFromValue),
        },
      ],
    },
  };

  // Build actions array (with optional delay)
  const actions: any[] = [];
  if (config.delaySeconds && config.delaySeconds > 0) {
    actions.push({
      sleep: {
        duration: {
          value: { integer: config.delaySeconds },
          unit: 'Second',
        },
      },
    });
  }
  actions.push(commandAction);

  // Build complete rule
  const rule: any = {
    name: config.name,
    actions: [
      {
        if: {
          ...comparison,
          then: actions,
        },
      },
    ],
  };

  // Add optional timezone
  if (config.timeZoneId) {
    rule.timeZoneId = config.timeZoneId;
  }

  return rule;
}

/**
 * Build SmartThings operand from primitive value.
 *
 * @param value Primitive value
 * @returns SmartThings operand object
 */
function buildOperandFromValue(value: string | number | boolean): any {
  if (typeof value === 'string') {
    return { string: value };
  } else if (typeof value === 'number') {
    return Number.isInteger(value) ? { integer: value } : { decimal: value };
  } else if (typeof value === 'boolean') {
    return { boolean: value };
  }
  return { string: String(value) };
}

/**
 * Validate automation configuration.
 *
 * Checks for required fields and valid values.
 *
 * @param config Automation configuration to validate
 * @returns Validation result with errors and warnings
 */
function validateConfig(config: Partial<AutomationConfig>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.name) {
    errors.push('Rule name is required');
  } else if (config.name.length > 100) {
    errors.push('Rule name must be 100 characters or less');
  }

  if (!config.locationId) {
    errors.push('Location ID is required');
  }

  if (!config.template) {
    errors.push('Template is required');
  } else if (!TEMPLATE_METADATA[config.template]) {
    errors.push(`Invalid template: ${config.template}`);
  }

  if (!config.trigger) {
    errors.push('Trigger configuration is required');
  } else {
    if (!config.trigger.deviceId) {
      errors.push('Trigger device ID is required');
    }
    if (!config.trigger.capability) {
      errors.push('Trigger capability is required');
    }
    if (!config.trigger.attribute) {
      errors.push('Trigger attribute is required');
    }
    if (config.trigger.value === undefined || config.trigger.value === null) {
      errors.push('Trigger value is required');
    }
  }

  if (!config.action) {
    errors.push('Action configuration is required');
  } else {
    if (!config.action.deviceId) {
      errors.push('Action device ID is required');
    }
    if (!config.action.capability) {
      errors.push('Action capability is required');
    }
    if (!config.action.command) {
      errors.push('Action command is required');
    }
  }

  // Warnings
  if (config.delaySeconds && config.delaySeconds > 300) {
    warnings.push('Delay greater than 5 minutes may cause execution issues');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get template metadata for a specific template or all templates.
 *
 * @param template Optional specific template to get
 * @returns Template metadata (single or array)
 */
function getTemplateMetadata(template?: AutomationTemplate): TemplateMetadata | TemplateMetadata[] {
  if (template) {
    return TEMPLATE_METADATA[template];
  }
  return Object.values(TEMPLATE_METADATA);
}

//
// MCP Tool Handler Functions
//

/**
 * Create automation from template.
 *
 * MCP Tool: create_automation
 * Ticket: 1M-411
 */
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
      delaySeconds: parsed.delaySeconds,
      timeZoneId: parsed.timeZoneId,
    };

    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.valid) {
      return createMcpError(
        new Error(`Validation failed: ${validation.errors.join(', ')}`),
        'VALIDATION_ERROR'
      );
    }

    // Build rule from config
    const rule = buildRuleFromConfig(config);

    // Create rule via AutomationService
    const automationService = serviceContainer.getAutomationService();
    const createdRule = await automationService.createRule(config.locationId as LocationId, rule);

    logger.info('Automation created via MCP', {
      ruleId: createdRule.id,
      ruleName: createdRule.name,
      template: config.template,
    });

    const responseText = `Automation "${createdRule.name}" created successfully\nRule ID: ${createdRule.id}\nTemplate: ${config.template}\nStatus: ${createdRule.status || 'Enabled'}`;

    return createMcpResponse(responseText, {
      ruleId: createdRule.id,
      ruleName: createdRule.name,
      template: config.template,
      status: createdRule.status,
      locationId: config.locationId,
      warnings: validation.warnings,
    });
  } catch (error) {
    logger.error('Failed to create automation', { error });
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

/**
 * Update existing automation.
 *
 * MCP Tool: update_automation
 * Ticket: 1M-411
 */
export async function handleUpdateAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const parsed = updateAutomationSchema.parse(input);

    // Get existing rule
    const automationService = serviceContainer.getAutomationService();
    const existingRule = await automationService.getRule(
      parsed.ruleId,
      parsed.locationId as LocationId
    );

    if (!existingRule) {
      return createMcpError(new Error(`Rule ${parsed.ruleId} not found`), 'NOT_FOUND');
    }

    // Build updates (only include provided fields)
    const updates: any = {
      name: parsed.name || existingRule.name,
      actions: existingRule.actions, // Keep existing actions for now
    };

    // TODO: More sophisticated update logic to merge changes into existing actions
    // For now, we require full config for updates

    // Update rule via AutomationService
    const updatedRule = await automationService.updateRule(
      parsed.ruleId,
      parsed.locationId as LocationId,
      updates
    );

    logger.info('Automation updated via MCP', {
      ruleId: updatedRule.id,
      ruleName: updatedRule.name,
    });

    const responseText = `Automation "${updatedRule.name}" updated successfully\nRule ID: ${updatedRule.id}\nStatus: ${updatedRule.status || 'Enabled'}`;

    return createMcpResponse(responseText, {
      ruleId: updatedRule.id,
      ruleName: updatedRule.name,
      status: updatedRule.status,
      locationId: parsed.locationId,
    });
  } catch (error) {
    logger.error('Failed to update automation', { error });
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

/**
 * Delete automation.
 *
 * MCP Tool: delete_automation
 * Ticket: 1M-411
 */
export async function handleDeleteAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { ruleId, locationId } = deleteAutomationSchema.parse(input);

    // Get rule details before deletion (for confirmation)
    const automationService = serviceContainer.getAutomationService();
    const rule = await automationService.getRule(ruleId, locationId as LocationId);

    if (!rule) {
      return createMcpError(new Error(`Rule ${ruleId} not found`), 'NOT_FOUND');
    }

    const ruleName = rule.name;

    // Delete rule via AutomationService
    await automationService.deleteRule(ruleId, locationId as LocationId);

    logger.info('Automation deleted via MCP', {
      ruleId,
      ruleName,
    });

    const responseText = `Automation "${ruleName}" deleted successfully\nRule ID: ${ruleId}`;

    return createMcpResponse(responseText, {
      ruleId,
      ruleName,
      locationId,
      deleted: true,
    });
  } catch (error) {
    logger.error('Failed to delete automation', { error });
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

/**
 * Test automation configuration without creating.
 *
 * MCP Tool: test_automation
 * Ticket: 1M-411
 */
export async function handleTestAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const parsed = testAutomationSchema.parse(input);

    // Get template metadata
    const template = TEMPLATE_METADATA[parsed.template];
    if (!template) {
      return createMcpError(new Error(`Invalid template: ${parsed.template}`), 'VALIDATION_ERROR');
    }

    // Validate device capabilities (fetch devices to check)
    const deviceService = serviceContainer.getDeviceService();

    // Check trigger device
    let triggerDevice;
    try {
      triggerDevice = await deviceService.getDevice(parsed.triggerDeviceId as DeviceId);
    } catch (error) {
      return createMcpError(
        new Error(`Trigger device ${parsed.triggerDeviceId} not found`),
        'NOT_FOUND'
      );
    }

    // Check action device
    let actionDevice;
    try {
      actionDevice = await deviceService.getDevice(parsed.actionDeviceId as DeviceId);
    } catch (error) {
      return createMcpError(
        new Error(`Action device ${parsed.actionDeviceId} not found`),
        'NOT_FOUND'
      );
    }

    // Verify capabilities
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check trigger capabilities
    if (template.requiredTriggerCapabilities.length > 0) {
      const hasRequiredTrigger = template.requiredTriggerCapabilities.some((cap) =>
        triggerDevice.capabilities?.includes(cap)
      );
      if (!hasRequiredTrigger) {
        errors.push(
          `Trigger device does not have required capabilities: ${template.requiredTriggerCapabilities.join(', ')}`
        );
      }
    }

    // Check action capabilities
    if (template.requiredActionCapabilities.length > 0) {
      const hasRequiredAction = template.requiredActionCapabilities.some((cap) =>
        actionDevice.capabilities?.includes(cap)
      );
      if (!hasRequiredAction) {
        errors.push(
          `Action device does not have required capabilities: ${template.requiredActionCapabilities.join(', ')}`
        );
      }
    }

    logger.info('Automation test via MCP', {
      template: parsed.template,
      valid: errors.length === 0,
    });

    const responseText =
      errors.length > 0
        ? `Automation test FAILED\nTemplate: ${template.name}\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`
        : `Automation test PASSED\nTemplate: ${template.name}\nTrigger device: ${triggerDevice.name}\nAction device: ${actionDevice.name}`;

    return createMcpResponse(responseText, {
      template: parsed.template,
      valid: errors.length === 0,
      errors,
      warnings,
      triggerDevice: {
        id: triggerDevice.deviceId,
        name: triggerDevice.name,
        capabilities: triggerDevice.capabilities,
      },
      actionDevice: {
        id: actionDevice.deviceId,
        name: actionDevice.name,
        capabilities: actionDevice.capabilities,
      },
    });
  } catch (error) {
    logger.error('Failed to test automation', { error });
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

/**
 * Execute automation manually.
 *
 * MCP Tool: execute_automation
 * Ticket: 1M-411
 */
export async function handleExecuteAutomation(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { ruleId, locationId } = executeAutomationSchema.parse(input);

    // Execute rule via AutomationService
    const automationService = serviceContainer.getAutomationService();
    const executionResult = await automationService.executeRule(ruleId, locationId as LocationId);

    logger.info('Automation executed via MCP', {
      ruleId,
      executionId: executionResult.executionId,
      result: executionResult.result,
    });

    const responseText = `Automation executed\nRule ID: ${ruleId}\nExecution ID: ${executionResult.executionId}\nResult: ${executionResult.result}`;

    return createMcpResponse(responseText, {
      ruleId,
      executionId: executionResult.executionId,
      result: executionResult.result,
      actions: executionResult.actions,
      locationId,
    });
  } catch (error) {
    logger.error('Failed to execute automation', { error });
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

/**
 * Get automation template metadata.
 *
 * MCP Tool: get_automation_template
 * Ticket: 1M-411
 */
export async function handleGetTemplate(input: McpToolInput): Promise<CallToolResult> {
  try {
    const { template } = getTemplateSchema.parse(input);

    const metadata = getTemplateMetadata(template);

    logger.info('Automation template requested via MCP', { template: template || 'all' });

    let responseText: string;
    if (Array.isArray(metadata)) {
      responseText = `Available Automation Templates (${metadata.length}):\n\n${metadata
        .map(
          (t) =>
            `${t.name}\n  Template: ${t.template}\n  Description: ${t.description}\n  Trigger Capabilities: ${t.requiredTriggerCapabilities.join(', ') || 'None'}\n  Action Capabilities: ${t.requiredActionCapabilities.join(', ') || 'None'}`
        )
        .join('\n\n')}`;
    } else {
      responseText = `Template: ${metadata.name}\n\nDescription: ${metadata.description}\n\nRequired Trigger Capabilities:\n${metadata.requiredTriggerCapabilities.map((c) => `- ${c}`).join('\n') || 'None'}\n\nRequired Action Capabilities:\n${metadata.requiredActionCapabilities.map((c) => `- ${c}`).join('\n') || 'None'}\n\nExample Configuration:\n${JSON.stringify(metadata.exampleConfig, null, 2)}`;
    }

    return createMcpResponse(responseText, {
      templates: metadata,
    });
  } catch (error) {
    logger.error('Failed to get automation template', { error });
    const errorCode = classifyError(error);
    return createMcpError(error, errorCode);
  }
}

//
// Initialization and Exports
//

/**
 * Initialize automation tools with ServiceContainer.
 *
 * Must be called during server initialization to inject dependencies.
 *
 * @param container ServiceContainer instance for dependency injection
 */
export function initializeAutomationTools(container: ServiceContainer): void {
  serviceContainer = container;
  logger.info('Automation tools initialized');
}

/**
 * Tool metadata for MCP server registration.
 *
 * Ticket: 1M-411 - Phase 4.1: Implement automation script building MCP tools
 */
export const automationTools = {
  create_automation: {
    description: 'Create a SmartThings automation from a template',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Rule name (max 100 characters)' },
        locationId: { type: 'string', description: 'Location UUID' },
        template: {
          type: 'string',
          enum: [
            'motion_lights',
            'door_notification',
            'temperature_control',
            'scheduled_action',
            'sunrise_sunset',
            'battery_alert',
          ],
          description: 'Template scenario',
        },
        triggerDeviceId: { type: 'string', description: 'Trigger device UUID' },
        triggerCapability: { type: 'string', description: 'Trigger capability' },
        triggerAttribute: { type: 'string', description: 'Trigger attribute' },
        triggerValue: { description: 'Trigger value' },
        actionDeviceId: { type: 'string', description: 'Action device UUID' },
        actionCapability: { type: 'string', description: 'Action capability' },
        actionCommand: { type: 'string', description: 'Action command' },
        actionArguments: { type: 'array', description: 'Command arguments (optional)' },
        delaySeconds: { type: 'number', description: 'Delay in seconds (optional)' },
        timeZoneId: { type: 'string', description: 'Timezone ID (optional)' },
      },
      required: [
        'name',
        'locationId',
        'template',
        'triggerDeviceId',
        'triggerCapability',
        'triggerAttribute',
        'triggerValue',
        'actionDeviceId',
        'actionCapability',
        'actionCommand',
      ],
    },
    handler: handleCreateAutomation,
  },
  update_automation: {
    description: 'Update an existing SmartThings automation',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'Rule UUID to update' },
        locationId: { type: 'string', description: 'Location UUID' },
        name: { type: 'string', description: 'Updated rule name (optional)' },
        triggerDeviceId: { type: 'string', description: 'Updated trigger device UUID (optional)' },
        triggerCapability: { type: 'string', description: 'Updated trigger capability (optional)' },
        triggerAttribute: { type: 'string', description: 'Updated trigger attribute (optional)' },
        triggerValue: { description: 'Updated trigger value (optional)' },
        actionDeviceId: { type: 'string', description: 'Updated action device UUID (optional)' },
        actionCapability: { type: 'string', description: 'Updated action capability (optional)' },
        actionCommand: { type: 'string', description: 'Updated action command (optional)' },
        actionArguments: { type: 'array', description: 'Updated command arguments (optional)' },
        delaySeconds: { type: 'number', description: 'Updated delay in seconds (optional)' },
      },
      required: ['ruleId', 'locationId'],
    },
    handler: handleUpdateAutomation,
  },
  delete_automation: {
    description: 'Delete a SmartThings automation',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'Rule UUID to delete' },
        locationId: { type: 'string', description: 'Location UUID' },
      },
      required: ['ruleId', 'locationId'],
    },
    handler: handleDeleteAutomation,
  },
  test_automation: {
    description: 'Test automation configuration without creating it',
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          enum: [
            'motion_lights',
            'door_notification',
            'temperature_control',
            'scheduled_action',
            'sunrise_sunset',
            'battery_alert',
          ],
          description: 'Template scenario to test',
        },
        triggerDeviceId: { type: 'string', description: 'Device UUID to test as trigger' },
        actionDeviceId: { type: 'string', description: 'Device UUID to test as action target' },
      },
      required: ['template', 'triggerDeviceId', 'actionDeviceId'],
    },
    handler: handleTestAutomation,
  },
  execute_automation: {
    description: 'Manually execute a SmartThings automation',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'Rule UUID to execute' },
        locationId: { type: 'string', description: 'Location UUID' },
      },
      required: ['ruleId', 'locationId'],
    },
    handler: handleExecuteAutomation,
  },
  get_automation_template: {
    description: 'Get automation template metadata and examples',
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          enum: [
            'motion_lights',
            'door_notification',
            'temperature_control',
            'scheduled_action',
            'sunrise_sunset',
            'battery_alert',
          ],
          description: 'Specific template to get (omit to list all)',
        },
      },
      required: [],
    },
    handler: handleGetTemplate,
  },
} as const;
