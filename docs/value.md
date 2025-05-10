# Value Module

The `value` module is the heart of svelte-motion's animation system. It provides the core `MotionValue` class and various utilities for creating, transforming, and combining motion values. Motion values are the fundamental building blocks that track and animate state over time.

## Core Components

### MotionValue

The `MotionValue` class tracks the state and velocity of animated values. It maintains the current value, previous value, and velocity, provides subscription mechanisms, and handles animation updates.

```js
import { motionValue } from 'svelte-motion/value';

const x = motionValue(0);
x.set(100); // Animates to 100
x.get(); // Returns current value
x.getVelocity(); // Returns current velocity
```

Key features:
- **Tracking**: Maintains current and previous values
- **Velocity**: Calculates and exposes velocity information
- **Subscriptions**: Allows subscribing to value changes
- **Animation**: Supports starting and stopping animations
- **Svelte Store**: Implements the Svelte store interface

## Motion Value Hooks

Higher-level utilities for working with motion values:

### useMotionValue

Create a motion value with an initial state:

```js
import { useMotionValue } from 'svelte-motion/value/use-motion-value';

const opacity = useMotionValue(1);
```

### useTransform

Transform a motion value into another motion value using mapping functions:

```js
import { useMotionValue } from 'svelte-motion/value/use-motion-value';
import { useTransform } from 'svelte-motion/value/use-transform';

const x = useMotionValue(0);
// Map 0-100 to 0-1
const opacity = useTransform(x, [0, 100], [0, 1]);
// Or use a custom transform function
const scale = useTransform(x, v => v / 100 + 0.5);
```

### useSpring

Create a motion value that animates to its target using spring physics:

```js
import { useSpring } from 'svelte-motion/value/use-spring';

// Spring from initial value 0
const x = useSpring(0, { stiffness: 300, damping: 20 });
// Or spring to follow another motion value
const smoothX = useSpring(x, { stiffness: 100, damping: 30 });
```

### useMotionTemplate

Combine multiple motion values into a single string using a template literal:

```js
import { useMotionValue } from 'svelte-motion/value/use-motion-value';
import { useMotionTemplate } from 'svelte-motion/value/use-motion-template';

const x = useMotionValue(0);
const y = useMotionValue(0);
const boxShadow = useMotionTemplate`${x}px ${y}px 10px rgba(0,0,0,0.3)`;
```

### useVelocity

Create a motion value that tracks the velocity of another motion value:

```js
import { useMotionValue } from 'svelte-motion/value/use-motion-value';
import { useVelocity } from 'svelte-motion/value/use-velocity';

const x = useMotionValue(0);
const xVelocity = useVelocity(x);
```

## Scroll Motion Values

Utilities for creating motion values that track scroll position:

### useViewportScroll

Returns motion values that update when the viewport scrolls:

```js
import { useViewportScroll } from 'svelte-motion/value/scroll/use-viewport-scroll';

const { scrollX, scrollY, scrollXProgress, scrollYProgress } = useViewportScroll();
```

### useElementScroll

Returns motion values that update when a specific element scrolls:

```js
import { useElementScroll } from 'svelte-motion/value/scroll/use-element-scroll';

// With a Svelte reference
let element;
const { scrollX, scrollY, scrollXProgress, scrollYProgress } = useElementScroll({ current: element });
```

## Utility Functions

### resolveMotionValue

Extracts the actual value from a motion value or returns the value itself:

```js
import { resolveMotionValue } from 'svelte-motion/value/utils/resolve-motion-value';

const resolvedValue = resolveMotionValue(motionValueOrRawValue);
```

### isMotionValue

Checks if a value is a MotionValue instance:

```js
import { isMotionValue } from 'svelte-motion/value/utils/is-motion-value';

if (isMotionValue(value)) {
  // Handle motion value
}
```

## Integration with Svelte

Motion values implement the Svelte store interface, making them compatible with Svelte's reactive system:

```svelte
<script>
  import { motionValue } from 'svelte-motion/value';
  
  const x = motionValue(0);
</script>

<!-- Use with $ prefix for automatic subscription -->
<div style="transform: translateX({$x}px)">Animated content</div>

<!-- Or manually subscribe -->
<div style="transform: translateX({x.get()}px)">Animated content</div>
```

## Usage Notes

1. Motion values are the foundation of the animation system - they track state over time and notify subscribers of changes
2. Use motion values directly when you need fine-grained control over animations
3. Motion values can be combined, transformed, and derived from one another to create complex animations
4. For scroll-based animations, use `useViewportScroll` or `useElementScroll`
5. When working with TypeScript, motion values are generic - `MotionValue<number>`, `MotionValue<string>`, etc.