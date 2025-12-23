/**
 * Dashboard Store - Svelte 5 Runes-based state management for Kiosk Mode
 *
 * Design Decision: Dedicated dashboard store with localStorage persistence
 * Rationale: Dashboard needs separate state from devices/rooms for kiosk mode,
 * visibility filters, and UI customization.
 *
 * State Pattern:
 * - $state(): Reactive state primitives with localStorage persistence
 * - Kiosk mode controls fullscreen display
 * - Visibility filters for rooms/devices
 * - UI feature toggles (status crawler, alerts)
 *
 * Architecture:
 * - Single source of truth for dashboard configuration
 * - Persisted to localStorage for user preferences
 * - ESC key handler to exit kiosk mode
 */

const STORAGE_KEY = 'smarterthings.dashboard';

export interface DashboardConfig {
	kioskMode: boolean;
	hiddenRooms: string[];
	hiddenDevices: string[];
	showStatusCrawler: boolean;
	showAlerts: boolean;
}

const DEFAULT_CONFIG: DashboardConfig = {
	kioskMode: false,
	hiddenRooms: [],
	hiddenDevices: [],
	showStatusCrawler: true,
	showAlerts: true
};

// ============================================================================
// STATE (Svelte 5 Runes)
// ============================================================================

/**
 * Load config from localStorage
 */
function loadConfig(): DashboardConfig {
	if (typeof window === 'undefined') return DEFAULT_CONFIG;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return { ...DEFAULT_CONFIG, ...parsed };
		}
	} catch (error) {
		console.error('[DashboardStore] Failed to load config from localStorage:', error);
	}

	return DEFAULT_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveConfig(config: DashboardConfig): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		console.log('[DashboardStore] Config saved to localStorage');
	} catch (error) {
		console.error('[DashboardStore] Failed to save config to localStorage:', error);
	}
}

/**
 * Dashboard configuration state
 */
let config = $state<DashboardConfig>(loadConfig());

// ============================================================================
// DERIVED STATE
// ============================================================================

/**
 * Computed visibility checks
 */
let isRoomVisible = $derived.by(() => {
	return (roomId: string) => !config.hiddenRooms.includes(roomId);
});

let isDeviceVisible = $derived.by(() => {
	return (deviceId: string) => !config.hiddenDevices.includes(deviceId);
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Set kiosk mode
 * When enabled, hides navigation and footer for fullscreen experience
 */
export function setKioskMode(enabled: boolean): void {
	config.kioskMode = enabled;
	saveConfig(config);
}

/**
 * Toggle kiosk mode
 */
export function toggleKioskMode(): void {
	setKioskMode(!config.kioskMode);
}

/**
 * Hide room from dashboard
 */
export function hideRoom(roomId: string): void {
	if (!config.hiddenRooms.includes(roomId)) {
		config.hiddenRooms = [...config.hiddenRooms, roomId];
		saveConfig(config);
	}
}

/**
 * Show room on dashboard
 */
export function showRoom(roomId: string): void {
	config.hiddenRooms = config.hiddenRooms.filter((id) => id !== roomId);
	saveConfig(config);
}

/**
 * Hide device from dashboard
 */
export function hideDevice(deviceId: string): void {
	if (!config.hiddenDevices.includes(deviceId)) {
		config.hiddenDevices = [...config.hiddenDevices, deviceId];
		saveConfig(config);
	}
}

/**
 * Show device on dashboard
 */
export function showDevice(deviceId: string): void {
	config.hiddenDevices = config.hiddenDevices.filter((id) => id !== deviceId);
	saveConfig(config);
}

/**
 * Set status crawler visibility
 */
export function setShowStatusCrawler(show: boolean): void {
	config.showStatusCrawler = show;
	saveConfig(config);
}

/**
 * Set alerts visibility
 */
export function setShowAlerts(show: boolean): void {
	config.showAlerts = show;
	saveConfig(config);
}

/**
 * Reset dashboard config to defaults
 */
export function resetConfig(): void {
	config = { ...DEFAULT_CONFIG };
	saveConfig(config);
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get dashboard store with reactive state and actions
 */
export function getDashboardStore() {
	return {
		// State (read-only getters)
		get config() {
			return config;
		},
		get kioskMode() {
			return config.kioskMode;
		},
		get hiddenRooms() {
			return config.hiddenRooms;
		},
		get hiddenDevices() {
			return config.hiddenDevices;
		},
		get showStatusCrawler() {
			return config.showStatusCrawler;
		},
		get showAlerts() {
			return config.showAlerts;
		},

		// Computed
		isRoomVisible,
		isDeviceVisible,

		// Actions
		setKioskMode,
		toggleKioskMode,
		hideRoom,
		showRoom,
		hideDevice,
		showDevice,
		setShowStatusCrawler,
		setShowAlerts,
		resetConfig
	};
}
