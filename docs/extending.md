# Extending svelte-motion

This guide explains how to extend svelte-motion with custom functionality, animations, and components.

## Creating Custom Animations

You can extend svelte-motion with custom animations by creating your own transition definitions.

### Custom Transitions

```js
// myTransitions.js
export const bounce = {
  type: "spring",
  stiffness: 300,
  damping: 10,
  restDelta: 0.5,
  restSpeed: 10
};

export const slowFade = {
  type: "tween",
  duration: 1.5,
  ease: [0.43, 0.13, 0.23, 0.96]
};
```

```svelte
<script>
  import { Motion } from 'svelte-motion';
  import { bounce } from './myTransitions.js';
</script>

<Motion 
  animate={{ scale: 1.2 }}
  transition={bounce}
>
  <div>Custom bounce animation</div>
</Motion>
```

### Custom Animation Functions

For more complex animations, you can use the `animate` function directly:

```js
import { animate } from 'svelte-motion/animation/animate';
import { motionValue } from 'svelte-motion/value';

export function animateCounter(element, from, to, options = {}) {
  const value = motionValue(from);
  
  const unsubscribe = value.onChange((latest) => {
    element.textContent = Math.round(latest);
  });
  
  const controls = animate(value, to, {
    duration: 1,
    ease: "easeOut",
    ...options
  });
  
  return {
    ...controls,
    cleanup: () => {
      unsubscribe();
      controls.stop();
    }
  };
}
```

## Building Custom Motion Components

### Creating a Reusable Motion Component

```svelte
<!-- MotionButton.svelte -->
<script>
  import { Motion } from 'svelte-motion';
  
  export let animate = {};
  export let transition = {};
  export let whileHover = { scale: 1.05 };
  export let whileTap = { scale: 0.95 };
</script>

<Motion
  {animate}
  {transition}
  {whileHover}
  {whileTap}
>
  <button class="my-button" on:click>
    <slot></slot>
  </button>
</Motion>

<style>
  .my-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: #4a5568;
    color: white;
    font-weight: bold;
  }
</style>
```

### Using the Custom Component

```svelte
<script>
  import MotionButton from './MotionButton.svelte';
  
  function handleClick() {
    console.log('Button clicked');
  }
</script>

<MotionButton 
  animate={{ y: 0 }}
  whileHover={{ y: -5, scale: 1.1 }}
  on:click={handleClick}
>
  Animated Button
</MotionButton>
```

## Adding Custom Gesture Handlers

You can extend svelte-motion's gesture system by creating custom gesture handlers.

### Custom Drag Handler

```svelte
<!-- CustomDragHandler.svelte -->
<script>
  import { UseDrag } from 'svelte-motion/gestures/drag/use-drag';
  import { onMount } from 'svelte';
  
  export let visualElement;
  export let onDragStart = () => {};
  export let onDrag = () => {};
  export let onDragEnd = () => {};
  export let dragConstraints = false;
  
  let dragHistory = [];
  
  function handleDragStart(event, info) {
    dragHistory = [info.point];
    onDragStart(event, info);
  }
  
  function handleDrag(event, info) {
    dragHistory.push(info.point);
    onDrag(event, {...info, history: dragHistory});
  }
  
  function handleDragEnd(event, info) {
    const velocity = calculateAverageVelocity(dragHistory);
    onDragEnd(event, {...info, averageVelocity: velocity});
    dragHistory = [];
  }
  
  function calculateAverageVelocity(history) {
    // Implementation to calculate velocity based on history
    return { x: 0, y: 0 }; // Placeholder
  }
</script>

<UseDrag
  {visualElement}
  props={{
    drag: true,
    dragConstraints,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd
  }}
/>
```

## Extending the Animation System

### Custom Animation Controls

```js
// customAnimationControls.js
import { animationControls } from 'svelte-motion/animation/animation-controls';

export function createSequence() {
  const controls = animationControls();
  
  return {
    ...controls,
    
    // Run animations in sequence
    sequence: async (animations) => {
      for (const animation of animations) {
        await controls.start(animation);
      }
    },
    
    // Run animations with delays
    stagger: (animation, options = { delay: 0.05 }) => {
      return (i) => ({
        ...animation,
        transition: {
          ...animation.transition,
          delay: (options.delay || 0) * i
        }
      });
    }
  };
}
```

