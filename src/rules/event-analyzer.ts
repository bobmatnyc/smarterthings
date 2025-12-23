// src/rules/event-analyzer.ts

/**
 * Event Analyzer for Rules Engine
 *
 * Analyzes device events to detect patterns and suggest automation rules.
 * Uses historical event data to identify:
 * - Recurring patterns (device used at same time daily)
 * - Correlated events (device A always follows device B)
 * - Unused opportunities (devices that could be automated)
 *
 * Design Decision: Pattern-based analysis with LLM enhancement
 * Rationale: Combine statistical pattern detection with LLM interpretation
 * for human-readable suggestions and intelligent rule generation.
 */

import logger from '../utils/logger.js';
import type { CreateRuleRequest, RuleTrigger, RuleAction } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface DeviceEventRecord {
  deviceId: string;
  deviceName: string;
  attribute: string;
  value: unknown;
  previousValue?: unknown;
  timestamp: Date;
}

export interface TimePattern {
  type: 'recurring_time';
  deviceId: string;
  deviceName: string;
  attribute: string;
  value: unknown;
  hour: number;
  minute: number;
  confidence: number;  // 0-1, how consistent the pattern is
  occurrences: number;
  days?: string[];  // Days of week when pattern occurs
}

export interface CorrelationPattern {
  type: 'device_correlation';
  leadDevice: {
    deviceId: string;
    deviceName: string;
    attribute: string;
    value: unknown;
  };
  followDevice: {
    deviceId: string;
    deviceName: string;
    attribute: string;
    value: unknown;
    delaySeconds: number;  // Average delay between events
  };
  confidence: number;
  occurrences: number;
}

export interface SequencePattern {
  type: 'device_sequence';
  devices: Array<{
    deviceId: string;
    deviceName: string;
    attribute: string;
    value: unknown;
    order: number;
  }>;
  confidence: number;
  occurrences: number;
}

export type DetectedPattern = TimePattern | CorrelationPattern | SequencePattern;

export interface PatternSuggestion {
  pattern: DetectedPattern;
  description: string;
  suggestedRule: CreateRuleRequest;
  reasoning: string;
}

export interface AnalyzerStats {
  eventsAnalyzed: number;
  patternsDetected: number;
  suggestionsGenerated: number;
}

// ============================================================================
// Event Analyzer
// ============================================================================

export class EventAnalyzer {
  private events: DeviceEventRecord[] = [];
  private maxEvents = 10000;  // Keep last 10k events for analysis
  private stats: AnalyzerStats = {
    eventsAnalyzed: 0,
    patternsDetected: 0,
    suggestionsGenerated: 0,
  };

  /**
   * Record a device event for pattern analysis
   */
  recordEvent(event: DeviceEventRecord): void {
    this.events.push(event);
    this.stats.eventsAnalyzed++;

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Detect time-based patterns (devices used at consistent times)
   *
   * Looks for devices that are activated at similar times across multiple days.
   */
  detectTimePatterns(minOccurrences: number = 3, toleranceMinutes: number = 15): TimePattern[] {
    const patterns: TimePattern[] = [];

    // Group events by device and attribute
    const deviceEvents = new Map<string, DeviceEventRecord[]>();

    for (const event of this.events) {
      const key = `${event.deviceId}:${event.attribute}:${String(event.value)}`;
      if (!deviceEvents.has(key)) {
        deviceEvents.set(key, []);
      }
      deviceEvents.get(key)!.push(event);
    }

    // Analyze each device's events for time patterns
    for (const [, events] of deviceEvents) {
      if (events.length < minOccurrences) continue;

      // Group by hour (with tolerance)
      const timeGroups = new Map<string, DeviceEventRecord[]>();

      for (const event of events) {
        const hour = event.timestamp.getHours();
        const minute = Math.floor(event.timestamp.getMinutes() / toleranceMinutes) * toleranceMinutes;
        const timeKey = `${hour}:${minute.toString().padStart(2, '0')}`;

        if (!timeGroups.has(timeKey)) {
          timeGroups.set(timeKey, []);
        }
        timeGroups.get(timeKey)!.push(event);
      }

      // Find significant time groups
      for (const [timeKey, groupEvents] of timeGroups) {
        if (groupEvents.length >= minOccurrences) {
          const [hour, minute] = timeKey.split(':').map(Number);
          const firstEvent = groupEvents[0];

          if (firstEvent && hour !== undefined && minute !== undefined) {
            // Calculate which days the pattern occurs
            const daySet = new Set<string>();
            for (const e of groupEvents) {
              const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][e.timestamp.getDay()];
              if (day) daySet.add(day);
            }

            patterns.push({
              type: 'recurring_time',
              deviceId: firstEvent.deviceId,
              deviceName: firstEvent.deviceName,
              attribute: firstEvent.attribute,
              value: firstEvent.value,
              hour,
              minute,
              confidence: groupEvents.length / events.length,
              occurrences: groupEvents.length,
              days: Array.from(daySet),
            });
          }
        }
      }
    }

    this.stats.patternsDetected += patterns.length;
    return patterns;
  }

