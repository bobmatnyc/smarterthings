<script lang="ts">
	/**
	 * Device Filter Component
	 *
	 * Search and filter controls for device list.
	 *
	 * Features:
	 * - Text search (name, room, label)
	 * - Room dropdown filter
	 * - Capability multi-select
	 * - Clear filters button
	 *
	 * Design Pattern: Controlled Component
	 * - Parent manages filter state
	 * - Component emits filter changes via callback
	 * - Debounced search input (300ms)
	 */

	interface Props {
		rooms: string[];
		capabilities?: string[];
		onFilterChange: (filters: FilterState) => void;
	}

	interface FilterState {
		searchQuery: string;
		selectedRoom: string | null;
		selectedCapabilities: string[];
	}

	let { rooms, capabilities = [], onFilterChange }: Props = $props();

	// Filter state
	let searchQuery = $state('');
	let selectedRoom = $state<string | null>(null);
	let selectedCapabilities = $state<string[]>([]);

	// Debounce timer for search
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Handle search input with debouncing
	 */
	function onSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;

		// Clear existing timeout
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		// Debounce by 300ms
		debounceTimeout = setTimeout(() => {
			emitFilterChange();
		}, 300);
	}

	/**
	 * Handle room selection
	 */
	function onRoomChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedRoom = target.value || null;
		emitFilterChange();
	}

	/**
	 * Clear all filters
	 */
	function clearFilters() {
		searchQuery = '';
		selectedRoom = null;
		selectedCapabilities = [];
		emitFilterChange();
	}

	/**
	 * Emit filter change to parent
	 */
	function emitFilterChange() {
		onFilterChange({
			searchQuery,
			selectedRoom,
			selectedCapabilities
		});
	}

	/**
	 * Check if any filters are active
	 */
	let hasActiveFilters = $derived(
		searchQuery.trim() !== '' || selectedRoom !== null || selectedCapabilities.length > 0
	);
</script>

<div class="card p-4 bg-surface-100 dark:bg-surface-800 space-y-4">
	<!-- Search Input -->
	<div class="form-group">
		<label for="device-search" class="label font-medium mb-2">
			<span>Search Devices</span>
		</label>
		<input
			id="device-search"
			type="search"
			placeholder="Search by name, room, or label..."
			value={searchQuery}
			oninput={onSearchInput}
			class="input"
		/>
	</div>

	<!-- Filters Row -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- Room Filter -->
		<div class="form-group">
			<label for="room-filter" class="label font-medium mb-2">
				<span>Room</span>
			</label>
			<select id="room-filter" class="select" value={selectedRoom ?? ''} onchange={onRoomChange}>
				<option value="">All Rooms</option>
				{#each rooms as room}
					<option value={room}>{room}</option>
				{/each}
			</select>
		</div>

		<!-- Clear Filters Button -->
		<div class="form-group flex items-end">
			<button
				class="btn variant-ghost-surface w-full"
				onclick={clearFilters}
				disabled={!hasActiveFilters}
			>
				<span>🔄</span>
				<span>Clear Filters</span>
			</button>
		</div>
	</div>

	<!-- Active Filter Summary -->
	{#if hasActiveFilters}
		<div class="text-sm text-gray-600 dark:text-gray-400">
			<span class="font-medium">Active filters:</span>
			{#if searchQuery.trim()}
				<span class="badge variant-soft-primary ml-2">"{searchQuery}"</span>
			{/if}
			{#if selectedRoom}
				<span class="badge variant-soft-secondary ml-2">{selectedRoom}</span>
			{/if}
		</div>
	{/if}
</div>
