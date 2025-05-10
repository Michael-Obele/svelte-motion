# Index.js Module

The `index.js` file serves as the main entry point for the svelte-motion library. It exports all the public API components, utilities, hooks, and types that consumers of the library can use.

## Core Components

### Motion Components

```js
import { Motion, MotionDiv } from 'svelte-motion';

// Use Motion with any element
<Motion animate={{ scale: 1.2 }} let:motion let:props>
  <div use:motion {...props}>Animated content</div>
</Motion>

// Or use MotionDiv for convenience
<MotionDiv animate={{ scale: 1.2 }}>
  Animated content
</MotionDiv>
```

### Layout Animation Components

```js
import { AnimatePresence, AnimateSharedLayout } from 'svelte-motion';

<AnimatePresence>
  {#if visible}
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      Content
    </MotionDiv>
  {/if}
</AnimatePresence>

<AnimateSharedLayout>
  <MotionDiv layoutId="shared-element">
    Content that animates between positions
  </MotionDiv>
</AnimateSharedLayout>
```

### Configuration Components

```js
import { MotionConfig, LazyMotion } from 'svelte-motion';

<MotionConfig transition={{ duration: 0.5 }}>
  <!-- All motion components inside will use this transition -->
</MotionConfig>

<LazyMotion features={import('./features')}>
  <!-- Code-split animation features -->
</LazyMotion>
```

## Animation Hooks and Utilities

### Motion Values

```js
import { motionValue, useMotionValue, useTransform } from 'svelte-motion';

const x = useMotionValue(0);
const opacity = useTransform(x, [0, 100], [0, 1]);
```

### Animation Controls

```js
import { useAnimation, animationControls } from 'svelte-motion';

const controls = useAnimation();
// Start animation
controls.start({ x: 100 });
```

### Direct Animation

```js
import { animate } from 'svelte-motion';

// Animate a value from 0 to 100
animate(0, 100, {
  duration: 2,
  onUpdate: (v) => console.log(v)
});
```

## Gesture Hooks

```js
import { 
  useDragControls, 
  UseGestures, 
  UsePanGesture, 
  UseTapGesture 
} from 'svelte-motion';

// Create drag controls
const dragControls = useDragControls();
dragControls.start(event);
```

## Context Providers

```js
import { 
  MotionConfigContext, 
  PresenceContext, 
  SharedLayoutContext 
} from 'svelte-motion';

// Access context in custom components
const motionConfig = getContext(MotionConfigContext);
```

## Presence Utilities

```js
import { usePresence, useIsPresent } from 'svelte-motion';

// Check if component is present in AnimatePresence
const isPresent = useIsPresent();
const [isPresent, safeToRemove] = usePresence();
```

## Advanced Animation Utilities

```js
import { 
  transform, 
  useSpring, 
  useVelocity, 
  useViewportScroll 
} from 'svelte-motion';

// Spring physics
const smoothX = useSpring(rawX);

// Scroll values
const { scrollYProgress } = useViewportScroll();
```

## DOM Event Hooks

```js
import { UseDomEvent } from 'svelte-motion';

<UseDomEvent ref={elementRef} eventName="wheel" handler={handleWheel} />
```

## Visual Element Utilities

```js
import { 
  visualElement, 
  animateVisualElement, 
  isValidMotionProp 
} from 'svelte-motion';

// Create a visual element
const element = visualElement(config)(props);
```

## Usage Notes

1. Most exports can be imported directly from the package root:
   ```js
   import { Motion, animate, useMotionValue } from 'svelte-motion';
   ```

2. For better code-splitting, use the LazyMotion component with dynamic imports.

3. Motion components follow Svelte paradigms, accepting props and providing let:motion and let:props for use with the action system.

4. Motion values implement the Svelte store contract and can be subscribed to with the $ prefix.