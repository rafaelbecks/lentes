import { FULLSCREEN_VERTEX } from '../shaders/fullscreen.vert.js'
import { MIX_FRAG } from '../shaders/mix.frag.js'
import { COLOR_FRAG } from '../shaders/color.frag.js'
import { DITHER_FRAG } from '../shaders/dither.frag.js'
import { NOISE_FRAG } from '../shaders/noise.frag.js'
import { OVERLAY_FRAG } from '../shaders/overlay.frag.js'
import { BLIT_FRAG } from '../shaders/blit.frag.js'
import { blendModeIndex, mixerModeIndex } from '../mixer/blend.js'
import { colorIsIdentity, hexToRgb } from '../effects/color-math.js'
import { OVERLAY_MODE_INDEX } from '../effects/registry.js'
import { createProgram, uniformLocations } from './program.js'

const MIX_UNIFORMS = [
  'uTex0', 'uTex1', 'uTex2',
  'uReady0', 'uReady1', 'uReady2',
  'uAspect0', 'uAspect1', 'uAspect2',
  'uCanvasAspect', 'uMode', 'uSolo', 'uFadeA', 'uFadeB', 'uFade',
  'uWeights', 'uBlend'
]

function makeTexture (gl, filter) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255])
  )
  return texture
}

function makeTarget (gl, width, height) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Framebuffer is incomplete')
  }
  return { framebuffer, texture, width, height }
}

/**
 * One WebGL2 context. Camera textures feed a mix pass, then the effect
 * stack in serialized order, then a blit to the canvas.
 * Passes ping-pong two framebuffers. No per-frame allocations.
 */
