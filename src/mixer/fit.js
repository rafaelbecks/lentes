/**
 * Map a canvas UV into a source UV using "contain".
 * Returns null when the pixel falls in the letterbox.
 * The mix shader repeats this arithmetic.
 */
export function containMap (uv, srcAspect, dstAspect) {
  const src = Number(srcAspect)
  const dst = Number(dstAspect)
  if (!(src > 0) || !(dst > 0)) return null
  let spanX = 1
  let spanY = 1
  if (src > dst) spanY = dst / src
  else spanX = src / dst
  const x0 = 0.5 - spanX * 0.5
  const y0 = 0.5 - spanY * 0.5
  const x = uv[0]
  const y = uv[1]
  if (x < x0 || x > x0 + spanX || y < y0 || y > y0 + spanY) return null
  return [(x - x0) / spanX, (y - y0) / spanY]
}

/**
 * Contain a source inside a pixel box, as fractions of the canvas.
 * A box the size of the canvas is the full-frame contain used for cameras.
 */
export function placementBox (srcAspect, boxW, boxH, canvasW, canvasH) {
  const src = Number(srcAspect)
  const bw = Number(boxW)
  const bh = Number(boxH)
  const cw = Number(canvasW)
  const ch = Number(canvasH)
  if (!(src > 0) || !(bw > 0) || !(bh > 0) || !(cw > 0) || !(ch > 0)) return null
  const boxAspect = bw / bh
  const drawW = src > boxAspect ? bw : bh * src
  const drawH = src > boxAspect ? bw / src : bh
  return { spanX: drawW / cw, spanY: drawH / ch }
}
