# Svelte Motion `src/components/AnimatePresence` Directory Documentation

This directory contains the implementation for the `AnimatePresence` component, a key feature in `svelte-motion` for handling animations when components are mounted or unmounted from the Svelte component tree.

## Overview

`AnimatePresence` allows components to animate out gracefully before they are removed from the DOM. It works by tracking its direct children. When a child is removed, `AnimatePresence` keeps it in the DOM until its exit animation (defined via the `exit` prop on the child `motion` component) completes. It uses the `PresenceContext` to communicate the mounting/unmounting status to its children.

## Files & Components

*   **`AnimatePresence.svelte`**: The main user-facing Svelte component. Developers wrap conditionally rendered `motion` components with `AnimatePresence`. It sets up the `PresenceContext` and manages the lifecycle of its children, delaying removal for exit animations.
*   **`PresenceChild.svelte` / `PresenceChild.js`**: Internal helper component or logic module. Each direct child placed inside `AnimatePresence` is likely wrapped by this logic. It registers with the parent `AnimatePresence`, listens to the `PresenceContext`, and handles the specific exit animation sequence for that individual child.
*   **`index.js`**: Exports the main `AnimatePresence` component for use in applications.
*   **`use-presence.js`**: Exports the `usePresence` and `useIsPresent` hooks. These hooks are consumed by `motion` components (or `PresenceChild`) nested within `AnimatePresence`.
    *   `usePresence`: Returns whether the component is currently present and potentially an `onExitComplete` callback to notify `AnimatePresence` when the exit animation finishes.
    *   `useIsPresent`: Returns a boolean `MotionValue` or reactive state indicating if the component is currently considered "present" (not exiting). This is useful for triggering animations based on presence state.