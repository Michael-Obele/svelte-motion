# Svelte Motion `src/events` Directory Documentation

This directory contains modules focused on handling DOM events, particularly pointer events, which are fundamental for building gesture recognizers in `svelte-motion`.

## Overview

The logic here provides abstractions over raw browser events, making it easier to manage event listeners and interpret event data, especially across different input devices (mouse, touch, pen). It forms the base layer upon which gestures like tap, pan, and drag are built.

## Files

*   **`event-info.js`**: Exports utilities or classes (`EventInfo`) for normalizing and processing event information, likely abstracting differences between mouse and touch events into a consistent format (`Point`).
*   **`use-dom-event.js`**: Exports the `useDomEvent` hook (and potentially related utilities). This hook likely simplifies the process of adding and removing event listeners to DOM elements, integrating with Svelte's lifecycle or the library's internal update mechanisms.
*   **`use-pointer-event.js`**: Exports the `usePointerEvent` hook. This specializes in handling Pointer Events, providing a unified way to listen for interactions from various pointer types and manage their state.
*   **`utils.js`**: Contains general utility functions specific to event handling within `svelte-motion`.

## Svelte Components

*   **`UseDomEvent.svelte`**: A Svelte component wrapper around the `useDomEvent` hook, possibly used internally or for specific component-based event listener patterns.
*   **`UsePointerEvent.svelte`**: A Svelte component wrapper around the `usePointerEvent` hook, providing a component interface for pointer event handling.