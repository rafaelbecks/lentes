/**
 * LFO tab, after MUSGO src/modulation/modulationUI.js (MIT): addable LFOs
 * with waveform, target, rate / depth / offset, a live waveform monitor and
 * an inline cubic-bezier editor. Bindings write straight to the modulator
 * objects in `state.modulation.modulators`.
 */
import {
  RATE_MAX,
  RATE_MIN,
  WAVEFORM_SHAPES,
  createModulator,
  generateWaveform,
  resolveParam,
  targetCatalog
} from '../modulation/modulation.js'

const SAMPLES = 64
const WINDOW_SECONDS = 2

function monitorSamples (modulator, now, values) {
  for (let i = 0; i < SAMPLES; i++) {
    if (!modulator.enabled) {
      values[i] = 0
      continue
    }
    const t = now - (WINDOW_SECONDS - (i * WINDOW_SECONDS) / (SAMPLES - 1))
    const phase = t * Math.max(RATE_MIN, modulator.rate || 0.1) * Math.PI * 2
    const wave = generateWaveform(modulator.shape, phase, modulator.cubicBezier)
    values[i] = Math.max(-1, Math.min(1, wave * modulator.depth + modulator.offset))
  }
  return values
}

export function createLfoPanel ({ page, state, getTime, onChange }) {
  const catalog = targetCatalog()
  const categoryOptions = { 'Select target': '' }
  for (const group of catalog) categoryOptions[group.label] = group.category
  const shapeOptions = {}
  for (const [id, label] of Object.entries(WAVEFORM_SHAPES)) shapeOptions[label] = id

  page.addButton({ title: 'Add LFO' }).on('click', () => {
    state.modulation.modulators.push(createModulator())
    render()
    onChange('lfo add')
  })

  let list = null
  let monitors = []
  let raf = 0

  function tick () {
    const now = getTime()
    for (const monitor of monitors) monitorSamples(monitor.modulator, now, monitor.data.values)
    raf = requestAnimationFrame(tick)
  }

  function stop () {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function addModulator (modulator, index) {
    const folder = list.addFolder({ title: `LFO ${index + 1}`, expanded: true })
    const edit = (rerender) => () => {
      if (rerender) render()
      onChange('lfo')
    }
    folder.addBinding(modulator, 'enabled', { label: 'Enabled' }).on('change', edit(false))
    folder.addBinding(modulator, 'shape', { label: 'Waveform', options: shapeOptions }).on('change', edit(true))

    const target = { category: modulator.targetCategory || '', key: modulator.targetConfigKey || '' }
    folder.addBinding(target, 'category', { label: 'Target', options: categoryOptions }).on('change', (event) => {
      modulator.targetCategory = event.value || null
      modulator.targetConfigKey = null
      render()
      onChange('lfo target')
    })
    const group = catalog.find((entry) => entry.category === target.category)
    if (group) {
      const options = { 'Select parameter': '' }
      for (const entry of group.targets) options[entry.label] = entry.key
      folder.addBinding(target, 'key', { label: 'Parameter', options }).on('change', (event) => {
        modulator.targetConfigKey = event.value || null
        render()
        onChange('lfo target')
      })
    }

    folder.addBinding(modulator, 'rate', { label: 'Rate (Hz)', min: RATE_MIN, max: RATE_MAX, step: 0.001 }).on('change', edit(false))
    folder.addBinding(modulator, 'depth', { label: 'Depth', min: 0, max: 1, step: 0.01 }).on('change', edit(false))
    folder.addBinding(modulator, 'offset', { label: 'Offset', min: -1, max: 1, step: 0.01 }).on('change', edit(false))

    const data = { values: new Array(SAMPLES).fill(0) }
    folder.addBinding(data, 'values', {
      view: 'waveform',
      label: 'Monitor',
      readonly: true,
      min: -1,
      max: 1,
      interval: 50,
      style: 'bezier'
    })
    monitors.push({ modulator, data })

    if (modulator.shape === 'cubicBezier') {
      folder.addBlade({
        view: 'cubicbezier',
        value: modulator.cubicBezier,
        expanded: true,
        label: 'Curve',
        picker: 'inline'
      }).on('change', (event) => {
        const value = event.value
        const bezier = Array.isArray(value) ? value : value?.toObject?.() || [value.x1, value.y1, value.x2, value.y2]
        modulator.cubicBezier = bezier.map(Number)
        onChange('lfo curve')
      })
    }

    const param = resolveParam(modulator.targetCategory, modulator.targetConfigKey)
    if (param?.type === 'checkbox') {
      folder.addBinding(modulator, 'threshold', { label: 'Threshold', min: 0, max: 1, step: 0.01 }).on('change', edit(false))
    }

    folder.addButton({ title: 'Remove LFO' }).on('click', () => {
      const at = state.modulation.modulators.indexOf(modulator)
      if (at >= 0) state.modulation.modulators.splice(at, 1)
      render()
      onChange('lfo remove')
    })
  }

  function render () {
    stop()
    monitors = []
    if (list) list.dispose()
    const modulators = state.modulation.modulators
    list = page.addFolder({ title: modulators.length ? `MODULATORS (${modulators.length})` : 'MODULATORS', expanded: true })
    modulators.forEach(addModulator)
    if (monitors.length) raf = requestAnimationFrame(tick)
  }

  render()
  return { render, dispose: stop }
}
