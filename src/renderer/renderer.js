import { FULLSCREEN_VERTEX } from '../shaders/fullscreen.vert.js'
import { SOURCE_FRAG } from '../shaders/source.frag.js'
import { MIX_FRAG } from '../shaders/mix.frag.js'
import { COLOR_FRAG } from '../shaders/color.frag.js'
import { CHROMATIC_FRAG } from '../shaders/chromatic.frag.js'
import { GLASS_FRAG } from '../shaders/glass.frag.js'
import { RAIN_FRAG } from '../shaders/rain.frag.js'
import { DISPLACE_FRAG } from '../shaders/displace.frag.js'
import { MASK_FRAG } from '../shaders/mask.frag.js'
import { DITHER_FRAG } from '../shaders/dither.frag.js'
import { NOISE_FRAG } from '../shaders/noise.frag.js'
import { OVERLAY_FRAG } from '../shaders/overlay.frag.js'
import { BLIT_FRAG } from '../shaders/blit.frag.js'
import { blendModeIndex, mixerModeIndex } from '../mixer/blend.js'
import { colorIsIdentity, hexToRgb } from '../effects/color-math.js'
import { DISPLACE_PATTERN_INDEX, MASK_SHAPE_INDEX, OVERLAY_MODE_INDEX } from '../effects/registry.js'
import { proceduralSource } from '../sources/procedural/index.js'
import { createPass } from './program.js'

const NO_SETTINGS = Object.freeze({})
const DEG = Math.PI / 180
const MASK_OUTSIDE = { black: 0, color: 1, input1: 2, input2: 2, input3: 2 }

function makeTexture (gl) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  return texture
}

function makeTarget (gl, width, height) {
  const texture = makeTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer is incomplete')
  return { framebuffer, texture, width, height }
}

class RgbCache {
  constructor () {
    this.hex = ''
    this.rgb = [0, 0, 0]
  }

  get (hex) {
    if (hex !== this.hex) {
      this.hex = hex
      this.rgb = hexToRgb(hex)
    }
    return this.rgb
  }
}

