# Context Module

The `context` module in svelte-motion provides various context stores and providers that establish a communication layer between components. These contexts enable features like shared configuration, presence detection, and coordinated animations.

## Core Contexts

### MotionContext

Provides information about the parent motion component to its children, including the visual element.

```svelte
<script>
  import { MotionContext } from 'svelte-motion/context/MotionContext';
  import { getContext } from 'svelte';
  
  // Access the parent visual element
  const motionContext = getContext(MotionContext);
</script>
```

### MotionConfigContext

Provides configuration values to all descendant Motion components.

```svelte
<script>
  import { MotionConfigContext } from 'svelte-motion/context/MotionConfigContext';
  import { getContext } from 'svelte';
  
  // Access motion configuration
  const motionConfig = getContext(MotionConfigContext);
</script>
```

The configuration can include:
- `transformPagePoint`: A function to transform point measurements
- `isStatic`: Boolean to disable all animations
- `transition`: Default transition settings

### PresenceContext

Manages component presence and exit animations.

```svelte
<script>
  import { PresenceContext } from 'svelte-motion/context/PresenceContext';
  import { getContext } from 'svelte';
  
  // Get presence information
  const presence = getContext(PresenceContext);
</script>
```

### SharedLayoutContext

Coordinates layout animations between components.

```svelte
<script>
  import { SharedLayoutContext } from 'svelte-motion/context/SharedLayoutContext';
  import { getContext } from 'svelte';
  
  // Access shared layout context
  const sharedLayout = getContext(SharedLayoutContext);
</script>
```

### LazyContext

Used by the LazyMotion component to provide dynamically loaded animation features.

```svelte
<script>
  import { LazyContext } from 'svelte-motion/context/LazyContext';
  import { getContext } from 'svelte';
  
  // Access the lazy-loaded features
  const lazyContext = getContext(LazyContext);
</script>
```

### LayoutGroupContext

Manages groups of components that should be laid out together.

```svelte
<script>
  import { LayoutGroupContext } from 'svelte-motion/context/LayoutGroupContext';
  import { getContext } from 'svelte';
  
  // Access layout group information
  const layoutGroup = getContext(LayoutGroupContext);
</script>
```

## Specialized Providers

### ScaleCorrectionProvider

Handles scale correction for nested animations to ensure consistent behavior across different scaling contexts.

```svelte
<script>
  import { ScaleCorrectionContext } from 'svelte-motion/context/ScaleCorrectionProvider.svelte';
  import { getContext } from 'svelte';
  
  // Access scale correction information
  const scaleCorrection = getContext(ScaleCorrectionContext);
</script>
```

## DOM Context Utilities

The context module includes utilities for working with DOM-based contexts:

### getDomContext

Retrieves a context from the DOM hierarchy.

```js
import { getDomContext } from 'svelte-motion/context/DOMcontext';

// Get a specific context from a DOM element
const motionContext = getDomContext('Motion', element);
```

### setDomContext

Sets a context in the DOM hierarchy.

```js
import { setDomContext } from 'svelte-motion/context/DOMcontext';

// Set a context on a DOM element
setDomContext('Motion', element, value);
```

## Usage Notes

1. Contexts are used internally by svelte-motion to coordinate behavior between components.

2. While you can access these contexts directly, it's generally better to use the provided components and hooks.

3. The DOM-based context system allows svelte-motion to maintain context relationships even when components are nested outside of the Svelte component hierarchy.

4. Some contexts like MotionContext expose visual elements that provide access to animation controls and state.