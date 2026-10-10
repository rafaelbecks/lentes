import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDefaultProject } from '../src/projects/schema.js'
import {
  SHADERTOY_TEMPLATE,
  customShaderId,
  readCompileLog,
  shaderLabel,
  shadertoyFragment
} from '../src/sources/shadertoy.js'

test('Shadertoy code is wrapped with its uniforms and a main()', () => {
  const source = shadertoyFragment(SHADERTOY_TEMPLATE)
  assert.ok(source.startsWith('#version 300 es'))
  for (const name of ['iResolution', 'iTime', 'iTimeDelta', 'iFrame', 'iMouse', 'iDate', 'iChannel0', 'iChannel3', 'iChannelResolution']) {
    assert.ok(source.includes(name), name)
  }
  assert.ok(source.includes('#line 1\nvoid mainImage'))
  assert.ok(source.includes('mainImage(color, gl_FragCoord.xy)'))
})

test('a pasted #version line is dropped', () => {
  const source = shadertoyFragment('#version 300 es\nvoid mainImage(out vec4 c, in vec2 p) {}')
  assert.equal(source.match(/#version/g).length, 1)
})

test('compile logs map to the user’s line numbers', () => {
  assert.deepEqual(readCompileLog("ERROR: 0:3: 'foo' : undeclared identifier\nERROR: 0:3: '' : compilation terminated\n"), [
    { line: 3, message: "'foo' : undeclared identifier" },
    { line: 3, message: "'' : compilation terminated" }
  ])
  assert.deepEqual(readCompileLog('Program link failed'), [{ line: 0, message: 'Program link failed' }])
})

test('labels name procedural and imported shaders', () => {
  const state = createDefaultProject()
  state.shaders.push({ id: 'abc', name: 'Glass', code: '' })
  assert.equal(customShaderId('custom:abc'), 'abc')
  assert.equal(customShaderId('Portal'), '')
  assert.equal(shaderLabel(state, 'custom:abc'), 'Glass')
  assert.equal(shaderLabel(state, 'custom:nope'), 'Missing shader')
  assert.equal(typeof shaderLabel(state, 'Portal'), 'string')
})
