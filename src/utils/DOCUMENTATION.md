# Svelte Motion `src/utils` Directory Documentation

This directory contains a collection of general-purpose utility functions, hooks, and constants used across various modules within the `svelte-motion` library.

## Overview

The utilities here provide common functionalities that are not specific to a single feature like animation, gestures, or rendering, but are needed by multiple parts of the library. This includes helpers for environment detection, data manipulation, state management, and common Hook patterns adapted for Svelte.

## Files

*   **`array.js`**: Provides utility functions for working with arrays.
*   **`each-axis.js`**: Exports a helper function (`eachAxis`) to simplify iterating over operations for both 'x' and 'y' axes, commonly used in positioning and transform logic.
*   **`fix-process-env.js`**: Contains code to shim or polyfill `process.env`, ensuring compatibility in environments where it might not be standard (like some browser bundlers).
*   **`is-browser.js`**: Exports a boolean constant or function (`isBrowser`) indicating whether the code is currently running in a browser environment or on the server (SSR).
*   **`is-numerical-string.js`**: Exports a function to check if a given string represents a numerical value.
*   **`is-ref-object.js`**: Exports a type guard function to check if a value conforms to the structure of a React-like ref object ( `{ current: ... }`). Its usage in Svelte might be for compatibility or specific internal patterns.
*   **`noop.js`**: Exports a simple function (`noop`) that performs no operation. Useful as a default callback or placeholder.
*   **`resolve-value.js`**: Exports a function (`resolveValue`) to handle values that can be either direct values or functions returning values, evaluating the function if necessary.
*   **`shallow-compare.js`**: Exports a function (`shallowCompare`) for performing a shallow comparison between two arrays or objects.
*   **`subscription-manager.js`**: Provides a class or factory (`SubscriptionManager`) for managing multiple subscription/unsubscription functions, often used with `MotionValue`s.
*   **`time-conversion.js`**: Contains utility functions for converting between different time units (e.g., seconds to milliseconds).
*   **`transform.js`**: Exports the powerful `transform` function, used for mapping an input value from one range or set of values/colors/strings to an output range or set, supporting interpolation and complex value types.
*   **`use-constant.js`**: Exports a hook (`useConstant`) that initializes and returns a constant value (often using a factory function) only once during the component's lifecycle.
*   **`use-cycle.js`**: Exports the `useCycle` hook, which allows cycling through a predefined array of states or values, returning the current state and a function to advance to the next one.
*   **`use-force-update.js`**: Exports a hook (`useForceUpdate`) that provides a function to manually trigger a re-render of the component. (Use with caution in Svelte).
*   **`use-isomorphic-effect.js`**: Exports a hook (`useIsomorphicEffect`) that behaves like `useLayoutEffect` in the browser (running synchronously after DOM mutations) and `useEffect` on the server (running after render but before commit), preventing SSR warnings.
*   **`use-reduced-motion.js`**: Exports a hook (`useReducedMotion`) that detects the user's operating system preference for reduced motion and returns a boolean or the `MotionValue` representing this preference.
*   **`use-unmount-effect.js`**: Exports a hook (`useUnmountEffect`) that registers a cleanup function to be run only when the component is unmounted.

## Svelte Components

*   **`UseUnmountEffect.svelte`**: A Svelte component wrapper for the `useUnmountEffect` hook logic.

## Subdirectories

*   **`geometry`**: Contains utility functions and types related to geometric calculations, such as points, bounding boxes, and distance calculations, often used in layout animations and gesture handling.