import { createDefaultProject } from './projects/schema.js'
import { applyProject } from './projects/apply.js'
import { createRenderer } from './renderer/renderer.js'
import { createVideoInput } from './inputs/video-input.js'
import { createFileInput } from './inputs/file-input.js'
import { applyModulation } from './modulation/modulation.js'
import { createProgramReceiver } from './program-link.js'

/**
 * Program output surface: only the canvas, no interface. The operator
 * window owns the controls and posts its project here; this page opens its
 * own camera streams and renders at the exact output size.
 */
const state = createDefaultProject()
const canvas = document.querySelector('#output')
const renderer = createRenderer(canvas)
const inputs = [0, 1, 2].map(() => createVideoInput())
const files = [0, 1, 2].map(() => createFileInput())
const sources = inputs.map((input, i) => ({ video: input.video, live: false, file: files[i] }))
const signatures = ['', '', '']
let clockOrigin = performance.timeOrigin
let reportedSize = ''

function cameraSignature (input) {
  if (input.kind !== 'camera' || !input.deviceId) return ''
  return [input.deviceId, input.width, input.height, input.frameRate].join('|')
}

function syncCameras () {
  for (let i = 0; i < 3; i++) {
    const spec = state.inputs[i]
    const next = cameraSignature(spec)
    if (next === signatures[i]) continue
    signatures[i] = next
    if (!next) {
      inputs[i].disconnect()
      continue
    }
    inputs[i].connect({
      deviceId: spec.deviceId,
      width: spec.width,
      height: spec.height,
      frameRate: spec.frameRate
    }).catch((error) => {
      signatures[i] = ''
      console.error(error)
    })
  }
}

function reportSize () {
  const key = `${state.output.width}x${state.output.height}`
  if (key === reportedSize) return
  reportedSize = key
  window.luminodeOutput?.resize(state.output.width, state.output.height)
}

createProgramReceiver(({ project, clockOrigin: origin }) => {
  applyProject(state, project)
  if (Number.isFinite(origin)) clockOrigin = origin
  syncCameras()
  reportSize()
}, ({ index, file }) => {
  const slot = files[index]
  if (!slot) return
  if (!file) {
    slot.clear()
    return
  }
  slot.load(file, { loop: state.inputs[index]?.loop !== false }).catch((error) => console.error(error))
})

function frame (now) {
  requestAnimationFrame(frame)
  for (let i = 0; i < 3; i++) {
    sources[i].live = inputs[i].isLive()
    files[i].setLoop(state.inputs[i].loop)
  }
  const time = (performance.timeOrigin + now - clockOrigin) / 1000
  const restore = applyModulation(state, time)
  try {
    renderer.render({ sources, state, time })
  } finally {
    restore()
  }
}

window.addEventListener('pagehide', () => {
  for (const input of inputs) input.disconnect()
  for (const file of files) file.clear()
})

requestAnimationFrame(frame)
