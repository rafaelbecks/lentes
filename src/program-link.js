import { serializeProject } from './projects/schema.js'

/**
 * Operator → output surface link. The project document crosses it, and so
 * does a chosen video or image (a file the project only names). Pixels of
 * the rendered frame never do. Both windows must share an origin.
 */
const CHANNEL = 'lentes-program'

export function createProgramSender (state) {
  if (typeof BroadcastChannel === 'undefined') return { send () {}, setMedia () {}, dispose () {} }
  const channel = new BroadcastChannel(CHANNEL)
  const media = [null, null, null]
  let queued = false

  function post () {
    queued = false
    channel.postMessage({
      type: 'state',
      clockOrigin: performance.timeOrigin,
      project: serializeProject(state)
    })
  }

  function postMedia (index) {
    channel.postMessage({ type: 'media', index, file: media[index] })
  }

  channel.addEventListener('message', (event) => {
    if (event.data?.type !== 'hello') return
    post()
    for (let i = 0; i < media.length; i++) if (media[i]) postMedia(i)
  })

  return {
    send () {
      if (queued) return
      queued = true
      requestAnimationFrame(post)
    },
    setMedia (index, file) {
      media[index] = file || null
      postMedia(index)
    },
    dispose () {
      channel.close()
    }
  }
}

export function createProgramReceiver (onState, onMedia) {
  const channel = new BroadcastChannel(CHANNEL)
  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'state') onState(event.data)
    if (event.data?.type === 'media') onMedia?.(event.data)
  })
  channel.postMessage({ type: 'hello' })
  return {
    dispose () {
      channel.close()
    }
  }
}
