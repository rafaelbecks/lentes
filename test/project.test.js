import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EFFECT_DEFINITIONS, effectDefinition, moveEffectTo, sanitizeParam, setEffectOrder } from '../src/effects/registry.js'
import { applyProject } from '../src/projects/apply.js'
import { migrate } from '../src/projects/migrations.js'
import {
  SCHEMA_VERSION,
  createDefaultProject,
  isLenteFileName,
  serializeProject,
  stripLenteExtension,
  toDocument
} from '../src/projects/schema.js'

const ALL_IDS = EFFECT_DEFINITIONS.map((entry) => entry.id)

test('default project round-trips through the current schema', () => {
  const project = createDefaultProject()
  const loaded = migrate(JSON.parse(toDocument(project)))
  assert.equal(SCHEMA_VERSION, 2)
  assert.equal(loaded.warnings.length, 0)
  assert.deepEqual(loaded.project, serializeProject(project))
  assert.equal(JSON.stringify(loaded.project).includes('MediaStream'), false)
})

test('version 0 upgrades all the way to the current schema', () => {
  const upgraded = migrate({ format: 'lente', version: 0, name: 'old reel' })
  assert.equal(upgraded.project.version, SCHEMA_VERSION)
  assert.equal(upgraded.project.name, 'old reel')
  assert.deepEqual(upgraded.project.effects.map((effect) => effect.id), ALL_IDS)
  assert.ok(upgraded.warnings.some((warning) => warning.includes('version 0')))
})

test('version 1 projects migrate: noise becomes grain, new effects are appended', () => {
  const { project, warnings } = migrate({
    format: 'lente',
    version: 1,
    name: 'partial',
    effects: [
      { id: 'not-an-effect', enabled: true, params: {} },
      { id: 'dither', enabled: true, params: { mapSize: 8, scale: 2.2, mystery: 1 } },
      { id: 'noise', enabled: true, params: { amount: 0.3, scale: 240, speed: 1, seed: 0, animate: false } }
    ],
    mixer: { mode: 'blend', weights: [0.2, 0.3, 0.5], blend: 'difference' },
    inputs: [{ deviceId: 'cam-a', label: 'Door', width: 640, height: 480, frameRate: 24 }]
  })
  assert.equal(project.version, 2)
  assert.deepEqual(project.effects.slice(0, 2).map((effect) => effect.id), ['dither', 'noise'])
  assert.equal(project.effects[0].params.mapSize, 8)
  assert.equal(project.effects[0].params.scale, 2)
  assert.equal(project.effects[0].params.mystery, undefined)
  const grain = project.effects[1].params
  assert.equal(grain.opacity, 0.3)
  assert.equal(grain.animate, false)
  assert.equal(grain.patternWidth, 100)
  assert.equal(grain.scale, undefined)
  assert.deepEqual(new Set(project.effects.map((effect) => effect.id)), new Set(ALL_IDS))
  assert.equal(project.effects.find((effect) => effect.id === 'glass').enabled, false)
  assert.equal(project.inputs[0].kind, 'camera')
  assert.equal(project.inputs[0].deviceId, 'cam-a')
  assert.equal(project.inputs[0].invert, false)
  assert.equal(project.inputs[1].deviceId, '')
  assert.deepEqual(project.mixer.mutes, [false, false, false])
  assert.equal(project.mixer.blend, 'difference')
  assert.deepEqual(project.modulation.modulators, [])
  assert.ok(warnings.some((warning) => warning.includes('not-an-effect')))
})

test('version 2 sanitizes source operations, mutes, and LFOs', () => {
  const { project, warnings } = migrate({
    format: 'lente',
    version: 2,
    inputs: [
      { kind: 'shader', shader: 'Balatro', gain: 9, hue: -400, invert: 1, flipX: true },
      { kind: 'webrtc', shader: 'Nope' }
    ],
    mixer: { mutes: [true, 0, 'yes'] },
    modulation: {
      modulators: [
        { id: 'a', targetCategory: 'mask', targetConfigKey: 'size', rate: 99, depth: -1, shape: 'saw' },
        { id: 'b', targetCategory: 'mask', targetConfigKey: 'nothing' }
      ]
    }
  })
  assert.equal(project.inputs[0].kind, 'shader')
  assert.equal(project.inputs[0].shader, 'Balatro')
  assert.equal(project.inputs[0].gain, 2)
  assert.equal(project.inputs[0].hue, -180)
  assert.equal(project.inputs[0].invert, true)
  assert.equal(project.inputs[1].kind, 'camera')
  assert.equal(project.inputs[1].shader, 'Portal')
  assert.deepEqual(project.mixer.mutes, [true, false, true])
  const [a, b] = project.modulation.modulators
  assert.equal(a.rate, 4)
  assert.equal(a.depth, 0)
  assert.equal(a.shape, 'saw')
  assert.equal(b.targetConfigKey, null)
  assert.ok(warnings.some((warning) => warning.includes('mask:nothing')))
})

