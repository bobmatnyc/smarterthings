/**
 * Alert Store - Svelte 5 Runes-based state management for dashboard alerts
 *
 * Design Decision: Real-time alert queue with auto-dismiss
 * Rationale: Toast-style notifications need temporal state management.
 * Svelte 5 runes provide optimal fine-grained reactivity.
 *
 * State Pattern:
 * - $state(): Reactive alert queue
 * - Auto-dismiss timers with cleanup
 * - Max 5 visible alerts (queue overflow)
 *
 * Architecture:
 * - Alerts added via addAlert()
 * - Auto-dismiss after 10s (configurable)
 * - Manual dismiss with dismissAlert()
 * - Priority-based sorting (critical > warning > info)
 *
 * Performance:
 * - Queue operations: O(1) for add, O(n) for dismiss
 * - Auto-dismiss timers cleaned up properly
 * - Max queue size prevents memory leaks
 */

/**
 * Alert interface
 */
export interface Alert {
	id: string;
	priority: 'info' | 'warning' | 'critical';
	message: string;
	category: 'security' | 'energy' | 'system' | 'activity';
	timestamp: Date;
	dismissed: boolean;
}

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Alert queue (max 5 visible)
 */
let alerts = $state<Alert[]>([]);

/**
 * Auto-dismiss timers
 */
const dismissTimers = new Map<string, NodeJS.Timeout>();

/**
 * Configuration
 */
const MAX_VISIBLE_ALERTS = 5;
const AUTO_DISMISS_MS = 10000; // 10 seconds

// ============================================================================
// DERIVED STATE
// ============================================================================

/**
 * Visible alerts (not dismissed, sorted by priority)
 */
let visibleAlerts = $derived.by(() => {
	return alerts
		.filter((a) => !a.dismissed)
		.sort((a, b) => {
			// Sort by priority: critical > warning > info
			const priorityOrder = { critical: 3, warning: 2, info: 1 };
			const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
			if (diff !== 0) return diff;

			// Secondary sort: newest first
			return b.timestamp.getTime() - a.timestamp.getTime();
		})
		.slice(0, MAX_VISIBLE_ALERTS);
});

/**
 * Alert statistics
 */
let stats = $derived({
	total: alerts.length,
	visible: visibleAlerts.length,
	dismissed: alerts.filter((a) => a.dismissed).length,
	byPriority: alerts.reduce(
		(acc, alert) => {
			acc[alert.priority] = (acc[alert.priority] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	),
	byCategory: alerts.reduce(
		(acc, alert) => {
			acc[alert.category] = (acc[alert.category] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	)
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Add alert to queue
 *
 * @param alert - Alert to add (without id, timestamp, dismissed)
 *
 * Design Decision: Auto-dismiss with configurable timeout
 * Rationale: Alerts are ephemeral notifications. Auto-dismiss prevents
 * notification fatigue while allowing manual dismissal.
 */
export function addAlert(
	alert: Omit<Alert, 'id' | 'timestamp' | 'dismissed'>
): void {
	const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	const newAlert: Alert = {
		...alert,
		id,
		timestamp: new Date(),
		dismissed: false
	};

	// Add to queue
	alerts = [newAlert, ...alerts];

	console.log(`[AlertStore] Alert added: ${alert.priority} - ${alert.message}`);

	// Setup auto-dismiss timer
	const timer = setTimeout(() => {
		dismissAlert(id);
	}, AUTO_DISMISS_MS);

	dismissTimers.set(id, timer);

	// Cleanup old dismissed alerts if queue gets too large (> 20)
	if (alerts.length > 20) {
		const dismissed = alerts.filter((a) => a.dismissed);
		if (dismissed.length > 10) {
			// Remove oldest dismissed alerts
			const idsToRemove = dismissed
				.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
				.slice(0, dismissed.length - 10)
				.map((a) => a.id);

			alerts = alerts.filter((a) => !idsToRemove.includes(a.id));

			// Cleanup timers
			idsToRemove.forEach((id) => {
				const timer = dismissTimers.get(id);
				if (timer) {
					clearTimeout(timer);
					dismissTimers.delete(id);
				}
			});
		}
	}
}

/**
 * Dismiss alert by ID
 *
 * @param id - Alert ID to dismiss
 */
export function dismissAlert(id: string): void {
	// Mark as dismissed
	const alertIndex = alerts.findIndex((a) => a.id === id);
	if (alertIndex !== -1) {
		alerts[alertIndex].dismissed = true;
		alerts = [...alerts]; // Trigger reactivity

		console.log(`[AlertStore] Alert dismissed: ${id}`);
	}

	// Clear timer
	const timer = dismissTimers.get(id);
	if (timer) {
		clearTimeout(timer);
		dismissTimers.delete(id);
	}
}

/**
 * Clear all alerts
 */
export function clearAll(): void {
	// Clear all timers
	dismissTimers.forEach((timer) => clearTimeout(timer));
	dismissTimers.clear();

	// Clear alerts
	alerts = [];

	console.log('[AlertStore] All alerts cleared');
}

/**
 * Clear only dismissed alerts
 */
export function clearDismissed(): void {
	const dismissedIds = alerts.filter((a) => a.dismissed).map((a) => a.id);

	// Clear timers for dismissed alerts
	dismissedIds.forEach((id) => {
		const timer = dismissTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			dismissTimers.delete(id);
		}
	});

	// Remove dismissed alerts
	alerts = alerts.filter((a) => !a.dismissed);

	console.log(`[AlertStore] Cleared ${dismissedIds.length} dismissed alerts`);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get alert store with reactive state and actions
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { getAlertStore } from '$lib/stores/alertStore.svelte';
 *
 *   const alertStore = getAlertStore();
 *
 *   // Add alert
 *   alertStore.addAlert({
 *     priority: 'warning',
 *     message: 'Front door opened',
 *     category: 'security'
 *   });
 * </script>
 *
 * <div>
 *   {#each alertStore.visibleAlerts as alert}
 *     <AlertCard {alert} onDismiss={() => alertStore.dismissAlert(alert.id)} />
 *   {/each}
 * </div>
 * ```
 */
export function getAlertStore() {
	return {
		// State (read-only getters)
		get alerts() {
			return alerts;
		},
		get visibleAlerts() {
			return visibleAlerts;
		},
		get stats() {
			return stats;
		},

		// Actions
		addAlert,
		dismissAlert,
		clearAll,
		clearDismissed
	};
}
