/**
 * LLM-based rule generation for conversational rule creation
 *
 * Design Decision: OpenRouter + Claude for rule generation
 * Rationale: Allow users to create rules using natural language like
 * "turn on lights when motion detected" and generate valid rule JSON.
 *
 * Architecture:
 * - generateRuleFromPrompt: Main entry point for LLM generation
 * - mockGenerateRule: Fallback pattern matching for testing without LLM
 * - explainRule: Convert rule back to human-readable description
 *
 * Performance:
 * - LLM generation: ~2-5s (network latency)
 * - Mock generation: <10ms (pattern matching)
 * - Explanation: <5ms (string formatting)
 */

import logger from '../utils/logger.js';
import {
  CreateRuleRequest,
  Rule,
  RuleTrigger,
  RuleAction,
} from './types.js';
import {
  getEventAnalyzer,
  PatternSuggestion,
  DetectedPattern,
  TimePattern,
  CorrelationPattern,
} from './event-analyzer.js';

// System prompt for rule generation
const RULE_GENERATION_PROMPT = `You are a smart home automation expert. Generate a rule in JSON format based on the user's request.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Available trigger types:
- device_state: Trigger when a device attribute changes
  Example: {"type": "device_state", "deviceId": "DEVICE_ID", "attribute": "switch", "operator": "equals", "value": "on"}

Available action types:
- device_command: Control a device
  Example: {"type": "device_command", "deviceId": "DEVICE_ID", "command": "on"}
  With arguments: {"type": "device_command", "deviceId": "DEVICE_ID", "command": "setLevel", "arguments": {"level": 50}}

Operators: equals, notEquals, greaterThan, lessThan, between

Rule structure:
{
  "name": "Rule name",
  "description": "What this rule does",
  "enabled": true,
  "priority": 50,
  "triggers": [...],
  "actions": [...]
}`;

export interface DeviceInfo {
  id: string;
  name: string;
  roomName?: string;
  capabilities: string[];
}

export interface GenerateRuleOptions {
  prompt: string;
  availableDevices?: DeviceInfo[];
  llmClient?: any; // OpenRouter client
}

/**
 * Generate a rule from natural language using LLM
 */
