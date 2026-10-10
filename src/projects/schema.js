import { defaultEffects } from '../effects/registry.js'

export const SCHEMA_VERSION = 3
export const APP_VERSION = '0.2.0'
export const LENTE_EXTENSION = '.lentes'
export const INPUT_COUNT = 3

export const SOURCE_KINDS = ['none', 'camera', 'shader']

export function clampNumber (value, min, max, fallback) {
  if (value === null || value === '' || typeof value === 'boolean') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function createInput (slot) {
  return {
    slot,
    kind: 'camera',
    deviceId: '',
    label: '',
    shader: 'Portal',
    speed: 1,
    width: 1280,
    height: 720,
    frameRate: 30,
    invert: false,
    flipX: false,
    flipY: false,
    gain: 1,
    saturation: 1,
    hue: 0
  }
}

export function createDefaultProject () {
  return {
    format: 'lente',
    version: SCHEMA_VERSION,
    name: 'Untitled',
    inputs: [0, 1, 2].map((slot) => createInput(slot)),
    mixer: {
      mode: 'solo',
      solo: 0,
      crossfadeA: 0,
      crossfadeB: 1,
      crossfade: 0.5,
      weights: [1, 0, 0],
      mutes: [false, false, false],
      blend: 'normal'
    },
    effects: defaultEffects(),
    modulation: { modulators: [] },
    shaders: [],
    output: {
      width: 1280,
      height: 720
    }
  }
}

const INPUT_KEYS = [
  'kind', 'deviceId', 'label', 'shader', 'speed', 'width', 'height', 'frameRate',
  'invert', 'flipX', 'flipY', 'gain', 'saturation', 'hue'
]

export function serializeProject (state) {
  return {
    format: 'lente',
    version: SCHEMA_VERSION,
    name: state.name || 'Untitled',
    inputs: [0, 1, 2].map((index) => {
      const input = state.inputs[index] || createInput(index)
      const out = { slot: index }
      for (const key of INPUT_KEYS) out[key] = input[key]
      return out
    }),
    mixer: {
      mode: state.mixer.mode,
      solo: state.mixer.solo,
      crossfadeA: state.mixer.crossfadeA,
      crossfadeB: state.mixer.crossfadeB,
      crossfade: state.mixer.crossfade,
      weights: state.mixer.weights.slice(0, 3),
      mutes: state.mixer.mutes.slice(0, 3).map(Boolean),
      blend: state.mixer.blend
    },
    effects: state.effects.map((effect) => ({
      id: effect.id,
      enabled: Boolean(effect.enabled),
      params: { ...effect.params }
    })),
    modulation: {
      modulators: (state.modulation?.modulators || []).map((mod) => ({
        ...mod,
        cubicBezier: mod.cubicBezier.slice()
      }))
    },
    shaders: (state.shaders || []).map(({ id, name, code }) => ({ id, name, code })),
    output: {
      width: state.output.width,
      height: state.output.height
    }
  }
}

export function toDocument (state) {
  const project = serializeProject(state)
  project.meta = {
    app: 'lente',
    appVersion: APP_VERSION,
    modified: new Date().toISOString()
  }
  return JSON.stringify(project, null, 2) + '\n'
}

export function isLenteFileName (name) {
  return typeof name === 'string' && name.toLowerCase().endsWith(LENTE_EXTENSION)
}

export function stripLenteExtension (name) {
  return String(name || '').replace(/\.lentes$/i, '')
}
