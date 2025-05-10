# Components Module

The `components` module in svelte-motion provides high-level components for animation orchestration, configuration, and functionality. These components facilitate advanced animation patterns like presence animations, shared layout animations, and motion configuration.

## AnimatePresence

`AnimatePresence` allows components to animate out when they're removed from the DOM.

```svelte
<script>
  import { AnimatePresence } from 'svelte-motion/components/AnimatePresence';
  import { Motion } from 'svelte-motion';
  
  let items = [{ id: 1, text: 'Item 1' }, { id: 2, text: 'Item 2' }];
</script>

<AnimatePresence>
  {#each items as item (item.id)}
    <Motion
      key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div>{item.text}</div>
    </Motion>
  {/each}
</AnimatePresence>
```

### Props

- `initial` (boolean): Whether to animate on first render (default: `true`)
- `exitBeforeEnter` (boolean): Wait for exiting elements to finish animating before entering elements start animating
- `onExitComplete` (function): Callback when all exiting nodes have completed animating out
- `presenceAffectsLayout` (boolean): Whether presence affects layout calculation (default: `true`)

### Hooks

- `usePresence`: Returns a tuple containing whether the component is present and an optional exit callback
- `useIsPresent`: Returns a boolean indicating if the component is present

## AnimateSharedLayout

Enables shared layout animations between components.

```svelte
<script>
  import { AnimateSharedLayout, Motion } from 'svelte-motion';
  
  let selected = 1;
</script>

<AnimateSharedLayout>
  <div class="container">
    {#each [1, 2, 3] as item}
      <Motion 
        layoutId={item === selected ? 'selected' : null}
        on:click={() => selected = item}
      >
        <div class="box">{item}</div>
      </Motion>
    {/each}
  </div>
</AnimateSharedLayout>
```

### Props

- `type` (string): Animation type, can be "crossfade" for smooth transitions between elements

## LazyMotion

Allows for code-splitting of animation features to reduce bundle size.

```svelte
<script>
  import { LazyMotion, m } from 'svelte-motion';
  import { domAnimation } from 'svelte-motion/features';
</script>

<LazyMotion features={domAnimation}>
  <m.div animate={{ scale: 1.2 }}>
    This will animate
  </m.div>
</LazyMotion>
```

### Props

- `features` (object or function): Either an object containing animation features or a function that returns a Promise resolving to those features
- `strict` (boolean): When true, an error will be thrown if a component tries to use a feature not included in `features`

## MotionConfig

Provides configuration settings to all descendant Motion components.

```svelte
<script>
  import { MotionConfig, Motion } from 'svelte-motion';
</script>

<MotionConfig transition={{ duration: 0.5 }}>
  <Motion animate={{ x: 100 }}>
    <div>This will use the custom transition duration</div>
  </Motion>
</MotionConfig>
```

### Props

- `transition` (object): Default transition settings for all children
- `transformPagePoint` (function): Function to transform measured points
- `isStatic` (boolean): Disable all animations and interaction if true

## MotionDiv

A convenience component that applies motion capabilities to a div element.

```svelte
<script>
  import { MotionDiv } from 'svelte-motion/components';
</script>

<MotionDiv 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 1 }}
>
  Content with motion
</MotionDiv>
```

This component accepts all standard div props as well as all motion props.

## Internal Components

The components folder also contains various internal components used by the main components:

- **PresenceChild**: Manages the lifecycle and animations of children within AnimatePresence
- **ScaleCorrectionProvider**: Handles scale correction for nested animations

## Usage Notes

1. These components are designed to work together - for example, using `AnimatePresence` with `Motion` components to create enter/exit animations.

2. For code-splitting benefits, use `LazyMotion` with the `m` component import rather than the standard `Motion` component.

3. `MotionConfig` is useful for providing consistent animation settings across an entire section of your application.

4. `AnimateSharedLayout` should wrap components that need to share layout animations identified by the same `layoutId`.