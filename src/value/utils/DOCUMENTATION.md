# Svelte Motion `src/value/utils` Directory Documentation

This directory contains utility functions specifically designed to work with `MotionValue` instances within the `svelte-motion` library.

## Overview

These utilities provide common helper functionalities for inspecting and resolving `MotionValue`s, which are the core reactive primitives used for tracking and animating values in `svelte-motion`.

## Files

*   **`is-motion-value.js`**:
    *   Exports the `isMotionValue` function.
    *   **Purpose**: This is a type guard function that checks if a given variable is an instance of a `MotionValue`. It typically does this by checking for the presence of a unique method or property on the `MotionValue` class (e.g., the `getVelocity` method).
    *   **Input**: Any variable.
    *   **Output**: `true` if the variable is a `MotionValue`, `false` otherwise.
    *   **Usage Example**:
        ```javascript
        import { motionValue, isMotionValue } from 'svelte-motion';

        const val = motionValue(0);
        const staticVal = 100;

        console.log(isMotionValue(val)); // true
        console.log(isMotionValue(staticVal)); // false
        ```
    *   **Importance**: Useful internally to determine how to handle a prop or value—whether to subscribe to its changes (if it's a `MotionValue`) or treat it as a static value.

*   **`resolve-motion-value.js`**:
    *   Exports the `resolveMotionValue` function.
    *   **Purpose**: This function takes a value and, if it's a `MotionValue`, returns its current underlying value (by calling its `.get()` method). If it's not a `MotionValue`, it returns the value itself. It also handles custom value types that might have a `toValue()` method for extracting a primitive.
    *   **Input**: Any variable (can be a `MotionValue`, a primitive, or a custom value type).
    *   **Output**: The primitive value held by the `MotionValue`, or the input value if it's not a `MotionValue` or a recognized custom value type.
    *   **Usage Example**:
        ```javascript
        import { motionValue, resolveMotionValue } from 'svelte-motion';

        const mv = motionValue(100);
        const staticNum = 50;
        const customValue = { get: () => "20px", toValue: () => "20px", mix: (a,b,p)=>p > 0.5 ? b : a, // simplified example
            getVelocity: () => 0
         }; // Simplified custom value type

        console.log(resolveMotionValue(mv)); // 100
        console.log(resolveMotionValue(staticNum)); // 50

        // Assuming customValue is treated as a MotionValue due to .get() and .getVelocity()
        // and also has a .toValue() method.
        // If customValue were a plain object without being a MotionValue but having .toValue():
        // console.log(resolveMotionValue(customValue)); // "20px" (if isCustomValue(customValue) is true)
        
        // More practically, if it's wrapped:
        const customMV = motionValue(customValue);
        console.log(resolveMotionValue(customMV)); // "20px" (because customMV.get() returns customValue, then customValue.toValue() is called)
        ```
    *   **Importance**: Essential for reading the current state of a value that might be reactive or static, providing a unified way to access the underlying data for rendering or calculations.

These utilities ensure robust and consistent handling of `MotionValue`s throughout the library.