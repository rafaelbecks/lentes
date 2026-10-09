/**
 * Effect contract. Parameters live here, not in Tweakpane.
 * Each effect is one fullscreen pass. `auxiliary` is reserved for future
 * distortion fields (for example MUSGO / Cartografías ocean normals).
 * The renderer reads `pass` and binds `uSource` plus the listed uniforms.
 */

export const EFFECT_DEFINITIONS = [
  {
    id: 'color',
    name: 'Color',
    description: 'Brightness, contrast, and saturation (GLOW filter levels, 100 = unchanged), plus threshold and posterize.',
    folder: 'COLOR',
    pass: 'color',
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
    id: 'dither',
    name: 'Dither',
    description: 'Ordered Bayer dither from Cartografías, plus the SVG table crush used by GLOW.',
    folder: 'TEXTURE',
    pass: 'dither',
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
    name: 'Noise',
    description: 'Value-noise grain from GLOW. Amount and speed follow the Cartografías grain overlay.',
    folder: 'TEXTURE',
    pass: 'noise',
    enabled: false,
    auxiliary: [],
    defaults: {
      amount: 0.08,
      scale: 240,
      speed: 1,
      seed: 0,
      animate: true
    },
    params: [
      { key: 'amount', label: 'Opacity', type: 'slider', min: 0, max: 1, step: 0.01 },
      { key: 'scale', label: 'Scale', type: 'slider', min: 1, max: 800, step: 1 },
      { key: 'speed', label: 'Speed', type: 'slider', min: 0, max: 4, step: 0.01 },
      { key: 'seed', label: 'Seed', type: 'slider', min: 0, max: 100, step: 0.01 },
      { key: 'animate', label: 'Animate', type: 'boolean' }
    ]
  },
  {
    id: 'overlay',
    name: 'Overlay',
    description: 'Color composite using multiply, screen, overlay, difference, or additive.',
    folder: 'EFFECTS',
    pass: 'overlay',
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

export function moveEffect (effects, id, direction) {
  const index = effects.findIndex((effect) => effect.id === id)
  const next = index + direction
  if (index < 0 || next < 0 || next >= effects.length) return false
  const [item] = effects.splice(index, 1)
  effects.splice(next, 0, item)
  return true
}
