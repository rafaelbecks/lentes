LENTE
Copyright (C) 2026 Rafael Becerra

This program is free software under the GNU General Public License,
version 3 or later. See LICENSE.

## Code adapted from the Luminode Studio projects

From GLOW (GPL-3.0):

- Fullscreen triangle vertex shader.
- Liquid glass refraction shader (`src/glass-overlay-manager.js`), run here
  as a chain pass.
- Effect chain UI (`src/components/effect-chain-ui.js`) and mixer strip /
  vertical fader styles (`src/styles/mixer-panel.css`).
- Procedural sources Portal, Disco Sun Vortex, Balatro, and Chroma gradients
  (`src/shaders/background/procedural/`), plus the simplex noise they use.
- Chromatic aberration, ported from the `#chromaticAberrationFilter` SVG
  filter in `index.html`.
- Brightness / contrast / saturation levels (0–200, 100 = unchanged), blend
  mode names, the app menu, and the `.glow`-style JSON project flow.

From MUSGO (MIT): the LFO modulation system and its Tweakpane UI, the
memento undo history and its history modal, the app-menu Edit section, tab
styling, and the type choices (IBM Plex Sans / Mono, Analo Grotesk titles).

From Cartografías Imposibles (MIT): ordered-dither Bayer matrices and the
* 3.0 gain (`OrderedDitherShader`, which credits
https://github.com/samwhitford/threejs-ordered-dithering-effect, MIT), and
the SVG table-value mapping (`v` → `v (1-v)`), also used by GLOW.

The Luminode Studio cursor (`assets/cursor.svg`) is shared by the suite.

## Third-party work

- Grain follows grained.js by Sarath Saleem (MIT),
  https://github.com/sarathsaleem/grained. The pattern, keyframes, and
  stepped timing are reimplemented as a shader; no grained.js code ships.
- Rain Screen by Jakob Thomsen, Shadertoy 4ljXDy, licensed
  CC BY-NC-SA 3.0 (non-commercial, share-alike).
- Disco Sun Vortex by @WorkingClassHacker / @Frostbyte (Shadertoy
  community), licensed CC BY-NC-SA 4.0 (non-commercial, share-alike).
- Balatro background after the game by localthunk
  (https://www.playbalatro.com).
- 2D signed distance functions for the shape mask after Inigo Quilez,
  https://iquilezles.org/articles/distfunctions2d/ (MIT).
- Tweakpane and the Tweakpane essentials and waveform plugins, MIT,
  https://github.com/cocopon/tweakpane. The plugin bundles in `src/lib/`
  are copied from MUSGO.
- IBM Plex is loaded from Google Fonts (SIL Open Font License 1.1).
- `fonts/AnaloGrotesk-Trial-*` is the trial cut of Analo Grotesk, copied
  from MUSGO. Check its license before a commercial release.

The CC BY-NC-SA shaders (Rain, Disco Sun Vortex) are not covered by the GPL.
Remove them before any commercial use.
