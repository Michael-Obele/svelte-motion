# Events Module

The `events` module in svelte-motion provides utilities and components for handling DOM events in a consistent, cross-browser manner. It includes abstractions for both DOM events and pointer events with proper cleanup handling.

## Core Components

### UseDomEvent

A component that attaches an event listener directly to the provided DOM element, bypassing Svelte's event system. This is useful for attaching non-passive event handlers or when more control is needed over event handling.

```svelte
<script>
  import { UseDomEvent } from 'svelte-motion/events/use-dom-event';
  
  let ref = { current: null };
</script>

<div bind:this={ref.current}></div>

<UseDomEvent 
  ref={ref}
  eventName="wheel"
  handler={(event) => {
    // Handle wheel event
  }}
  options={{ passive: false }}
/>
```

### UsePointerEvent

A specialized component for handling pointer events consistently across mouse, touch, and pen input devices.

```svelte
<script>
  import { UsePointerEvent } from 'svelte-motion/events/use-pointer-event';
  
  let ref = { current: null };
  
  function handlePointerDown(event, info) {
    console.log('Pointer down at', info.point.x, info.point.y);
  }
</script>

<div bind:this={ref.current}></div>

<UsePointerEvent
  ref={ref}
  eventName="pointerdown"
  handler={handlePointerDown}
/>
```

## Core Functions

### addDomEvent

Attaches an event listener to a DOM element and returns a cleanup function.

```js
import { addDomEvent } from 'svelte-motion/events/use-dom-event';

const element = document.querySelector('.my-element');
const cleanup = addDomEvent(element, 'click', (event) => {
  console.log('Element clicked');
});

// Later, when you want to remove the listener
cleanup();
```

### addPointerEvent

Attaches a pointer event listener with cross-browser compatibility.

```js
import { addPointerEvent } from 'svelte-motion/events/use-pointer-event';

const element = document.querySelector('.my-element');
const cleanup = addPointerEvent(element, 'pointerdown', (event, info) => {
  console.log('Pointer down at', info.point.x, info.point.y);
});

// Later, when you want to remove the listener
cleanup();
```

## Utility Functions

### wrapHandler

Wraps an event handler with additional functionality, such as filtering primary pointer events and extracting point information.

```js
import { wrapHandler } from 'svelte-motion/events/event-info';

const rawHandler = (event, info) => {
  console.log('Event handled with point', info.point);
};

const wrappedHandler = wrapHandler(rawHandler, true); // true = filter primary pointer
element.addEventListener('pointerdown', wrappedHandler);
```

### extractEventInfo

Extracts standardized information from pointer and mouse events.

```js
import { extractEventInfo } from 'svelte-motion/events/event-info';

element.addEventListener('pointerdown', (event) => {
  const info = extractEventInfo(event);
  console.log('Point:', info.point.x, info.point.y);
});
```

### Browser Support Detection

The module includes utilities to detect support for different event types:

```js
import { 
  supportsPointerEvents,
  supportsTouchEvents,
  supportsMouseEvents
} from 'svelte-motion/events/utils';

if (supportsPointerEvents()) {
  // Use pointer events
} else if (supportsTouchEvents()) {
  // Fall back to touch events
} else if (supportsMouseEvents()) {
  // Fall back to mouse events
}
```

## Usage Notes

1. Both `UseDomEvent` and `UsePointerEvent` components handle cleanup automatically when the component is destroyed.

2. The `ref` parameter should be an object with a `current` property that references the DOM element.

3. For pointer events, the handler receives both the raw event and an `info` object with standardized point information.

4. When using the functions directly (rather than the components), make sure to call the returned cleanup function to avoid memory leaks.

5. The events system accounts for browser differences, making it safer to use than direct DOM event listeners.