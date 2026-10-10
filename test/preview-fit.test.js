import assert from 'node:assert/strict'
import { test } from 'node:test'
import { containSize } from '../src/ui/preview-fit.js'

test('program preview contains landscape output in the available stage', () => {
  assert.deepEqual(containSize(1920, 1080, 1000, 800), {
    width: 1000,
    height: 562.5,
    scale: 1000 / 1920
  })
})

test('program preview contains portrait and square output without distortion', () => {
  assert.deepEqual(containSize(1080, 1920, 1000, 600), {
    width: 337.5,
    height: 600,
    scale: 600 / 1920
  })
  assert.deepEqual(containSize(1080, 1080, 900, 600), {
    width: 600,
    height: 600,
    scale: 600 / 1080
  })
})

test('program preview rejects invalid dimensions', () => {
  assert.deepEqual(containSize(0, 1080, 900, 600), { width: 0, height: 0, scale: 0 })
  assert.deepEqual(containSize(1920, 1080, Number.NaN, 600), { width: 0, height: 0, scale: 0 })
})
