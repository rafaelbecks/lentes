/**
 * Procedural sources from GLOW src/shaders/background/procedural/ (GPL-3.0).
 * Modules are copied unchanged apart from import paths; each renders a full
 * frame from `u_resolution` and `u_time`. LENTE passes an empty settings
 * object, so every shader runs with GLOW's defaults; speed scales time.
 * Disco Sun is CC BY-NC-SA 4.0 (Shadertoy community), noted in NOTICE.md.
 */
import { portalBackgroundShader } from './portal.js'
import { discoSunBackgroundShader } from './disco-sun.js'
import { balatroBackgroundShader } from './balatro.js'
import { chromaGradientsBackgroundShader } from './chroma-gradients.js'

export const PROCEDURAL_SOURCES = [
  portalBackgroundShader,
  discoSunBackgroundShader,
  balatroBackgroundShader,
  chromaGradientsBackgroundShader
]

export const PROCEDURAL_IDS = PROCEDURAL_SOURCES.map((entry) => entry.modeValue)

export function proceduralSource (id) {
  return PROCEDURAL_SOURCES.find((entry) => entry.modeValue === id) || PROCEDURAL_SOURCES[0]
}
