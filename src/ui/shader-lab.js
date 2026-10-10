/**
 * Shader Lab: paste the Image tab of a Shadertoy, preview it, keep it in the
 * project (`state.shaders`) and send it to an input. Like GLOW's Luminode Lab
 * (editor beside a live preview), but code only: channels are LENTES inputs
 * and nothing else (textures, buffers, audio) is imported.
 * The preview has its own small WebGL2 context; its channels show a test card.
 */
import {
  CUSTOM_PREFIX,
  SHADERTOY_TEMPLATE,
  SHADER_CODE_MAX,
  SHADER_LIMIT,
  SHADER_NAME_MAX,
  applyShadertoyUniforms,
  createShaderId,
  createShadertoyPass,
  readCompileLog
} from '../sources/shadertoy.js'

const COMPILE_DELAY = 300

function el (tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button (className, text, title) {
  const node = el('button', className, text)
  node.type = 'button'
  if (title) node.title = title
  return node
}

function testCard (gl) {
  const size = 256
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const check = ((x >> 5) + (y >> 5)) % 2
      pixels[i] = Math.round((x / size) * 255 * (0.55 + 0.45 * check))
      pixels[i + 1] = Math.round((y / size) * 255 * (0.55 + 0.45 * check))
      pixels[i + 2] = check ? 190 : 70
      pixels[i + 3] = 255
    }
  }
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return texture
}

function blackTexture (gl) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  return texture
}

/** Small preview renderer, alive only while the lab is open. */
function createPreview (canvas) {
  let gl = null
  let vao = null
  let channels = []
  let pass = null
  let raf = 0
  let started = 0
  let last = 0
  let frame = 0
  const clock = { time: 0, dt: 0, frame: 0 }

  function start () {
    if (gl) return
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false })
    if (!gl) return
    vao = gl.createVertexArray()
    const card = testCard(gl)
    channels = [card, card, card, blackTexture(gl)]
    started = performance.now()
    last = started
    raf = requestAnimationFrame(draw)
  }

  function draw (now) {
    raf = requestAnimationFrame(draw)
    if (!pass || gl.isContextLost()) return
    clock.time = (now - started) / 1000
    clock.dt = Math.min(0.25, (now - last) / 1000)
    clock.frame = frame++
    last = now
    gl.bindVertexArray(vao)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(pass.program)
    applyShadertoyUniforms(gl, pass.u, canvas.width, canvas.height, clock, channels)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** Compile `code`; returns [] or the log entries. Keeps the last good program on failure. */
  function compile (code) {
    start()
    if (!gl) return [{ line: 0, message: 'WebGL 2 is not available for the preview' }]
    try {
      const next = createShadertoyPass(gl, code)
      if (pass) gl.deleteProgram(pass.program)
      pass = next
      started = performance.now()
      frame = 0
      return []
    } catch (error) {
      return readCompileLog(error.message)
    }
  }

  function stop () {
    cancelAnimationFrame(raf)
    raf = 0
    if (!gl) return
    if (pass) gl.deleteProgram(pass.program)
    for (const texture of new Set(channels)) gl.deleteTexture(texture)
    gl.deleteVertexArray(vao)
    // getContext() returns this canvas's existing context when the lab opens
    // again. Explicitly losing it here makes every later compile use a dead
    // context, so release our resources and leave the context reusable.
    gl = null
    pass = null
    channels = []
  }

  return { compile, stop }
}

