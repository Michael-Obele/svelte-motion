# Svelte Motion `src/components/MotionConfig` Directory Documentation

This directory contains the implementation for the `MotionConfig` component, which allows developers to set default properties and behaviors for all descendant `motion` components within its scope.

## Overview

`MotionConfig` provides a way to configure common settings, such as default transition types or orchestrations, without needing to specify them on every single `motion` component. It leverages Svelte's context API (`MotionConfigContext`) to pass these configurations down the component tree. This promotes consistency and simplifies the application of animations. It also plays a role in configuring features like scale correction, often necessary for smooth layout animations.

## Files & Components

*   **`MotionConfig.svelte`**: The main user-facing Svelte component. Developers wrap parts of their application with `MotionConfig` and pass props (like `transition`) to define the shared configuration. It sets the `MotionConfigContext` with these values.
*   **`MotionConfigScaleCorrection.js`**: Contains logic specifically related to providing scale correction context down the tree. Scale correction is important during layout animations (`AnimateSharedLayout`) to ensure child elements maintain their apparent size and shape even when the parent is scaling or transforming. This likely interacts with or sets the `ScaleCorrectionContext`.
*   **`index.js`**: Exports the main `MotionConfig` component for use in applications.