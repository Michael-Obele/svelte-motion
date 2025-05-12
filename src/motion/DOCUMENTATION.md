# Svelte Motion `src/motion` Directory Documentation

This directory contains the core logic for creating and managing `motion` components in `svelte-motion`. These are the fundamental building blocks that enable animation and gesture capabilities on standard HTML and SVG elements.

## Overview

The primary responsibility of this directory is to provide the `createMotionComponent` factory function (exported via `index.js`), which takes a base element type (like 'div', 'span', 'svg', etc.) and enhances it with `svelte-motion`'s features. It also handles aspects like server-side rendering compatibility and feature loading.

## Files

*   **`index.js`**: The main entry point for the motion module. It likely exports the `createMotionComponent` function, which is used internally (e.g., by `Motion` and `M`) to generate motion-enabled components.

## Svelte Components

*   **`Motion.svelte`**: Could be a central Svelte component or logic module used by `createMotionComponent`. It might handle the integration of features, lifecycle management, and communication with the underlying `visualElement`.
*   **`MotionSSR.svelte`**: A Svelte component specifically designed to handle the rendering of motion components in a server-side rendering (SSR) context. It ensures that initial styles or states are correctly applied on the server without relying on browser APIs.

## Subdirectories

*   **`features`**: This directory likely contains modular implementations of different motion features, such as gesture handling (pan, tap, drag, hover), exit animations (`AnimatePresence`), layout animations (`AnimateSharedLayout`), and variant support. This modular structure might be used by `LazyMotion` to enable code-splitting and on-demand loading of features.
*   **`utils`**: Contains utility functions specifically related to the creation, configuration, and management of motion components. This might include prop validation (`valid-prop.js`), lifecycle management helpers, or feature integration logic.