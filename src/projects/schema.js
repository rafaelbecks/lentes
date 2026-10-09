import { defaultEffects } from '../effects/registry.js'

export const SCHEMA_VERSION = 1
export const APP_VERSION = '0.1.0'
export const LENTE_EXTENSION = '.lente'
export const INPUT_COUNT = 3

export function clampNumber (value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function createInput (slot) {
  return {
    slot,
    deviceId: '',
    label: '',
    width: 1280,
    height: 720,
    frameRate: 30
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
      blend: 'normal'
    },
    effects: defaultEffects(),
    output: {
      width: 1280,
      height: 720
    }
  }
}

export function serializeProject (state) {
  return {
    format: 'lente',
    version: SCHEMA_VERSION,
    name: state.name || 'Untitled',
    inputs: [0, 1, 2].map((index) => {
      const input = state.inputs[index] || createInput(index)
      return {
        slot: index,
        deviceId: typeof input.deviceId === 'string' ? input.deviceId : '',
        label: typeof input.label === 'string' ? input.label : '',
        width: input.width,
        height: input.height,
        frameRate: input.frameRate
      }
    }),
    mixer: {
      mode: state.mixer.mode,
      solo: state.mixer.solo,
      crossfadeA: state.mixer.crossfadeA,
      crossfadeB: state.mixer.crossfadeB,
      crossfade: state.mixer.crossfade,
      weights: [
        state.mixer.weights[0],
        state.mixer.weights[1],
        state.mixer.weights[2]
      ],
      blend: state.mixer.blend
    },
    effects: state.effects.map((effect) => ({
      id: effect.id,
      enabled: Boolean(effect.enabled),
      params: { ...effect.params }
    })),
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
  return String(name || '').replace(/\.lente$/i, '')
}
