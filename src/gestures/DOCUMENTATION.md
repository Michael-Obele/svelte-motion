# Svelte Motion `src/gestures` Directory Documentation

This directory is responsible for recognizing and handling user input gestures like tap, pan, hover, focus, and drag within `svelte-motion`.

## Overview

Gestures are detected by attaching event listeners (often pointer events handled by the `src/events` directory) and interpreting the sequence and properties of these events. The hooks and components provided here allow `motion` components to react declaratively to these gestures, typically by animating to specific visual states (variants).

## Files

*   **`PanSession.js`**: Exports a class or functions (`PanSession`) to manage the state and logic throughout a pan gesture lifecycle, from initiation to completion or cancellation. It processes pointer events to calculate offset and velocity.
*   **`use-focus-gesture.js`**: Exports the `useFocusGesture` hook. This hook attaches focus and blur event listeners to an element to detect when it gains or loses focus, enabling `:focus`-like interactions tied to animations.
*   **`use-gestures.js`**: Exports the `useGestures` hook. This is likely a high-level hook that conditionally applies the individual gesture hooks (`useTapGesture`, `usePanGesture`, etc.) based on the event handler props passed to a `motion` component (e.g., `onTap`, `onPan`, `whileHover`).
*   **`use-hover-gesture.js`**: Exports the `useHoverGesture` hook. This hook manages hover interactions (pointer enter/leave) and triggers corresponding animations or callbacks (e.g., `whileHover`, `onHoverStart`, `onHoverEnd`).
*   **`use-pan-gesture.js`**: Exports the `usePanGesture` hook. This hook implements the core logic for detecting panning gestures, handling pointer down, move, and up events, and providing session updates (offset, velocity) via callbacks (`onPan`, `onPanStart`, etc.).
*   **`use-tap-gesture.js`**: Exports the `useTapGesture` hook. This hook detects tap gestures (a quick pointer down and up on an element) and handles cancellation logic (e.g., if the pointer moves too far). It triggers callbacks like `onTap` and `whileTap`.

## Svelte Components

*   **`UseFocusGesture.svelte`**: A Svelte component wrapper for the `useFocusGesture` hook logic.
*   **`UseGestures.svelte`**: A Svelte component likely wrapping the main `useGestures` hook.
*   **`UseHoverGesture.svelte`**: A Svelte component wrapper for the `useHoverGesture` hook.
*   **`UsePanGesture.svelte`**: A Svelte component wrapper for the `usePanGesture` hook.
*   **`UseTapGesture.svelte`**: A Svelte component wrapper for the `useTapGesture` hook.

## Subdirectories

*   **`drag`**: Contains the implementation specific to drag gestures, which build upon pan gestures but often involve constraints and controls (`DragControls`). Includes files like `use-drag-controls.js`.
*   **`utils`**: Holds utility functions specifically tailored for gesture recognition and handling logic within this directory.