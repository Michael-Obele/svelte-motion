# Svelte Motion `src/render` Directory Documentation

This directory is responsible for the rendering layer of `svelte-motion`. It takes the state managed by `MotionValue`s and animation logic and applies the necessary visual updates to the actual DOM elements (both HTML and SVG).

## Overview

The render directory abstracts the complexities of efficiently updating element styles, attributes, and transforms in the browser. It provides a consistent interface (`visualElement`) for different element types and handles optimizations like hardware acceleration and layout projections (for `AnimateSharedLayout`).

## Subdirectories

*   **`dom`**: Contains the core DOM rendering logic. This likely includes:
    *   The implementation of the `visualElement` abstraction for standard HTML elements.
    *   Code for applying styles, CSS variables, and transforms to DOM nodes.
    *   The projection logic required for `AnimateSharedLayout`, calculating how elements should visually transition between layouts. This might involve scale correction (`projection/scale-correction.js`) and managing the visual tree.
    *   The main `motion` component factory logic (`motion.js`, `motion-proxy.js`).
*   **`html`**: May contain specific rendering logic or configurations tailored for HTML elements, potentially extending or specializing the base DOM renderer.
*   **`svg`**: Contains the `visualElement` implementation and rendering logic specific to SVG elements. This handles SVG-specific attributes (like `d`, `cx`, `cy`, `fill`) and applies transforms using the SVG `transform` attribute.
*   **`utils`**: Provides utility functions supporting the rendering process. This could include functions for:
    *   Batching DOM updates for performance (`frame`).
    *   Parsing and applying transforms.
    *   Detecting hardware acceleration capabilities.
    *   Managing render scheduling and lifecycles (`on-mount.js`).
    *   Handling animation logic specific to rendering (`animation.js`).

## Files

*   **`index.js`**: The main entry point for the render module. It likely exports the core `visualElement` factory function or other key rendering utilities used by the rest of the library, abstracting the underlying DOM, HTML, or SVG specifics.