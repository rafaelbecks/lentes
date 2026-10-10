/**
 * LFO modulation, after MUSGO src/modulation/modulationSystem.js (MIT),
 * itself adapted from GLOW. Modulators are plain objects stored in
 * `state.modulation.modulators` so they save, load, and undo with the project.
 * Modulation is applied just before rendering and restored right after,
 * so modulated values never reach the saved state or history.
 */
import { EFFECT_DEFINITIONS, effectDefinition } from '../effects/registry.js'

export const WAVEFORM_SHAPES = {
  sine: 'Sine',
  square: 'Square',
  triangle: 'Triangle',
  saw: 'Sawtooth',
  cubicBezier: 'Cubic Bezier'
}

export const RATE_MIN = 0.001
export const RATE_MAX = 4

const TAU = Math.PI * 2

export function createModulator (id) {
  return {
    id: id || `lfo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    enabled: true,
    targetCategory: null,
    targetConfigKey: null,
    shape: 'sine',
    rate: 0.1,
    depth: 0.5,
    offset: 0,
    cubicBezier: [0.5, 0, 0.5, 1],
    threshold: 0.5
  }
}

export function cubicBezierEval (t, y1, y2) {
  const mt = 1 - t
  return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t
}

export function generateWaveform (shape, phase, cubicBezier = [0.5, 0, 0.5, 1]) {
  const p = ((phase % TAU) + TAU) % TAU
  switch (shape) {
    case 'square':
      return p < Math.PI ? 1 : -1
    case 'triangle':
      return p < Math.PI ? (p / Math.PI) * 2 - 1 : 1 - ((p - Math.PI) / Math.PI) * 2
    case 'saw':
      return (p / TAU) * 2 - 1
    case 'cubicBezier':
      return cubicBezierEval(p / TAU, cubicBezier[1], cubicBezier[3]) * 2 - 1
    default:
      return Math.sin(p)
  }
}

function waveformAt (modulator, time) {
  const phase = time * (modulator.rate || 0.1) * TAU
  return generateWaveform(modulator.shape || 'sine', phase, modulator.cubicBezier)
}

/** Bipolar output (−1…1) including depth and offset, for the monitor. */
export function sampleModulator (modulator, time) {
  if (!modulator?.enabled) return 0
  const value = waveformAt(modulator, time) * (modulator.depth ?? 0.5) + (modulator.offset || 0)
  return Math.max(-1, Math.min(1, value))
}

export function getModulatedValue (baseValue, modulator, param, time) {
  if (!modulator.enabled || !param) return baseValue
  const waveform = waveformAt(modulator, time)
  if (param.type === 'checkbox') {
    return (waveform + 1) / 2 >= (modulator.threshold ?? 0.5)
  }
  const range = param.max - param.min
  let value = baseValue + waveform * (modulator.depth ?? 0.5) * range + (modulator.offset || 0) * range
  value = Math.max(param.min, Math.min(param.max, value))
  if (param.step >= 1) value = Math.round(value)
  return value
}

const MIXER_TARGETS = [
  { key: 'crossfade', label: 'Crossfade', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'weight0', label: 'Fader 1', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'weight1', label: 'Fader 2', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'weight2', label: 'Fader 3', type: 'number', min: 0, max: 1, step: 0.01 }
]

const INPUT_TARGETS = [
  { key: 'gain', label: 'Gain', type: 'number', min: 0, max: 2, step: 0.01 },
  { key: 'saturation', label: 'Saturation', type: 'number', min: 0, max: 2, step: 0.01 },
  { key: 'hue', label: 'Hue', type: 'number', min: -180, max: 180, step: 1 },
  { key: 'speed', label: 'Shader speed', type: 'number', min: 0, max: 4, step: 0.01 },
  { key: 'invert', label: 'Invert', type: 'checkbox' },
  { key: 'flipX', label: 'Flip X', type: 'checkbox' },
  { key: 'flipY', label: 'Flip Y', type: 'checkbox' },
  { key: 'posX', label: 'Position X', type: 'number', min: 0, max: 1, step: 0.001 },
  { key: 'posY', label: 'Position Y', type: 'number', min: 0, max: 1, step: 0.001 }
]

function effectTargets (definition) {
  const list = [{ key: '__enabled', label: 'On / off', type: 'checkbox' }]
  for (const spec of definition.params) {
    if (spec.modulate === false) continue
    if (spec.type === 'slider') {
      list.push({ key: spec.key, label: spec.label, type: 'number', min: spec.min, max: spec.max, step: spec.step })
    } else if (spec.type === 'boolean') {
      list.push({ key: spec.key, label: spec.label, type: 'checkbox' })
    }
  }
  return list
}

/** Grouped target catalog for the LFO UI: [{ category, label, targets: [...] }]. */
export function targetCatalog () {
  const groups = [{ category: 'mixer', label: 'Mixer', targets: MIXER_TARGETS }]
  for (let i = 0; i < 3; i++) {
    groups.push({ category: `input${i}`, label: `Input ${i + 1}`, targets: INPUT_TARGETS })
  }
  for (const definition of EFFECT_DEFINITIONS) {
    groups.push({ category: definition.id, label: definition.name, targets: effectTargets(definition) })
  }
  return groups
}

const catalogIndex = new Map()
for (const group of targetCatalog()) {
  for (const target of group.targets) catalogIndex.set(`${group.category}:${target.key}`, target)
}

export function resolveParam (category, key) {
  return catalogIndex.get(`${category}:${key}`) || null
}

/** Live object + property for a target, or null. */
export function resolveTarget (state, category, key) {
  if (category === 'mixer') {
    if (key === 'crossfade') return { object: state.mixer, prop: 'crossfade' }
    const match = /^weight([0-2])$/.exec(key)
    return match ? { object: state.mixer.weights, prop: Number(match[1]) } : null
  }
  const input = /^input([0-2])$/.exec(category)
  if (input) {
    const object = state.inputs[Number(input[1])]
    return object && key in object ? { object, prop: key } : null
  }
  if (!effectDefinition(category)) return null
  const effect = state.effects.find((entry) => entry.id === category)
  if (!effect) return null
  if (key === '__enabled') return { object: effect, prop: 'enabled' }
  return key in effect.params ? { object: effect.params, prop: key } : null
}

/**
 * Apply all active modulators to `state` in place at `time` (seconds).
 * Returns restore(), which writes the original values back.
 */
export function applyModulation (state, time) {
  const modulators = state.modulation?.modulators || []
  const groups = new Map()
  for (const modulator of modulators) {
    if (!modulator.enabled || !modulator.targetCategory || !modulator.targetConfigKey) continue
    const key = `${modulator.targetCategory}:${modulator.targetConfigKey}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(modulator)
  }
  const originals = []
  for (const mods of groups.values()) {
    const { targetCategory, targetConfigKey } = mods[0]
    const param = resolveParam(targetCategory, targetConfigKey)
    const target = param && resolveTarget(state, targetCategory, targetConfigKey)
    if (!target) continue
    const base = target.object[target.prop]
    let value = base
    for (const modulator of mods) value = getModulatedValue(value, modulator, param, time)
    originals.push([target.object, target.prop, base])
    target.object[target.prop] = value
  }
  return function restore () {
    for (let i = originals.length - 1; i >= 0; i--) {
      const [object, prop, value] = originals[i]
      object[prop] = value
    }
  }
}

