# Svelte Motion `src/components/LazyMotion` Directory Documentation

This directory contains the implementation for the `LazyMotion` component, designed to help optimize the bundle size of applications using `svelte-motion`.

## Overview

`LazyMotion` allows developers to defer the loading of certain `svelte-motion` features (like specific animation types or gesture handlers) until they are actually needed. Instead of bundling all features upfront, `LazyMotion` enables code-splitting, where feature modules are loaded asynchronously. This can significantly reduce the initial JavaScript payload, improving load times, especially for applications that only use a subset of `svelte-motion`'s capabilities on certain pages or components.

It likely works by accepting a `features` prop, which points to a dynamic import function that resolves to the desired feature set. It then uses the `LazyContext` to make these loaded features available to descendant `motion` components.

## Files & Components

*   **`LazyMotion.svelte`**: The main user-facing Svelte component. Developers wrap parts of their application (or the entire application) with `LazyMotion` and provide it with the features to load dynamically.
*   **`index.js`**: Exports the `LazyMotion` component for use in applications.

## Usage Example (Conceptual)

```svelte
<script>
	import { LazyMotion, m } from 'svelte-motion';

	// Define a function that dynamically imports the desired feature set
	// (domMax includes all features suitable for DOM animation)
	const loadFeatures = () => import('svelte-motion').then(res => res.domMax);
</script>

<LazyMotion features={loadFeatures}>
	<m.div animate={{ scale: 1.5 }} />
	<!-- Other motion components -->
</LazyMotion>
```

In this conceptual example, the code for handling animations and gestures (`domMax`) is only loaded when the `LazyMotion` component mounts, rather than being included in the initial bundle.