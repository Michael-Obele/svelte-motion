# Architecture decision records

The decisions that are hard to reverse, surprising without context, and the result of a real trade-off. Everything else lives in `plan/decisions.md`.

| ADR                                                                  | Decision                                                         | Status                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| [0001](./0001-clean-room-math-kernels-and-mit.md)                    | Clean-room math kernels; the product stays MIT                   | Accepted, planned     |
| [0002](./0002-programmatic-video-for-sveltekit.md)                   | Programmatic video for SvelteKit, not a Remotion clone           | Accepted              |
| [0003](./0003-one-frame-range-policy.md)                             | One frame range, `[0, durationInFrames - 1]`                     | Accepted, implemented |
| [0004](./0004-browser-core-node-renderer-boundary.md)                | Browser core and Node renderer stay separate packages            | Accepted              |
| [0005](./0005-svelte-built-in-motion-is-an-interaction-primitive.md) | Built-in motion is an interaction primitive; the frame owns time | Accepted, implemented |

Glossary: [`../../GLOSSARY.md`](../../GLOSSARY.md).
