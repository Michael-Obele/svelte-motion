# Svelte Motion `src/animation/utils` Directory Documentation

This directory contains utility functions specifically supporting the core animation logic found in the parent `src/animation` directory.

## Overview

These utilities help with tasks like defining default behaviors, providing easing functions, type checking, and handling different animation target formats (single values vs. keyframes).

## Files

*   **`default-transitions.js`**: Exports default transition definitions (e.g., duration, easing) that `svelte-motion` uses when a specific transition isn't provided for an animation. This ensures consistent default animation behavior.
*   **`easing.js`**: Provides a collection of standard easing functions (like `linear`, `easeIn`, `easeInOut`, `circIn`, etc.) used to control the rate of change during an animation. It might also include functions for custom bezier curves.
*   **`is-animatable.js`**: Exports a utility function (`isAnimatable`) that determines whether a given CSS property or value type is suitable for animation by the library. This helps filter out non-animatable properties.
*   **`is-animation-controls.js`**: Exports a type guard function (`isAnimationControls`) to check if a given object is an instance of the `AnimationControls` class created by `animationControls()`.
*   **`is-keyframes-target.js`**: Exports a utility function (`isKeyframesTarget`) to check if an animation target value is an array, indicating it represents a sequence of keyframes rather than a single target value.
*   **`transitions.js`**: Contains potentially more advanced transition-related utilities or types. This might involve logic for handling variant transitions, orchestrating animations (like `staggerChildren`, `delayChildren`), or resolving complex transition definitions.