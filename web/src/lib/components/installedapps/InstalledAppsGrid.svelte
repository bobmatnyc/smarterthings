<script lang="ts">
  import InstalledAppCard from './InstalledAppCard.svelte';
  import SkeletonGrid from '$lib/components/loading/SkeletonGrid.svelte';
  import type { InstalledApp } from '$lib/stores/installedAppsStore.svelte';

  interface Props {
    apps: InstalledApp[];
    loading?: boolean;
  }

  let { apps, loading = false }: Props = $props();
</script>

{#if loading}
  <SkeletonGrid count={6} variant="installedapp" />
{:else if apps.length === 0}
  <div class="empty-state">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="empty-icon"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="9" x2="15" y2="9"></line>
    </svg>
    <h3>No Installed Apps</h3>
    <p>No SmartApps are currently installed in your SmartThings account.</p>
  </div>
{:else}
  <div class="apps-grid">
    {#each apps as app (app.id)}
      <InstalledAppCard {app} />
    {/each}
  </div>
{/if}

<style>
  .apps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
    padding: 1rem 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .empty-icon {
    width: 4rem;
    height: 4rem;
    color: rgb(156, 163, 175);
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: rgb(17, 24, 39);
  }

  .empty-state p {
    margin: 0;
    color: rgb(107, 114, 128);
  }

  @media (max-width: 768px) {
    .apps-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style>
