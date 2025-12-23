/**
 * Dashboard Service - LLM-powered event summarization for status display
 *
 * Design Decision: Claude Haiku for cost-effective real-time summarization
 * Rationale: Haiku provides fast, cheap summaries perfect for status crawlers.
 * 30-second cache minimizes API costs while keeping content fresh.
 *
 * Architecture:
 * - Fetch last 25 events from EventStore
 * - Generate natural language summary via LLM
 * - Cache results for 30 seconds
 * - Extract highlights for UI display
 *
 * Performance:
 * - LLM latency: 1-2s (Haiku is fast)
 * - Cache hit: <1ms (no API call)
 * - Cost: ~$0.0001 per summary (Haiku pricing)
 *
 * Trade-offs:
 * - Haiku chosen over Sonnet for cost (10x cheaper)
 * - 30s cache balances freshness vs. API cost
 * - 25 events provides good context without excessive tokens
 */

import type { LlmService } from './llm.js';
import type { EventStore } from '../storage/event-store.js';
import logger from '../utils/logger.js';

/**
 * Summary result structure
 */
export interface SummaryResult {
  summary: string;
  eventCount: number;
  highlights: string[];
  timestamp: string;
}

/**
 * Cache entry
 */
interface CacheEntry {
  result: SummaryResult;
  expiresAt: number;
}

/**
 * DashboardService configuration
 */
export interface DashboardServiceConfig {
  cacheSeconds?: number;
  eventLimit?: number;
  model?: string;
}

/**
 * DashboardService - Event summarization with LLM
 *
 * Usage:
 * ```typescript
 * const service = new DashboardService(llmService, eventStore);
 * const summary = await service.generateSummary();
 * // Returns: { summary, eventCount, highlights, timestamp }
 * ```
 */
export class DashboardService {
  private llmService: LlmService;
  private eventStore: EventStore;
  private cache: CacheEntry | null = null;
  private cacheSeconds: number;
  private eventLimit: number;
  private model: string;

  constructor(
    llmService: LlmService,
    eventStore: EventStore,
    config?: DashboardServiceConfig
  ) {
    this.llmService = llmService;
    this.eventStore = eventStore;
    this.cacheSeconds = config?.cacheSeconds ?? 30;
    this.eventLimit = config?.eventLimit ?? 25;
    this.model = config?.model ?? 'anthropic/claude-3-haiku-20240307';

    logger.info('[DashboardService] Initialized', {
      cacheSeconds: this.cacheSeconds,
      eventLimit: this.eventLimit,
      model: this.model,
    });
  }

  /**
   * Generate summary of recent home activity
   *
   * @returns Summary result with LLM-generated text
   *
   * Performance:
   * - Cache hit: <1ms
   * - Cache miss: 1-2s (LLM call)
   *
   * Error Handling:
   * - LLM errors: Returns fallback summary
   * - Empty events: Returns "No recent activity"
   * - Cache errors: Logs warning and continues
   */
  async generateSummary(): Promise<SummaryResult> {
    const startTime = Date.now();

    try {
      // Check cache
      if (this.cache && Date.now() < this.cache.expiresAt) {
        logger.debug('[DashboardService] Cache hit', {
          age: Math.round((Date.now() - (this.cache.expiresAt - this.cacheSeconds * 1000)) / 1000),
        });
        return this.cache.result;
      }

      logger.debug('[DashboardService] Cache miss, fetching events');

      // Fetch recent events
      const events = await this.eventStore.getRecentEvents(this.eventLimit);

      if (events.length === 0) {
        const result: SummaryResult = {
          summary: 'No recent activity in your home.',
          eventCount: 0,
          highlights: [],
          timestamp: new Date().toISOString(),
        };

        // Cache empty result too
        this.cache = {
          result,
          expiresAt: Date.now() + this.cacheSeconds * 1000,
        };

        return result;
      }

      // Generate LLM summary
      const summary = await this.callLlmForSummary(events);

      // Extract highlights (first 3 notable events)
      const highlights = this.extractHighlights(events);

      const result: SummaryResult = {
        summary,
        eventCount: events.length,
        highlights,
        timestamp: new Date().toISOString(),
      };

      // Update cache
      this.cache = {
        result,
        expiresAt: Date.now() + this.cacheSeconds * 1000,
      };

      const duration = Date.now() - startTime;
      logger.info('[DashboardService] Summary generated', {
        eventCount: events.length,
        summaryLength: summary.length,
        duration,
      });

      return result;
    } catch (error) {
      logger.error('[DashboardService] Failed to generate summary', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback summary
      return {
        summary: 'Unable to load recent activity summary.',
        eventCount: 0,
        highlights: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Call LLM to generate summary from events
   *
   * @param events - Recent events to summarize
   * @returns Natural language summary (max 150 chars for scrolling)
   */
  private async callLlmForSummary(events: any[]): Promise<string> {
    // Format events for LLM context
    const eventsJson = events.map((e) => ({
      type: e.type,
      source: e.source,
      device: e.deviceName || e.deviceId,
      eventType: e.eventType,
      value: e.value,
      timestamp: e.timestamp.toISOString(),
    }));

    const currentTime = new Date().toISOString();

    // Build prompt
    const prompt = `You are a smart home assistant summarizing recent activity for a status display.

Summarize these events in 1-2 concise sentences for a scrolling status bar.
Focus on: current activity, notable changes, and general home state.
Keep it friendly and informative.

Recent events (most recent first):
${JSON.stringify(eventsJson, null, 2)}

Current time: ${currentTime}

Respond with a brief, natural summary (max 150 characters for scrolling display).`;

    const messages = [
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    try {
      const response = await this.llmService.chat(messages, [], {
        enableWebSearch: false,
      });

      const summaryText = response.content?.trim() || 'Recent home activity detected.';

      // Truncate to 150 chars if needed
      return summaryText.length > 150 ? summaryText.substring(0, 147) + '...' : summaryText;
    } catch (error) {
      logger.error('[DashboardService] LLM call failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback summary
      return `${events.length} recent events in your smart home.`;
    }
  }

  /**
   * Extract notable highlights from events
   *
   * @param events - Recent events
   * @returns Array of highlight strings (max 3)
   */
  private extractHighlights(events: any[]): string[] {
    const highlights: string[] = [];

    // Find up to 3 notable events
    for (const event of events) {
      if (highlights.length >= 3) break;

      // Prioritize device events with names
      if (event.type === 'device_event' && event.deviceName) {
        let highlight = event.deviceName;

        if (event.value && typeof event.value === 'object') {
          // Add value details if available
          const valueStr = Object.entries(event.value)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          highlight += ` (${valueStr})`;
        }

        highlights.push(highlight);
      }
    }

    return highlights;
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = null;
    logger.debug('[DashboardService] Cache cleared');
  }
}
