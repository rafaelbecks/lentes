/**
 * Drag the glass pane (GLOW lets you move it with the pointer), the shape
 * mask, or the center of the displacement ripples directly on the output. Coordinates are normalized, top-left origin,
 * inside the letterboxed canvas picture.
 */

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

export function bindStageDrag ({ canvas, state, onChange }) {
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
    return displace?.enabled && displace.params.pattern === 'ripple' ? displace : null
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
    const offset = { x: picked.params.centerX - start.x, y: picked.params.centerY - start.y }
    let moved = false

    const onMove = (move) => {
      const uv = toUv(canvas, move)
      picked.params.centerX = Number(clamp01(uv.x + offset.x).toFixed(4))
      picked.params.centerY = Number(clamp01(uv.y + offset.y).toFixed(4))
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
