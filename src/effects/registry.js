/**
 * Effect contract. Parameters live here, not in the UI.
 * Each effect is one fullscreen pass over the previous result; the chain
 * order is the order of `state.effects`. `auxiliary` is reserved for future
 * distortion fields (for example MUSGO / Cartografías ocean normals).
 * Slider and boolean params are LFO targets unless `modulate: false`.
 */

export const EFFECT_DEFINITIONS = [
  {
    id: 'color',
    name: 'Color',
    label: 'COLOR',
    description: 'Brightness, contrast, and saturation (GLOW filter levels, 100 = unchanged), plus threshold and posterize.',
    enabled: true,
    auxiliary: [],
    defaults: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      threshold: 0,
      posterize: 0
    },
    params: [
      { key: 'brightness', label: 'Brightness', type: 'slider', min: 0, max: 200, step: 1 },
      { key: 'contrast', label: 'Contrast', type: 'slider', min: 0, max: 200, step: 1 },
      { key: 'saturation', label: 'Saturation', type: 'slider', min: 0, max: 200, step: 1 },
      { key: 'threshold', label: 'Threshold', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'posterize', label: 'Posterize', type: 'slider', min: 0, max: 16, step: 1 }
    ]
  },
  {
    id: 'chromatic',
    name: 'Chromatic aberration',
    label: 'CHROMA',
    description: 'GLOW’s chromatic-aberration SVG filter: boosted red shifted one way, green and blue the other, screen-blended.',
    enabled: false,
    auxiliary: [],
    defaults: {
      amount: 1,
      redShift: 2,
      blueShift: -3,
      redGain: 4,
      greenGain: 3,
      blueGain: 10
    },
    params: [
      { key: 'amount', label: 'Amount', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'redShift', label: 'Red shift', type: 'slider', min: -30, max: 30, step: 0.5 },
      { key: 'blueShift', label: 'Blue shift', type: 'slider', min: -30, max: 30, step: 0.5 },
      { key: 'redGain', label: 'Red gain', type: 'slider', min: 0, max: 12, step: 0.1 },
      { key: 'greenGain', label: 'Green gain', type: 'slider', min: 0, max: 12, step: 0.1 },
      { key: 'blueGain', label: 'Blue gain', type: 'slider', min: 0, max: 12, step: 0.1 }
    ]
  },
  {
    id: 'glass',
    name: 'Glass',
    label: 'GLASS',
    description: 'GLOW liquid glass: a rounded refracting pane (drag it on the stage) or a tiled brick wall.',
    enabled: false,
    auxiliary: [],
    defaults: {
      mode: 'single',
      centerX: 0.5,
      centerY: 0.5,
      width: 200,
      height: 200,
      radius: 27,
      thickness: 200,
      bezel: 60,
      ior: 3,
      blur: 9.5,
      specular: 0.35,
      tint: 0,
      shadow: 0,
      brickSize: 200,
      brickOffsetX: 0,
      brickOffsetY: 0,
      brickGap: 8
    },
    params: [
      { key: 'mode', label: 'Mode', type: 'list', options: { Single: 'single', Bricks: 'bricks' } },
      { key: 'centerX', label: 'Center X', type: 'slider', min: 0, max: 1, step: 0.001 },
      { key: 'centerY', label: 'Center Y', type: 'slider', min: 0, max: 1, step: 0.001 },
      { key: 'width', label: 'Width', type: 'slider', min: 20, max: 1920, step: 1 },
      { key: 'height', label: 'Height', type: 'slider', min: 20, max: 1080, step: 1 },
      { key: 'radius', label: 'Radius', type: 'slider', min: 0, max: 400, step: 1 },
      { key: 'thickness', label: 'Thickness', type: 'slider', min: 0, max: 600, step: 1 },
      { key: 'bezel', label: 'Bezel', type: 'slider', min: 1, max: 300, step: 1 },
      { key: 'ior', label: 'IOR', type: 'slider', min: 1, max: 5, step: 0.01 },
      { key: 'blur', label: 'Blur', type: 'slider', min: 0, max: 40, step: 0.1 },
      { key: 'specular', label: 'Specular', type: 'slider', min: 0, max: 2, step: 0.01 },
      { key: 'tint', label: 'Frost', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'shadow', label: 'Shadow', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'brickSize', label: 'Brick size', type: 'slider', min: 20, max: 800, step: 1 },
      { key: 'brickOffsetX', label: 'Brick offset X', type: 'slider', min: -400, max: 400, step: 1 },
      { key: 'brickOffsetY', label: 'Brick offset Y', type: 'slider', min: -400, max: 400, step: 1 },
      { key: 'brickGap', label: 'Brick gap', type: 'slider', min: 0, max: 100, step: 1 }
    ]
  },
  {
    id: 'rain',
    name: 'Rain',
    label: 'RAIN',
    description: 'GLOW rain screen: blob-noise normals refract the picture. Shader by Jakob Thomsen (CC BY-NC-SA 3.0).',
    enabled: false,
    auxiliary: [],
    defaults: {
      distortion: 0.05,
      scale: 25,
      timeScale: 1,
      patternDrift: 0.1,
      sharpness: 1
    },
    params: [
      { key: 'distortion', label: 'Distortion', type: 'slider', min: 0, max: 0.3, step: 0.001 },
      { key: 'scale', label: 'Scale', type: 'slider', min: 1, max: 80, step: 0.1 },
      { key: 'timeScale', label: 'Speed', type: 'slider', min: 0, max: 4, step: 0.01 },
      { key: 'patternDrift', label: 'Drift', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'sharpness', label: 'Sharpness', type: 'slider', min: 0.1, max: 8, step: 0.01 }
    ]
  },
  {
    id: 'displace',
    name: 'Glass displacement',
    label: 'DISPLACE',
    description: 'Shadertoy WXKyWc (after Three.js Journey lesson 45): a normal map pushes the picture sideways and lights the slopes. The normals are drawn here as ripples (drag the center), noise, or tiles.',
    enabled: false,
    auxiliary: [],
    defaults: {
      pattern: 'ripple',
      strength: 0.1,
      scale: 6,
      relief: 1,
      bevel: 0.3,
      speed: 0.25,
      light: 1,
      lightAngle: 135,
      centerX: 0.5,
      centerY: 0.5
    },
    params: [
      { key: 'pattern', label: 'Normals', type: 'list', options: { Ripples: 'ripple', Noise: 'noise', Tiles: 'tiles' } },
      { key: 'strength', label: 'Strength', type: 'slider', min: 0, max: 0.5, step: 0.001 },
      { key: 'scale', label: 'Scale', type: 'slider', min: 0.5, max: 40, step: 0.1 },
      { key: 'relief', label: 'Relief', type: 'slider', min: 0, max: 4, step: 0.01 },
      { key: 'bevel', label: 'Tile bevel', type: 'slider', min: 0.02, max: 1, step: 0.01 },
      { key: 'speed', label: 'Speed', type: 'slider', min: 0, max: 4, step: 0.01 },
      { key: 'light', label: 'Light', type: 'slider', min: 0, max: 3, step: 0.01 },
      { key: 'lightAngle', label: 'Light angle', type: 'slider', min: 0, max: 360, step: 1 },
      { key: 'centerX', label: 'Center X', type: 'slider', min: 0, max: 1, step: 0.001 },
      { key: 'centerY', label: 'Center Y', type: 'slider', min: 0, max: 1, step: 0.001 }
    ]
  },
  {
    id: 'mask',
    name: 'Shape mask',
    label: 'MASK',
    description: 'Keep the picture inside a shape (drag it on the stage). Outside shows black, a color, or another source.',
    enabled: false,
    auxiliary: [],
    defaults: {
      shape: 'circle',
      centerX: 0.5,
      centerY: 0.5,
      size: 0.6,
      stretch: 1,
      rotation: 0,
      sides: 5,
      softness: 0.01,
      invert: false,
      outside: 'black',
      color: '#000000'
    },
    params: [
      {
        key: 'shape',
        label: 'Shape',
        type: 'list',
        options: {
          Circle: 'circle',
          Square: 'square',
          Triangle: 'triangle',
          Polygon: 'polygon',
          Star: 'star',
          Ring: 'ring'
        }
      },
      { key: 'centerX', label: 'Center X', type: 'slider', min: 0, max: 1, step: 0.001 },
      { key: 'centerY', label: 'Center Y', type: 'slider', min: 0, max: 1, step: 0.001 },
      { key: 'size', label: 'Size', type: 'slider', min: 0.02, max: 2, step: 0.001 },
      { key: 'stretch', label: 'Stretch', type: 'slider', min: 0.2, max: 5, step: 0.01 },
      { key: 'rotation', label: 'Rotation', type: 'slider', min: -180, max: 180, step: 0.5 },
      { key: 'sides', label: 'Sides', type: 'slider', min: 3, max: 12, step: 1 },
      { key: 'softness', label: 'Softness', type: 'slider', min: 0, max: 0.5, step: 0.001 },
      { key: 'invert', label: 'Invert', type: 'boolean' },
      {
        key: 'outside',
        label: 'Outside',
        type: 'list',
        options: { Black: 'black', Color: 'color', 'Input 1': 'input1', 'Input 2': 'input2', 'Input 3': 'input3' }
      },
      { key: 'color', label: 'Color', type: 'color' }
    ]
  },
  {
    id: 'dither',
    name: 'Dither',
    label: 'DITHER',
    description: 'Ordered Bayer dither from Cartografías, plus the SVG table crush used by GLOW.',
    enabled: false,
    auxiliary: [],
    defaults: {
      mapSize: 4,
      scale: 4,
      amount: 1,
      saturate: 1,
      crush: 0,
      tableR: 0,
      tableG: 0,
      tableB: 0
    },
    params: [
      { key: 'mapSize', label: 'Map', type: 'list', options: { '2×2': 2, '4×4': 4, '8×8': 8 } },
      { key: 'scale', label: 'Scale', type: 'slider', min: 0.5, max: 16, step: 0.5 },
      { key: 'amount', label: 'Amount', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'saturate', label: 'Saturate', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'crush', label: 'Table crush', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'tableR', label: 'Red table', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'tableG', label: 'Green table', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'tableB', label: 'Blue table', type: 'slider', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    id: 'noise',
    name: 'Grain',
    label: 'GRAIN',
    description: 'grained.js film grain (GLOW, Cartografías): a tiled gray pattern that jumps through stepped keyframes.',
    enabled: false,
    auxiliary: [],
    defaults: {
      animate: true,
      opacity: 0.05,
      patternWidth: 100,
      patternHeight: 100,
      density: 1,
      grainWidth: 1,
      grainHeight: 1,
      chaos: 0.5,
      speed: 20,
      seed: 0
    },
    params: [
      { key: 'animate', label: 'Animate', type: 'boolean' },
      { key: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'patternWidth', label: 'Pattern W', type: 'slider', min: 10, max: 400, step: 1 },
      { key: 'patternHeight', label: 'Pattern H', type: 'slider', min: 10, max: 400, step: 1 },
      { key: 'density', label: 'Density', type: 'slider', min: 1, max: 10, step: 1 },
      { key: 'grainWidth', label: 'Grain W', type: 'slider', min: 0.5, max: 10, step: 0.5 },
      { key: 'grainHeight', label: 'Grain H', type: 'slider', min: 0.5, max: 10, step: 0.5 },
      { key: 'chaos', label: 'Chaos (s)', type: 'slider', min: 0.05, max: 3, step: 0.01 },
      { key: 'speed', label: 'Steps', type: 'slider', min: 1, max: 60, step: 1 },
      { key: 'seed', label: 'Seed', type: 'slider', min: 0, max: 100, step: 1 }
    ]
  },
  {
    id: 'overlay',
    name: 'Overlay',
    label: 'OVERLAY',
    description: 'Color composite using multiply, screen, overlay, difference, or additive.',
    enabled: false,
    auxiliary: [],
    defaults: {
      mode: 'overlay',
      color: '#aef0b8',
      opacity: 0.2
    },
    params: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'list',
        options: {
          Multiply: 'multiply',
          Screen: 'screen',
          Overlay: 'overlay',
          Difference: 'difference',
          Additive: 'additive'
        }
      },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 1, step: 0.01 }
    ]
  }
]

