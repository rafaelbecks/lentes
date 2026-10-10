import { BLEND_MODES, MIXER_MODES } from '../mixer/blend.js'
import { effectDefinition, sanitizeParam } from '../effects/registry.js'
import { sanitizeModulators } from '../modulation/modulation.js'
import { PROCEDURAL_IDS } from '../sources/procedural/index.js'
import {
  SHADER_CODE_MAX,
  SHADER_LIMIT,
  SHADER_NAME_MAX,
  customShaderId,
  isCustomShader
} from '../sources/shadertoy.js'
import {
  SCHEMA_VERSION,
  SOURCE_KINDS,
  clampNumber,
  createDefaultProject
} from './schema.js'

const MIXER_IDS = new Set(MIXER_MODES.map((mode) => mode.id))
const BLEND_IDS = new Set(BLEND_MODES.map((mode) => mode.id))

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

function sanitizeParams (id, raw, warnings) {
  const definition = effectDefinition(id)
  const params = { ...definition.defaults }
  const source = raw && typeof raw === 'object' ? raw : {}
  for (const spec of definition.params) {
    params[spec.key] = sanitizeParam(spec, source[spec.key], params[spec.key])
  }
  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(definition.defaults, key)) {
      warnings.push(`Ignored unknown parameter "${key}" on ${id}`)
    }
  }
  return params
}

function sanitizeShaders (raw, warnings) {
  const shaders = []
  const seen = new Set()
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== 'object') continue
    const id = typeof entry.id === 'string' && /^[a-z0-9]{1,24}$/.test(entry.id) ? entry.id : ''
    if (!id || seen.has(id) || typeof entry.code !== 'string') {
      warnings.push('Ignored a malformed shader')
      continue
    }
    if (shaders.length >= SHADER_LIMIT) {
      warnings.push(`Kept the first ${SHADER_LIMIT} shaders`)
      break
    }
    if (entry.code.length > SHADER_CODE_MAX) {
      warnings.push(`Ignored shader "${id}": code is longer than ${SHADER_CODE_MAX} characters`)
      continue
    }
    seen.add(id)
    const name = cleanName(entry.name, `Shader ${shaders.length + 1}`).slice(0, SHADER_NAME_MAX)
    shaders.push({ id, name, code: entry.code })
  }
  return shaders
}

function validShader (value, shaders) {
  if (PROCEDURAL_IDS.includes(value)) return true
  return isCustomShader(value) && shaders.some((shader) => shader.id === customShaderId(value))
}

function sanitizeInput (index, source, base, shaders) {
  const input = { ...base }
  input.kind = SOURCE_KINDS.includes(source.kind) ? source.kind : 'camera'
  input.deviceId = cleanId(source.deviceId)
  input.label = cleanName(source.label, '')
  input.shader = validShader(source.shader, shaders) ? source.shader : base.shader
  input.speed = clampNumber(source.speed, 0, 4, 1)
  input.width = Math.round(clampNumber(source.width, 160, 1920, 1280))
  input.height = Math.round(clampNumber(source.height, 120, 1080, 720))
  input.frameRate = Math.round(clampNumber(source.frameRate, 1, 60, 30))
  input.invert = Boolean(source.invert)
  input.flipX = Boolean(source.flipX)
  input.flipY = Boolean(source.flipY)
  input.gain = clampNumber(source.gain, 0, 2, 1)
  input.saturation = clampNumber(source.saturation, 0, 2, 1)
  input.hue = clampNumber(source.hue, -180, 180, 0)
  input.slot = index
  return input
}

