/**
 * Drag handles for the side pane width and the mixer height, as in MUSGO's
 * panels. Sizes live in CSS variables and persist per browser.
 */
const STORAGE_KEY = 'lentes:layout'

const PANELS = {
  pane: { cssVar: '--pane-w', axis: 'x', fallback: 320, min: 240, maxRatio: 0.55 },
  mixer: { cssVar: '--mixer-h', axis: 'y', fallback: 296, min: 170, maxRatio: 0.7 }
}

function readLayout () {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeLayout (layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {}
}

function clampSize (spec, value) {
  const extent = spec.axis === 'x' ? window.innerWidth : window.innerHeight
  return Math.round(Math.max(spec.min, Math.min(extent * spec.maxRatio, value)))
}

export function bindPanelResize ({ onResize } = {}) {
  const root = document.documentElement
  const layout = readLayout()
  const handles = []

  function apply (name, value) {
    const spec = PANELS[name]
    const size = clampSize(spec, value)
    layout[name] = size
    root.style.setProperty(spec.cssVar, `${size}px`)
    return size
  }

  for (const [name, spec] of Object.entries(PANELS)) {
    if (Number.isFinite(layout[name])) apply(name, layout[name])

    const handle = document.createElement('div')
    handle.className = `panel-handle panel-handle--${name}`
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-orientation', spec.axis === 'x' ? 'vertical' : 'horizontal')
    handle.setAttribute('aria-label', name === 'pane' ? 'Resize side panel' : 'Resize mixer')
    handle.title = 'Drag to resize · double-click to reset'
    document.body.appendChild(handle)
    handles.push(handle)

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      handle.setPointerCapture(event.pointerId)
      handle.classList.add('is-dragging')
      document.body.classList.add('is-resizing')

      const move = (moveEvent) => {
        const value = spec.axis === 'x'
          ? window.innerWidth - moveEvent.clientX
          : window.innerHeight - moveEvent.clientY
        apply(name, value)
        onResize?.()
      }
      const up = () => {
        handle.classList.remove('is-dragging')
        document.body.classList.remove('is-resizing')
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
        handle.removeEventListener('pointercancel', up)
        writeLayout(layout)
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', up)
      handle.addEventListener('pointercancel', up)
    })

    handle.addEventListener('dblclick', () => {
      delete layout[name]
      root.style.removeProperty(spec.cssVar)
      writeLayout(layout)
      onResize?.()
    })
  }

  window.addEventListener('resize', () => {
    for (const name of Object.keys(PANELS)) {
      if (Number.isFinite(layout[name])) apply(name, layout[name])
    }
  })

  return {
    dispose () {
      for (const handle of handles) handle.remove()
    }
  }
}