/**
 * One WebGL2 context, one pass list per frame:
 *   procedural sources → per-slot source pass (fit, flip, color ops)
 *   → mix → effects in `state.effects` order → blit.
 * Effects ping-pong two framebuffers. Targets are reallocated only when the
 * output size changes.
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
  let vao = null
  let passes = null
  let procedural = new Map()
  let cameraTextures = []
  let chain = null
  let processed = null
  let raw = null
  let lastTime = null
  const shaderClocks = [0, 0, 0]
  const maskRgb = new RgbCache()
  const overlayRgb = new RgbCache()

  function rebuild () {
    chain = null
    processed = null
    raw = null
    procedural = new Map()
    cameraTextures = [0, 1, 2].map(() => makeTexture(gl))
    vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const pass = (fragment) => createPass(gl, FULLSCREEN_VERTEX, fragment)
    passes = {
      source: pass(SOURCE_FRAG),
      mix: pass(MIX_FRAG),
      color: pass(COLOR_FRAG),
      chromatic: pass(CHROMATIC_FRAG),
      glass: pass(GLASS_FRAG),
      rain: pass(RAIN_FRAG),
      displace: pass(DISPLACE_FRAG),
      mask: pass(MASK_FRAG),
      dither: pass(DITHER_FRAG),
      noise: pass(NOISE_FRAG),
      overlay: pass(OVERLAY_FRAG),
      blit: pass(BLIT_FRAG)
    }
    lost = false
  }

  function onLost (event) {
    event.preventDefault()
    lost = true
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

  function deleteTargets (list) {
    if (!list) return
    for (const target of list) {
      if (!target) continue
      gl.deleteFramebuffer(target.framebuffer)
      gl.deleteTexture(target.texture)
    }
  }

  function ensureTargets (width, height) {
    if (chain && chain[0].width === width && chain[0].height === height) return
    deleteTargets(chain)
    deleteTargets(processed)
    deleteTargets(raw)
    chain = [makeTarget(gl, width, height), makeTarget(gl, width, height)]
    processed = [0, 1, 2].map(() => makeTarget(gl, width, height))
    raw = [null, null, null]
  }

  function rawTarget (index, width, height) {
    if (!raw[index]) raw[index] = makeTarget(gl, width, height)
    return raw[index]
  }

  function proceduralPass (id) {
    const module = proceduralSource(id)
    let entry = procedural.get(module.modeValue)
    if (!entry) {
      entry = { module, ...createPass(gl, module.vertexSource, module.fragmentSource) }
      procedural.set(module.modeValue, entry)
    }
    return entry
  }

  function drawTo (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null)
    gl.viewport(0, 0, target ? target.width : canvas.width, target ? target.height : canvas.height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function use (pass, texture, name = 'uSource') {
    gl.useProgram(pass.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(pass.u[name], 0)
    return pass.u
  }

  /** Returns { texture, aspect } for slot `index`, or null when it has no picture. */
  function inputTexture (index, input, source, width, height, dt) {
    if (input.kind === 'camera') {
      const video = source && source.live ? source.video : null
      if (!video || video.readyState < 2 || !video.videoWidth) return null
      gl.bindTexture(gl.TEXTURE_2D, cameraTextures[index])
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      return { texture: cameraTextures[index], aspect: video.videoWidth / video.videoHeight }
    }
    if (input.kind === 'shader') {
      shaderClocks[index] += dt * input.speed
      const { module, program, u } = proceduralPass(input.shader)
      const target = rawTarget(index, width, height)
      gl.useProgram(program)
      module.applyUniforms(gl, u, NO_SETTINGS, width, height, shaderClocks[index])
      drawTo(target)
      return { texture: target.texture, aspect: width / height }
    }
    return null
  }

  function processSource (index, input, picture, width, height) {
    const u = use(passes.source, picture.texture)
    gl.uniform1f(u.uSrcAspect, picture.aspect)
    gl.uniform1f(u.uCanvasAspect, width / height)
    gl.uniform2f(u.uFlip, input.flipX ? 1 : 0, input.flipY ? 1 : 0)
    gl.uniform1f(u.uGain, input.gain)
    gl.uniform1f(u.uSaturation, input.saturation)
    gl.uniform1f(u.uHue, input.hue * DEG)
    gl.uniform1f(u.uInvert, input.invert ? 1 : 0)
    drawTo(processed[index])
  }

  function renderMix (mixer, ready) {
    const { program, u } = passes.mix
    gl.useProgram(program)
    for (let i = 0; i < 3; i++) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, processed[i].texture)
    }
    gl.uniform1i(u.uTex0, 0)
    gl.uniform1i(u.uTex1, 1)
    gl.uniform1i(u.uTex2, 2)
    gl.uniform1f(u.uReady0, ready[0])
    gl.uniform1f(u.uReady1, ready[1])
    gl.uniform1f(u.uReady2, ready[2])
    gl.uniform1i(u.uMode, mixerModeIndex(mixer.mode))
    gl.uniform1i(u.uSolo, mixer.solo | 0)
    gl.uniform1i(u.uFadeA, mixer.crossfadeA | 0)
    gl.uniform1i(u.uFadeB, mixer.crossfadeB | 0)
    gl.uniform1f(u.uFade, mixer.crossfade)
    gl.uniform3f(u.uWeights, mixer.weights[0], mixer.weights[1], mixer.weights[2])
    gl.uniform1i(u.uBlend, blendModeIndex(mixer.blend))
    drawTo(chain[0])
  }

  const drawers = {
    color (source, p) {
      const u = use(passes.color, source)
      gl.uniform1f(u.uBrightness, p.brightness)
      gl.uniform1f(u.uContrast, p.contrast)
      gl.uniform1f(u.uSaturation, p.saturation)
      gl.uniform1f(u.uThreshold, p.threshold)
      gl.uniform1f(u.uPosterize, p.posterize)
    },
    chromatic (source, p, frame) {
      const u = use(passes.chromatic, source)
      gl.uniform2f(u.uResolution, frame.width, frame.height)
      gl.uniform1f(u.uRedShift, p.redShift)
      gl.uniform1f(u.uBlueShift, p.blueShift)
      gl.uniform3f(u.uGain, p.redGain, p.greenGain, p.blueGain)
      gl.uniform1f(u.uAmount, p.amount)
    },
    glass (source, p, frame) {
      const u = use(passes.glass, source, 'u_sceneTex')
      gl.uniform2f(u.u_resolution, frame.width, frame.height)
      gl.uniform2f(u.u_center, p.centerX * frame.width, p.centerY * frame.height)
      gl.uniform2f(u.u_size, p.width, p.height)
      gl.uniform1f(u.u_radius, p.radius)
      gl.uniform1f(u.u_bezel, p.bezel)
      gl.uniform1f(u.u_thickness, p.thickness)
      gl.uniform1f(u.u_ior, p.ior)
      gl.uniform1f(u.u_blur, p.blur)
      gl.uniform1f(u.u_specular, p.specular)
      gl.uniform1f(u.u_tint, p.tint)
      gl.uniform1f(u.u_shadow, p.shadow)
      gl.uniform1i(u.u_mode, p.mode === 'bricks' ? 1 : 0)
      gl.uniform2f(u.u_brickSize, p.brickSize, p.brickSize)
      gl.uniform2f(u.u_brickOffset, p.brickOffsetX, p.brickOffsetY)
      gl.uniform1f(u.u_brickGap, p.brickGap)
    },
    rain (source, p, frame) {
      const u = use(passes.rain, source, 'u_sceneTex')
      gl.uniform2f(u.u_resolution, frame.width, frame.height)
      gl.uniform1f(u.u_time, frame.time)
      gl.uniform1f(u.u_distortion, p.distortion)
      gl.uniform1f(u.u_noiseScale, p.scale)
      gl.uniform1f(u.u_timeScale, p.timeScale)
      gl.uniform1f(u.u_patternDrift, p.patternDrift)
      gl.uniform1f(u.u_sharpness, p.sharpness)
    },
    displace (source, p, frame) {
      const u = use(passes.displace, source)
      const angle = p.lightAngle * DEG
      gl.uniform2f(u.uResolution, frame.width, frame.height)
      gl.uniform1f(u.uTime, frame.time * p.speed)
      gl.uniform1i(u.uPattern, DISPLACE_PATTERN_INDEX[p.pattern] ?? 0)
      gl.uniform2f(u.uCenter, p.centerX, 1 - p.centerY)
      gl.uniform1f(u.uScale, p.scale)
      gl.uniform1f(u.uRelief, p.relief)
      gl.uniform1f(u.uBevel, p.bevel)
      gl.uniform1f(u.uStrength, p.strength)
      gl.uniform1f(u.uLight, p.light)
      gl.uniform3f(u.uLightDir, Math.cos(angle), Math.sin(angle), 0)
    },
    mask (source, p, frame) {
      const u = use(passes.mask, source)
      const mode = MASK_OUTSIDE[p.outside] ?? 0
      const slot = mode === 2 ? Number(p.outside.slice(-1)) - 1 : 0
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, processed[slot].texture)
      gl.uniform1i(u.uOutside, 1)
      gl.uniform1i(u.uOutsideMode, mode)
      gl.uniform1f(u.uOutsideReady, frame.available[slot])
      const rgb = maskRgb.get(p.color)
      gl.uniform3f(u.uColor, rgb[0], rgb[1], rgb[2])
      gl.uniform1i(u.uShape, MASK_SHAPE_INDEX[p.shape] ?? 0)
      gl.uniform2f(u.uCenter, p.centerX, p.centerY)
      gl.uniform1f(u.uSize, p.size)
      gl.uniform1f(u.uStretch, p.stretch)
      gl.uniform1f(u.uRotation, p.rotation * DEG)
      gl.uniform1f(u.uSides, p.sides)
      gl.uniform1f(u.uSoftness, p.softness)
      gl.uniform1f(u.uInvert, p.invert ? 1 : 0)
      gl.uniform1f(u.uCanvasAspect, frame.width / frame.height)
    },
    dither (source, p) {
      const u = use(passes.dither, source)
      gl.uniform1f(u.uMapSize, p.mapSize)
      gl.uniform1f(u.uScale, p.scale)
      gl.uniform1f(u.uAmount, p.amount)
      gl.uniform1f(u.uSaturate, p.saturate)
      gl.uniform1f(u.uCrush, p.crush)
      gl.uniform3f(u.uTable, p.tableR, p.tableG, p.tableB)
    },
    noise (source, p, frame) {
      const u = use(passes.noise, source)
      gl.uniform2f(u.uResolution, frame.width, frame.height)
      gl.uniform1f(u.uTime, frame.time)
      gl.uniform1f(u.uAnimate, p.animate ? 1 : 0)
      gl.uniform2f(u.uPattern, p.patternWidth, p.patternHeight)
      gl.uniform2f(u.uGrain, p.grainWidth, p.grainHeight)
      gl.uniform1f(u.uDensity, p.density)
      gl.uniform1f(u.uOpacity, p.opacity)
      gl.uniform1f(u.uChaos, p.chaos)
      gl.uniform1f(u.uSpeed, p.speed)
      gl.uniform1f(u.uSeed, p.seed)
    },
    overlay (source, p) {
      const u = use(passes.overlay, source)
      const rgb = overlayRgb.get(p.color)
      gl.uniform3f(u.uColor, rgb[0], rgb[1], rgb[2])
      gl.uniform1f(u.uOpacity, p.opacity)
      gl.uniform1i(u.uMode, OVERLAY_MODE_INDEX[p.mode] ?? 2)
    }
  }

  const frame = { width: 0, height: 0, time: 0, available: [0, 0, 0] }
  const ready = [0, 0, 0]

  /**
   * sources[i] = { video, live } for camera slots; state.inputs[i].kind picks
   * camera, shader, or none. Returns false when nothing was drawn.
   */
  function render ({ sources, state, time }) {
    if (lost || gl.isContextLost()) return false
    gl.bindVertexArray(vao)
    const width = state.output.width | 0
    const height = state.output.height | 0
    if (width < 2 || height < 2) return false
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    ensureTargets(width, height)
    const dt = lastTime === null ? 0 : Math.min(0.25, Math.max(0, time - lastTime))
    lastTime = time
    frame.width = width
    frame.height = height
    frame.time = time
    for (let i = 0; i < 3; i++) {
      const input = state.inputs[i]
      const picture = inputTexture(i, input, sources[i], width, height, dt)
      frame.available[i] = picture ? 1 : 0
      ready[i] = picture && !state.mixer.mutes[i] ? 1 : 0
      if (picture) processSource(i, input, picture, width, height)
    }
    renderMix(state.mixer, ready)
    let source = chain[0].texture
    let index = 1
    for (const effect of state.effects) {
      if (!effect.enabled) continue
      if (effect.id === 'color' && colorIsIdentity(effect.params)) continue
      const draw = drawers[effect.id]
      if (!draw) continue
      draw(source, effect.params, frame)
      drawTo(chain[index])
      source = chain[index].texture
      index = 1 - index
    }
    use(passes.blit, source)
    drawTo(null)
    return true
  }

  function dispose () {
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
    deleteTargets(chain)
    deleteTargets(processed)
    deleteTargets(raw)
    for (const texture of cameraTextures) gl.deleteTexture(texture)
    for (const pass of Object.values(passes)) gl.deleteProgram(pass.program)
    for (const entry of procedural.values()) gl.deleteProgram(entry.program)
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
