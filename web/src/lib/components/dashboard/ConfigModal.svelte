<script lang="ts">
	/**
	 * Config Modal - Dashboard Settings
	 *
	 * Full configuration modal with tabbed sections:
	 * - Display: Status crawler, alerts, crawler speed
	 * - Rooms: Show/hide rooms
	 * - Devices: Show/hide devices per room
	 * - Kiosk: Kiosk mode settings
	 *
	 * Features:
	 * - Modal overlay with dark backdrop
	 * - Tabbed interface
	 * - Auto-persist to localStorage via dashboardStore
	 * - Keyboard: ESC to close, Tab navigation
	 * - Accessible: Focus trap, ARIA labels
	 */

	import { onMount } from 'svelte';
	import type { Room } from '$lib/stores/roomStore.svelte';
	import type { UnifiedDevice } from '$types';
	import { getDashboardStore } from '$lib/stores/dashboardStore.svelte';
	import RoomVisibilityPicker from './config/RoomVisibilityPicker.svelte';
	import DeviceVisibilityPicker from './config/DeviceVisibilityPicker.svelte';

	interface Props {
		rooms: Room[];
		devices: UnifiedDevice[];
		onClose: () => void;
	}

	let { rooms = [], devices = [], onClose }: Props = $props();

	const dashboardStore = getDashboardStore();

	type TabId = 'display' | 'rooms' | 'devices' | 'kiosk';
	let activeTab = $state<TabId>('display');

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	function enterKioskMode() {
		dashboardStore.setKioskMode(true);
		onClose();
	}

	onMount(() => {
		// Focus trap setup
		const modal = document.querySelector('.config-modal');
		const focusableElements = modal?.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);

		if (focusableElements && focusableElements.length > 0) {
			(focusableElements[0] as HTMLElement)?.focus();
		}

		// Keyboard listener
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<!-- Modal Overlay -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={onClose}>
	<!-- Modal Panel -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="config-modal"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
		aria-labelledby="modal-title"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- Header -->
		<div class="modal-header">
			<h2 id="modal-title">Dashboard Settings</h2>
			<button
				type="button"
				class="close-btn"
				onclick={onClose}
				aria-label="Close settings"
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

		<!-- Tabs -->
		<div class="tabs">
			<button
				type="button"
				class="tab"
				class:active={activeTab === 'display'}
				onclick={() => (activeTab = 'display')}
			>
				Display
			</button>
			<button
				type="button"
				class="tab"
				class:active={activeTab === 'rooms'}
				onclick={() => (activeTab = 'rooms')}
			>
				Rooms
			</button>
			<button
				type="button"
				class="tab"
				class:active={activeTab === 'devices'}
				onclick={() => (activeTab = 'devices')}
			>
				Devices
			</button>
			<button
				type="button"
				class="tab"
				class:active={activeTab === 'kiosk'}
				onclick={() => (activeTab = 'kiosk')}
			>
				Kiosk
			</button>
		</div>

		<!-- Tab Content -->
		<div class="modal-content">
			{#if activeTab === 'display'}
				<!-- Display Settings -->
				<div class="settings-section">
					<div class="setting-item">
						<label class="setting-label">
							<input
								type="checkbox"
								checked={dashboardStore.showStatusCrawler}
								onchange={(e) => dashboardStore.setShowStatusCrawler((e.target as HTMLInputElement).checked)}
							/>
							<span>Show Status Crawler</span>
						</label>
						<p class="setting-description">Display status bar at the top with device updates</p>
					</div>

					<div class="setting-item">
						<label class="setting-label">
							<input
								type="checkbox"
								checked={dashboardStore.showAlerts}
								onchange={(e) => dashboardStore.setShowAlerts((e.target as HTMLInputElement).checked)}
							/>
							<span>Show Alerts</span>
						</label>
						<p class="setting-description">Display device alerts and notifications</p>
					</div>

					<div class="setting-item">
						<div class="setting-label-block">
							<span>Crawler Speed</span>
						</div>
						<div class="speed-options">
							<label class="radio-label">
								<input
									type="radio"
									name="crawler-speed"
									value="slow"
									checked={dashboardStore.crawlerSpeed === 'slow'}
									onchange={() => dashboardStore.setCrawlerSpeed('slow')}
								/>
								<span>Slow</span>
							</label>
							<label class="radio-label">
								<input
									type="radio"
									name="crawler-speed"
									value="medium"
									checked={dashboardStore.crawlerSpeed === 'medium'}
									onchange={() => dashboardStore.setCrawlerSpeed('medium')}
								/>
								<span>Medium</span>
							</label>
							<label class="radio-label">
								<input
									type="radio"
									name="crawler-speed"
									value="fast"
									checked={dashboardStore.crawlerSpeed === 'fast'}
									onchange={() => dashboardStore.setCrawlerSpeed('fast')}
								/>
								<span>Fast</span>
							</label>
						</div>
					</div>
				</div>
			{:else if activeTab === 'rooms'}
				<!-- Room Visibility -->
				<div class="settings-section">
					<RoomVisibilityPicker {rooms} />
				</div>
			{:else if activeTab === 'devices'}
				<!-- Device Visibility -->
				<div class="settings-section">
					<DeviceVisibilityPicker {rooms} {devices} />
				</div>
			{:else if activeTab === 'kiosk'}
				<!-- Kiosk Settings -->
				<div class="settings-section">
					<div class="setting-item">
						<label class="setting-label">
							<input
								type="checkbox"
								checked={dashboardStore.kioskAutostart}
								onchange={(e) => dashboardStore.setKioskAutostart((e.target as HTMLInputElement).checked)}
							/>
							<span>Auto-enter Kiosk Mode</span>
						</label>
						<p class="setting-description">Automatically enter kiosk mode when page loads</p>
					</div>

					<div class="kiosk-action">
						<button type="button" class="kiosk-btn" onclick={enterKioskMode}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
								></path>
							</svg>
							<span>Enter Kiosk Mode</span>
						</button>
						<p class="kiosk-description">Hide navigation and enter fullscreen (press ESC to exit)</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.config-modal {
		background: white;
		border-radius: 1rem;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		width: 100%;
		max-width: 48rem;
		max-height: calc(100vh - 2rem);
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid rgb(229, 231, 235);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: rgb(17, 24, 39);
	}

	.close-btn {
		background: transparent;
		border: none;
		color: rgb(107, 114, 128);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		background: rgb(243, 244, 246);
		color: rgb(17, 24, 39);
	}

	.close-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid rgb(229, 231, 235);
		padding: 0 1.5rem;
		gap: 0.5rem;
	}

	.tab {
		padding: 1rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: rgb(107, 114, 128);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab:hover {
		color: rgb(17, 24, 39);
	}

	.tab.active {
		color: rgb(59, 130, 246);
		border-bottom-color: rgb(59, 130, 246);
	}

	.modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-label,
	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-weight: 500;
		color: rgb(17, 24, 39);
		cursor: pointer;
	}

	.setting-label-block {
		font-weight: 600;
		color: rgb(17, 24, 39);
		margin-bottom: 0.5rem;
	}

	.setting-label input[type='checkbox'],
	.radio-label input[type='radio'] {
		width: 1.125rem;
		height: 1.125rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.setting-description {
		margin: 0;
		font-size: 0.875rem;
		color: rgb(107, 114, 128);
		line-height: 1.5;
		padding-left: 1.875rem;
	}

	.speed-options {
		display: flex;
		gap: 1.5rem;
		padding-left: 0.25rem;
	}

	.kiosk-action {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.5rem;
		background: rgb(239, 246, 255);
		border-radius: 0.5rem;
		border: 1px solid rgb(191, 219, 254);
	}

	.kiosk-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		background: rgb(59, 130, 246);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.kiosk-btn:hover {
		background: rgb(37, 99, 235);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.kiosk-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.kiosk-description {
		margin: 0;
		font-size: 0.875rem;
		color: rgb(30, 64, 175);
		text-align: center;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.modal-overlay {
			padding: 0;
		}

		.config-modal {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.tabs {
			overflow-x: auto;
			scrollbar-width: none;
		}

		.tabs::-webkit-scrollbar {
			display: none;
		}

		.tab {
			white-space: nowrap;
		}

		.speed-options {
			flex-direction: column;
			gap: 1rem;
		}
	}

	/* Scrollbar styling */
	.modal-content::-webkit-scrollbar {
		width: 0.5rem;
	}

	.modal-content::-webkit-scrollbar-track {
		background: rgb(243, 244, 246);
	}

	.modal-content::-webkit-scrollbar-thumb {
		background: rgb(209, 213, 219);
		border-radius: 0.25rem;
	}

	.modal-content::-webkit-scrollbar-thumb:hover {
		background: rgb(156, 163, 175);
	}
</style>
