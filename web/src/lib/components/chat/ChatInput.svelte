<script lang="ts">
  /**
   * ChatInput - Auto-resizing textarea with send button
   *
   * Design Decision: Auto-resize textarea with max height
   *
   * Rationale: Better UX than fixed height - adapts to content length.
   * Max height prevents textarea from taking over entire screen.
   *
   * Trade-offs:
   * - UX: Auto-resize vs. manual scrolling
   * - Performance: Resize on every input vs. fixed height
   * - Complexity: $effect for DOM manipulation vs. static CSS
   */

  import { getChatStore } from '$lib/stores/chatStore.svelte';

  const store = getChatStore();
  let textarea: HTMLTextAreaElement;

  /**
   * Handle Enter key to send message
   * Shift+Enter creates new line
   */
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  /**
   * Submit message to chat store
   */
  function handleSubmit() {
    if (store.inputText.trim() && !store.isProcessing) {
      store.sendMessage(store.inputText);
    }
  }

  /**
   * Auto-resize textarea based on content
   *
   * Uses $effect to watch inputText changes and adjust height
   */
  $effect(() => {
    if (textarea) {
      // Reset height to auto to get correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight, capped at max-height (120px)
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
    }
  });

  /**
   * Focus textarea when sidebar opens
   */
  $effect(() => {
    if (!store.sidebarCollapsed && textarea) {
      textarea.focus();
    }
  });
</script>

<div class="chat-input-container">
  <div class="input-wrapper">
    <textarea
      bind:this={textarea}
      bind:value={store.inputText}
      onkeydown={handleKeydown}
      placeholder="Ask about your devices..."
      disabled={store.isProcessing}
      rows="1"
      aria-label="Chat message input"
    ></textarea>

    <button
      class="send-button btn variant-filled-primary"
      onclick={handleSubmit}
      disabled={!store.inputText.trim() || store.isProcessing}
      aria-label="Send message"
      title="Send message (Enter)"
    >
      {#if store.isProcessing}
        <svg
          class="spinner"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      {/if}
    </button>
  </div>

  <div class="shortcuts">
    <kbd>Ctrl+/</kbd> Toggle sidebar
    <span class="separator">•</span>
    <kbd>Enter</kbd> Send
    <span class="separator">•</span>
    <kbd>Shift+Enter</kbd> New line
  </div>

  {#if store.error}
    <div class="error-message" role="alert">
      ⚠️ {store.error}
    </div>
  {/if}
</div>

<style>
  .chat-input-container {
    padding: 1rem;
    border-top: 1px solid rgb(var(--color-surface-600));
    background: rgb(var(--color-surface-800));
    flex-shrink: 0;
  }

  .input-wrapper {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }

  textarea {
    flex: 1;
    resize: none;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgb(var(--color-surface-600));
    background: rgb(var(--color-surface-900));
    color: rgb(var(--color-surface-50));
    font-family: inherit;
    font-size: 0.95rem;
    line-height: 1.5;
    max-height: 120px;
    transition: border-color 0.2s ease;
  }

  textarea:focus {
    outline: none;
    border-color: rgb(var(--color-primary-500));
  }

  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea::placeholder {
    color: rgb(var(--color-surface-400));
  }

  .send-button {
    flex-shrink: 0;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
  }

  .send-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-button:not(:disabled):hover {
    transform: scale(1.05);
  }

  .send-button:not(:disabled):active {
    transform: scale(0.95);
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .shortcuts {
    margin-top: 0.625rem;
    font-size: 0.7rem;
    color: rgb(var(--color-surface-400));
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  kbd {
    background: rgb(var(--color-surface-700));
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.65rem;
    border: 1px solid rgb(var(--color-surface-600));
  }

  .separator {
    opacity: 0.5;
  }

  .error-message {
    margin-top: 0.5rem;
    padding: 0.625rem;
    background: rgb(var(--color-error-500) / 0.1);
    border-left: 3px solid rgb(var(--color-error-500));
    border-radius: 0.375rem;
    font-size: 0.85rem;
    color: rgb(var(--color-error-400));
  }
</style>