export function createRenderer (canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  })
  if (!gl) throw new Error('WebGL 2 is required')

  let lost = false
  let targets = null
  let cameraTextures = []
  let vao = null
  let programs = null
  let locs = null
  let overlayHex = ''
  let overlayRgb = [174 / 255, 240 / 255, 184 / 255]

  function rebuild () {
    targets = null
    cameraTextures = [0, 1, 2].map(() => makeTexture(gl, gl.LINEAR))
    vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    programs = {
      mix: createProgram(gl, FULLSCREEN_VERTEX, MIX_FRAG),
      color: createProgram(gl, FULLSCREEN_VERTEX, COLOR_FRAG),
      dither: createProgram(gl, FULLSCREEN_VERTEX, DITHER_FRAG),
      noise: createProgram(gl, FULLSCREEN_VERTEX, NOISE_FRAG),
      overlay: createProgram(gl, FULLSCREEN_VERTEX, OVERLAY_FRAG),
      blit: createProgram(gl, FULLSCREEN_VERTEX, BLIT_FRAG)
    }
    locs = {
      mix: uniformLocations(gl, programs.mix, MIX_UNIFORMS),
      color: uniformLocations(gl, programs.color, [
        'uSource', 'uBrightness', 'uContrast', 'uSaturation', 'uThreshold', 'uPosterize'
      ]),
      dither: uniformLocations(gl, programs.dither, [
        'uSource', 'uMapSize', 'uScale', 'uAmount', 'uSaturate', 'uCrush', 'uTable'
      ]),
      noise: uniformLocations(gl, programs.noise, ['uSource', 'uAmount', 'uScale', 'uTime']),
      overlay: uniformLocations(gl, programs.overlay, ['uSource', 'uColor', 'uOpacity', 'uMode']),
      blit: uniformLocations(gl, programs.blit, ['uSource'])
    }
    lost = false
  }

  function onLost (event) {
    event.preventDefault()
    lost = true
    targets = null
  }

  function onRestored () {
    try {
      rebuild()
    } catch (error) {
      lost = true
      console.error(error)
    }
  }

  rebuild()

  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  function disposeTargets () {
    if (!targets) return
    for (const target of targets) {
      gl.deleteFramebuffer(target.framebuffer)
      gl.deleteTexture(target.texture)
    }
    targets = null
  }

  function ensureTargets (width, height) {
    if (targets && targets[0].width === width && targets[0].height === height) return
    disposeTargets()
    targets = [makeTarget(gl, width, height), makeTarget(gl, width, height)]
  }

  function drawTo (framebuffer, width, height) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.viewport(0, 0, width, height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function bindSource (program, location, texture) {
    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(location, 0)
  }

  function uploadCameras (videos) {
    const ready = [0, 0, 0]
    const aspects = [1, 1, 1]
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    for (let i = 0; i < 3; i++) {
      const video = videos[i]
      if (!video || video.readyState < 2 || !video.videoWidth) continue
      gl.bindTexture(gl.TEXTURE_2D, cameraTextures[i])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      ready[i] = 1
      aspects[i] = video.videoWidth / video.videoHeight
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    return { ready, aspects }
  }

  function renderMix (mixer, ready, aspects, width, height) {
    const loc = locs.mix
    gl.useProgram(programs.mix)
    for (let i = 0; i < 3; i++) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, cameraTextures[i])
    }
    gl.uniform1i(loc.uTex0, 0)
    gl.uniform1i(loc.uTex1, 1)
    gl.uniform1i(loc.uTex2, 2)
    gl.uniform1f(loc.uReady0, ready[0])
    gl.uniform1f(loc.uReady1, ready[1])
    gl.uniform1f(loc.uReady2, ready[2])
    gl.uniform1f(loc.uAspect0, aspects[0])
    gl.uniform1f(loc.uAspect1, aspects[1])
    gl.uniform1f(loc.uAspect2, aspects[2])
    gl.uniform1f(loc.uCanvasAspect, width / height)
    gl.uniform1i(loc.uMode, mixerModeIndex(mixer.mode))
    gl.uniform1i(loc.uSolo, mixer.solo | 0)
    gl.uniform1i(loc.uFadeA, mixer.crossfadeA | 0)
    gl.uniform1i(loc.uFadeB, mixer.crossfadeB | 0)
    gl.uniform1f(loc.uFade, mixer.crossfade)
    gl.uniform3f(loc.uWeights, mixer.weights[0], mixer.weights[1], mixer.weights[2])
    gl.uniform1i(loc.uBlend, blendModeIndex(mixer.blend))
    drawTo(targets[0].framebuffer, width, height)
  }

  function drawColor (source, dest, params) {
    bindSource(programs.color, locs.color.uSource, source)
    gl.uniform1f(locs.color.uBrightness, params.brightness)
    gl.uniform1f(locs.color.uContrast, params.contrast)
    gl.uniform1f(locs.color.uSaturation, params.saturation)
    gl.uniform1f(locs.color.uThreshold, params.threshold)
    gl.uniform1f(locs.color.uPosterize, params.posterize)
    drawTo(dest.framebuffer, dest.width, dest.height)
  }

  function drawDither (source, dest, params) {
    bindSource(programs.dither, locs.dither.uSource, source)
    gl.uniform1f(locs.dither.uMapSize, params.mapSize)
    gl.uniform1f(locs.dither.uScale, params.scale)
    gl.uniform1f(locs.dither.uAmount, params.amount)
    gl.uniform1f(locs.dither.uSaturate, params.saturate)
    gl.uniform1f(locs.dither.uCrush, params.crush)
    gl.uniform3f(locs.dither.uTable, params.tableR, params.tableG, params.tableB)
    drawTo(dest.framebuffer, dest.width, dest.height)
  }

  function drawNoise (source, dest, params, time) {
    const elapsed = params.animate ? time * params.speed + params.seed : params.seed
    bindSource(programs.noise, locs.noise.uSource, source)
    gl.uniform1f(locs.noise.uAmount, params.amount)
    gl.uniform1f(locs.noise.uScale, params.scale)
    gl.uniform1f(locs.noise.uTime, elapsed)
    drawTo(dest.framebuffer, dest.width, dest.height)
  }

  function drawOverlay (source, dest, params) {
    if (params.color !== overlayHex) {
      overlayHex = params.color
      overlayRgb = hexToRgb(params.color)
    }
    bindSource(programs.overlay, locs.overlay.uSource, source)
    gl.uniform3f(locs.overlay.uColor, overlayRgb[0], overlayRgb[1], overlayRgb[2])
    gl.uniform1f(locs.overlay.uOpacity, params.opacity)
    gl.uniform1i(locs.overlay.uMode, OVERLAY_MODE_INDEX[params.mode] ?? 2)
    drawTo(dest.framebuffer, dest.width, dest.height)
  }

  const drawers = {
    color: drawColor,
    dither: drawDither,
    noise: drawNoise,
    overlay: drawOverlay
  }

  function render ({ videos, state, time }) {
    if (lost || gl.isContextLost()) return false
    gl.bindVertexArray(vao)
    const width = state.output.width | 0
    const height = state.output.height | 0
    if (width < 2 || height < 2) return false
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    ensureTargets(width, height)
    const uploaded = uploadCameras(videos)
    renderMix(state.mixer, uploaded.ready, uploaded.aspects, width, height)
    let source = targets[0].texture
    let index = 1
    for (const effect of state.effects) {
      if (!effect.enabled) continue
      if (effect.id === 'color' && colorIsIdentity(effect.params)) continue
      const draw = drawers[effect.id]
      if (!draw) continue
      const dest = targets[index]
      draw(source, dest, effect.params, time)
      source = dest.texture
      index = 1 - index
    }
    bindSource(programs.blit, locs.blit.uSource, source)
    drawTo(null, width, height)
    return true
  }

  function dispose () {
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
    disposeTargets()
    for (const texture of cameraTextures) gl.deleteTexture(texture)
    for (const program of Object.values(programs)) gl.deleteProgram(program)
    gl.deleteVertexArray(vao)
  }

  return {
    gl,
    render,
    dispose,
    isLost () {
      return lost || gl.isContextLost()
    }
  }
}
