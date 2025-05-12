# Svelte Motion `src/context` Directory Documentation

This directory defines various Svelte contexts used throughout the `svelte-motion` library to implicitly pass data and configuration down the component tree.

## Overview

Svelte's context API is leveraged here to avoid prop drilling and provide shared state for features like motion configuration, layout animations, presence tracking (for enter/exit animations), and lazy loading. Components higher up the tree (like `MotionConfig` or `AnimatePresence`) set these contexts, and descendant components or hooks consume them.

## Files

*   **`DOMcontext.js`**: Potentially provides context related to the DOM environment or specific DOM-related configurations. (Purpose might need further clarification based on usage).
*   **`LayoutGroupContext.js`**: Defines the context used to identify groups of elements participating in layout animations. This is likely used by `AnimateSharedLayout` to scope layout calculations.
*   **`LazyContext.js`**: Defines the context associated with the `LazyMotion` component, probably used to track which features have been loaded or to provide the feature loading mechanism to child components.
*   **`MotionConfigContext.js`**: Defines the context used by the `MotionConfig` component. It stores shared configuration like default transition settings, making them available to all nested `motion` components.
*   **`MotionContext`**: Possibly defines a general context for sharing core motion-related state or functionalities accessible by motion components.
*   **`PresenceContext.js`**: Defines the context crucial for `AnimatePresence`. It likely tracks the presence status (present, entering, exiting) of components within an `AnimatePresence` boundary and provides necessary callbacks or state for exit animations.
*   **`SharedLayoutContext.js`**: Defines contexts (`FramerTreeLayoutContext`, `SharedLayoutContext`) used by `AnimateSharedLayout` to manage the state and communication required for coordinating animations between elements with the same `layoutId`.

## Svelte Components

*   **`ScaleCorrectionProvider.svelte`**: A Svelte component that likely acts as a provider for context related to scale correction. Scale correction is often needed during layout animations (especially involving `AnimateSharedLayout`) to ensure child elements maintain their apparent size and shape while the parent is transforming.