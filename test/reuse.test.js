import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DITHER_FRAG } from '../src/shaders/dither.frag.js'
import { FULLSCREEN_VERTEX } from '../src/shaders/fullscreen.vert.js'
import { VALUE_NOISE_GLSL } from '../src/shaders/value-noise.js'

test('fullscreen triangle keeps the GLOW vertex-id expansion', () => {
  assert.match(FULLSCREEN_VERTEX, /gl_VertexID << 1/)
  assert.match(FULLSCREEN_VERTEX, /p \* 2\.0 - 1\.0/)
  const glow = new URL('../../glow/src/shaders/background/glsl/fullscreen-triangle.vert.js', import.meta.url)
  if (!existsSync(glow)) return
  assert.match(readFileSync(glow, 'utf8'), /gl_VertexID << 1/)
})

test('ordered dither keeps the Cartografías Bayer thresholds and gain', () => {
  assert.match(DITHER_FRAG, /0\.515625/)
  assert.match(DITHER_FRAG, /0\.140625/)
  assert.match(DITHER_FRAG, /dither8x8\(gl_FragCoord\.xy \/ scaleClean, color\) \* 3\.0/)
  assert.match(DITHER_FRAG, /vec3\(0\.3, 0\.6, 0\.1\)/)
  const source = new URL('../../cartografias-imposibles/src/postprocessing/OrderedDitherShader.js', import.meta.url)
  if (!existsSync(source)) return
  const original = readFileSync(source, 'utf8')
  assert.match(original, /0\.515625/)
  assert.match(original, /gl_FragColor = dither8x8/)
})

test('grain noise keeps the GLOW value-noise hash', () => {
  assert.match(VALUE_NOISE_GLSL, /fract\(sin\(n\) \* 43758\.5453\)/)
  assert.match(VALUE_NOISE_GLSL, /float snoise\(vec3 v\)/)
  const glow = new URL('../../glow/src/shaders/background/glsl/simplex-noise-3d.js', import.meta.url)
  if (!existsSync(glow)) return
  assert.match(readFileSync(glow, 'utf8'), /43758\.5453/)
})
