<script lang="ts">
	/**
	 * Rule Editor Modal Component
	 *
	 * Design: Modal interface for creating and editing local rules
	 * Inspired by Linear issue editor and Apple Automations UI
	 *
	 * Features:
	 * - Create new rules or edit existing rules
	 * - Form validation with visual feedback
	 * - API integration with loading states
	 * - Placeholder sections for triggers/actions (Phase 6+)
	 * - Toast notifications for success/error states
	 *
	 * Architecture:
	 * - Svelte 5 Runes for reactive form state
	 * - $derived for form validation
	 * - Tailwind CSS for styling
	 * - Proper error handling and user feedback
	 */

	import { toast } from 'svelte-sonner';
	import type { Rule, RuleTrigger, RuleAction } from '$lib/stores/rulesStore.svelte';

	interface Props {
		open: boolean;
		rule?: Rule | null;
		onClose: () => void;
		onSave: (rule: Rule) => void;
	}

	let { open = $bindable(false), rule = null, onClose, onSave }: Props = $props();

	// ============================================================================
	// STATE (Svelte 5 Runes)
	// ============================================================================

	let name = $state('');
	let description = $state('');
	let priority = $state(50);
	let enabled = $state(true);
	let isSubmitting = $state(false);

	// Touched fields for validation (only show errors after user interaction)
	let touched = $state({
		name: false,
		priority: false
	});

	// ============================================================================
	// DERIVED STATE
	// ============================================================================

	/**
	 * Form validation
	 */
	let nameError = $derived(
		touched.name && name.trim().length === 0 ? 'Name is required' : null
	);

	let nameMaxLengthError = $derived(
		touched.name && name.length > 100 ? 'Name must be 100 characters or less' : null
	);

	let priorityError = $derived(
		touched.priority && (priority < 1 || priority > 100)
			? 'Priority must be between 1 and 100'
			: null
	);

	let isValid = $derived(
		name.trim().length > 0 && name.length <= 100 && priority >= 1 && priority <= 100
	);

	let isEditMode = $derived(rule !== null && rule !== undefined);
	let modalTitle = $derived(isEditMode ? 'Edit Rule' : 'Create Rule');
	let submitButtonText = $derived(isEditMode ? 'Save Changes' : 'Create Rule');

	// ============================================================================
	// EFFECTS
	// ============================================================================

	/**
	 * Initialize form when rule prop changes
	 */
	$effect(() => {
		if (open && rule) {
			// Edit mode: populate form with existing rule
			name = rule.name;
			description = rule.description || '';
			priority = rule.priority;
			enabled = rule.enabled;
		} else if (open && !rule) {
			// Create mode: reset form
			resetForm();
		}
	});

	// ============================================================================
	// ACTIONS
	// ============================================================================

	/**
	 * Reset form to default values
	 */
	function resetForm() {
		name = '';
		description = '';
		priority = 50;
		enabled = true;
		touched = {
			name: false,
			priority: false
		};
		isSubmitting = false;
	}

	/**
	 * Handle form submission
	 */
	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Mark all fields as touched for validation
		touched.name = true;
		touched.priority = true;

		if (!isValid || isSubmitting) {
			return;
		}

		isSubmitting = true;

		try {
			if (isEditMode && rule) {
				// Update existing rule
				const response = await fetch(`/api/rules/local/${rule.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: name.trim(),
						description: description.trim() || undefined,
						priority,
						enabled
					})
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error?.message || 'Failed to update rule');
				}

				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error?.message || 'Failed to update rule');
				}

				toast.success(`Rule "${name}" updated successfully`);
				onSave(result.data);
			} else {
				// Create new rule
				// Note: Triggers and actions will be added in Phase 6
				const response = await fetch('/api/rules/local', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: name.trim(),
						description: description.trim() || undefined,
						priority,
						enabled,
						triggers: [] as RuleTrigger[], // Placeholder for Phase 6
						actions: [] as RuleAction[] // Placeholder for Phase 6
					})
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error?.message || 'Failed to create rule');
				}

				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error?.message || 'Failed to create rule');
				}

				toast.success(`Rule "${name}" created successfully`);
				onSave(result.data);
			}

			handleClose();
		} catch (err) {
			console.error('Failed to save rule:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to save rule';
			toast.error('Failed to save rule', {
				description: errorMessage
			});
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Handle modal close
	 */
	function handleClose() {
		if (!isSubmitting) {
			resetForm();
			onClose();
		}
	}

	/**
	 * Handle backdrop click
	 */
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	/**
	 * Handle Escape key
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="modal-backdrop" onclick={handleBackdropClick} role="dialog" aria-modal="true">
		<div class="modal-content" role="document">
			<!-- Modal Header -->
			<div class="modal-header">
				<h2 class="modal-title">{modalTitle}</h2>
				<button
					class="close-button"
					onclick={handleClose}
					aria-label="Close modal"
					disabled={isSubmitting}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<!-- Modal Body -->
			<form class="modal-body" onsubmit={handleSubmit}>
				<!-- Name Field -->
				<div class="form-group">
					<label for="rule-name" class="form-label">
						Name <span class="required">*</span>
					</label>
					<input
						id="rule-name"
						type="text"
						class="form-input"
						class:error={nameError || nameMaxLengthError}
						bind:value={name}
						onblur={() => (touched.name = true)}
						placeholder="e.g., Turn on lights at sunset"
						maxlength="100"
						required
						disabled={isSubmitting}
					/>
					{#if nameError}
						<span class="error-message">{nameError}</span>
					{:else if nameMaxLengthError}
						<span class="error-message">{nameMaxLengthError}</span>
					{/if}
					<span class="character-count">{name.length}/100</span>
				</div>

				<!-- Description Field -->
				<div class="form-group">
					<label for="rule-description" class="form-label">Description</label>
					<textarea
						id="rule-description"
						class="form-textarea"
						bind:value={description}
						placeholder="Optional description of what this rule does"
						maxlength="500"
						rows="3"
						disabled={isSubmitting}
					></textarea>
					<span class="character-count">{description.length}/500</span>
				</div>

				<!-- Priority Field -->
				<div class="form-group">
					<label for="rule-priority" class="form-label">
						Priority <span class="required">*</span>
					</label>
					<div class="priority-input-wrapper">
						<input
							id="rule-priority"
							type="number"
							class="form-input priority-input"
							class:error={priorityError}
							bind:value={priority}
							onblur={() => (touched.priority = true)}
							min="1"
							max="100"
							required
							disabled={isSubmitting}
						/>
						<span class="priority-hint">1 (highest) - 100 (lowest)</span>
					</div>
					{#if priorityError}
						<span class="error-message">{priorityError}</span>
					{/if}
				</div>

				<!-- Enabled Toggle -->
				<div class="form-group">
					<label class="toggle-label">
						<input
							type="checkbox"
							class="toggle-checkbox"
							bind:checked={enabled}
							disabled={isSubmitting}
						/>
						<span class="toggle-switch">
							<span class="toggle-slider"></span>
						</span>
						<span class="toggle-text">Enable rule</span>
					</label>
					<span class="form-hint">
						{enabled ? 'Rule will execute when triggered' : 'Rule will not execute automatically'}
					</span>
				</div>

				<!-- Triggers Section (Placeholder) -->
				<div class="section-placeholder">
					<div class="section-header">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="section-icon"
						>
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
							<polyline points="22 4 12 14.01 9 11.01"></polyline>
						</svg>
						<h3 class="section-title">Triggers</h3>
						<span class="coming-soon-badge">Phase 6</span>
					</div>
					<p class="section-description">
						Define when this rule should execute (e.g., device state change, time, schedule)
					</p>
					{#if isEditMode && rule?.triggers && rule.triggers.length > 0}
						<div class="existing-items">
							{#each rule.triggers as trigger}
								<div class="item-chip">
									{trigger.type}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Actions Section (Placeholder) -->
				<div class="section-placeholder">
					<div class="section-header">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="section-icon"
						>
							<polyline points="9 11 12 14 22 4"></polyline>
							<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
						</svg>
						<h3 class="section-title">Actions</h3>
						<span class="coming-soon-badge">Phase 6</span>
					</div>
					<p class="section-description">
						Define what actions to perform when triggered (e.g., turn on light, send notification)
					</p>
					{#if isEditMode && rule?.actions && rule.actions.length > 0}
						<div class="existing-items">
							{#each rule.actions as action}
								<div class="item-chip">
									{action.type}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</form>

			<!-- Modal Footer -->
			<div class="modal-footer">
				<button class="cancel-button" onclick={handleClose} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					class="submit-button"
					class:submitting={isSubmitting}
					onclick={handleSubmit}
					disabled={!isValid || isSubmitting}
				>
					{#if isSubmitting}
						<svg
							class="spinner"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span>Saving...</span>
					{:else}
						<span>{submitButtonText}</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Modal Backdrop */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
		overflow-y: auto;
	}

	/* Modal Content */
	.modal-content {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		width: 100%;
		max-width: 42rem;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Modal Header */
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid rgb(229, 231, 235);
	}

	.modal-title {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: rgb(17, 24, 39);
	}

	.close-button {
		width: 2rem;
		height: 2rem;
		border: none;
		background: transparent;
		color: rgb(107, 114, 128);
		cursor: pointer;
		border-radius: 0.375rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background: rgb(243, 244, 246);
		color: rgb(17, 24, 39);
	}

	.close-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.close-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Modal Body */
	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 2rem;
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

	.form-input {
		padding: 0.625rem 0.875rem;
		border: 1px solid rgb(209, 213, 219);
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		color: rgb(17, 24, 39);
		transition: all 0.2s ease;
		width: 100%;
	}

	.form-input:focus {
		outline: none;
		border-color: rgb(59, 130, 246);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-input:disabled {
		background: rgb(249, 250, 251);
		cursor: not-allowed;
		opacity: 0.6;
	}

	.form-input.error {
		border-color: rgb(239, 68, 68);
	}

	.form-input.error:focus {
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

	.form-textarea:disabled {
		background: rgb(249, 250, 251);
		cursor: not-allowed;
		opacity: 0.6;
	}

	.error-message {
		color: rgb(239, 68, 68);
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.character-count {
		text-align: right;
		font-size: 0.75rem;
		color: rgb(156, 163, 175);
		margin-top: -0.25rem;
	}

	/* Priority Input */
	.priority-input-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.priority-input {
		width: 6rem;
		flex-shrink: 0;
	}

	.priority-hint {
		font-size: 0.8125rem;
		color: rgb(107, 114, 128);
	}

	.form-hint {
		font-size: 0.8125rem;
		color: rgb(107, 114, 128);
		margin-top: -0.25rem;
	}

	/* Toggle Switch */
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.toggle-checkbox {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.toggle-switch {
		position: relative;
		width: 2.75rem;
		height: 1.5rem;
		background: rgb(209, 213, 219);
		border-radius: 9999px;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.toggle-checkbox:checked + .toggle-switch {
		background: rgb(34, 197, 94);
	}

	.toggle-checkbox:disabled + .toggle-switch {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-slider {
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 1.25rem;
		height: 1.25rem;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.toggle-checkbox:checked + .toggle-switch .toggle-slider {
		transform: translateX(1.25rem);
	}

	.toggle-text {
		font-size: 0.9375rem;
		font-weight: 500;
		color: rgb(55, 65, 81);
	}

	/* Section Placeholder */
	.section-placeholder {
		background: rgb(249, 250, 251);
		border: 1px dashed rgb(209, 213, 219);
		border-radius: 0.75rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.section-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: rgb(107, 114, 128);
		flex-shrink: 0;
	}

	.section-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: rgb(55, 65, 81);
		flex: 1;
	}

	.coming-soon-badge {
		background: rgb(243, 232, 255);
		color: rgb(126, 34, 206);
		padding: 0.25rem 0.625rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.section-description {
		margin: 0;
		font-size: 0.875rem;
		color: rgb(107, 114, 128);
		line-height: 1.5;
	}

	.existing-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.item-chip {
		background: white;
		border: 1px solid rgb(209, 213, 219);
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		color: rgb(55, 65, 81);
		font-weight: 500;
	}

	/* Modal Footer */
	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem 2rem;
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

	.cancel-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	.submit-button.submitting {
		pointer-events: none;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Mobile Responsiveness */
	@media (max-width: 768px) {
		.modal-backdrop {
			padding: 0;
			align-items: flex-end;
		}

		.modal-content {
			max-width: 100%;
			max-height: 95vh;
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;
		}

		.modal-header,
		.modal-body,
		.modal-footer {
			padding: 1.25rem 1.5rem;
		}

		.modal-title {
			font-size: 1.25rem;
		}

		.section-placeholder {
			padding: 1.25rem;
		}

		.priority-input-wrapper {
			flex-direction: column;
			align-items: flex-start;
		}

		.priority-input {
			width: 100%;
		}
	}
</style>
