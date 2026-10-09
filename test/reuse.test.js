import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DITHER_FRAG } from '../src/shaders/dither.frag.js'
import { FULLSCREEN_VERTEX } from '../src/shaders/fullscreen.vert.js'
import { GLASS_FRAG } from '../src/shaders/glass.frag.js'
import { RAIN_FRAG } from '../src/shaders/rain.frag.js'
import { NOISE_FRAG } from '../src/shaders/noise.frag.js'
import { PROCEDURAL_SOURCES } from '../src/sources/procedural/index.js'

const sibling = (path) => new URL(`../../${path}`, import.meta.url)

test('fullscreen triangle keeps the GLOW vertex-id expansion', () => {
  assert.match(FULLSCREEN_VERTEX, /gl_VertexID << 1/)
  assert.match(FULLSCREEN_VERTEX, /p \* 2\.0 - 1\.0/)
  const glow = sibling('glow/src/shaders/background/glsl/fullscreen-triangle.vert.js')
  if (!existsSync(glow)) return
  assert.match(readFileSync(glow, 'utf8'), /gl_VertexID << 1/)
})

test('ordered dither keeps the Cartografías Bayer thresholds and gain', () => {
  assert.match(DITHER_FRAG, /0\.515625/)
  assert.match(DITHER_FRAG, /0\.140625/)
  assert.match(DITHER_FRAG, /dither8x8\(gl_FragCoord\.xy \/ scaleClean, color\) \* 3\.0/)
  assert.match(DITHER_FRAG, /vec3\(0\.3, 0\.6, 0\.1\)/)
  const source = sibling('cartografias-imposibles/src/postprocessing/OrderedDitherShader.js')
  if (!existsSync(source)) return
  const original = readFileSync(source, 'utf8')
  assert.match(original, /0\.515625/)
  assert.match(original, /gl_FragColor = dither8x8/)
})

test('glass and rain keep the GLOW shader bodies', () => {
  for (const line of [
    'return pow(1.0 - s * s * s * s, 0.25);',
    'float displacement = h * u_thickness * (tan(slopeAngle) - tan(thetaR));',
    'float shadowAlpha = u_shadow * shadowFalloff * 0.6;'
  ]) assert.ok(GLASS_FRAG.includes(line), line)
  assert.ok(GLASS_FRAG.includes('vec4 glass = glassLayer();'))
  assert.ok(RAIN_FRAG.includes('blob_noises_normal(t, u_noiseScale * p * r, u_sharpness)'))
  const glow = sibling('glow/src/glass-overlay-manager.js')
  if (!existsSync(glow)) return
  const original = readFileSync(glow, 'utf8')
  assert.ok(original.includes('float displacement = h * u_thickness * (tan(slopeAngle) - tan(thetaR));'))
  assert.ok(original.includes('Shadertoy 4ljXDy (CC BY-NC-SA 3.0)'))
})

test('procedural sources match their GLOW modules', () => {
  assert.deepEqual(PROCEDURAL_SOURCES.map((entry) => entry.modeValue), ['Portal', 'DiscoSunVortex', 'Balatro', 'ChromaGradients'])
  const files = ['portal', 'disco-sun', 'balatro', 'chroma-gradients']
  for (let i = 0; i < files.length; i++) {
    const glow = sibling(`glow/src/shaders/background/procedural/${files[i]}.js`)
    if (!existsSync(glow)) return
    assert.ok(readFileSync(glow, 'utf8').includes(PROCEDURAL_SOURCES[i].fragmentSource.slice(0, 400)), files[i])
  }
})

test('grain uses the grained.js keyframes, defaults, and stepped timing', () => {
  assert.ok(NOISE_FRAG.includes('vec2(-10.0, 10.0), vec2(-25.0, 0.0), vec2(-30.0, 10.0), vec2(-30.0, 30.0)'))
  assert.ok(NOISE_FRAG.includes('floor(phase * steps) / steps'))
  const grained = sibling('cartografias-imposibles/lib/grained.js')
  if (!existsSync(grained)) return
  const original = readFileSync(grained, 'utf8')
  for (const key of ['-10%,10%', '-25%,0%', '-30%,10%', '-30%,30%', '-15%,10%', '-5%,20%', '-25%,5%', '-30%,25%']) {
    assert.ok(original.includes(key), key)
  }
  assert.match(original, /grainChaos: 0\.5/)
  assert.match(original, /grainSpeed: 20/)
})
