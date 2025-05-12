/**
 * @file easing.js
 * @module svelte-motion/animation/utils/easing
 * @description
 * This module provides utility functions for handling easing definitions within `svelte-motion`.
 * It primarily converts easing definitions—which can be strings (e.g., "linear", "easeIn"),
 * arrays of four numbers (for cubic bezier curves like `[0.42, 0, 0.58, 1]`), or arrays of
 * such definitions (for sequence easing)—into their corresponding callable functions,
 * primarily sourced from the Popmotion library.
 *
 * This abstraction allows users of `svelte-motion` to specify easing in a flexible,
 * declarative manner, similar to how it's done in Framer Motion.
 *
 * Key exports:
 * - `easingDefinitionToFunction(definition)`: Takes an easing definition (string, array of numbers,
 *   or a direct function) and returns the corresponding easing function from Popmotion or the function itself.
 * - `isEasingArray(ease)`: A type guard to check if an easing definition is an array of multiple
 *   easing functions (potentially for sequenced or staggered animations).
 *
 * The module relies on Popmotion for the actual easing algorithms.
 *
 * Original inspiration and structure from framer-motion.
 * Copyright (c) 2018 Framer B.V.
 */
import {fixed} from '../../utils/fix-process-env';
import { __read } from 'tslib';
import { cubicBezier, linear, easeIn, easeInOut, easeOut, circIn, circInOut, circOut, backIn, backInOut, backOut, anticipate, bounceIn, bounceInOut, bounceOut } from 'popmotion';
//import { invariant } from 'hey-listen';

var easingLookup = {
    linear: linear,
    easeIn: easeIn,
    easeInOut: easeInOut,
    easeOut: easeOut,
    circIn: circIn,
    circInOut: circInOut,
    circOut: circOut,
    backIn: backIn,
    backInOut: backInOut,
    backOut: backOut,
    anticipate: anticipate,
    bounceIn: bounceIn,
    bounceInOut: bounceInOut,
    bounceOut: bounceOut,
};
var easingDefinitionToFunction = function (definition) {
    if (Array.isArray(definition)) {
        // If cubic bezier definition, create bezier curve
        //invariant(definition.length === 4, "Cubic bezier arrays must contain four numerical values.");
        var _a = __read(definition, 4), x1 = _a[0], y1 = _a[1], x2 = _a[2], y2 = _a[3];
        return cubicBezier(x1, y1, x2, y2);
    }
    else if (typeof definition === "string") {
        // Else lookup from table
        //invariant(easingLookup[definition] !== undefined, "Invalid easing type '" + definition + "'");
        return easingLookup[definition];
    }
    return definition;
};
var isEasingArray = function (ease) {
    return Array.isArray(ease) && typeof ease[0] !== "number";
};

export { easingDefinitionToFunction, isEasingArray };
