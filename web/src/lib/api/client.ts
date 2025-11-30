import type { UnifiedDevice, DirectResult, DeviceId } from '$types';
import { isSuccess } from '$types';

export class ApiClient {
	private baseUrl = '/api';

	async getDevices(): Promise<DirectResult<UnifiedDevice[]>> {
		const response = await fetch(`${this.baseUrl}/devices`);
		return response.json();
	}

	async turnOnDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
		const response = await fetch(`${this.baseUrl}/devices/${deviceId}/on`, {
			method: 'POST'
		});
		return response.json();
	}

	async turnOffDevice(deviceId: DeviceId): Promise<DirectResult<void>> {
		const response = await fetch(`${this.baseUrl}/devices/${deviceId}/off`, {
			method: 'POST'
		});
		return response.json();
	}
}

export const apiClient = new ApiClient();
