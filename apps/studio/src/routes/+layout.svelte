<script lang="ts">
	import "../app.css";
	import favicon from "#lib/assets/favicon.svg";
	import type { LayoutProps } from "./$types";

	import { browser, dev } from "$app/env";
	import { Agentation, type AnnotationProps } from "sv-agentation";

	let playgroundAnnotationProps: AnnotationProps = {
		toolbarPosition: "bottom-left",
		outputMode: "detailed",
		pauseAnimations: true,
		clearOnCopy: true,
		includeComponentContext: false,
		includeComputedStyles: false,
	};

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

{#if browser && dev}
	<Agentation {...playgroundAnnotationProps} />
{/if}
