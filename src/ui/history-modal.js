/**
 * Moment list: jump back to any of the last 20 project snapshots.
 * After MUSGO src/ui/historyModal.js (MIT).
 */

function formatTime (at) {
  const date = new Date(at)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (date.toDateString() === new Date().toDateString()) return time
  return `${date.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${time}`
}

export function createHistoryModal (history) {
  const modal = document.createElement('div')
  modal.className = 'modal history-modal'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-labelledby', 'history-modal-title')
  modal.hidden = true
  modal.innerHTML = `
    <div class="modal__panel history-modal__content">
      <header class="modal__header">
        <h2 id="history-modal-title">History</h2>
        <button type="button" class="modal__close" aria-label="Close">×</button>
      </header>
      <p class="history-modal__intro"></p>
      <div class="history-modal__body"></div>
    </div>
  `
  document.body.appendChild(modal)
  const intro = modal.querySelector('.history-modal__intro')
  const body = modal.querySelector('.history-modal__body')
  const close = modal.querySelector('.modal__close')

  function render () {
    const { entries, limit } = history.list()
    intro.textContent = entries.length
      ? `${entries.length} of ${limit} moments. Pick one to go back to that state.`
      : 'No moments yet.'
    if (!entries.length) {
      body.replaceChildren()
      return
    }
    const list = document.createElement('ul')
    list.className = 'history-modal__list'
    list.setAttribute('role', 'listbox')
    for (const entry of entries.slice().reverse()) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'history-modal__item'
      button.classList.toggle('is-current', entry.current)
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', entry.current ? 'true' : 'false')
      button.innerHTML = '<span class="history-modal__time"></span><span class="history-modal__label"></span><span class="history-modal__badge"></span>'
      button.querySelector('.history-modal__time').textContent = formatTime(entry.at)
      button.querySelector('.history-modal__label').textContent = entry.label
      button.querySelector('.history-modal__badge').textContent = entry.current ? 'current' : ''
      button.addEventListener('click', () => history.restoreId(entry.id))
      item.append(button)
      list.append(item)
    }
    body.replaceChildren(list)
    list.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' })
  }

  function open () {
    history.commitNow()
    modal.hidden = false
    render()
    close.focus()
  }

  function hide () {
    modal.hidden = true
  }

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
  history.subscribe(() => {
    if (!modal.hidden) render()
  })

  return { open, close: hide }
}
