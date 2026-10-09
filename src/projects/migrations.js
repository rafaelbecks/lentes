import { BLEND_MODES, MIXER_MODES } from '../mixer/blend.js'
import { effectDefinition } from '../effects/registry.js'
import {
  SCHEMA_VERSION,
  clampNumber,
  createDefaultProject
} from './schema.js'

const MIXER_IDS = new Set(MIXER_MODES.map((mode) => mode.id))
const BLEND_IDS = new Set(BLEND_MODES.map((mode) => mode.id))
const OVERLAY_MODES = new Set(['multiply', 'screen', 'overlay', 'difference', 'additive'])

function stripControls (value) {
  let text = ''
  for (const char of value) {
    if (char.charCodeAt(0) >= 32) text += char
  }
  return text
}

function cleanName (value, fallback) {
  if (typeof value !== 'string') return fallback
  const name = stripControls(value).trim().slice(0, 120)
  return name || fallback
}

function cleanId (value) {
  if (typeof value !== 'string') return ''
  return stripControls(value).slice(0, 256)
}

function snapHalf (value, min, max, fallback) {
  const number = clampNumber(value, min, max, fallback)
  return Math.round(number * 2) / 2
}

function sanitizeParams (id, raw, warnings) {
  const definition = effectDefinition(id)
  const params = { ...definition.defaults }
  const source = raw && typeof raw === 'object' ? raw : {}
  if (id === 'color') {
    params.brightness = clampNumber(source.brightness, 0, 200, params.brightness)
    params.contrast = clampNumber(source.contrast, 0, 200, params.contrast)
    params.saturation = clampNumber(source.saturation, 0, 200, params.saturation)
    params.threshold = clampNumber(source.threshold, 0, 1, params.threshold)
    params.posterize = Math.round(clampNumber(source.posterize, 0, 16, params.posterize))
  } else if (id === 'dither') {
    const size = Math.round(clampNumber(source.mapSize, 2, 8, params.mapSize))
    params.mapSize = size <= 2 ? 2 : size <= 4 ? 4 : 8
    params.scale = snapHalf(source.scale, 0.5, 16, params.scale)
    params.amount = clampNumber(source.amount, 0, 1, params.amount)
    params.saturate = clampNumber(source.saturate, 0, 1, params.saturate)
    params.crush = clampNumber(source.crush, 0, 1, params.crush)
    params.tableR = clampNumber(source.tableR, 0, 1, params.tableR)
    params.tableG = clampNumber(source.tableG, 0, 1, params.tableG)
    params.tableB = clampNumber(source.tableB, 0, 1, params.tableB)
  } else if (id === 'noise') {
    params.amount = clampNumber(source.amount, 0, 1, params.amount)
    params.scale = clampNumber(source.scale, 1, 800, params.scale)
    params.speed = clampNumber(source.speed, 0, 4, params.speed)
    params.seed = clampNumber(source.seed, 0, 100, params.seed)
    params.animate = source.animate === undefined ? params.animate : Boolean(source.animate)
  } else if (id === 'overlay') {
    params.mode = OVERLAY_MODES.has(source.mode) ? source.mode : params.mode
    params.color = /^#[0-9a-fA-F]{6}$/.test(source.color) ? source.color : params.color
    params.opacity = clampNumber(source.opacity, 0, 1, params.opacity)
  }
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      if (!Object.prototype.hasOwnProperty.call(definition.defaults, key)) {
        warnings.push(`Ignored unknown parameter "${key}" on ${id}`)
      }
    }
  }
  return params
}

function sanitizeV1 (data, warnings) {
  const base = createDefaultProject()
  const project = {
    format: 'lente',
    version: SCHEMA_VERSION,
    name: cleanName(data.name, base.name),
    inputs: base.inputs.map((input) => ({ ...input })),
    mixer: { ...base.mixer, weights: base.mixer.weights.slice() },
    effects: [],
    output: { ...base.output }
  }
  const inputs = Array.isArray(data.inputs) ? data.inputs : []
  for (let i = 0; i < 3; i++) {
    const source = inputs[i] || {}
    project.inputs[i].deviceId = cleanId(source.deviceId)
    project.inputs[i].label = cleanName(source.label, '')
    project.inputs[i].width = Math.round(clampNumber(source.width, 160, 1920, 1280))
    project.inputs[i].height = Math.round(clampNumber(source.height, 120, 1080, 720))
    project.inputs[i].frameRate = Math.round(clampNumber(source.frameRate, 1, 60, 30))
  }
  const mixer = data.mixer || {}
  project.mixer.mode = MIXER_IDS.has(mixer.mode) ? mixer.mode : 'solo'
  project.mixer.blend = BLEND_IDS.has(mixer.blend) ? mixer.blend : 'normal'
  project.mixer.solo = Math.round(clampNumber(mixer.solo, 0, 2, 0))
  project.mixer.crossfadeA = Math.round(clampNumber(mixer.crossfadeA, 0, 2, 0))
  project.mixer.crossfadeB = Math.round(clampNumber(mixer.crossfadeB, 0, 2, 1))
  project.mixer.crossfade = clampNumber(mixer.crossfade, 0, 1, 0.5)
  const weights = Array.isArray(mixer.weights) ? mixer.weights : []
  project.mixer.weights = [0, 1, 2].map((index) => clampNumber(weights[index], 0, 1, index === 0 ? 1 : 0))
  const seen = new Set()
  const incoming = Array.isArray(data.effects) ? data.effects : []
  for (const effect of incoming) {
    const id = effect && effect.id
    if (!effectDefinition(id)) {
      warnings.push(`Ignored unknown effect "${id}"`)
      continue
    }
    if (seen.has(id)) {
      warnings.push(`Ignored duplicate effect "${id}"`)
      continue
    }
    seen.add(id)
    project.effects.push({
      id,
      enabled: Boolean(effect.enabled),
      params: sanitizeParams(id, effect.params, warnings)
    })
  }
  for (const effect of base.effects) {
    if (seen.has(effect.id)) continue
    warnings.push(`Restored missing effect "${effect.id}"`)
    project.effects.push(effect)
  }
  const output = data.output || {}
  project.output.width = Math.round(clampNumber(output.width, 160, 1920, 1280))
  project.output.height = Math.round(clampNumber(output.height, 120, 1080, 720))
  return project
}

function migrateV0 (data) {
  const project = createDefaultProject()
  project.name = cleanName(data.name, project.name)
  return project
}

/**
 * Bring a parsed project document up to the current schema.
 * Returns a new object. Does not keep live camera objects.
 */
export function migrate (data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Project file is not a JSON object')
  }
  if (data.format !== 'lente') {
    throw new Error('This file is not a LENTE project')
  }
  const warnings = []
  let version = Number(data.version)
  if (!Number.isInteger(version)) throw new Error('Project version is missing')
  if (version > SCHEMA_VERSION) {
    throw new Error(`Project version ${version} is newer than this LENTE (${SCHEMA_VERSION})`)
  }
  let current = data
  if (version === 0) {
    current = migrateV0(data)
    version = 1
    warnings.push('Upgraded a version 0 project')
  }
  if (version !== 1) throw new Error(`Project version ${version} is not supported`)
  return { project: sanitizeV1(current, warnings), warnings }
}
