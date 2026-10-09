import { createDefaultProject } from './projects/schema.js'
import { applyProject } from './projects/apply.js'
import { createProjectManager } from './projects/project-manager.js'
import { createRenderer } from './renderer/renderer.js'
import { createDeviceManager, cameraErrorMessage, probeCameraPermission } from './inputs/device-manager.js'
import { createVideoInput } from './inputs/video-input.js'
import { createAppMenu } from './ui/app-menu.js'
import { createDialogs } from './ui/dialogs.js'
import { createInputsPanel } from './ui/inputs-panel.js'
import { createControls } from './ui/controls.js'

const state = createDefaultProject()
const title = document.querySelector('#project-name')
const status = document.querySelector('#status')
const fpsReadout = document.querySelector('#fps')
const hint = document.querySelector('#hint')
const boot = document.querySelector('#boot')
const stage = document.querySelector('#stage')
const fileInput = document.querySelector('#file-fallback')
const canvas = document.querySelector('#output')

window.addEventListener('error', (event) => {
  boot.hidden = false
  boot.dataset.state = 'error'
  boot.textContent = event.message || 'LENTE failed to start'
  hint.hidden = true
})

const deviceManager = createDeviceManager()
const inputs = [0, 1, 2].map(() => createVideoInput())
const dialogs = createDialogs(document.querySelector('#modal'))

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

let clean = false
const formatTimers = [0, 0, 0]

function touchTitle () {
  const mark = projects?.isDirty() ? ' *' : ''
  title.textContent = `${state.name}${mark}`
  document.title = `${state.name}${mark} — LENTE`
}

function updateHint () {
  const live = inputs.some((input) => input.status === 'live')
  hint.hidden = live || boot.dataset.state === 'error'
}

function report (error) {
  console.error(error)
  status.textContent = error?.message || 'Something went wrong'
}

const panel = createInputsPanel({
  root: document.querySelector('#strips'),
  videos: inputs.map((input) => input.video),
  state,
  onConnect: (index) => connectSlot(index),
  onDisconnect: (index) => {
    window.clearTimeout(formatTimers[index])
    inputs[index].disconnect()
    panel.setStatus(index, 'idle')
    updateHint()
  }
})

function onChange () {
  touchTitle()
}

function onFormat (index) {
  onChange()
  if (inputs[index].status !== 'live') return
  window.clearTimeout(formatTimers[index])
  formatTimers[index] = window.setTimeout(() => {
    connectSlot(index)
  }, 350)
}

const controls = createControls({
  container: document.querySelector('#pane'),
  state,
  onChange,
  onFormat,
  onAllowCameras: async () => {
    try {
      await probeCameraPermission()
      await deviceManager.refresh()
      status.textContent = 'Cameras allowed'
      await restoreInputs()
      touchTitle()
    } catch (error) {
      report(error)
      status.textContent = cameraErrorMessage(error)
    }
  }
})

function replaceState (project) {
  const warnings = applyProject(state, project)
  controls.refresh()
  panel.setDevices(deviceManager.list())
  touchTitle()
  return warnings
}

const projects = createProjectManager({ getState: () => state, replaceState })

