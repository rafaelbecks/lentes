/**
 * Draggable effect chain, ported from GLOW src/components/effect-chain-ui.js.
 * Nodes are the entries of `state.effects` in render order, framed by fixed
 * MIX and OUT anchors. Drag a node to reorder, click it to edit, use the
 * toggle to bypass. Wires are SVG beziers between ports.
 */
import { effectDefinition, setEffectOrder } from '../effects/registry.js'

export function createEffectChain ({ root, state, onChange, onSelect, isModulated = () => false }) {
  root.classList.add('effect-chain-stage')
  root.innerHTML = '<svg class="effect-chain-wires" aria-hidden="true"></svg><div class="effect-chain-nodes"></div>'
  const wiresEl = root.querySelector('.effect-chain-wires')
  const nodesEl = root.querySelector('.effect-chain-nodes')
  let selected = state.effects[0]?.id || null
  let suppressRender = false

  function anchor (label, status) {
    const node = document.createElement('div')
    node.className = 'effect-node is-locked'
    node.innerHTML = `
      <span class="effect-node-port effect-node-port--in"></span>
      <div class="effect-node-body">
        <div class="effect-node-title"></div>
        <div class="effect-node-status"></div>
      </div>
      <span class="effect-node-port effect-node-port--out"></span>`
    node.querySelector('.effect-node-title').textContent = label
    node.querySelector('.effect-node-status').textContent = status
    return node
  }

  function createNode (effect) {
    const definition = effectDefinition(effect.id)
    const node = document.createElement('div')
    node.className = 'effect-node'
    node.dataset.layerId = effect.id
    node.title = definition.description
    node.classList.toggle('is-disabled', !effect.enabled)
    node.classList.toggle('is-selected', effect.id === selected)
    node.classList.toggle('is-modulated', isModulated(effect.id))
    node.innerHTML = `
      <span class="effect-node-port effect-node-port--in"></span>
      <div class="effect-node-body">
        <div class="effect-node-head">
          <div class="effect-node-title"></div>
          <span class="effect-node-mod-icon" title="Modulated by an LFO">∿</span>
        </div>
        <button type="button" class="effect-node-toggle" data-action="toggle"></button>
      </div>
      <span class="effect-node-port effect-node-port--out"></span>`
    node.querySelector('.effect-node-title').textContent = definition.label
    const toggle = node.querySelector('[data-action="toggle"]')
    toggle.textContent = effect.enabled ? 'on' : 'off'
    toggle.classList.toggle('is-on', effect.enabled)
    toggle.title = effect.enabled ? 'Bypass' : 'Enable'
    toggle.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      effect.enabled = !effect.enabled
      render()
      onChange?.('toggle', effect.id)
    })
    bindDrag(node, effect.id)
    return node
  }

  function bindDrag (node, id) {
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      if (event.target.closest('button, input, select, a')) return
      event.preventDefault()
      let moved = false
      suppressRender = true
      node.classList.add('is-dragging')
      node.setPointerCapture(event.pointerId)
      const startX = event.clientX
      const startY = event.clientY

      const onMove = (move) => {
        if (Math.abs(move.clientX - startX) > 3 || Math.abs(move.clientY - startY) > 3) moved = true
        if (!moved) return
        const over = document.elementFromPoint(move.clientX, move.clientY)?.closest?.('.effect-node[data-layer-id]')
        if (!over || over === node) return
        const rect = over.getBoundingClientRect()
        if (move.clientX < rect.left + rect.width / 2) nodesEl.insertBefore(node, over)
        else nodesEl.insertBefore(node, over.nextSibling)
        redrawWires()
      }

      const onEnd = () => {
        node.classList.remove('is-dragging')
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onEnd)
        window.removeEventListener('pointercancel', onEnd)
        suppressRender = false
        if (moved) {
          const order = [...nodesEl.querySelectorAll('.effect-node[data-layer-id]')].map((el) => el.dataset.layerId)
          if (setEffectOrder(state.effects, order)) onChange?.('order', id)
        } else {
          select(id)
        }
        render()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onEnd)
      window.addEventListener('pointercancel', onEnd)
    })
  }

  function render () {
    if (suppressRender) return
    nodesEl.replaceChildren(
      anchor('MIX', 'sources'),
      ...state.effects.map(createNode),
      anchor('OUT', `${state.output.width}×${state.output.height}`)
    )
    requestAnimationFrame(redrawWires)
  }

  function redrawWires () {
    const rect = root.getBoundingClientRect()
    const width = Math.max(rect.width, root.scrollWidth)
    const height = Math.max(rect.height, root.scrollHeight)
    wiresEl.setAttribute('width', String(width))
    wiresEl.setAttribute('height', String(height))
    wiresEl.style.width = `${width}px`
    wiresEl.style.height = `${height}px`
    const nodes = [...nodesEl.querySelectorAll('.effect-node')]
    const paths = []
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i].querySelector('.effect-node-port--out').getBoundingClientRect()
      const b = nodes[i + 1].querySelector('.effect-node-port--in').getBoundingClientRect()
      const x1 = a.left + a.width / 2 - rect.left + root.scrollLeft
      const y1 = a.top + a.height / 2 - rect.top + root.scrollTop
      const x2 = b.left + b.width / 2 - rect.left + root.scrollLeft
      const y2 = b.top + b.height / 2 - rect.top + root.scrollTop
      const cx = (x1 + x2) / 2
      const live = !nodes[i + 1].classList.contains('is-disabled') ? ' is-live' : ''
      paths.push(`<path class="effect-chain-wire${live}" d="M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}" />`)
    }
    wiresEl.innerHTML = paths.join('')
  }

  function select (id) {
    if (!effectDefinition(id)) return
    selected = id
    onSelect?.(id)
    render()
  }

  window.addEventListener('resize', redrawWires)
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redrawWires).observe(root)
  render()

  return {
    render,
    select,
    selected: () => selected
  }
}
