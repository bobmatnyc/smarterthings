/**
 * Installed Apps Store
 *
 * State management for SmartThings InstalledApps (legacy SmartApp instances)
 * Pattern: Svelte 5 runes with Map-based storage
 *
 * InstalledApps are instances of SmartApps (integrations like Alexa, Google Home)
 * that run automatically based on events. Cannot be manually executed.
 */

import { getCache, setCache, clearCache, CACHE_KEYS, DEFAULT_TTL } from '$lib/utils/cache';
import { toast } from 'svelte-sonner';
import { apiClient } from '$lib/api/client';

export interface InstalledApp {
  id: string;
  displayName: string;
  appType: 'LAMBDA_SMART_APP' | 'WEBHOOK_SMART_APP' | string;
  installationStatus: 'AUTHORIZED' | 'PENDING' | 'REVOKED' | 'DISABLED' | string;
  classifications: string[];
  locationId?: string;
  createdDate?: number;
  lastUpdatedDate?: number;
}

interface InstalledAppInfo {
  installedAppId: string;
  displayName: string;
  appType: string;
  installationStatus: string;
  classifications?: string[];
  locationId?: string;
  createdDate?: string;
  lastUpdatedDate?: string;
}

interface InstalledAppsResponse {
  success: boolean;
  data?: {
    count: number;
    installedApps: InstalledAppInfo[];
  };
  error?: {
    message: string;
  };
}

// State (Svelte 5 runes)
let appMap = $state<Map<string, InstalledApp>>(new Map());
let loading = $state(true);
let error = $state<string | null>(null);

// Derived values
let apps = $derived(
  Array.from(appMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  )
);

let stats = $derived({
  total: apps.length,
  authorized: apps.filter(a => a.installationStatus === 'AUTHORIZED').length,
  pending: apps.filter(a => a.installationStatus === 'PENDING').length,
  disabled: apps.filter(a => a.installationStatus === 'DISABLED').length
});

/**
 * Load installed apps from API or cache
 */
export async function loadInstalledApps(forceRefresh: boolean = false): Promise<void> {
  loading = true;
  error = null;

  try {
    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
      const cached = getCache<any[]>('smartthings:installedapps:v1', DEFAULT_TTL);
      if (cached && Array.isArray(cached)) {
        console.log(`[InstalledAppsStore] Loaded ${cached.length} apps from cache`);

        const newMap = new Map<string, InstalledApp>();
        for (const app of cached) {
          newMap.set(app.id, app as InstalledApp);
        }
        appMap = newMap;
        loading = false;
        return;
      }
    }

    // Cache miss or forced - fetch from API
    console.log('[InstalledAppsStore] Fetching installed apps from API...');
    const response = await apiClient.fetch('/api/installedapps');

    if (!response.ok) {
      throw new Error(`Failed to fetch installed apps: ${response.statusText}`);
    }

    const result: InstalledAppsResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to fetch installed apps');
    }

    const installedApps = result.data?.installedApps || [];
    console.log(`[InstalledAppsStore] Loaded ${installedApps.length} apps from API`);

    // Transform backend data to frontend format
    const transformedApps = installedApps.map((appInfo): InstalledApp => ({
      id: appInfo.installedAppId,
      displayName: appInfo.displayName,
      appType: appInfo.appType,
      installationStatus: appInfo.installationStatus,
      classifications: appInfo.classifications || [],
      locationId: appInfo.locationId,
      createdDate: appInfo.createdDate ? new Date(appInfo.createdDate).getTime() : undefined,
      lastUpdatedDate: appInfo.lastUpdatedDate ? new Date(appInfo.lastUpdatedDate).getTime() : undefined
    }));

    // Cache the successful response
    setCache('smartthings:installedapps:v1', transformedApps, DEFAULT_TTL);

    // Populate map
    const newMap = new Map<string, InstalledApp>();
    for (const app of transformedApps) {
      newMap.set(app.id, app);
    }
    appMap = newMap;
  } catch (err) {
    console.error('Failed to load installed apps:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to load installed apps';
    error = errorMessage;

    toast.error('Failed to load installed apps', {
      description: errorMessage
    });

    appMap = new Map();
  } finally {
    loading = false;
  }
}

/**
 * Force refresh installed apps from API (clears cache)
 */
export async function refreshInstalledApps(): Promise<void> {
  console.log('[InstalledAppsStore] Force refreshing installed apps...');
  clearCache('smartthings:installedapps:v1');
  await loadInstalledApps(true);
}

/**
 * Get installed app by ID
 */
export function getInstalledAppById(id: string): InstalledApp | undefined {
  return appMap.get(id);
}

/**
 * Clear error state
 */
export function clearError(): void {
  error = null;
}

/**
 * Factory function to get reactive store
 */
export function getInstalledAppsStore() {
  return {
    get apps() { return apps; },
    get stats() { return stats; },
    get loading() { return loading; },
    get error() { return error; },
    loadInstalledApps,
    refreshInstalledApps,
    getInstalledAppById,
    clearError
  };
}
