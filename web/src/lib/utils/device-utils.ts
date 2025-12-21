/**
 * Device Utility Functions
 *
 * Brilliant device detection and categorization utilities.
 * Ref: Linear ticket 1M-559 - Add Brilliant Device Auto-Detection
 *
 * Design Decision: Manufacturer-Based Detection
 * Rationale: Uses reliable `deviceManufacturerCode` from SmartThings API
 * rather than parsing device names which users can change.
 *
 * Detection Strategy:
 * - Primary: Check manufacturer field equals "Brilliant Home Technology"
 * - Fallback: Case-insensitive substring match for "brilliant"
 *
 * Device Type Inference:
 * - Brilliant Dimmer: Has both switch AND switchLevel capabilities
 * - Brilliant Switch: Has switch but NOT switchLevel
 * - Brilliant Plug: Has powerMeter capability (energy monitoring)
 *
 * Trade-offs:
 * - Performance: O(1) string comparison vs. regex (faster)
 * - Reliability: Uses official metadata vs. user-changeable names
 * - Extensibility: Easy to add other manufacturers using same pattern
 */

import type { UnifiedDevice } from '$types';

/**
 * Check if device is manufactured by Brilliant Home Technology.
 *
 * Uses manufacturer metadata from SmartThings API which is reliable
 * and not user-editable.
 *
 * @param device Unified device to check
 * @returns True if device is a Brilliant device
 *
 * @example
 * ```typescript
 * if (isBrilliantDevice(device)) {
 *   console.log('Brilliant Control detected');
 * }
 * ```
 */
export function isBrilliantDevice(device: UnifiedDevice): boolean {
	// Primary detection: exact manufacturer match
	if (device.manufacturer === 'Brilliant Home Technology') {
		return true;
	}

	// Fallback 1: case-insensitive substring match
	// Handles potential variations in manufacturer string
	if (device.manufacturer?.toLowerCase().includes('brilliant')) {
		return true;
	}

	// Fallback 2: VIPER device type detection
	// SmartThings API returns null manufacturer for cloud-integrated devices
	// VIPER type devices are Brilliant Home Technology devices
	// See: docs/BRILLIANT-SETUP.md for details on Brilliant integration
	if (device.model === 'VIPER' || device.platformSpecific?.type === 'VIPER') {
		return true;
	}

	return false;
}

/**
 * Determine Brilliant device type based on capabilities.
 *
 * Device Type Inference:
 * - Plug: Has powerMeter (energy monitoring)
 * - Dimmer: Has both switch AND switchLevel (dimmable light)
 * - Switch: Has switch but NOT switchLevel (on/off only)
 *
 * Priority Order:
 * 1. Plug (most specific - has powerMeter)
 * 2. Dimmer (has level control)
 * 3. Switch (basic on/off)
 *
 * @param device Unified device to categorize
 * @returns Device type category
 *
 * @example
 * ```typescript
 * const type = getBrilliantDeviceType(device);
 * const icon = type === 'dimmer' ? '🔆' : '💡';
 * ```
 */
export function getBrilliantDeviceType(device: UnifiedDevice): 'dimmer' | 'switch' | 'plug' {
	// Type guard: only process Brilliant devices
	if (!isBrilliantDevice(device)) {
		return 'switch'; // Default fallback for non-Brilliant devices
	}

	// Check capabilities (capability IDs are lowercase in our system)
	const capabilities = device.capabilities.map((cap) => String(cap).toLowerCase());
	const hasPower = capabilities.includes('powermeter') || capabilities.includes('energymeter');
	const hasLevel = capabilities.includes('switchlevel') || capabilities.includes('dimmer');
	const hasSwitch = capabilities.includes('switch');

	// Priority 1: Smart Plug (has power monitoring)
	if (hasPower) {
		return 'plug';
	}

	// Priority 2: Dimmer (has level control)
	if (hasLevel && hasSwitch) {
		return 'dimmer';
	}

	// Priority 3: Basic Switch
	return 'switch';
}

