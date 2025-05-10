# Gestures Module

The `gestures` module in svelte-motion provides components and utilities for handling user interactions such as drag, tap, hover, and focus. These gestures build on top of the event system to provide high-level abstractions for common interaction patterns.

## Core Components

### UseGestures

A component that combines all gesture functionality (pan, tap, hover, focus) into a single component.

```svelte
<script>
  import { UseGestures } from 'svelte-motion/gestures/use-gestures';
  import { Motion } from 'svelte-motion';
  
  let visualElement; // Reference to a motion visual element
</script>

<Motion
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  whileFocus={{ outline: "2px solid blue" }}
  whileDrag={{ opacity: 0.8 }}
  drag={true}
  bind:visualElement
>
  <div>Drag, tap, hover or focus me</div>
</Motion>

<UseGestures props={{
  whileHover: true,
  whileTap: true,
  whileFocus: true,
  drag: true
}} {visualElement} />
```

### UsePanGesture

Handles panning/dragging gestures.

```svelte
<script>
  import { UsePanGesture } from 'svelte-motion/gestures/use-pan-gesture';
  
  let visualElement;
  
  function onPanStart(event, info) {
    console.log('Pan started', info.point);
  }
  
  function onPan(event, info) {
    console.log('Panning', info.delta.x, info.delta.y);
  }
  
  function onPanEnd(event, info) {
    console.log('Pan ended', info.velocity);
  }
</script>

<UsePanGesture
  props={{
    onPanStart,
    onPan,
    onPanEnd
  }}
  {visualElement}
/>
```

### UseDrag

Specialized component for drag gestures with additional features like constraints and momentum.

```svelte
<script>
  import { UseDrag } from 'svelte-motion/gestures/drag/use-drag';
  import { Motion } from 'svelte-motion';
  
  let visualElement;
</script>

<Motion
  drag="x"
  dragConstraints={{ left: -100, right: 100 }}
  dragElastic={0.2}
  dragMomentum={true}
  bind:visualElement
>
  <div>Drag me</div>
</Motion>

<UseDrag
  props={{
    drag: "x",
    dragConstraints: { left: -100, right: 100 },
    dragElastic: 0.2,
    dragMomentum: true
  }}
  {visualElement}
/>
```

### UseDragControls

Provides a way to trigger drag gestures programmatically.

```svelte
<script>
  import { UseDragControls } from 'svelte-motion/gestures/drag/use-drag-controls';
  import { Motion } from 'svelte-motion';
  
  function startDrag(event) {
    dragControls.start(event, { snapToCursor: true });
  }
</script>

<UseDragControls let:dragControls>
  <button on:pointerdown={startDrag}>
    Drag from here
  </button>
  
  <Motion drag="x" {dragControls}>
    <div>This element will be dragged</div>
  </Motion>
</UseDragControls>
```

### UseTapGesture

Handles tap/click gestures with animation states.

```svelte
<script>
  import { UseTapGesture } from 'svelte-motion/gestures/use-tap-gesture';
  
  let visualElement;
  
  function onTap(event, info) {
    console.log('Tapped at', info.point);
  }
</script>

<UseTapGesture
  props={{
    onTap,
    whileTap: true
  }}
  {visualElement}
/>
```

### UseHoverGesture

Handles hover gestures with animation states.

```svelte
<script>
  import { UseHoverGesture } from 'svelte-motion/gestures/use-hover-gesture';
  
  let visualElement;
  
  function onHoverStart(event, info) {
    console.log('Hover started');
  }
  
  function onHoverEnd(event, info) {
    console.log('Hover ended');
  }
</script>

<UseHoverGesture
  props={{
    onHoverStart,
    onHoverEnd,
    whileHover: true
  }}
  {visualElement}
/>
```

### UseFocusGesture

Handles focus gestures with animation states.

```svelte
<script>
  import { UseFocusGesture } from 'svelte-motion/gestures/use-focus-gesture';
  
  let visualElement;
</script>

<UseFocusGesture
  props={{
    whileFocus: true
  }}
  {visualElement}
/>
```

## Core Utilities

### PanSession

Manages pointer tracking for drag and pan gestures. It's used internally by the gesture components.

```js
import { PanSession } from 'svelte-motion/gestures/PanSession';

// Create a new pan session
const panSession = new PanSession(event, {
  onSessionStart: (event) => {
    console.log('Session started');
  },
  onStart: (event, info) => {
    console.log('Pan started', info.point);
  },
  onMove: (event, info) => {
    console.log('Panning', info.delta.x, info.delta.y);
  },
  onEnd: (event, info) => {
    console.log('Pan ended', info.velocity);
  }
}, {
  transformPagePoint: (point) => point
});

// End the session
panSession.end();
```

### DragControls

Provides programmatic control over drag gestures.

```js
import { DragControls } from 'svelte-motion/gestures/drag/use-drag-controls';

const dragControls = new DragControls();

// Start a drag interaction
dragControls.start(event, {
  snapToCursor: true
});

// Update constraints
dragControls.updateConstraints();
```

## Drag Utilities

The gestures module includes several utilities for drag behavior in the `drag/utils` directory:

### Constraints

Functions for calculating and applying constraints to drag gestures:

```js
import { 
  applyConstraints,
  calcRelativeConstraints,
  resolveDragElastic
} from 'svelte-motion/gestures/drag/utils/constraints';

// Apply constraints to a point
const constrainedPoint = applyConstraints(point, { min: 0, max: 100 }, 0.2);

// Calculate constraints relative to a layout box
const constraints = calcRelativeConstraints(layoutBox, {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10
});

// Resolve drag elastic settings
const elastic = resolveDragElastic(0.2);
```

### Lock

Utilities for managing global drag locks, ensuring only one drag operation happens at a time:

```js
import { 
  getGlobalLock,
  isDragActive
} from 'svelte-motion/gestures/drag/utils/lock';

// Get a lock for a drag direction
const lock = getGlobalLock("x");
if (lock) {
  // We have the lock, can start dragging
  // Later, release the lock
  lock();
}

// Check if any drag is active
if (!isDragActive()) {
  // Safe to start a new gesture
}
```

## Usage Notes

1. The gesture components require a reference to a visual element to apply animations and track state.

2. Most gesture components accept props objects with handlers and animation controls.

3. For drag gestures, you can:
   - Constrain movement with `dragConstraints`
   - Add elasticity with `dragElastic`
   - Enable momentum with `dragMomentum`
   - Restrict to an axis with `drag="x"` or `drag="y"`

4. Gesture handlers receive both the raw event and an info object with:
   - `point`: Current pointer position
   - `delta`: Movement since last update
   - `offset`: Total movement since gesture start
   - `velocity`: Current velocity

5. Use `whileHover`, `whileTap`, `whileFocus`, and `whileDrag` props to define animations that trigger during those gestures.