export async function generateRuleFromPrompt(
  options: GenerateRuleOptions
): Promise<CreateRuleRequest | null> {
  const { prompt, availableDevices, llmClient } = options;

  if (!llmClient) {
    logger.warn('[RuleGenerator] No LLM client provided, using mock generation');
    return mockGenerateRule(prompt, availableDevices);
  }

  try {
    // Build device context
    const deviceContext = availableDevices?.length
      ? `\n\nAvailable devices:\n${availableDevices
          .map(
            (d) =>
              `- ${d.name} (ID: ${d.id}, Room: ${d.roomName || 'Unknown'}, Capabilities: ${d.capabilities.join(', ')})`
          )
          .join('\n')}`
      : '';

    const systemPrompt = RULE_GENERATION_PROMPT + deviceContext;

    const response = await llmClient.chat.completions.create({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a rule for: ${prompt}` },
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const rule = JSON.parse(jsonMatch[0]) as CreateRuleRequest;

    // Validate required fields
    if (!rule.name || !rule.triggers?.length || !rule.actions?.length) {
      throw new Error('Invalid rule structure: missing required fields');
    }

    logger.info(`[RuleGenerator] Generated rule: ${rule.name}`);
    return rule;
  } catch (error) {
    logger.error('[RuleGenerator] Failed to generate rule:', error);
    return null;
  }
}

/**
 * Mock rule generation for testing without LLM
 */
function mockGenerateRule(
  prompt: string,
  devices?: DeviceInfo[]
): CreateRuleRequest | null {
  const promptLower = prompt.toLowerCase();

  // Simple pattern matching for common requests
  if (promptLower.includes('motion') && promptLower.includes('light')) {
    const motionSensor = devices?.find(
      (d) =>
        d.capabilities.includes('motionSensor') || d.name.toLowerCase().includes('motion')
    );
    const light = devices?.find(
      (d) => d.capabilities.includes('switch') && d.name.toLowerCase().includes('light')
    );

    return {
      name: 'Motion Activated Lights',
      description: `Generated from: "${prompt}"`,
      enabled: true,
      priority: 50,
      triggers: [
        {
          type: 'device_state',
          deviceId: motionSensor?.id || 'motion-sensor-1',
          deviceName: motionSensor?.name || 'Motion Sensor',
          attribute: 'motion',
          operator: 'equals',
          value: 'active',
        },
      ],
      actions: [
        {
          type: 'device_command',
          deviceId: light?.id || 'light-1',
          deviceName: light?.name || 'Light',
          command: 'on',
        },
      ],
    };
  }

  if (promptLower.includes('turn on') || promptLower.includes('turn off')) {
    const isOn = promptLower.includes('turn on');
    const light = devices?.find((d) => d.capabilities.includes('switch'));

    return {
      name: `Turn ${isOn ? 'On' : 'Off'} Light`,
      description: `Generated from: "${prompt}"`,
      enabled: true,
      priority: 50,
      triggers: [
        {
          type: 'device_state',
          deviceId: 'trigger-device',
          attribute: 'switch',
          operator: 'equals',
          value: isOn ? 'off' : 'on',
        },
      ],
      actions: [
        {
          type: 'device_command',
          deviceId: light?.id || 'light-1',
          command: isOn ? 'on' : 'off',
        },
      ],
    };
  }

  // Default: create a basic template rule
  return {
    name: 'Custom Rule',
    description: `Generated from: "${prompt}"`,
    enabled: false, // Disabled by default for custom rules
    priority: 50,
    triggers: [
      {
        type: 'device_state',
        deviceId: 'device-id',
        attribute: 'switch',
        operator: 'equals',
        value: 'on',
      },
    ],
    actions: [
      {
        type: 'device_command',
        deviceId: 'target-device-id',
        command: 'on',
      },
    ],
  };
}

/**
 * Explain a rule in natural language
 */
export function explainRule(rule: Rule): string {
  const triggerDescriptions = rule.triggers.map(describeTrigger);
  const actionDescriptions = rule.actions.map(describeAction);

  return `**${rule.name}**${rule.description ? `\n${rule.description}` : ''}

**When:** ${triggerDescriptions.join(' OR ')}
**Then:** ${actionDescriptions.join(', then ')}

Status: ${rule.enabled ? '✅ Enabled' : '❌ Disabled'}
Executions: ${rule.executionCount}${rule.lastExecutedAt ? ` (last: ${new Date(rule.lastExecutedAt).toLocaleString()})` : ''}`;
}

function describeTrigger(trigger: RuleTrigger): string {
  switch (trigger.type) {
    case 'device_state':
      return `${trigger.deviceName || trigger.deviceId} ${trigger.attribute} ${trigger.operator} ${trigger.value}`;
    case 'time':
      return `at ${trigger.time}${trigger.days?.length ? ` on ${trigger.days.join(', ')}` : ''}`;
    case 'astronomical':
      const offset = trigger.offsetMinutes
        ? ` ${trigger.offsetMinutes > 0 ? '+' : ''}${trigger.offsetMinutes} min`
        : '';
      return `at ${trigger.event}${offset}`;
    case 'cron':
      return `on schedule: ${trigger.expression}`;
    default:
      return 'unknown trigger';
  }
}

function describeAction(action: RuleAction): string {
  switch (action.type) {
    case 'device_command':
      const args = action.arguments ? ` (${JSON.stringify(action.arguments)})` : '';
      return `${action.command} ${action.deviceName || action.deviceId}${args}`;
    case 'delay':
      return `wait ${action.seconds} seconds`;
    case 'sequence':
      return `run ${action.actions.length} actions in ${action.mode || 'serial'}`;
    case 'notification':
      return `notify: "${action.title}"`;
    case 'execute_rule':
      return `execute rule ${action.ruleId}`;
    default:
      return 'unknown action';
  }
}

// ============================================================================
// Pattern-Based Rule Suggestions
// ============================================================================

export interface SuggestionOptions {
  minConfidence?: number;  // Minimum confidence threshold (0-1)
  maxSuggestions?: number; // Maximum suggestions to return
  includeTimePatterns?: boolean;
  includeCorrelations?: boolean;
}

/**
 * Get rule suggestions based on detected patterns from device events
 *
 * Analyzes historical device events to find patterns and generate
 * automation suggestions. Patterns include:
 * - Time patterns: Devices used at consistent times
 * - Correlations: Device A triggers after device B
 *
 * @param options Configuration for suggestion generation
 * @returns Array of pattern suggestions with confidence scores
 */
export function getPatternBasedSuggestions(
  options: SuggestionOptions = {}
): PatternSuggestion[] {
  const {
    minConfidence = 0.3,
    maxSuggestions = 10,
    includeTimePatterns = true,
    includeCorrelations = true,
  } = options;

  const analyzer = getEventAnalyzer();
  let suggestions = analyzer.generateSuggestions();

  // Filter by pattern type
  if (!includeTimePatterns) {
    suggestions = suggestions.filter((s) => s.pattern.type !== 'recurring_time');
  }
  if (!includeCorrelations) {
    suggestions = suggestions.filter((s) => s.pattern.type !== 'device_correlation');
  }

  // Filter by confidence
  suggestions = suggestions.filter((s) => s.pattern.confidence >= minConfidence);

  // Sort by confidence (highest first) and limit
  suggestions.sort((a, b) => b.pattern.confidence - a.pattern.confidence);

  return suggestions.slice(0, maxSuggestions);
}

/**
 * Get detected patterns without generating rules
 *
 * Useful for displaying pattern analysis to users before suggesting rules.
 */
export function getDetectedPatterns(): {
  timePatterns: TimePattern[];
  correlations: CorrelationPattern[];
  stats: { eventsAnalyzed: number; patternsDetected: number };
} {
  const analyzer = getEventAnalyzer();

  return {
    timePatterns: analyzer.detectTimePatterns(),
    correlations: analyzer.detectCorrelations(),
    stats: analyzer.getStats(),
  };
}

/**
 * Describe a detected pattern in human-readable form
 */
export function describePattern(pattern: DetectedPattern): string {
  switch (pattern.type) {
    case 'recurring_time': {
      const timeStr = `${String(pattern.hour).padStart(2, '0')}:${String(pattern.minute).padStart(2, '0')}`;
      const daysStr = pattern.days?.length ? pattern.days.join(', ') : 'every day';
      return `${pattern.deviceName} is frequently set to "${String(pattern.value)}" around ${timeStr} (${daysStr}). Detected ${pattern.occurrences} times with ${Math.round(pattern.confidence * 100)}% confidence.`;
    }

    case 'device_correlation': {
      const delay = pattern.followDevice.delaySeconds;
      const delayStr = delay > 60
        ? `${Math.round(delay / 60)} minutes`
        : `${delay} seconds`;
      return `${pattern.followDevice.deviceName} is often activated ~${delayStr} after ${pattern.leadDevice.deviceName}. Detected ${pattern.occurrences} times.`;
    }

    case 'device_sequence': {
      const deviceNames = pattern.devices.map((d) => d.deviceName).join(' → ');
      return `Sequence detected: ${deviceNames}. Occurred ${pattern.occurrences} times.`;
    }

    default:
      return 'Unknown pattern';
  }
}

/**
 * Generate enhanced prompt with pattern context for LLM
 *
 * Includes detected patterns in the prompt to help LLM generate
 * more relevant automation suggestions.
 */
export function generateEnhancedPrompt(
  userPrompt: string,
  includePatterns = true
): string {
  if (!includePatterns) {
    return userPrompt;
  }

  const analyzer = getEventAnalyzer();
  const suggestions = analyzer.generateSuggestions();

  if (suggestions.length === 0) {
    return userPrompt;
  }

  // Build pattern context
  const patternContext = suggestions
    .slice(0, 5) // Top 5 patterns
    .map((s) => `- ${s.description}`)
    .join('\n');

  return `${userPrompt}

Based on usage patterns detected from your devices:
${patternContext}

Consider these patterns when creating the automation.`;
}

/**
 * Clear recorded events from analyzer
 *
 * Use after patterns have been processed or for testing.
 */
export function clearAnalyzerEvents(): void {
  const analyzer = getEventAnalyzer();
  analyzer.clearEvents();
  logger.info('[RuleGenerator] Event analyzer cleared');
}

/**
 * Get analyzer statistics
 */
export function getAnalyzerStats(): {
  eventsAnalyzed: number;
  patternsDetected: number;
  suggestionsGenerated: number;
} {
  return getEventAnalyzer().getStats();
}
