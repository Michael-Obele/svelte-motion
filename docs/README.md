# svelte-motion Documentation

svelte-motion is a motion library for Svelte applications, providing powerful animation capabilities. It is a port of Framer Motion, adapted specifically for Svelte's component model and reactivity system.

## Installation

```bash
npm install svelte-motion
```

## Basic Usage

```svelte
<script>
  import { Motion } from 'svelte-motion';
</script>

<Motion
  animate={{ x: 100 }}
  transition={{ duration: 2 }}
>
  <div>I will animate 100px to the right</div>
</Motion>
```

## Library Structure

The svelte-motion library is organized into several key modules:

- [Animation](./animation.md): Components and utilities for creating and controlling animations
- [Components](./components.md): High-level components for animation orchestration and configuration
- [Context](./context.md): Context stores and providers for communication between components
- [Events](./events.md): Utilities for handling DOM events consistently across browsers
- [Gestures](./gestures.md): Components for handling user interactions like drag, tap, hover, and focus
- [Motion](./motion.md): Core motion components and animation features
- [Render](./render.md): Rendering system for HTML and SVG elements
- [Utils](./utils.md): Utility functions for geometry, arrays, and animation
- [Value](./value.md): Motion values for tracking and animating state
- [Index](./index.js.md): Entry point and public API exports

## Key Features

- **Spring Animations**: Natural-feeling spring physics for smooth animations
- **Gestures**: Support for drag, tap, hover, and focus gestures
- **Layout Animations**: Animate elements as they change position or size
- **Shared Layout Animations**: Animate elements between different components
- **Exit Animations**: Animate elements as they're removed from the DOM
- **Keyframes**: Support for multi-step animations
- **Path Drawing**: Animate SVG paths with precise control
- **Variants**: Define and reuse animation presets

## Examples

### Animate Presence

```svelte
<script>
  import { Motion, AnimatePresence } from 'svelte-motion';
  let isVisible = true;
</script>

<button on:click={() => isVisible = !isVisible}>
  Toggle
</button>

<AnimatePresence>
  {#if isVisible}
    <Motion
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div>I will animate in and out</div>
    </Motion>
  {/if}
</AnimatePresence>
```

### Drag Gesture

```svelte
<script>
  import { Motion } from 'svelte-motion';
</script>

<Motion
  drag
  dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
  whileDrag={{ scale: 1.1 }}
>
  <div>Drag me</div>
</Motion>
```

## Credits

svelte-motion is based on [Framer Motion](https://www.framer.com/motion/), adapted for use with Svelte. The original Framer Motion library was created by Framer B.V.