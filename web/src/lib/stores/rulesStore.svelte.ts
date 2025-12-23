/**
 * Rules Store - Svelte 5 Runes-based state management
 *
 * Design Decision: Rules management for smart home automation
 * Rationale: Rules (conditional automations with IF/THEN logic) are a core
 * feature of smart homes, allowing users to create automated responses based
 * on triggers and conditions.
 *
 * Key Differences from Scenes:
 * - Rules CAN be enabled/disabled (unlike scenes which are always "enabled")
 * - Rules have trigger conditions (not just "Manual")
 * - Rules have IF/THEN logic (conditions → actions)
 *
 * State Pattern:
 * - $state(): Reactive state primitives
 * - $derived(): Computed values with automatic statistics calculation
 * - Map-based rule storage for O(1) lookups
 *
 * Architecture:
 * - Single source of truth for all rules
 * - Statistics computed from rule data
 * - Rules can be enabled/disabled via SmartThings API
 */

import { toast } from 'svelte-sonner';
import { apiClient } from '$lib/api/client';

export interface Rule {
	id: string;
	name: string;
	enabled: boolean; // Rules can be enabled/disabled
	triggers?: string[]; // IF conditions
	actions?: string[]; // THEN actions
	lastExecuted?: number; // Timestamp in milliseconds
}

export interface RulesResponse {
	success: boolean;
	data: {
		count: number;
		rules: any[]; // Array of RuleInfo objects
	};
	error?: {
		message: string;
	};
}

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Rules map for O(1) lookups
 */
let ruleMap = $state<Map<string, Rule>>(new Map());

/**
 * Loading and error state
 */
let loading = $state(true);
let error = $state<string | null>(null);

// ============================================================================
// DERIVED STATE
// ============================================================================

/**
 * Convert rule map to array, sorted by name
 */
let rules = $derived(
	Array.from(ruleMap.values()).sort((a, b) => a.name.localeCompare(b.name))
);

/**
 * Rule statistics
 */