/**
 * Group Brilliant devices by room for organized display.
 *
 * Use Case: Multi-gang Brilliant panels have multiple switches in same room.
 * Since SmartThings API doesn't expose panel grouping, we infer it from
 * room assignment.
 *
 * Design Decision: Room-Based Grouping
 * Rationale: SmartThings API does not provide panel ID or switch position.
 * Room grouping is the best approximation for organizing multi-gang panels.
 *
 * Future Enhancement: Allow manual panel grouping via user preferences.
 *
 * @param devices Array of all devices
 * @returns Map of room name to Brilliant devices in that room
 *
 * @example
 * ```typescript
 * const grouped = groupBrilliantByRoom(allDevices);
 * for (const [room, devices] of Object.entries(grouped)) {
 *   console.log(`${room}: ${devices.length} Brilliant devices`);
 * }
 * ```
 */
export function groupBrilliantByRoom(devices: UnifiedDevice[]): Record<string, UnifiedDevice[]> {
	// Filter to only Brilliant devices
	const brilliantDevices = devices.filter(isBrilliantDevice);

	// Group by room (or 'Uncategorized' if no room assigned)
	return brilliantDevices.reduce(
		(acc, device) => {
			const room = device.room || 'Uncategorized';
			if (!acc[room]) {
				acc[room] = [];
			}
			acc[room].push(device);
			return acc;
		},
		{} as Record<string, UnifiedDevice[]>
	);
}

/**
 * Get appropriate icon emoji for Brilliant device.
 *
 * Icon Mapping:
 * - Dimmer: 🔆 (sun with rays - represents variable brightness)
 * - Switch: 💡 (light bulb - basic on/off)
 * - Plug: 🔌 (electric plug)
 *
 * Design Decision: Emoji vs Icon Library
 * Rationale: Emojis work across all platforms without dependencies.
 * Can be replaced with icon library later if needed.
 *
 * @param device Brilliant device to get icon for
 * @returns Emoji string representing device type
 *
 * @example
 * ```typescript
 * const icon = getBrilliantIcon(device);
 * // Returns: '🔆' for dimmers, '💡' for switches
 * ```
 */
export function getBrilliantIcon(device: UnifiedDevice): string {
	const type = getBrilliantDeviceType(device);

	switch (type) {
		case 'dimmer':
			return '🔆'; // Sun with rays - variable brightness
		case 'plug':
			return '🔌'; // Electric plug
		case 'switch':
		default:
			return '💡'; // Light bulb - basic on/off
	}
}

/**
 * Get display manufacturer name for device.
 *
 * Detects manufacturer from device metadata or device type patterns.
 * Fallback detection for VIPER devices which have null manufacturer from API.
 *
 * @param device Device to get manufacturer for
 * @returns Manufacturer display name or null
 *
 * @example
 * ```typescript
 * const manufacturer = getDeviceManufacturer(device);
 * // 'Brilliant Home Technology' for VIPER devices
 * ```
 */
export function getDeviceManufacturer(device: UnifiedDevice): string | null {
	// Use API-provided manufacturer if available
	if (device.manufacturer) {
		return device.manufacturer;
	}

	// Detect Brilliant devices by VIPER type
	if (device.model === 'VIPER' || device.platformSpecific?.type === 'VIPER') {
		return 'Brilliant Home Technology';
	}

	return null;
}

/**
 * Get unique list of manufacturers from device array.
 *
 * Utility function for building manufacturer filter dropdowns.
 * Uses smart detection to identify manufacturers from device patterns.
 *
 * @param devices Array of devices
 * @returns Sorted array of unique manufacturer names
 *
 * @example
 * ```typescript
 * const manufacturers = getUniqueManufacturers(devices);
 * // ['Brilliant Home Technology', 'Philips', 'Sengled', ...]
 * ```
 */
export function getUniqueManufacturers(devices: UnifiedDevice[]): string[] {
	const manufacturers = new Set<string>();

	for (const device of devices) {
		const manufacturer = getDeviceManufacturer(device);
		if (manufacturer) {
			manufacturers.add(manufacturer);
		}
	}

	return Array.from(manufacturers).sort();
}
