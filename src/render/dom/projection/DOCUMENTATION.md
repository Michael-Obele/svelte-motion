# Svelte Motion `src/render/dom/projection` Directory Documentation

This directory is a critical part of `svelte-motion`'s layout animation system (`AnimateSharedLayout`). It deals with the complex task of "projecting" an element from one visual state (bounding box, scale, rotation) to another, making it appear as if it's smoothly transitioning, even if its underlying DOM structure or position in the tree changes.

## Overview

Layout projection involves:
1.  **Measuring**: Accurately measuring the bounding boxes of elements.
2.  **Calculating Deltas**: Determining the difference (in position, size, and scale) between an element's current layout and its target layout.
3.  **Scale Correction**: Adjusting certain style properties (like `borderRadius`, `boxShadow`) so they appear consistent even when the element itself is scaled during the projection.
4.  **Applying Transforms**: Generating and applying CSS transforms (`translateX`, `translateY`, `scaleX`, `scaleY`) to visually move and resize the element from its "natural" layout position to its "projected" target position.

This allows for "magic motion" effects where elements seem to animate seamlessly between different states or positions in the UI.

## Key Files & Concepts

*   **`measure.js`**:
    *   Exports `getBoundingBox`: A utility to measure the `ClientRect` of a DOM element. It can optionally take a `transformPagePoint` function to correct measurements if the element is within a scaled container (e.g., a device preview).
    *   **Usage**: Used by `VisualElement` to get the initial layout of an element before projection calculations.

*   **`utils.js`**:
    *   Exports `collectProjectingAncestors`: Traverses up the `VisualElement` tree to find all parent elements that are also involved in layout projection.
    *   Exports `collectProjectingChildren`: Traverses down to find all child elements involved in layout projection.
    *   Exports `updateLayoutMeasurement`: Measures the DOM layout of a `VisualElement` after its layout-affecting transforms have been reset. It notifies listeners (`onBeforeLayoutMeasure`, `onLayoutMeasure`) and updates the element's `layoutState`.
    *   Exports `snapshotViewportBox`: Records the current viewport box of a `VisualElement` (usually before an expected mutation or re-render) into `prevViewportBox`. This "snapshot" is then used as the origin for layout animations.
    *   **Usage**: These are core utilities for managing the layout tree and timing measurements correctly during the batched layout process initiated by `AnimateSharedLayout`.

*   **`default-scale-correctors.js`**:
    *   Exports `defaultScaleCorrectors`: An object mapping style properties (like `borderRadius`, `boxShadow`) to functions that correct their values during projection.
    *   Exports `correctBorderRadius`: A function that converts pixel-based `borderRadius` values to percentages relative to the element's size. This ensures the radius scales proportionally with the element, preventing distortion.
    *   Exports `correctBoxShadow`: A function that adjusts the offset, blur, and spread of `boxShadow` values to account for the element's scale, maintaining the shadow's intended appearance.
    *   **Usage**: These correctors are applied by the `VisualElement`'s `build` process when layout projection is active.

*   **`scale-correction.js`**:
    *   Exports `valueScaleCorrection`: An object that stores the registered scale corrector functions.
    *   Exports `addScaleCorrection`: A function to add new scale correctors to the `valueScaleCorrection` map.
    *   **Usage**: Allows `svelte-motion` (and potentially users) to define how specific style properties should behave under scale transformations during projection.

*   **`convert-to-relative.js`**:
    *   Exports `convertToRelativeProjection`: A function that converts a `VisualElement`'s projection target from viewport-relative coordinates to coordinates relative to its projection parent. This is crucial when a layout-animated element is also part of a draggable group or when nesting `AnimateSharedLayout` components.
    *   **Usage**: Ensures that projections are calculated correctly within nested transformed contexts.

*   **`relative-set.js`**:
    *   Exports `setCurrentViewportBox`: When a `VisualElement` is not animating its layout but its parent might be, this function helps to re-calculate its projection target based on its current relative offset from its parent. This keeps non-animating children correctly positioned relative to an animating parent.
    *   **Usage**: Helps maintain layout integrity for children of layout-animating elements.

## How Projection Works (Simplified)

1.  **Snapshotting**: Before a layout change (e.g., a component re-renders, `AnimatePresence` removes an item, or a `layoutId` element moves), `AnimateSharedLayout` triggers a process. `snapshotViewportBox` is called on relevant elements to record their current on-screen position and size (`prevViewportBox`).
2.  **Reset & Measure**:
    *   Layout-affecting transforms on all participating elements are temporarily reset.
    *   `updateLayoutMeasurement` is called to get the "natural" DOM layout of each element in its new state/position (`layoutState.layout`).
3.  **Calculate Projection**:
    *   The `VisualElement` calculates the delta (difference in position and scale) between its `prevViewportBox` (where it was) and its `layoutState.layout` (where the DOM now places it without projection transforms).
    *   If it's animating to a `layoutId` target provided by `AnimateSharedLayout`, that target box is used instead of `prevViewportBox`.
4.  **Apply Projection Transform**:
    *   A CSS `transform` is generated (see `render/html/utils/build-projection-transform.js`) to visually "project" the element from its natural `layoutState.layout` to appear as if it's at the `prevViewportBox` (or `layoutId` target).
5.  **Animate Projection**: The `MotionValue`s controlling this projection transform (often internal to the `VisualElement`'s `projection` state) are then animated from this "projected" state towards a neutral state (identity transform), making the element smoothly animate to its new natural layout.
6.  **Scale Correction**: During this animation, if the element scales, `defaultScaleCorrectors` are applied to properties like `borderRadius` to ensure they look correct.

This complex process, managed largely by `AnimateSharedLayout` and the `VisualElement`'s projection capabilities, creates the fluid layout animations characteristic of libraries like Framer Motion.