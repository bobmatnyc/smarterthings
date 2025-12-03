<script lang="ts">
  /**
   * Installed App Card Component
   *
   * Design: Read-only informational card for SmartApp instances
   * Pattern: Similar to SceneCard but without execute button
   *
   * Visual Design:
   * - Classification-based icon gradient
   * - Status badge (AUTHORIZED, PENDING, etc.)
   * - Type badge (LAMBDA_SMART_APP, etc.)
   * - Last updated timestamp
   *
   * Note: InstalledApps cannot be manually executed (event-driven)
   */

  import type { InstalledApp } from '$lib/stores/installedAppsStore.svelte';

  interface Props {
    app: InstalledApp;
  }

  let { app }: Props = $props();

  // Determine icon gradient based on classification
  const iconStyle = $derived(() => {
    const classification = app.classifications[0] || 'SERVICE';

    const gradients: Record<string, string> = {
      AUTOMATION: 'linear-gradient(135deg, rgb(243, 232, 255) 0%, rgb(233, 213, 255) 100%)', // Purple
      SERVICE: 'linear-gradient(135deg, rgb(219, 234, 254) 0%, rgb(191, 219, 254) 100%)', // Blue
      DEVICE: 'linear-gradient(135deg, rgb(220, 252, 231) 0%, rgb(187, 247, 208) 100%)', // Green
      CONNECTED_SERVICE: 'linear-gradient(135deg, rgb(254, 243, 199) 0%, rgb(253, 230, 138) 100%)' // Amber
    };

    return gradients[classification] || gradients.SERVICE;
  });

  const iconColor = $derived(() => {
    const classification = app.classifications[0] || 'SERVICE';
    const colors: Record<string, string> = {
      AUTOMATION: 'rgb(147, 51, 234)',
      SERVICE: 'rgb(59, 130, 246)',
      DEVICE: 'rgb(34, 197, 94)',
      CONNECTED_SERVICE: 'rgb(245, 158, 11)'
    };
    return colors[classification] || colors.SERVICE;
  });

  // Status badge styling
  const statusStyle = $derived(() => {
    const status = app.installationStatus;
    const styles: Record<string, { bg: string; color: string }> = {
      AUTHORIZED: { bg: 'rgb(220, 252, 231)', color: 'rgb(21, 128, 61)' },
      PENDING: { bg: 'rgb(254, 243, 199)', color: 'rgb(161, 98, 7)' },
      REVOKED: { bg: 'rgb(254, 226, 226)', color: 'rgb(153, 27, 27)' },
      DISABLED: { bg: 'rgb(243, 244, 246)', color: 'rgb(107, 114, 128)' }
    };
    return styles[status] || styles.DISABLED;
  });

  // Format last updated time
  const lastUpdatedText = $derived(() => {
    if (!app.lastUpdatedDate) return 'Never updated';

    const date = new Date(app.lastUpdatedDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  });
</script>

<article class="app-card">
  <div class="card-content">
    <!-- App Icon -->
    <div class="app-icon" style="background: {iconStyle()}; color: {iconColor()}" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="9" x2="15" y2="9"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
    </div>

    <!-- App Info -->
    <div class="app-info">
      <h3 class="app-name">{app.displayName}</h3>

      <!-- Badges Row -->
      <div class="badges-row">
        <!-- Status Badge -->
        <div class="status-badge" style="background: {statusStyle().bg}; color: {statusStyle().color}">
          <span class="status-dot"></span>
          <span>{app.installationStatus}</span>
        </div>

        <!-- Type Badge -->
        <div class="type-badge">
          {app.appType.replace('_', ' ')}
        </div>

        <!-- Classifications -->
        {#if app.classifications.length > 0}
          <div class="classification-badge">
            {app.classifications[0]}
          </div>
        {/if}
      </div>

      <!-- Last Updated -->
      <div class="last-updated">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="clock-icon"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Updated: {lastUpdatedText()}</span>
      </div>
    </div>
  </div>
</article>

<style>
  .app-card {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgb(229, 231, 235);
    overflow: hidden;
  }

  .app-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .card-content {
    padding: 1.5rem;
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
  }

  .app-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .app-icon svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .app-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .app-name {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: rgb(17, 24, 39);
    line-height: 1.3;
  }

  .badges-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: currentColor;
  }

  .type-badge,
  .classification-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    background: rgb(243, 244, 246);
    color: rgb(107, 114, 128);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .last-updated {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: rgb(156, 163, 175);
  }

  .clock-icon {
    width: 0.875rem;
    height: 0.875rem;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .card-content {
      padding: 1.25rem;
      gap: 1rem;
    }

    .app-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .app-name {
      font-size: 1rem;
    }
  }
</style>
