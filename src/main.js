import { createDefaultProject, serializeProject } from './projects/schema.js'
import { applyProject } from './projects/apply.js'
import { createProjectManager } from './projects/project-manager.js'
import { createRenderer } from './renderer/renderer.js'
import { createDeviceManager, cameraErrorMessage, probeCameraPermission } from './inputs/device-manager.js'
import { createVideoInput } from './inputs/video-input.js'
import { createHistory } from './history/history.js'
import { applyModulation, modulatedCategories } from './modulation/modulation.js'
import { createAppMenu } from './ui/app-menu.js'
import { createDialogs } from './ui/dialogs.js'
import { createHistoryModal } from './ui/history-modal.js'
import { createMixerPanel } from './ui/mixer-panel.js'
import { createEffectChain } from './ui/effect-chain.js'
import { createControls } from './ui/controls.js'
import { bindStageDrag } from './ui/stage-drag.js'
import { createPreviewFitter } from './ui/preview-fit.js'
import { bindPanelResize } from './ui/panel-resize.js'
import { createSplash } from './ui/splash.js'
import { createProgramSender } from './program-link.js'

const state = createDefaultProject()
const title = document.querySelector('#project-name')
const status = document.querySelector('#status')
const fpsReadout = document.querySelector('#fps')
const hint = document.querySelector('#hint')
const boot = document.querySelector('#boot')
const stage = document.querySelector('#stage')
const fileInput = document.querySelector('#file-fallback')
const canvas = document.querySelector('#output')
const previewFrame = document.querySelector('#program-preview')

window.addEventListener('error', (event) => {
  boot.hidden = false
  boot.dataset.state = 'error'
  boot.textContent = event.message || 'LENTES failed to start'
  hint.hidden = true
})

const deviceManager = createDeviceManager()
const inputs = [0, 1, 2].map(() => createVideoInput())
const dialogs = createDialogs(document.querySelector('#modal'))
const clock = () => performance.now() / 1000

function startRenderer () {
  try {
    return createRenderer(canvas)
  } catch (error) {
    boot.hidden = false
    boot.dataset.state = 'error'
    boot.textContent = error.message || 'WebGL failed'
    hint.hidden = true
    throw error
  }
}

const renderer = startRenderer()
const preview = createPreviewFitter({
  stage,
  frame: previewFrame,
  getOutputSize: () => state.output
})
const program = createProgramSender(state)
bindPanelResize({ onResize: () => preview.sync() })

let clean = false
let projects = null
let history = null
let menu = null
const formatTimers = [0, 0, 0]

function touchTitle () {
  const mark = projects?.isDirty() ? ' *' : ''
  title.textContent = `${state.name}${mark}`
  document.title = `${state.name}${mark} — LENTES`
}

function updateHint () {
  const live = state.inputs.some((input, i) => input.kind === 'shader' || inputs[i].status === 'live')
  hint.hidden = live || boot.dataset.state === 'error'
}

function report (error) {
  console.error(error)
  status.textContent = error?.message || 'Something went wrong'
}

/** Every edit from any surface ends here: dirty mark, history, sibling views. */
function edited (origin) {
  touchTitle()
  history?.noteEdit()
  preview.sync()
  program.send()
  if (origin !== 'mixer') mixer.render()
  if (origin !== 'chain') chain.render()
  if (origin === 'chain') controls.syncEffect()
  if (origin === 'mixer' || origin === 'stage') controls.refreshValues()
  menu?.refresh()
}

const chainRoot = document.createElement('div')
const chain = createEffectChain({
  root: chainRoot,
  state,
  onChange: () => edited('chain'),
  onSelect: (id) => controls.showEffect(id),
  isModulated: (id) => modulatedCategories(state).has(id)
})

const mixer = createMixerPanel({
  root: document.querySelector('#mixer'),
  state,
  videos: inputs.map((input) => input.video),
  chainRoot,
  onChange: () => edited('mixer'),
  onSource: (index, value) => chooseSource(index, value).catch(report)
})

