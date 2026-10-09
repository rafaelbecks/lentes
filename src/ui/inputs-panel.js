const STATUS_TEXT = {
  idle: 'off',
  connecting: 'connecting',
  missing: 'camera unavailable',
  permission: 'allow cameras to restore',
  ended: 'disconnected'
}

export function createInputsPanel ({ root, videos, state, onConnect, onDisconnect }) {
  const slots = []

  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('section')
    slot.className = 'slot'
    const preview = document.createElement('div')
    preview.className = 'slot__preview'
    preview.append(videos[i])
    const controls = document.createElement('div')
    controls.className = 'slot__controls'
    const title = document.createElement('span')
    title.className = 'slot__title'
    title.textContent = `Input ${i + 1}`
    const select = document.createElement('select')
    select.setAttribute('aria-label', `Camera for input ${i + 1}`)
    const actions = document.createElement('div')
    actions.className = 'slot__actions'
    const connect = document.createElement('button')
    connect.type = 'button'
    connect.textContent = 'Connect'
    const disconnect = document.createElement('button')
    disconnect.type = 'button'
    disconnect.textContent = 'Disconnect'
    const status = document.createElement('p')
    status.className = 'slot__status'
    actions.append(connect, disconnect)
    controls.append(title, select, actions, status)
    slot.append(preview, controls)
    root.append(slot)
    connect.addEventListener('click', () => onConnect(i))
    disconnect.addEventListener('click', () => onDisconnect(i))
    select.addEventListener('change', () => {
      state.inputs[i].deviceId = select.value
      state.inputs[i].label = select.selectedOptions[0]?.textContent || ''
    })
    slots.push({ select, status, connect })
  }

  function setDevices (devices) {
    for (let i = 0; i < slots.length; i++) {
      const select = slots[i].select
      const current = state.inputs[i].deviceId
      select.replaceChildren()
      const empty = document.createElement('option')
      empty.value = ''
      empty.textContent = devices.length ? 'Select camera' : 'No cameras yet'
      select.append(empty)
      for (const device of devices) {
        const option = document.createElement('option')
        option.value = device.deviceId
        option.textContent = device.label
        select.append(option)
      }
      if (current && [...select.options].some((option) => option.value === current)) {
        select.value = current
      } else if (current) {
        const missing = document.createElement('option')
        missing.value = current
        missing.textContent = state.inputs[i].label || 'Saved camera unavailable'
        select.append(missing)
        select.value = current
      }
    }
  }

  function setStatus (index, kind, detail) {
    const node = slots[index].status
    node.dataset.kind = kind
    node.textContent = detail || STATUS_TEXT[kind] || kind
    slots[index].connect.textContent = kind === 'live' || kind === 'connecting' ? 'Reconnect' : 'Connect'
  }

  return { setDevices, setStatus }
}
