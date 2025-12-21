<script lang="ts">
	/**
	 * Rules Page
	 *
	 * Features:
	 * - Grid view of all rules
	 * - Execute rules manually with button
	 * - Visual status indicators (enabled/disabled)
	 * - Loading states and error handling
	 * - Real-time data from SmartThings API
	 *
	 * Architecture:
	 * - Uses rulesStore for state management
	 * - RulesGrid component for layout
	 * - RuleCard components for individual rules
	 * - Svelte 5 Runes for reactive state
	 *
	 * Future Enhancements:
	 * - Create new rules
	 * - Edit existing rules
	 * - Rule execution history
	 * - Enable/disable rules
	 */

	import RulesGrid from '$lib/components/rules/RulesGrid.svelte';
</script>

<svelte:head>
	<title>Rules - Smarter Things</title>
	<meta name="description" content="Manage your smart home automation rules with IF/THEN logic" />
</svelte:head>

<!-- Main Rules Grid -->
<RulesGrid />
