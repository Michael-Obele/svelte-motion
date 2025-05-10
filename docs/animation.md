# Animation Module

The `animation` module in svelte-motion provides components and utilities for creating and controlling animations. It is based on the animation system from Framer Motion v4.0.3.

## Core Components

### UseAnimation

A component that creates `AnimationControls`, which can be used to manually start, stop, and sequence animations on one or more components.

```svelte
<script>
  import { UseAnimation } from 'svelte-motion/animation/use-animation';
</script>

<UseAnimation let:controls>
  <!-- The controls can be passed to the animate prop of Motion components -->
  <Motion animate={controls}>
    <div>Animated content</div>
  </Motion>
</UseAnimation>
```

You can also use the imperative API:

```js
import { useAnimation } from 'svelte-motion/animation/use-animation';

const controls = useAnimation();

// Controls can be used to start animations
controls.start({
  x: 100,
  transition: { duration: 0.5 }
});
```

### UseAnimatedState

A component for animating state values. It provides a mechanism to create and animate state variables.

```svelte
<script>
  import { UseAnimatedState } from 'svelte-motion/animation/use-animated-state';
</script>

<UseAnimatedState initialState={{ x: 0, opacity: 1 }} let:animatedState={[state, startAnimation]}>
  <div>
    Current state: x={state.x}, opacity={state.opacity}
    <button on:click={() => startAnimation({ x: 100, opacity: 0 })}>
      Animate
    </button>
  </div>
</UseAnimatedState>
```

## Core Functions

### animate

The `animate` function animates a single value or a `MotionValue`.

```js
import { animate } from 'svelte-motion/animation/animate';
import { motionValue } from 'svelte-motion/value';

// Animate a MotionValue
const x = motionValue(0);
animate(x, 100, {
  type: "spring",
  stiffness: 2000,
  onComplete: () => console.log('Animation complete')
});

// Or animate directly
animate(0, 100, {
  duration: 1,
  onUpdate: (value) => console.log(value)
});
```

### animationControls

Creates an object to control animations across multiple components:

```js
import { animationControls } from 'svelte-motion/animation/animation-controls';

const controls = animationControls();

// Mount the controls when your component mounts
onMount(controls.mount);

// Start an animation on all linked components
controls.start({
  x: 100,
  transition: { duration: 0.5 }
});

// Stop all animations
controls.stop();
```

## Utilities

The animation module includes several utility functions in the `utils` subfolder:

### Transitions

- `getDefaultTransition`: Provides appropriate default transitions for different animation properties.
- `startAnimation`: Internal function used to start animations on MotionValues.

### Easing

- `easingDefinitionToFunction`: Converts various easing formats to easing functions.
- Available easing types include: `linear`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `backIn`, etc.

### Animation Checks

- `isAnimatable`: Determines if a value can be animated.
- `isKeyframesTarget`: Checks if an animation target is using keyframes.
- `isAnimationControls`: Validates if an object is an animation controls instance.

## Usage Notes

1. The animation system works closely with the value system to manage and update animated values.
2. Animations can be defined using various formats including:
   - Simple values: `{ x: 100 }`
   - Keyframes: `{ x: [0, 50, 100] }`
   - Spring physics: `{ type: "spring", stiffness: 500 }`
   - Tween animations: `{ type: "tween", ease: "easeOut" }`

3. For optimal performance, reuse animation controls rather than creating new ones for each animation.

All animation functionality is built on top of Popmotion, a powerful animation library with a focus on performance.