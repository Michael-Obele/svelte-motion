# Svelte Motion `src/gestures/drag` Directory Documentation

This directory contains the implementation for drag gesture recognition and control within `svelte-motion`.

## Overview

Drag gestures allow users to move elements around the screen by clicking/touching and dragging. This directory builds upon the lower-level pan gesture (`src/gestures/use-pan-gesture.js`) but adds features specific to dragging, such as constraints (limiting movement), drag controls (programmatic dragging), and propagation control.

## Files & Components

*   **`use-drag.js`**: Exports the primary `useDrag` hook. This hook is applied to a `motion` component (usually internally via `use-gestures.js`) when drag-related props (`drag`, `dragConstraints`, `onDrag`, etc.) are provided. It manages the drag gesture lifecycle, calculates the element's position based on user input and constraints, and updates the corresponding `MotionValue`s (x, y).
*   **`use-drag-controls.js`**: Exports the `useDragControls` hook and the `DragControls` class. This allows developers to create drag control instances (`DragControls`) that can be used to programmatically initiate a drag gesture on a linked `motion` component, typically triggered by interaction with a separate element (like a drag handle).
*   **`VisualElementDragControls.js`**: A class or module that likely bridges the gap between the abstract `DragControls` and the specific `visualElement` implementation. It handles attaching the necessary pointer event listeners to the target element when a programmatic drag is initiated via `DragControls`.
*   **`UseDrag.svelte`**: A Svelte component wrapper for the `useDrag` hook logic, possibly used internally.
*   **`UseDragControls.svelte`**: A Svelte component potentially related to using or providing `DragControls`.

## Subdirectories

*   **`utils`**: Contains utility functions specifically tailored for drag gesture logic, such as calculating constraints, managing drag propagation, or handling drag elasticity.