test('newer projects and other formats are refused', () => {
  assert.throws(() => migrate({ format: 'lente', version: 99 }), /newer/)
  assert.throws(() => migrate({ format: 'glow', version: 1 }), /not a LENTE/)
  assert.throws(() => migrate(null), /JSON object/)
})

test('apply keeps object identity and restores order', () => {
  const state = createDefaultProject()
  const color = state.effects[0]
  const weights = state.mixer.weights
  const modulators = state.modulation.modulators
  applyProject(state, {
    format: 'lente',
    version: 2,
    name: 'desk',
    mixer: { weights: [0.1, 0.2, 0.3], mutes: [false, true, false] },
    effects: [
      { id: 'mask', enabled: true, params: { shape: 'star' } },
      { id: 'color', enabled: true, params: { brightness: 80 } }
    ],
    modulation: { modulators: [{ id: 'x', targetCategory: 'mixer', targetConfigKey: 'crossfade' }] }
  })
  assert.equal(state.name, 'desk')
  assert.equal(state.effects[0].id, 'mask')
  assert.equal(state.effects[0].params.shape, 'star')
  assert.equal(state.effects[1], color)
  assert.equal(color.params.brightness, 80)
  assert.equal(state.mixer.weights, weights)
  assert.deepEqual(weights, [0.1, 0.2, 0.3])
  assert.equal(state.mixer.mutes[1], true)
  assert.equal(state.modulation.modulators, modulators)
  assert.equal(modulators[0].id, 'x')
})

test('effect order can be set from a dragged node list', () => {
  const effects = createDefaultProject().effects
  const first = effects[0]
  assert.equal(setEffectOrder(effects, ['noise', 'glass', 'bogus']), true)
  assert.deepEqual(effects.slice(0, 2).map((effect) => effect.id), ['noise', 'glass'])
  assert.equal(effects.length, ALL_IDS.length)
  assert.ok(effects.includes(first))
  assert.equal(setEffectOrder(effects, effects.map((effect) => effect.id)), false)
  assert.equal(moveEffectTo(effects, 'noise', 3), true)
  assert.equal(effects[3].id, 'noise')
  assert.equal(moveEffectTo(effects, 'missing', 0), false)
})

test('params are clamped and snapped against the registry schema', () => {
  const spec = (id, key) => effectDefinition(id).params.find((entry) => entry.key === key)
  assert.equal(sanitizeParam(spec('dither', 'scale'), 3.3, 4), 3.5)
  assert.equal(sanitizeParam(spec('dither', 'mapSize'), 5, 4), 4)
  assert.equal(sanitizeParam(spec('dither', 'mapSize'), 7, 4), 8)
  assert.equal(sanitizeParam(spec('mask', 'sides'), 40, 5), 12)
  assert.equal(sanitizeParam(spec('mask', 'shape'), 'hexagon', 'circle'), 'circle')
  assert.equal(sanitizeParam(spec('mask', 'color'), '#ABCDEF', '#000000'), '#abcdef')
  assert.equal(sanitizeParam(spec('mask', 'color'), 'red', '#000000'), '#000000')
  assert.equal(sanitizeParam(spec('glass', 'ior'), null, 3), 3)
  assert.equal(sanitizeParam(spec('noise', 'animate'), 0, true), false)
})

test('file names use the .lente extension', () => {
  assert.equal(isLenteFileName('reel.LENTE'), true)
  assert.equal(isLenteFileName('reel.glow'), false)
  assert.equal(stripLenteExtension('reel.lente'), 'reel')
})
