# Svelte Motion `src/render/svg` Directory Documentation

This directory is dedicated to the rendering logic and configuration specific to SVG elements within the `svelte-motion` library.

## Overview

SVG elements have their own set of attributes and behaviors distinct from HTML elements (e.g., attributes like `cx`, `cy`, `d`, `fill`, and different transform origin interpretations). This directory provides the specialized `VisualElement` implementation (`svgVisualElement`) and utilities to handle these SVG-specific characteristics, enabling `svelte-motion` to animate SVG graphics effectively.

## Key Responsibilities

1.  **SVG VisualElement Implementation**:
    *   `visual-element.js`: Exports `svgVisualElement`, which adapts the generic `VisualElement` for SVG. It builds upon the HTML visual element's logic but overrides methods for reading SVG-specific attributes, building attribute sets (including path definitions), and rendering them to the SVG element. It also handles differences in how transforms and transform origins are applied to SVGs.

2.  **Configuration**:
    *   `config-motion.js`: Exports `svgMotionConfig`, an object providing SVG-specific configurations for the `VisualElement`. This includes:
        *   `scrapeMotionValuesFromProps`: A function to extract `MotionValue`s from component props, paying special attention to common SVG attributes that might be animated (like `x`, `y` which are often treated as `attrX`, `attrY`).
        *   `createRenderState`: A function that returns an empty render state object suitable for SVG elements (includes an `attrs` object for SVG attributes alongside `style` for CSS styling).
        *   `onMount`: Logic to run when an SVG element is mounted, which can include measuring its bounding box (`getBBox`) or path length (`getTotalLength`) if applicable.

3.  **Prop and Attribute Handling**:
    *   `use-props.js`: Exports `UseSVGProps.svelte`.
    *   `UseSVGProps.svelte`: An internal Svelte component that takes the `visualState` and `props` for an SVG motion component. It's responsible for:
        *   Calling `buildSVGAttrs` to compute the final set of attributes (including styles that get translated to attributes or direct style properties for SVG).
        *   Merging any static `style` prop with the computed styles.
        *   Providing the final `visualProps` (attributes and style object) to be applied to the SVG element.

4.  **Utilities**:
    *   The `utils` subdirectory contains helper functions specifically for SVG rendering:
        *   `build-attrs.js`: Contains `buildSVGAttrs`, the core function for constructing the attribute object for an SVG element from its `latestValues`, projection data, and layout state. It handles regular SVG attributes, CSS styles (which might be applied as attributes or inline styles), and transform definitions.
        *   `camel-case-attrs.js`: Defines a set of SVG attributes that must retain their camelCase naming (e.g., `baseFrequency`) instead of being converted to dash-case.
        *   `create-render-state.js`: Exports `createSvgRenderState`, which initializes a render state object with an `attrs` field for SVG attributes.
        *   `path.js`: Contains `buildSVGPath` for calculating `stroke-dasharray` and `stroke-dashoffset` attributes to animate SVG path drawing (e.g., for `pathLength`, `pathSpacing`, `pathOffset` props).
        *   `render.js`: Exports `renderSVG`, a function that applies the computed attributes and styles from the `renderState` to the actual SVG DOM element.
        *   `scrape-motion-values.js`: Specializes prop scraping for SVG elements, correctly mapping `x`/`y` to `attrX`/`attrY` if they are motion values.
        *   `transform-origin.js`: Contains `calcSVGTransformOrigin` to correctly calculate the `transform-origin` for SVG elements, which differs from HTML's interpretation.
    *   `lowercase-elements.js`: Exports a list of lowercase SVG element tag names. This list is used by `isSVGComponent` (in `render/dom/utils`) to identify if a string tag refers to an SVG element, guiding the choice of `VisualElement`.

## Svelte Components (Internal)

*   **`UseSVGProps.svelte`**: Computes the final attributes and styles to be applied to an SVG element based on its animated state and props.
    *   **Slot Props**: `visualProps` (the final attributes and style object for the SVG element).
    *   **Example Usage (Conceptual internal in `motion.svg`):**
        ```svelte
        <script>
            // ... imports and setup ...
            export let visualState, props; // from parent Motion component
        </script>
        <UseSVGProps {visualState} {props} let:visualProps>
            <svg {...visualProps} use:motion_action>
                <slot />
            </svg>
        </UseSVGProps>
        ```

## Core Files

*   **`visual-element.js`**: Defines `svgVisualElement`, the engine for SVG element animation and interaction.
*   **`config-motion.js`**: Provides the configuration for `svgVisualElement`.
*   **`utils/build-attrs.js`**: Central to constructing the attribute payload for SVG elements.

This directory ensures that `svelte-motion` can treat SVG elements as first-class citizens for animation, respecting their unique attribute model and rendering behavior.