function onFormat (index) {
  edited('pane')
  if (inputs[index].status !== 'live') return
  window.clearTimeout(formatTimers[index])
  formatTimers[index] = window.setTimeout(() => connectSlot(index), 350)
}

const controls = createControls({
  container: document.querySelector('#pane'),
  state,
  getTime: clock,
  onChange: () => edited('pane'),
  onFormat
})

bindStageDrag({ canvas, state, onChange: () => edited('stage') })

function disconnectSlot (index, kind = 'idle') {
  window.clearTimeout(formatTimers[index])
  inputs[index].disconnect()
  mixer.setStatus(index, kind)
}

async function connectSlot (index) {
  const spec = state.inputs[index]
  mixer.setStatus(index, 'connecting')
  try {
    if (!deviceManager.list().some((device) => device.labeled)) {
      await probeCameraPermission()
      await deviceManager.refresh()
    }
    const deviceId = spec.deviceId || deviceManager.list()[0]?.deviceId || ''
    const actual = await inputs[index].connect({
      deviceId,
      width: spec.width,
      height: spec.height,
      frameRate: spec.frameRate
    })
    spec.deviceId = inputs[index].deviceId || deviceId
    spec.label = inputs[index].label
    const rate = actual?.frameRate ? ` @ ${Math.round(actual.frameRate)}` : ''
    mixer.setStatus(index, 'live', `${actual.width}×${actual.height}${rate}`)
    touchTitle()
    program.send()
  } catch (error) {
    mixer.setStatus(index, 'error', cameraErrorMessage(error))
    report(error)
  }
  updateHint()
}

async function allowCameras () {
  try {
    await probeCameraPermission()
    await deviceManager.refresh()
    status.textContent = 'Cameras allowed'
    await restoreInputs()
  } catch (error) {
    report(error)
    status.textContent = cameraErrorMessage(error)
  }
  mixer.render()
}

async function chooseSource (index, value) {
  const input = state.inputs[index]
  if (value === 'allow') return allowCameras()
  if (value === 'off') {
    input.kind = 'none'
    input.deviceId = ''
    input.label = ''
    disconnectSlot(index)
  } else if (value.startsWith('shader:')) {
    input.kind = 'shader'
    input.shader = value.slice(7)
    disconnectSlot(index, 'shader')
  } else if (value.startsWith('camera:')) {
    input.kind = 'camera'
    input.deviceId = value.slice(7)
    input.label = deviceManager.list().find((device) => device.deviceId === input.deviceId)?.label || ''
    await connectSlot(index)
  }
  edited('mixer')
  controls.refreshValues()
  updateHint()
}

async function restoreSlot (index, list, labeled) {
  const input = state.inputs[index]
  if (input.kind === 'shader') return disconnectSlot(index, 'shader')
  if (input.kind !== 'camera' || !input.deviceId) return disconnectSlot(index)
  inputs[index].disconnect()
  if (!labeled) return mixer.setStatus(index, 'permission')
  if (!list.some((device) => device.deviceId === input.deviceId)) return mixer.setStatus(index, 'missing')
  await connectSlot(index)
}

async function restoreInputs (only) {
  const list = deviceManager.list()
  const labeled = list.some((device) => device.labeled)
  for (let i = 0; i < 3; i++) {
    if (only && !only.includes(i)) continue
    await restoreSlot(i, list, labeled)
  }
  updateHint()
}

function replaceState (project) {
  const warnings = applyProject(state, project)
  preview.sync()
  program.send()
  controls.refresh()
  mixer.render()
  chain.render()
  touchTitle()
  return warnings
}

projects = createProjectManager({ getState: () => state, replaceState })

const SLOT_KEYS = ['kind', 'deviceId', 'shader', 'width', 'height', 'frameRate']
function slotSignature (input) {
  return SLOT_KEYS.map((key) => input[key]).join('|')
}

