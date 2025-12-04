/**
 * Events Store - Svelte 5 Runes-based state management for events
 *
 * Design Decision: SSE integration with fine-grained reactivity
 * Rationale: Svelte 5 runes provide optimal performance with automatic
 * dependency tracking for real-time event updates.
 *
 * State Pattern:
 * - $state(): Reactive state primitives
 * - $derived(): Computed values (memoized)
 * - SSE connection for real-time updates
 *
 * Architecture:
 * - Single source of truth for all events
 * - Filtered views computed reactively
 * - SSE integration for push notifications
 * - Auto-reconnect on disconnect
 *
 * Performance:
 * - Event list: Memoized with $derived
 * - Updates: Fine-grained (only affected components re-render)
 * - SSE latency: < 100ms (server → client)
 */

import { apiClient } from '$lib/api/client';

/**
 * Smart home event from backend
 */
export interface SmartHomeEvent {
	id: string;
	type: 'device_event' | 'user_command' | 'automation_trigger' | 'rule_execution';
	source: 'smartthings' | 'alexa' | 'mcp' | 'webhook';
	deviceId?: string;
	deviceName?: string;
	locationId?: string;
	eventType?: string;
	value?: any;
	timestamp: string; // ISO timestamp
	metadata?: Record<string, any>;
}

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Events array (in-memory, limited to 500 for performance)
 */
let events = $state<SmartHomeEvent[]>([]);

/**
 * Loading and error state
 */
let loading = $state(true);
let error = $state<string | null>(null);

/**
 * SSE connection state
 */
let connected = $state(false);
let sseConnection: EventSource | null = null;

/**
 * Reconnection state (ticket 1M-437 - exponential backoff)
 */
let retryCount = $state(0);
const MAX_RETRY_DELAY = 30000; // 30 seconds maximum delay

/**
 * Filter state
 */
let filters = $state<{
	type: string | null;
	source: string | null;
	deviceId: string | null;
}>({
	type: null,
	source: null,
	deviceId: null,
});

/**
 * Auto-scroll preference
 * When true, new events automatically appear at top (page scrolls)
 * When false, user scroll position is preserved
 */
let autoScroll = $state(true);

// ============================================================================
// DERIVED STATE (Computed Values)
// ============================================================================

/**
 * Filtered events based on current filters
 * Fine-grained reactivity: Only recomputes when dependencies change
 */
let filteredEvents = $derived.by(() => {
	let result = events;

	// Filter by type
	if (filters.type) {
		result = result.filter((e) => e.type === filters.type);
	}

	// Filter by source
	if (filters.source) {
		result = result.filter((e) => e.source === filters.source);
	}

	// Filter by device ID
	if (filters.deviceId) {
		result = result.filter((e) => e.deviceId === filters.deviceId);
	}

	return result;
});

/**
 * Event statistics
 */
