/**
 * Scenes Store - Svelte 5 Runes-based state management
 *
 * Design Decision: Dedicated scenes store separate from automations
 * Rationale: Scenes (manually run routines) are conceptually distinct from
 * rules (conditional automations). This separation provides:
 * - Clear separation of concerns (scenes vs. rules)
 * - Simpler component integration (dedicated API surface)
 * - Future extensibility (scenes-specific features)
 * - Migration path from automationStore to scenesStore
 *
 * Key Characteristics:
 * - Scenes are ALWAYS enabled (manually triggered, not conditional)
 * - Scenes can be executed on-demand via UI
 * - Scenes cannot be disabled (unlike rules which have enable/disable)
 * - Scenes track last execution timestamp
 *
 * State Pattern:
 * - $state(): Reactive state primitives
 * - $derived(): Computed values with automatic statistics calculation
 * - Map-based scene storage for O(1) lookups
 *
 * Architecture:
 * - Single source of truth for all scenes
 * - Statistics computed from scene data
 * - Execution updates lastExecuted timestamp
 *
 * Performance:
 * - Scene map: O(1) lookups by ID
 * - Sorted list: O(n log n) but memoized with $derived
 * - Updates: Fine-grained (only affected components re-render)
 */

import { toast } from 'svelte-sonner';

export interface Scene {
	id: string; // Maps from backend sceneId
	name: string; // Maps from backend sceneName
	enabled: boolean; // Always true (scenes can't be disabled)
	icon?: string; // Optional sceneIcon
	color?: string; // Optional sceneColor
	locationId?: string; // Optional locationId
	lastExecuted?: number; // Timestamp in ms (converted from lastExecutedDate)
}

/**
 * Backend SceneInfo type (from SmartThings API)
 */
interface SceneInfo {
	sceneId: string;
	sceneName: string;
	sceneIcon?: string;
	sceneColor?: string;
	locationId?: string;
	lastExecutedDate?: string; // ISO 8601 timestamp
}

/**
 * Backend API response type
 * API returns: { success: true, data: [...] } where data is the scenes array
 */
interface ScenesResponse {
	success: boolean;
	data: SceneInfo[];
	error?: {
		message: string;
	};
}

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Scene map for O(1) lookups
 * Using Map for efficient scene retrieval and updates
 */
let sceneMap = $state<Map<string, Scene>>(new Map());

/**
 * Loading and error state
 */
let loading = $state(true);
let error = $state<string | null>(null);

// ============================================================================
// DERIVED STATE (Computed Values)
// ============================================================================

/**
 * Convert scene map to array, sorted by name
 * Derived value automatically updates when sceneMap changes
 */
let scenes = $derived(Array.from(sceneMap.values()).sort((a, b) => a.name.localeCompare(b.name)));

/**
 * Scene statistics
 * Note: enabled/disabled always 100%/0% for scenes
 */
let stats = $derived({
	total: scenes.length,
	enabled: scenes.length, // All scenes are always enabled
	disabled: 0 // Scenes cannot be disabled
});

// ============================================================================
// ACTIONS (Exported Functions)
// ============================================================================

/**
 * Load scenes from API
 *
 * Design Decision: Direct SmartThings Scenes API integration
 * Rationale: Backend scene endpoints are now implemented,
 * providing real-time access to SmartThings Scenes (manually run routines).
 *
 * API Endpoint: GET /api/automations
 * Response: { success: true, data: { count: N, scenes: [...] } }
 *
 * Error Handling:
 * - NetworkError: Logged and stored in error state
 * - ValidationError: Invalid response structure handled gracefully
 * - API Error: Backend error messages propagated to UI
 *
 * Performance: O(n) where n = number of scenes (typically < 50)
 */
export async function loadScenes(): Promise<void> {
	loading = true;
	error = null;

	try {
		const response = await fetch('/api/automations');

		if (!response.ok) {
			throw new Error(`Failed to fetch scenes: ${response.statusText}`);
		}

		const result: ScenesResponse = await response.json();

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to load scenes');
		}

		// Transform SmartThings Scenes to frontend Scene format
		const newSceneMap = new Map<string, Scene>();

		// Extract scenes array from response
		// API returns: { success: true, data: [...] } where data is the scenes array
		const scenesArray = result.data || [];

		scenesArray.forEach((sceneInfo: SceneInfo) => {
			const scene: Scene = {
				id: sceneInfo.sceneId,
				name: sceneInfo.sceneName,
				enabled: true, // Scenes are always "enabled" (manually triggered)
				icon: sceneInfo.sceneIcon,
				color: sceneInfo.sceneColor,
				locationId: sceneInfo.locationId,
				lastExecuted: sceneInfo.lastExecutedDate
					? new Date(sceneInfo.lastExecutedDate).getTime()
					: undefined
			};
			newSceneMap.set(scene.id, scene);
		});

		// Replace entire map to trigger Svelte 5 reactivity
		sceneMap = newSceneMap;
	} catch (err) {
		console.error('Failed to load scenes:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to load scenes';
		error = errorMessage;

		// Error toast for load failures
		toast.error('Failed to load scenes', {
			description: errorMessage
		});

		sceneMap = new Map(); // Clear scenes on error
	} finally {
		loading = false;
	}
}

