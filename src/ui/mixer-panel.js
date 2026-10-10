/**
 * Bottom mixer: one channel strip per input with GLOW's vertical fader
 * (src/components/luminode-mixer-ui.js, src/styles/mixer-panel.css), a master
 * section with mode, blend and crossfader, and the draggable effect chain.
 * Plain DOM; edits write to `state` and call `onChange(label)`.
 */
import { BLEND_MODES, MIXER_MODES } from '../mixer/blend.js'
import { PROCEDURAL_SOURCES } from '../sources/procedural/index.js'
import { CUSTOM_PREFIX, shaderLabel } from '../sources/shadertoy.js'

const STATUS_TEXT = {
  idle: 'off',
  connecting: 'connecting…',
  missing: 'camera unavailable',
  permission: 'allow cameras to restore',
  ended: 'disconnected',
  shader: 'procedural',
  file: 'file'
}

const MODE_SHORT = { solo: 'SOLO', crossfade: 'X·FADE', blend: 'BLEND' }

function el (tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button (className, text, title) {
  const node = el('button', className, text)
  node.type = 'button'
  if (title) node.title = title
  return node
}

function setFaderFill (input) {
  const min = Number(input.min)
  const max = Number(input.max)
  const pct = ((Number(input.value) - min) / (max - min)) * 100
  input.style.setProperty('--fader-fill', `${pct}%`)
}

export function createMixerPanel ({ root, state, videos, files, chainRoot, onChange, onSource }) {
  root.classList.add('mixer-panel')
  const stripsSection = el('section', 'mixer-section mixer-section--strips')
  stripsSection.append(el('div', 'mixer-section-title', 'Inputs'))
  const strips = el('div', 'luminode-mixer-strips')
  stripsSection.append(strips)

  const master = el('section', 'mixer-section mixer-section--master')
  master.append(el('div', 'mixer-section-title', 'Mix'))

  const effects = el('section', 'mixer-section mixer-section--effects')
  effects.append(el('div', 'mixer-section-title', 'Effect chain · drag to reorder'))
  effects.append(chainRoot)

  root.replaceChildren(stripsSection, master, effects)

  let devices = []
  let shaderList = ''
  const channels = []

  for (let i = 0; i < 3; i++) {
    const strip = el('div', 'mixer-strip')
    const meta = el('div', 'mixer-strip-meta')
    const name = el('div', 'mixer-strip-name', `IN ${i + 1}`)
    const sub = el('div', 'mixer-strip-luminode', 'off')
    meta.append(name, sub)

    const preview = el('div', 'mixer-strip-preview')
    const placeholder = el('span', 'mixer-strip-placeholder', '')
    videos[i].classList.add('preview-camera')
    preview.append(videos[i], files[i].video, files[i].image, placeholder)

    const select = el('select', 'mixer-strip-source')
    select.setAttribute('aria-label', `Source for input ${i + 1}`)
    select.addEventListener('change', () => {
      const value = select.value
      onSource(i, value)
    })

    const status = el('div', 'mixer-strip-status', 'off')

    const ops = el('div', 'mixer-strip-ops')
    const invert = button('mixer-op-btn', 'INV', 'Invert colors')
    const flipX = button('mixer-op-btn', '↔', 'Flip horizontally')
    const flipY = button('mixer-op-btn', '↕', 'Flip vertically')
    ops.append(invert, flipX, flipY)

    const level = el('div', 'mixer-strip-opacity')
    const fader = el('input', 'mixer-fader')
    fader.type = 'range'
    fader.min = '0'
    fader.max = '1'
    fader.step = '0.01'
    fader.setAttribute('aria-label', `Input ${i + 1} level`)
    const output = el('output', '', '0.00')
    level.append(fader, output)

    const ms = el('div', 'mixer-strip-ms')
    const mute = button('mixer-mute-btn', 'M', 'Mute')
    const solo = button('mixer-solo-btn', 'S', 'Solo')
    ms.append(mute, solo)

    const ab = el('div', 'mixer-strip-ms')
    const toA = button('mixer-ab-btn', 'A', 'Crossfade side A')
    const toB = button('mixer-ab-btn', 'B', 'Crossfade side B')
    ab.append(toA, toB)

    const buttons = el('div', 'mixer-strip-buttons')
    buttons.append(ops, ms, ab)
    const body = el('div', 'mixer-strip-body')
    body.append(level, buttons)
    strip.append(meta, preview, select, status, body)
    strips.append(strip)

    const input = state.inputs[i]
    const toggle = (key, label) => () => {
      input[key] = !input[key]
      render()
      onChange(label)
    }
    invert.addEventListener('click', toggle('invert', 'invert'))
    flipX.addEventListener('click', toggle('flipX', 'flip'))
    flipY.addEventListener('click', toggle('flipY', 'flip'))
    fader.addEventListener('input', () => {
      state.mixer.weights[i] = Number(fader.value)
      output.textContent = Number(fader.value).toFixed(2)
      setFaderFill(fader)
      onChange('fader')
    })
    mute.addEventListener('click', () => {
      state.mixer.mutes[i] = !state.mixer.mutes[i]
      render()
      onChange('mute')
    })
    solo.addEventListener('click', () => {
      if (state.mixer.mode === 'solo' && state.mixer.solo === i) {
        state.mixer.mode = 'blend'
      } else {
        state.mixer.mode = 'solo'
        state.mixer.solo = i
      }
      render()
      onChange('solo')
    })
    toA.addEventListener('click', () => {
      state.mixer.crossfadeA = i
      render()
      onChange('crossfade A')
    })
    toB.addEventListener('click', () => {
      state.mixer.crossfadeB = i
      render()
      onChange('crossfade B')
    })

    channels.push({ strip, sub, preview, placeholder, select, status, invert, flipX, flipY, fader, output, mute, solo, toA, toB, kind: 'idle' })
  }

  const modes = el('div', 'mixer-modes')
  const modeButtons = MIXER_MODES.map((mode) => {
    const node = button('mixer-mode-btn', MODE_SHORT[mode.id] || mode.label, `${mode.label} mode`)
    node.addEventListener('click', () => {
      state.mixer.mode = mode.id
      render()
      onChange('mode')
    })
    modes.append(node)
    return { id: mode.id, node }
  })

  const blendLabel = el('label', 'mixer-field')
  blendLabel.append(el('span', '', 'Blend'))
  const blend = el('select', 'mixer-select')
  for (const mode of BLEND_MODES) {
    const option = el('option', '', mode.label)
    option.value = mode.id
    blend.append(option)
  }
  blend.addEventListener('change', () => {
    state.mixer.blend = blend.value
    onChange('blend')
  })
  blendLabel.append(blend)

  const xfade = el('div', 'mixer-crossfader')
  const sideA = el('span', 'mixer-crossfader-side', 'A')
  const sideB = el('span', 'mixer-crossfader-side', 'B')
  const crossfader = el('input', 'mixer-hfader')
  crossfader.type = 'range'
  crossfader.min = '0'
  crossfader.max = '1'
  crossfader.step = '0.01'
  crossfader.setAttribute('aria-label', 'Crossfader')
  crossfader.addEventListener('input', () => {
    state.mixer.crossfade = Number(crossfader.value)
    setFaderFill(crossfader)
    onChange('crossfade')
  })
  crossfader.addEventListener('dblclick', () => {
    state.mixer.crossfade = 0.5
    render()
    onChange('crossfade')
  })
  xfade.append(sideA, crossfader, sideB)
  const hint = el('p', 'mixer-hint', '')

  master.append(modes, blendLabel, el('div', 'mixer-section-title', 'Crossfader'), xfade, hint)

  function sourceValue (input) {
    if (input.kind === 'shader') return `shader:${input.shader}`
    if (input.kind === 'camera' && input.deviceId) return `camera:${input.deviceId}`
    if (input.kind === 'file') return 'file'
    return 'off'
  }

  function fillSelect (i) {
    const input = state.inputs[i]
    const select = channels[i].select
    const options = [el('option', '', 'Off')]
    options[0].value = 'off'
    const cams = el('optgroup')
    cams.label = 'Cameras'
    for (const device of devices) {
      const option = el('option', '', device.label)
      option.value = `camera:${device.deviceId}`
      cams.append(option)
    }
    if (input.kind === 'camera' && input.deviceId && !devices.some((device) => device.deviceId === input.deviceId)) {
      const option = el('option', '', input.label || 'Saved camera')
      option.value = `camera:${input.deviceId}`
      cams.append(option)
    }
    if (!devices.some((device) => device.labeled)) {
      const option = el('option', '', devices.length ? 'Allow cameras…' : 'Find cameras…')
      option.value = 'allow'
      cams.append(option)
    }
    const media = el('optgroup')
    media.label = 'File'
    if (input.kind === 'file') {
      const current = el('option', '', input.label || 'Video or image')
      current.value = 'file'
      media.append(current)
    }
    const pick = el('option', '', input.kind === 'file' ? 'Replace video or image…' : 'Video or image…')
    pick.value = 'file:pick'
    media.append(pick)
    const shaders = el('optgroup')
    shaders.label = 'Shaders (GLOW)'
    for (const shader of PROCEDURAL_SOURCES) {
      const option = el('option', '', shader.displayLabel)
      option.value = `shader:${shader.modeValue}`
      shaders.append(option)
    }
    const imported = el('optgroup')
    imported.label = 'Shaders (Shadertoy)'
    for (const shader of state.shaders) {
      const option = el('option', '', shader.name)
      option.value = `shader:${CUSTOM_PREFIX}${shader.id}`
      imported.append(option)
    }
    const lab = el('option', '', state.shaders.length ? 'Shader Lab…' : 'Import from Shadertoy…')
    lab.value = 'lab'
    imported.append(lab)
    select.replaceChildren(...options, cams, media, shaders, imported)
    select.value = sourceValue(input)
    if (select.value !== sourceValue(input)) select.value = 'off'
  }

  function render () {
    const mixer = state.mixer
    const list = state.shaders.map((shader) => `${shader.id}:${shader.name}`).join('|')
    const listChanged = list !== shaderList
    shaderList = list
    for (let i = 0; i < 3; i++) {
      const input = state.inputs[i]
      const c = channels[i]
      if (listChanged || c.select.value !== sourceValue(input)) fillSelect(i)
      const shader = input.kind === 'shader'
      const file = files[i]
      const showImage = input.kind === 'file' && file.kind === 'image' && file.isReady()
      const showMovie = input.kind === 'file' && file.kind === 'video' && file.isReady()
      c.sub.textContent = shader
        ? shaderLabel(state, input.shader)
        : input.kind === 'file'
          ? (input.label || 'file')
          : input.kind === 'camera' && input.deviceId ? (input.label || 'camera') : 'off'
      c.sub.title = c.sub.textContent
      c.placeholder.textContent = shader ? '◇ shader' : showImage || showMovie ? '' : input.kind === 'file' ? '▣ file' : c.kind === 'live' ? '' : '—'
      c.preview.classList.toggle('is-live', !shader && !showImage && !showMovie && c.kind === 'live')
      c.preview.classList.toggle('is-image', showImage)
      c.preview.classList.toggle('is-movie', showMovie)
      c.invert.classList.toggle('active', input.invert)
      c.flipX.classList.toggle('active', input.flipX)
      c.flipY.classList.toggle('active', input.flipY)
      c.fader.value = String(mixer.weights[i])
      c.output.textContent = Number(mixer.weights[i]).toFixed(2)
      setFaderFill(c.fader)
      c.fader.classList.toggle('is-inactive', mixer.mode !== 'blend')
      c.mute.classList.toggle('active', mixer.mutes[i])
      c.strip.classList.toggle('is-muted', mixer.mutes[i])
      c.solo.classList.toggle('active', mixer.mode === 'solo' && mixer.solo === i)
      c.toA.classList.toggle('active', mixer.crossfadeA === i)
      c.toB.classList.toggle('active', mixer.crossfadeB === i)
      c.toA.classList.toggle('is-inactive', mixer.mode !== 'crossfade')
      c.toB.classList.toggle('is-inactive', mixer.mode !== 'crossfade')
      c.strip.classList.toggle('is-on-air', isOnAir(i))
    }
    for (const { id, node } of modeButtons) node.classList.toggle('active', mixer.mode === id)
    blend.value = mixer.blend
    crossfader.value = String(mixer.crossfade)
    setFaderFill(crossfader)
    sideA.textContent = `A·${mixer.crossfadeA + 1}`
    sideB.textContent = `${mixer.crossfadeB + 1}·B`
    xfade.classList.toggle('is-inactive', mixer.mode !== 'crossfade')
    hint.textContent = mixer.mode === 'blend'
      ? 'Faders set each input’s weight.'
      : mixer.mode === 'crossfade'
        ? 'A/B on each strip picks the crossfade pair.'
        : 'S on a strip picks the solo input.'
  }

  function isOnAir (i) {
    const mixer = state.mixer
    if (mixer.mutes[i]) return false
    if (mixer.mode === 'solo') return mixer.solo === i
    if (mixer.mode === 'crossfade') return mixer.crossfadeA === i || mixer.crossfadeB === i
    return mixer.weights[i] > 0
  }

  function setDevices (list) {
    devices = list
    for (let i = 0; i < 3; i++) fillSelect(i)
    render()
  }

  function setStatus (index, kind, detail) {
    const c = channels[index]
    c.kind = kind
    c.status.dataset.kind = kind
    c.status.textContent = detail || STATUS_TEXT[kind] || kind
    c.status.title = c.status.textContent
    render()
  }

  for (let i = 0; i < 3; i++) fillSelect(i)
  render()
  return { render, setDevices, setStatus }
}
