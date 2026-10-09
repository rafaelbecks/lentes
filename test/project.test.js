import assert from 'node:assert/strict'
import { test } from 'node:test'
import { moveEffect } from '../src/effects/registry.js'
import { applyProject } from '../src/projects/apply.js'
import { migrate } from '../src/projects/migrations.js'
import {
  createDefaultProject,
  isLenteFileName,
  serializeProject,
  stripLenteExtension,
  toDocument
} from '../src/projects/schema.js'

test('default project round-trips through the version 1 schema', () => {
  const project = createDefaultProject()
  const loaded = migrate(JSON.parse(toDocument(project)))
  assert.equal(loaded.warnings.length, 0)
  assert.deepEqual(loaded.project, serializeProject(project))
  assert.equal(JSON.stringify(loaded.project).includes('MediaStream'), false)
})

test('version 0 migrates, unknown effects are dropped, missing ones return', () => {
  const upgraded = migrate({ format: 'lente', version: 0, name: 'old reel' })
  assert.equal(upgraded.project.version, 1)
  assert.equal(upgraded.project.name, 'old reel')
  assert.equal(upgraded.project.effects.length, 4)
  assert.ok(upgraded.warnings.some((warning) => warning.includes('version 0')))

  const partial = migrate({
    format: 'lente',
    version: 1,
    name: 'partial',
    effects: [
      { id: 'not-an-effect', enabled: true, params: {} },
      { id: 'dither', enabled: true, params: { mapSize: 8, scale: 2, mystery: 1 } }
    ],
    mixer: { mode: 'blend', weights: [0.2, 0.3, 0.5], blend: 'difference' },
    inputs: [{ deviceId: 'cam-a', label: 'Door', width: 640, height: 480, frameRate: 24 }]
  })
  assert.equal(partial.project.effects[0].id, 'dither')
  assert.equal(partial.project.effects[0].params.mapSize, 8)
  assert.equal(partial.project.effects[0].params.mystery, undefined)
  assert.deepEqual(partial.project.effects.map((effect) => effect.id), ['dither', 'color', 'noise', 'overlay'])
  assert.equal(partial.project.inputs[0].deviceId, 'cam-a')
  assert.equal(partial.project.inputs[1].deviceId, '')
  assert.equal(partial.project.mixer.blend, 'difference')
  assert.ok(partial.warnings.some((warning) => warning.includes('not-an-effect')))
})

test('newer projects and other formats are refused', () => {
  assert.throws(() => migrate({ format: 'lente', version: 99 }), /newer/)
  assert.throws(() => migrate({ format: 'glow', version: 1 }), /not a LENTE/)
  assert.throws(() => migrate(null), /JSON object/)
})

test('apply keeps object identity and restores order', () => {
  const state = createDefaultProject()
  const color = state.effects[0]
  const dither = state.effects[1]
  applyProject(state, {
    format: 'lente',
    version: 1,
    name: 'desk',
    effects: [
      { id: 'noise', enabled: true, params: { amount: 0.4 } },
      { id: 'color', enabled: true, params: { brightness: 80 } }
    ]
  })
  assert.equal(state.name, 'desk')
  assert.equal(state.effects[0].id, 'noise')
  assert.equal(state.effects[1], color)
  assert.equal(color.params.brightness, 80)
  assert.equal(state.effects.includes(dither), true)
  assert.equal(moveEffect(state.effects, 'noise', -1), false)
  assert.equal(moveEffect(state.effects, 'color', -1), true)
  assert.equal(state.effects[0].id, 'color')
})

test('file names use the .lente extension', () => {
  assert.equal(isLenteFileName('reel.LENTE'), true)
  assert.equal(isLenteFileName('reel.glow'), false)
  assert.equal(stripLenteExtension('reel.lente'), 'reel')
})
