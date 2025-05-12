/**
 * @file is-animatable.js
 * @module svelte-motion/animation/utils/is-animatable
 * @description
 * This module provides a utility function `isAnimatable` to determine whether a given
 * CSS property value can be animated smoothly.
 *
 * It checks various conditions:
 * - Certain properties like `zIndex` are explicitly excluded.
 * - Numbers and arrays (assumed to be keyframes) are considered animatable.
 * - Strings are checked if they represent complex animatable values (e.g., "100px", "#fff", "rgba(...)")
 *   and are not URL values (e.g., "url(...)").
 *
 * This utility is crucial for the animation engine to decide if it can interpolate
 * between a starting and ending value for a property, or if it should apply the change
 * instantaneously.
 *
 * The `@internal` tag on the `isAnimatable` function suggests it's primarily for
 * internal use within the `svelte-motion` library.
 *
 * Original inspiration and structure from framer-motion.
 * Copyright (c) 2018 Framer B.V.
 */
import {fixed} from '../../utils/fix-process-env';
import { complex } from 'style-value-types';

/**
 * Check if a value is animatable. Examples:
 *
 * ✅: 100, "100px", "#fff"
 * ❌: "block", "url(2.jpg)"
 * @param value
 *
 * @internal
 */
var isAnimatable = function (key, value) {
    // If the list of keys tat might be non-animatable grows, replace with Set
    if (key === "zIndex")
        return false;
    // If it's a number or a keyframes array, we can animate it. We might at some point
    // need to do a deep isAnimatable check of keyframes, or let Popmotion handle this,
    // but for now lets leave it like this for performance reasons
    if (typeof value === "number" || Array.isArray(value))
        return true;
    if (typeof value === "string" && // It's animatable if we have a string
        complex.test(value) && // And it contains numbers and/or colors
        !value.startsWith("url(") // Unless it starts with "url("
    ) {
        return true;
    }
    return false;
};

export { isAnimatable };
