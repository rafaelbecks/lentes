/**
 * File / View / Help bar.
 * Same interaction as GLOW's app menu: click to open, hover to move, escape to close.
 * Icons are omitted so LENTE does not depend on an icon font.
 */
export function createAppMenu ({ parent, actions = {} } = {}) {
  if (!parent) return { destroy () {}, refresh () {} }

  const menus = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New', shortcut: '⌘N' },
        { id: 'open', label: 'Open…', shortcut: '⌘O' },
        { id: 'recent', label: 'Recent…' },
        { id: 'save', label: 'Save', shortcut: '⌘S' },
        { id: 'saveAs', label: 'Save As…', shortcut: '⇧⌘S' }
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
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'about', label: 'About LENTE' }
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

  function refresh (root) {
    const scope = root ? [root] : [...roots.values()]
    for (const node of scope) {
      node.querySelectorAll('[data-check]').forEach((button) => {
        const menu = menus.find((entry) => entry.id === node.dataset.menu)
        const item = menu?.items.find((entry) => entry.id === button.dataset.action)
        const on = Boolean(item?.checked?.())
        button.classList.toggle('is-checked', on)
        button.setAttribute('aria-checked', on ? 'true' : 'false')
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
    trigger.className = 'app-menu__trigger'
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
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'app-menu__action'
      button.dataset.action = item.id
      button.setAttribute('role', item.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem')
      if (item.type === 'checkbox') button.dataset.check = '1'
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
