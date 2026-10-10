import {
  createDefaultProject,
  isLenteFileName,
  serializeProject,
  stripLenteExtension,
  toDocument
} from './schema.js'
import { migrate } from './migrations.js'

const RECENT_KEY = 'lente_recent_projects'
const RECENT_LIMIT = 8

function snapshot (state) {
  return JSON.stringify(serializeProject(state))
}

function readRecent () {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error(error)
    return []
  }
}

function writeRecent (entries) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, RECENT_LIMIT)))
}

function openDb () {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lente', 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('handles')) {
        request.result.createObjectStore('handles')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbGet (db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('handles').objectStore('handles').get(key)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

function idbPut (db, key, value) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('handles', 'readwrite').objectStore('handles').put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function download (filename, text) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function draftKey () {
  return `draft:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function fileNameFor (name) {
  const base = stripLenteExtension(name || 'Untitled') || 'Untitled'
  return `${base}.lentes`
}

async function remember (handle, projectName) {
  if (!handle) return
  try {
    const file = await handle.getFile()
    const entries = readRecent().filter((entry) => entry.fileName !== file.name)
    entries.unshift({
      fileName: file.name,
      projectName,
      lastOpened: Date.now()
    })
    writeRecent(entries)
    const db = await openDb()
    await idbPut(db, file.name, handle)
    db.close()
  } catch (error) {
    console.error('Could not remember project', error)
  }
}

/**
 * File menu, following GLOW's project manager:
 * File System Access handles when the browser has them, download/upload otherwise.
 * Recent names live in localStorage. Handles live in IndexedDB.
 */
export function createProjectManager ({ getState, replaceState }) {
  let handle = null
  let saved = snapshot(getState())
  let historyKey = draftKey()

  function markClean () {
    saved = snapshot(getState())
  }

  function isDirty () {
    return snapshot(getState()) !== saved
  }

  async function writeHandle (fileHandle, text) {
    const writable = await fileHandle.createWritable()
    await writable.write(text)
    await writable.close()
  }

  function adopt (project, fileHandle) {
    const warnings = replaceState(project)
    handle = fileHandle || null
    markClean()
    return warnings
  }

  function blank () {
    adopt(createDefaultProject(), null)
    historyKey = draftKey()
  }

  async function saveAs (name) {
    const state = getState()
    state.name = stripLenteExtension(name) || 'Untitled'
    const text = toDocument(state)
    const suggested = fileNameFor(state.name)
    if (window.showSaveFilePicker) {
      const picked = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{
          description: 'LENTES project',
          accept: { 'application/json': ['.lentes'] }
        }]
      })
      await writeHandle(picked, text)
      const file = await picked.getFile()
      state.name = stripLenteExtension(file.name) || state.name
      handle = picked
      historyKey = `file:${file.name}`
      markClean()
      await remember(picked, state.name)
      return { name: state.name }
    }
    download(suggested, text)
    handle = null
    markClean()
    return { name: state.name, downloaded: true }
  }

  async function save () {
    if (!handle) return { needsName: true }
    const text = toDocument(getState())
    try {
      await writeHandle(handle, text)
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        return { needsName: true }
      }
      throw error
    }
    markClean()
    await remember(handle, getState().name)
    return { name: getState().name }
  }

  async function openHandle (fileHandle) {
    const file = await fileHandle.getFile()
    if (!isLenteFileName(file.name) && !file.name.endsWith('.json')) {
      throw new Error('Choose a .lentes project')
    }
    const data = JSON.parse(await file.text())
    const { project, warnings } = migrate(data)
    if (!project.name) project.name = stripLenteExtension(file.name)
    adopt(project, fileHandle)
    historyKey = `file:${file.name}`
    await remember(fileHandle, getState().name)
    return { warnings, name: getState().name }
  }

  async function open () {
    if (!window.showOpenFilePicker) return { needsInput: true }
    const [picked] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: 'LENTES project',
        accept: { 'application/json': ['.lentes'] }
      }]
    })
    return openHandle(picked)
  }

  async function openText (text, fileName) {
    const data = JSON.parse(text)
    const { project, warnings } = migrate(data)
    if (fileName) project.name = stripLenteExtension(fileName) || project.name
    adopt(project, null)
    historyKey = `file:${fileName || project.name}`
    return { warnings, name: getState().name }
  }

  async function openRecent (fileName) {
    const db = await openDb()
    const stored = await idbGet(db, fileName)
    db.close()
    if (!stored) return { missing: true }
    if (stored.queryPermission) {
      let permission = await stored.queryPermission({ mode: 'read' })
      if (permission !== 'granted' && stored.requestPermission) {
        permission = await stored.requestPermission({ mode: 'read' })
      }
      if (permission !== 'granted') return { denied: true }
    }
    return openHandle(stored)
  }

  return {
    isDirty,
    blank,
    save,
    saveAs,
    open,
    openText,
    openRecent,
    noteClean: markClean,
    recent: readRecent,
    historyKey () {
      return historyKey
    },
    hasHandle () {
      return Boolean(handle)
    }
  }
}
