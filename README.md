# LENTES

Experimental real-time video mixer for [Luminode Studio](https://luminode.studio/). LENTES is Laboratorio de experimentación nodal para transformación de espectros y señales.

LENTES mixes up to three sources (local cameras, GLOW procedural shaders, or Shadertoy code) on the GPU and runs them through a reorderable chain of effects. It is an instrument, not a timeline editor.

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

The bottom panel is the mixer. It works like GLOW's.

1. **Input strips.** Each strip has a source menu: a camera, a GLOW shader (Portal, Disco Sun Vortex, Balatro, Chroma gradients), a shader imported in the Shader Lab, or Off. Picking a camera connects it. The first pick asks for camera permission.
2. **Strip buttons.**
   - `INV` inverts colors, `↔` flips horizontally, `↕` flips vertically.
   - `M` mutes, `S` solos, and `A` / `B` assign the strip to a crossfade side.
   - The vertical fader is the input's weight in Blend mode.
3. **Mix section.** Choose Solo, X·Fade or Blend, a blend mode (normal, additive, multiply, difference), and the crossfader. Double-click the crossfader to center it.
4. **Effect chain.** Effects run left to right, between MIX and OUT.
   - Drag a node to reorder the chain.
   - Its `on` / `off` toggle bypasses the effect.
   - Click a node to edit it in the FX tab.
5. **Side panel tabs.**
   - **SOURCES:** per-input gain, saturation, hue, invert and flips; shader speed; camera format.
   - **FX:** the selected effect.
   - **LFO:** modulators.
   - **OUTPUT:** render size.
6. **On the stage.** The program monitor is proportionally contained in the available window; its badge shows output resolution and preview scale. The canvas still renders at the project's output resolution. Drag the glass pane (single mode), the shape mask, or the center of the displacement ripples directly on the output. Double-click or press `F` for fullscreen. `⌘I` / `Ctrl+I` hides the interface.

### Effects

| Effect | Notes |
| --- | --- |
| Color | Brightness / contrast / saturation on GLOW's 0–200 scale (100 = unchanged), threshold, posterize |
| Chromatic | GLOW's chromatic-aberration SVG filter as a shader (linear-light gains, offset red and blue, screen blend) |
| Glass | GLOW liquid glass: a single refracting pane, or a brick wall |
| Rain | GLOW rain screen refraction |
| Glass displacement | Shadertoy WXKyWc: a normal map shifts the picture and lights its slopes. The normals are ripples, noise, or beveled tiles |
| Mask | Circle, square, triangle, polygon, star, ring. Size, stretch, rotation, softness, invert. Outside is black, a color, or another input |
| Dither | Cartografías ordered Bayer dither and GLOW table crush |
| Grain | grained.js grain (pattern, density, grain size, opacity, chaos, steps), as in GLOW and Cartografías |
| Overlay | Flat color in multiply, screen, overlay, difference, or additive |

### Shader Lab

**Lab → Shader Lab…** (`⇧⌘L`), or *Import from Shadertoy…* in a strip's source menu, takes Shadertoy code:

- Paste the **Image** tab. Only code is imported. Textures, buffers, keyboard and audio channels are not.
- `iChannel0`–`iChannel2` are inputs 1–3 after their operations (an input that samples itself sees its previous frame). `iChannel3` is black. `iMouse` stays at zero.
- The preview recompiles as you type. Its channels show a test card. Compile errors are listed with the line numbers of your code.
- **Apply to project** (`⌘↵`) keeps the shader in the project. **Use on input 1/2/3** applies it and puts it on that input. Speed in the SOURCES tab scales its `iTime`.
- A project holds up to 16 shaders of up to 64 KB each.

### LFO

Add LFOs in the LFO tab (MUSGO's modulation system).

- **Waveforms:** sine, square, triangle, sawtooth, or a cubic-bezier curve.
- **Targets:** any slider or switch in the mixer (crossfade, faders), the sources (gain, hue, saturation, shader speed, invert, flips), and every effect, including turning an effect on and off.
- **Controls:** rate, depth and offset. Switch targets also have a threshold.
- **Monitor:** a live waveform display for each LFO.

Modulation is applied only while drawing a frame. It never changes the saved values.

### Undo

**Edit → Undo / Redo** (`⌘Z`, `⇧⌘Z`, `Ctrl+Y`) and **Edit → History…** follow MUSGO:

- History keeps the last 20 moments for each project.
- Edits are committed half a second after they settle.
- History is kept in this browser.

## Projects

Projects are pretty-printed JSON with a `.lentes` extension. The schema version is `3`. Older files upgrade on open: version 2 gains an empty shader list; in version 1 files noise becomes the grained.js grain, and the new effects are added switched off. Files saved as `.lente` open after renaming them to `.lentes`.

- **File → New / Open / Save / Save As**, or `⌘N` `⌘O` `⌘S` `⇧⌘S`
- Drop a `.lentes` file on the window
- Recent projects are remembered in this browser

A project stores:

- the sources (camera device ids as hints, shader choices, per-source operations);
- the mixer, including faders and mutes;
- effect order and parameters;
- LFOs;
- imported Shadertoy code;
- the output size.

It does not store camera streams. If a camera is missing on another machine, everything else still loads and that input is marked unavailable.

Browsers with the File System Access API write the file in place. Others download it, and open through the file picker.

## Layout

```
src/inputs/        cameras and device enumeration
src/sources/       GLOW procedural shaders and the Shadertoy wrapper used as inputs
src/mixer/         blend math shared with the mix shader
src/renderer/      one WebGL2 context, ping-pong framebuffers
src/effects/       effect registry: parameter schemas, independent of the UI
src/shaders/       fullscreen passes
src/modulation/    LFOs and their targets
src/history/       undo / redo memento stack
src/projects/      .lentes schema, migrations, file menu
src/ui/            menu, mixer strips, effect chain, Tweakpane tabs, modals
```

The render order is:

1. sources (camera texture, or a procedural or Shadertoy shader rendered into a framebuffer);
2. a per-source pass (fit, flips, gain, saturation, hue, invert);
3. the mixer;
4. the effect chain, in `effects` array order;
5. the canvas.

Bypassed passes, and a color grade sitting at identity, are skipped.

`scripts/pipeline-smoke.html` and `scripts/ui-smoke.html` are browser checks. Open them from the local server and read the `data-*` attributes on `#result`.

The proposed reusable desktop host for publishing Luminode Studio apps through
Syphon on macOS and Spout on Windows is documented in
[`docs/luminode-studio-host.md`](docs/luminode-studio-host.md).

## Provenance

| From | Used here |
| --- | --- |
| GLOW | Glass and rain shaders, procedural sources, chromatic-aberration filter, effect chain UI, mixer strips and vertical faders, color levels, blend-mode names, app menu, JSON projects |
| MUSGO | LFO system and tab, undo history and history modal, Edit menu, tab styling, IBM Plex / Analo Grotesk type |
| Cartografías Imposibles | Ordered Bayer dither (with the ×3 gain), SVG table-value mapping, grained.js grain |
| Luminode Studio | Suite cursor |

GLOW is GPL-3.0. LENTE is GPL-3.0-or-later. The Rain and Disco Sun Vortex shaders are CC BY-NC-SA and Analo Grotesk is a trial font; see `NOTICE.md`.

## Limits

- Three sources. No network streaming, no video files yet.
- Practical target is about 720p30 per camera. 1080p depends on the machine. Each shader source renders at output size.
- Effects are global. Per-input effect chains are not built yet.
- Ocean refraction is not implemented. MUSGO's water is a Three.js `Water` object plus mesh displacement, not a reusable 2D field.
- Device ids are not stable across computers, and some browsers hide labels until permission is granted.
- Faders follow the saved value; they do not move with LFO modulation.
