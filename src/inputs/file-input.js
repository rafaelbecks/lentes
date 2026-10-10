/**
 * A video or still image chosen from disk. The project stores the file name
 * and the placement; the bytes stay in this session and are handed to the
 * output window over the program channel.
 */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i
const MEDIA_EXT = /\.(mp4|m4v|webm|mov|ogv|png|jpe?g|gif|webp|avif)$/i

export function isMediaFile (file) {
  if (!file) return false
  if (typeof file.type === 'string' && (file.type.startsWith('video/') || file.type.startsWith('image/'))) return true
  return MEDIA_EXT.test(file.name || '')
}

function isImage (file) {
  if (typeof file.type === 'string' && file.type.startsWith('image/')) return true
  return IMAGE_EXT.test(file.name || '')
}

function when (element, event) {
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve() }
    const fail = () => { cleanup(); reject(new Error('Could not read that file')) }
    const cleanup = () => {
      element.removeEventListener(event, ok)
      element.removeEventListener('error', fail)
    }
    element.addEventListener(event, ok)
    element.addEventListener('error', fail)
  })
}

export function createFileInput () {
  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.autoplay = true
  video.loop = true
  video.className = 'preview-file'
  const image = document.createElement('img')
  image.alt = ''
  image.className = 'preview-image'
  let url = ''
  let kind = ''
  let name = ''
  let ready = false

  function revoke () {
    if (!url) return
    URL.revokeObjectURL(url)
    url = ''
  }

  function clear () {
    video.pause()
    video.removeAttribute('src')
    video.load()
    image.removeAttribute('src')
    revoke()
    kind = ''
    name = ''
    ready = false
  }

  async function load (file, { loop = true } = {}) {
    clear()
    if (!isMediaFile(file)) throw new Error('Choose a video or an image')
    name = file.name || 'file'
    url = URL.createObjectURL(file)
    if (isImage(file)) {
      kind = 'image'
      const decoded = when(image, 'load')
      image.src = url
      if (image.decode) await image.decode().catch(() => decoded)
      else await decoded
      ready = image.naturalWidth > 0
    } else {
      kind = 'video'
      video.loop = Boolean(loop)
      const decoded = when(video, 'loadeddata')
      video.src = url
      await decoded
      try { await video.play() } catch { /* muted playback can wait for a gesture */ }
      ready = video.videoWidth > 0
    }
    if (!ready) {
      clear()
      throw new Error('That file has no picture')
    }
    return { width: width(), height: height(), kind, name }
  }

  function setLoop (loop) {
    video.loop = Boolean(loop)
    if (kind === 'video' && video.loop && video.ended) video.play().catch(() => {})
  }

  function width () {
    if (kind === 'image') return image.naturalWidth || 0
    return video.videoWidth || 0
  }

  function height () {
    if (kind === 'image') return image.naturalHeight || 0
    return video.videoHeight || 0
  }

  return {
    video,
    image,
    load,
    clear,
    setLoop,
    width,
    height,
    isReady () {
      return ready
    },
    get kind () {
      return kind
    },
    get name () {
      return name
    }
  }
}
