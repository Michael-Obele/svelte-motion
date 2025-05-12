# Svelte Motion `src/motion/features` Directory Documentation

This directory contains modular implementations of the various interactive and animation features that can be enabled on `motion` components.

## Overview

`svelte-motion` is designed with a modular architecture, allowing features like gestures, layout animations, and exit animations to be treated as distinct units. This directory houses the logic for each of these features. This modularity is key to enabling code-splitting via the `LazyMotion` component, where only the necessary feature modules are loaded.

The `use-features.js` hook is likely central here, acting as the mechanism within a `motion` component to dynamically load, initialize, and manage the lifecycle of the features required based on the component's props (e.g., `drag`, `whileHover`, `layoutId`, `exit`) and context (e.g., `PresenceContext`).

## Files & Components

*   **`animations.js`**: Implements the core animation features, including handling the `animate` prop and variants. It interacts with the `AnimationControls` and `animate` function from `src/animation`.
*   **`definitions.js`**: Likely contains definitions, constants, or type information related to the different features, possibly mapping prop names to feature implementations.
*   **`drag.js`**: Contains the feature implementation for drag gestures. It integrates the logic from `src/gestures/drag` and applies it to the `motion` component when drag-related props are present.
*   **`gestures.js`**: Implements the feature integration for non-drag gestures (tap, pan, hover, focus). It uses the hooks from `src/gestures` and activates them based on the presence of corresponding event handler props (e.g., `onTap`, `whileHover`).
*   **`use-features.js`**: Exports the `useFeatures` hook. This hook is crucial for `motion` components. It analyzes the component's props and context to determine which features are needed, potentially loads them if using `LazyMotion`, initializes them, and manages their updates and cleanup.
*   **`AnimationState.svelte`**: An internal Svelte component likely responsible for managing the state related to variants and animation controls for a `motion` component.
*   **`Exit.svelte`**: An internal Svelte component specifically handling the exit animation logic for components within an `AnimatePresence` context. It interacts with `PresenceContext` and triggers the defined `exit` animation.
*   **`UseFeatures.svelte`**: A Svelte component wrapper around the `useFeatures` hook, likely used internally during the setup of a `motion` component.

## Subdirectories

*   **`layout`**: Contains the feature implementation for layout animations. It integrates the logic related to `AnimateSharedLayout`, projection, and scale correction when the `layout` or `layoutId` prop is used on a `motion` component.