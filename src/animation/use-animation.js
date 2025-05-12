/**
 * @file use-animation.js
 * @module svelte-motion/animation/use-animation
 * Provides the `useAnimation` hook for creating animation controls and
 * re-exports the {@link module:svelte-motion/animation/UseAnimation.svelte~UseAnimation} Svelte component
 * which wraps this hook for component-based usage.
 *
 * The `useAnimation` hook allows for imperative control over animations (start, stop, etc.),
 * while the `UseAnimation` component provides these controls through a slot.
 * This structure allows for flexible usage, either programmatically with the hook or
 * declaratively with the component.
 *
 * @example
 * ```javascript
 * // Using the hook directly in a Svelte script tag
 * import { useAnimation } from 'svelte-motion'; // or from 'svelte-motion/animation'
 * const controls = useAnimation();
 * function startMyAnimation() {
 *   controls.start({ x: 100, transition: { duration: 0.5 } });
 * }
 * ```
 *
 * @example
 * ```svelte
 * <!-- Using the UseAnimation component -->
 * <script>
 *   import { UseAnimation } from 'svelte-motion'; // or from 'svelte-motion/animation'
 *   // `controls` will be available from the slot
 * </script>
 *
 * <UseAnimation let:controls>
 *   <div animate={controls} />
 *   <button on:click={() => controls.start({ scale: 1.2 })}>Animate</button>
 * </UseAnimation>
 * ```
 */

/** 
based on framer-motion@4.0.3,
Copyright (c) 2018 Framer B.V.
*/

import { tick } from "svelte";
import { animationControls } from "./animation-controls"

/**
 * Creates `AnimationControls`, which can be used to manually start, stop
 * and sequence animations on one or more components.
 *
 * The returned `AnimationControls` should be passed to the `animate` property
 * of the components you want to animate.
 *
 * These components can then be animated with the `start` method.
 *
 * @library
 *
 * ```jsx
 * import * as React from 'react'
 * import { Frame, useAnimation } from 'framer'
 *
 * export function MyComponent(props) {
 *    const controls = useAnimation()
 *
 *    controls.start({
 *        x: 100,
 *        transition: { duration: 0.5 },
 *    })
 *
 *    return <Frame animate={controls} />
 * }
 * ```
 *
 * @motion
 *
 * ```jsx
 * import * as React from 'react'
 * import { motion, useAnimation } from 'framer-motion'
 *
 * export function MyComponent(props) {
 *    const controls = useAnimation()
 *
 *    controls.start({
 *        x: 100,
 *        transition: { duration: 0.5 },
 *    })
 *
 *    return <MotionDiv animate={controls} />
 * }
 * ```
 *
 * @returns Animation controller with `start` and `stop` methods
 *
 * @public
 */
export const useAnimation = () =>{

    const controls =  animationControls(()=>{

        const cleanup = {}
        tick().then(v => cleanup.clean = controls.mount());
        return ()=>{
            cleanup.clean?.();
        }
    });

    return controls;
}



export { default as UseAnimation } from "./UseAnimation.svelte";
