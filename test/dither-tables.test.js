import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomDistinctDitherRgb, sliderToTableValues } from '../src/effects/dither-tables.js'

test('slider table values match the GLOW and Cartografías transfer', () => {
  assert.equal(sliderToTableValues(0), '0 1')
  assert.equal(sliderToTableValues(1), '1 0')
  assert.equal(sliderToTableValues(0.25), '0.25 0.75')
  assert.equal(sliderToTableValues(2), '1 0')
})

test('random RGB tables occupy three different bands', () => {
  const sample = randomDistinctDitherRgb()
  const values = [sample.tableValuesR, sample.tableValuesG, sample.tableValuesB]
  const bands = values.map((value) => Math.min(2, Math.floor(value * 3)))
  assert.equal(new Set(bands).size, 3)
  for (const value of values) {
    assert.ok(value >= 0 && value <= 1)
  }
})
