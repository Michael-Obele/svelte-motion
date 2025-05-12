# Svelte Motion `src/gestures/utils` Directory Documentation

This directory contains utility functions supporting the gesture recognition logic found in the parent `src/gestures` directory.

## Overview

These utilities provide helper functionalities specifically needed for implementing and managing various gestures like tap, pan, hover, and drag.

## Files

*   **`event-type.js`**: Exports constants or functions related to identifying or classifying event types (e.g., distinguishing between touch, mouse, or pen events within the Pointer Events system). This helps in normalizing event handling across different input methods.
*   **`is-node-or-child.js`**: Exports a utility function (`isNodeOrChild`) that likely checks if a given DOM node is the same as, or a descendant of, another specified DOM node. This can be useful in gesture handling to determine event propagation boundaries or check if an interaction occurred within a specific element's subtree.