/**
 * LENTES / File / Edit / View bar.
 * Same interaction as GLOW's and MUSGO's app menus: click to open, hover to
 * move, escape to close. Items may be checkboxes, separators, or carry an
 * `enabled()` predicate (MUSGO Edit menu).
 */
export function createAppMenu ({ parent, actions = {} } = {}) {
  if (!parent) return { destroy () {}, refresh () {} }

  const menus = [
    {
      id: 'lente',
      label: 'LENTES',
      brand: true,
      items: [
        { id: 'about', label: 'About LENTES' },
        { id: 'studio', label: 'luminode.studio ↗' }
      ]
    },
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New', shortcut: '⌘N' },
        { id: 'open', label: 'Open…', shortcut: '⌘O' },
        { id: 'recent', label: 'Recent…' },
        { type: 'separator' },
        { id: 'save', label: 'Save', shortcut: '⌘S' },
        { id: 'saveAs', label: 'Save As…', shortcut: '⇧⌘S' }
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', shortcut: '⌘Z', enabled: () => actions.canUndo?.() },
        { id: 'redo', label: 'Redo', shortcut: '⇧⌘Z', enabled: () => actions.canRedo?.() },
        { type: 'separator' },
        { id: 'history', label: 'History…' }
      ]
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { id: 'fullscreen', label: 'Fullscreen', shortcut: 'F' },
        {
          id: 'clean',
          label: 'Hide interface',
          type: 'checkbox',
          shortcut: '⌘I',
          checked: () => actions.isClean?.()
        }
      ]
    }
  ]

  const bar = document.createElement('nav')
  bar.className = 'app-menu'
  bar.setAttribute('aria-label', 'Application menu')
  let openId = null
  const roots = new Map()

  function closeAll () {
    openId = null
    for (const root of roots.values()) {
      root.classList.remove('is-open')
      root.querySelector('.app-menu__trigger')?.setAttribute('aria-expanded', 'false')
    }
  }

  function findItem (menuId, itemId) {
    return menus.find((entry) => entry.id === menuId)?.items.find((entry) => entry.id === itemId)
  }

  function refresh (root) {
    const scope = root ? [root] : [...roots.values()]
    for (const node of scope) {
      node.querySelectorAll('.app-menu__action').forEach((button) => {
        const item = findItem(node.dataset.menu, button.dataset.action)
        if (!item) return
        if (item.type === 'checkbox') {
          const on = Boolean(item.checked?.())
          button.classList.toggle('is-checked', on)
          button.setAttribute('aria-checked', on ? 'true' : 'false')
        }
        if (item.enabled) button.disabled = !item.enabled()
      })
    }
  }

  function openMenu (id) {
    if (openId === id) {
      closeAll()
      return
    }
    closeAll()
    openId = id
    const root = roots.get(id)
    if (!root) return
    root.classList.add('is-open')
    root.querySelector('.app-menu__trigger')?.setAttribute('aria-expanded', 'true')
    refresh(root)
  }

  async function run (id) {
    closeAll()
    const fn = actions[id]
    if (!fn) return
    try {
      await fn()
    } catch (error) {
      if (error?.name === 'AbortError') return
      console.error(error)
      actions.onError?.(error)
    }
    refresh()
  }

  for (const menu of menus) {
    const root = document.createElement('div')
    root.className = 'app-menu__item'
    root.dataset.menu = menu.id
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = menu.brand ? 'app-menu__trigger app-menu__brand' : 'app-menu__trigger'
    trigger.textContent = menu.label
    trigger.setAttribute('aria-haspopup', 'true')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.addEventListener('click', (event) => {
      event.stopPropagation()
      openMenu(menu.id)
    })
    trigger.addEventListener('mouseenter', () => {
      if (openId && openId !== menu.id) openMenu(menu.id)
    })
    const panel = document.createElement('div')
    panel.className = 'app-menu__dropdown'
    panel.setAttribute('role', 'menu')
    for (const item of menu.items) {
      if (item.type === 'separator') {
        const line = document.createElement('div')
        line.className = 'app-menu__separator'
        line.setAttribute('role', 'separator')
        panel.appendChild(line)
        continue
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'app-menu__action'
      button.dataset.action = item.id
      button.setAttribute('role', item.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem')
      button.innerHTML = '<span class="app-menu__label"></span><span class="app-menu__shortcut"></span><span class="app-menu__check" aria-hidden="true"></span>'
      button.querySelector('.app-menu__label').textContent = item.label
      button.querySelector('.app-menu__shortcut').textContent = item.shortcut || ''
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        run(item.id)
      })
      panel.appendChild(button)
    }
    root.append(trigger, panel)
    bar.append(root)
    roots.set(menu.id, root)
  }

  function onDoc () {
    closeAll()
  }
  function onKey (event) {
    if (event.key === 'Escape') closeAll()
  }
  document.addEventListener('click', onDoc)
  window.addEventListener('keydown', onKey)
  parent.replaceChildren(bar)

  return {
    refresh,
    close: closeAll,
    destroy () {
      document.removeEventListener('click', onDoc)
      window.removeEventListener('keydown', onKey)
      bar.remove()
    }
  }
}
