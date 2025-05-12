# Svelte Motion `src/value` Directory Documentation

This directory is central to `svelte-motion`, containing the implementation of `MotionValue` and related hooks for creating and manipulating reactive values used in animations.

## Overview

`MotionValue` is the cornerstone of `svelte-motion`'s animation system. It's a reactive container for a single number, string (like colors or complex transforms), or complex value. Animations work by updating the value held within a `MotionValue`, and components subscribe to these updates to re-render. This directory provides the tools to create, transform, combine, and derive new `MotionValue`s from existing ones or other reactive sources.

## Files

*   **`index.js`**: The main entry point for the value module. It exports the core `motionValue` factory function used to create new `MotionValue` instances and likely the `MotionValue` class itself.
*   **`use-combine-values.js`**: Exports a hook (`useCombineValues`, although the name might differ slightly in implementation) that allows combining multiple `MotionValue`s into a single derived value, often used for complex transforms involving multiple animated properties.
*   **`use-motion-template.js`**: Exports the `useMotionTemplate` hook. This powerful hook takes a template literal string (like `translateX(${x}px)`) and interpolates `MotionValue`s into it, returning a new `MotionValue` that represents the combined string. This is essential for creating dynamic CSS properties like `transform` or `filter`.
*   **`use-motion-value.js`**: Exports the `useMotionValue` hook. This is the primary hook for creating a new `MotionValue` within a Svelte component's lifecycle, initializing it with a starting value.
*   **`use-spring.js`**: Exports the `useSpring` hook. This hook creates a `MotionValue` that animates using spring physics when its target value changes, rather than a duration-based easing. It accepts spring configuration options (stiffness, damping, mass).
*   **`use-transform.js`**: Exports the `useTransform` hook. This hook creates a new `MotionValue` whose value is derived by transforming the output of another `MotionValue` through a specified mapping (e.g., mapping a range `[0, 1]` to `[0, 100]` or `['0%', '100%']` or `['#fff', '#000']`). It's a declarative way to link motion values.
*   **`use-velocity.js`**: Exports the `useVelocity` hook. This hook creates a new `MotionValue` that tracks the velocity (rate of change) of another `MotionValue`. Useful for physics-based effects or triggering animations based on movement speed.

## Subdirectories

*   **`scroll`**: Contains hooks specifically designed to create `MotionValue`s linked to scroll progress. This includes tracking viewport scroll (`use-viewport-scroll.js`) and the scroll progress within a specific element (`use-element-scroll.js`).
*   **`utils`**: Provides utility functions specifically for working with `MotionValue`s. This might include functions for resolving the current value (`resolve-motion-value.js`), checking if something is a `MotionValue`, attaching transformers, or managing subscriptions.