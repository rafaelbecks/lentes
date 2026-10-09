# LENTE

Experimental real-time video mixer for [Luminode Studio](https://luminode.studio/). The name is LENTE. Its Spanish acronym is not finalized.

LENTE captures up to three local cameras, mixes them on the GPU, and runs a small stack of effects. It is an instrument, not a timeline editor.

## Run

Cameras need a secure context. Serve the folder over localhost (do not open `index.html` as a file).

```sh
npm install
npm start
```

Then open http://127.0.0.1:8010/

```sh
npm test
npm run lint
```

## Use

1. Choose a camera on an input and press Connect. Allow the browser when it asks. The other inputs can stay empty.
2. Mix with Solo, Crossfade, or Blend. Blend modes are normal, additive, multiply, and difference.
3. Color uses the same brightness, contrast, and saturation levels as GLOW: **100** leaves the image unchanged. Threshold and posterize sit in that pass.
4. Texture holds ordered dither (from Cartografías) and value-noise grain (from GLOW). Effects holds the color overlay and the pass order.
5. Double-click the preview, or press `F`, for fullscreen. `⌘I` / `Ctrl+I` hides the interface.

Output defaults to 1280×720. 1080p is in the OUTPUT folder. Reconnect an input after changing its requested size or frame rate.

## Projects

Projects are pretty-printed JSON with a `.lente` extension. Schema version is `1`.

- **File → New / Open / Save / Save As**, or `⌘N` `⌘O` `⌘S` `⇧⌘S`
- Drop a `.lente` file on the window
- Recent projects are remembered in this browser

A project stores mixer settings, effect order and parameters, output size, and camera device ids as hints. It does not store camera streams. If a camera is missing on another machine, the mix and effects still load and that input is marked unavailable.

Browsers with the File System Access API write the file in place. Others download it, and open through the file picker.

## Layout

```
src/inputs/       cameras and device enumeration
src/mixer/        blend math shared with the mix shader
src/renderer/     one WebGL2 context, ping-pong framebuffers
src/effects/      parameter schemas, independent of the UI
src/shaders/      fullscreen passes
src/projects/     .lente schema, migrations, file menu
src/ui/           menu, Tweakpane, input strip
```

The render order is: camera textures → mixer → effect stack → canvas. Effect order is the `effects` array in the project file. Passes that are off, and a color grade sitting at identity, are skipped.

## Provenance

| From | Used here |
| --- | --- |
| GLOW | Fullscreen triangle, value noise, brightness/contrast/saturation levels, blend-mode names, Tweakpane theme, File menu and `.glow`-style JSON projects |
| Cartografías Imposibles | Ordered Bayer dither (`OrderedDitherShader`, including the ×3 gain) and the SVG table-value mapping |
| MUSGO | Perlin/FBM and the ocean stay in the Three.js scene. Not imported. The effect contract has an `auxiliary` list for a future distortion texture. |

GLOW is GPL-3.0. LENTE is GPL-3.0-or-later. The dither matrices remain MIT; see `NOTICE.md`.

## Limits

- Three local cameras. No network streaming, no video files yet.
- Practical target is about 720p30 per camera. 1080p depends on the machine.
- Dither, grain, and overlay are global. Per-input effect chains are not built yet.
- Ocean refraction is not implemented. MUSGO's water is a Three.js `Water` object plus mesh displacement, not a reusable 2D field.
- Device ids are not stable across computers, and some browsers hide labels until permission is granted.
- `grained.js` is not bundled. Grain is the GLOW value-noise shader, with opacity and speed in the same spirit as the Cartografías overlay.
