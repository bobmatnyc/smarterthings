import type { UnifiedDevice, DirectResult, DeviceId } from '$types';
import { isSuccess } from '$types';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

export class ApiClient {
	private baseUrl = '/api';

	/**
	 * Internal fetch wrapper with 401 handling
	 *
	 * Design Decision: Centralized auth error handling
	 * Rationale: All API calls should automatically redirect to /auth on 401
	 * to re-authenticate instead of showing cryptic errors.
	 *
	 * @param url URL to fetch (relative or absolute)
	 * @param options Fetch options
	 * @returns Response object
	 * @throws Error if session expired (after redirect)
	 */
	private async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
		const response = await fetch(url, options);

		// Check for 401 Unauthorized (session expired)
		if (response.status === 401) {
			console.warn('[ApiClient] 401 Unauthorized - redirecting to auth');

			// Only redirect in browser context (not during SSR)
			if (browser) {
				// Check if we're already on auth page to prevent redirect loop
				const currentPath = window.location.pathname;
				if (!currentPath.startsWith('/auth')) {
					// Redirect to auth with session expired message
					await goto('/auth?reason=session_expired');
				}
			}

			// Throw error after redirect to prevent further processing
			throw new Error('Session expired - please re-authenticate');
		}

		return response;
	}

	/**
	 * List all devices with optional filters
	 *
	 * @param filters Optional room and capability filters
	 * @returns DirectResult with device list and metadata
	 */
	async getDevices(filters?: {
		room?: string;
		capability?: string;
	}): Promise<DirectResult<{ count: number; devices: UnifiedDevice[] }>> {
		const params = new URLSearchParams();
		if (filters?.room) params.append('room', filters.room);
		if (filters?.capability) params.append('capability', filters.capability);

		const url = params.toString()
			? `${this.baseUrl}/devices?${params.toString()}`
			: `${this.baseUrl}/devices`;

		const response = await this.fetchWithAuth(url);
		return response.json();
	}

	/**
	 * Get device status and current state
	 *
	 * @param deviceId Device ID
	 * @returns DirectResult with device status
	 */
	async getDeviceStatus(deviceId: DeviceId): Promise<DirectResult<any>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/devices/${deviceId}/status`);
		return response.json();
	}

	/**
	 * Turn device on
	 *
	 * @param deviceId Device ID
	 * @returns DirectResult indicating success
	 */
	async turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/devices/${deviceId}/on`, {
			method: 'POST'
		});
		return response.json();
	}

	/**
	 * Turn device off
	 *
	 * @param deviceId Device ID
	 * @returns DirectResult indicating success
	 */
	async turnOffDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/devices/${deviceId}/off`, {
			method: 'POST'
		});
		return response.json();
	}

	/**
	 * Set device brightness level
	 *
	 * @param deviceId Device ID
	 * @param level Brightness level (0-100)
	 * @returns DirectResult indicating success
	 */
	async setDeviceLevel(deviceId: DeviceId, level: number): Promise<DirectResult<void>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/devices/${deviceId}/level`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ level })
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				success: false,
				error: { code: 'UNKNOWN_ERROR', message: 'Failed to set device level' }
			}));
			throw new Error(error.error?.message || `Failed to set level: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Create EventSource for device events (SSE)
	 *
	 * @returns EventSource instance for real-time updates
	 */
	createDeviceEventSource(): EventSource {
		return new EventSource(`${this.baseUrl}/devices/events`);
	}

	/**
	 * List all rooms
	 *
	 * @returns DirectResult with room list
	 */
	async getRooms(): Promise<DirectResult<any>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/rooms`);
		return response.json();
	}

	/**
	 * List all automations (scenes/manually run routines)
	 *
	 * Design Decision: Scenes API integration
	 * Rationale: Provides access to SmartThings scenes (manually run routines)
	 * that can be executed on-demand by users.
	 *
	 * @returns DirectResult with scenes list
	 */
	async getAutomations(): Promise<DirectResult<any>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/automations`);
		return response.json();
	}

	/**
	 * Execute a scene (automation)
	 *
	 * Design Decision: Direct scene execution
	 * Rationale: Triggers immediate execution of a scene, activating all
	 * configured device states. Scenes are always manually triggered.
	 *
	 * @param sceneId Scene identifier
	 * @returns DirectResult indicating success
	 */
	async executeScene(sceneId: string): Promise<DirectResult<void>> {
		const response = await this.fetchWithAuth(`${this.baseUrl}/automations/${sceneId}/execute`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				success: false,
				error: { code: 'UNKNOWN_ERROR', message: 'Failed to execute scene' }
			}));
			throw new Error(error.error?.message || `Failed to execute scene: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Generic fetch method for arbitrary API calls
	 * Exported for use in components that need direct API access
	 *
	 * @param url API endpoint (relative to baseUrl or absolute)
	 * @param options Fetch options
	 * @returns Response object
	 */
	async fetch(url: string, options?: RequestInit): Promise<Response> {
		// If URL is relative and doesn't start with /api, prepend baseUrl
		const fullUrl = url.startsWith('http') || url.startsWith('/api')
			? url
			: `${this.baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

		return this.fetchWithAuth(fullUrl, options);
	}
}

export const apiClient = new ApiClient();
