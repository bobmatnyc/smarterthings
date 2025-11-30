# Chatbot UI Integration Design - Collapsible Left Pane

**Research Date**: 2025-11-30
**Context**: User request to integrate chatbot into web UI with collapsible left sidebar
**Project**: Smarter Things (SvelteKit + Skeleton UI)

---

## Executive Summary

This document provides a comprehensive design for integrating the existing terminal-based chatbot (`src/services/chatbot.ts` + `src/services/chat-orchestrator.ts`) into a collapsible left sidebar within the Smarter Things web UI. The design leverages **Svelte 5 runes** for state management, **Server-Sent Events (SSE)** for streaming responses, and **Skeleton UI components** for consistent styling.

**Key Findings**:
- Existing chatbot has robust architecture: message history, context management, streaming responses via LLM
- Web UI uses Svelte 5 runes pattern (proven in `deviceStore.svelte.ts`)
- SSE infrastructure already exists (`deviceStream.svelte.ts`) - can be adapted for chat streaming
- AppShell layout in place (`+layout.svelte`) - ready for sidebar integration
- No existing API routes - need to create chat backend endpoints

**Estimated Implementation**:
- **LOC**: ~850 lines (components + API + store)
- **Complexity**: Medium (familiar patterns, SSE adaptation needed)
- **Timeline**: 2-3 days (1 day components, 1 day API, 0.5 day integration)

---

## 1. Current Chatbot Architecture

### 1.1 Terminal Chatbot Analysis

**File**: `src/services/chatbot.ts`

**Features**:
- ✅ Message history tracking (`messageHistory: string[]`)
- ✅ Command handling (`/help`, `/exit`, `/history`, `/clear`, `/troubleshoot`, `/normal`)
- ✅ Colored output (chalk)
- ✅ Readline-based REPL interface
- ✅ Signal handling (Ctrl+C graceful shutdown)

**Key Interface**:
```typescript
export interface IChatbotService {
  start(handler: MessageHandler): Promise<void>;
  stop(): Promise<void>;
  sendMessage(message: string, handler: MessageHandler): Promise<string>;
}

export type MessageHandler = (message: string) => Promise<string>;
```

### 1.2 Chat Orchestrator Analysis

**File**: `src/services/chat-orchestrator.ts`

**Features**:
- ✅ LLM integration (OpenRouter/OpenAI)
- ✅ MCP client integration (SmartThings tools)
- ✅ Conversation history management
- ✅ Tool call execution (parallel execution)
- ✅ Two modes: Normal + Troubleshooting
- ✅ Layered instructions (system + session + troubleshooting prompts)
- ✅ Diagnostic workflow integration
- ✅ Web search in troubleshooting mode

**Key Interface**:
```typescript
export interface IChatOrchestrator {
  initialize(): Promise<void>;
  processMessage(message: string): Promise<string>;
  resetConversation(): void;
  close(): Promise<void>;
  setMode(mode: ChatMode): Promise<void>;
  getMode(): ChatMode;
}
```

**Message Processing Flow**:
```
User Input → Orchestrator.processMessage()
  ↓
Classify Intent (if classifier available)
  ↓
Auto-switch mode (if troubleshooting detected)
  ↓
Add user message to history
  ↓
LLM Chat Loop (max 10 iterations):
  ├─ Send messages to LLM (with available tools)
  ├─ If tool calls requested:
  │   ├─ Execute tools in parallel (MCP client)
  │   ├─ Add tool results to history
  │   └─ Continue loop
  └─ If no tool calls:
      └─ Return final response
```

**Critical Insight**: Orchestrator returns full response as string, **not streaming**. For UI streaming, we need to modify the LLM service to support streaming callbacks or SSE.

---

## 2. Web UI Current State

### 2.1 Technology Stack

**Framework**: SvelteKit (Svelte 5)
**UI Library**: Skeleton Labs v4.7.1
**Styling**: Tailwind CSS v4.1.17
**State Management**: Svelte 5 Runes (`$state`, `$derived`)

### 2.2 Existing Patterns

