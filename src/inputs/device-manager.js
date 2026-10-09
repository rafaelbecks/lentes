export function createDeviceManager () {
  const listeners = new Set()
  let devices = []

  function emit () {
    for (const listener of listeners) listener(devices)
  }

  async function refresh () {
    if (!navigator.mediaDevices?.enumerateDevices) {
      devices = []
      emit()
      return devices
    }
    const listed = await navigator.mediaDevices.enumerateDevices()
    devices = listed
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
        labeled: Boolean(device.label)
      }))
    emit()
    return devices
  }

  function onChange (listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      refresh().catch(() => {})
    })
  }

  return {
    refresh,
    onChange,
    list () {
      return devices
    }
  }
}

export function cameraErrorMessage (error) {
  const name = error?.name
  if (name === 'NotAllowedError') return 'Permission denied'
  if (name === 'NotFoundError') return 'No camera found'
  if (name === 'NotReadableError') return 'Camera is busy'
  if (name === 'OverconstrainedError') return 'Camera rejected the requested format'
  if (name === 'SecurityError') return 'Cameras need localhost or https'
  return error?.message || 'Camera error'
}

export async function probeCameraPermission () {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser has no camera API')
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
  for (const track of stream.getTracks()) track.stop()
}
