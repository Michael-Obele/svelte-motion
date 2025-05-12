# Svelte Motion `src/render/html` Directory Documentation

This directory contains the rendering logic and configuration specifically tailored for HTML elements within the `svelte-motion` library.

## Overview

Building upon the generic `VisualElement` concept, the modules here define how HTML elements are created, styled, and animated. This includes handling standard HTML attributes, CSS styles, and CSS transforms. It provides the `htmlVisualElement` which is the concrete implementation for animating HTML DOM nodes.

## Key Responsibilities

1.  **HTML VisualElement Implementation**:
    *   `visual-element.js`: Exports `htmlVisualElement`, the core class or factory function that adapts the generic `VisualElement` interface for HTML elements. It defines how to read values from an HTML instance (e.g., computed styles, attributes), how to apply styles and transforms, and how to measure its viewport box.

2.  **Configuration**:
    *   `config-motion.js`: Exports `htmlMotionConfig`, an object that provides HTML-specific configurations to the `VisualElement` factory. This includes:
        *   `scrapeMotionValuesFromProps`: A function to identify and extract `MotionValue`s from component props (primarily from the `style` prop for HTML elements).
        *   `createRenderState`: A function that returns a new, empty render state object suitable for HTML elements (containing `style`, `vars`, `transform`, etc.).

3.  **Prop and Style Handling**:
    *   `use-props.js`: Exports Svelte components or utilities for processing props.
        *   `UseHTMLProps.svelte`: An internal Svelte component that takes the full set of props passed to a `motion.div` (or similar) and the computed `visualState`. It separates motion-specific props from standard HTML attributes and applies transformations (like those needed for drag handling, e.g., `draggable="false"`, `touch-action`). It composes the final `style` object.
        *   `UseStyle.svelte`: An internal Svelte component that computes the final `style` object to be applied to the HTML element. It merges user-provided static styles from the `style` prop with styles generated from animated `MotionValue`s. It also handles `transformValues` if provided.
        *   `UseInitialMotionValues.svelte`: An internal Svelte component that calculates the initial styles based on `visualState` and `props`, which is especially important for server-side rendering or the first client-side render before animations take over.

4.  **Utilities**:
    *   The `utils` subdirectory contains helper functions specific to HTML rendering, such as:
        *   Building CSS transform strings (`build-transform.js`).
        *   Building projection transforms for layout animations (`build-projection-transform.js`).
        *   Creating the initial render state object (`create-render-state.js`).
        *   Applying styles and CSS variables to an HTML element (`render.js`).
        *   Scraping motion values from props (`scrape-motion-values.js`).
        *   Defining and identifying transform properties (`transform.js`).

## Svelte Components (Internal)

*   **`UseHTMLProps.svelte`**: Takes resolved motion values and user props to generate the final set of props (including the `style` object) to be applied to the HTML element. It handles special cases like drag-related attributes.
    *   **Slot Props**: `visualProps` (the final props object for the HTML element).
*   **`UseInitialMotionValues.svelte`**: Calculates the initial styles for an HTML element based on its `visualState` and props. This is crucial for the first render.
    *   **Slot Props**: `styles` (the initial style object).
*   **`UseStyle.svelte`**: Merges static styles from `props.style` with animated styles derived from motion values, applying `transformValues` if present.
    *   **Slot Props**: `styles` (the fully resolved style object).

## Core Files

*   **`visual-element.js`**: Defines `htmlVisualElement`, the primary engine for HTML element animation and interaction.
*   **`config-motion.js`**: Provides the configuration for `htmlVisualElement`.

This directory ensures that `svelte-motion` can effectively and efficiently animate any HTML element by abstracting the direct DOM manipulation and style application logic.