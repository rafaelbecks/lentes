import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyModulation,
  createModulator,
  cubicBezierEval,
  generateWaveform,
  getModulatedValue,
  modulatedCategories,
  resolveParam,
  sampleModulator,
  targetCatalog
} from '../src/modulation/modulation.js'
import { createDefaultProject } from '../src/projects/schema.js'

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)

test('waveforms follow the MUSGO shapes', () => {
  close(generateWaveform('sine', Math.PI / 2), 1)
  assert.equal(generateWaveform('square', 0.1), 1)
  assert.equal(generateWaveform('square', Math.PI + 0.1), -1)
  close(generateWaveform('triangle', Math.PI), 1)
  close(generateWaveform('saw', 0), -1)
  close(generateWaveform('sine', -Math.PI / 2), -1)
  close(cubicBezierEval(0, 0, 1), 0)
  close(cubicBezierEval(1, 0, 1), 1)
  close(generateWaveform('cubicBezier', Math.PI, [0.5, 0, 0.5, 1]), 0)
})

test('modulated numbers scale by range, clamp, and round integer steps', () => {
  const mod = { ...createModulator('a'), rate: 0.25, depth: 0.5 }
  const param = { type: 'number', min: 0, max: 200, step: 1 }
  assert.equal(getModulatedValue(100, mod, param, 1), 200)
  assert.equal(getModulatedValue(100, mod, param, 3), 0)
  const fine = { type: 'number', min: 0, max: 1, step: 0.01 }
  close(getModulatedValue(0.5, { ...mod, depth: 0.1 }, fine, 1), 0.6)
  assert.equal(getModulatedValue(5, { ...mod, enabled: false }, param, 1), 5)
  const flag = { type: 'checkbox' }
  assert.equal(getModulatedValue(false, mod, flag, 1), true)
  assert.equal(getModulatedValue(true, mod, flag, 3), false)
  close(sampleModulator({ ...mod, offset: 0.8 }, 1), 1)
})

test('applyModulation writes targets and restore puts every value back', () => {
  const state = createDefaultProject()
  const mask = state.effects.find((effect) => effect.id === 'mask')
  state.modulation.modulators.push(
    { ...createModulator('m1'), targetCategory: 'mixer', targetConfigKey: 'weight1', rate: 0.25, depth: 0.5 },
    { ...createModulator('m2'), targetCategory: 'mask', targetConfigKey: '__enabled', rate: 0.25 },
    { ...createModulator('m3'), targetCategory: 'input2', targetConfigKey: 'hue', rate: 0.25, depth: 0.25 },
    { ...createModulator('m4'), targetCategory: 'mask', targetConfigKey: 'size', enabled: false }
  )
  const before = JSON.stringify(state)
  const restore = applyModulation(state, 1)
  assert.equal(state.mixer.weights[1], 0.5)
  assert.equal(mask.enabled, true)
  assert.equal(state.inputs[2].hue, 90)
  assert.equal(mask.params.size, 0.6)
  restore()
  assert.equal(JSON.stringify(state), before)
  assert.deepEqual([...modulatedCategories(state)].sort(), ['input2', 'mask', 'mixer'])
})

test('target catalog covers mixer, sources, and every effect', () => {
  const categories = targetCatalog().map((group) => group.category)
  assert.ok(categories.includes('mixer'))
  assert.ok(categories.includes('input0'))
  assert.ok(categories.includes('glass'))
  assert.equal(resolveParam('glass', 'mode'), null)
  assert.equal(resolveParam('mask', 'invert').type, 'checkbox')
  assert.equal(resolveParam('color', 'brightness').max, 200)
})
