<script lang="ts">
	/**
	 * Automations Page
	 *
	 * Features:
	 * - Grid view of all automations
	 * - Enable/disable automations with toggle switch
	 * - Visual status indicators
	 * - Loading states and error handling
	 * - Mock data support (until backend API is ready)
	 *
	 * Architecture:
	 * - Uses automationStore for state management
	 * - AutomationsGrid component for layout
	 * - AutomationCard components for individual automations
	 * - Svelte 5 Runes for reactive state
	 *
	 * Future Enhancements:
	 * - Create new automations
	 * - Edit existing automations
	 * - Automation execution history
	 * - Backend API integration
	 */

	import AutomationsGrid from '$lib/components/automations/AutomationsGrid.svelte';
</script>

<svelte:head>
	<title>Automations - Smarter Things</title>
	<meta name="description" content="Manage your smart home automations and routines" />
</svelte:head>

<!-- Main Automations Grid -->
<AutomationsGrid />