/**
 * Execute a scene
 *
 * Design Decision: Immediate execution with optimistic UI updates
 * Rationale: Users expect instant feedback when triggering scenes.
 * We update lastExecuted timestamp immediately for responsive UI,
 * then handle API errors if execution fails.
 *
 * API Endpoint: POST /api/automations/:id/execute
 * Response: { success: true } | { success: false, error: {...} }
 *
 * Error Handling:
 * - NetworkError: Retry not implemented (user can retry manually)
 * - API Error: Error state updated, user notified via UI
 * - Scene Not Found: Logged and returns false
 *
 * Performance: Single API call, O(1) map update
 *
 * @param sceneId Scene identifier to execute
 * @returns Promise<boolean> True if execution succeeded, false otherwise
 */
export async function executeScene(sceneId: string): Promise<boolean> {
	const scene = sceneMap.get(sceneId);
	if (!scene) {
		console.error('Scene not found:', sceneId);
		toast.error('Scene not found');
		return false;
	}

	try {
		const response = await fetch(`/api/automations/${sceneId}/execute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		if (!response.ok) {
			throw new Error(`Failed to execute scene: ${response.statusText}`);
		}

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to execute scene');
		}

		// Update last executed time (optimistic update)
		// Using immutable update pattern for Svelte 5 reactivity
		sceneMap.set(sceneId, {
			...scene,
			lastExecuted: Date.now()
		});

		// Success toast
		toast.success(`Scene "${scene.name}" executed successfully`, {
			description: 'All actions completed'
		});

		return true;
	} catch (err) {
		console.error('Failed to execute scene:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to execute scene';
		error = errorMessage;

		// Error toast
		toast.error(`Failed to execute scene "${scene.name}"`, {
			description: errorMessage
		});

		return false;
	}
}

/**
 * Get scene by ID
 *
 * Performance: O(1) map lookup
 *
 * @param sceneId Scene identifier
 * @returns Scene if found, undefined otherwise
 */
export function getSceneById(sceneId: string): Scene | undefined {
	return sceneMap.get(sceneId);
}

/**
 * Clear error state
 *
 * Utility function for UI components to dismiss errors.
 */
export function clearError(): void {
	error = null;
}

// ============================================================================
// EXPORTS (Read-only Reactive State)
// ============================================================================

/**
 * Get scenes store with reactive state and actions
 *
 * Returns object with read-only getters for reactive state
 * and action functions for mutations.
 *
 * Design Decision: Factory function pattern
 * Rationale: Provides clean API surface with read-only state access.
 * Components cannot accidentally mutate state directly, ensuring
 * all updates go through action functions for proper reactivity.
 *
 * Usage Example:
 * ```svelte
 * <script lang="ts">
 *   import { getScenesStore } from '$lib/stores/scenesStore.svelte';
 *   import { onMount } from 'svelte';
 *
 *   const scenesStore = getScenesStore();
 *
 *   onMount(() => {
 *     scenesStore.loadScenes();
 *   });
 *
 *   async function handleExecute(sceneId: string) {
 *     const success = await scenesStore.executeScene(sceneId);
 *     if (success) {
 *       console.log('Scene executed successfully');
 *     }
 *   }
 * </script>
 *
 * {#if scenesStore.loading}
 *   <p>Loading scenes...</p>
 * {:else if scenesStore.error}
 *   <p>Error: {scenesStore.error}</p>
 * {:else}
 *   <p>Total scenes: {scenesStore.stats.total}</p>
 *   {#each scenesStore.scenes as scene}
 *     <button onclick={() => handleExecute(scene.id)}>
 *       {scene.name}
 *     </button>
 *   {/each}
 * {/if}
 * ```
 *
 * Migration from automationStore:
 * - Replace getAutomationStore() with getScenesStore()
 * - Replace loadAutomations() with loadScenes()
 * - Replace toggleAutomation() with executeScene()
 * - automations → scenes in component templates
 *
 * @returns Store object with reactive state and action methods
 */
export function getScenesStore() {
	return {
		// State (read-only getters for reactivity)
		get scenes() {
			return scenes;
		},
		get stats() {
			return stats;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},

		// Actions
		loadScenes,
		executeScene,
		getSceneById,
		clearError
	};
}
