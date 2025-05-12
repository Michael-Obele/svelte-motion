# Svelte Motion `src/components/AnimateSharedLayout` Directory Documentation

This directory implements the `AnimateSharedLayout` component, which enables layout animations in `svelte-motion`. Layout animations allow elements to smoothly animate between different positions and sizes on the screen, even if they are structurally different components in the Svelte tree.

## Overview

`AnimateSharedLayout` works by tracking `motion` components that share the same `layoutId` prop within its boundary. When the component tree changes (e.g., due to conditional rendering or navigation) and a `motion` component with a given `layoutId` appears in a new position or size, `AnimateSharedLayout` coordinates the animation. It uses the `SharedLayoutContext` and projection techniques (managed by the `src/render` directory) to calculate and apply the necessary transforms to create the illusion of the element moving smoothly from its old position to its new one.

## Files & Components

*   **`AnimateSharedLayout.svelte`**: The main user-facing Svelte component. Developers wrap sections of their application containing potentially shared elements with this component. It establishes the necessary contexts (`SharedLayoutContext`, `LayoutGroupContext`) and enables the layout animation capabilities for its descendants.
*   **`index.js`**: Exports the `AnimateSharedLayout` component for use in applications.
*   **`types.js`**: Contains TypeScript type definitions specific to `AnimateSharedLayout` and its features (like `VisibilityAction`).

## Subdirectories

*   **`utils`**: Holds utility functions specifically designed for `AnimateSharedLayout`. This might include:
    *   `batcher.js`: Logic for batching DOM reads and writes during layout animations for performance.
    *   `crossfader.js`: Utilities potentially used for cross-fading elements during complex shared layout transitions where direct position animation isn't suitable.
    *   Other helpers for managing the layout tree, identifying shared elements, or coordinating animations.