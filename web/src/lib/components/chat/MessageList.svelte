<script lang="ts">
  /**
   * MessageList - Scrollable container for chat messages
   *
   * Design Decision: Auto-scroll to bottom on new messages
   *
   * Rationale: Chat UX convention - newest messages should be visible.
   * Using $effect to trigger scroll when messages array changes.
   *
   * Performance: Smooth scrolling with CSS, no manual RAF needed
   */

  import type { ChatMessage } from '$lib/stores/chatStore.svelte';
  import Message from './Message.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  import { getChatStore } from '$lib/stores/chatStore.svelte';

  let { messages }: { messages: ChatMessage[] } = $props();

  const store = getChatStore();
  let scrollContainer: HTMLDivElement;

  /**
   * Auto-scroll to bottom when new messages arrive
   *
   * Uses $effect to watch messages array for changes
   */
  $effect(() => {
    if (scrollContainer && messages.length > 0) {
      // Small delay to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  });
</script>

<div
  bind:this={scrollContainer}
  class="message-list"
  role="log"
  aria-live="polite"
  aria-label="Chat messages"
>
  {#if messages.length === 0}
    <div class="empty-state">
      <div class="empty-icon">💬</div>
      <h3>Welcome to Smarter Things Assistant</h3>
      <p>Ask me anything about your SmartThings devices!</p>
      <div class="suggestions">
        <p class="suggestions-label">Try asking:</p>
        <ul>
          <li>"Show me my lights"</li>
          <li>"What's the temperature?"</li>
          <li>"List all my devices"</li>
          <li>"Turn on the living room light"</li>
        </ul>
        <p class="help-hint">Type <code>/help</code> to see available commands</p>
      </div>
    </div>
  {:else}
    {#each messages as message (message.id)}
      <Message {message} />
    {/each}

    {#if store.isProcessing}
      <div class="typing-container">
        <TypingIndicator />
      </div>
    {/if}
  {/if}
</div>

<style>
  .message-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem;
    background: rgb(var(--color-surface-900));
    scroll-behavior: smooth;
  }

  /* Custom scrollbar for better UX */
  .message-list::-webkit-scrollbar {
    width: 0.5rem;
  }

  .message-list::-webkit-scrollbar-track {
    background: rgb(var(--color-surface-800));
  }

  .message-list::-webkit-scrollbar-thumb {
    background: rgb(var(--color-surface-600));
    border-radius: 0.25rem;
  }

  .message-list::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--color-surface-500));
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
    color: rgb(var(--color-surface-300));
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: rgb(var(--color-surface-100));
  }

  .empty-state p {
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
    opacity: 0.8;
  }

  .suggestions {
    background: rgb(var(--color-surface-800) / 0.5);
    padding: 1.5rem;
    border-radius: 0.75rem;
    text-align: left;
    max-width: 24rem;
    border: 1px solid rgb(var(--color-surface-700));
  }

  .suggestions-label {
    font-weight: 600;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    color: rgb(var(--color-surface-200));
  }

  .suggestions ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .suggestions li {
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.375rem;
    background: rgb(var(--color-surface-700) / 0.5);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    border-left: 2px solid rgb(var(--color-primary-500));
  }

  .suggestions li:hover {
    background: rgb(var(--color-surface-700));
    cursor: default;
  }

  .help-hint {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgb(var(--color-surface-700));
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .help-hint code {
    background: rgb(var(--color-surface-700));
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    color: rgb(var(--color-primary-400));
  }

  /* Typing indicator container */
  .typing-container {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    background: rgb(var(--color-surface-700) / 0.5);
    border-left: 3px solid rgb(var(--color-tertiary-500));
    border-radius: 0.75rem;
    margin-right: 2rem;
  }
</style>
