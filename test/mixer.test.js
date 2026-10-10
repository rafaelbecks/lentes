import assert from 'node:assert/strict'
import { test } from 'node:test'
import { containMap, placementBox } from '../src/mixer/fit.js'
import { mixColors, blendModeIndex, mixerModeIndex } from '../src/mixer/blend.js'

const red = [1, 0, 0]
const green = [0, 1, 0]
const blue = [0, 0, 1]

test('contain keeps equal aspects and letterboxes a wider source', () => {
  assert.deepEqual(containMap([0.5, 0.5], 16 / 9, 16 / 9), [0.5, 0.5])
  assert.deepEqual(containMap([0, 0], 1, 1), [0, 0])
  assert.equal(containMap([0.5, 0], 2, 1), null)
  assert.deepEqual(containMap([0.5, 0.25], 2, 1), [0.5, 0])
  assert.equal(containMap([0.5, 0.5], 0, 1), null)
})

test('a file box the size of the frame contains like a camera', () => {
  assert.deepEqual(placementBox(16 / 9, 1280, 720, 1280, 720), { spanX: 1, spanY: 1 })
  const wide = placementBox(2, 1280, 720, 1280, 720)
  assert.equal(wide.spanX, 1)
  assert.ok(Math.abs(wide.spanY - 640 / 720) < 1e-9)
  assert.equal(placementBox(0, 100, 100, 100, 100), null)
})

test('solo uses one ready source and ignores the others', () => {
  assert.deepEqual(mixColors({
    mode: 'solo',
    solo: 1,
    blend: 'normal',
    colors: [red, green, blue],
    ready: [true, true, false]
  }), green)
  assert.deepEqual(mixColors({
    mode: 'solo',
    solo: 2,
    colors: [red, green, blue],
    ready: [true, true, false]
  }), [0, 0, 0])
})

test('crossfade and weighted blends follow the shader contract', () => {
  assert.deepEqual(mixColors({
    mode: 'crossfade',
    fadeA: 0,
    fadeB: 1,
    fade: 0.25,
    blend: 'normal',
    colors: [red, green, blue],
    ready: [true, true, true]
  }), [0.75, 0.25, 0])

  assert.deepEqual(mixColors({
    mode: 'crossfade',
    fadeA: 0,
    fadeB: 1,
    fade: 1,
    blend: 'multiply',
    colors: [red, green, blue],
    ready: [true, true, false]
  }), [0, 0, 0])

  assert.deepEqual(mixColors({
    mode: 'blend',
    blend: 'normal',
    weights: [1, 1, 0],
    colors: [red, green, blue],
    ready: [true, true, true]
  }), [0.5, 0.5, 0])

  assert.deepEqual(mixColors({
    mode: 'blend',
    blend: 'additive',
    weights: [1, 1, 0],
    colors: [red, green, blue],
    ready: [true, false, true]
  }), [1, 0, 0])

  assert.deepEqual(mixColors({
    mode: 'blend',
    blend: 'multiply',
    weights: [1, 0.5, 0],
    colors: [[0.5, 0.5, 0.5], [0, 1, 0], blue],
    ready: [true, true, false]
  }), [0.25, 0.5, 0.25])

  assert.deepEqual(mixColors({
    mode: 'blend',
    blend: 'difference',
    weights: [1, 1, 0],
    colors: [red, green, blue],
    ready: [true, true, true]
  }), [1, 1, 0])

  assert.deepEqual(mixColors({
    mode: 'blend',
    blend: 'normal',
    weights: [1, 1, 1],
    colors: [red, green, blue],
    ready: [false, false, false]
  }), [0, 0, 0])
})

test('mode indexes match the mix shader', () => {
  assert.equal(mixerModeIndex('solo'), 0)
  assert.equal(mixerModeIndex('crossfade'), 1)
  assert.equal(mixerModeIndex('blend'), 2)
  assert.equal(blendModeIndex('normal'), 0)
  assert.equal(blendModeIndex('additive'), 1)
  assert.equal(blendModeIndex('multiply'), 2)
  assert.equal(blendModeIndex('difference'), 3)
  assert.equal(blendModeIndex('nope'), 0)
})