export function createShaderLab ({ state, onChange, onUse, onDelete }) {
  const modal = el('div', 'modal shader-lab')
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-labelledby', 'shader-lab-title')
  modal.hidden = true
  modal.innerHTML = `
    <div class="modal__panel shader-lab__panel">
      <header class="modal__header">
        <h2 id="shader-lab-title">Shader Lab</h2>
        <button type="button" class="modal__close" aria-label="Close">×</button>
      </header>
      <p class="shader-lab__intro">Paste the Image tab of a Shadertoy. Only code is imported: iChannel0–2 are inputs 1–3, iChannel3 is black, iMouse stays at zero. Shaders are saved in the .lentes file.</p>
      <div class="shader-lab__body">
        <aside class="shader-lab__list">
          <div class="shader-lab__items" role="listbox" aria-label="Project shaders"></div>
          <button type="button" class="shader-lab__new">+ New shader</button>
        </aside>
        <section class="shader-lab__editor">
          <label class="shader-lab__name">Name<input type="text" maxlength="${SHADER_NAME_MAX}" spellcheck="false" /></label>
          <div class="shader-lab__code">
            <pre class="shader-lab__gutter" aria-hidden="true"></pre>
            <textarea spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="${SHADER_CODE_MAX}" aria-label="Shadertoy code"></textarea>
          </div>
          <pre class="shader-lab__log" aria-live="polite"></pre>
        </section>
        <section class="shader-lab__side">
          <canvas class="shader-lab__preview" width="384" height="216"></canvas>
          <p class="shader-lab__note">Preview channels show a test card.</p>
          <button type="button" class="shader-lab__apply" title="⌘↵">Apply to project</button>
          <div class="shader-lab__use">
            <span>Use on input</span>
            <button type="button" data-slot="0">1</button>
            <button type="button" data-slot="1">2</button>
            <button type="button" data-slot="2">3</button>
          </div>
          <button type="button" class="shader-lab__delete">Delete shader</button>
          <p class="shader-lab__status"></p>
        </section>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  const items = modal.querySelector('.shader-lab__items')
  const newButton = modal.querySelector('.shader-lab__new')
  const nameInput = modal.querySelector('.shader-lab__name input')
  const code = modal.querySelector('textarea')
  const gutter = modal.querySelector('.shader-lab__gutter')
  const log = modal.querySelector('.shader-lab__log')
  const applyButton = modal.querySelector('.shader-lab__apply')
  const useButtons = [...modal.querySelectorAll('.shader-lab__use button')]
  const deleteButton = modal.querySelector('.shader-lab__delete')
  const statusLine = modal.querySelector('.shader-lab__status')
  const close = modal.querySelector('.modal__close')
  const preview = createPreview(modal.querySelector('canvas'))

  let currentId = null
  let saved = { name: '', code: '' }
  let errors = []
  let timer = 0
  let armedDelete = false

  const current = () => state.shaders.find((shader) => shader.id === currentId) || null
  const dirty = () => nameInput.value !== saved.name || code.value !== saved.code

  function nextName () {
    const names = new Set(state.shaders.map((shader) => shader.name))
    let n = state.shaders.length + 1
    while (names.has(`Shadertoy ${n}`)) n++
    return `Shadertoy ${n}`
  }

  function renderGutter () {
    const count = code.value.split('\n').length
    const marked = new Set(errors.map((entry) => entry.line))
    const lines = []
    for (let i = 1; i <= count; i++) lines.push(marked.has(i) ? `● ${i}` : String(i))
    gutter.textContent = lines.join('\n')
    gutter.scrollTop = code.scrollTop
  }

  function renderLog () {
    log.classList.toggle('is-error', errors.length > 0)
    log.textContent = errors.length
      ? errors.map((entry) => (entry.line ? `line ${entry.line}: ${entry.message}` : entry.message)).join('\n')
      : 'Compiles.'
  }

  function renderList () {
    items.replaceChildren(...state.shaders.map((shader) => {
      const item = button('shader-lab__item', shader.name)
      item.setAttribute('role', 'option')
      const selected = shader.id === currentId
      item.classList.toggle('is-current', selected)
      item.setAttribute('aria-selected', selected ? 'true' : 'false')
      const users = state.inputs
        .map((input, i) => (input.kind === 'shader' && input.shader === CUSTOM_PREFIX + shader.id ? i + 1 : 0))
        .filter(Boolean)
      if (users.length) item.append(el('span', 'shader-lab__badge', `IN ${users.join(' ')}`))
      item.addEventListener('click', () => select(shader.id))
      return item
    }))
    if (!currentId) {
      const draft = button('shader-lab__item is-current', `${nameInput.value || 'New shader'} (unsaved)`)
      items.append(draft)
    }
    newButton.disabled = state.shaders.length >= SHADER_LIMIT
    newButton.title = newButton.disabled ? `A project keeps up to ${SHADER_LIMIT} shaders` : ''
  }

  function renderActions () {
    const full = !currentId && state.shaders.length >= SHADER_LIMIT
    applyButton.disabled = full || (Boolean(currentId) && !dirty())
    applyButton.textContent = currentId ? 'Apply to project' : 'Add to project'
    for (const node of useButtons) node.disabled = full
    deleteButton.disabled = !currentId
    deleteButton.textContent = armedDelete ? 'Click again to delete' : 'Delete shader'
    deleteButton.classList.toggle('is-armed', armedDelete)
  }

  function compileNow () {
    window.clearTimeout(timer)
    errors = preview.compile(code.value)
    renderLog()
    renderGutter()
  }

  function scheduleCompile () {
    window.clearTimeout(timer)
    timer = window.setTimeout(compileNow, COMPILE_DELAY)
  }

  function load (shader) {
    currentId = shader ? shader.id : null
    saved = shader ? { name: shader.name, code: shader.code } : { name: '', code: '' }
    nameInput.value = shader ? shader.name : nextName()
    code.value = shader ? shader.code : SHADERTOY_TEMPLATE
    armedDelete = false
    statusLine.textContent = ''
    compileNow()
    renderList()
    renderActions()
  }

  function confirmLeave () {
    return !dirty() || window.confirm('Discard the changes that were not applied?')
  }

  function select (id) {
    if (id === currentId || !confirmLeave()) return
    load(state.shaders.find((shader) => shader.id === id))
  }

  /** Write the editor into the project. Returns the shader id, or null. */
  function apply () {
    const name = nameInput.value.trim().slice(0, SHADER_NAME_MAX) || nextName()
    let shader = current()
    if (shader && shader.name === name && shader.code === code.value) return shader.id
    if (!shader) {
      if (state.shaders.length >= SHADER_LIMIT) return null
      shader = { id: createShaderId(state.shaders.map((entry) => entry.id)), name, code: code.value }
      state.shaders.push(shader)
    } else {
      shader.name = name
      shader.code = code.value
    }
    currentId = shader.id
    saved = { name, code: code.value }
    nameInput.value = name
    onChange()
    statusLine.textContent = errors.length ? 'Saved, but it does not compile yet.' : 'Saved to the project.'
    renderList()
    renderActions()
    return shader.id
  }

  function open (slot) {
    const input = Number.isInteger(slot) ? state.inputs[slot] : null
    const used = input?.kind === 'shader' && input.shader.startsWith(CUSTOM_PREFIX)
      ? state.shaders.find((shader) => CUSTOM_PREFIX + shader.id === input.shader)
      : null
    modal.hidden = false
    const keep = currentId && current()
    if (used) load(used)
    else if (keep) load(keep)
    else load(state.shaders[0] || null)
    code.focus()
  }

  function hide () {
    if (modal.hidden || !confirmLeave()) return
    window.clearTimeout(timer)
    preview.stop()
    modal.hidden = true
  }

  code.addEventListener('input', () => {
    renderGutter()
    renderActions()
    scheduleCompile()
  })
  code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop })
  code.addEventListener('keydown', (event) => {
    const mod = event.metaKey || event.ctrlKey
    if (event.key === 'Tab' && !mod && !event.altKey) {
      event.preventDefault()
      document.execCommand('insertText', false, '  ')
    } else if (mod && event.key === 'Enter') {
      event.preventDefault()
      compileNow()
      apply()
    } else if (mod && event.key.toLowerCase() === 's' && dirty()) {
      compileNow()
      apply()
    }
  })
  nameInput.addEventListener('input', () => {
    renderActions()
    if (!currentId) renderList()
  })
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') apply()
  })
  newButton.addEventListener('click', () => {
    if (!confirmLeave()) return
    load(null)
    code.focus()
    code.select()
  })
  applyButton.addEventListener('click', () => {
    compileNow()
    apply()
  })
  for (const node of useButtons) {
    node.addEventListener('click', () => {
      compileNow()
      const id = apply()
      if (!id) return
      const slot = Number(node.dataset.slot)
      onUse(slot, `shader:${CUSTOM_PREFIX}${id}`)
      statusLine.textContent = `On input ${slot + 1}.`
      renderList()
    })
  }
  deleteButton.addEventListener('click', () => {
    const shader = current()
    if (!shader) return
    if (!armedDelete) {
      armedDelete = true
      renderActions()
      return
    }
    state.shaders.splice(state.shaders.indexOf(shader), 1)
    onDelete(shader.id)
    saved = { name: '', code: '' }
    load(state.shaders[0] || null)
  })
  deleteButton.addEventListener('blur', () => {
    armedDelete = false
    renderActions()
  })

  close.addEventListener('click', hide)
  modal.addEventListener('click', (event) => {
    if (event.target === modal) hide()
  })
  window.addEventListener('keydown', (event) => {
    if (!modal.hidden && event.key === 'Escape') {
      event.preventDefault()
      hide()
    }
  })

  return {
    open,
    close: hide,
    isOpen: () => !modal.hidden,
    /** The project was replaced or undone: reload what is on screen. */
    sync () {
      if (modal.hidden) return
      const shader = current()
      if (shader && !dirty()) load(shader)
      else if (!shader && currentId) load(state.shaders[0] || null)
      else renderList()
    }
  }
}
