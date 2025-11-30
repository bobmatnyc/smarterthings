/**
 * Chat API Client
 *
 * Design Decision: Separate chat API from device API
 *
 * Rationale: Chat functionality is distinct from device management.
 * Keeping concerns separated makes code more maintainable.
 *
 * Implementation: Real API integration with ChatOrchestrator backend
 */

import type { DirectResult } from '@mcp-smartthings/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatRequest {
  message: string;
  mode?: 'normal' | 'troubleshooting';
}

export interface ChatResponse {
  message: string;
  mode: 'normal' | 'troubleshooting';
}

// ============================================================================
// API CLIENT
// ============================================================================

export class ChatApiClient {
  private baseUrl = '/api';

  /**
   * Send chat message (non-streaming)
   *
   * Design Decision: Non-streaming first for simplicity
   *
   * Integrates with backend ChatOrchestrator for AI-powered responses.
   *
   * @param message User message text
   * @param mode Chat mode (optional)
   * @returns DirectResult with assistant response
   */
  async sendMessage(message: string, mode: string = 'normal'): Promise<DirectResult<ChatResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        return {
          success: false,
          error: {
            code: errorData?.error?.code || 'CHAT_API_ERROR',
            message: errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`
          }
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Create EventSource for streaming chat responses (SSE)
   *
   * Note: Not yet implemented - streaming will be added in future phase
   *
   * @param message User message text
   * @returns EventSource instance
   */
  createChatEventSource(message: string): EventSource {
    const encoded = encodeURIComponent(message);
    return new EventSource(`${this.baseUrl}/chat/stream?message=${encoded}`);
  }
}

/**
 * Singleton instance
 */
export const chatApiClient = new ChatApiClient();
