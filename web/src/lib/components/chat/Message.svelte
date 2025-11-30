<script lang="ts">
  /**
   * Message - Individual chat message bubble
   *
   * Design Decision: Markdown rendering with DOMPurify sanitization
   *
   * Rationale: Assistant responses may contain formatted text, code blocks,
   * and lists. Markdown provides rich formatting while DOMPurify prevents XSS.
   *
   * Trade-offs:
   * - Security: Sanitized HTML vs. potential XSS vulnerability
   * - Rendering: Client-side vs. server-side markdown parsing
   * - Performance: Parse on every render vs. memoized parsing
   */

  import type { ChatMessage } from '$lib/stores/chatStore.svelte';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let { message }: { message: ChatMessage } = $props();

  /**
   * Render markdown content with sanitization
   *
   * Only applies to assistant messages (user messages are plain text)
   */
  const renderedContent = $derived(
    message.role === 'assistant'
      ? DOMPurify.sanitize(marked.parse(message.content) as string)
      : message.content
  );

  /**
   * Format timestamp for display
   */
  const formattedTime = $derived(
    message.timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  );
</script>

<div
  class="message"
  class:user={message.role === 'user'}
  class:assistant={message.role === 'assistant'}
  class:system={message.role === 'system'}
  role="article"
  aria-label={`${message.role} message`}
>
  <div class="message-header">
    <span class="role">
      {#if message.role === 'user'}
        You
      {:else if message.role === 'assistant'}
        Assistant
      {:else}
        System
      {/if}
    </span>
    <span class="timestamp">{formattedTime}</span>
  </div>

  <div class="message-content">
    {#if message.role === 'assistant'}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html renderedContent}
    {:else}
      {message.content}
    {/if}
  </div>
</div>

<style>
  .message {
    margin-bottom: 1rem;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    animation: message-fade-in 0.2s ease-out;
  }

  @keyframes message-fade-in {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message.user {
    background: rgb(var(--color-primary-500) / 0.2);
    border-left: 3px solid rgb(var(--color-primary-500));
    margin-left: 2rem;
  }

  .message.assistant {
    background: rgb(var(--color-surface-700) / 0.5);
    border-left: 3px solid rgb(var(--color-tertiary-500));
    margin-right: 2rem;
  }

  .message.system {
    background: rgb(var(--color-warning-500) / 0.1);
    border-left: 3px solid rgb(var(--color-warning-500));
    font-size: 0.875rem;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .role {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .timestamp {
    font-size: 0.7rem;
  }

  .message-content {
    line-height: 1.6;
    word-wrap: break-word;
  }

  /* Markdown content styling */
  .message.assistant .message-content :global(pre) {
    background: rgb(var(--color-surface-900) / 0.5);
    padding: 0.75rem;
    border-radius: 0.375rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }

  .message.assistant .message-content :global(code) {
    background: rgb(var(--color-surface-800) / 0.5);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
    font-family: 'Courier New', monospace;
  }

  .message.assistant .message-content :global(pre code) {
    background: transparent;
    padding: 0;
  }

  .message.assistant .message-content :global(ul),
  .message.assistant .message-content :global(ol) {
    margin-left: 1.25rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .message.assistant .message-content :global(li) {
    margin-bottom: 0.25rem;
  }

  .message.assistant .message-content :global(p) {
    margin-bottom: 0.5rem;
  }

  .message.assistant .message-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .message.assistant .message-content :global(strong) {
    font-weight: 700;
    color: rgb(var(--color-primary-400));
  }

  @media (max-width: 768px) {
    .message.user {
      margin-left: 1rem;
    }

    .message.assistant {
      margin-right: 1rem;
    }
  }
</style>
