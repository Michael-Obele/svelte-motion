# Svelte Motion `src/value/scroll` Directory Documentation

This directory contains hooks and utilities for creating `MotionValue`s that are linked to the scroll position of either the viewport or a specific DOM element.

## Overview

Scroll-linked animations are a common requirement in web design. The modules here provide an easy way to create reactive values (`MotionValue`s) that represent various aspects of scrolling, such as the current scroll offset (in pixels) and the scroll progress (a value from 0 to 1). These motion values can then be used with `useTransform` or `useMotionTemplate` to drive animations based on scroll.

## Key Files & Hooks

*   **`use-element-scroll.js`**:
    *   Exports the `useElementScroll` hook.
    *   **Purpose**: Creates `MotionValue`s that track the scroll position and progress of a specific scrollable HTML element.
    *   **Input**: Takes a Svelte `ref` object (e.g., `bind:this={elementRef}`) that points to the scrollable element.
    *   **Output**: Returns an object containing:
        *   `scrollX`: A `MotionValue` representing the horizontal scroll offset in pixels.
        *   `scrollY`: A `MotionValue` representing the vertical scroll offset in pixels.
        *   `scrollXProgress`: A `MotionValue` representing the horizontal scroll progress (0 to 1).
        *   `scrollYProgress`: A `MotionValue` representing the vertical scroll progress (0 to 1).
    *   **Usage Example**:
        ```svelte
        <script>
            import { motion, useElementScroll, useTransform } from 'svelte-motion';
            let scrollableElement;
            const { scrollYProgress } = useElementScroll(scrollableElement);
            const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0]);
        </script>

        <div bind:this={scrollableElement} style="height: 300px; overflow-y: scroll;">
            <div style="height: 900px;">
                <motion.div style={{ opacity }}>
                    Scroll me
                </motion.div>
            </div>
        </div>
        ```

*   **`use-viewport-scroll.js`**:
    *   Exports the `useViewportScroll` hook.
    *   **Purpose**: Creates `MotionValue`s that track the scroll position and progress of the browser's main viewport.
    *   **Input**: None.
    *   **Output**: Returns an object (typically a shared singleton) containing:
        *   `scrollX`: A `MotionValue` representing the window's horizontal scroll offset ( `window.pageXOffset`).
        *   `scrollY`: A `MotionValue` representing the window's vertical scroll offset ( `window.pageYOffset`).
        *   `scrollXProgress`: A `MotionValue` representing the window's horizontal scroll progress (0 to 1).
        *   `scrollYProgress`: A `MotionValue` representing the window's vertical scroll progress (0 to 1).
    *   **Usage Example**:
        ```svelte
        <script>
            import { motion, useViewportScroll, useTransform } from 'svelte-motion';

            const { scrollYProgress } = useViewportScroll();
            const scale = useTransform(scrollYProgress, [0, 1], [0.5, 2]);
        </script>

        <div style="height: 200vh;">
            <motion.div
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    width: '100px',
                    height: '100px',
                    backgroundColor: 'blue',
                    scale
                }}
            />
        </div>
        ```
    *   **Note**: For `scrollXProgress` and `scrollYProgress` to work correctly, the `<body>` element must have a discernible height/width greater than the viewport (i.e., it must actually be scrollable). Setting `height: 100%` on `html` and `body` can sometimes interfere with accurate page length measurement.

*   **`utils.js`**:
    *   Exports `createScrollMotionValues`: A factory function that initializes the four motion values (`scrollX`, `scrollY`, `scrollXProgress`, `scrollYProgress`). It can take an optional `startStopNotifier` for managing event listeners more efficiently when multiple scroll hooks are used.
    *   Exports `createScrollUpdater`: A factory function that returns an `update` function. This `update` function, when called (e.g., on a scroll or resize event), fetches the current scroll offsets (via a provided `getOffsets` callback) and updates the motion values accordingly.
    *   **Purpose**: These are internal utilities used by `useElementScroll` and `useViewportScroll` to manage the creation and updating of scroll-linked motion values.

## How it Works

Both `useElementScroll` and `useViewportScroll` operate on similar principles:
1.  **Initialization**: They use `createScrollMotionValues` to create the necessary `MotionValue` instances.
2.  **Event Listening**: They attach event listeners (e.g., `scroll`, `resize`) to the relevant target (either the specific element or the global `window`).
3.  **Offset Calculation**: A `getOffsets` function is defined to retrieve the current scroll offsets (`xOffset`, `yOffset`) and maximum scrollable dimensions (`xMaxOffset`, `yMaxOffset`) for the target.
4.  **Updating MotionValues**: The `createScrollUpdater` utility uses these offsets to:
    *   Set the `scrollX` and `scrollY` motion values directly to the pixel offsets.
    *   Calculate progress (offset / maxOffset) and set the `scrollXProgress` and `scrollYProgress` motion values (clamped between 0 and 1).
5.  **Lifecycle Management**: Event listeners are added on mount (or when the ref becomes available for `useElementScroll`) and removed on unmount to prevent memory leaks. For `useViewportScroll`, listeners are typically added once globally.

This setup allows developers to declaratively link animations to scroll behavior by simply consuming the reactive `MotionValue`s provided by these hooks.