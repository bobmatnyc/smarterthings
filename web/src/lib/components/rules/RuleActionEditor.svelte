<script lang="ts">
	/**
	 * Rule Action Editor Component
	 *
	 * Design: Modal interface for creating and editing rule actions
	 * Part of Phase 5 of the Local Rules Engine implementation
	 *
	 * Features:
	 * - Support for multiple action types (device_command, delay, notification, execute_rule)
	 * - Dynamic form fields based on action type
	 * - Real-time validation with helpful error messages
	 * - Device selection from available devices
	 * - Command selection with capability-aware arguments
	 * - Visual previews for applicable actions (brightness slider, color picker)
	 *
	 * Architecture:
	 * - Svelte 5 Runes for reactive form state
	 * - $derived for form validation and computed values
	 * - Type-safe with discriminated union types
	 * - Follows existing RuleTriggerEditor.svelte patterns
	 */

	// Type definitions for rule actions
	// These match the backend types in src/rules/types.ts
	interface DeviceCommandAction {
		type: 'device_command';
		deviceId: string;
		deviceName?: string;
		command: string;
		capability?: string;
		arguments?: Record<string, unknown>;
	}

	interface DelayAction {
		type: 'delay';
		seconds: number;
	}

	interface NotificationAction {
		type: 'notification';
		title: string;
		body?: string;
		priority?: 'low' | 'normal' | 'high';
	}

	interface ExecuteRuleAction {
		type: 'execute_rule';
		ruleId: string;
	}

	type RuleAction = DeviceCommandAction | DelayAction | NotificationAction | ExecuteRuleAction;

	interface DeviceInfo {
		id: string;
		name: string;
		roomName?: string;
		capabilities: string[];
	}

	interface Rule {
		id: string;
		name: string;
		description?: string;
		enabled: boolean;
	}

	interface Props {
		action?: RuleAction;
		devices: DeviceInfo[];
		rules: Rule[];
		onSave: (action: RuleAction) => void;
		onCancel: () => void;
	}

	let { action = undefined, devices, rules, onSave, onCancel }: Props = $props();

	// ============================================================================
	// STATE (Svelte 5 Runes)
	// ============================================================================

	let actionType = $state<RuleAction['type']>('device_command');

	// Device Command fields
	let deviceId = $state('');
	let command = $state('on');
	let commandLevel = $state(100); // For setLevel command (0-100)
	let commandHue = $state(0); // For setColor command (0-360)
	let commandSaturation = $state(100); // For setColor command (0-100)
	let commandTemperature = $state(4000); // For setColorTemperature (2700-6500)
	let setpointTemperature = $state(72); // For thermostat setpoints

	// Delay fields
	let delaySeconds = $state(5);

	// Notification fields
	let notificationTitle = $state('');
	let notificationBody = $state('');
	let notificationPriority = $state<'low' | 'normal' | 'high'>('normal');

	// Execute Rule fields
	let executeRuleId = $state('');

	// Touched fields for validation
	let touched = $state({
		deviceId: false,
		delaySeconds: false,
		notificationTitle: false,
		executeRuleId: false
	});

	// ============================================================================
	// DERIVED STATE
	// ============================================================================

	/**
	 * Get selected device info
	 */
	let selectedDevice = $derived(devices.find((d) => d.id === deviceId));

	/**
	 * Get available commands for selected device
	 */
	let availableCommands = $derived(() => {
		if (!selectedDevice) return ['on', 'off'];

		const cmds: string[] = [];

		// Switch commands
		if (selectedDevice.capabilities.includes('switch')) {
			cmds.push('on', 'off');
		}

		// Dimmer commands
		if (selectedDevice.capabilities.includes('switchLevel')) {
			cmds.push('setLevel');
		}

		// Color commands
		if (selectedDevice.capabilities.includes('colorControl')) {
			cmds.push('setColor');
		}

		// Color temperature
		if (selectedDevice.capabilities.includes('colorTemperature')) {
			cmds.push('setColorTemperature');
		}

		// Lock commands
		if (selectedDevice.capabilities.includes('lock')) {
			cmds.push('lock', 'unlock');
		}

		// Thermostat commands
		if (selectedDevice.capabilities.includes('thermostatMode')) {
			cmds.push('setThermostatMode');
		}
		if (selectedDevice.capabilities.includes('thermostatCoolingSetpoint')) {
			cmds.push('setCoolingSetpoint');
		}
		if (selectedDevice.capabilities.includes('thermostatHeatingSetpoint')) {
			cmds.push('setHeatingSetpoint');
		}

		return cmds.length > 0 ? cmds : ['on', 'off'];
	});

	/**
	 * Check if command requires arguments
	 */
	let commandRequiresArguments = $derived(() => {
		return ['setLevel', 'setColor', 'setColorTemperature', 'setThermostatMode',
		        'setCoolingSetpoint', 'setHeatingSetpoint'].includes(command);
	});

	/**
	 * Get capability hint for selected device
	 */
	let capabilityHint = $derived(() => {
		if (!selectedDevice) return '';

		const caps = selectedDevice.capabilities
			.map((cap) => {
				switch (cap) {
					case 'switch':
						return 'On/Off';
					case 'switchLevel':
						return 'Dimmer';
					case 'colorControl':
						return 'Color';
					case 'colorTemperature':
						return 'Color Temperature';
					case 'lock':
						return 'Lock';
					case 'thermostatMode':
						return 'Thermostat';
					default:
						return null;
				}
			})
			.filter(Boolean)
			.join(', ');

		return caps ? `Capabilities: ${caps}` : '';
	});

	/**
	 * Format delay duration for display
	 */
	let delayFormatted = $derived(() => {
		if (delaySeconds < 60) return `${delaySeconds} second${delaySeconds === 1 ? '' : 's'}`;
		const minutes = Math.floor(delaySeconds / 60);
		const seconds = delaySeconds % 60;
		if (seconds === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
		return `${minutes}m ${seconds}s`;
	});

	/**
	 * Get selected rule info
	 */
	let selectedRule = $derived(rules.find((r) => r.id === executeRuleId));

	/**
	 * Validation for device command action
	 */
	let deviceIdError = $derived(
		actionType === 'device_command' && touched.deviceId && !deviceId
			? 'Device is required'
			: null
	);

	/**
	 * Validation for delay action
	 */
	let delayError = $derived(
		actionType === 'delay' && touched.delaySeconds && (delaySeconds < 1 || delaySeconds > 86400)
			? 'Delay must be between 1 second and 24 hours'
			: null
	);

	/**
	 * Validation for notification action
	 */
	let notificationTitleError = $derived(
		actionType === 'notification' && touched.notificationTitle && !notificationTitle.trim()
			? 'Title is required'
			: null
	);

	/**
	 * Validation for execute rule action
	 */
	let executeRuleError = $derived(
		actionType === 'execute_rule' && touched.executeRuleId && !executeRuleId
			? 'Rule is required'
			: null
	);

	/**
	 * Overall form validation
	 */
	let isValid = $derived(() => {
		switch (actionType) {
			case 'device_command':
				return !deviceIdError && deviceId && command;
			case 'delay':
				return !delayError && delaySeconds >= 1 && delaySeconds <= 86400;
			case 'notification':
				return !notificationTitleError && notificationTitle.trim().length > 0;
			case 'execute_rule':
				return !executeRuleError && executeRuleId;
			default:
				return false;
		}
	});

	let modalTitle = $derived(action ? 'Edit Action' : 'Add Action');

	// ============================================================================
	// EFFECTS
	// ============================================================================

	/**
	 * Initialize form when action prop changes
	 */
	$effect(() => {
		if (action) {
			actionType = action.type;

			switch (action.type) {
				case 'device_command': {
					deviceId = action.deviceId;
					command = action.command;

					// Parse command arguments
					if (action.arguments) {
						if (command === 'setLevel' && typeof action.arguments.level === 'number') {
							commandLevel = action.arguments.level;
						} else if (command === 'setColor' && typeof action.arguments.color === 'object') {
							const color = action.arguments.color as { hue: number; saturation: number };
							commandHue = color.hue || 0;
							commandSaturation = color.saturation || 100;
						} else if (command === 'setColorTemperature' && typeof action.arguments.temperature === 'number') {
							commandTemperature = action.arguments.temperature;
						} else if ((command === 'setCoolingSetpoint' || command === 'setHeatingSetpoint') &&
						           typeof action.arguments.temperature === 'number') {
							setpointTemperature = action.arguments.temperature;
						}
					}
					break;
				}
				case 'delay': {
					delaySeconds = action.seconds;
					break;
				}
				case 'notification': {
					notificationTitle = action.title;
					notificationBody = action.body || '';
					notificationPriority = action.priority || 'normal';
					break;
				}
				case 'execute_rule': {
					executeRuleId = action.ruleId;
					break;
				}
			}
		}
	});

	// ============================================================================
	// ACTIONS
	// ============================================================================

	/**
	 * Handle form submission
	 */
	function handleSubmit(event: Event) {
		event.preventDefault();

		// Mark all fields as touched
		touched.deviceId = true;
		touched.delaySeconds = true;
		touched.notificationTitle = true;
		touched.executeRuleId = true;

		if (!isValid) {
			return;
		}

		let newAction: RuleAction;

		switch (actionType) {
			case 'device_command': {
				const deviceCommandAction: DeviceCommandAction = {
					type: 'device_command',
					deviceId,
					deviceName: selectedDevice?.name,
					command
				};

				// Add capability based on command
				if (command === 'on' || command === 'off') {
					deviceCommandAction.capability = 'switch';
				} else if (command === 'setLevel') {
					deviceCommandAction.capability = 'switchLevel';
					deviceCommandAction.arguments = { level: commandLevel };
				} else if (command === 'setColor') {
					deviceCommandAction.capability = 'colorControl';
					deviceCommandAction.arguments = {
						color: { hue: commandHue, saturation: commandSaturation }
					};
				} else if (command === 'setColorTemperature') {
					deviceCommandAction.capability = 'colorTemperature';
					deviceCommandAction.arguments = { temperature: commandTemperature };
				} else if (command === 'lock' || command === 'unlock') {
					deviceCommandAction.capability = 'lock';
				} else if (command === 'setThermostatMode') {
					deviceCommandAction.capability = 'thermostatMode';
					// Mode will be set via a separate UI element if needed
				} else if (command === 'setCoolingSetpoint') {
					deviceCommandAction.capability = 'thermostatCoolingSetpoint';
					deviceCommandAction.arguments = { temperature: setpointTemperature };
				} else if (command === 'setHeatingSetpoint') {
					deviceCommandAction.capability = 'thermostatHeatingSetpoint';
					deviceCommandAction.arguments = { temperature: setpointTemperature };
				}

				newAction = deviceCommandAction;
				break;
			}
			case 'delay': {
				newAction = {
					type: 'delay',
					seconds: delaySeconds
				};
				break;
			}
			case 'notification': {
				const notifAction: NotificationAction = {
					type: 'notification',
					title: notificationTitle.trim()
				};
				if (notificationBody.trim()) {
					notifAction.body = notificationBody.trim();
				}
				if (notificationPriority !== 'normal') {
					notifAction.priority = notificationPriority;
				}
				newAction = notifAction;
				break;
			}
			case 'execute_rule': {
				newAction = {
					type: 'execute_rule',
					ruleId: executeRuleId
				};
				break;
			}
		}

		onSave(newAction);
	}

	/**
	 * Handle action type change
	 */
	function handleTypeChange(newType: RuleAction['type']) {
		actionType = newType;
		// Reset touched state when switching types
		touched = {
			deviceId: false,
			delaySeconds: false,
			notificationTitle: false,
			executeRuleId: false
		};
	}

	/**
	 * Handle Escape key
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="action-editor">
	<!-- Header -->
	<div class="editor-header">
		<h3 class="editor-title">{modalTitle}</h3>
	</div>

	<!-- Form -->
	<form class="editor-body" onsubmit={handleSubmit}>
		<!-- Action Type Selection -->
		<div class="form-group">
			<label class="form-label">Action Type</label>
			<div class="type-tabs">
				<button
					type="button"
					class="type-tab"
					class:active={actionType === 'device_command'}
					onclick={() => handleTypeChange('device_command')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
						<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
					</svg>
					<span>Device</span>
				</button>
				<button
					type="button"
					class="type-tab"
					class:active={actionType === 'delay'}
					onclick={() => handleTypeChange('delay')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<polyline points="12 6 12 12 16 14"></polyline>
					</svg>
					<span>Delay</span>
				</button>
				<button
					type="button"
					class="type-tab"
					class:active={actionType === 'notification'}
					onclick={() => handleTypeChange('notification')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
					</svg>
					<span>Notify</span>
				</button>
				<button
					type="button"
					class="type-tab"
					class:active={actionType === 'execute_rule'}
					onclick={() => handleTypeChange('execute_rule')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<polyline points="9 11 12 14 22 4"></polyline>
						<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
					</svg>
					<span>Rule</span>
				</button>
			</div>
		</div>

		<!-- Device Command Action Fields -->
		{#if actionType === 'device_command'}
			<div class="form-section">
				<h4 class="section-title">Send command to device</h4>

				<!-- Device Selection -->
				<div class="form-group">
					<label for="action-device" class="form-label">
						Device <span class="required">*</span>
					</label>
					<select
						id="action-device"
						class="form-select"
						class:error={deviceIdError}
						bind:value={deviceId}
						onblur={() => (touched.deviceId = true)}
						required
					>
						<option value="">Select a device...</option>
						{#each devices as device}
							<option value={device.id}>
								{device.name}
								{#if device.roomName}
									({device.roomName})
								{/if}
							</option>
						{/each}
					</select>
					{#if deviceIdError}
						<span class="error-message">{deviceIdError}</span>
					{/if}
					{#if capabilityHint}
						<span class="form-hint">{capabilityHint}</span>
					{/if}
				</div>

				<!-- Command Selection -->
				<div class="form-group">
					<label for="action-command" class="form-label">
						Command <span class="required">*</span>
					</label>
					<select id="action-command" class="form-select" bind:value={command}>
						{#each availableCommands as cmd}
							<option value={cmd}>{cmd}</option>
						{/each}
					</select>
				</div>

				<!-- Command Arguments -->
				{#if command === 'setLevel'}
					<div class="form-group">
						<label for="action-level" class="form-label">
							Brightness Level: {commandLevel}%
						</label>
						<div class="slider-preview">
							<input
								id="action-level"
								type="range"
								class="form-slider"
								bind:value={commandLevel}
								min="0"
								max="100"
								step="1"
							/>
							<div class="brightness-preview" style="opacity: {commandLevel / 100}">
								<div class="brightness-icon">💡</div>
							</div>
						</div>
					</div>
				{:else if command === 'setColor'}
					<div class="form-group">
						<label class="form-label">Color</label>
						<div class="color-controls">
							<div class="color-input-group">
								<label for="action-hue" class="color-label">Hue: {commandHue}°</label>
								<input
									id="action-hue"
									type="range"
									class="form-slider"
									bind:value={commandHue}
									min="0"
									max="360"
									step="1"
								/>
							</div>
							<div class="color-input-group">
								<label for="action-saturation" class="color-label">
									Saturation: {commandSaturation}%
								</label>
								<input
									id="action-saturation"
									type="range"
									class="form-slider"
									bind:value={commandSaturation}
									min="0"
									max="100"
									step="1"
								/>
							</div>
							<div
								class="color-preview"
								style="background-color: hsl({commandHue}, {commandSaturation}%, 50%)"
							></div>
						</div>
					</div>
				{:else if command === 'setColorTemperature'}
					<div class="form-group">
						<label for="action-temperature" class="form-label">
							Color Temperature: {commandTemperature}K
						</label>
						<input
							id="action-temperature"
							type="range"
							class="form-slider"
							bind:value={commandTemperature}
							min="2700"
							max="6500"
							step="100"
						/>
						<span class="form-hint">2700K (warm) - 6500K (cool)</span>
					</div>
				{:else if command === 'setCoolingSetpoint' || command === 'setHeatingSetpoint'}
					<div class="form-group">
						<label for="action-setpoint" class="form-label">
							Temperature: {setpointTemperature}°F
						</label>
						<input
							id="action-setpoint"
							type="number"
							class="form-input"
							bind:value={setpointTemperature}
							min="50"
							max="90"
							step="1"
						/>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Delay Action Fields -->
		{#if actionType === 'delay'}
			<div class="form-section">
				<h4 class="section-title">Wait for a duration</h4>

				<div class="form-group">
					<label for="action-delay" class="form-label">
						Duration (seconds) <span class="required">*</span>
					</label>
					<input
						id="action-delay"
						type="number"
						class="form-input"
						class:error={delayError}
						bind:value={delaySeconds}
						onblur={() => (touched.delaySeconds = true)}
						min="1"
						max="86400"
						placeholder="5"
						required
					/>
					{#if delayError}
						<span class="error-message">{delayError}</span>
					{/if}
					<span class="form-hint">{delayFormatted}</span>
				</div>
			</div>
		{/if}

		<!-- Notification Action Fields -->
		{#if actionType === 'notification'}
			<div class="form-section">
				<h4 class="section-title">Send a notification</h4>

				<div class="form-group">
					<label for="action-notif-title" class="form-label">
						Title <span class="required">*</span>
					</label>
					<input
						id="action-notif-title"
						type="text"
						class="form-input"
						class:error={notificationTitleError}
						bind:value={notificationTitle}
						onblur={() => (touched.notificationTitle = true)}
						placeholder="e.g., Lights turned off"
						maxlength="100"
						required
					/>
					{#if notificationTitleError}
						<span class="error-message">{notificationTitleError}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="action-notif-body" class="form-label">Body (optional)</label>
					<textarea
						id="action-notif-body"
						class="form-textarea"
						bind:value={notificationBody}
						placeholder="Additional details..."
						maxlength="500"
						rows="3"
					></textarea>
				</div>

				<div class="form-group">
					<label for="action-notif-priority" class="form-label">Priority</label>
					<select
						id="action-notif-priority"
						class="form-select"
						bind:value={notificationPriority}
					>
						<option value="low">Low</option>
						<option value="normal">Normal</option>
						<option value="high">High</option>
					</select>
				</div>
			</div>
		{/if}

		<!-- Execute Rule Action Fields -->
		{#if actionType === 'execute_rule'}
			<div class="form-section">
				<h4 class="section-title">Execute another rule</h4>

				<div class="form-group">
					<label for="action-rule" class="form-label">
						Rule <span class="required">*</span>
					</label>
					<select
						id="action-rule"
						class="form-select"
						class:error={executeRuleError}
						bind:value={executeRuleId}
						onblur={() => (touched.executeRuleId = true)}
						required
					>
						<option value="">Select a rule...</option>
						{#each rules as rule}
							<option value={rule.id}>{rule.name}</option>
						{/each}
					</select>
					{#if executeRuleError}
						<span class="error-message">{executeRuleError}</span>
					{/if}
					{#if selectedRule?.description}
						<span class="form-hint">{selectedRule.description}</span>
					{/if}
				</div>
			</div>
		{/if}
	</form>

	<!-- Footer -->
	<div class="editor-footer">
		<button type="button" class="cancel-button" onclick={onCancel}> Cancel </button>
		<button type="submit" class="submit-button" disabled={!isValid} onclick={handleSubmit}>
			Save Action
		</button>
	</div>
</div>

<style>
	.action-editor {
		display: flex;
		flex-direction: column;
		background: white;
		border-radius: 0.75rem;
		overflow: hidden;
		max-height: 80vh;
	}

	/* Header */
	.editor-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid rgb(229, 231, 235);
	}

	.editor-title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
	}

	/* Body */
	.editor-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Form Groups */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: rgb(55, 65, 81);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.required {
		color: rgb(239, 68, 68);
	}

	.form-input,
	.form-select {
		padding: 0.625rem 0.875rem;
		border: 1px solid rgb(209, 213, 219);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		color: rgb(17, 24, 39);
		transition: all 0.2s ease;
		width: 100%;
		background: white;
	}

	.form-input:focus,
	.form-select:focus {
		outline: none;
		border-color: rgb(59, 130, 246);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-input.error,
	.form-select.error {
		border-color: rgb(239, 68, 68);
	}

	.form-input.error:focus,
	.form-select.error:focus {
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
	}

	.form-textarea {
		padding: 0.625rem 0.875rem;
		border: 1px solid rgb(209, 213, 219);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		color: rgb(17, 24, 39);
		transition: all 0.2s ease;
		font-family: inherit;
		resize: vertical;
		width: 100%;
	}

	.form-textarea:focus {
		outline: none;
		border-color: rgb(59, 130, 246);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.error-message {
		color: rgb(239, 68, 68);
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.form-hint {
		font-size: 0.8125rem;
		color: rgb(107, 114, 128);
		margin-top: -0.25rem;
	}

	/* Type Tabs */
	.type-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		background: rgb(249, 250, 251);
		padding: 0.25rem;
		border-radius: 0.5rem;
	}

	.type-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 0.75rem 0.5rem;
		border: none;
		background: transparent;
		color: rgb(107, 114, 128);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.type-tab:hover {
		background: rgb(243, 244, 246);
		color: rgb(55, 65, 81);
	}

	.type-tab.active {
		background: white;
		color: rgb(59, 130, 246);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.tab-icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Form Section */
	.form-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: rgb(249, 250, 251);
		border-radius: 0.5rem;
	}

	.section-title {
		margin: 0 0 0.5rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: rgb(55, 65, 81);
	}

	/* Slider Controls */
	.form-slider {
		width: 100%;
		height: 0.5rem;
		border-radius: 0.25rem;
		background: rgb(229, 231, 235);
		outline: none;
		-webkit-appearance: none;
	}

	.form-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: rgb(59, 130, 246);
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.form-slider::-moz-range-thumb {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: rgb(59, 130, 246);
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	/* Brightness Preview */
	.slider-preview {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.brightness-preview {
		flex-shrink: 0;
		width: 3rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(249, 250, 251);
		border-radius: 0.5rem;
		transition: opacity 0.2s ease;
	}

	.brightness-icon {
		font-size: 1.5rem;
	}

	/* Color Controls */
	.color-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.color-input-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.color-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(107, 114, 128);
	}

	.color-preview {
		width: 100%;
		height: 3rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(209, 213, 219);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* Footer */
	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		border-top: 1px solid rgb(229, 231, 235);
	}

	.cancel-button {
		background: white;
		color: rgb(55, 65, 81);
		border: 1px solid rgb(209, 213, 219);
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-button:hover {
		background: rgb(249, 250, 251);
		border-color: rgb(156, 163, 175);
	}

	.submit-button {
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		padding: 0.625rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.submit-button:hover:not(:disabled) {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
	}

	.submit-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	/* Mobile Responsiveness */
	@media (max-width: 768px) {
		.type-tabs {
			grid-template-columns: repeat(2, 1fr);
		}

		.type-tab span {
			font-size: 0.75rem;
		}

		.editor-header,
		.editor-body,
		.editor-footer {
			padding: 1rem 1.25rem;
		}

		.form-section {
			padding: 0.875rem;
		}

		.slider-preview {
			flex-direction: column;
		}

		.brightness-preview {
			width: 100%;
		}
	}
</style>
