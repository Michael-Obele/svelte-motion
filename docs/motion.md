# Motion Module

The `motion` module is the core implementation of svelte-motion's animation system. It provides the foundational components and utilities that power the animation capabilities throughout the library.

## Core Components

### Motion.svelte

The primary component for enabling animations. It creates and manages visual elements, animation states, and handles the rendering of animated content.

```svelte
<Motion animate={{ scale: 1.2 }} let:motion let:props>
  <div use:motion {...props}>Animated content</div>
</Motion>
```

Key responsibilities:
- Creating and managing the visual element
- Setting up context providers
- Handling motion features and animations
- Providing reactive motion props and action

### MotionSSR.svelte

A server-side rendering compatible version of the Motion component that handles animations in an SSR context.

```svelte
<MotionSSR animate={{ opacity: 1 }} let:motion let:props>
  <div use:motion {...props}>Server-rendered animation</div>
</MotionSSR>
```

## Features System

The features system allows for modular animation capabilities that can be loaded as needed:

### Features Module

Located in the `features/` directory, it provides:

- **Definitions**: Core feature definitions for the animation system
- **AnimationState**: Manages animation states and transitions
- **Exit**: Handles exit animations for elements being removed
- **Layout**: Handles layout animations when elements change position or size

Features are registered using `loadFeatures()` and can be dynamically imported for code-splitting.

```js
import { loadFeatures } from 'svelte-motion/motion/features/definitions';
import { animations } from 'svelte-motion/motion/features/animations';

// Load animation features
loadFeatures(animations);
```

### Feature Components

- **AnimationState.svelte**: Creates and manages the animation state for a visual element
- **Exit.svelte**: Manages exit animations using the presence context
- **UseFeatures.svelte**: Dynamically applies features to a visual element

## Utilities

The `utils/` directory contains important utilities for the motion system:

### Visual Element Utilities

- **UseVisualElement.svelte**: Creates and manages the visual element
- **UseVisualState.svelte**: Manages the visual state of an element
- **useMotionRef.js**: Handles motion references for elements

### Props Utilities

- **is-forced-motion-value.js**: Determines if a property needs a motion value
- **valid-prop.js**: Validates motion props
- **UseLayoutId.svelte**: Manages layout IDs for shared layouts

## Factory Function

The `createMotionComponent` function is the main factory for creating motion components:

```js
import { createMotionComponent } from 'svelte-motion/motion';

const MyMotionComponent = createMotionComponent({
  preloadedFeatures,
  createVisualElement,
  Component: 'div'
});
```

It takes configuration options and returns a new Motion component with the specified features and behavior.

## Integration

Motion components integrate with other modules:

- Uses the **context system** for configuration and state sharing
- Leverages **value system** for tracking animatable values
- Relies on the **render system** for DOM updates
- Works with **gesture system** for interactive animations

## Usage Notes

1. The core Motion component should be used for standard animations
2. MotionSSR is recommended for server-side rendered applications
3. Features can be code-split using the LazyMotion component
4. Custom motion components can be created using createMotionComponent