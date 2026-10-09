/**
 * CSS-filter color grade used by GLOW's brightness, contrast, and saturation
 * sliders. 100 is identity. Threshold 0 and posterize below 2 are off.
 */
export function applyColor (rgb, params) {
  const brightness = params.brightness / 100
  const contrast = params.contrast / 100
  const saturation = params.saturation / 100
  let color = rgb.map((channel) => channel * brightness)
  color = color.map((channel) => (channel - 0.5) * contrast + 0.5)
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
  color = color.map((channel) => luma + (channel - luma) * saturation)
  if (params.threshold > 0) {
    const y = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
    const value = y >= params.threshold ? 1 : 0
    color = [value, value, value]
  }
  if (params.posterize >= 2) {
    const levels = params.posterize
    color = color.map((channel) => {
      const clamped = Math.min(1, Math.max(0, channel))
      return Math.floor(clamped * levels) / (levels - 1)
    })
  }
  return color.map((channel) => Math.min(1, Math.max(0, channel)))
}

export function hexToRgb (hex) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!match) return [174 / 255, 240 / 255, 184 / 255]
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255]
}

export function colorIsIdentity (params) {
  return params.brightness === 100 &&
    params.contrast === 100 &&
    params.saturation === 100 &&
    !(params.threshold > 0) &&
    !(params.posterize >= 2)
}
