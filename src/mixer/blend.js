/** Compositing modes the mix shader implements. */
export const BLEND_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'additive', label: 'Additive' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'difference', label: 'Difference' }
]

export const MIXER_MODES = [
  { id: 'solo', label: 'Solo' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'blend', label: 'Blend' }
]

const BLEND_INDEX = {
  normal: 0,
  additive: 1,
  multiply: 2,
  difference: 3
}

const MIXER_INDEX = {
  solo: 0,
  crossfade: 1,
  blend: 2
}

export function blendModeIndex (id) {
  return BLEND_INDEX[id] ?? 0
}

export function mixerModeIndex (id) {
  return MIXER_INDEX[id] ?? 0
}

function clamp01 (value) {
  return Math.min(1, Math.max(0, value))
}

function clamp3 (color) {
  return [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])]
}

function pair (a, b, mode) {
  if (mode === 'additive') return clamp3([a[0] + b[0], a[1] + b[1], a[2] + b[2]])
  if (mode === 'multiply') return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]
  if (mode === 'difference') {
    return [Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])]
  }
  return [b[0], b[1], b[2]]
}

function lerp3 (a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]
}

/**
 * CPU reference for the mix shader. `colors` are three [r,g,b] triplets.
 * `ready` is three booleans. Missing inputs contribute nothing.
 */
export function mixColors (spec) {
  const colors = spec.colors
  const ready = spec.ready
  const blend = spec.blend || 'normal'
  if (spec.mode === 'solo') {
    const index = spec.solo | 0
    if (!ready[index]) return [0, 0, 0]
    return [colors[index][0], colors[index][1], colors[index][2]]
  }
  if (spec.mode === 'crossfade') {
    const a = ready[spec.fadeA] ? colors[spec.fadeA] : [0, 0, 0]
    const b = ready[spec.fadeB] ? colors[spec.fadeB] : [0, 0, 0]
    const t = clamp01(spec.fade)
    if (blend === 'normal') return lerp3(a, b, t)
    return lerp3(a, pair(a, b, blend), t)
  }
  const weights = spec.weights || [0, 0, 0]
  if (blend === 'normal') {
    const acc = [0, 0, 0]
    let sum = 0
    for (let i = 0; i < 3; i++) {
      if (!ready[i]) continue
      const weight = Math.max(0, weights[i] || 0)
      sum += weight
      acc[0] += colors[i][0] * weight
      acc[1] += colors[i][1] * weight
      acc[2] += colors[i][2] * weight
    }
    if (sum <= 0) return [0, 0, 0]
    return [acc[0] / sum, acc[1] / sum, acc[2] / sum]
  }
  if (blend === 'additive') {
    const acc = [0, 0, 0]
    for (let i = 0; i < 3; i++) {
      if (!ready[i]) continue
      const weight = Math.max(0, weights[i] || 0)
      acc[0] += colors[i][0] * weight
      acc[1] += colors[i][1] * weight
      acc[2] += colors[i][2] * weight
    }
    return clamp3(acc)
  }
  if (blend === 'multiply') {
    let acc = [1, 1, 1]
    let used = false
    for (let i = 0; i < 3; i++) {
      if (!ready[i]) continue
      const weight = clamp01(weights[i] || 0)
      if (weight <= 0) continue
      used = true
      acc = [
        acc[0] * (1 - weight + colors[i][0] * weight),
        acc[1] * (1 - weight + colors[i][1] * weight),
        acc[2] * (1 - weight + colors[i][2] * weight)
      ]
    }
    return used ? acc : [0, 0, 0]
  }
  let acc = null
  for (let i = 0; i < 3; i++) {
    if (!ready[i]) continue
    const weight = Math.max(0, weights[i] || 0)
    const scaled = [colors[i][0] * weight, colors[i][1] * weight, colors[i][2] * weight]
    acc = acc
      ? [Math.abs(acc[0] - scaled[0]), Math.abs(acc[1] - scaled[1]), Math.abs(acc[2] - scaled[2])]
      : scaled
  }
  return acc || [0, 0, 0]
}