**Device Store** (`web/src/lib/stores/deviceStore.svelte.ts`):
```typescript
// Reactive state
let deviceMap = $state<Map<DeviceId, UnifiedDevice>>(new Map());
let searchQuery = $state('');
let loading = $state(true);

// Derived state
let devices = $derived(Array.from(deviceMap.values()));
let filteredDevices = $derived.by(() => {
  // Filter logic
});

// Export store with getters
export function getDeviceStore() {
  return {
    get devices() { return devices; },
    get loading() { return loading; },
    loadDevices,
    updateDeviceState,
    // ... other actions
  };
}
```

**SSE Integration** (`web/src/lib/sse/deviceStream.svelte.ts`):
```typescript
export function connectDeviceSSE(store: ReturnType<typeof getDeviceStore>): () => void {
  eventSource = apiClient.createDeviceEventSource();

  eventSource.addEventListener('device-state', (event) => {
    const data = JSON.parse(event.data);
    store.updateDeviceState(data.deviceId, data.state);
  });

  // Return cleanup function
  return () => { eventSource?.close(); };
}
```

**API Client** (`web/src/lib/api/client.ts`):
```typescript
export class ApiClient {
  private baseUrl = '/api';

  async getDevices(): Promise<DirectResult<UnifiedDevice[]>> {
    const response = await fetch(`${this.baseUrl}/devices`);
    return response.json();
  }

  createDeviceEventSource(): EventSource {
    return new EventSource(`${this.baseUrl}/devices/events`);
  }
}
```

**Layout Structure** (`web/src/routes/+layout.svelte`):
```svelte
<div class="app-shell">
  <header class="app-header">
    <!-- Header -->
  </header>

  <div class="app-content">
    <aside class="app-sidebar">
      <!-- Sidebar navigation -->
    </aside>

    <main class="app-main">
      {@render children()}
    </main>
  </div>

  <footer class="app-footer">
    <!-- Footer -->
  </footer>
</div>
```

**Critical Insight**: Current sidebar is **always visible** (16rem width). We need to add collapsible behavior.

---

## 3. Design Specification

### 3.1 Component Architecture

```
ChatSidebar.svelte (Container)
├── ChatHeader.svelte
│   ├── Title ("SmarterThings Chat")
│   ├── Mode Indicator (Normal/Troubleshooting)
│   └── Collapse Toggle Button
├── MessageList.svelte
│   ├── Message.svelte (User)
│   │   └── Text content
│   ├── Message.svelte (Assistant)
│   │   ├── Markdown rendering
│   │   └── Streaming indicator
│   └── Message.svelte (System)
│       └── Command feedback
├── TypingIndicator.svelte (when assistant is typing)
└── ChatInput.svelte
    ├── Textarea (auto-grow, max 4 lines)
    ├── Send Button
    └── Command Shortcuts Display
```

**File Structure**:
```
web/src/lib/components/chat/
├── ChatSidebar.svelte        # Main container
├── ChatHeader.svelte          # Header with mode toggle
├── MessageList.svelte         # Scrollable message container
├── Message.svelte             # Individual message bubble
├── TypingIndicator.svelte     # "..." animation
└── ChatInput.svelte           # Input field + send button
```

### 3.2 State Management (Chat Store)

**File**: `web/src/lib/stores/chatStore.svelte.ts`

