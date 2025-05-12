# Svelte Motion `src/render/dom/utils` Directory Documentation

This directory provides a collection of utility functions and Svelte components that are essential for rendering `motion` components to the DOM, supporting both HTML and SVG elements.

## Overview

These utilities handle a variety of tasks including prop filtering, DOM attribute and style formatting, CSS variable resolution, unit conversion for animations, and identification of element types. They are crucial for the internal workings of the `motion` component factory and the `VisualElement` implementations.

## Key Files & Concepts

*   **`batch-layout.js`**:
    *   Exports `batchLayout` and `flushLayout`.
    *   **Purpose**: Implements a system for batching DOM reads and writes during layout measurement and animation phases. This is critical for performance, preventing layout thrashing by ensuring all reads happen before all writes in a given frame cycle.
    *   `batchLayout(callback)`: Registers a callback that receives `read` and `write` functions to schedule DOM operations.
    *   `flushLayout()`: Executes all batched read and write operations in the correct order.
    *   **Usage**: Used extensively by `AnimateSharedLayout` and layout animation features.

*   **`camel-to-dash.js`**:
    *   Exports `camelToDash`: A function that converts camelCase strings (e.g., `backgroundColor`) to dash-case (e.g., `background-color`).
    *   **Usage**: Used for setting CSS properties on DOM elements, as most CSS properties are dash-cased.

*   **`create-config.js`**:
    *   Exports `createDomMotionConfig`: A factory function used internally to create the configuration object passed to `createMotionComponent`. It merges base HTML/SVG configurations with feature sets and render functions.

*   **`css-variables-conversion.js`**:
    *   Exports `resolveCSSVariables` and `parseCSSVariable`.
    *   **Purpose**: Handles CSS variables (e.g., `var(--my-color, blue)`).
    *   `parseCSSVariable`: Parses a CSS variable string to extract its name and fallback value.
    *   `resolveCSSVariables`: Takes a `VisualElement` and a target style object, then resolves any CSS variable values by reading them from the computed style of the element. It ensures that animations use the resolved values but can revert to the variable definition in `transitionEnd`.
    *   **Usage**: Ensures animations work correctly with CSS custom properties.

*   **`filter-props.js`**:
    *   Exports `filterProps`: A function that filters props passed to a `motion` component. It separates valid HTML/SVG attributes from `svelte-motion` specific props. It can optionally integrate with `@emotion/is-prop-valid` if available to handle props for styled-components or Emotion.
    *   **Usage**: Ensures that only valid attributes are passed to the underlying DOM element, preventing React/DOM warnings and incorrect behavior.

*   **`is-css-variable.js`**:
    *   Exports `isCSSVariable`: A simple utility to check if a string starts with `--`, indicating it's a CSS variable name.

*   **`is-svg-component.js`**:
    *   Exports `isSVGComponent`: A function to determine if a given string tag name (e.g., "div", "circle") refers to an SVG element or an HTML element. It checks against a list of known lowercase SVG elements and also looks for uppercase characters (common in React SVG components like `SvgCircle`).
    *   **Usage**: Helps `motion` decide whether to use `htmlVisualElement` or `svgVisualElement`.

*   **`parse-dom-variant.js`**:
    *   Exports `parseDomVariant`: A function that prepares a variant definition for DOM animation. It involves:
        1.  Resolving CSS variables (`resolveCSSVariables`).
        2.  Performing unit conversions (`unitConversion`) for properties that might change units (e.g., animating `width` from `"auto"` to `"100%"`).
    *   **Usage**: Called by `VisualElement.makeTargetAnimatable` to ensure target values are in a format suitable for the animation engine (Popmotion).

*   **`unit-conversion.js`**:
    *   Exports `unitConversion`.
    *   **Purpose**: Handles animation between different CSS units for positional properties (like `width`, `height`, `x`, `y`, `top`, `left`). For example, animating `width` from `"auto"` to `"100%"` requires measuring both states in pixels to animate smoothly.
    *   It temporarily applies target styles, measures the element, then converts percentage/auto values to pixels for the animation, and ensures the `transitionEnd` state uses the original unit if needed.
    *   **Usage**: Makes animations involving dimensional units more robust and intuitive.

*   **`use-html-props.js`**:
    *   Re-exports Svelte components `UseStyle.svelte` and `UseHTMLProps.svelte` from the `render/html/` directory. These are used internally by `UseRender.svelte` for HTML elements.

*   **`use-svg-props.js`**:
    *   Re-exports `UseSVGProps.svelte` from the `render/svg/` directory. This is used internally by `UseRender.svelte` for SVG elements.

## Svelte Components (Internal)

*   **`UseInitialMotionProps.svelte`**:
    *   **Purpose**: A Svelte component used internally, likely by `UseSVGProps.svelte` or a similar mechanism for initial server-side rendering or static rendering for SVG elements. It takes a `visualElement` and `props`, builds the initial set of SVG attributes (including resolved motion values), and provides them via a slot prop `svgProps`.
    *   This is particularly important for SVGs where many visual properties are attributes rather than styles.
    *   **Props**:
        *   `visualElement`: The `VisualElement` instance.
        *   `props`: The component's props.
    *   **Slot Props**:
        *   `svgProps`: An object containing the initial attributes to be applied to the SVG element.
    *   **Note**: Its primary role is ensuring the correct initial state before client-side hydration and animation take over, especially in static or SSR contexts.

These utilities are foundational for the DOM rendering layer of `svelte-motion`, ensuring correct and efficient application of styles, attributes, and animations to HTML and SVG elements.