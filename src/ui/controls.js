import { Pane } from '../../node_modules/tweakpane/dist/tweakpane.js'
import { BLEND_MODES, MIXER_MODES } from '../mixer/blend.js'
import { EFFECT_DEFINITIONS, moveEffect } from '../effects/registry.js'
import { randomDistinctDitherRgb } from '../effects/dither-tables.js'

function optionsFrom (entries) {
  const options = {}
  for (const entry of entries) options[entry.label] = entry.id
  return options
}

function addParam (folder, params, spec, onChange) {
  if (spec.type === 'slider') {
    return folder.addBinding(params, spec.key, {
      label: spec.label,
      min: spec.min,
      max: spec.max,
      step: spec.step
    }).on('change', onChange)
  }
  if (spec.type === 'list') {
    return folder.addBinding(params, spec.key, {
      label: spec.label,
      options: spec.options
    }).on('change', onChange)
  }
  if (spec.type === 'color') {
    return folder.addBinding(params, spec.key, {
      label: spec.label,
      view: 'color'
    }).on('change', onChange)
  }
  return folder.addBinding(params, spec.key, { label: spec.label }).on('change', onChange)
}

export function createControls ({ container, state, onChange, onAllowCameras, onFormat }) {
  const pane = new Pane({ container, title: 'LENTE' })
  const inputs = pane.addFolder({ title: 'INPUTS', expanded: true })
  inputs.addButton({ title: 'Allow cameras' }).on('click', () => onAllowCameras())
  for (let i = 0; i < 3; i++) {
    const folder = inputs.addFolder({ title: `Input ${i + 1}`, expanded: i === 0 })
    const input = state.inputs[i]
    for (const spec of [
      { key: 'width', label: 'Width', min: 160, max: 1920, step: 2 },
      { key: 'height', label: 'Height', min: 120, max: 1080, step: 2 },
      { key: 'frameRate', label: 'Frame rate', min: 1, max: 60, step: 1 }
    ]) {
      folder.addBinding(input, spec.key, {
        label: spec.label,
        min: spec.min,
        max: spec.max,
        step: spec.step
      }).on('change', () => onFormat(i))
    }
  }

  const mixer = pane.addFolder({ title: 'MIXER', expanded: true })
  mixer.addBinding(state.mixer, 'mode', {
    label: 'Mode',
    options: optionsFrom(MIXER_MODES)
  }).on('change', onChange)
  mixer.addBinding(state.mixer, 'solo', {
    label: 'Solo',
    options: { 'Input 1': 0, 'Input 2': 1, 'Input 3': 2 }
  }).on('change', onChange)
  mixer.addBinding(state.mixer, 'crossfadeA', {
    label: 'A',
    options: { 'Input 1': 0, 'Input 2': 1, 'Input 3': 2 }
  }).on('change', onChange)
  mixer.addBinding(state.mixer, 'crossfadeB', {
    label: 'B',
    options: { 'Input 1': 0, 'Input 2': 1, 'Input 3': 2 }
  }).on('change', onChange)
  mixer.addBinding(state.mixer, 'crossfade', {
    label: 'Crossfade',
    min: 0,
    max: 1,
    step: 0.01
  }).on('change', onChange)
  mixer.addBinding(state.mixer, 'blend', {
    label: 'Blend',
    options: optionsFrom(BLEND_MODES)
  }).on('change', onChange)

  const weightView = {
    get input1 () { return state.mixer.weights[0] },
    set input1 (value) { state.mixer.weights[0] = value },
    get input2 () { return state.mixer.weights[1] },
    set input2 (value) { state.mixer.weights[1] = value },
    get input3 () { return state.mixer.weights[2] },
    set input3 (value) { state.mixer.weights[2] = value }
  }
  for (const key of ['input1', 'input2', 'input3']) {
    mixer.addBinding(weightView, key, { min: 0, max: 1, step: 0.01 }).on('change', onChange)
  }

  const folders = {
    COLOR: pane.addFolder({ title: 'COLOR', expanded: true }),
    TEXTURE: pane.addFolder({ title: 'TEXTURE', expanded: false }),
    EFFECTS: pane.addFolder({ title: 'EFFECTS', expanded: false })
  }

  function effectById (id) {
    return state.effects.find((effect) => effect.id === id)
  }

  for (const definition of EFFECT_DEFINITIONS) {
    const effect = effectById(definition.id)
    const parent = definition.id === 'color'
      ? folders.COLOR
      : folders[definition.folder].addFolder({ title: definition.name, expanded: false })
    parent.addBinding(effect, 'enabled', { label: 'Enabled' }).on('change', onChange)
    for (const spec of definition.params) addParam(parent, effect.params, spec, onChange)
    if (definition.id === 'dither') {
      parent.addButton({ title: 'Random tables' }).on('click', () => {
        const tables = randomDistinctDitherRgb()
        effect.params.tableR = tables.tableValuesR
        effect.params.tableG = tables.tableValuesG
        effect.params.tableB = tables.tableValuesB
        effect.params.crush = 1
        effect.enabled = true
        pane.refresh()
        onChange()
      })
    }
  }

  function refreshOrder () {
    const order = state.effects.map((effect) => effect.id).join(' → ')
    folders.EFFECTS.title = `EFFECTS · ${order}`
  }
  for (const definition of EFFECT_DEFINITIONS) {
    const row = folders.EFFECTS.addFolder({ title: definition.name, expanded: false })
    row.addButton({ title: 'Earlier' }).on('click', () => {
      if (moveEffect(state.effects, definition.id, -1)) {
        refreshOrder()
        onChange()
      }
    })
    row.addButton({ title: 'Later' }).on('click', () => {
      if (moveEffect(state.effects, definition.id, 1)) {
        refreshOrder()
        onChange()
      }
    })
  }
  refreshOrder()

  const output = pane.addFolder({ title: 'OUTPUT', expanded: true })
  output.addBinding(state.output, 'width', { label: 'Width', min: 160, max: 1920, step: 2 }).on('change', onChange)
  output.addBinding(state.output, 'height', { label: 'Height', min: 120, max: 1080, step: 2 }).on('change', onChange)
  output.addButton({ title: '720p' }).on('click', () => {
    state.output.width = 1280
    state.output.height = 720
    pane.refresh()
    onChange()
  })
  output.addButton({ title: '1080p' }).on('click', () => {
    state.output.width = 1920
    state.output.height = 1080
    pane.refresh()
    onChange()
  })

  return {
    refresh () {
      refreshOrder()
      pane.refresh()
    },
    dispose () {
      pane.dispose()
    }
  }
}
