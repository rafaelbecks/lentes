export function createDialogs (root) {
  const title = root.querySelector('#modal-title')
  const body = root.querySelector('#modal-body')
  const nameField = root.querySelector('#modal-name-field')
  const nameInput = root.querySelector('#modal-name')
  const list = root.querySelector('#modal-list')
  const ok = root.querySelector('#modal-ok')
  const cancel = root.querySelector('#modal-cancel')
  let resolver = null
  let selected = null

  function finish (value) {
    root.hidden = true
    const done = resolver
    resolver = null
    selected = null
    done?.(value)
  }

  function open ({ heading, text, confirmLabel, showName, name, items }) {
    if (resolver) finish(null)
    title.textContent = heading
    body.textContent = text || ''
    body.hidden = !text
    nameField.hidden = !showName
    list.hidden = !items
    list.replaceChildren()
    selected = null
    ok.textContent = confirmLabel || 'OK'
    if (showName) {
      nameInput.value = name || ''
    }
    if (items) {
      if (!items.length) {
        const empty = document.createElement('p')
        empty.className = 'modal-empty'
        empty.textContent = 'No recent projects on this browser.'
        list.append(empty)
        ok.disabled = true
      } else {
        ok.disabled = true
        for (const item of items) {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'modal-choice'
          button.textContent = item.projectName || item.fileName
          const meta = document.createElement('span')
          meta.textContent = item.fileName
          button.append(meta)
          button.addEventListener('click', () => {
            selected = item
            for (const node of list.querySelectorAll('.modal-choice')) {
              node.classList.toggle('is-selected', node === button)
            }
            ok.disabled = false
          })
          button.addEventListener('dblclick', () => finish(item))
          list.append(button)
        }
      }
    } else {
      ok.disabled = false
    }
    root.hidden = false
    if (showName) nameInput.focus()
    else ok.focus()
    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  root.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault()
    if (ok.disabled) return
    if (!nameField.hidden) finish(nameInput.value.trim())
    else if (!list.hidden) finish(selected)
    else finish(true)
  })
  cancel.addEventListener('click', () => finish(null))
  root.addEventListener('click', (event) => {
    if (event.target === root) finish(null)
  })
  window.addEventListener('keydown', (event) => {
    if (!root.hidden && event.key === 'Escape') {
      event.preventDefault()
      finish(null)
    }
  })

  return {
    confirm (text) {
      return open({ heading: 'LENTE', text, confirmLabel: 'Continue' })
    },
    askName (name) {
      return open({
        heading: 'Save project',
        text: 'The file is JSON with a .lente extension.',
        confirmLabel: 'Save',
        showName: true,
        name
      })
    },
    about () {
      return open({
        heading: 'LENTE',
        text: 'Experimental video mixer. Part of Luminode Studio. The Spanish acronym is not finalized.',
        confirmLabel: 'Close'
      })
    },
    choose (items) {
      return open({ heading: 'Recent projects', items, confirmLabel: 'Open' })
    }
  }
}
