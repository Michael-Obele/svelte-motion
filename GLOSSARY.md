# Svelte Motion

The words this project uses, and what they mean here. A glossary only.

## Composition and time

**Composition**: A video definition: a Svelte component plus the metadata needed to render it. It is the unit the registry lists and the renderer selects.
_Avoid_: video, animation (both are the result; a composition is the definition).

**Composition config**: The metadata half of a composition: id, component, width, height, fps, duration, default props, and optional props schema. It describes the video; it does not contain its frames.
_Avoid_: composition (the config is one part of a composition, not the whole).

**Frame**: One discrete moment in a composition, identified by an integer index. Frames are the unit of rendering and playback.
_Avoid_: tick, step, timestamp (a frame is not a time; fps maps one to the other).

**Frame range**: The valid frame indices for a composition: 0 through durationInFrames - 1, inclusive. A duration of N frames contains N frames, and the last one is N - 1.
_Avoid_: frame count, duration (the count and the range are related, but a time is not a frame).

**Motion context**: The frame-scoped state shared down a composition tree: current frame, fps, width, height, duration, readiness, and the sequence timeline. Children read it instead of receiving the frame as a prop.

**Motion root**: The component that creates a motion context and gives everything inside it its initial frame and video config. It is the boundary where a host hands control to a composition.

**Sequence**: A time window inside a composition. It gives its children a local frame measured from its start and hides them outside its duration. Sequences can nest.

**Series**: A row of Sequences placed one after another. Each child starts where the previous one ended, and the series computes the offsets.

**Loop**: A wrapper that repeats its children's time window, so the local frame cycles instead of advancing past the end.

**Freeze**: A wrapper that pins its children to one frame, so they do not animate for the duration of the freeze.

## Playback and hosting

**Player**: The Svelte component that plays a composition in a page. It advances frames at the composition's fps and exposes transport controls and a scrubber.

**Player surface**: The pixels the Player paints into, as distinct from the Player component and its controls. "Player" with a capital P is the component; "player surface" is the pixels.
_Avoid_: player, when you mean the surface (say which one you mean).

**Session (playback)**: One continuous run of playback for a composition at a particular configuration: play, pause, seek, loop. A new composition or a new init-only configuration starts a new session; moving the frame does not.

**Render host**: The browser surface the renderer drives to capture frames. It paints one composition at one frame, with no chrome and no interaction.

**Player host**: The browser surface that mounts a Player for preview or for the player-parity check. It is a page, not the Player component.

**Pixel surface**: A page or region whose only job is to paint composition pixels at an exact size, with no Studio chrome. The render host and the player host are pixel surfaces; the Studio is not.

**Renderer**: The Node-side program that serves a built app, drives a headless browser frame by frame, and encodes the captured pixels into a video file. It is not part of the browser bundle.
_Avoid_: render host (the renderer drives the host; they are different sides of the same capture).

**Studio**: The authoring environment: pick a composition, preview it, scrub, inspect the timeline, edit props. It is a tool around the pixel surfaces, not a pixel surface itself.

**Studio chrome**: The interface around the preview: picker, transport, scrubber, timeline, props editor, shortcuts. It is everything in the Studio that is not the composition's own pixels.

**Environment flag**: A value set by the host before the app loads that tells the runtime which shell it is in: Studio, renderer, or Player. A flag describes the host; it is not a composition prop and it is not reactive state.

## Rendering and readiness

**Readiness handshake**: The agreement between a composition and its host that capture waits until the composition says it is ready. The composition reports pending work; the host captures only when none remains.

**delayRender handle**: A token that marks one piece of asynchronous work as pending. The composition holds it until the work finishes, then releases it. Readiness means no open handles.

**Determinism**: The property that the same composition, props, and frame always produce the same pixels, no matter when, where, or how many times the render runs. It is about identical inputs, not about matching another engine.

**Capture**: The act of taking one screenshot of a pixel surface at one frame. Rendering is capture repeated over the frame range, then encoding.

**Encode**: Turning captured frames into a video file. Encoding comes after capture and does not change what a frame looks like.

**Render (verb)**: To capture every frame of a composition and encode them into a video file. It is the whole job, not one screenshot.
_Avoid_: using "render" for a single capture.

**`/render` (route)**: The URL path of the render host: a page that paints one composition at one frame for the renderer to capture. Visiting it does not render a video.

## Authoring and data

**Composition registry**: The collection of compositions an app exposes, discovered from the app's composition files rather than registered by hand. The registry is what the Studio lists and the CLI selects from.

**Props schema**: A validation schema attached to a composition that describes the shape of its props. It can reject invalid input and can transform or default values.

**Validated output**: The value a props schema produces after validation, including its transforms and defaults. It is not the raw input and not the raw parsed object; it is what the composition actually receives.

**Default props**: The props a composition uses when the host supplies none. They are separate from defaults applied inside a props schema.

## Pairs that are often confused

- **Player** is the component; **player surface** is the pixels. The surface can exist without the Player when the render host is being captured.
- **Render** is the verb for the whole job; **`/render`** is a route that paints a single frame. A request to `/render` is part of a render, not a render.
- **Renderer** is the Node program; **render host** is the page it drives. Neither one is the other.
- **Composition** is the whole definition; **composition config** is only its metadata.
- **Duration** is a count of frames; **frame range** is the set of valid indices. A duration of 90 gives the range 0 to 89.
