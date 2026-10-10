/**
 * Drag the glass pane (GLOW lets you move it with the pointer), the shape
 * mask, the center of the displacement ripples, or a file source directly
 * on the output. Coordinates are normalized, top-left origin, inside the
 * letterboxed canvas picture.
 */
import { placementBox } from '../mixer/fit.js'

function pictureRect (canvas) {
  const box = canvas.getBoundingClientRect()
  const aspect = canvas.width / canvas.height
  let width = box.width
  let height = box.width / aspect
  if (height > box.height) {
    height = box.height
    width = height * aspect
  }
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height
  }
}

function toUv (canvas, event) {
  const rect = pictureRect(canvas)
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height
  }
}

function clamp01 (value) {
  return Math.min(1, Math.max(0, value))
}

export function bindStageDrag ({ canvas, state, getSourceAspect, onChange }) {
  function effect (id) {
    return state.effects.find((entry) => entry.id === id)
  }

  function hitGlass (uv) {
    const glass = effect('glass')
    if (!glass?.enabled || glass.params.mode !== 'single') return null
    const p = glass.params
    const dx = Math.abs(uv.x - p.centerX) * canvas.width
    const dy = Math.abs(uv.y - p.centerY) * canvas.height
    return dx <= p.width / 2 && dy <= p.height / 2 ? glass : null
  }

  function target (uv) {
    const glass = hitGlass(uv)
    if (glass) return glass
    const mask = effect('mask')
    if (mask?.enabled) return mask
    const displace = effect('displace')
    if (displace?.enabled && displace.params.pattern === 'ripple') return displace
    return hitFile(uv)
  }

  function hitFile (uv) {
    if (!getSourceAspect || !canvas.width || !canvas.height) return null
    for (let i = 2; i >= 0; i--) {
      const input = state.inputs[i]
      if (input.kind !== 'file') continue
      const box = placementBox(getSourceAspect(i), input.width, input.height, canvas.width, canvas.height)
      if (!box) continue
      const x0 = input.posX - box.spanX / 2
      const y0 = input.posY - box.spanY / 2
      if (uv.x >= x0 && uv.x <= x0 + box.spanX && uv.y >= y0 && uv.y <= y0 + box.spanY) {
        return { id: 'file', input }
      }
    }
    return null
  }

  function pointOf (picked) {
    if (picked.id === 'file') return { x: picked.input.posX, y: picked.input.posY }
    return { x: picked.params.centerX, y: picked.params.centerY }
  }

  function moveTo (picked, x, y) {
    const nx = Number(clamp01(x).toFixed(4))
    const ny = Number(clamp01(y).toFixed(4))
    if (picked.id === 'file') {
      picked.input.posX = nx
      picked.input.posY = ny
      return
    }
    picked.params.centerX = nx
    picked.params.centerY = ny
  }

  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons) return
    canvas.classList.toggle('is-draggable', Boolean(target(toUv(canvas, event))))
  })

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const start = toUv(canvas, event)
    const picked = target(start)
    if (!picked) return
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    const origin = pointOf(picked)
    const offset = { x: origin.x - start.x, y: origin.y - start.y }
    let moved = false

    const onMove = (move) => {
      const uv = toUv(canvas, move)
      moveTo(picked, uv.x + offset.x, uv.y + offset.y)
      moved = true
    }
    const onEnd = () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onEnd)
      canvas.removeEventListener('pointercancel', onEnd)
      if (moved) onChange(picked.id)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onEnd)
    canvas.addEventListener('pointercancel', onEnd)
  })
}
