/**
 * Shadertoy code as a LENTES source. Only the Image tab's code is imported:
 * no buffers, textures, cubemaps, keyboard or audio. The channels are
 * LENTES's own inputs (iChannel0–2 are inputs 1–3 after their operations,
 * iChannel3 is black), iMouse stays at zero.
 */
import { proceduralSource } from './procedural/index.js'
import { FULLSCREEN_VERTEX } from '../shaders/fullscreen.vert.js'
import { createPass } from '../renderer/program.js'

export const CUSTOM_PREFIX = 'custom:'
export const SHADER_LIMIT = 16
export const SHADER_CODE_MAX = 64 * 1024
export const SHADER_NAME_MAX = 60
export const CHANNEL_COUNT = 4

export const SHADERTOY_TEMPLATE = `void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));

    // Mix with input 1
    col = mix(col, texture(iChannel0, uv).rgb, 0.5);

    fragColor = vec4(col,1.0);
}
`

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform float iChannelTime[4];
uniform vec3 iChannelResolution[4];
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
out vec4 lentesFragColor;
#define texture2D texture
`

const EPILOGUE = `
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  lentesFragColor = vec4(color.rgb, 1.0);
}
`

/** Fragment shader source for Shadertoy Image code; errors report the user's line numbers. */
export function shadertoyFragment (code) {
  const body = String(code || '').replace(/^\s*#version[^\n]*\n?/m, '')
  return `${PRELUDE}#line 1\n${body}\n${EPILOGUE}`
}

/** Turn a GLSL info log into `line N: message` entries for the editor. */
export function readCompileLog (log) {
  const lines = []
  for (const raw of String(log || '').split('\n')) {
    const text = raw.replace(/\0/g, '').trim()
    if (!text) continue
    const match = /^(?:ERROR|WARNING):\s*\d+:(\d+):\s*(.*)$/.exec(text)
    lines.push(match ? { line: Number(match[1]), message: match[2] } : { line: 0, message: text })
  }
  return lines
}

/** Compile Shadertoy code; throws with the GLSL info log. */
export function createShadertoyPass (gl, code) {
  return createPass(gl, FULLSCREEN_VERTEX, shadertoyFragment(code))
}

const channelResolution = new Float32Array(CHANNEL_COUNT * 3)
const channelTime = new Float32Array(CHANNEL_COUNT)

/**
 * Upload the Shadertoy uniforms and bind `channels` (textures, one per
 * iChannel) to units 0–3. `clock` = { time, dt, frame }.
 */
export function applyShadertoyUniforms (gl, u, width, height, clock, channels) {
  gl.uniform3f(u.iResolution, width, height, 1)
  gl.uniform1f(u.iTime, clock.time)
  gl.uniform1f(u.iTimeDelta, clock.dt)
  gl.uniform1f(u.iFrameRate, clock.dt > 0 ? 1 / clock.dt : 60)
  gl.uniform1i(u.iFrame, clock.frame)
  gl.uniform4f(u.iMouse, 0, 0, 0, 0)
  const now = new Date()
  gl.uniform4f(u.iDate, now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000)
  gl.uniform1f(u.iSampleRate, 44100)
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    channelResolution.set([width, height, 1], i * 3)
    channelTime[i] = clock.time
    gl.activeTexture(gl.TEXTURE0 + i)
    gl.bindTexture(gl.TEXTURE_2D, channels[i])
    if (u[`iChannel${i}`]) gl.uniform1i(u[`iChannel${i}`], i)
  }
  if (u.iChannelResolution) gl.uniform3fv(u.iChannelResolution, channelResolution)
  if (u.iChannelTime) gl.uniform1fv(u.iChannelTime, channelTime)
  gl.activeTexture(gl.TEXTURE0)
}

export function isCustomShader (value) {
  return typeof value === 'string' && value.startsWith(CUSTOM_PREFIX)
}

export function customShaderId (value) {
  return isCustomShader(value) ? value.slice(CUSTOM_PREFIX.length) : ''
}

export function createShaderId (taken = []) {
  const used = new Set(taken)
  for (;;) {
    const id = Math.random().toString(36).slice(2, 10)
    if (id.length >= 4 && !used.has(id)) return id
  }
}

export function findShader (state, value) {
  const id = customShaderId(value)
  return id ? (state.shaders || []).find((shader) => shader.id === id) || null : null
}

/** Display name for an input's shader value, procedural or imported. */
export function shaderLabel (state, value) {
  if (isCustomShader(value)) return findShader(state, value)?.name || 'Missing shader'
  return proceduralSource(value).displayLabel
}