  /**
   * Detect device correlations (device A triggers after device B)
   *
   * Looks for devices that are consistently activated within a time window
   * after another device is activated.
   */
  detectCorrelations(
    windowSeconds: number = 300,  // 5 minutes
    minOccurrences: number = 3
  ): CorrelationPattern[] {
    const patterns: CorrelationPattern[] = [];
    const correlationCounts = new Map<string, {
      delays: number[];
      leadEvent: DeviceEventRecord;
      followEvent: DeviceEventRecord;
    }>();

    // Sort events by timestamp
    const sortedEvents = [...this.events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Find events that follow other events
    for (let i = 0; i < sortedEvents.length; i++) {
      const leadEvent = sortedEvents[i];
      if (!leadEvent) continue;

      for (let j = i + 1; j < sortedEvents.length; j++) {
        const followEvent = sortedEvents[j];
        if (!followEvent) continue;

        const delayMs = followEvent.timestamp.getTime() - leadEvent.timestamp.getTime();
        const delaySeconds = delayMs / 1000;

        // Skip if too far apart
        if (delaySeconds > windowSeconds) break;

        // Skip same device
        if (leadEvent.deviceId === followEvent.deviceId) continue;

        const key = `${leadEvent.deviceId}:${String(leadEvent.value)}->${followEvent.deviceId}:${String(followEvent.value)}`;

        if (!correlationCounts.has(key)) {
          correlationCounts.set(key, {
            delays: [],
            leadEvent,
            followEvent,
          });
        }
        correlationCounts.get(key)!.delays.push(delaySeconds);
      }
    }

    // Filter for significant correlations
    for (const [, data] of correlationCounts) {
      if (data.delays.length >= minOccurrences) {
        const avgDelay = data.delays.reduce((a, b) => a + b, 0) / data.delays.length;

        patterns.push({
          type: 'device_correlation',
          leadDevice: {
            deviceId: data.leadEvent.deviceId,
            deviceName: data.leadEvent.deviceName,
            attribute: data.leadEvent.attribute,
            value: data.leadEvent.value,
          },
          followDevice: {
            deviceId: data.followEvent.deviceId,
            deviceName: data.followEvent.deviceName,
            attribute: data.followEvent.attribute,
            value: data.followEvent.value,
            delaySeconds: Math.round(avgDelay),
          },
          confidence: data.delays.length / this.events.length,
          occurrences: data.delays.length,
        });
      }
    }

    this.stats.patternsDetected += patterns.length;
    return patterns;
  }

  /**
   * Generate rule suggestions from detected patterns
   */
  generateSuggestions(): PatternSuggestion[] {
    const suggestions: PatternSuggestion[] = [];

    // Time patterns -> scheduled rules
    const timePatterns = this.detectTimePatterns();
    for (const pattern of timePatterns) {
      if (pattern.confidence < 0.5) continue;  // Only suggest high-confidence patterns

      const suggestion = this.createTimeSuggestion(pattern);
      if (suggestion) suggestions.push(suggestion);
    }

    // Correlation patterns -> trigger-action rules
    const correlations = this.detectCorrelations();
    for (const pattern of correlations) {
      if (pattern.confidence < 0.3) continue;

      const suggestion = this.createCorrelationSuggestion(pattern);
      if (suggestion) suggestions.push(suggestion);
    }

    this.stats.suggestionsGenerated += suggestions.length;
    return suggestions;
  }

  /**
   * Create suggestion from time pattern
   */
  private createTimeSuggestion(pattern: TimePattern): PatternSuggestion | null {
    const timeStr = `${pattern.hour.toString().padStart(2, '0')}:${pattern.minute.toString().padStart(2, '0')}`;
    const daysStr = pattern.days?.join(', ') || 'every day';

    const trigger: RuleTrigger = {
      type: 'time',
      time: timeStr,
      days: pattern.days as ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[] | undefined,
    };

    const action: RuleAction = {
      type: 'device_command',
      deviceId: pattern.deviceId,
      deviceName: pattern.deviceName,
      command: String(pattern.value) === 'on' ? 'on' : String(pattern.value) === 'off' ? 'off' : 'setLevel',
      capability: pattern.attribute === 'switch' ? 'switch' : pattern.attribute,
    };

    const suggestedRule: CreateRuleRequest = {
      name: `Auto: ${pattern.deviceName} at ${timeStr}`,
      description: `Automatically set ${pattern.deviceName} to ${String(pattern.value)} at ${timeStr} ${daysStr}`,
      enabled: false,  // Start disabled so user can review
      priority: 50,
      triggers: [trigger],
      actions: [action],
    };

    return {
      pattern,
      description: `${pattern.deviceName} is often set to ${String(pattern.value)} around ${timeStr} on ${daysStr}`,
      suggestedRule,
      reasoning: `Detected ${pattern.occurrences} occurrences with ${Math.round(pattern.confidence * 100)}% confidence`,
    };
  }

  /**
   * Create suggestion from correlation pattern
   */
  private createCorrelationSuggestion(pattern: CorrelationPattern): PatternSuggestion | null {
    const trigger: RuleTrigger = {
      type: 'device_state',
      deviceId: pattern.leadDevice.deviceId,
      deviceName: pattern.leadDevice.deviceName,
      attribute: pattern.leadDevice.attribute,
      operator: 'equals',
      value: pattern.leadDevice.value,
    };

    const actions: RuleAction[] = [];

    // Add delay if significant
    if (pattern.followDevice.delaySeconds > 5) {
      actions.push({
        type: 'delay',
        seconds: pattern.followDevice.delaySeconds,
      });
    }

    // Add device command
    actions.push({
      type: 'device_command',
      deviceId: pattern.followDevice.deviceId,
      deviceName: pattern.followDevice.deviceName,
      command: String(pattern.followDevice.value) === 'on' ? 'on' : String(pattern.followDevice.value) === 'off' ? 'off' : 'setLevel',
      capability: pattern.followDevice.attribute === 'switch' ? 'switch' : pattern.followDevice.attribute,
    });

    const suggestedRule: CreateRuleRequest = {
      name: `Auto: ${pattern.followDevice.deviceName} when ${pattern.leadDevice.deviceName}`,
      description: `Automatically set ${pattern.followDevice.deviceName} when ${pattern.leadDevice.deviceName} is set to ${String(pattern.leadDevice.value)}`,
      enabled: false,
      priority: 50,
      triggers: [trigger],
      actions,
    };

    return {
      pattern,
      description: `${pattern.followDevice.deviceName} is often set to ${String(pattern.followDevice.value)} after ${pattern.leadDevice.deviceName} is set to ${String(pattern.leadDevice.value)}`,
      suggestedRule,
      reasoning: `Detected ${pattern.occurrences} occurrences with ~${pattern.followDevice.delaySeconds}s average delay`,
    };
  }

  /**
   * Get analysis statistics
   */
  getStats(): AnalyzerStats {
    return { ...this.stats };
  }

  /**
   * Get all recorded events (for debugging/inspection)
   */
  getEvents(): DeviceEventRecord[] {
    return [...this.events];
  }

  /**
   * Clear recorded events
   */
  clearEvents(): void {
    this.events = [];
    logger.info('[EventAnalyzer] Events cleared');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: EventAnalyzer | null = null;

export function getEventAnalyzer(): EventAnalyzer {
  if (!instance) {
    instance = new EventAnalyzer();
  }
  return instance;
}
