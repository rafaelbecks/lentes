import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_ENTRIES, createHistory, describeChange } from '../src/history/history.js'
import { createDefaultProject, serializeProject } from '../src/projects/schema.js'
import { applyProject } from '../src/projects/apply.js'

function memoryStorage () {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    data
  }
}

function setup (storage = memoryStorage(), key = 'draft:a') {
  const state = createDefaultProject()
  const history = createHistory({
    storage,
    getKey: () => key,
    getMemento () {
      const snapshot = serializeProject(state)
      return { fingerprint: JSON.stringify(snapshot), state: snapshot }
    },
    apply: (snapshot) => applyProject(state, snapshot),
    onError: (error) => { throw error }
  })
  return { state, history, storage }
}

test('commits edits and walks undo / redo through whole snapshots', async () => {
  const { state, history } = setup()
  history.anchor('new project')
  assert.equal(history.canUndo(), false)
  state.mixer.crossfade = 0.9
  assert.equal(history.canUndo(), true)
  assert.equal(history.commitNow(), true)
  state.effects.find((effect) => effect.id === 'glass').enabled = true
  history.commitNow()
  assert.deepEqual(history.list().entries.map((entry) => entry.label), ['new project', 'crossfade', 'glass on'])

  await history.undo()
  assert.equal(state.effects.find((effect) => effect.id === 'glass').enabled, false)
  assert.equal(state.mixer.crossfade, 0.9)
  await history.undo()
  assert.equal(state.mixer.crossfade, 0.5)
  assert.equal(history.canUndo(), false)
  assert.equal(history.canRedo(), true)
  await history.redo()
  assert.equal(state.mixer.crossfade, 0.9)
})

test('an edit after undo drops the redo branch; redo after drift commits instead', async () => {
  const { state, history } = setup()
  history.anchor('new project')
  state.output.width = 640
  history.commitNow()
  await history.undo()
  state.mixer.blend = 'additive'
  assert.equal(history.canRedo(), false)
  assert.equal(await history.redo(), false)
  const labels = history.list().entries.map((entry) => entry.label)
  assert.deepEqual(labels, ['new project', 'blend → additive'])
})

test('keeps at most 20 moments and persists per project key', async () => {
  const storage = memoryStorage()
  const first = setup(storage, 'file:a.lente')
  first.history.anchor('open')
  for (let i = 0; i < 30; i++) {
    first.state.mixer.crossfade = i / 100
    first.history.commitNow()
  }
  assert.equal(first.history.list().entries.length, MAX_ENTRIES)

  const second = setup(storage, 'file:a.lente')
  second.state.mixer.crossfade = 0.29
  second.history.anchor('open')
  assert.equal(second.history.list().entries.length, MAX_ENTRIES)
  assert.equal(second.history.list().cursor, MAX_ENTRIES - 1)
  await second.history.undo()
  assert.equal(second.state.mixer.crossfade, 0.28)
})

test('runWithout suppresses commits from programmatic changes', async () => {
  const { state, history } = setup()
  history.anchor('new project')
  await history.runWithout(() => {
    state.name = 'loaded'
    history.noteEdit()
  })
  assert.equal(history.list().entries.length, 1)
})

test('describeChange names sources, order, LFOs, and output', () => {
  const a = serializeProject(createDefaultProject())
  const b = JSON.parse(JSON.stringify(a))
  b.inputs[1].invert = true
  b.effects.reverse()
  b.modulation.modulators.push({ id: 'x' })
  assert.equal(describeChange(JSON.stringify(a), JSON.stringify(b)), 'input 2 invert on, effect order, LFO')
  const c = JSON.parse(JSON.stringify(a))
  c.output.width = 640
  assert.equal(describeChange(JSON.stringify(a), JSON.stringify(c)), 'output size')
  assert.equal(describeChange('x', '{}'), 'change')
})
