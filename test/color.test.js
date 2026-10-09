import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyColor, colorIsIdentity, hexToRgb } from '../src/effects/color-math.js'

const identity = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  threshold: 0,
  posterize: 0
}

test('GLOW filter levels leave color unchanged at 100', () => {
  const rgb = [0.2, 0.4, 0.8]
  assert.deepEqual(applyColor(rgb, identity), rgb)
  assert.equal(colorIsIdentity(identity), true)
})

test('brightness, contrast, threshold, and posterize', () => {
  assert.deepEqual(applyColor([0.5, 0.5, 0.5], { ...identity, brightness: 0 }), [0, 0, 0])
  assert.deepEqual(applyColor([0.2, 0.2, 0.2], { ...identity, contrast: 0 }), [0.5, 0.5, 0.5])
  const gray = applyColor([1, 0, 0], { ...identity, saturation: 0 })
  assert.ok(Math.abs(gray[0] - gray[1]) < 1e-12)
  assert.deepEqual(applyColor([0.2, 0.2, 0.2], { ...identity, threshold: 0.5 }), [0, 0, 0])
  assert.deepEqual(applyColor([0.8, 0.8, 0.8], { ...identity, threshold: 0.5 }), [1, 1, 1])
  assert.deepEqual(applyColor([0.1, 0.6, 1], { ...identity, posterize: 2 }), [0, 1, 1])
})

test('overlay green matches the LENTE accent', () => {
  const rgb = hexToRgb('#aef0b8')
  assert.ok(Math.abs(rgb[0] - 174 / 255) < 1e-9)
  assert.deepEqual(hexToRgb('nope')[1], 240 / 255)
})
