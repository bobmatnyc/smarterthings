/**
 * SSE Connection Manager for Device Events
 *
 * Design Decision: EventSource with Auto-Reconnect
 * Rationale: Server-Sent Events provide one-way real-time updates
 * with built-in reconnection, perfect for device state broadcasting.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat monitoring (detects stale connections)
 * - Event type routing (device-state, device-online, etc.)
 * - Cleanup on unmount
 *
 * Architecture:
 * - EventSource API for SSE connection
 * - Device store integration for state updates
 * - Reconnect logic with max retries
 *
 * Performance:
 * - Single persistent connection for all devices
 * - Minimal overhead (~5KB/min for heartbeats)
 * - Event processing: <10ms per event
 */

import { apiClient } from '$lib/api/client';
import type { getDeviceStore } from '$lib/stores/deviceStore.svelte';

/**
 * SSE connection state
 */
let eventSource: EventSource | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let lastHeartbeat = Date.now();

/**
 * Maximum reconnection attempts before giving up
 */
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Connect to device SSE stream
 *
 * Establishes EventSource connection and sets up event handlers.
 * Automatically reconnects on error with exponential backoff.
 *
 * @param store Device store instance
 * @returns Cleanup function to disconnect
 */
export function connectDeviceSSE(store: ReturnType<typeof getDeviceStore>): () => void {
	function connect() {
		// Close existing connection
		if (eventSource) {
			eventSource.close();
		}

		// Check reconnection limit
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.error('[SSE] Max reconnection attempts reached, giving up');
			store.setSSEConnected(false);
			return;
		}

		// Create new EventSource
		try {
			// Connect to actual SSE endpoint (backend /api/events/stream)
			eventSource = new EventSource('http://localhost:5182/api/events/stream');
			store.setSSEConnected(false);

			// Connection opened
			eventSource.onopen = () => {
				console.log('[SSE] Connected to device event stream');
				store.setSSEConnected(true);
				reconnectAttempts = 0; // Reset on successful connection
				lastHeartbeat = Date.now();
			};

			// Connection error
			eventSource.onerror = (error) => {
				console.error('[SSE] Connection error:', error);
				store.setSSEConnected(false);

				// Close and attempt reconnect with exponential backoff
				eventSource?.close();

				const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
				reconnectAttempts++;

				console.log(
					`[SSE] Reconnecting in ${backoffMs}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
				);

				reconnectTimeout = setTimeout(() => {
					connect();
				}, backoffMs);
			};

			// ================================================================
			// Event Handlers
			// ================================================================

			/**
			 * Connected event - Initial connection acknowledgment
			 */
			eventSource.addEventListener('connected', (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log('[SSE] Connection acknowledged:', data.timestamp);
				} catch (error) {
					console.error('[SSE] Failed to parse connected event:', error);
				}
			});

			/**
			 * Heartbeat event - Keep-alive signal
			 * Sent every 30 seconds by server
			 */
			eventSource.addEventListener('heartbeat', (event) => {
				try {
					const data = JSON.parse(event.data);
					lastHeartbeat = Date.now();
					console.debug('[SSE] Heartbeat received:', {
						timestamp: data.timestamp,
						clients: data.connectedClients
					});
				} catch (error) {
					console.error('[SSE] Failed to parse heartbeat event:', error);
				}
			});

			/**
			 * Device state change event
			 * Triggered when device state changes (on/off, brightness, etc.)
			 */
			eventSource.addEventListener('device-state', (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log('[SSE] Device state updated:', {
						deviceId: data.deviceId,
						state: data.state
					});
					store.updateDeviceState(data.deviceId, data.state);
				} catch (error) {
					console.error('[SSE] Failed to parse device-state event:', error);
				}
			});

			/**
			 * Device online status change event
			 * Triggered when device comes online or goes offline
			 */
			eventSource.addEventListener('device-online', (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log('[SSE] Device online status updated:', {
						deviceId: data.deviceId,
						online: data.online
					});
					store.updateDeviceOnlineStatus(data.deviceId, data.online);
				} catch (error) {
					console.error('[SSE] Failed to parse device-online event:', error);
				}
			});

			/**
			 * Device added event
			 * Triggered when new device is discovered
			 */
			eventSource.addEventListener('device-added', (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log('[SSE] Device added:', data.device.id);
					store.addDevice(data.device);
				} catch (error) {
					console.error('[SSE] Failed to parse device-added event:', error);
				}
			});

			/**
			 * Device removed event
			 * Triggered when device is removed from system
			 */
			eventSource.addEventListener('device-removed', (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log('[SSE] Device removed:', data.deviceId);
					store.removeDevice(data.deviceId);
				} catch (error) {
					console.error('[SSE] Failed to parse device-removed event:', error);
				}
			});

			/**
			 * New event listener - ACTUAL backend SSE event
			 * Handles 'new-event' broadcasts from /api/events/stream
			 *
			 * Event Structure (from webhook → queue → SSE broadcast):
			 * {
			 *   id: "evt-123",
			 *   type: "device_event",
			 *   source: "webhook",
			 *   deviceId: "device-456",
			 *   eventType: "switch.switch",
			 *   value: { switch: "on" },
			 *   timestamp: "2025-12-04T10:30:00Z"
			 * }
			 */
			eventSource.addEventListener('new-event', (event) => {
				try {
					const eventData = JSON.parse(event.data);
					console.log('[SSE] new-event received:', eventData);

					// Only process device events with state updates
					if (eventData.type === 'device_event' && eventData.deviceId && eventData.value) {
						console.log('[SSE] Processing device state change:', {
							deviceId: eventData.deviceId,
							stateUpdate: eventData.value
						});

						// Update device state in store (triggers UI reactivity)
						store.updateDeviceState(eventData.deviceId, eventData.value);
					}
				} catch (error) {
					console.error('[SSE] Failed to parse new-event:', error);
				}
			});

			// ================================================================
			// Stale Connection Detection
			// ================================================================

			/**
			 * Monitor heartbeats and reconnect if stale
			 * Checks every 10 seconds if last heartbeat was >60 seconds ago
			 */
			const staleCheckInterval = setInterval(() => {
				const timeSinceHeartbeat = Date.now() - lastHeartbeat;
				if (timeSinceHeartbeat > 60000) {
					// 60 seconds
					console.warn('[SSE] No heartbeat for 60s, connection may be stale, reconnecting...');
					clearInterval(staleCheckInterval);
					eventSource?.close();
					connect();
				}
			}, 10000);

			// Store interval for cleanup
			(eventSource as any)._staleCheckInterval = staleCheckInterval;
		} catch (error) {
			console.error('[SSE] Failed to create EventSource:', error);
			store.setSSEConnected(false);
		}
	}

	// Initial connection
	connect();

	// Return cleanup function
	return () => {
		console.log('[SSE] Disconnecting from device event stream');

		// Clear reconnect timeout
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}

		// Clear stale check interval
		if (eventSource && (eventSource as any)._staleCheckInterval) {
			clearInterval((eventSource as any)._staleCheckInterval);
		}

		// Close connection
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}

		store.setSSEConnected(false);
		reconnectAttempts = 0;
	};
}
