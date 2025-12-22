<script lang="ts">
	/**
	 * Scenes Page
	 *
	 * Features:
	 * - Grid view of all scenes (SmartThings routines)
	 * - Execute scenes on-demand
	 * - Visual status indicators
	 * - Loading states and error handling
	 *
	 * Architecture:
	 * - Uses scenesStore for state management
	 * - ScenesGrid component for layout
	 * - SceneCard components for individual scenes
	 * - Svelte 5 Runes for reactive state
	 */

	import AutomationsGrid from '$lib/components/automations/AutomationsGrid.svelte';
</script>

<svelte:head>
	<title>Scenes - Smarter Things</title>
	<meta name="description" content="Manage and execute your smart home scenes" />
</svelte:head>

<!-- Main Scenes Grid -->
<AutomationsGrid />