```typescript
/**
 * Chat Store - Svelte 5 Runes-based
 * Pattern: Same as deviceStore.svelte.ts
 */

// ============================================================================
// STATE
// ============================================================================

export interface ChatMessage {
  id: string;              // Unique message ID
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;     // True while message is being streamed
}

export enum ChatMode {
  NORMAL = 'normal',
  TROUBLESHOOTING = 'troubleshooting'
}

let messages = $state<ChatMessage[]>([]);
let inputText = $state('');
let currentMode = $state<ChatMode>(ChatMode.NORMAL);
let isProcessing = $state(false);      // True while waiting for response
let sidebarCollapsed = $state(false);   // Sidebar visibility
let connectionStatus = $state<'connected' | 'disconnected' | 'connecting'>('disconnected');

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
// ACTIONS
// ============================================================================

export async function sendMessage(text: string): Promise<void> {
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

  try {
    // Handle commands locally
    if (text.startsWith('/')) {
      const response = await handleCommand(text);
      messages = [...messages, {
        id: crypto.randomUUID(),
        role: 'system',
        content: response,
        timestamp: new Date()
      }];
      return;
    }

    // Send to backend (SSE for streaming)
    await streamChatResponse(text);
  } catch (error) {
    messages = [...messages, {
      id: crypto.randomUUID(),
      role: 'system',
      content: `Error: ${error.message}`,
      timestamp: new Date()
    }];
  } finally {
    isProcessing = false;
  }
}

async function streamChatResponse(text: string): Promise<void> {
  // Create placeholder message for streaming
  const assistantMessageId = crypto.randomUUID();
  const assistantMessage: ChatMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    streaming: true
  };
  messages = [...messages, assistantMessage];

  // SSE connection for streaming response
  const eventSource = apiClient.createChatEventSource(text);

  eventSource.addEventListener('chunk', (event) => {
    const data = JSON.parse(event.data);
    const msgIndex = messages.findIndex(m => m.id === assistantMessageId);
    if (msgIndex !== -1) {
      const updatedMessages = [...messages];
      updatedMessages[msgIndex] = {
        ...updatedMessages[msgIndex],
        content: updatedMessages[msgIndex].content + data.text
      };
      messages = updatedMessages;
    }
  });

  eventSource.addEventListener('done', () => {
    const msgIndex = messages.findIndex(m => m.id === assistantMessageId);
    if (msgIndex !== -1) {
      const updatedMessages = [...messages];
      updatedMessages[msgIndex] = {
        ...updatedMessages[msgIndex],
        streaming: false
      };
      messages = updatedMessages;
    }
    eventSource.close();
  });

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
  };
}

async function handleCommand(command: string): Promise<string> {
  switch (command.toLowerCase()) {
    case '/help':
      return HELP_TEXT;
    case '/clear':
      messages = [];
      return 'Chat history cleared';
    case '/troubleshoot':
      currentMode = ChatMode.TROUBLESHOOTING;
      return '🔧 Switched to troubleshooting mode';
    case '/normal':
      currentMode = ChatMode.NORMAL;
      return '💬 Switched to normal mode';
    default:
      return `Unknown command: ${command}. Type /help for available commands.`;
  }
}

export function toggleSidebar(): void {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('chatSidebarCollapsed', JSON.stringify(sidebarCollapsed));
}

export function clearMessages(): void {
  messages = [];
}

export function setInputText(text: string): void {
  inputText = text;
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getChatStore() {
  return {
    get messages() { return messages; },
    get inputText() { return inputText; },
    get currentMode() { return currentMode; },
    get isProcessing() { return isProcessing; },
    get sidebarCollapsed() { return sidebarCollapsed; },
    get connectionStatus() { return connectionStatus; },
    get hasUnreadMessages() { return hasUnreadMessages; },
    get messageCount() { return messageCount; },

    sendMessage,
    toggleSidebar,
    clearMessages,
    setInputText
  };
}
```

**Estimated LOC**: 150-200 lines

### 3.3 API Integration Strategy

#### 3.3.1 Backend API Endpoints

**New File**: `web/src/routes/api/chat/+server.ts`

```typescript
/**
 * Chat API Endpoint (SvelteKit)
 * Handles chat message processing and SSE streaming
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { ChatOrchestrator } from '$lib/server/chat-orchestrator';
import { LlmService } from '$lib/server/llm';
import { McpClient } from '$lib/server/mcp/client';

// Singleton instances (shared across requests)
let orchestrator: ChatOrchestrator | null = null;

async function getOrchestrator(): Promise<ChatOrchestrator> {
  if (!orchestrator) {
    const mcpClient = new McpClient();
    const llmService = new LlmService({
      apiKey: process.env.OPENROUTER_API_KEY!,
      model: 'anthropic/claude-sonnet-4.5'
    });
    orchestrator = new ChatOrchestrator(mcpClient, llmService);
    await orchestrator.initialize();
  }
  return orchestrator;
}

export const POST: RequestHandler = async ({ request }) => {
  const { message } = await request.json();

  const orch = await getOrchestrator();
  const response = await orch.processMessage(message);

  return json({ response });
};
```

