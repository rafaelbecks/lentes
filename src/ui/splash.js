/**
 * LENTES splash, after MUSGO's: the same wordmark three times, each layer
 * drifting a little, blended with `difference` so the RGB layers split like
 * chromatic aberration. Hues advance like the GLOW logo (base + t·20°).
 */
const HUE_RATE = 20
const DRIFT_EM = 0.028

export function createSplash ({ root, onEnter }) {
  const layers = [...root.querySelectorAll('.splash__layer')]
  const baseHue = Math.random() * 360
  const phases = layers.map(() => Math.random() * Math.PI * 2)
  let raf = 0
  let start = 0
  let entered = false

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
  raf = requestAnimationFrame(frame)

  return { enter }
}
