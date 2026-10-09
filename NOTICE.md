LENTE
Copyright (C) 2026 Rafael Becerra

This program is free software under the GNU General Public License,
version 3 or later. See LICENSE.

The ordered-dither Bayer matrices and the * 3.0 gain are adapted from
Cartografías Imposibles (`OrderedDitherShader`), which credits
https://github.com/samwhitford/threejs-ordered-dithering-effect (MIT).

The value-noise functions are adapted from GLOW
(`src/shaders/background/glsl/simplex-noise-3d.js`).

Brightness, contrast, and saturation use the same 0–200 levels as GLOW's
canvas filters, where 100 is unchanged.

Table-value mapping (`v` → `v (1-v)`) follows GLOW and Cartografías.

Tweakpane is included under the MIT license:
https://github.com/cocopon/tweakpane
