/**
 * Chat Store - Svelte 5 Runes-based
 *
 * Design Decision: Local state management with $state runes
 *
 * Rationale: Following deviceStore.svelte.ts pattern for consistency.
 * Using Svelte 5 runes for fine-grained reactivity and TypeScript inference.
 *
 * Trade-offs:
 * - Simplicity: No external state library needed vs. Redux complexity
 * - Performance: Fine-grained reactivity vs. full component re-renders
 * - Type Safety: Built-in TypeScript support vs. manual typing
 *
 * Non-streaming Implementation (Phase 1):
 * - Send message → Wait → Display full response
 * - Backend returns complete message (not chunks)
 * - Simpler error handling, easier to test
 * - Can upgrade to SSE streaming in Phase 2
 */

import { chatApiClient } from '../api/chat.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export enum ChatMode {
  NORMAL = 'normal',
  TROUBLESHOOTING = 'troubleshooting'
}

// ============================================================================
// STATE
// ============================================================================

let messages = $state<ChatMessage[]>([]);
let inputText = $state('');
let currentMode = $state<ChatMode>(ChatMode.NORMAL);
let isProcessing = $state(false);
let sidebarCollapsed = $state(true); // Default to collapsed for better device grid layout
let error = $state<string | null>(null);

// ============================================================================
// DERIVED STATE
// ============================================================================

let hasUnreadMessages = $derived(
  messages.length > 0 &&
  messages[messages.length - 1]?.role === 'assistant' &&
  sidebarCollapsed
);

let messageCount = $derived(messages.length);

// ============================================================================
// CONSTANTS
// ============================================================================

const HELP_TEXT = `**Available Commands:**

- \`/help\` - Show this help message
- \`/clear\` - Clear chat history
- \`/troubleshoot\` - Switch to troubleshooting mode
- \`/normal\` - Switch to normal mode

**Keyboard Shortcuts:**
- \`Ctrl+/\` - Toggle sidebar
- \`Enter\` - Send message
- \`Shift+Enter\` - New line`;

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Send a message to the chatbot
 *
 * Non-streaming version: Sends request and waits for complete response
 */
async function sendMessage(text: string): Promise<void> {
  if (!text.trim() || isProcessing) return;

  // Add user message
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    timestamp: new Date()
  };
  messages = [...messages, userMessage];
  inputText = '';
  isProcessing = true;
  error = null;

  try {
    // Handle local commands first
    if (text.startsWith('/')) {
      const response = handleCommand(text);
      if (response) {
        messages = [...messages, {
          id: crypto.randomUUID(),
          role: 'system',
          content: response,
          timestamp: new Date()
        }];
        return;
      }
    }

    // Send to backend API
    const result = await chatApiClient.sendMessage(text, currentMode);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    // Add assistant response
    messages = [...messages, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result.data.message,
      timestamp: new Date()
    }];

    // Update mode if it changed (e.g., via /troubleshoot command)
    if (result.data.mode !== currentMode) {
      currentMode = result.data.mode === 'troubleshooting' ? ChatMode.TROUBLESHOOTING : ChatMode.NORMAL;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error occurred';
    messages = [...messages, {
      id: crypto.randomUUID(),
      role: 'system',
      content: `❌ Error: ${error}`,
      timestamp: new Date()
    }];
  } finally {
    isProcessing = false;
  }
}

/**
 * Handle local commands (no backend call needed)
 *
 * Returns response string for local commands, null for backend commands
 */
function handleCommand(command: string): string | null {
  const cmd = command.toLowerCase().trim();

  switch (cmd) {
    case '/help':
      return HELP_TEXT;

    case '/clear':
      messages = [];
      return '🗑️ Chat history cleared';

    case '/troubleshoot':
    case '/normal':
      // These commands should be sent to backend
      // Backend will handle mode switching
      return null;

    default:
      // Unknown command, show help
      return `❌ Unknown command: \`${command}\`\n\nType \`/help\` for available commands.`;
  }
}

/**
 * Toggle sidebar collapsed state
 * Persists to localStorage for user preference
 */
function toggleSidebar(): void {
  sidebarCollapsed = !sidebarCollapsed;

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('chatSidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }
}

/**
 * Clear all messages
 */
function clearMessages(): void {
  messages = [];
}

/**
 * Set input text (for controlled input)
 */
function setInputText(text: string): void {
  inputText = text;
}

/**
 * Load sidebar state from localStorage
 * Called on component mount
 */
function loadSidebarState(): void {
  if (typeof window === 'undefined') return;

  const saved = localStorage.getItem('chatSidebarCollapsed');
  if (saved !== null) {
    try {
      sidebarCollapsed = JSON.parse(saved);
    } catch {
      // Invalid localStorage value, ignore
    }
  }
}

/**
 * Set chat mode
 */
function setMode(mode: ChatMode): void {
  currentMode = mode;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get chat store instance
 *
 * Returns reactive getters and action methods
 * Following the same pattern as deviceStore.svelte.ts
 */
export function getChatStore() {
  return {
    // Reactive getters
    get messages() { return messages; },
    get inputText() { return inputText; },
    get currentMode() { return currentMode; },
    get isProcessing() { return isProcessing; },
    get sidebarCollapsed() { return sidebarCollapsed; },
    get hasUnreadMessages() { return hasUnreadMessages; },
    get messageCount() { return messageCount; },
    get error() { return error; },

    // Actions
    sendMessage,
    toggleSidebar,
    clearMessages,
    setInputText,
    loadSidebarState,
    setMode
  };
}
