# Utils Module

The `utils` module in svelte-motion provides essential utility functions and components that support the animation system throughout the library. These utilities handle everything from array operations to geometric calculations and time conversions.

## Core Utilities

### Geometry Utilities

Located in the `geometry/` directory, these utilities handle spatial calculations for animations:

- **delta-apply.js**: Applies transformations to bounding boxes
- **delta-calc.js**: Calculates transformation deltas between states
- **index.js**: Core geometric utilities for working with axis boxes and bounding boxes

```js
import { applyBoxDelta, resetBox } from 'svelte-motion/utils/geometry/delta-apply';

// Apply a transformation delta to a box
applyBoxDelta(elementBox, { x: { translate: 100, scale: 1.2 }, y: { translate: 0, scale: 1 } });
```

### Array Utilities

Simple functions for manipulating arrays:

- **addUniqueItem**: Adds an item to an array if it's not already present
- **removeItem**: Removes an item from an array

```js
import { addUniqueItem, removeItem } from 'svelte-motion/utils/array';

const items = ['apple', 'banana'];
addUniqueItem(items, 'orange'); // items = ['apple', 'banana', 'orange']
removeItem(items, 'banana'); // items = ['apple', 'orange']
```

### Value Resolution

Utilities for resolving and transforming values:

- **resolve-value.js**: Resolves final values from keyframes or complex objects
- **transform.js**: Transforms values from one range to another

```js
import { transform } from 'svelte-motion/utils/transform';

// Map a value from one range to another
const output = transform(25, [0, 100], [0, 1]); // output = 0.25
```

### Component Lifecycle

Svelte components that manage lifecycle events:

- **UseUnmountEffect.svelte**: Runs a callback when a component is unmounted
- **UseIsomorphicLayoutEffect.svelte**: Provides layout effect functionality that works in SSR

```svelte
<script>
  import { UseUnmountEffect } from 'svelte-motion/utils/use-unmount-effect';
</script>

<UseUnmountEffect callback={() => console.log('Component unmounted')}>
  <div>Content</div>
</UseUnmountEffect>
```

### Time and Animation

Utilities for time-based animations:

- **time-conversion.js**: Converts between time units
- **use-reduced-motion.js**: Respects user preference for reduced motion

```js
import { secondsToMilliseconds } from 'svelte-motion/utils/time-conversion';
import { useReducedMotion } from 'svelte-motion/utils/use-reduced-motion';

const ms = secondsToMilliseconds(2); // 2000
const shouldReduceMotion = useReducedMotion();
```

### State Management

Utilities for managing state across components:

- **subscription-manager.js**: Manages subscriptions to value changes
- **shallow-compare.js**: Performs shallow equality checks
- **use-cycle.js**: Cycles through a series of values

```js
import { useCycle } from 'svelte-motion/utils/use-cycle';

// Create a cycling state that rotates through 0, 90, 180, 270 degrees
const rotation = useCycle(0, 90, 180, 270);
```

## Other Utilities

- **each-axis.js**: Applies a function to both x and y axes
- **is-browser.js**: Detects browser environment
- **is-numerical-string.js**: Checks if a string is a number
- **is-ref-object.js**: Checks if an object is a ref
- **noop.js**: Provides a no-operation function
- **fix-process-env.js**: Ensures process.env is available

## Integration

These utilities are used throughout the svelte-motion library:

- The geometry utilities power layout animations
- Subscription management is used for motion values
- Lifecycle utilities ensure proper cleanup
- State management utilities provide reactive animation values

## Usage Notes

1. Most utilities are internal implementation details but some, like `useReducedMotion` and `useCycle`, are designed for direct use
2. The geometry utilities are powerful but complex - use with caution
3. Some utilities are specifically designed for server-side rendering compatibility
4. Time conversion utilities ensure consistent animation timing across platforms