history = createHistory({
  getMemento () {
    const snapshot = serializeProject(state)
    return { fingerprint: JSON.stringify(snapshot), state: snapshot }
  },
  async apply (snapshot) {
    const before = state.inputs.map(slotSignature)
    replaceState(snapshot)
    const changed = state.inputs.map((input, i) => slotSignature(input) !== before[i] ? i : -1).filter((i) => i >= 0)
    if (changed.length) await restoreInputs(changed)
    menu?.refresh()
  },
  getKey: () => projects.historyKey(),
  onError: report
})

const historyModal = createHistoryModal(history)
history.subscribe(() => menu?.refresh())

async function confirmDiscard () {
  if (!projects.isDirty()) return true
  return dialogs.confirm('Discard unsaved changes?')
}

async function afterOpen (result) {
  if (!result?.name) return
  await history.runWithout(async () => {
    controls.refresh()
    await restoreInputs()
  })
  projects.noteClean()
  history.anchor('open')
  touchTitle()
  const extra = result.warnings?.length ? ` · ${result.warnings[0]}` : ''
  status.textContent = `Opened ${result.name}${extra}`
}

async function newProject () {
  if (!(await confirmDiscard())) return
  for (let i = 0; i < 3; i++) disconnectSlot(i)
  await history.runWithout(() => projects.blank())
  history.anchor('new project', { replace: true })
  touchTitle()
  updateHint()
  status.textContent = 'New project'
}

async function openProject () {
  if (!(await confirmDiscard())) return
  try {
    const result = await history.runWithout(() => projects.open())
    if (result?.needsInput) {
      fileInput.click()
      return
    }
    await afterOpen(result)
  } catch (error) {
    if (error?.name === 'AbortError') return
    report(error)
  }
}

async function openRecent () {
  const choice = await dialogs.choose(projects.recent())
  if (!choice) return
  if (!(await confirmDiscard())) return
  try {
    const result = await history.runWithout(() => projects.openRecent(choice.fileName))
    if (result?.missing) {
      status.textContent = 'Open that project from disk again.'
      fileInput.click()
      return
    }
    if (result?.denied) {
      status.textContent = 'Permission to read that project was denied.'
      return
    }
    await afterOpen(result)
  } catch (error) {
    if (error?.name === 'AbortError') return
    report(error)
  }
}

async function openFile (file) {
  try {
    const result = await history.runWithout(async () => projects.openText(await file.text(), file.name))
    await afterOpen(result)
  } catch (error) {
    report(error)
  }
}

async function saveAs () {
  const name = await dialogs.askName(state.name)
  if (!name) return
  try {
    const result = await projects.saveAs(name)
    history.commitNow()
    history.rekey()
    controls.refreshValues()
    touchTitle()
    status.textContent = result.downloaded ? `Downloaded ${result.name}.lentes` : `Saved ${result.name}`
  } catch (error) {
    if (error?.name === 'AbortError') return
    report(error)
  }
}

async function save () {
  try {
    const result = await projects.save()
    if (result?.needsName) return saveAs()
    touchTitle()
    status.textContent = `Saved ${result.name}`
  } catch (error) {
    if (error?.name === 'AbortError') return
    report(error)
  }
}

async function fullscreen () {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await stage.requestFullscreen()
}

function toggleClean () {
  clean = !clean
  document.body.classList.toggle('is-clean', clean)
  menu.refresh()
}

menu = createAppMenu({
  parent: document.querySelector('#app-menu'),
  actions: {
    about: () => dialogs.about(),
    studio: () => window.open('https://luminode.studio/', '_blank', 'noopener'),
    new: newProject,
    open: openProject,
    recent: openRecent,
    save,
    saveAs,
    undo: () => history.undo(),
    redo: () => history.redo(),
    history: () => historyModal.open(),
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    fullscreen,
    clean: toggleClean,
    isClean: () => clean,
    onError: report
  }
})

