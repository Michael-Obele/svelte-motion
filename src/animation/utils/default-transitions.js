/**
 * @file default-transitions.js
 * @module svelte-motion/animation/utils/default-transitions
 *
 * @description
 * This module provides a set of pre-defined default transition configurations for common CSS properties.
 * It aims to offer sensible animation defaults (like springs for positional changes and tweens for opacity)
 * when no specific transition is provided by the user. This is based on the concepts from
 * Framer Motion to ensure a consistent and natural feel for animations out-of-the-box.
 *
 * It includes functions to generate different types of spring and tween transitions,
 * and a primary function `getDefaultTransition` which selects an appropriate default
 * transition based on the property being animated and its target value (e.g., if it's a keyframe animation).
 *
 * The main exports are:
 * - `criticallyDampedSpring`: A function that returns a configuration for a critically damped spring.
 * - `underDampedSpring`: A function that returns a configuration for an under-damped spring.
 * - `linearTween`: A function that returns a configuration for a linear tween animation.
 * - `getDefaultTransition`: A function that retrieves a default transition configuration for a given value key and target.
 *
 * These utilities are used internally by `svelte-motion` to fill in transition details when
 * users don't specify them, simplifying the animation setup process.
 *
 * Original inspiration and structure from framer-motion.
 * Copyright (c) 2018 Framer B.V.
 */

import { __assign } from 'tslib';
import { isKeyframesTarget } from './is-keyframes-target.js';

var underDampedSpring = function () { return ({
    type: "spring",
    stiffness: 500,
    damping: 25,
    restDelta: 0.5,
    restSpeed: 10,
}); };
var criticallyDampedSpring = function (to) { return ({
    type: "spring",
    stiffness: 550,
    damping: to === 0 ? 2 * Math.sqrt(550) : 30,
    restDelta: 0.01,
    restSpeed: 10,
}); };
var linearTween = function () { return ({
    type: "keyframes",
    ease: "linear",
    duration: 0.3,
}); };
var keyframes = function (values) { return ({
    type: "keyframes",
    duration: 0.8,
    values: values,
}); };
var defaultTransitions = {
    x: underDampedSpring,
    y: underDampedSpring,
    z: underDampedSpring,
    rotate: underDampedSpring,
    rotateX: underDampedSpring,
    rotateY: underDampedSpring,
    rotateZ: underDampedSpring,
    scaleX: criticallyDampedSpring,
    scaleY: criticallyDampedSpring,
    scale: criticallyDampedSpring,
    opacity: linearTween,
    backgroundColor: linearTween,
    color: linearTween,
    default: criticallyDampedSpring,
};
var getDefaultTransition = function (valueKey, to) {
    var transitionFactory;
    if (isKeyframesTarget(to)) {
        transitionFactory = keyframes;
    }
    else {
        transitionFactory =
            defaultTransitions[valueKey] || defaultTransitions.default;
    }
    return __assign({ to: to }, transitionFactory(to));
};

export { criticallyDampedSpring, getDefaultTransition, linearTween, underDampedSpring };
