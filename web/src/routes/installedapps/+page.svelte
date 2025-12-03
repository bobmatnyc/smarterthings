<script lang="ts">
  import { onMount } from 'svelte';
  import { getInstalledAppsStore } from '$lib/stores/installedAppsStore.svelte';
  import InstalledAppsGrid from '$lib/components/installedapps/InstalledAppsGrid.svelte';

  const store = getInstalledAppsStore();

  onMount(() => {
    store.loadInstalledApps();
  });

  function handleRefresh() {
    store.refreshInstalledApps();
  }
</script>

<svelte:head>
  <title>Installed Apps - Smarter Things</title>
</svelte:head>

<div class="page-container">
  <div class="page-header">
    <div class="header-content">
      <h1>Installed Apps</h1>
      <p class="subtitle">SmartApp integrations running in your SmartThings account</p>
    </div>

    <button class="refresh-button" onclick={handleRefresh} disabled={store.loading}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class:spinning={store.loading}
      >
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      Refresh
    </button>
  </div>

  {#if store.error}
    <div class="error-banner">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{store.error}</span>
    </div>
  {/if}

  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{store.stats.total}</div>
      <div class="stat-label">Total Apps</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{store.stats.authorized}</div>
      <div class="stat-label">Authorized</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{store.stats.pending}</div>
      <div class="stat-label">Pending</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{store.stats.disabled}</div>
      <div class="stat-label">Disabled</div>
    </div>
  </div>

  <InstalledAppsGrid apps={store.apps} loading={store.loading} />
</div>

<style>
  .page-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: rgb(17, 24, 39);
  }

  .subtitle {
    margin: 0;
    color: rgb(107, 114, 128);
    font-size: 1rem;
  }

  .refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .refresh-button:hover:not(:disabled) {
    background: rgb(37, 99, 235);
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .refresh-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgb(254, 226, 226);
    border: 1px solid rgb(252, 165, 165);
    border-radius: 0.5rem;
    color: rgb(153, 27, 27);
    margin-bottom: 1.5rem;
  }

  .error-banner svg {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid rgb(229, 231, 235);
    text-align: center;
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: rgb(59, 130, 246);
  }

  .stat-label {
    margin-top: 0.5rem;
    color: rgb(107, 114, 128);
    font-size: 0.875rem;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .page-container {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
    }

    h1 {
      font-size: 1.5rem;
    }

    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