**SSE Streaming Endpoint**: `web/src/routes/api/chat/stream/+server.ts`

```typescript
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  const message = url.searchParams.get('message') || '';

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const orch = await getOrchestrator();

        // Modify orchestrator to support streaming callbacks
        await orch.processMessageStreaming(message, (chunk: string) => {
          controller.enqueue(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`));
        });

        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};
```

**Challenge**: Current `ChatOrchestrator.processMessage()` returns full response as string. Need to add streaming support.

**Solution Options**:

1. **Option A: Modify LlmService to support streaming callbacks**
   ```typescript
   // In src/services/llm.ts
   async chatStreaming(
     messages: ChatMessage[],
     tools: McpToolDefinition[],
     onChunk: (chunk: string) => void
   ): Promise<LlmResponse> {
     const stream = await this.openai.chat.completions.create({
       model: this.model,
       messages,
       tools,
       stream: true  // Enable streaming
     });

     let content = '';
     for await (const chunk of stream) {
       const delta = chunk.choices[0]?.delta?.content || '';
       if (delta) {
         content += delta;
         onChunk(delta);  // Stream chunks to frontend
       }
     }

     return { content, toolCalls: [] };
   }
   ```

2. **Option B: Use polling (simpler, but higher latency)**
   - Frontend polls `/api/chat/status?messageId=xyz` every 500ms
   - Backend stores intermediate responses in memory
   - Less ideal UX, but no orchestrator changes needed

**Recommendation**: **Option A** (streaming callbacks) for better UX. Requires modifying `src/services/llm.ts` to support streaming mode.

#### 3.3.2 API Client Extension

**File**: `web/src/lib/api/client.ts` (extend existing)

```typescript
export class ApiClient {
  // ... existing methods

  /**
   * Send chat message (non-streaming fallback)
   */
  async sendChatMessage(message: string): Promise<DirectResult<{ response: string }>> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return response.json();
  }

  /**
   * Create EventSource for streaming chat response
   */
  createChatEventSource(message: string): EventSource {
    const encoded = encodeURIComponent(message);
    return new EventSource(`${this.baseUrl}/chat/stream?message=${encoded}`);
  }
}
```

### 3.4 UI Components

#### 3.4.1 ChatSidebar.svelte

```svelte
<script lang="ts">
  import { getChatStore } from '$lib/stores/chatStore.svelte';
  import ChatHeader from './ChatHeader.svelte';
  import MessageList from './MessageList.svelte';
  import ChatInput from './ChatInput.svelte';

  const store = getChatStore();
</script>

<aside
  class="chat-sidebar"
  class:collapsed={store.sidebarCollapsed}
  aria-label="Chat sidebar"
>
  <ChatHeader />
  <MessageList messages={store.messages} />
  <ChatInput />

  {#if store.sidebarCollapsed && store.hasUnreadMessages}
    <div class="unread-badge">{store.messageCount}</div>
  {/if}
</aside>

<style>
  .chat-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 24rem;
    background: var(--color-surface-800);
    color: white;
    display: flex;
    flex-direction: column;
    z-index: 50;
    transition: transform 0.3s ease;
  }

  .chat-sidebar.collapsed {
    transform: translateX(-100%);
  }

  .unread-badge {
    position: absolute;
    top: 1rem;
    right: -0.5rem;
    background: var(--color-primary-500);
    color: white;
    border-radius: 9999px;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .chat-sidebar {
      width: 100%;
    }
  }
</style>
```

**Estimated LOC**: 50 lines

#### 3.4.2 Message.svelte (with Markdown)

```svelte
<script lang="ts">
  import type { ChatMessage } from '$lib/stores/chatStore.svelte';
  import { marked } from 'marked';  // Need to add dependency

  let { message } = $props<{ message: ChatMessage }>();

  const renderedContent = $derived(
    message.role === 'assistant'
      ? marked.parse(message.content)
      : message.content
  );
</script>