export const OVERLAY_MODE_INDEX = {
  multiply: 0,
  screen: 1,
  overlay: 2,
  difference: 3,
  additive: 4
}

export const MASK_SHAPE_INDEX = {
  circle: 0,
  square: 1,
  triangle: 2,
  polygon: 3,
  star: 4,
  ring: 5
}

export const DISPLACE_PATTERN_INDEX = {
  ripple: 0,
  noise: 1,
  tiles: 2
}

export function effectDefinition (id) {
  return EFFECT_DEFINITIONS.find((entry) => entry.id === id) || null
}

export function defaultEffects () {
  return EFFECT_DEFINITIONS.map((entry) => ({
    id: entry.id,
    enabled: entry.enabled,
    params: { ...entry.defaults }
  }))
}

/** Move effect `id` to `index` (after removal). Returns true when the order changed. */
export function moveEffectTo (effects, id, index) {
  const from = effects.findIndex((effect) => effect.id === id)
  if (from < 0) return false
  const [item] = effects.splice(from, 1)
  const to = Math.max(0, Math.min(effects.length, index))
  effects.splice(to, 0, item)
  return from !== to
}

/** Reorder in place to match `ids`; unknown ids are ignored, missing ones keep their relative order at the end. */
export function setEffectOrder (effects, ids) {
  const before = effects.map((effect) => effect.id).join()
  const byId = new Map(effects.map((effect) => [effect.id, effect]))
  const next = []
  for (const id of ids) {
    const effect = byId.get(id)
    if (effect && !next.includes(effect)) next.push(effect)
  }
  for (const effect of effects) {
    if (!next.includes(effect)) next.push(effect)
  }
  effects.splice(0, effects.length, ...next)
  return effects.map((effect) => effect.id).join() !== before
}

function snapToStep (value, spec) {
  if (!spec.step) return value
  const snapped = Math.round((value - spec.min) / spec.step) * spec.step + spec.min
  return Math.min(spec.max, Math.max(spec.min, Number(snapped.toFixed(6))))
}

/** Clamp one raw value against a param spec. Returns `fallback` when invalid. */
export function sanitizeParam (spec, raw, fallback) {
  if (spec.type === 'slider') {
    const number = Number(raw)
    if (raw === null || raw === '' || typeof raw === 'boolean' || !Number.isFinite(number)) return fallback
    return snapToStep(Math.min(spec.max, Math.max(spec.min, number)), spec)
  }
  if (spec.type === 'boolean') {
    return raw === undefined ? fallback : Boolean(raw)
  }
  if (spec.type === 'list') {
    const values = Object.values(spec.options)
    if (values.includes(raw)) return raw
    if (typeof values[0] === 'number') {
      const number = Number(raw)
      if (!Number.isFinite(number)) return fallback
      return values.reduce((best, value) => Math.abs(value - number) < Math.abs(best - number) ? value : best, values[0])
    }
    return fallback
  }
  if (spec.type === 'color') {
    return typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback
  }
  return fallback
}
