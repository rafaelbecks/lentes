/**
 * LENTES splash, after MUSGO's: the same wordmark three times, each layer
 * drifting a little, blended with `difference` so the RGB layers split like
 * chromatic aberration. Hues advance like the GLOW logo (base + t·20°).
 * Behind it plays the GLOW scene of luminode.studio's shelf. That page is a
 * whole WebGL app, so it lives only while the splash is up.
 */
const HUE_RATE = 20
const DRIFT_EM = 0.028
/** MUSGO wordmark width: fraction of the shorter viewport edge. */
const WORDMARK_SCALE = 0.55
const STUDIO = 'https://luminode.studio'
const GLOW_SCENE = '/glow/index.html?embed=1'

/** The host opens LENTES with ?studio=<its local site>; a browser uses the public one. */
function studioOrigin () {
  const param = new URLSearchParams(window.location.search).get('studio')
  try {
    if (param) return new URL(param).origin
  } catch {}
  return STUDIO
}

function mountGlow (root) {
  const frame = document.createElement('iframe')
  frame.className = 'splash__glow'
  frame.title = ''
  frame.tabIndex = -1
  frame.setAttribute('aria-hidden', 'true')
  frame.addEventListener('load', () => frame.classList.add('is-loaded'), { once: true })
  frame.src = studioOrigin() + GLOW_SCENE
  const veil = document.createElement('div')
  veil.className = 'splash__veil'
  veil.setAttribute('aria-hidden', 'true')
  root.prepend(frame, veil)
  return () => {
    frame.src = 'about:blank'
    frame.remove()
    veil.remove()
  }
}

export function createSplash ({ root, onEnter }) {
  const layers = [...root.querySelectorAll('.splash__layer')]
  const title = root.querySelector('.splash__title')
  const baseHue = Math.random() * 360
  const phases = layers.map(() => Math.random() * Math.PI * 2)
  let raf = 0
  let start = 0
  let entered = false
  const unmountGlow = mountGlow(root)

  function fitTitle () {
    if (!title) return
    const target = Math.min(window.innerWidth, window.innerHeight) * WORDMARK_SCALE
    title.style.fontSize = '100px'
    const width = title.getBoundingClientRect().width
    if (width > 0) title.style.fontSize = `${((100 * target) / width).toFixed(2)}px`
  }

  function frame (now) {
    raf = requestAnimationFrame(frame)
    if (!start) start = now
    const t = (now - start) / 1000
    layers.forEach((layer, i) => {
      const hue = (baseHue + i * 120 + t * HUE_RATE) % 360
      const phase = phases[i]
      const dx = Math.sin(t * 0.7 + phase) * DRIFT_EM
      const dy = Math.cos(t * 0.53 + phase * 1.3) * DRIFT_EM * 0.35
      layer.style.color = `hsl(${hue.toFixed(1)}, 100%, 55%)`
      layer.style.transform = `translate(${dx.toFixed(4)}em, ${dy.toFixed(4)}em)`
    })
  }

  function enter () {
    if (entered) return
    entered = true
    window.removeEventListener('keydown', onKey)
    root.classList.add('is-exiting')
    window.setTimeout(() => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fitTitle)
      unmountGlow()
      root.remove()
      document.body.classList.remove('is-splash')
    }, 380)
    onEnter?.()
  }

  function onKey (event) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
    if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    enter()
  }

  document.body.classList.add('is-splash')
  root.addEventListener('click', enter)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', fitTitle)
  fitTitle()
  document.fonts?.ready.then(fitTitle)
  raf = requestAnimationFrame(frame)

  return { enter }
}
