/**
 * Automation Store - Svelte 5 Runes-based state management
 *
 * Design Decision: Scenes management for smart home control
 * Rationale: Scenes (manually run routines) are a core feature of smart homes,
 * allowing users to execute predefined device configurations with a single action.
 * These correspond to "Manually run routines" in the SmartThings app.
 *
 * State Pattern:
 * - $state(): Reactive state primitives
 * - $derived(): Computed values with automatic statistics calculation
 * - Map-based automation storage for O(1) lookups
 *
 * Architecture:
 * - Single source of truth for all scenes
 * - Statistics computed from scene data
 * - Scenes are always "enabled" (manually triggered)
 */

import { apiClient } from '$lib/api/client';

export interface Automation {
	id: string;
	name: string;
	enabled: boolean; // Always true for scenes (manually triggered)
	triggers?: string[];
	actions?: string[];
	lastExecuted?: number; // Timestamp in milliseconds
}

/**
 * Backend API response type
 * API returns: { success: true, data: [...] } where data is the scenes array
 */
export interface AutomationsResponse {
	success: boolean;
	data: any[]; // Array of SceneInfo objects
	error?: {
		message: string;
	};
}

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Automation map for O(1) lookups
 */
let automationMap = $state<Map<string, Automation>>(new Map());

/**
 * Loading and error state
 */
let loading = $state(true);
let error = $state<string | null>(null);

// ============================================================================
// DERIVED STATE
// ============================================================================

/**
 * Convert automation map to array, sorted by name
 */
let automations = $derived(
	Array.from(automationMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

/**
 * Automation statistics
 */
let stats = $derived({
	total: automations.length,
	enabled: automations.filter((a) => a.enabled).length,
	disabled: automations.filter((a) => !a.enabled).length
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Load automations (scenes) from API
 *
 * Design Decision: Direct SmartThings Scenes API integration
 * Rationale: Backend scene endpoints are now implemented,
 * providing real-time access to SmartThings Scenes (manually run routines).
 */
export async function loadAutomations(): Promise<void> {
	loading = true;
	error = null;

	try {
		const result = await apiClient.getAutomations();

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to load scenes');
		}

		// Transform SmartThings Scenes to frontend Automation format
		const newAutomationMap = new Map<string, Automation>();

		// Extract scenes array from response
		// API returns: { success: true, data: [...] } where data is the scenes array
		const scenes = result.data || [];

		scenes.forEach((scene: any) => {
			const automation: Automation = {
				id: scene.sceneId,
				name: scene.sceneName,
				enabled: true, // Scenes are always "enabled" (manually triggered)
				triggers: ['Manual'], // Scenes are manually triggered
				actions: extractSceneActions(scene),
				lastExecuted: scene.lastExecutedDate
					? new Date(scene.lastExecutedDate).getTime()
					: undefined
			};
			newAutomationMap.set(automation.id, automation);
		});

		automationMap = newAutomationMap;
	} catch (err) {
		console.error('Failed to load scenes:', err);
		error = err instanceof Error ? err.message : 'Failed to load scenes';
		automationMap = new Map(); // Clear automations on error
	} finally {
		loading = false;
	}
}

/**
 * Extract action descriptions from SmartThings Scene
 *
 * Scenes don't expose action details via API.
 * This provides a simplified description for the UI.
 */
function extractSceneActions(scene: any): string[] {
	// Scenes don't expose action details in the API response
	// Just show a generic message
	return ['Activate scene'];
}

/**
 * Execute a scene (toggle button triggers scene execution)
 *
 * Note: Scenes cannot be enabled/disabled - they're always manually triggered.
 * This method executes the scene instead of toggling state.
 */
export async function toggleAutomation(automationId: string): Promise<boolean> {
	const automation = automationMap.get(automationId);
	if (!automation) {
		console.error('Scene not found:', automationId);
		return false;
	}

	try {
		const result = await apiClient.executeScene(automationId);

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to execute scene');
		}

		// Update last executed time
		automationMap.set(automationId, {
			...automation,
			lastExecuted: Date.now()
		});

		return true;
	} catch (err) {
		console.error('Failed to execute scene:', err);
		error = err instanceof Error ? err.message : 'Failed to execute scene';
		return false;
	}
}

/**
 * Get automation by ID
 */
export function getAutomationById(automationId: string): Automation | undefined {
	return automationMap.get(automationId);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get automation store with reactive state and actions
 */
export function getAutomationStore() {
	return {
		// State (read-only getters)
		get automations() {
			return automations;
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
		loadAutomations,
		toggleAutomation,
		getAutomationById
	};
}