/** Categories with at least one enabled, targeted modulator. */
export function modulatedCategories (state) {
  const set = new Set()
  for (const modulator of state.modulation?.modulators || []) {
    if (modulator.enabled && modulator.targetCategory && modulator.targetConfigKey) set.add(modulator.targetCategory)
  }
  return set
}

function finite (value, min, max, fallback) {
  const number = Number(value)
  if (value === null || value === '' || !Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

/** Sanitize a saved modulator list (MUSGO loadSerialized rules, LENTE rate range). */
export function sanitizeModulators (raw, warnings = []) {
  const list = Array.isArray(raw) ? raw : []
  const out = []
  const ids = new Set()
  for (const item of list.slice(0, 32)) {
    if (!item || typeof item !== 'object') continue
    const modulator = createModulator(typeof item.id === 'string' && item.id && !ids.has(item.id) ? item.id.slice(0, 64) : undefined)
    ids.add(modulator.id)
    modulator.enabled = item.enabled !== false
    const category = typeof item.targetCategory === 'string' ? item.targetCategory : null
    const key = typeof item.targetConfigKey === 'string' ? item.targetConfigKey : null
    if (category && key && resolveParam(category, key)) {
      modulator.targetCategory = category
      modulator.targetConfigKey = key
    } else if (category || key) {
      warnings.push(`Cleared unknown LFO target "${category}:${key}"`)
    }
    modulator.shape = Object.hasOwn(WAVEFORM_SHAPES, item.shape) ? item.shape : 'sine'
    modulator.rate = finite(item.rate, RATE_MIN, RATE_MAX, 0.1)
    modulator.depth = finite(item.depth, 0, 1, 0.5)
    modulator.offset = finite(item.offset, -1, 1, 0)
    modulator.threshold = finite(item.threshold, 0, 1, 0.5)
    if (Array.isArray(item.cubicBezier) && item.cubicBezier.length === 4) {
      modulator.cubicBezier = item.cubicBezier.map((value, index) => finite(value, index % 2 ? -1 : 0, index % 2 ? 2 : 1, [0.5, 0, 0.5, 1][index]))
    }
    out.push(modulator)
  }
  return out
}
