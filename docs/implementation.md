# Implementation Approach

This document outlines the internal implementation approach of svelte-motion, explaining the core architecture, patterns, and integration with Svelte.

## Architecture Overview

svelte-motion is a port of Framer Motion (v4.0.3) adapted specifically for Svelte's component model. The architecture consists of several interconnected systems:

1. **Visual Elements**: Core objects that manage the rendering and animation of DOM elements
2. **Motion Values**: Observable values that can be animated and subscribed to
3. **Animation System**: Handles orchestration of animations using Popmotion
4. **Gesture System**: Manages user interactions like dragging, tapping, and hovering
5. **Context System**: Provides communication between components in the tree

## Component Structure

svelte-motion uses a layered component structure:

1. **Base Components**: (`Motion`, `MotionDiv`) - Provide the core motion functionality
2. **Orchestration Components**: (`AnimatePresence`, `AnimateSharedLayout`) - Coordinate complex animation scenarios
3. **Configuration Components**: (`MotionConfig`, `LazyMotion`) - Configure motion behavior
4. **Utility Components**: (`UseGestures`, `UseDragControls`) - Provide specific functionality

Each component is implemented as a Svelte component (`.svelte` file) with corresponding JavaScript utilities and hooks.

## Visual Elements

The Visual Element is the core abstraction around DOM elements:

```
DOM Element → Visual Element → Motion Values → Animation
```

A Visual Element:
- Tracks the layout and transform properties of a DOM element
- Manages a collection of MotionValues for different properties
- Applies animations and gestures to the element
- Handles projection for layout animations

## Motion Values

MotionValues are observable, animatable values that:
- Store current animation state (position, opacity, etc.)
- Can be directly manipulated or animated
- Notify subscribers when their value changes
- Can be passed between components for coordinated animations

## Context System

svelte-motion implements two context systems:

1. **Svelte Context API**: Used for typical parent-child communication
2. **DOM Context System**: A custom system that traverses the DOM to find contexts

The DOM Context system allows svelte-motion to maintain animation relationships even when components are not directly in the Svelte component tree, which is crucial for features like shared layout animations.

## Integration with Svelte

### Component Lifecycle

svelte-motion hooks into Svelte's lifecycle methods:
- `onMount`: Set up animations, gestures, and DOM references
- `onDestroy`: Clean up animations and event listeners
- `afterUpdate`: Synchronize animations with component updates

### Actions

Svelte actions (`use:action`) are utilized for applying motion capabilities to DOM elements. This allows for a clean integration with Svelte's template syntax.

### Stores

svelte-motion leverages Svelte's store system for reactive state management:
- Context values are often implemented as stores
- Animation state can be observed through stores
- Component configuration is passed via stores

## Animation System

The animation system is built on Popmotion and includes:

1. **Animation Controls**: Orchestrate animations across components
2. **Transitions**: Define how properties animate between states
3. **Variants**: Predefined animation states that can be reused
4. **Physics**: Spring and inertia simulations for natural movement

## Gesture System

Gestures are implemented using:

1. **PanSession**: Tracks pointer movements for drag gestures
2. **Event Handlers**: Normalized across browsers and input types
3. **State Management**: Updates animation state based on gesture state
4. **Constraints**: Limit movement for drag gestures

## Special Patterns

### Scale Correction

When animations happen within scaled containers, special care is needed to ensure correct behavior. The `ScaleCorrectionProvider` maintains a hierarchy of scale information to adjust animations accordingly.

### Layout Animation

Layout animations involve:
1. Measuring the element before a layout change
2. Applying the layout change
3. Animating from the previous position to the new position

This requires careful coordination between the layout system and the animation system.

## Performance Considerations

svelte-motion employs several strategies for optimal performance:

1. **Batched DOM Updates**: Multiple layout measurements and updates are batched
2. **FLIP Technique**: First-Last-Invert-Play for efficient layout animations
3. **Lazy Loading**: Optional code-splitting with `LazyMotion`
4. **Hardware Acceleration**: Transform-based animations for GPU acceleration

## Compatibility Notes

While svelte-motion aims to provide the same API as Framer Motion, there are some Svelte-specific adaptations:

1. Components use Svelte's component model rather than React's
2. Event handling leverages Svelte's event system
3. Context is provided through Svelte's context API with DOM-based fallbacks
4. Some advanced features may have slightly different implementations due to framework differences

## Migration Pattern

When porting features from Framer Motion, the typical pattern is:

1. Implement the core logic in vanilla JavaScript
2. Create a Svelte component wrapper with equivalent props
3. Adapt React-specific patterns to Svelte patterns
4. Maintain the same external API for consistency