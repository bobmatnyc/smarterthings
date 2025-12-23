/**
 * Event Value Formatters
 *
 * Utilities for formatting SmartThings event values into human-readable strings.
 *
 * Design Decision: Pattern-based formatting
 * Rationale: SmartThings events use consistent patterns (objects with specific keys).
 * This formatter handles common patterns and provides sensible fallbacks.
 *
 * Architecture:
 * - Object pattern matching for SmartThings conventions
 * - Primitive type formatting
 * - Graceful fallbacks for unknown patterns
 */

/**
 * Format event value into human-readable string
 *
 * Handles:
 * - Boolean values: Yes/No
 * - String values: Capitalized
 * - Number values: As-is
 * - Object patterns (SmartThings common patterns):
 *   - switch: On/Off
 *   - motion: Motion/Clear
 *   - contact: Open/Closed
 *   - temperature: With unit (°F/°C)
 *   - battery: Percentage
 *   - level: Percentage
 *   - presence: Home/Away
 *
 * @param value - Event value (can be any type)
 * @returns Human-readable string
 *
 * @example
 * formatEventValue({ switch: 'on' }) // "On"
 * formatEventValue({ temperature: 72, unit: 'F' }) // "72°F"
 * formatEventValue(true) // "Yes"
 */
export function formatEventValue(value: unknown): string {
	if (value === null || value === undefined) return 'N/A';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (typeof value === 'string') return capitalizeFirst(value);
	if (typeof value === 'number') return value.toString();

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;

		// Handle common SmartThings patterns
		if ('switch' in obj) return obj.switch === 'on' ? 'On' : 'Off';
		if ('motion' in obj) return obj.motion === 'active' ? 'Motion' : 'Clear';
		if ('contact' in obj) return obj.contact === 'open' ? 'Open' : 'Closed';
		if ('temperature' in obj) {
			const unit = obj.unit === 'C' ? '°C' : '°F';
			return `${obj.temperature}${unit}`;
		}
		if ('battery' in obj) return `${obj.battery}%`;
		if ('level' in obj) return `${obj.level}%`;
		if ('presence' in obj) return obj.presence === 'present' ? 'Home' : 'Away';
		if ('lock' in obj) return obj.lock === 'locked' ? 'Locked' : 'Unlocked';
		if ('button' in obj) return `Button ${capitalizeFirst(String(obj.button))}`;
		if ('alarm' in obj) return capitalizeFirst(String(obj.alarm));

		// Fallback: show first key-value pair
		const [key, val] = Object.entries(obj)[0] || [];
		if (key && val !== undefined) {
			return `${capitalizeFirst(String(val))}`;
		}
	}

	// Final fallback: stringify the value
	return String(value);
}

/**
 * Capitalize first letter of string
 *
 * @param s - String to capitalize
 * @returns Capitalized string
 *
 * @example
 * capitalizeFirst('hello') // "Hello"
 * capitalizeFirst('WORLD') // "World"
 */
function capitalizeFirst(s: string): string {
	if (!s) return s;
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Get event type display name
 *
 * @param type - Event type enum value
 * @returns Human-readable event type
 *
 * @example
 * getEventTypeLabel('device_event') // "Device Event"
 */
export function getEventTypeLabel(
	type: 'device_event' | 'user_command' | 'automation_trigger' | 'rule_execution'
): string {
	const labels: Record<string, string> = {
		device_event: 'Device Event',
		user_command: 'User Command',
		automation_trigger: 'Automation',
		rule_execution: 'Rule',
	};
	return labels[type] || type;
}
