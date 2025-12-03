/**
 * Room Icon Utilities
 *
 * Provides smart icon mapping for room names based on pattern matching.
 * Uses inline SVG paths to maintain zero-dependency design.
 *
 * Icon Design:
 * - Feather-style stroke icons (consistent with SubNav/RoomCard)
 * - 24x24 viewBox for scalability
 * - stroke-width: 2, stroke-linecap: round, stroke-linejoin: round
 */

export type RoomIconName =
	| 'home' // Default fallback
	| 'bed' // Bedroom, Master bedroom
	| 'sofa' // Living room, Family room
	| 'chef' // Kitchen
	| 'droplet' // Bathroom, Bath
	| 'briefcase' // Office, Study
	| 'utensils' // Dining room
	| 'car' // Garage
	| 'tree'; // Outdoor, Patio, Garden

/**
 * Determine room icon based on room name pattern matching
 *
 * @param roomName - Room name to analyze
 * @returns Icon name for the room
 *
 * @example
 * getRoomIcon('Master Bedroom') // 'bed'
 * getRoomIcon('Living Room')    // 'sofa'
 * getRoomIcon('Unknown')        // 'home'
 */
export function getRoomIcon(roomName: string): RoomIconName {
	const name = roomName.toLowerCase();

	// Bedroom patterns
	if (name.includes('bedroom') || name.includes('master') || name.includes('guest room')) {
		return 'bed';
	}

	// Kitchen patterns
	if (name.includes('kitchen')) {
		return 'chef';
	}

	// Living room patterns
	if (name.includes('living') || name.includes('family') || name.includes('den')) {
		return 'sofa';
	}

	// Bathroom patterns
	if (name.includes('bathroom') || name.includes('bath') || name.includes('powder')) {
		return 'droplet';
	}

	// Garage patterns
	if (name.includes('garage') || name.includes('car port')) {
		return 'car';
	}

	// Office patterns
	if (name.includes('office') || name.includes('study') || name.includes('workspace')) {
		return 'briefcase';
	}

	// Dining patterns
	if (name.includes('dining')) {
		return 'utensils';
	}

	// Outdoor patterns
	if (
		name.includes('outdoor') ||
		name.includes('patio') ||
		name.includes('garden') ||
		name.includes('yard') ||
		name.includes('deck')
	) {
		return 'tree';
	}

	// Default fallback
	return 'home';
}

/**
 * SVG icon path data for each room type
 *
 * Icons sourced from Feather Icons (MIT License)
 * https://feathericons.com/
 *
 * Optimized for 24x24 viewBox, stroke-width: 2
 */
export const ROOM_ICONS: Record<RoomIconName, string> = {
	// Home (default)
	home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',

	// Bed (bedroom)
	bed: '<path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"></path>',

	// Sofa (living room)
	sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"></path><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z"></path>',

	// Chef hat (kitchen)
	chef: '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"></path><line x1="6" y1="17" x2="18" y2="17"></line>',

	// Droplet (bathroom)
	droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>',

	// Briefcase (office)
	briefcase:
		'<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',

	// Utensils (dining)
	utensils:
		'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>',

	// Car (garage)
	car: '<path d="M14 16H9m10 0h3l-3-8H6l-3 8h3m14 0v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5"></path><circle cx="7.5" cy="16.5" r="1.5"></circle><circle cx="16.5" cy="16.5" r="1.5"></circle>',

	// Tree (outdoor)
	tree: '<path d="M12 13v8"></path><path d="m12 3 4 7H8Z"></path><path d="m8 10 4 7H4Z"></path><path d="m16 10-4 7h8Z"></path>'
};
