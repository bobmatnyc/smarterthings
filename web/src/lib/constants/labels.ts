/**
 * Project Text Labels
 *
 * Centralized text labels for UI consistency and i18n readiness.
 * Organized by feature area for easy maintenance.
 *
 * Design Decision: Single source of truth for all UI text
 * Benefits:
 * - Type-safe label access with autocomplete
 * - Easy to update text across entire application
 * - Prepared for future internationalization (i18n)
 * - Consistent messaging and terminology
 */

// ============================================================================
// Application
// ============================================================================

export const APP_LABELS = {
	name: 'Smarter Things',
	tagline: 'AI-Powered Smart Home Control',
	description: 'Control your SmartThings devices with AI assistance',
} as const;

// ============================================================================
// Navigation
// ============================================================================

export const NAV_LABELS = {
	rooms: 'Rooms',
	devices: 'Devices',
	automations: 'Scenes',
	rules: 'Rules',
	events: 'Events',
	settings: 'Settings',
	chat: 'Chat',
} as const;

// ============================================================================
// Authentication & OAuth
// ============================================================================

export const AUTH_LABELS = {
	// Connection
	connectTitle: 'Connect to SmartThings',
	connectDescription: 'Connect your SmartThings account to control your smart home devices',
	connectButton: 'Connect SmartThings Account',

	// Status
	checking: 'Checking authentication',
	authenticating: 'Authenticating',
	connecting: 'Connecting to Smarter Things',

	// Success
	successTitle: 'Successfully connected!',
	successMessage: 'Your SmartThings account is now linked.',

	// Errors
	connectionFailed: 'Connection Failed',
	backendUnavailable: 'Unable to connect to backend server. Please ensure the server is running.',
	authenticationFailed: 'Authentication failed. Please try again.',

	// Actions
	retry: 'Try Again',
	disconnect: 'Disconnect',

	// Security
	securityNotice: '🔒 Your credentials are securely stored and encrypted',
} as const;

// ============================================================================
// Rooms
// ============================================================================

export const ROOM_LABELS = {
	title: 'Rooms',
	loading: 'Loading rooms',
	empty: 'No rooms found',
	emptyDescription: 'Create rooms in the SmartThings app to organize your devices',
	deviceCount: (count: number) => `${count} ${count === 1 ? 'device' : 'devices'}`,
} as const;

// ============================================================================
// Devices
// ============================================================================

export const DEVICE_LABELS = {
	title: 'Devices',
	loading: 'Loading devices',
	empty: 'No devices found',
	emptyDescription: 'Add devices in the SmartThings app to control them here',

	// Filters
	filterPlaceholder: 'Filter devices',
	filterByRoom: 'Filter by room',
	allRooms: 'All Rooms',

	// States
	on: 'On',
	off: 'Off',
	online: 'Online',
	offline: 'Offline',

	// Actions
	turnOn: 'Turn On',
	turnOff: 'Turn Off',
	setBrightness: 'Set Brightness',
	setLevel: 'Set Level',

	// Types
	light: 'Light',
	switch: 'Switch',
	sensor: 'Sensor',
	thermostat: 'Thermostat',
	lock: 'Lock',
	camera: 'Camera',
	unknown: 'Device',
} as const;

// ============================================================================
// Automations
// ============================================================================

export const AUTOMATION_LABELS = {
	title: 'Automations',
	scenes: 'Scenes',
	loading: 'Loading automations',
	empty: 'No automations found',
	emptyDescription: 'Create automations in the SmartThings app to control them here',

	// Actions
	execute: 'Execute',
	executing: 'Executing',
	enable: 'Enable',
	disable: 'Disable',

	// Status
	enabled: 'Enabled',
	disabled: 'Disabled',
	running: 'Running',

	// Success
	executionSuccess: 'Automation executed successfully',
	executionFailed: 'Failed to execute automation',
} as const;

// ============================================================================
// Rules
// ============================================================================

export const RULE_LABELS = {
	title: 'Rules',
	loading: 'Loading rules',
	empty: 'No rules found',
	emptyDescription: 'Create rules in the SmartThings app to automate your devices',

	// Actions
	execute: 'Execute',
	executing: 'Executing',
	enable: 'Enable',
	disable: 'Disable',
	delete: 'Delete',

	// Status
	enabled: 'Enabled',
	disabled: 'Disabled',

	// Confirmations
	deleteConfirm: 'Are you sure you want to delete this rule?',
	executeConfirm: 'Execute this rule now?',

	// Success/Error
	executionSuccess: 'Rule executed successfully',
	executionFailed: 'Failed to execute rule',
	deleteSuccess: 'Rule deleted successfully',
	deleteFailed: 'Failed to delete rule',
} as const;