deviceManager.onChange((devices) => {
  mixer.setDevices(devices)
  if (!devices.some((device) => device.labeled)) return
  for (let i = 0; i < 3; i++) {
    const input = state.inputs[i]
    if (input.kind !== 'camera' || !input.deviceId || inputs[i].status !== 'live') continue
    if (!devices.some((device) => device.deviceId === input.deviceId)) disconnectSlot(i, 'missing')
  }
  updateHint()
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0]
  fileInput.value = ''
  if (file) openFile(file)
})

function isTextField (target) {
  if (!target) return false
  if (target.tagName === 'TEXTAREA') return true
  return target.tagName === 'INPUT' && !['range', 'checkbox', 'button', 'color'].includes(target.type)
}

window.addEventListener('keydown', (event) => {
  const mod = event.metaKey || event.ctrlKey
  if (!mod || event.altKey || !event.key) return
  const key = event.key.toLowerCase()
  const redo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey)
  const undo = key === 'z' && !event.shiftKey
  if ((!undo && !redo) || isTextField(event.target)) return
  event.preventDefault()
  event.stopPropagation()
  if (undo) history.undo()
  else history.redo()
}, true)

window.addEventListener('keydown', (event) => {
  const tag = event.target && event.target.tagName
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (mod && key === 's') {
    event.preventDefault()
    if (event.shiftKey) saveAs()
    else save()
  } else if (mod && key === 'o') {
    event.preventDefault()
    openProject()
  } else if (mod && key === 'n') {
    event.preventDefault()
    newProject()
  } else if (mod && key === 'i') {
    event.preventDefault()
    toggleClean()
  } else if (!typing && !mod && key === 'f') {
    event.preventDefault()
    fullscreen()
  }
})

window.addEventListener('beforeunload', (event) => {
  if (!projects.isDirty()) return
  event.preventDefault()
  event.returnValue = ''
})

window.addEventListener('pagehide', () => {
  history.commitNow()
  preview.dispose()
  program.dispose()
  for (const input of inputs) input.disconnect()
})

document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement))
  preview.sync()
})

stage.addEventListener('dblclick', () => {
  fullscreen().catch(report)
})

window.addEventListener('dragover', (event) => {
  event.preventDefault()
  document.body.classList.add('is-dragover')
})
window.addEventListener('dragleave', () => {
  document.body.classList.remove('is-dragover')
})
window.addEventListener('drop', async (event) => {
  event.preventDefault()
  document.body.classList.remove('is-dragover')
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  if (!(await confirmDiscard())) return
  openFile(file)
})

const sources = inputs.map((input) => ({ video: input.video, live: false }))
let frames = 0
let stamp = performance.now()
function frame (now) {
  requestAnimationFrame(frame)
  if (document.hidden) return
  for (let i = 0; i < 3; i++) sources[i].live = inputs[i].isLive()
  const time = now / 1000
  const restore = applyModulation(state, time)
  let drew = false
  try {
    drew = renderer.render({ sources, state, time })
  } finally {
    restore()
  }
  if (drew && !boot.dataset.frame) {
    const pixel = new Uint8Array(4)
    renderer.gl.readPixels(0, 0, 1, 1, renderer.gl.RGBA, renderer.gl.UNSIGNED_BYTE, pixel)
    boot.dataset.frame = '1'
    boot.dataset.size = `${canvas.width}x${canvas.height}`
    boot.dataset.pixel = `${pixel[0]},${pixel[1]},${pixel[2]}`
  }
  frames += 1
  if (now - stamp > 500) {
    const rate = Math.round((frames * 1000) / (now - stamp))
    frames = 0
    stamp = now
    fpsReadout.textContent = renderer.isLost() || drew === false ? 'WebGL lost' : `${rate} fps`
  }
}

const splashRoot = document.querySelector('#splash')
if (splashRoot) createSplash({ root: splashRoot })

history.anchor('new project')
touchTitle()
program.send()
boot.dataset.state = 'ready'
boot.hidden = true
updateHint()
status.textContent = window.isSecureContext ? 'Ready' : 'Cameras need localhost or https.'
deviceManager.refresh().then((devices) => mixer.setDevices(devices)).catch(report)
requestAnimationFrame(frame)