function sanitizeCurrent (data, warnings) {
  const base = createDefaultProject()
  const project = {
    format: 'lente',
    version: SCHEMA_VERSION,
    name: cleanName(data.name, base.name),
    inputs: [],
    mixer: { ...base.mixer },
    effects: [],
    modulation: { modulators: [] },
    shaders: sanitizeShaders(data.shaders, warnings),
    output: { ...base.output }
  }
  const inputs = Array.isArray(data.inputs) ? data.inputs : []
  for (let i = 0; i < 3; i++) {
    const source = inputs[i] && typeof inputs[i] === 'object' ? inputs[i] : {}
    project.inputs.push(sanitizeInput(i, source, base.inputs[i], project.shaders))
  }
  const mixer = data.mixer && typeof data.mixer === 'object' ? data.mixer : {}
  project.mixer.mode = MIXER_IDS.has(mixer.mode) ? mixer.mode : 'solo'
  project.mixer.blend = BLEND_IDS.has(mixer.blend) ? mixer.blend : 'normal'
  project.mixer.solo = Math.round(clampNumber(mixer.solo, 0, 2, 0))
  project.mixer.crossfadeA = Math.round(clampNumber(mixer.crossfadeA, 0, 2, 0))
  project.mixer.crossfadeB = Math.round(clampNumber(mixer.crossfadeB, 0, 2, 1))
  project.mixer.crossfade = clampNumber(mixer.crossfade, 0, 1, 0.5)
  const weights = Array.isArray(mixer.weights) ? mixer.weights : []
  project.mixer.weights = [0, 1, 2].map((index) => clampNumber(weights[index], 0, 1, index === 0 ? 1 : 0))
  const mutes = Array.isArray(mixer.mutes) ? mixer.mutes : []
  project.mixer.mutes = [0, 1, 2].map((index) => Boolean(mutes[index]))
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
    project.effects.push(effect)
  }
  project.modulation.modulators = sanitizeModulators(data.modulation?.modulators, warnings)
  const output = data.output && typeof data.output === 'object' ? data.output : {}
  project.output.width = Math.round(clampNumber(output.width, 160, 1920, 1280))
  project.output.height = Math.round(clampNumber(output.height, 120, 1080, 720))
  return project
}

function migrateV0 (data) {
  const project = createDefaultProject()
  project.name = cleanName(data.name, project.name)
  project.version = 1
  return project
}

/**
 * v1 → v2: noise becomes the grained.js grain (opacity keeps the old amount,
 * animate is kept, scale/speed have no equivalent). Inputs gain a source kind
 * and per-source operations, the mixer gains mutes, projects gain modulation.
 * New effects (chromatic, glass, rain, mask) are appended disabled by sanitize.
 */
export function migrateV1 (data) {
  const next = { ...data, version: 2 }
  next.inputs = (Array.isArray(data.inputs) ? data.inputs : []).map((input) => ({
    ...(input && typeof input === 'object' ? input : {}),
    kind: 'camera'
  }))
  next.effects = (Array.isArray(data.effects) ? data.effects : []).map((effect) => {
    if (!effect || effect.id !== 'noise') return effect
    const params = effect.params && typeof effect.params === 'object' ? effect.params : {}
    const grain = {}
    if (params.amount !== undefined) grain.opacity = params.amount
    if (params.animate !== undefined) grain.animate = params.animate
    return { ...effect, params: grain }
  })
  next.mixer = { ...(data.mixer || {}), mutes: [false, false, false] }
  next.modulation = { modulators: [] }
  return next
}

/**
 * Bring a parsed project document up to the current schema.
 * Returns a new object. Does not keep live camera objects.
 * v2 → v3 only adds imported Shadertoy code (`shaders`, empty for v2 files).
 */
export function migrate (data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Project file is not a JSON object')
  }
  if (data.format !== 'lente') {
    throw new Error('This file is not a LENTES project')
  }
  const warnings = []
  let version = Number(data.version)
  if (!Number.isInteger(version)) throw new Error('Project version is missing')
  if (version > SCHEMA_VERSION) {
    throw new Error(`Project version ${version} is newer than this LENTES (${SCHEMA_VERSION})`)
  }
  let current = data
  if (version === 0) {
    current = migrateV0(data)
    version = 1
    warnings.push('Upgraded a version 0 project')
  }
  if (version === 1) {
    current = migrateV1(current)
    version = 2
    warnings.push('Upgraded a version 1 project (noise is now grained-style grain)')
  }
  if (version === 2) {
    current = { ...current, version: 3, shaders: [] }
    version = 3
  }
  if (version !== SCHEMA_VERSION) throw new Error(`Project version ${version} is not supported`)
  return { project: sanitizeCurrent(current, warnings), warnings }
}