async function connectSlot (index) {
  const spec = state.inputs[index]
  panel.setStatus(index, 'connecting')
  try {
    const known = deviceManager.list()
    if (!spec.deviceId && !known.some((device) => device.labeled)) {
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
    panel.setDevices(deviceManager.list())
    const rate = actual?.frameRate ? ` @ ${Math.round(actual.frameRate)}` : ''
    panel.setStatus(index, 'live', `live · ${actual.width}×${actual.height}${rate}`)
    onChange()
  } catch (error) {
    panel.setStatus(index, 'error', cameraErrorMessage(error))
    report(error)
  }
  updateHint()
}

async function restoreInputs () {
  const list = deviceManager.list()
  const labeled = list.some((device) => device.labeled)
  for (let i = 0; i < 3; i++) {
    window.clearTimeout(formatTimers[i])
    inputs[i].disconnect()
    const wanted = state.inputs[i].deviceId
    if (!wanted) {
      panel.setStatus(i, 'idle')
      continue
    }
    if (!labeled) {
      panel.setStatus(i, 'permission')
      continue
    }
    if (!list.some((device) => device.deviceId === wanted)) {
      panel.setStatus(i, 'missing')
      continue
    }
    await connectSlot(i)
  }
  updateHint()
}

async function confirmDiscard () {
  if (!projects.isDirty()) return true
  return dialogs.confirm('Discard unsaved changes?')
}

async function afterOpen (result) {
  if (!result?.name) return
  controls.refresh()
  await restoreInputs()
  projects.noteClean()
  touchTitle()
  const extra = result.warnings?.length ? ` · ${result.warnings[0]}` : ''
  status.textContent = `Opened ${result.name}${extra}`
}

async function newProject () {
  if (!(await confirmDiscard())) return
  for (const input of inputs) input.disconnect()
  projects.blank()
  for (let i = 0; i < 3; i++) panel.setStatus(i, 'idle')
  controls.refresh()
  touchTitle()
  updateHint()
  status.textContent = 'New project'
}

async function openProject () {
  if (!(await confirmDiscard())) return
  try {
    const result = await projects.open()
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
    const result = await projects.openRecent(choice.fileName)
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

async function saveAs () {
  const name = await dialogs.askName(state.name)
  if (!name) return
  try {
    const result = await projects.saveAs(name)
    controls.refresh()
    touchTitle()
    status.textContent = result.downloaded
      ? `Downloaded ${result.name}.lente`
      : `Saved ${result.name}`
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

const menu = createAppMenu({
  parent: document.querySelector('#app-menu'),
  actions: {
    new: newProject,
    open: openProject,
    recent: openRecent,
    save,
    saveAs,
    fullscreen,
    clean: toggleClean,
    about: () => dialogs.about(),
    isClean: () => clean,
    onError: report
  }
})

deviceManager.onChange((devices) => {
  panel.setDevices(devices)
  const labeled = devices.some((device) => device.labeled)
  if (!labeled) return
  for (let i = 0; i < 3; i++) {
    const id = state.inputs[i].deviceId
    if (!id || inputs[i].status !== 'live') continue
    if (!devices.some((device) => device.deviceId === id)) {
      inputs[i].disconnect()
      panel.setStatus(i, 'missing')
    }
  }
  updateHint()
})

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0]
  fileInput.value = ''
  if (!file) return
  try {
    const result = await projects.openText(await file.text(), file.name)
    await afterOpen(result)
  } catch (error) {
    report(error)
  }
})

window.addEventListener('keydown', (event) => {
  const tag = event.target && event.target.tagName
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  const mod = event.metaKey || event.ctrlKey
  if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (event.shiftKey) saveAs()
    else save()
  } else if (mod && event.key.toLowerCase() === 'o') {
    event.preventDefault()
    openProject()
  } else if (mod && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    newProject()
  } else if (mod && event.key.toLowerCase() === 'i') {
    event.preventDefault()
    toggleClean()
  } else if (!typing && !mod && event.key.toLowerCase() === 'f') {
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
  for (const input of inputs) input.disconnect()
})

document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement))
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
  try {
    const result = await projects.openText(await file.text(), file.name)
    await afterOpen(result)
  } catch (error) {
    report(error)
  }
})

let frames = 0
let stamp = performance.now()
function frame (now) {
  requestAnimationFrame(frame)
  if (document.hidden) return
  const drew = renderer.render({
    videos: inputs.map((input) => input.video),
    state,
    time: now / 1000
  })
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
    fpsReadout.textContent = renderer.isLost() || drew === false
      ? 'WebGL lost'
      : `${rate} fps`
  }
}

touchTitle()
boot.dataset.state = 'ready'
boot.hidden = true
updateHint()
if (!window.isSecureContext) {
  status.textContent = 'Cameras need localhost or https.'
} else {
  status.textContent = 'Ready'
}
deviceManager.refresh().then((devices) => {
  panel.setDevices(devices)
}).catch(report)
requestAnimationFrame(frame)
