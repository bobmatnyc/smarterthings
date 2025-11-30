<script lang="ts">
  /**
   * App Layout with ChatSidebar Integration
   *
   * Design Decision: Chat sidebar on left, main content shifts right
   *
   * Rationale: Follows common web app patterns (Slack, Discord).
   * Desktop: Push layout (content shifts when sidebar open)
   * Mobile: Overlay (sidebar covers content, no shift)
   *
   * Keyboard Shortcuts:
   * - Ctrl+/ (or Cmd+/ on Mac): Toggle chat sidebar
   */

  import '../app.postcss';
  import favicon from '$lib/assets/favicon.svg';
  import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
  import { getChatStore } from '$lib/stores/chatStore.svelte';

  let { children } = $props();
  const chatStore = getChatStore();

  /**
   * Keyboard shortcut handler
   *
   * Ctrl+/ or Cmd+/ to toggle sidebar
   */
  function handleKeydown(event: KeyboardEvent) {
    // Ctrl+/ or Cmd+/ (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      chatStore.toggleSidebar();
    }
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- Chat Sidebar (Fixed Left) -->
<ChatSidebar />

<!-- Toggle Button (visible when sidebar is collapsed) -->
{#if chatStore.sidebarCollapsed}
  <button
    class="sidebar-toggle-btn"
    onclick={() => chatStore.toggleSidebar()}
    aria-label="Open chat sidebar"
    title="Open chat (Ctrl+/)"
  >
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  </button>
{/if}

<!-- Main App Shell -->
<div class="app-shell" class:sidebar-open={!chatStore.sidebarCollapsed}>
  <header class="app-header">
    <h1>Smarter Things</h1>
  </header>

  <div class="app-content">
    <aside class="app-sidebar">
      <!-- Navigation sidebar (if needed in future) -->
    </aside>

    <main class="app-main">
      {@render children()}
    </main>
  </div>

  <footer class="app-footer">
    <!-- Footer content -->
  </footer>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: rgb(var(--color-surface-50));
  }

  /* Desktop: Push content right when sidebar open */
  @media (min-width: 769px) {
    .app-shell.sidebar-open {
      margin-left: 24rem;
    }
  }

  /* Tablet: Slightly less margin */
  @media (min-width: 769px) and (max-width: 1024px) {
    .app-shell.sidebar-open {
      margin-left: 20rem;
    }
  }

  /* Mobile: No margin (overlay mode) */
  @media (max-width: 768px) {
    .app-shell.sidebar-open {
      margin-left: 0;
    }
  }

  .app-header {
    background: rgb(var(--color-surface-800));
    color: rgb(var(--color-surface-50));
    padding: 1rem 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .app-content {
    flex: 1;
    display: flex;
  }

  .app-sidebar {
    width: 16rem;
    background: rgb(var(--color-surface-100));
    border-right: 1px solid rgb(var(--color-surface-300));
    padding: 1rem;
  }

  .app-main {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  .app-footer {
    background: rgb(var(--color-surface-800));
    color: rgb(var(--color-surface-300));
    padding: 1rem 2rem;
    text-align: center;
    font-size: 0.875rem;
  }

  .sidebar-toggle-btn {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 60;
    background: rgb(var(--color-primary-500));
    color: white;
    border: none;
    width: 3rem;
    height: 3rem;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .sidebar-toggle-btn:hover {
    background: rgb(var(--color-primary-400));
    transform: scale(1.05);
  }

  .sidebar-toggle-btn:active {
    transform: scale(0.95);
  }

  /* Mobile: Hide navigation sidebar */
  @media (max-width: 768px) {
    .app-sidebar {
      display: none;
    }

    .app-main {
      padding: 1rem;
    }
  }
</style>