let stats = $derived({
	total: rules.length,
	enabled: rules.filter((r) => r.enabled).length,
	disabled: rules.filter((r) => !r.enabled).length
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Load rules from API
 *
 * Design Decision: Direct SmartThings Rules API integration
 * Rationale: Backend rule endpoints are now implemented,
 * providing real-time access to SmartThings Rules.
 */
export async function loadRules(): Promise<void> {
	loading = true;
	error = null;

	try {
		const response = await apiClient.fetch('/api/rules');

		if (!response.ok) {
			throw new Error(`Failed to fetch rules: ${response.statusText}`);
		}

		const result: RulesResponse = await response.json();

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to load rules');
		}

		// Transform SmartThings Rules to frontend Rule format
		const newRuleMap = new Map<string, Rule>();

		// Extract rules array from nested response structure
		// API returns: { success: true, data: { count: N, rules: [...] } }
		const rulesData = result.data;
		const rulesArray = rulesData.rules || [];

		rulesArray.forEach((rule: any) => {
			const ruleObj: Rule = {
				id: rule.id,
				name: rule.name,
				enabled: rule.enabled ?? true, // Rules can be enabled/disabled
				triggers: extractRuleTriggers(rule),
				actions: extractRuleActions(rule),
				lastExecuted: rule.lastExecutedDate
					? new Date(rule.lastExecutedDate).getTime()
					: undefined
			};
			newRuleMap.set(ruleObj.id, ruleObj);
		});

		ruleMap = newRuleMap;
	} catch (err) {
		console.error('Failed to load rules:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to load rules';
		error = errorMessage;

		// Error toast for load failures
		toast.error('Failed to load rules', {
			description: errorMessage
		});

		ruleMap = new Map(); // Clear rules on error
	} finally {
		loading = false;
	}
}

/**
 * Extract trigger descriptions from SmartThings Rule
 *
 * Rules expose trigger conditions via the API.
 * This provides simplified descriptions for the UI.
 */
function extractRuleTriggers(rule: any): string[] {
	const triggers: string[] = [];

	// Check for common trigger types in SmartThings Rules
	if (rule.actions) {
		// Rules may have "if" conditions in actions array
		const conditions = rule.actions.filter((action: any) => action.if);
		if (conditions.length > 0) {
			triggers.push(`${conditions.length} condition${conditions.length > 1 ? 's' : ''}`);
		}
	}

	// Fallback if no specific triggers found
	if (triggers.length === 0) {
		triggers.push('Automated trigger');
	}

	return triggers;
}

/**
 * Extract action descriptions from SmartThings Rule
 *
 * Rules expose action details via the API.
 * This provides simplified descriptions for the UI.
 */
function extractRuleActions(rule: any): string[] {
	const actions: string[] = [];

	if (rule.actions && Array.isArray(rule.actions)) {
		// Count different action types
		const commandActions = rule.actions.filter((a: any) => a.command);
		if (commandActions.length > 0) {
			actions.push(`${commandActions.length} device action${commandActions.length > 1 ? 's' : ''}`);
		}
	}

	// Fallback if no specific actions found
	if (actions.length === 0) {
		actions.push('Execute rule actions');
	}

	return actions;
}

/**
 * Execute a rule manually
 *
 * Triggers rule execution immediately, bypassing trigger conditions.
 * Useful for testing rules or manual execution.
 */
export async function executeRule(ruleId: string): Promise<boolean> {
	const rule = ruleMap.get(ruleId);
	if (!rule) {
		console.error('Rule not found:', ruleId);
		toast.error('Rule not found');
		return false;
	}

	try {
		const response = await apiClient.fetch(`/api/rules/${ruleId}/execute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		if (!response.ok) {
			throw new Error(`Failed to execute rule: ${response.statusText}`);
		}

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to execute rule');
		}

		// Update last executed time
		ruleMap.set(ruleId, {
			...rule,
			lastExecuted: Date.now()
		});

		// Success toast
		toast.success(`Rule "${rule.name}" executed successfully`, {
			description: 'All actions completed'
		});

		return true;
	} catch (err) {
		console.error('Failed to execute rule:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to execute rule';
		error = errorMessage;

		// Error toast
		toast.error(`Failed to execute rule "${rule.name}"`, {
			description: errorMessage
		});

		return false;
	}
}

/**
 * Enable or disable a rule
 *
 * Updates the rule's enabled status in SmartThings.
 * Disabled rules will not automatically execute when triggered.
 */
export async function setRuleEnabled(ruleId: string, enabled: boolean): Promise<boolean> {
	const rule = ruleMap.get(ruleId);
	if (!rule) {
		console.error('Rule not found:', ruleId);
		toast.error('Rule not found');
		return false;
	}

	try {
		const response = await apiClient.fetch(`/api/rules/${ruleId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled })
		});

		if (!response.ok) {
			throw new Error(`Failed to update rule: ${response.statusText}`);
		}

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to update rule');
		}

		// Update local state
		ruleMap.set(ruleId, {
			...rule,
			enabled
		});

		// Success toast
		toast.success(`Rule "${rule.name}" ${enabled ? 'enabled' : 'disabled'}`, {
			description: enabled ? 'Rule is now active' : 'Rule is now inactive'
		});

		return true;
	} catch (err) {
		console.error('Failed to update rule:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to update rule';
		error = errorMessage;

		// Error toast
		toast.error(`Failed to ${enabled ? 'enable' : 'disable'} rule "${rule.name}"`, {
			description: errorMessage
		});

		return false;
	}
}

/**
 * Get rule by ID
 */
export function getRuleById(ruleId: string): Rule | undefined {
	return ruleMap.get(ruleId);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get rules store with reactive state and actions
 */
export function getRulesStore() {
	return {
		// State (read-only getters)
		get rules() {
			return rules;
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
		loadRules,
		executeRule,
		setRuleEnabled,
		getRuleById
	};
}
