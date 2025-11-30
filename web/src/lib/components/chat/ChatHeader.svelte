<script lang="ts">
  /**
   * ChatHeader - Header bar with mode indicator and collapse button
   */

  import { getChatStore, ChatMode } from '$lib/stores/chatStore.svelte';

  const store = getChatStore();

  /**
   * Mode badge styling based on current mode
   */
  const modeBadgeClass = $derived(
    store.currentMode === ChatMode.TROUBLESHOOTING
      ? 'variant-filled-warning'
      : 'variant-filled-primary'
  );

  const modeLabel = $derived(
    store.currentMode === ChatMode.TROUBLESHOOTING
      ? 'Troubleshooting'
      : 'Normal'
  );

  const modeIcon = $derived(
    store.currentMode === ChatMode.TROUBLESHOOTING ? '🔧' : '💬'
  );
</script>

<header class="chat-header">
  <div class="header-content">
    <h2 class="title">Smarter Things Assistant</h2>
    <span class="badge {modeBadgeClass}" aria-label={`Current mode: ${modeLabel}`}>
      {modeIcon} {modeLabel}
    </span>
  </div>

  <button
    class="collapse-button btn btn-sm variant-ghost-surface"
    onclick={() => store.toggleSidebar()}
    aria-label="Collapse sidebar"
    title="Collapse sidebar (Ctrl+/)"
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </button>
</header>

<style>
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid rgb(var(--color-surface-600));
    background: rgb(var(--color-surface-800));
    flex-shrink: 0;
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .title {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
    color: rgb(var(--color-surface-50));
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    width: fit-content;
  }

  .collapse-button {
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
  }

  .collapse-button:hover {
    background: rgb(var(--color-surface-700));
  }

  .collapse-button:active {
    transform: scale(0.95);
  }
</style>
