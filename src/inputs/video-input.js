async function openStream (deviceId, width, height, frameRate) {
  const sized = {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: frameRate }
  }
  const attempts = deviceId
    ? [
        { audio: false, video: { deviceId: { exact: deviceId }, ...sized } },
        { audio: false, video: { deviceId: { exact: deviceId } } },
        { audio: false, video: { deviceId: { ideal: deviceId } } }
      ]
    : [
        { audio: false, video: sized },
        { audio: false, video: true }
      ]
  let last = new Error('Could not open a camera')
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      last = error
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') throw error
    }
  }
  throw last
}

export function createVideoInput () {
  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.autoplay = true
  video.setAttribute('playsinline', '')
  let stream = null
  let deviceId = ''
  let label = ''
  let status = 'idle'
  let error = ''
  let actual = null

  function stop () {
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    video.srcObject = null
    actual = null
  }

  async function connect ({ deviceId: nextId, width, height, frameRate }) {
    disconnect()
    status = 'connecting'
    error = ''
    try {
      stream = await openStream(nextId, width, height, frameRate)
      const [track] = stream.getVideoTracks()
      track.addEventListener('ended', () => {
        status = 'ended'
        error = 'Camera disconnected'
        deviceId = ''
        actual = null
      })
      video.srcObject = stream
      await video.play()
      const settings = track.getSettings?.() || {}
      deviceId = settings.deviceId || nextId || ''
      label = track.label || ''
      actual = {
        width: settings.width || video.videoWidth || width,
        height: settings.height || video.videoHeight || height,
        frameRate: settings.frameRate || frameRate
      }
      status = 'live'
      return actual
    } catch (err) {
      stop()
      status = 'error'
      error = err.message || 'Camera error'
      throw err
    }
  }

  function disconnect () {
    stop()
    status = 'idle'
    error = ''
    deviceId = ''
    label = ''
  }

  return {
    video,
    connect,
    disconnect,
    isLive () {
      return status === 'live' && video.readyState >= 2
    },
    get deviceId () {
      return deviceId
    },
    get label () {
      return label
    },
    get status () {
      return status
    },
    get error () {
      return error
    },
    get actual () {
      return actual
    }
  }
}
