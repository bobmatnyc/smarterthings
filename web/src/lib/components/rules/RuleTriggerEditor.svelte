<script lang="ts">
	/**
	 * Rule Trigger Editor Component
	 *
	 * Design: Modal interface for creating and editing rule triggers
	 * Part of Phase 5 of the Local Rules Engine implementation
	 *
	 * Features:
	 * - Support for multiple trigger types (device_state, time, astronomical, cron)
	 * - Dynamic form fields based on trigger type
	 * - Real-time validation with helpful error messages
	 * - Device selection from available devices
	 * - Attribute and operator selection for device state triggers
	 * - Time-based trigger configuration
	 *
	 * Architecture:
	 * - Svelte 5 Runes for reactive form state
	 * - $derived for form validation and computed values
	 * - Type-safe with discriminated union types
	 * - Follows existing RuleEditor.svelte patterns
	 */

	// Type definitions for rule triggers
	// These match the backend types in src/rules/types.ts
	type TriggerOperator =
		| 'equals'
		| 'notEquals'
		| 'greaterThan'
		| 'lessThan'
		| 'contains'
		| 'between';

	interface DeviceStateTrigger {
		type: 'device_state';
		deviceId: string;
		deviceName?: string;
		attribute: string;
		operator: TriggerOperator;
		value: unknown;
		valueEnd?: unknown;
	}

	interface TimeTrigger {
		type: 'time';
		time: string;
		days?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
	}

	interface AstronomicalTrigger {
		type: 'astronomical';
		event: 'sunrise' | 'sunset';
		offsetMinutes?: number;
	}

	interface CronTrigger {
		type: 'cron';
		expression: string;
	}

	type RuleTrigger = DeviceStateTrigger | TimeTrigger | AstronomicalTrigger | CronTrigger;

	interface DeviceInfo {
		id: string;
		name: string;
		roomName?: string;
		capabilities: string[];
	}

	interface Props {
		trigger?: RuleTrigger;
		devices: DeviceInfo[];
		onSave: (trigger: RuleTrigger) => void;
		onCancel: () => void;
	}

	let { trigger = undefined, devices, onSave, onCancel }: Props = $props();

	// ============================================================================
	// STATE (Svelte 5 Runes)
	// ============================================================================

	let triggerType = $state<RuleTrigger['type']>('device_state');

	// Device State Trigger fields
	let deviceId = $state('');
	let attribute = $state('switch');
	let operator = $state<TriggerOperator>('equals');
	let value = $state<string>('');
	let valueEnd = $state<string>('');

	// Time Trigger fields
	let time = $state('12:00');
	let selectedDays = $state<Set<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>>(
		new Set()
	);

	// Astronomical Trigger fields
	let astronomicalEvent = $state<'sunrise' | 'sunset'>('sunrise');
	let offsetMinutes = $state(0);

	// Cron Trigger fields
	let cronExpression = $state('0 0 * * *');

	// Touched fields for validation
	let touched = $state({
		deviceId: false,
		value: false,
		time: false,
		cronExpression: false
	});

	// ============================================================================
	// DERIVED STATE
	// ============================================================================

	/**
	 * Get selected device info
	 */
	let selectedDevice = $derived(devices.find((d) => d.id === deviceId));

	/**
	 * Get available attributes for selected device
	 */
	let availableAttributes = $derived(() => {
		if (!selectedDevice) return ['switch', 'level', 'temperature', 'motion', 'contact'];

		const attrs: string[] = [];
		if (selectedDevice.capabilities.includes('switch')) attrs.push('switch');
		if (selectedDevice.capabilities.includes('switchLevel')) attrs.push('level');
		if (selectedDevice.capabilities.includes('temperatureMeasurement')) attrs.push('temperature');
		if (selectedDevice.capabilities.includes('motionSensor')) attrs.push('motion');
		if (selectedDevice.capabilities.includes('contactSensor')) attrs.push('contact');
		if (selectedDevice.capabilities.includes('illuminanceMeasurement'))
			attrs.push('illuminance');
		if (selectedDevice.capabilities.includes('relativeHumidityMeasurement'))
			attrs.push('humidity');

		return attrs.length > 0 ? attrs : ['switch', 'level', 'temperature'];
	});

	/**
	 * Get input type for value field based on attribute
	 */
	let valueInputType = $derived(() => {
		switch (attribute) {
			case 'switch':
			case 'motion':
			case 'contact':
				return 'select';
			case 'level':
			case 'temperature':
			case 'illuminance':
			case 'humidity':
				return 'number';
			default:
				return 'text';
		}
	});

	/**
	 * Get value options for select-type attributes
	 */
	let valueOptions = $derived(() => {
		switch (attribute) {
			case 'switch':
				return ['on', 'off'];
			case 'motion':
				return ['active', 'inactive'];
			case 'contact':
				return ['open', 'closed'];
			default:
				return [];
		}
	});

	/**
	 * Validation for device state trigger
	 */
	let deviceIdError = $derived(
		triggerType === 'device_state' && touched.deviceId && !deviceId
			? 'Device is required'
			: null
	);

	let valueError = $derived(
		triggerType === 'device_state' && touched.value && !value ? 'Value is required' : null
	);

	let valueEndError = $derived(
		triggerType === 'device_state' && operator === 'between' && touched.value && !valueEnd
			? 'End value is required'
			: null
	);

	/**
	 * Validation for time trigger
	 */
	let timeError = $derived(
		triggerType === 'time' && touched.time && !/^\d{2}:\d{2}$/.test(time)
			? 'Time must be in HH:MM format'
			: null
	);

	/**
	 * Validation for cron trigger
	 */
	let cronError = $derived(
		triggerType === 'cron' && touched.cronExpression && !cronExpression.trim()
			? 'Cron expression is required'
			: null
	);

	/**
	 * Overall form validation
	 */
	let isValid = $derived(() => {
		switch (triggerType) {
			case 'device_state':
				return (
					!deviceIdError &&
					!valueError &&
					!valueEndError &&
					deviceId &&
					value &&
					(operator !== 'between' || valueEnd)
				);
			case 'time':
				return !timeError && /^\d{2}:\d{2}$/.test(time);
			case 'astronomical':
				return true; // Always valid if type is selected
			case 'cron':
				return !cronError && cronExpression.trim().length > 0;
			default:
				return false;
		}
	});

	let modalTitle = $derived(trigger ? 'Edit Trigger' : 'Add Trigger');

	// ============================================================================
	// EFFECTS
	// ============================================================================

	/**
	 * Initialize form when trigger prop changes
	 */
	$effect(() => {
		if (trigger) {
			triggerType = trigger.type;

			switch (trigger.type) {
				case 'device_state': {
					deviceId = trigger.deviceId;
					attribute = trigger.attribute;
					operator = trigger.operator;
					value = String(trigger.value);
					valueEnd = trigger.valueEnd ? String(trigger.valueEnd) : '';
					break;
				}
				case 'time': {
					time = trigger.time;
					selectedDays = new Set(trigger.days || []);
					break;
				}
				case 'astronomical': {
					astronomicalEvent = trigger.event;
					offsetMinutes = trigger.offsetMinutes || 0;
					break;
				}
				case 'cron': {
					cronExpression = trigger.expression;
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
		touched.value = true;
		touched.time = true;
		touched.cronExpression = true;

		if (!isValid) {
			return;
		}

		let newTrigger: RuleTrigger;

		switch (triggerType) {
			case 'device_state': {
				const deviceStateTrigger: DeviceStateTrigger = {
					type: 'device_state',
					deviceId,
					deviceName: selectedDevice?.name,
					attribute,
					operator,
					value: parseValue(value, attribute)
				};
				if (operator === 'between' && valueEnd) {
					deviceStateTrigger.valueEnd = parseValue(valueEnd, attribute);
				}
				newTrigger = deviceStateTrigger;
				break;
			}
			case 'time': {
				const timeTrigger: TimeTrigger = {
					type: 'time',
					time
				};
				if (selectedDays.size > 0) {
					timeTrigger.days = Array.from(selectedDays);
				}
				newTrigger = timeTrigger;
				break;
			}
			case 'astronomical': {
				const astroTrigger: AstronomicalTrigger = {
					type: 'astronomical',
					event: astronomicalEvent
				};
				if (offsetMinutes !== 0) {
					astroTrigger.offsetMinutes = offsetMinutes;
				}
				newTrigger = astroTrigger;
				break;
			}
			case 'cron': {
				const cronTrigger: CronTrigger = {
					type: 'cron',
					expression: cronExpression.trim()
				};
				newTrigger = cronTrigger;
				break;
			}
		}

		onSave(newTrigger);
	}

	/**
	 * Parse value based on attribute type
	 */
	function parseValue(val: string, attr: string): unknown {
		switch (attr) {
			case 'level':
			case 'temperature':
			case 'illuminance':
			case 'humidity':
				return Number(val);
			case 'switch':
			case 'motion':
			case 'contact':
				return val;
			default:
				return val;
		}
	}

	/**
	 * Handle trigger type change
	 */
	function handleTypeChange(newType: RuleTrigger['type']) {
		triggerType = newType;
		// Reset touched state when switching types
		touched = {
			deviceId: false,
			value: false,
			time: false,
			cronExpression: false
		};
	}

	/**
	 * Toggle day selection for time triggers
	 */
	function toggleDay(day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') {
		const newDays = new Set(selectedDays);
		if (newDays.has(day)) {
			newDays.delete(day);
		} else {
			newDays.add(day);
		}
		selectedDays = newDays;
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

<div class="trigger-editor">
	<!-- Header -->
	<div class="editor-header">
		<h3 class="editor-title">{modalTitle}</h3>
	</div>

	<!-- Form -->
	<form class="editor-body" onsubmit={handleSubmit}>
		<!-- Trigger Type Selection -->
		<div class="form-group">
			<label class="form-label">Trigger Type</label>
			<div class="type-tabs">
				<button
					type="button"
					class="type-tab"
					class:active={triggerType === 'device_state'}
					onclick={() => handleTypeChange('device_state')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
						<rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
						<line x1="6" y1="6" x2="6.01" y2="6"></line>
						<line x1="6" y1="18" x2="6.01" y2="18"></line>
					</svg>
					<span>Device State</span>
				</button>
				<button
					type="button"
					class="type-tab"
					class:active={triggerType === 'time'}
					onclick={() => handleTypeChange('time')}
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
					<span>Time</span>
				</button>
				<button
					type="button"
					class="type-tab"
					class:active={triggerType === 'astronomical'}
					onclick={() => handleTypeChange('astronomical')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<circle cx="12" cy="12" r="5"></circle>
						<line x1="12" y1="1" x2="12" y2="3"></line>
						<line x1="12" y1="21" x2="12" y2="23"></line>
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
						<line x1="1" y1="12" x2="3" y2="12"></line>
						<line x1="21" y1="12" x2="23" y2="12"></line>
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
					</svg>
					<span>Sun Event</span>
				</button>
				<button
					type="button"
					class="type-tab"
					class:active={triggerType === 'cron'}
					onclick={() => handleTypeChange('cron')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="tab-icon"
					>
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="16" y1="2" x2="16" y2="6"></line>
						<line x1="8" y1="2" x2="8" y2="6"></line>
						<line x1="3" y1="10" x2="21" y2="10"></line>
					</svg>
					<span>Schedule</span>
				</button>
			</div>
		</div>

		<!-- Device State Trigger Fields -->
		{#if triggerType === 'device_state'}
			<div class="form-section">
				<h4 class="section-title">When device state changes</h4>

				<!-- Device Selection -->
				<div class="form-group">
					<label for="trigger-device" class="form-label">
						Device <span class="required">*</span>
					</label>
					<select
						id="trigger-device"
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
									<span class="device-room">({device.roomName})</span>
								{/if}
							</option>
						{/each}
					</select>
					{#if deviceIdError}
						<span class="error-message">{deviceIdError}</span>
					{/if}
				</div>

				<!-- Attribute Selection -->
				<div class="form-group">
					<label for="trigger-attribute" class="form-label">Attribute</label>
					<select id="trigger-attribute" class="form-select" bind:value={attribute}>
						{#each availableAttributes as attr}
							<option value={attr}>{attr}</option>
						{/each}
					</select>
				</div>

				<!-- Operator Selection -->
				<div class="form-group">
					<label for="trigger-operator" class="form-label">Operator</label>
					<select id="trigger-operator" class="form-select" bind:value={operator}>
						<option value="equals">Equals</option>
						<option value="notEquals">Not Equals</option>
						<option value="greaterThan">Greater Than</option>
						<option value="lessThan">Less Than</option>
						<option value="between">Between</option>
						<option value="contains">Contains</option>
					</select>
				</div>

				<!-- Value Input -->
				<div class="form-group">
					<label for="trigger-value" class="form-label">
						Value <span class="required">*</span>
					</label>
					{#if valueInputType === 'select'}
						<select
							id="trigger-value"
							class="form-select"
							class:error={valueError}
							bind:value={value}
							onblur={() => (touched.value = true)}
							required
						>
							<option value="">Select value...</option>
							{#each valueOptions as option}
								<option value={option}>{option}</option>
							{/each}
						</select>
					{:else if valueInputType === 'number'}
						<input
							id="trigger-value"
							type="number"
							class="form-input"
							class:error={valueError}
							bind:value={value}
							onblur={() => (touched.value = true)}
							placeholder="Enter value"
							required
						/>
					{:else}
						<input
							id="trigger-value"
							type="text"
							class="form-input"
							class:error={valueError}
							bind:value={value}
							onblur={() => (touched.value = true)}
							placeholder="Enter value"
							required
						/>
					{/if}
					{#if valueError}
						<span class="error-message">{valueError}</span>
					{/if}
				</div>

				<!-- End Value (for 'between' operator) -->
				{#if operator === 'between'}
					<div class="form-group">
						<label for="trigger-value-end" class="form-label">
							End Value <span class="required">*</span>
						</label>
						<input
							id="trigger-value-end"
							type={valueInputType === 'number' ? 'number' : 'text'}
							class="form-input"
							class:error={valueEndError}
							bind:value={valueEnd}
							onblur={() => (touched.value = true)}
							placeholder="Enter end value"
							required
						/>
						{#if valueEndError}
							<span class="error-message">{valueEndError}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Time Trigger Fields -->
		{#if triggerType === 'time'}
			<div class="form-section">
				<h4 class="section-title">At a specific time</h4>

				<!-- Time Input -->
				<div class="form-group">
					<label for="trigger-time" class="form-label">
						Time <span class="required">*</span>
					</label>
					<input
						id="trigger-time"
						type="time"
						class="form-input"
						class:error={timeError}
						bind:value={time}
						onblur={() => (touched.time = true)}
						required
					/>
					{#if timeError}
						<span class="error-message">{timeError}</span>
					{/if}
				</div>

				<!-- Days Selection -->
				<div class="form-group">
					<label class="form-label">Days (leave empty for every day)</label>
					<div class="days-selector">
						{#each [
							{ key: 'mon', label: 'Mon' },
							{ key: 'tue', label: 'Tue' },
							{ key: 'wed', label: 'Wed' },
							{ key: 'thu', label: 'Thu' },
							{ key: 'fri', label: 'Fri' },
							{ key: 'sat', label: 'Sat' },
							{ key: 'sun', label: 'Sun' }
						] as day}
							<button
								type="button"
								class="day-button"
								class:selected={selectedDays.has(day.key)}
								onclick={() => toggleDay(day.key)}
							>
								{day.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Astronomical Trigger Fields -->
		{#if triggerType === 'astronomical'}
			<div class="form-section">
				<h4 class="section-title">At sunrise or sunset</h4>

				<!-- Event Selection -->
				<div class="form-group">
					<label for="trigger-astro-event" class="form-label">Event</label>
					<select
						id="trigger-astro-event"
						class="form-select"
						bind:value={astronomicalEvent}
					>
						<option value="sunrise">Sunrise</option>
						<option value="sunset">Sunset</option>
					</select>
				</div>

				<!-- Offset -->
				<div class="form-group">
					<label for="trigger-offset" class="form-label">Offset (minutes)</label>
					<input
						id="trigger-offset"
						type="number"
						class="form-input"
						bind:value={offsetMinutes}
						placeholder="0"
						min="-180"
						max="180"
					/>
					<span class="form-hint">
						Positive values = after event, Negative values = before event
					</span>
				</div>
			</div>
		{/if}

		<!-- Cron Trigger Fields -->
		{#if triggerType === 'cron'}
			<div class="form-section">
				<h4 class="section-title">On a cron schedule</h4>

				<!-- Cron Expression -->
				<div class="form-group">
					<label for="trigger-cron" class="form-label">
						Cron Expression <span class="required">*</span>
					</label>
					<input
						id="trigger-cron"
						type="text"
						class="form-input"
						class:error={cronError}
						bind:value={cronExpression}
						onblur={() => (touched.cronExpression = true)}
						placeholder="0 0 * * * (minute hour day month weekday)"
						required
					/>
					{#if cronError}
						<span class="error-message">{cronError}</span>
					{/if}
					<span class="form-hint">
						Format: minute hour day month weekday (e.g., "0 0 * * *" = daily at midnight)
					</span>
				</div>
			</div>
		{/if}
	</form>

	<!-- Footer -->
	<div class="editor-footer">
		<button type="button" class="cancel-button" onclick={onCancel}> Cancel </button>
		<button
			type="submit"
			class="submit-button"
			disabled={!isValid}
			onclick={handleSubmit}
		>
			Save Trigger
		</button>
	</div>
</div>

<style>
	.trigger-editor {
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

	/* Days Selector */
	.days-selector {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.5rem;
	}

	.day-button {
		padding: 0.5rem;
		border: 1px solid rgb(209, 213, 219);
		background: white;
		color: rgb(107, 114, 128);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.day-button:hover {
		border-color: rgb(156, 163, 175);
		background: rgb(249, 250, 251);
	}

	.day-button.selected {
		background: rgb(59, 130, 246);
		color: white;
		border-color: rgb(59, 130, 246);
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

		.days-selector {
			grid-template-columns: repeat(4, 1fr);
		}

		.editor-header,
		.editor-body,
		.editor-footer {
			padding: 1rem 1.25rem;
		}

		.form-section {
			padding: 0.875rem;
		}
	}
</style>