<div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
  <div class="message-header">
    <span class="role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
    <span class="timestamp">{message.timestamp.toLocaleTimeString()}</span>
  </div>

  <div class="message-content">
    {#if message.role === 'assistant'}
      {@html renderedContent}
    {:else}
      {message.content}
    {/if}

    {#if message.streaming}
      <span class="cursor">▊</span>
    {/if}
  </div>
</div>

<style>
  .message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
  }

  .message.user {
    background: var(--color-primary-700);
    margin-left: 2rem;
  }

  .message.assistant {
    background: var(--color-surface-700);
    margin-right: 2rem;
  }

  .cursor {
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
</style>
```

**Estimated LOC**: 60 lines

**Dependency**: Need to add `marked` for Markdown rendering:
```bash
pnpm add marked
pnpm add -D @types/marked
```

#### 3.4.3 ChatInput.svelte

```svelte
<script lang="ts">
  import { getChatStore } from '$lib/stores/chatStore.svelte';

  const store = getChatStore();
  let textarea: HTMLTextAreaElement;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (store.inputText.trim()) {
      store.sendMessage(store.inputText);
    }
  }

  // Auto-resize textarea
  $effect(() => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  });
</script>

<div class="chat-input-container">
  <textarea
    bind:this={textarea}
    bind:value={store.inputText}
    on:keydown={handleKeydown}
    placeholder="Ask about your devices..."
    disabled={store.isProcessing}
    rows="1"
  ></textarea>

  <button
    on:click={handleSubmit}
    disabled={!store.inputText.trim() || store.isProcessing}
    class="send-button"
  >
    {#if store.isProcessing}
      ⏳
    {:else}
      ➤
    {/if}
  </button>

  <div class="shortcuts">
    <kbd>Ctrl+/</kbd> to toggle | <kbd>Enter</kbd> to send | <kbd>Shift+Enter</kbd> for new line
  </div>
</div>

<style>
  .chat-input-container {
    padding: 1rem;
    border-top: 1px solid var(--color-surface-600);
  }

  textarea {
    width: 100%;
    resize: none;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-surface-600);
    background: var(--color-surface-900);
    color: white;
    font-family: inherit;
    max-height: 120px;
  }

  .send-button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shortcuts {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-surface-400);
  }
