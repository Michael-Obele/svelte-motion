# Svelte Motion `src/components` Directory Documentation

This directory houses high-level Svelte components that provide specific animation features and abstractions for users of the `svelte-motion` library.

## Overview

Components in this directory encapsulate complex animation logic, offering declarative ways to achieve common animation patterns like enter/exit transitions, shared element transitions, and configuration scoping.

## Subdirectories

*   **`AnimatePresence`**: Contains the implementation for the `AnimatePresence` component. This component is crucial for managing animations when components are added to or removed from the Svelte component tree. It enables enter and exit animations.
*   **`AnimateSharedLayout`**: Holds the logic for the `AnimateSharedLayout` component. This component enables "magic motion" or layout animations, allowing elements to smoothly animate between different positions or sizes across unrelated components, identified by a shared `layoutId`.
*   **`LazyMotion`**: Implements the `LazyMotion` component, likely designed to optimize bundle size by allowing features (like specific gestures or animations) to be loaded on demand rather than included in the initial bundle.
*   **`MotionConfig`**: Contains the `MotionConfig` component. This component allows users to define default animation properties (like transitions) for all descendant `motion` components within its scope, simplifying configuration and ensuring consistency.

## Files

*   **`MotionDiv.svelte`**: A pre-built Svelte component that wraps a standard HTML `div` element with motion capabilities. It serves as a convenient shorthand or base component for creating animated divs.