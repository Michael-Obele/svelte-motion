# Svelte Motion `src/render/dom` Directory Documentation

This directory is at the heart of how `svelte-motion` interacts with and renders to the actual Document Object Model (DOM). It bridges the abstract `VisualElement` concept with concrete HTML and SVG elements.

## Overview

The `render/dom` directory provides the foundational logic for creating motion-enabled DOM components (both HTML and SVG), managing their rendering lifecycle, applying styles and transforms, and handling layout projection for features like `AnimateSharedLayout`. It also defines how motion values are scraped from props and how default value types are handled for DOM elements.

## Key Responsibilities

1.  **Motion Component Creation**:
    *   `motion.js` and `motion-proxy.js` (`M.svelte`): These are central to creating the `motion.[element]` components (e.g., `motion.div`, `motion.circle`). `motion-proxy.js` likely uses a JavaScript `Proxy` to dynamically generate these components for any valid HTML or SVG tag. `M.svelte` is the generic Svelte component used by the proxy.
    *   `create-motion-class.js`: Provides a way to create the base class or component structure for motion components, potentially for non-proxy environments or specific internal uses.
    *   `motion-minimal.js`: Exports `m`, a minimal version of `motion` components, likely including only layout animation features by default, intended for use with `LazyMotion` for bundle size optimization.

2.  **Visual Element Instantiation**:
    *   `create-visual-element.js`: Exports `createDomVisualElement`, a factory function that, given a component type ("DOM" or "SVG") and options, returns the appropriate `VisualElement` instance (`htmlVisualElement` or `svgVisualElement`).
    *   `svg-visual-element.js`: Provides the `VisualElement` implementation specific to SVG elements. It is based on `htmlVisualElement` but overrides methods for SVG-specific attribute handling and measurement (like `getBBox`).

3.  **Rendering Logic**:
    *   `use-render.js` (`UseRender.svelte`): A Svelte component (or hook-like structure) responsible for the actual rendering step. It takes the `VisualElement`'s `renderState` (styles, CSS variables, attributes) and applies them to the underlying DOM/SVG element. It also handles prop filtering to pass only valid HTML/SVG attributes.

4.  **Feature Bundling**:
    *   `featureBundle.js`: Aggregates all standard features (animations, gestures, drag, layout) into a single object. This bundle is likely used by the standard `motion` components to include all features by default.

5.  **Projection & Layout Animation**:
    *   The `projection` subdirectory contains the complex logic for `AnimateSharedLayout`. This includes measuring element bounding boxes, calculating deltas between layouts, applying scale correction to maintain visual consistency during transforms, and managing the projection tree.

6.  **Utilities**:
    *   The `utils` subdirectory provides helpers for DOM-specific tasks like CSS variable conversion, unit conversion (e.g., percentages to pixels for animations), prop filtering, and identifying SVG components.

7.  **Value Types**:
    *   The `value-types` subdirectory defines how different CSS properties should be interpreted and animated (e.g., numbers, pixels, colors, complex strings, "auto"). It provides default types and mechanisms for converting values for animation.

## Subdirectories

*   **`projection`**: Contains the core implementation for layout animations (`AnimateSharedLayout`), including measuring element bounding boxes, calculating deltas, and applying scale correction.
*   **`utils`**: Houses various utility functions crucial for DOM rendering, such as prop filtering, CSS variable handling, unit conversion, and identifying SVG elements.
*   **`value-types`**: Defines and manages different types of values that can be animated (e.g., numbers, pixels, percentages, colors, 'auto'), including how to parse, test, and get default fallback values for them.

## Svelte Components

*   **`M.svelte`**: A generic Svelte component used as the template for dynamically created `motion.<tag>` components by `motion-proxy.js`. It takes a `___tag` prop to define the element type.
*   **`UseRender.svelte`**: An internal Svelte component that takes the computed visual properties from a `VisualElement` and applies them to the actual DOM element. It also manages the `ref` for the DOM element.

## Key Files

*   **`motion.js`**: Exports the main `motion` factory for creating standard motion components (e.g., `motion.div`). It likely uses `createMotionComponent` and bundles all features from `featureBundle.js`.
*   **`motion-proxy.js`**: Exports `M` (often aliased as `m` for HTML tags like `m.div`), which is a proxy-based factory for creating motion components on-the-fly for any HTML/SVG tag.
*   **`create-visual-element.js`**: Factory function to get the correct `VisualElement` (`htmlVisualElement` or `svgVisualElement`).
*   **`svg-visual-element.js`**: Contains the specialized `VisualElement` implementation for SVG, handling SVG-specific attributes and measurement.

This directory forms a critical layer in `svelte-motion`, translating abstract animation and layout concepts into tangible updates on the web page.