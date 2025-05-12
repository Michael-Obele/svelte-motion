<script context="module">
  /**
   * @file UseAnimatedState.svelte
   * @component
   * Provides a way to manage and animate state that isn't directly tied to a DOM element.
   * Useful for animating state variables or data structures. It leverages the internal
   * `visualElement` concept but adapted for abstract state management.
   *
   * @property {any} initialState - The initial state for the animation.
   *
   * @slot {{ animatedState: [any, (animationDefinition: any) => Promise<any>], state: any }} default - Default slot providing the animated state and a function to start animations.
   * @slot_prop {Array<any, (animationDefinition: any) => Promise<any>>} animatedState - A tuple containing the current animation state and the `startAnimation` function.
   * @slot_prop {any} state - The underlying visual state managed by `UseVisualState`.
   *
   * @example
   * ```svelte
   * <script>
   *   import { UseAnimatedState } from 'svelte-motion';
   *
   *   let initialState = { opacity: 0, scale: 0.5 };
   *   let startAnimation;
   *   let currentAnimationState;
   *
   *   function handleClick() {
   *     startAnimation({
   *       opacity: 1,
   *       scale: 1,
   *       transition: { type: 'spring', stiffness: 300 }
   *     });
   *   }
   * </script>
   *
   * <UseAnimatedState {initialState} let:animatedState={[state, start]}>
   *   <button on:click={handleClick}>Animate State</button>
   *   <pre>{JSON.stringify(state, null, 2)}</pre>
   *   {@const [currentAnimationState, startAnimation] = animatedState}
   * </UseAnimatedState>
   * ```
   * @see https://www.framer.com/motion/use-animated-state/ (Conceptually similar)
   */

/**
based on framer-motion@4.0.3,
Copyright (c) 2018 Framer B.V.
*/
    var createObject = function () { return ({}); };
    var stateVisualElement = visualElement({
    build: function () { },
    measureViewportBox: axisBox,
    resetTransform: function () { },
    restoreTransform: function () { },
    removeValueFromRenderState: function () { },
    render: function () { },
    scrapeMotionValuesFromProps: createObject,
    readValueFromInstance: function (_state, key, options) {
        return options.initialState[key] || 0;
    },
    makeTargetAnimatable: function (element, _a) {
        var transition = _a.transition, transitionEnd = _a.transitionEnd, target = __rest(_a, ["transition", "transitionEnd"]);
        var origin = getOrigin(target, transition || {}, element);
        checkTargetForNewValues(element, target, origin);
        return __assign({ transition: transition, transitionEnd: transitionEnd }, target);
    },
});

</script>

<script>
  
    import { afterUpdate, onMount, getContext } from "svelte";
    import { UseVisualState } from '../motion/utils/use-visual-state.js';
    import { visualElement } from '../render/index.js';
    import { axisBox } from '../utils/geometry/index.js';
    import { checkTargetForNewValues, getOrigin } from '../render/utils/setters.js';
    import { animateVisualElement } from '../render/utils/animation.js';
    import { __assign, __rest } from 'tslib';
    import { ScaleCorrectionParentContext } from '../context/ScaleCorrectionProvider.svelte';

    /**
     * The initial state for the animation.
     * @type {any}
     * @public
     */
    export let initialState;

    /** @type {any} The current state of the animation, updated via `onUpdate`. */
    let animationState = initialState;

    /** @type {import('../render/types').VisualElement<any, any>} The internal visual element used to manage state animation. */
    let element;
    // Reactive assignment based on the state from UseVisualState
    $:( element = stateVisualElement({ props: {} }, { visualState:state }))

    // Mount the visual element when the component mounts, unmount on destroy
    onMount(() => {
        element.mount({});
        return () => element.unmount();
    });

    // Function to run after Svelte updates
    const _afterUpdate = () => {
        element.setProps({
            onUpdate: (v) => { animationState = { ...v }}, // Update local animation state when the visual element updates
        });
    }

    // Register the afterUpdate hook
    afterUpdate(_afterUpdate);

    // --- Scale Correction Context Integration ---
    // This seems necessary for layout-related animations even though this component
    // might not directly render DOM elements. It ensures proper synchronization
    // within a potential parent AnimateSharedLayout context.
    const scaleCorrectionParentContext = getContext(
        ScaleCorrectionParentContext
    ) ?? { update: () => {}, set: () => {}, subscribe: () => (() => {}) }; // Provide a default stub if context is missing

    // Add this component's afterUpdate logic to the parent scale correction context
    scaleCorrectionParentContext.update((v) => [ ...(v || []), { afterU: _afterUpdate } ] );

    /**
     * Function to initiate an animation on the internal state visual element.
     * @param {any} animationDefinition - The target state or variant label to animate to.
     * @returns {Promise<any>} A promise that resolves when the animation completes.
     */
    let startAnimation = (animationDefinition) => {
        return animateVisualElement(element, animationDefinition);
    };

</script>

<UseVisualState
    config={{ scrapeMotionValuesFromProps: createObject, createRenderState: createObject }}
   
    props={{}}
    isStatic={false}
    let:state
    >
    <!-- Expose the current animation state and the startAnimation function via slot props -->
    <slot animatedState={[animationState, startAnimation]} {state} />
</UseVisualState>
