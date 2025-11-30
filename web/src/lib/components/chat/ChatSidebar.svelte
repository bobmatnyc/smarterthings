<script lang="ts">
  /**
   * ChatSidebar - Main collapsible chat container
   *
   * Design Decision: Fixed left sidebar with slide animation
   *
   * Rationale: Common pattern in chat UIs (Slack, Discord, etc).
   * Left sidebar for chat, right side for main content.
   *
   * Trade-offs:
   * - Mobile: Overlay vs. push layout (overlay chosen for screen space)
   * - Desktop: Push vs. overlay (push chosen for better context visibility)
   * - Animation: Transform vs. width transition (transform for better performance)
   *
   * Accessibility:
   * - ARIA labels for screen readers
   * - Keyboard navigation support
   * - Focus management (auto-focus input when expanded)
   */

  import { getChatStore } from '$lib/stores/chatStore.svelte';
  import ChatHeader from './ChatHeader.svelte';
  import MessageList from './MessageList.svelte';
  import ChatInput from './ChatInput.svelte';
  import { onMount } from 'svelte';

  const store = getChatStore();

  /**
   * Load saved sidebar state from localStorage on mount
   */
  onMount(() => {
    store.loadSidebarState();
  });
</script>

<aside
  class="chat-sidebar"
  class:collapsed={store.sidebarCollapsed}
  aria-label="Chat sidebar"
  aria-hidden={store.sidebarCollapsed}
>
  <ChatHeader />
  <MessageList messages={store.messages} />
  <ChatInput />

  <!-- Unread message indicator when collapsed -->
  {#if store.sidebarCollapsed && store.hasUnreadMessages}
    <button
      class="unread-badge"
      onclick={() => store.toggleSidebar()}
      aria-label={`${store.messageCount} unread messages`}
      title="Open chat"
    >
      {store.messageCount}
    </button>
  {/if}
</aside>

<style>
  .chat-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 24rem;
    background: rgb(var(--color-surface-900));
    color: rgb(var(--color-surface-50));
    display: flex;
    flex-direction: column;
    z-index: 50;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    border-right: 1px solid rgb(var(--color-surface-700));
  }

  .chat-sidebar.collapsed {
    transform: translateX(-100%);
  }

  .unread-badge {
    position: absolute;
    top: 1rem;
    right: -1rem;
    background: rgb(var(--color-primary-500));
    color: white;
    border-radius: 9999px;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    border: 2px solid rgb(var(--color-surface-900));
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .unread-badge:hover {
    transform: scale(1.1);
    background: rgb(var(--color-primary-400));
  }

  .unread-badge:active {
    transform: scale(0.95);
  }

  /* Mobile: Full width overlay */
  @media (max-width: 768px) {
    .chat-sidebar {
      width: 100vw;
      box-shadow: none;
    }

    .unread-badge {
      right: -0.5rem;
    }
  }

  /* Tablet: Slightly narrower */
  @media (min-width: 769px) and (max-width: 1024px) {
    .chat-sidebar {
      width: 20rem;
    }
  }

  /* Desktop: Standard width */
  @media (min-width: 1025px) {
    .chat-sidebar {
      width: 24rem;
    }
  }
</style>
