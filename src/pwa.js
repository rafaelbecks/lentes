/**
 * Installed-app helpers. File Handling follows GLOW and MUSGO:
 * the manifest declares the extension, and launchQueue delivers the file.
 */

export function registerServiceWorker () {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
    console.warn('Service worker registration failed:', error)
  })
}

export function setupLaunchQueue (handler) {
  if (!('launchQueue' in window) || typeof handler !== 'function') return
  window.launchQueue.setConsumer((launchParams) => {
    if (!launchParams?.files?.length) return
    for (const fileHandle of launchParams.files) {
      Promise.resolve(handler(fileHandle)).catch((error) => {
        console.error('Failed to open launched file:', error)
      })
    }
  })
}

export async function fileFromDropEvent (event) {
  let file = null
  let fileHandle = null
  const items = event.dataTransfer?.items
  if (items?.length) {
    for (const item of items) {
      if (item.kind !== 'file') continue
      if (typeof item.getAsFileSystemHandle === 'function') {
        try {
          const handle = await item.getAsFileSystemHandle()
          if (handle?.kind === 'file') {
            fileHandle = handle
            file = await handle.getFile()
          }
        } catch {
          file = item.getAsFile()
        }
      } else {
        file = item.getAsFile()
      }
      break
    }
  }
  if (!file && event.dataTransfer?.files?.length) file = event.dataTransfer.files[0]
  return { file, fileHandle }
}