</style>
```

**Estimated LOC**: 80 lines

### 3.5 Layout Integration

**Modified**: `web/src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import '../app.postcss';
  import favicon from '$lib/assets/favicon.svg';
  import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
  import { getChatStore } from '$lib/stores/chatStore.svelte';

  let { children } = $props();
  const chatStore = getChatStore();

  // Keyboard shortcut: Ctrl+/ to toggle sidebar
  $effect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        chatStore.toggleSidebar();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  // Load sidebar state from localStorage
  $effect(() => {
    const saved = localStorage.getItem('chatSidebarCollapsed');
    if (saved !== null) {
      chatStore.sidebarCollapsed = JSON.parse(saved);
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<ChatSidebar />

<div class="app-shell" class:sidebar-open={!chatStore.sidebarCollapsed}>
  <header class="app-header">
    <!-- Toggle button for mobile -->
    <button class="sidebar-toggle-btn" on:click={chatStore.toggleSidebar}>
      {chatStore.sidebarCollapsed ? '☰' : '✕'}
    </button>
  </header>

  <div class="app-content">
    <aside class="app-sidebar">
      <!-- Navigation sidebar (right side) -->
    </aside>

    <main class="app-main">
      {@render children()}
    </main>
  </div>

  <footer class="app-footer">
    <!-- Footer -->
  </footer>
</div>

<style>
  .app-shell {
    height: 100%;
    display: flex;
    flex-direction: column;
    transition: margin-left 0.3s ease;
  }

  .app-shell.sidebar-open {
    margin-left: 24rem;
  }

  .sidebar-toggle-btn {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 60;
    background: var(--color-surface-700);
    color: white;
    border: none;
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .app-shell.sidebar-open {
      margin-left: 0;
    }
  }
</style>
```

**Estimated LOC**: 70 lines

---

## 4. UX Considerations

### 4.1 Default Behavior

- **Initial State**: Collapsed (save screen space for device dashboard)
- **Persistence**: Store state in localStorage
- **Mobile**: Slide-out drawer overlay (full width)
- **Desktop**: Push layout to the right (24rem sidebar width)

### 4.2 Interactions

| Interaction | Behavior |
|-------------|----------|
| Click toggle button | Expand/collapse sidebar |
| `Ctrl+/` keyboard shortcut | Toggle sidebar |
| Click outside (mobile) | Collapse sidebar |
| New assistant message while collapsed | Show unread badge |
| Scroll to bottom | Auto-scroll when new message arrives |
| `Enter` in input | Send message |
| `Shift+Enter` in input | New line |

### 4.3 Animations

- **Slide Animation**: 300ms ease transition
- **Typing Indicator**: Blinking cursor (1s interval)
- **Message Entry**: Fade-in 200ms

### 4.4 Accessibility

- **ARIA Labels**: All interactive elements labeled
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Esc)
- **Screen Reader**: Message roles announced ("User message", "Assistant message")
- **Focus Management**: Input auto-focused when sidebar opens

---

## 5. Implementation Checklist

### Phase 1: Backend API (1 day)

- [ ] **Modify LlmService for streaming** (`src/services/llm.ts`)
  - Add `chatStreaming()` method with callback
  - Test streaming with OpenRouter API
- [ ] **Create SvelteKit API route** (`web/src/routes/api/chat/+server.ts`)
  - POST endpoint for non-streaming fallback
  - Test with existing orchestrator
- [ ] **Create SSE streaming endpoint** (`web/src/routes/api/chat/stream/+server.ts`)
  - Implement ReadableStream for SSE
  - Hook up streaming orchestrator
  - Test event emission
- [ ] **Update API client** (`web/src/lib/api/client.ts`)
  - Add `sendChatMessage()` method
  - Add `createChatEventSource()` method

**Estimated LOC**: 200 lines

### Phase 2: State Management (0.5 day)

- [ ] **Create chat store** (`web/src/lib/stores/chatStore.svelte.ts`)
  - Implement message array with $state
  - Implement derived state (hasUnreadMessages, etc.)
  - Add sendMessage() action with SSE integration
  - Add command handling (/help, /clear, etc.)
  - Test reactivity

**Estimated LOC**: 200 lines

### Phase 3: UI Components (1 day)

- [ ] **Install dependencies**
  ```bash
  pnpm add marked
  pnpm add -D @types/marked
  ```
- [ ] **Create ChatSidebar.svelte** (main container)
  - Layout structure
  - Collapse/expand animation
  - Unread badge
- [ ] **Create ChatHeader.svelte** (header with toggle)
  - Title display
  - Mode indicator (Normal/Troubleshooting)
  - Collapse button
- [ ] **Create MessageList.svelte** (scrollable list)
  - Auto-scroll to bottom
  - Loading state
  - Empty state
- [ ] **Create Message.svelte** (message bubble)
  - User/Assistant styling
  - Markdown rendering
  - Streaming cursor
  - Timestamp display
- [ ] **Create TypingIndicator.svelte** (animated dots)
  - Three-dot animation
- [ ] **Create ChatInput.svelte** (input field)
  - Auto-resize textarea
  - Send button
  - Keyboard shortcuts
  - Command hints

**Estimated LOC**: 300 lines

### Phase 4: Integration (0.5 day)

- [ ] **Update layout** (`web/src/routes/+layout.svelte`)
  - Add ChatSidebar component
  - Add keyboard shortcut handler
  - Add margin-left animation
  - Test mobile responsiveness
- [ ] **Update app.postcss** (if needed)
  - Add chat-specific CSS variables
  - Test with Skeleton UI theme
- [ ] **Test end-to-end**
  - Send message → receive response
  - Test streaming (watch cursor)
  - Test commands (/help, /clear)
  - Test collapse/expand
  - Test mobile behavior
  - Test keyboard shortcuts

**Estimated LOC**: 100 lines

### Phase 5: Polish (0.5 day)

- [ ] **Error handling**
  - Network errors
  - SSE disconnections
  - Invalid commands
- [ ] **Loading states**
  - Initial load skeleton
  - Processing indicator
- [ ] **Accessibility audit**
  - ARIA labels
  - Keyboard navigation
  - Screen reader testing
- [ ] **Performance optimization**
  - Lazy load Message components (virtual scroll for 100+ messages)
  - Debounce textarea resize

**Estimated LOC**: 50 lines

---

## 6. Complexity Assessment

### 6.1 Component Breakdown

| Component | LOC | Complexity | Notes |
|-----------|-----|------------|-------|
| chatStore.svelte.ts | 200 | Medium | Follows deviceStore pattern |
| ChatSidebar.svelte | 50 | Low | Layout container |
| ChatHeader.svelte | 40 | Low | Simple UI |
| MessageList.svelte | 60 | Low | Map over messages |
| Message.svelte | 60 | Medium | Markdown rendering |
| TypingIndicator.svelte | 20 | Low | CSS animation |
| ChatInput.svelte | 80 | Medium | Textarea auto-resize |
| +layout.svelte (changes) | 30 | Low | Add sidebar |
| API routes | 150 | High | SSE streaming, orchestrator integration |
| API client (extension) | 30 | Low | Simple fetch wrappers |
| LlmService (streaming) | 80 | High | OpenAI streaming API |

**Total Estimated LOC**: ~850 lines

### 6.2 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE connection issues | Medium | High | Implement reconnection logic (exponential backoff) |
| Streaming latency | Low | Medium | Add loading indicator, test with various models |
| Mobile UX problems | Medium | Medium | Test on real devices, add touch gestures |
| Markdown XSS vulnerability | Low | High | Use DOMPurify with marked (sanitize HTML) |
| State synchronization bugs | Medium | Medium | Extensive testing, use Svelte devtools |
| Layout shift on collapse | Low | Low | Test animation, use CSS transitions |

**Recommended Security Addition**:
```bash
pnpm add dompurify
pnpm add -D @types/dompurify
```

Update Message.svelte:
```typescript
import DOMPurify from 'dompurify';

const renderedContent = $derived(
  message.role === 'assistant'
    ? DOMPurify.sanitize(marked.parse(message.content))
    : message.content
);
```

---

## 7. Future Enhancements

### 7.1 Iteration 2 (Nice-to-have)

- [ ] **Voice Input**: Add microphone button for voice commands
- [ ] **Chat History Persistence**: Save to backend (database)
- [ ] **Message Editing**: Allow users to edit previous messages
- [ ] **Multi-session Support**: Multiple chat threads
- [ ] **Export Chat**: Download conversation as Markdown/PDF
- [ ] **Code Syntax Highlighting**: For device IDs, JSON responses
- [ ] **Quick Actions**: Buttons in assistant messages ("Turn on lights")
- [ ] **Emoji Reactions**: React to assistant messages

### 7.2 Iteration 3 (Advanced)

- [ ] **Multi-modal Input**: Image uploads (for device photos)
- [ ] **Proactive Suggestions**: "Did you mean this device?"
- [ ] **Context Menu**: Right-click message for actions
- [ ] **Collaborative Chat**: Share chat session URL
- [ ] **Analytics Dashboard**: Chat usage metrics

---

## 8. Testing Strategy

### 8.1 Unit Tests

- **chatStore.svelte.ts**:
  - Test sendMessage() adds user message
  - Test command handling (/help, /clear)
  - Test toggleSidebar() updates state
- **Message.svelte**:
  - Test Markdown rendering
  - Test XSS prevention (sanitization)
  - Test streaming cursor animation

### 8.2 Integration Tests

- **SSE Connection**:
  - Test connection establishment
  - Test chunk reception
  - Test error handling
  - Test reconnection logic
- **End-to-End Flow**:
  - User sends message → API receives → LLM responds → UI updates
  - Test with different message types (commands, queries, long messages)

### 8.3 Manual Testing

- [ ] **Desktop Browser** (Chrome, Firefox, Safari)
  - Collapse/expand animation smooth
  - Keyboard shortcuts work
  - Messages render correctly
  - Streaming works without lag
- [ ] **Mobile Browser** (iOS Safari, Android Chrome)
  - Sidebar slides out properly
  - Touch gestures work
  - Textarea resizes correctly
  - No layout overflow
- [ ] **Accessibility** (Screen Reader)
  - Message roles announced
  - Keyboard navigation works
  - Focus management correct

---

## 9. Files Modified/Created

### New Files (11 total)

```
web/src/lib/components/chat/
├── ChatSidebar.svelte           # 50 LOC
├── ChatHeader.svelte            # 40 LOC
├── MessageList.svelte           # 60 LOC
├── Message.svelte               # 60 LOC
├── TypingIndicator.svelte       # 20 LOC
└── ChatInput.svelte             # 80 LOC

web/src/lib/stores/
└── chatStore.svelte.ts          # 200 LOC

web/src/routes/api/chat/
├── +server.ts                   # 70 LOC
└── stream/
    └── +server.ts               # 80 LOC
```

### Modified Files (3 total)

```
src/services/llm.ts              # +80 LOC (streaming method)
web/src/lib/api/client.ts        # +30 LOC (chat methods)
web/src/routes/+layout.svelte    # +30 LOC (sidebar integration)
```

**Total New LOC**: ~850 lines
**Total Modified LOC**: ~140 lines

---

## 10. Dependencies

### Required Dependencies

```bash
pnpm add marked dompurify
```

### Dev Dependencies

```bash
pnpm add -D @types/marked @types/dompurify
```

---

## 11. Timeline Estimate

| Phase | Estimated Time | Notes |
|-------|---------------|-------|
| Backend API (SSE + Orchestrator) | 1 day | Complex: Streaming modification |
| Chat Store (State Management) | 0.5 day | Similar to deviceStore |
| UI Components | 1 day | 6 components, styling |
| Layout Integration | 0.5 day | Testing collapse/expand |
| Polish + Testing | 0.5 day | Error handling, accessibility |

**Total**: **3.5 days** (conservative estimate)

**Optimistic**: 2.5 days (if SSE streaming works smoothly)
**Pessimistic**: 5 days (if major issues with orchestrator streaming)

---

## 12. Conclusion

The chatbot UI integration is **feasible** with existing infrastructure. The design leverages proven patterns from the device store and SSE streaming system. The primary technical challenge is **modifying the LLM service to support streaming**, which requires OpenAI SDK streaming API integration.

### Key Design Decisions

1. **Svelte 5 Runes**: Use same pattern as deviceStore for consistency
2. **SSE for Streaming**: Follow deviceStream pattern for real-time updates
3. **Collapsible Sidebar**: Fixed left sidebar with slide animation
4. **Markdown Rendering**: Use marked + DOMPurify for rich formatting
5. **Keyboard Shortcuts**: Ctrl+/ to toggle, Enter to send
6. **Mobile-First**: Slide-out drawer on mobile, push layout on desktop

### Recommended Implementation Order

1. **Start with non-streaming version** (simpler, faster to ship)
2. **Add SSE streaming** (better UX, requires LLM service changes)
3. **Polish UI** (animations, accessibility, mobile)

### Success Metrics

- ✅ Chat sidebar collapses/expands smoothly (<300ms)
- ✅ Messages stream in real-time (<1s first token)
- ✅ Mobile UX works on all devices
- ✅ Keyboard shortcuts functional
- ✅ No XSS vulnerabilities (sanitized Markdown)
- ✅ Accessible (WCAG 2.1 AA compliance)

---

**Next Steps**:
1. Review this design with team
2. Get approval on streaming vs. non-streaming approach
3. Begin Phase 1 (Backend API)
4. Iterate based on user feedback

---

**Research Metadata**:
- **Files Analyzed**: 8 (chatbot.ts, chat-orchestrator.ts, deviceStore.svelte.ts, +layout.svelte, etc.)
- **Patterns Identified**: Svelte 5 runes, SSE streaming, Skeleton UI integration
- **LOC Estimated**: 850 lines (new) + 140 lines (modified)
- **Complexity**: Medium (familiar patterns, SSE adaptation needed)
