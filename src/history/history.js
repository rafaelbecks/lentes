/**
 * Memento undo history, after MUSGO src/morphogenesis/organismHistory.js (MIT).
 * Up to 20 moments in memory, mirrored in localStorage per project key.
 * Edits are committed 500 ms after they settle; undo / redo restore a whole
 * project snapshot through `apply`.
 */

export const MAX_ENTRIES = 20
export const MAX_BUCKETS = 8
export const COMMIT_MS = 500

function uid () {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function same (a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function boolWord (value) {
  return value ? 'on' : 'off'
}

/** Short human label for the difference between two serialized projects. */
export function describeChange (prevFingerprint, nextFingerprint) {
  let prev
  let next
  try {
    prev = JSON.parse(prevFingerprint)
    next = JSON.parse(nextFingerprint)
  } catch {
    return 'change'
  }
  const parts = []
  if (prev.name !== next.name) parts.push('rename')
  for (let i = 0; i < 3; i++) {
    const a = prev.inputs?.[i] || {}
    const b = next.inputs?.[i] || {}
    for (const key of Object.keys(b)) {
      if (same(a[key], b[key])) continue
      if (key === 'deviceId' || key === 'label') {
        if (!parts.includes(`input ${i + 1} source`)) parts.push(`input ${i + 1} source`)
      } else if (typeof b[key] === 'boolean') {
        parts.push(`input ${i + 1} ${key} ${boolWord(b[key])}`)
      } else {
        parts.push(`input ${i + 1} ${key}`)
      }
    }
  }
  const mixerA = prev.mixer || {}
  const mixerB = next.mixer || {}
  for (const key of Object.keys(mixerB)) {
    if (same(mixerA[key], mixerB[key])) continue
    if (key === 'weights') parts.push('faders')
    else if (key === 'mutes') parts.push('mute')
    else if (key === 'mode') parts.push(`mixer → ${mixerB.mode}`)
    else if (key === 'blend') parts.push(`blend → ${mixerB.blend}`)
    else parts.push(key)
  }
  const effectsA = prev.effects || []
  const effectsB = next.effects || []
  if (effectsA.map((e) => e.id).join() !== effectsB.map((e) => e.id).join()) parts.push('effect order')
  for (const effect of effectsB) {
    const before = effectsA.find((entry) => entry.id === effect.id)
    if (!before) continue
    if (before.enabled !== effect.enabled) parts.push(`${effect.id} ${boolWord(effect.enabled)}`)
    for (const key of Object.keys(effect.params || {})) {
      if (!same(before.params?.[key], effect.params[key])) parts.push(`${effect.id} ${key}`)
    }
  }
  if (!same(prev.modulation, next.modulation)) parts.push('LFO')
  if (!same(prev.output, next.output)) parts.push('output size')
  if (!parts.length) return 'change'
  const label = parts.length <= 3 ? parts.join(', ') : `${parts.slice(0, 3).join(', ')} +${parts.length - 3}`
  return label.length > 80 ? `${label.slice(0, 77)}…` : label
}

/**
 * @param {object} options
 * @param {() => { fingerprint: string, state: object }} options.getMemento
 * @param {(state: object) => void | Promise<void>} options.apply
 * @param {() => string} options.getKey   bucket id for the open project
 * @param {Storage | null} [options.storage]
 * @param {string} [options.storageKey]
 * @param {(error: Error) => void} [options.onError]
 */
export function createHistory ({
  getMemento,
  apply,
  getKey,
  storage = globalThis.localStorage ?? null,
  storageKey = 'lente.history.v1',
  onError = (error) => console.error('[history] restore failed', error)
}) {
  let entries = []
  let cursor = -1
  let loadedKey = null
  let ready = false
  let suppressDepth = 0
  let timer = 0
  let applyToken = 0
  let settledToken = 0
  let tail = Promise.resolve()
  const listeners = new Set()

  function emptyStore () {
    return { version: 1, buckets: {} }
  }

  function readStore () {
    if (!storage) return emptyStore()
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) || 'null')
      if (!parsed || parsed.version !== 1 || !parsed.buckets || typeof parsed.buckets !== 'object') return emptyStore()
      return parsed
    } catch {
      return emptyStore()
    }
  }

  function olderKeys (store) {
    return Object.keys(store.buckets)
      .filter((key) => key !== loadedKey)
      .sort((a, b) => (store.buckets[a]?.updatedAt || 0) - (store.buckets[b]?.updatedAt || 0))
  }

  function writeStore (store) {
    if (!storage) return
    const keys = olderKeys(store)
    while (Object.keys(store.buckets).length > MAX_BUCKETS && keys.length) delete store.buckets[keys.shift()]
    for (;;) {
      try {
        storage.setItem(storageKey, JSON.stringify(store))
        return
      } catch (error) {
        if (!keys.length) {
          console.warn('[history] could not persist undo stack', error)
          return
        }
        delete store.buckets[keys.shift()]
      }
    }
  }

  function persistBucket (key = loadedKey) {
    if (!key) return
    const store = readStore()
    store.buckets[key] = { cursor, updatedAt: Date.now(), entries }
    writeStore(store)
  }

  function isEntry (entry) {
    return entry && typeof entry.id === 'string' && typeof entry.at === 'number' &&
      typeof entry.label === 'string' && typeof entry.fingerprint === 'string' &&
      entry.state && typeof entry.state === 'object'
  }

  function loadBucket (key) {
    const bucket = readStore().buckets[key]
    if (!bucket || !Array.isArray(bucket.entries)) {
      entries = []
      cursor = -1
      return
    }
    entries = bucket.entries.filter(isEntry).slice(-MAX_ENTRIES)
    const saved = Number.isInteger(bucket.cursor) ? bucket.cursor : entries.length - 1
    cursor = entries.length ? Math.max(0, Math.min(saved, entries.length - 1)) : -1
  }

  function trim () {
    while (entries.length > MAX_ENTRIES) {
      entries.shift()
      cursor -= 1
    }
    if (!entries.length) cursor = -1
    else cursor = Math.max(0, Math.min(cursor, entries.length - 1))
  }

  function snapshot (label, memo) {
    return {
      id: uid(),
      at: Date.now(),
      label: label || 'change',
      fingerprint: memo.fingerprint,
      state: JSON.parse(JSON.stringify(memo.state))
    }
  }

  function notify () {
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        console.error('[history] listener failed', error)
      }
    }
  }

  function clearTimer () {
    if (timer) {
      clearTimeout(timer)
      timer = 0
    }
  }

  function restorePending () {
    return applyToken !== settledToken
  }

  function drifted () {
    if (restorePending() || !ready || cursor < 0 || !entries[cursor]) return false
    return getMemento().fingerprint !== entries[cursor].fingerprint
  }

  function appendRaw (label, memo) {
    entries.push(snapshot(label, memo))
    cursor = entries.length - 1
    trim()
    persistBucket()
    notify()
  }

  /**
   * Park history on the open project. `replace` starts a fresh stack (New).
   * Otherwise resume that project's stored moments.
   */
  function anchor (label, { replace = false } = {}) {
    clearTimer()
    const key = getKey()
    if (replace) {
      entries = []
      cursor = -1
      loadedKey = key
    } else if (!ready || key !== loadedKey) {
      if (ready && loadedKey && key !== loadedKey) persistBucket(loadedKey)
      loadBucket(key)
      loadedKey = key
    }
    const memo = getMemento()
    ready = true
    if (!entries.length) return appendRaw(label, memo)
    if (entries[cursor]?.fingerprint === memo.fingerprint) {
      persistBucket()
      return notify()
    }
    const match = entries.map((entry) => entry.fingerprint).lastIndexOf(memo.fingerprint)
    if (match >= 0) {
      cursor = match
      persistBucket()
      return notify()
    }
    appendRaw(label, memo)
  }

  /** Move the stack to a new key (Save As gives the project a new name). */
  function rekey () {
    if (!ready || !loadedKey) return
    const key = getKey()
    if (!key || key === loadedKey) return persistBucket(loadedKey)
    const store = readStore()
    delete store.buckets[loadedKey]
    loadedKey = key
    store.buckets[key] = { cursor, updatedAt: Date.now(), entries }
    writeStore(store)
  }

  function commitNow () {
    if (!ready || suppressDepth > 0 || restorePending()) return false
    clearTimer()
    if (cursor < 0 || !entries[cursor]) return false
    const memo = getMemento()
    if (memo.fingerprint === entries[cursor].fingerprint) return false
    const label = describeChange(entries[cursor].fingerprint, memo.fingerprint)
    entries = entries.slice(0, cursor + 1)
    entries.push(snapshot(label, memo))
    cursor = entries.length - 1
    trim()
    persistBucket()
    notify()
    return true
  }

  function noteEdit () {
    if (!ready || suppressDepth > 0) return
    clearTimer()
    timer = setTimeout(() => {
      timer = 0
      if (restorePending() || suppressDepth > 0) return noteEdit()
      commitNow()
    }, COMMIT_MS)
  }

  async function runWithout (fn) {
    clearTimer()
    suppressDepth += 1
    try {
      return await fn()
    } finally {
      suppressDepth -= 1
    }
  }

  function scheduleApply () {
    const token = ++applyToken
    const state = entries[cursor]?.state
    if (!state) {
      settledToken = token
      return Promise.resolve(false)
    }
    const copy = JSON.parse(JSON.stringify(state))
    clearTimer()
    tail = tail.then(async () => {
      if (token !== applyToken) return false
      suppressDepth += 1
      try {
        await apply(copy)
        return true
      } catch (error) {
        onError(error)
        return false
      } finally {
        suppressDepth -= 1
        if (token === applyToken) {
          settledToken = token
          notify()
        }
      }
    })
    return tail
  }

  function undo () {
    if (!restorePending()) commitNow()
    if (!ready || cursor <= 0) return Promise.resolve(false)
    cursor -= 1
    persistBucket()
    notify()
    return scheduleApply()
  }

  function redo () {
    if (!ready) return Promise.resolve(false)
    if (!restorePending() && drifted()) {
      commitNow()
      return Promise.resolve(false)
    }
    clearTimer()
    if (cursor >= entries.length - 1) return Promise.resolve(false)
    cursor += 1
    persistBucket()
    notify()
    return scheduleApply()
  }

  function restoreId (id) {
    if (!ready || !id) return Promise.resolve(false)
    if (!restorePending()) commitNow()
    const index = entries.findIndex((entry) => entry.id === id)
    if (index < 0 || index === cursor) return Promise.resolve(false)
    clearTimer()
    cursor = index
    persistBucket()
    notify()
    return scheduleApply()
  }

  function canUndo () {
    return ready && (cursor > 0 || drifted())
  }

  function canRedo () {
    return ready && cursor < entries.length - 1 && !drifted()
  }

  function list () {
    return {
      cursor,
      limit: MAX_ENTRIES,
      canUndo: canUndo(),
      canRedo: canRedo(),
      entries: entries.map((entry, index) => ({
        id: entry.id,
        at: entry.at,
        label: entry.label,
        index,
        current: index === cursor
      }))
    }
  }

  function subscribe (listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    anchor,
    rekey,
    noteEdit,
    commitNow,
    runWithout,
    undo,
    redo,
    restoreId,
    canUndo,
    canRedo,
    list,
    subscribe,
    isRestoring: restorePending,
    settled: () => tail
  }
}
