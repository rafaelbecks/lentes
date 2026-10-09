import { Pane } from '../../node_modules/tweakpane/dist/tweakpane.js'
import * as EssentialsPlugin from '../lib/tweakpane-plugin-essentials.min.js'
import * as WaveformPlugin from '../lib/tweakpane-plugin-waveform.min.js'
import { effectDefinition } from '../effects/registry.js'
import { randomDistinctDitherRgb } from '../effects/dither-tables.js'
import { PROCEDURAL_SOURCES } from '../sources/procedural/index.js'
import { createLfoPanel } from './lfo-panel.js'

const SHADER_OPTIONS = Object.fromEntries(PROCEDURAL_SOURCES.map((entry) => [entry.displayLabel, entry.modeValue]))

function addParam (folder, params, spec) {
  if (spec.type === 'slider') {
    return folder.addBinding(params, spec.key, { label: spec.label, min: spec.min, max: spec.max, step: spec.step })
  }
  if (spec.type === 'list') return folder.addBinding(params, spec.key, { label: spec.label, options: spec.options })
  if (spec.type === 'color') return folder.addBinding(params, spec.key, { label: spec.label, view: 'color' })
  return folder.addBinding(params, spec.key, { label: spec.label })
}

/**
 * Side panel: one Tweakpane with MUSGO-style tabs.
 *   SOURCES  per-input operations, shader and camera format
 *   FX       parameters of the effect selected in the chain
 *   LFO      modulators
 *   OUTPUT   render size
 * `onChange(kind, detail)` reports every edit.
 */
export function createControls ({ container, state, getTime, onChange, onFormat }) {
  const pane = new Pane({ container })
  pane.registerPlugin(EssentialsPlugin)
  pane.registerPlugin(WaveformPlugin)
  const tab = pane.addTab({
    pages: [{ title: 'SOURCES' }, { title: 'FX' }, { title: 'LFO' }, { title: 'OUTPUT' }]
  })
  const [sourcesPage, fxPage, lfoPage, outputPage] = tab.pages

  for (let i = 0; i < 3; i++) {
    const input = state.inputs[i]
    const folder = sourcesPage.addFolder({ title: `INPUT ${i + 1}`, expanded: i === 0 })
    const changed = () => onChange('source', i)
    folder.addBinding(input, 'invert', { label: 'Invert' }).on('change', changed)
    folder.addBinding(input, 'flipX', { label: 'Flip X' }).on('change', changed)
    folder.addBinding(input, 'flipY', { label: 'Flip Y' }).on('change', changed)
    folder.addBinding(input, 'gain', { label: 'Gain', min: 0, max: 2, step: 0.01 }).on('change', changed)
    folder.addBinding(input, 'saturation', { label: 'Saturation', min: 0, max: 2, step: 0.01 }).on('change', changed)
    folder.addBinding(input, 'hue', { label: 'Hue', min: -180, max: 180, step: 1 }).on('change', changed)
    folder.addButton({ title: 'Reset operations' }).on('click', () => {
      Object.assign(input, { invert: false, flipX: false, flipY: false, gain: 1, saturation: 1, hue: 0 })
      pane.refresh()
      changed()
    })
    const shader = folder.addFolder({ title: 'Shader source', expanded: false })
    shader.addBinding(input, 'shader', { label: 'Shader', options: SHADER_OPTIONS }).on('change', () => onChange('shader', i))
    shader.addBinding(input, 'speed', { label: 'Speed', min: 0, max: 4, step: 0.01 }).on('change', changed)
    const camera = folder.addFolder({ title: 'Camera format', expanded: false })
    for (const spec of [
      { key: 'width', label: 'Width', min: 160, max: 1920, step: 2 },
      { key: 'height', label: 'Height', min: 120, max: 1080, step: 2 },
      { key: 'frameRate', label: 'Frame rate', min: 1, max: 60, step: 1 }
    ]) {
      camera.addBinding(input, spec.key, spec).on('change', () => onFormat(i))
    }
  }

  let fxFolder = null
  let fxId = state.effects[0]?.id

  function showEffect (id) {
    const effect = state.effects.find((entry) => entry.id === id)
    const definition = effectDefinition(id)
    if (!effect || !definition) return
    fxId = id
    if (fxFolder) fxFolder.dispose()
    const position = state.effects.indexOf(effect) + 1
    fxFolder = fxPage.addFolder({ title: `${position} · ${definition.name.toUpperCase()}`, expanded: true })
    const changed = () => onChange('effect', id)
    fxFolder.addBinding(effect, 'enabled', { label: 'Enabled' }).on('change', changed)
    for (const spec of definition.params) addParam(fxFolder, effect.params, spec).on('change', changed)
    if (id === 'dither') {
      fxFolder.addButton({ title: 'Random tables' }).on('click', () => {
        const tables = randomDistinctDitherRgb()
        effect.params.tableR = tables.tableValuesR
        effect.params.tableG = tables.tableValuesG
        effect.params.tableB = tables.tableValuesB
        effect.params.crush = 1
        effect.enabled = true
        pane.refresh()
        changed()
      })
    }
    if (id === 'glass' || id === 'mask') {
      fxFolder.addButton({ title: 'Center' }).on('click', () => {
        effect.params.centerX = 0.5
        effect.params.centerY = 0.5
        pane.refresh()
        changed()
      })
    }
    fxFolder.addButton({ title: 'Reset to defaults' }).on('click', () => {
      Object.assign(effect.params, definition.defaults)
      pane.refresh()
      changed()
    })
  }
  showEffect(fxId)

  const lfo = createLfoPanel({ page: lfoPage, state, getTime, onChange: (detail) => onChange('lfo', detail) })

  const output = outputPage.addFolder({ title: 'RENDER SIZE', expanded: true })
  const outputChanged = () => onChange('output')
  output.addBinding(state.output, 'width', { label: 'Width', min: 160, max: 1920, step: 2 }).on('change', outputChanged)
  output.addBinding(state.output, 'height', { label: 'Height', min: 120, max: 1080, step: 2 }).on('change', outputChanged)
  for (const [title, width, height] of [['720p', 1280, 720], ['1080p', 1920, 1080], ['Square 1080', 1080, 1080]]) {
    output.addButton({ title }).on('click', () => {
      state.output.width = width
      state.output.height = height
      pane.refresh()
      outputChanged()
    })
  }

  return {
    showEffect (id) {
      showEffect(id)
      tab.pages.forEach((page, index) => { page.selected = index === 1 })
    },
    syncEffect () {
      showEffect(fxId)
    },
    refresh () {
      showEffect(state.effects.some((entry) => entry.id === fxId) ? fxId : state.effects[0]?.id)
      lfo.render()
      pane.refresh()
    },
    refreshValues () {
      pane.refresh()
    },
    dispose () {
      lfo.dispose()
      pane.dispose()
    }
  }
}
