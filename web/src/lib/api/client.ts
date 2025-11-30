import type { UnifiedDevice, DirectResult, DeviceId } from '$types';
import { isSuccess } from '$types';

export class ApiClient {
	private baseUrl = '/api';

	/**
	 * List all devices with optional filters
	 *
	 * @param filters Optional room and capability filters
	 * @returns DirectResult with device list
	 */
	async getDevices(filters?: {
		room?: string;
		capability?: string;
	}): Promise<DirectResult<UnifiedDevice[]>> {
		const params = new URLSearchParams();
		if (filters?.room) params.append('room', filters.room);
		if (filters?.capability) params.append('capability', filters.capability);

		const url = params.toString()
			? `${this.baseUrl}/devices?${params.toString()}`
			: `${this.baseUrl}/devices`;

		const response = await fetch(url);
		return response.json();
	}

	/**
	 * Get device status and current state
	 *
	 * @param deviceId Device ID
	 * @returns DirectResult with device status
	 */
	async getDeviceStatus(deviceId: DeviceId): Promise<DirectResult<any>> {
		const response = await fetch(`${this.baseUrl}/devices/${deviceId}/status`);
		return response.json();
	}

	/**
	 * Turn device on
	 *
	 * @param deviceId Device ID
	 * @returns DirectResult indicating success
	 */
	async turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
		const response = await fetch(`${this.baseUrl}/devices/${deviceId}/on`, {
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
		const response = await fetch(`${this.baseUrl}/devices/${deviceId}/off`, {
			method: 'POST'
		});
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
}

export const apiClient = new ApiClient();