```svelte
<script>
  import { onMount } from 'svelte';
  import { Motion } from 'svelte-motion';
  import { createSequence } from './customAnimationControls';
  
  const sequence = createSequence();
  
  onMount(() => {
    sequence.sequence([
      { scale: 1.2, opacity: 1 },
      { rotate: 10 },
      { scale: 1, rotate: 0 }
    ]);
  });
</script>

<Motion animate={sequence}>
  <div>Sequenced animation</div>
</Motion>
```

## Integration with Other Libraries

### Integrating with D3.js

```svelte
<script>
  import { onMount } from 'svelte';
  import { select } from 'd3-selection';
  import { line, curveCardinal } from 'd3-shape';
  import { animate } from 'svelte-motion/animation/animate';
  
  let svgEl;
  let data = [0, 30, 10, 40, 20, 50];
  let pathEl;
  
  onMount(() => {
    const svg = select(svgEl);
    
    // Create D3 line generator
    const lineGenerator = line()
      .curve(curveCardinal)
      .x((d, i) => i * 50)
      .y(d => 100 - d);
      
    // Create path element
    pathEl = svg.append('path')
      .attr('fill', 'none')
      .attr('stroke', '#ff3e00')
      .attr('stroke-width', 2);
      
    // Initial render
    pathEl.attr('d', lineGenerator(data));
    
    // Animate data changes
    setTimeout(() => {
      const newData = [50, 20, 40, 10, 30, 0];
      
      // Use svelte-motion to animate each data point
      data.forEach((oldValue, i) => {
        animate(oldValue, newData[i], {
          duration: 1,
          onUpdate: (latest) => {
            data[i] = latest;
            pathEl.attr('d', lineGenerator(data));
          }
        });
      });
    }, 1000);
  });
</script>

<svg bind:this={svgEl} width="300" height="100"></svg>
```

## Custom MotionValues

You can create custom MotionValues for specialized animation needs:

```js
// colorMotionValue.js
import { motionValue } from 'svelte-motion/value';

export function colorMotionValue(initialColor) {
  const value = motionValue(parseColor(initialColor));
  
  return {
    // Expose the underlying motionValue
    get: value.get,
    set: value.set,
    onChange: value.onChange,
    
    // Add color-specific functionality
    getHex: () => {
      const { r, g, b } = value.get();
      return rgbToHex(r, g, b);
    },
    
    getRgb: () => {
      return value.get();
    },
    
    setHex: (hex) => {
      value.set(parseColor(hex));
    }
  };
}

function parseColor(color) {
  // Implementation to parse different color formats
  return { r: 0, g: 0, b: 0 }; // Placeholder
}

function rgbToHex(r, g, b) {
  // Implementation to convert RGB to hex
  return "#000000"; // Placeholder
}
```

## Best Practices

1. **Composition Over Inheritance**: Build reusable components through composition rather than inheritance.

2. **Memoize Animation Definitions**: Avoid creating new animation objects on each render.

3. **Use Layout Animations Sparingly**: Layout animations can be expensive, especially with complex layouts.

4. **Leverage Hardware Acceleration**: Use transform and opacity for smooth animations.

5. **Cleanup Resources**: Always clean up animations and event listeners when components unmount.

6. **Avoid Layout Thrashing**: Batch reads and writes to the DOM to prevent layout thrashing.

7. **Test on Low-End Devices**: Ensure your animations perform well across different devices.

## Performance Tips

1. **Use `LazyMotion` for Code Splitting**:
   ```svelte
   <LazyMotion features={() => import('svelte-motion/features/dom')}>
     <m.div animate={{ x: 100 }}>
       Content
     </m.div>
   </LazyMotion>
   ```

2. **Animate Transform Properties**: Properties like `x`, `y`, `scale`, and `rotate` are more performant than `width`, `height`, and `top`.

3. **Use `transition.type`**: Specify `spring` or `tween` explicitly rather than relying on auto-detection.

4. **Disable Animations When Not Visible**:
   ```svelte
   <Motion 
     animate={isVisible ? { opacity: 1 } : {}}
     transition={{ duration: isVisible ? 0.5 : 0 }}
   >
     <div>Content</div>
   </Motion>
   ```

5. **Reduce DOM Elements**: Minimize the number of animated elements for better performance.