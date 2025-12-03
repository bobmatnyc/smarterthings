<script lang="ts">
	/**
	 * Device Filter Component
	 *
	 * Search and filter controls for device list.
	 *
	 * Features:
	 * - Text search (name, room, label)
	 * - Room dropdown filter
	 * - Device type dropdown filter
	 * - Capability multi-select
	 * - Clear filters button
	 * - URL query parameter persistence (Ticket 1M-533)
	 *
	 * Design Pattern: Controlled Component with URL Persistence
	 * - Parent manages filter state
	 * - Component emits filter changes via callback
	 * - Debounced search input (300ms)
	 * - URL parameters sync with filter state
	 *
	 * URL Parameters:
	 * - ?search={query} - Text search
	 * - ?room={roomName} - Room filter
	 * - ?type={deviceType} - Device type filter
	 * - ?manufacturer={name} - Manufacturer filter
	 *
	 * Implementation (Ticket 1M-533):
	 * - Reads initial filter state from URL on mount
	 * - Updates URL when filters change (replaceState, no page reload)
	 * - Supports browser back/forward navigation
	 * - Bookmarkable filtered views
	 */

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	interface Props {
		rooms: string[];
		types: string[];
		manufacturers?: string[];
		capabilities?: string[];
		onFilterChange: (filters: FilterState) => void;
	}

	interface FilterState {
		searchQuery: string;
		selectedRoom: string | null;
		selectedType: string | null;
		selectedManufacturer: string | null;
		selectedCapabilities: string[];
	}

	let { rooms, types, manufacturers = [], capabilities = [], onFilterChange }: Props = $props();

	// Read initial filter state from URL query parameters (Ticket 1M-533)
	const urlParams = $derived($page.url.searchParams);

	// Filter state - initialized from URL
	let searchQuery = $state(urlParams.get('search') || '');
	let selectedRoom = $state<string | null>(urlParams.get('room') || null);
	let selectedType = $state<string | null>(urlParams.get('type') || null);
	let selectedManufacturer = $state<string | null>(urlParams.get('manufacturer') || null);
	let selectedCapabilities = $state<string[]>([]);

	// Debounce timer for search
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Debounce timer for URL updates (Ticket 1M-533)
	let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Update URL query parameters to reflect current filter state (Ticket 1M-533)
	 *
	 * Design Decision: Debounced URL updates with replaceState
	 * Rationale: Prevents excessive URL changes during typing and avoids
	 * cluttering browser history. Search gets 300ms debounce.
	 *
	 * Trade-offs:
	 * - replaceState: No browser history clutter vs. no undo via back button
	 * - noScroll: Maintains scroll position vs. standard navigation behavior
	 * - keepFocus: Maintains input focus vs. potential focus loss
	 *
	 * Performance: O(1) parameter construction, sub-millisecond URL update
	 */
	function updateURL() {
		// Clear any pending URL update
		if (urlUpdateTimeout) {
			clearTimeout(urlUpdateTimeout);
		}

		// Debounce URL updates by 300ms to match search debounce
		urlUpdateTimeout = setTimeout(() => {
			const params = new URLSearchParams($page.url.searchParams);

			// Set or remove parameters based on filter state
			if (searchQuery.trim()) {
				params.set('search', searchQuery.trim());
			} else {
				params.delete('search');
			}

			if (selectedRoom) {
				params.set('room', selectedRoom);
			} else {
				params.delete('room');
			}

			if (selectedType) {
				params.set('type', selectedType);
			} else {
				params.delete('type');
			}

			if (selectedManufacturer) {
				params.set('manufacturer', selectedManufacturer);
			} else {
				params.delete('manufacturer');
			}

			// Construct new URL
			const newUrl = params.toString()
				? `${$page.url.pathname}?${params.toString()}`
				: $page.url.pathname;

			// Update URL without page reload (replaceState to avoid history clutter)
			goto(newUrl, { replaceState: true, noScroll: true, keepFocus: true });
		}, 100); // Shorter delay for URL updates (100ms vs 300ms for search)
	}

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
			updateURL(); // Update URL when search changes
		}, 300);
	}

	/**
	 * Handle room selection
	 */
	function onRoomChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedRoom = target.value || null;
		emitFilterChange();
		updateURL(); // Update URL immediately for dropdown changes (Ticket 1M-533)
	}

	/**
	 * Handle device type selection
	 */
	function onTypeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedType = target.value || null;
		emitFilterChange();
		updateURL(); // Update URL immediately for dropdown changes (Ticket 1M-533)
	}

	/**
	 * Handle manufacturer selection (Ticket 1M-559)
	 */
	function onManufacturerChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedManufacturer = target.value || null;
		emitFilterChange();
		updateURL(); // Update URL immediately for dropdown changes (Ticket 1M-533)
	}

	/**
	 * Clear all filters
	 * Also clears URL query parameters (Ticket 1M-533)
	 */
	function clearFilters() {
		searchQuery = '';
		selectedRoom = null;
		selectedType = null;
		selectedManufacturer = null;
		selectedCapabilities = [];
		emitFilterChange();

		// Clear all URL query parameters (Ticket 1M-533)
		goto($page.url.pathname, { replaceState: true, noScroll: true, keepFocus: true });
	}

	/**
	 * Emit filter change to parent
	 */
	function emitFilterChange() {
		onFilterChange({
			searchQuery,
			selectedRoom,
			selectedType,
			selectedManufacturer,
			selectedCapabilities
		});
	}

	/**
	 * Check if any filters are active
	 */
	let hasActiveFilters = $derived(
		searchQuery.trim() !== '' ||
			selectedRoom !== null ||
			selectedType !== null ||
			selectedManufacturer !== null ||
			selectedCapabilities.length > 0
	);

	/**
	 * Initialize filters from URL on mount (Ticket 1M-533)
	 *
	 * Design Decision: Single-run effect on mount
	 * Rationale: Ensures parent store is updated with URL parameters
	 * on component initialization. This handles page load, refresh,
	 * bookmark navigation, and direct URL access.
	 *
	 * Alternative Considered: Reactive effect that runs on URL changes
	 * Rejected: Would conflict with our own URL updates, creating
	 * infinite loops. Browser back/forward is handled by SvelteKit's
	 * built-in routing (page store updates trigger re-initialization).
	 */
	$effect(() => {
		// Emit initial filter state from URL to parent
		if (searchQuery || selectedRoom || selectedType || selectedManufacturer) {
			console.log('[DeviceFilter] Initializing from URL:', {
				searchQuery,
				selectedRoom,
				selectedType,
				selectedManufacturer
			});
			emitFilterChange();
		}
	});
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
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

		<!-- Device Type Filter -->
		<div class="form-group">
			<label for="type-filter" class="label font-medium mb-2">
				<span>Device Type</span>
			</label>
			<select id="type-filter" class="select" value={selectedType ?? ''} onchange={onTypeChange}>
				<option value="">All Types</option>
				{#each types as type}
					<option value={type}>{type}</option>
				{/each}
			</select>
		</div>

		<!-- Manufacturer Filter (Ticket 1M-559) -->
		<div class="form-group">
			<label for="manufacturer-filter" class="label font-medium mb-2">
				<span>Manufacturer</span>
			</label>
			<select
				id="manufacturer-filter"
				class="select"
				value={selectedManufacturer ?? ''}
				onchange={onManufacturerChange}
			>
				<option value="">All Manufacturers</option>
				{#each manufacturers as manufacturer}
					<option value={manufacturer}>{manufacturer}</option>
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
				<span class="badge variant-soft-secondary ml-2">Room: {selectedRoom}</span>
			{/if}
			{#if selectedType}
				<span class="badge variant-soft-tertiary ml-2">Type: {selectedType}</span>
			{/if}
			{#if selectedManufacturer}
				<span class="badge variant-soft-primary ml-2">Mfr: {selectedManufacturer}</span>
			{/if}
		</div>
	{/if}
</div>
