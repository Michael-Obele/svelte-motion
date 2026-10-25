/**
 * Spike: prove @opentui/core works under Bun 1.4.4 before the plan commits to it.
 *
 * Renders a tiny flexbox UI, resizes it programmatically, and reads back the
 * terminal size — the three things the CLI TUI depends on (render, layout,
 * resize). Exits 0 on success, 1 on failure. Run: `bun packages/cli/tests/spike/opentui-spike.ts`
 */
import { createCliRenderer, BoxRenderable, TextRenderable } from "@opentui/core";

const renderer = await createCliRenderer({ exitOnCtrlC: false });

const box = new BoxRenderable(renderer, {
  flexDirection: "row",
  flexGrow: 0,
  paddingLeft: 1,
  paddingTop: 0,
  paddingBottom: 0,
  paddingRight: 1,
});
box.add(new TextRenderable(renderer, { content: "svelte-motion spike" }));
renderer.root.add(box);

// Resize handling: the renderer reports accepted size changes on "resize".
let sawResize = false;
renderer.on("resize", () => {
  sawResize = true;
});

// Request a resize the way a real app would (e.g. on SIGWINCH). The resize
// event only fires when the size actually changes, so pick a size that is
// guaranteed different from the current one.
const before = { width: renderer.width, height: renderer.height };
const targetW = before.width === 80 ? 100 : 80;
const targetH = before.height === 24 ? 30 : 24;
renderer.requestResize(targetW, targetH);

// Give the renderer a tick to paint and process the resize.
await new Promise((resolve) => setTimeout(resolve, 250));

const size = { width: renderer.width, height: renderer.height };
const ok = sawResize && size.width === targetW && size.height === targetH;
const result = `SPIKE ${ok ? "PASS" : "FAIL"} (resize event: ${sawResize}, size: ${JSON.stringify(size)})`;

// Write the result to a file: after destroy() the alternate-buffer teardown
// can swallow anything printed to stdout, so a file is the reliable channel.
renderer.destroy();
await Bun.write("/tmp/opentui-spike-result.txt", result);
process.exit(ok ? 0 : 1);
