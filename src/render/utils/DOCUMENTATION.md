# Svelte Motion `src/render/utils` Directory Documentation

This directory contains a suite of utility functions and types that support the core rendering and animation logic across different renderers (DOM, HTML, SVG) within `svelte-motion`.

## Overview

These utilities provide common functionalities essential for managing animation states, lifecycles, motion values, projection calculations, and variant resolution. They are foundational tools used by the `VisualElement` implementations and feature modules.

## Key Responsibilities & Files

*   **Animation State Management (`animation-state.js`)**:
    *   Exports `createAnimationState`: A factory function that creates an animation state manager for a `VisualElement`. This manager tracks active animation types (e.g., "animate", "hover", "tap", "exit"), their definitions, and orchestrates animations based on a priority order.
    *   Exports `variantPriorityOrder`: An array defining the precedence of different animation types (e.g., "exit" animations might override "hover" animations).
    *   Exports `variantsHaveChanged`: A utility to compare previous and next variant definitions to see if an animation needs to be triggered.
    *   **Usage**: Used internally by `VisualElement` to manage and trigger animations based on props like `animate`, `whileHover`, `exit`, etc.

*   **Animation Control (`animation.js`)**:
    *   Exports `animateVisualElement`: The primary function for initiating an animation on a `VisualElement`. It takes the element, a definition (variant label, target object, or array of these), and options, then orchestrates the animation.
    *   Exports `stopAnimation`: Stops all active animations on a `VisualElement`.
    *   Exports `sortByTreeOrder`: A utility for sorting visual elements based on their DOM tree order, used for staggering animations.
    *   **Usage**: Called by the animation state manager or directly when imperative animation control is needed.

*   **Node Comparison (`compare-by-depth.js`)**:
    *   Exports `compareByDepth`: A comparison function used to sort `VisualElement` instances based on their depth in the component tree. Useful for ensuring parent animations/updates happen before child animations/updates in some scenarios.

*   **Tree Management (`flat-tree.js`)**:
    *   Exports `FlatTree`: A class for managing a flattened list of `VisualElement` nodes, typically used by `AnimateSharedLayout` to keep track of all elements participating in layout animations within its scope. It ensures the list is sorted by depth and handles additions/removals efficiently.

*   **Draggability Check (`is-draggable.js`)**:
    *   Exports `isDraggable`: A utility function to determine if a `VisualElement` is configured to be draggable (i.e., has the `drag` prop set and is not using external `_dragX`/`_dragY` motion values).

*   **Lifecycle Management (`lifecycles.js`)**:
    *   Exports `createLifecycles`: A factory function that creates a lifecycle manager for a `VisualElement`. This manager handles subscriptions for various events like `onUpdate`, `onRender`, `onAnimationStart`, `onAnimationComplete`, `onLayoutMeasure`, `onViewportBoxUpdate`, etc. It allows different parts of the system to hook into these lifecycle events.
    *   **Usage**: Each `VisualElement` instance has its own lifecycle manager.

*   **Motion Value Handling (`motion-values.js`)**:
    *   Exports `updateMotionValuesFromProps`: A function that updates a `VisualElement`'s internal `MotionValue` map based on new props. It handles adding new motion values, removing old ones, and updating existing ones if they are not currently being animated.

*   **Projection Utilities (`projection.js`)**:
    *   Exports `updateLayoutDeltas`: A function that calculates the deltas (translation, scale) required to project a `VisualElement` from its actual layout position to its target layout position, considering parent transformations. This is a core part of layout animations.

*   **Value Setters (`setters.js`)**:
    *   Exports `setTarget`: Sets a `VisualElement`'s state to a specific target definition (without animation).
    *   Exports `setValues`: Sets a `VisualElement`'s state based on variant labels or a target definition.
    *   Exports `checkTargetForNewValues`: Ensures that if an animation target includes new style properties not previously on the `VisualElement`, their initial values are read from the DOM (or defaults) before animation begins.
    *   Exports `getOrigin`: Calculates the origin (starting state) for an animation based on the target, transition, and current `VisualElement` state.

*   **State Initialization (`state.js`)**:
    *   Exports `createProjectionState`: Returns an initial state object for layout projection (e.g., `target`, `targetFinal`).
    *   Exports `createLayoutState`: Returns an initial state object for layout measurements (e.g., `layout`, `layoutCorrected`, `delta`).
    *   Exports `zeroLayout`: A pre-defined layout state representing no layout (all zeros).

*   **Animation Types (`types.js`)**:
    *   Exports the `AnimationType` enum: Defines string constants for different types of animations (`Animate`, `Hover`, `Tap`, `Drag`, `Focus`, `Exit`). Used by the animation state manager.

*   **Variant Resolution (`variants.js`)**:
    *   Exports `resolveVariant`: Takes a `VisualElement` and a variant definition (label, object, or function) and resolves it to a target object. If the definition is a function, it's called with `custom` props and current/velocity values.
    *   Exports `isVariantLabel`, `isVariantLabels`: Type guards to check if a value is a variant label or an array of labels.
    *   Exports `checkIfControllingVariants`, `checkIfVariantNode`: Utilities to determine if a component's props indicate it's controlling (or part of) a variant animation tree.
    *   **Usage Example**:
        ```javascript
        // Assuming visualElement has variants defined in its props:
        // props.variants = {
        //   hidden: { opacity: 0 },
        //   visible: (custom) => ({ opacity: custom, x: 100 })
        // }
        const resolvedTarget = resolveVariant(visualElement, "visible", 0.5);
        // resolvedTarget would be { opacity: 0.5, x: 100 }
        ```

These utilities form a robust toolkit that underpins the rendering and animation capabilities of `svelte-motion`, promoting code reuse and separation of concerns.