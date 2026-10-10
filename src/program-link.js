import { serializeProject } from './projects/schema.js'

/**
 * Operator → output surface link. Only the project document crosses it;
 * pixels never do. Both windows must share an origin.
 */
const CHANNEL = 'lentes-program'

export function createProgramSender (state) {
  if (typeof BroadcastChannel === 'undefined') return { send () {}, dispose () {} }
  const channel = new BroadcastChannel(CHANNEL)
  let queued = false

  function post () {
    queued = false
    channel.postMessage({
      type: 'state',
      clockOrigin: performance.timeOrigin,
      project: serializeProject(state)
    })
  }

  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'hello') post()
  })

  return {
    send () {
      if (queued) return
      queued = true
      requestAnimationFrame(post)
    },
    dispose () {
      channel.close()
    }
  }
}

export function createProgramReceiver (onState) {
  const channel = new BroadcastChannel(CHANNEL)
  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'state') onState(event.data)
  })
  channel.postMessage({ type: 'hello' })
  return {
    dispose () {
      channel.close()
    }
  }
}