// ============================================================================
// Events
// ============================================================================

export const EVENT_LABELS = {
	title: 'Events',
	recentEvents: 'Recent Events',
	loading: 'Loading events',
	empty: 'No events found',
	emptyDescription: 'Device events will appear here as they occur',

	// Filters
	filterByDevice: 'Filter by device',
	allDevices: 'All Devices',

	// Time
	justNow: 'Just now',
	minutesAgo: (minutes: number) => `${minutes}m ago`,
	hoursAgo: (hours: number) => `${hours}h ago`,
	daysAgo: (days: number) => `${days}d ago`,
} as const;

// ============================================================================
// Chat
// ============================================================================

export const CHAT_LABELS = {
	title: 'AI Assistant',
	placeholder: 'Ask about your devices...',
	send: 'Send',
	sending: 'Sending',
	thinking: 'Thinking',

	// Shortcuts
	toggleShortcut: 'Ctrl+/',

	// Suggestions
	suggestionsTitle: 'Try asking:',
	suggestions: [
		'Turn on the living room lights',
		'What devices are online?',
		'Show me recent events',
		'Execute the bedtime scene',
	],

	// Errors
	errorSending: 'Failed to send message',
	errorReceiving: 'Failed to receive response',
} as const;

// ============================================================================
// Loading States
// ============================================================================

export const LOADING_LABELS = {
	loading: 'Loading',
	loadingData: 'Loading data',
	processing: 'Processing',
	pleaseWait: 'Please wait',
	almostThere: 'Almost there',
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_LABELS = {
	// Generic
	genericError: 'Something went wrong',
	tryAgain: 'Please try again',
	contactSupport: 'If the problem persists, contact support',

	// Network
	networkError: 'Network error',
	connectionLost: 'Connection lost',
	serverUnavailable: 'Server unavailable',

	// Authentication
	notAuthenticated: 'Not authenticated',
	sessionExpired: 'Session expired',
	pleaseReconnect: 'Please reconnect your SmartThings account',

	// Not Found
	notFound: 'Not found',
	pageNotFound: 'Page not found',
	deviceNotFound: 'Device not found',
	roomNotFound: 'Room not found',
} as const;

// ============================================================================
// Common Actions
// ============================================================================

export const ACTION_LABELS = {
	save: 'Save',
	cancel: 'Cancel',
	delete: 'Delete',
	edit: 'Edit',
	close: 'Close',
	confirm: 'Confirm',
	submit: 'Submit',
	back: 'Back',
	next: 'Next',
	refresh: 'Refresh',
	retry: 'Retry',
	viewDetails: 'View Details',
	learnMore: 'Learn More',
} as const;

// ============================================================================
// Footer
// ============================================================================

export const FOOTER_LABELS = {
	copyright: (year: number) => `© ${year} Smarter Things. All rights reserved.`,
	privacy: 'Privacy',
	terms: 'Terms',
	github: 'GitHub',
} as const;

// ============================================================================
// Accessibility
// ============================================================================

export const A11Y_LABELS = {
	// Navigation
	mainNavigation: 'Main navigation',
	skipToContent: 'Skip to content',

	// Buttons
	closeButton: 'Close',
	openMenu: 'Open menu',
	closeMenu: 'Close menu',
	toggleSidebar: 'Toggle sidebar',

	// Status
	loading: 'Loading',
	error: 'Error',
	success: 'Success',

	// Forms
	required: 'Required field',
	optional: 'Optional field',
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type AppLabels = typeof APP_LABELS;
export type NavLabels = typeof NAV_LABELS;
export type AuthLabels = typeof AUTH_LABELS;
export type RoomLabels = typeof ROOM_LABELS;
export type DeviceLabels = typeof DEVICE_LABELS;
export type AutomationLabels = typeof AUTOMATION_LABELS;
export type RuleLabels = typeof RULE_LABELS;
export type EventLabels = typeof EVENT_LABELS;
export type ChatLabels = typeof CHAT_LABELS;
export type LoadingLabels = typeof LOADING_LABELS;
export type ErrorLabels = typeof ERROR_LABELS;
export type ActionLabels = typeof ACTION_LABELS;
export type FooterLabels = typeof FOOTER_LABELS;
export type A11yLabels = typeof A11Y_LABELS;
