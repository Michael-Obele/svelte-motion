# Svelte Motion `src/animation` Directory Documentation

This directory contains the core logic for creating, controlling, and managing animations within the `svelte-motion` library.

## Overview

The modules in this directory provide the fundamental building blocks for animating values and visual elements. This includes functions to start animations, hooks to manage animation state and controls declaratively, and utilities to support the animation process.

## Files

*   **`animate.js`**: Exports the primary `animate` function. This function is the core imperative API for creating animations between values or states. It likely handles the underlying animation loop, timing, and easing.
*   **`animation-controls.js`**: Exports the `animationControls` factory function. This creates an object (`AnimationControls`) that allows for imperative control over animations (e.g., starting, stopping, defining variants).
*   **`use-animated-state.js`**: Exports the `useAnimatedState` hook. This hook is likely used internally or potentially exposed for advanced use cases to manage state specifically tied to an animation's lifecycle.
*   **`use-animation.js`**: Exports the `useAnimation` hook. This hook provides a declarative way to bind `AnimationControls` to a component, allowing animations to be triggered based on component state or props. It's often used with variants.

## Svelte Components

*   **`UseAnimatedState.svelte`**: A Svelte component potentially wrapping the `useAnimatedState` hook logic, possibly for internal use within other components.
*   **`UseAnimation.svelte`**: A Svelte component likely wrapping the `useAnimation` hook, providing a component-based interface for animation controls.

## Subdirectories

*   **`utils`**: Contains utility functions specifically designed to support the animation logic within this directory, such as functions for calculating animation parameters or managing animation sequences.