let stats = $derived({
	total: events.length,
	filtered: filteredEvents.length,
	byType: events.reduce(
		(acc, event) => {
			acc[event.type] = (acc[event.type] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	),
	bySource: events.reduce(
		(acc, event) => {
			acc[event.source] = (acc[event.source] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	),
});

// ============================================================================
// ACTIONS (Exported Functions)
// ============================================================================

/**
 * Load recent events from API
 *
 * @param limit - Maximum events to fetch (default: 100, max: 500)
 */
export async function loadEvents(limit: number = 100): Promise<void> {
	loading = true;
	error = null;

	try {
		console.log('[EventsStore] Fetching recent events...');

		const response = await fetch(`http://localhost:5182/api/events?limit=${Math.min(limit, 500)}`);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const result = await response.json();

		if (result.success) {
			events = result.data.events || [];
			console.log(`[EventsStore] Loaded ${events.length} events`);
		} else {
			error = result.error?.message || 'Failed to load events';
		}
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load events';
		console.error('[EventsStore] Load error:', error);
	} finally {
		loading = false;
	}
}

/**
 * Connect to SSE stream for real-time updates
 *
 * Design Decision: Exponential backoff reconnection (ticket 1M-437)
 * Rationale: Prevents rapid reconnection attempts that could overload server.
 * Delays double with each retry: 1s → 2s → 4s → 8s → 16s → 30s (max).
 *
 * Automatically reconnects on disconnect.
 * Adds new events to the top of the list.
 */
export function connectSSE(): void {
	// Don't reconnect if already connected
	if (sseConnection) {
		console.log('[EventsStore] SSE already connected');
		return;
	}

	try {
		console.log('[EventsStore] Connecting to SSE stream...');

		sseConnection = new EventSource('http://localhost:5182/api/events/stream');

		// Connected event
		sseConnection.addEventListener('connected', (e) => {
			const data = JSON.parse(e.data);
			console.log('[EventsStore] SSE connected:', data);
			connected = true;
			retryCount = 0; // Reset retry count on successful connection
		});

		// Heartbeat event
		sseConnection.addEventListener('heartbeat', (e) => {
			const data = JSON.parse(e.data);
			console.log('[EventsStore] SSE heartbeat:', data);
		});

		// New event notification
		sseConnection.addEventListener('new-event', (e) => {
			const event: SmartHomeEvent = JSON.parse(e.data);
			console.log('[EventsStore] New event received:', event);

			// Add to top of events list (cap at 500)
			events = [event, ...events].slice(0, 500);
		});

		// Error handling with exponential backoff
		sseConnection.onerror = () => {
			console.error('[EventsStore] SSE connection error');
			connected = false;

			// Close and cleanup
			if (sseConnection) {
				sseConnection.close();
				sseConnection = null;
			}

			// Calculate exponential backoff delay
			// Formula: min(1000 * 2^retryCount, MAX_RETRY_DELAY)
			// Sequence: 1s, 2s, 4s, 8s, 16s, 30s (max)
			const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_RETRY_DELAY);
			retryCount++;

			console.log(`[EventsStore] Reconnecting in ${delay}ms (attempt ${retryCount})...`);

			// Auto-reconnect with exponential backoff
			setTimeout(() => {
				console.log('[EventsStore] Attempting SSE reconnect...');
				connectSSE();
			}, delay);
		};

		// Reset connection opened flag
		sseConnection.onopen = () => {
			console.log('[EventsStore] SSE connection opened');
			connected = true;
			retryCount = 0; // Reset on successful connection
		};
	} catch (err) {
		console.error('[EventsStore] SSE connection failed:', err);
		connected = false;
	}
}

/**
 * Disconnect from SSE stream
 */
export function disconnectSSE(): void {
	if (sseConnection) {
		console.log('[EventsStore] Disconnecting SSE');
		sseConnection.close();
		sseConnection = null;
		connected = false;
	}
}

/**
 * Set event type filter
 *
 * @param type - Event type or null to clear
 */
export function setTypeFilter(type: string | null): void {
	filters.type = type;
}

/**
 * Set event source filter
 *
 * @param source - Event source or null to clear
 */
export function setSourceFilter(source: string | null): void {
	filters.source = source;
}

/**
 * Set device ID filter
 *
 * @param deviceId - Device ID or null to clear
 */
export function setDeviceFilter(deviceId: string | null): void {
	filters.deviceId = deviceId;
}

/**
 * Clear all filters
 */
export function clearFilters(): void {
	filters.type = null;
	filters.source = null;
	filters.deviceId = null;
}

/**
 * Set auto-scroll preference
 *
 * @param enabled - Whether to auto-scroll on new events
 */
export function setAutoScroll(enabled: boolean): void {
	autoScroll = enabled;
}

/**
 * Clear all events (useful for testing or reset)
 */
export function clearEvents(): void {
	events = [];
}

// ============================================================================
// EXPORTS (Read-only Reactive State)
// ============================================================================

/**
 * Get events store with reactive state and actions
 *
 * Returns object with read-only getters for reactive state
 * and action functions for mutations.
 *
 * Usage:
 * ```svelte
 * <script>
 *   import { getEventsStore } from '$lib/stores/eventsStore.svelte';
 *
 *   const store = getEventsStore();
 *
 *   $effect(() => {
 *     store.loadEvents();
 *     store.connectSSE();
 *
 *     return () => {
 *       store.disconnectSSE();
 *     };
 *   });
 * </script>
 *
 * <div>
 *   {#each store.filteredEvents as event}
 *     <EventCard {event} />
 *   {/each}
 * </div>
 * ```
 */
export function getEventsStore() {
	return {
		// State (read-only getters for reactivity)
		get events() {
			return events;
		},
		get filteredEvents() {
			return filteredEvents;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get connected() {
			return connected;
		},
		get filters() {
			return filters;
		},
		get autoScroll() {
			return autoScroll;
		},
		get stats() {
			return stats;
		},

		// Actions
		loadEvents,
		connectSSE,
		disconnectSSE,
		setTypeFilter,
		setSourceFilter,
		setDeviceFilter,
		clearFilters,
		setAutoScroll,
		clearEvents,
	};
}
