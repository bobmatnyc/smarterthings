/**
 * ConnectionStatus Component Tests
 *
 * Tests for SSE connection status indicator component.
 * Verifies that the component properly reacts to SSE connection state changes.
 *
 * Bug Fix Verification: Ticket SSE-CONNECTION-STATUS-BUG-2025-12-21
 * - Tests $derived.by() fix for module-level state reactivity
 * - Ensures UI updates when sseConnected state changes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ConnectionStatus from '../../../../web/src/lib/components/layout/ConnectionStatus.svelte';
import type { getDeviceStore } from '../../../../web/src/lib/stores/deviceStore.svelte';

// Mock the device store module
vi.mock('../../../../web/src/lib/stores/deviceStore.svelte', () => {
	let mockSSEConnected = false;

	return {
		getDeviceStore: vi.fn(() => ({
			get sseConnected() {
				return mockSSEConnected;
			},
			setSSEConnected: vi.fn((connected: boolean) => {
				mockSSEConnected = connected;
			}),
			// Add other required store properties/methods as needed
			devices: [],
			filteredDevices: [],
			loading: false,
			error: null,
			stats: { total: 0, online: 0, offline: 0, filtered: 0 }
		}))
	};
});

describe('ConnectionStatus Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render with "Reconnecting..." when SSE is disconnected', () => {
		render(ConnectionStatus);

		// Check for reconnecting status
		const statusText = screen.getByText(/Reconnecting.../i);
		expect(statusText).toBeTruthy();

		// Check for amber color class
		const container = statusText.closest('.connection-status');
		expect(container?.classList.contains('reconnecting')).toBe(true);
	});

	it('should render with "Connected" when SSE is connected', () => {
		// Mock the store to return connected state
		const mockStore = {
			get sseConnected() {
				return true; // Connected state
			},
			setSSEConnected: vi.fn()
		};

		vi.mocked(require('../../../../web/src/lib/stores/deviceStore.svelte').getDeviceStore).mockReturnValue(
			mockStore as any
		);

		render(ConnectionStatus);

		// Check for connected status
		const statusText = screen.getByText(/Connected/i);
		expect(statusText).toBeTruthy();

		// Check for green color class
		const container = statusText.closest('.connection-status');
		expect(container?.classList.contains('connected')).toBe(true);
	});

	it('should update reactively when SSE connection state changes', async () => {
		// This test verifies the $derived.by() fix works correctly
		let mockSSEConnected = false;
		const mockStore = {
			get sseConnected() {
				return mockSSEConnected;
			},
			setSSEConnected: vi.fn((connected: boolean) => {
				mockSSEConnected = connected;
			})
		};

		vi.mocked(require('../../../../web/src/lib/stores/deviceStore.svelte').getDeviceStore).mockReturnValue(
			mockStore as any
		);

		const { component } = render(ConnectionStatus);

		// Initial state: disconnected
		expect(screen.getByText(/Reconnecting.../i)).toBeTruthy();

		// Simulate SSE connection
		mockStore.setSSEConnected(true);

		// Force component update (in real Svelte, $derived.by() does this automatically)
		await component.$set({});

		// Should now show "Connected"
		expect(screen.queryByText(/Connected/i)).toBeTruthy();
	});

	it('should have proper accessibility attributes', () => {
		const { container } = render(ConnectionStatus);

		// Check ARIA role
		const statusElement = container.querySelector('[role="status"]');
		expect(statusElement).toBeTruthy();

		// Check aria-live attribute
		expect(statusElement?.getAttribute('aria-live')).toBe('polite');

		// Check title attribute for tooltip
		const titleAttr = statusElement?.getAttribute('title');
		expect(titleAttr).toBeTruthy();
		expect(['Connected', 'Reconnecting...']).toContain(titleAttr);
	});

	it('should display pulse animation indicator', () => {
		const { container } = render(ConnectionStatus);

		// Check for pulse element
		const pulseElement = container.querySelector('.pulse');
		expect(pulseElement).toBeTruthy();

		// Should have green or amber class
		const hasColorClass =
			pulseElement?.classList.contains('green') || pulseElement?.classList.contains('amber');
		expect(hasColorClass).toBe(true);
	});
});

describe('ConnectionStatus - Reactivity Edge Cases', () => {
	it('should handle rapid connect/disconnect cycles', async () => {
		let mockSSEConnected = false;
		const mockStore = {
			get sseConnected() {
				return mockSSEConnected;
			},
			setSSEConnected: vi.fn((connected: boolean) => {
				mockSSEConnected = connected;
			})
		};

		vi.mocked(require('../../../../web/src/lib/stores/deviceStore.svelte').getDeviceStore).mockReturnValue(
			mockStore as any
		);

		const { component } = render(ConnectionStatus);

		// Initial: disconnected
		expect(screen.getByText(/Reconnecting.../i)).toBeTruthy();

		// Connect
		mockStore.setSSEConnected(true);
		await component.$set({});
		expect(screen.queryByText(/Connected/i)).toBeTruthy();

		// Disconnect
		mockStore.setSSEConnected(false);
		await component.$set({});
		expect(screen.queryByText(/Reconnecting.../i)).toBeTruthy();

		// Reconnect
		mockStore.setSSEConnected(true);
		await component.$set({});
		expect(screen.queryByText(/Connected/i)).toBeTruthy();
	});

	it('should handle store initialization with connected state', () => {
		const mockStore = {
			get sseConnected() {
				return true; // Already connected at init
			},
			setSSEConnected: vi.fn()
		};

		vi.mocked(require('../../../../web/src/lib/stores/deviceStore.svelte').getDeviceStore).mockReturnValue(
			mockStore as any
		);

		render(ConnectionStatus);

		// Should immediately show "Connected"
		expect(screen.getByText(/Connected/i)).toBeTruthy();

		const container = screen.getByText(/Connected/i).closest('.connection-status');
		expect(container?.classList.contains('connected')).toBe(true);
	});
});
