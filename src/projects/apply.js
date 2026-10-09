import { migrate } from './migrations.js'

/** Copy a project document into the live state objects the UI is bound to. */
export function applyProject (state, project) {
  const { project: next, warnings } = migrate(project)
  state.name = next.name
  for (let i = 0; i < 3; i++) {
    const input = state.inputs[i]
    const source = next.inputs[i]
    input.deviceId = source.deviceId
    input.label = source.label
    input.width = source.width
    input.height = source.height
    input.frameRate = source.frameRate
  }
  state.mixer.mode = next.mixer.mode
  state.mixer.solo = next.mixer.solo
  state.mixer.crossfadeA = next.mixer.crossfadeA
  state.mixer.crossfadeB = next.mixer.crossfadeB
  state.mixer.crossfade = next.mixer.crossfade
  state.mixer.blend = next.mixer.blend
  state.mixer.weights[0] = next.mixer.weights[0]
  state.mixer.weights[1] = next.mixer.weights[1]
  state.mixer.weights[2] = next.mixer.weights[2]
  const ordered = []
  for (const source of next.effects) {
    const effect = state.effects.find((entry) => entry.id === source.id)
    if (!effect) continue
    effect.enabled = source.enabled
    for (const key of Object.keys(effect.params)) {
      if (source.params[key] !== undefined) effect.params[key] = source.params[key]
    }
    ordered.push(effect)
  }
  for (const effect of state.effects) {
    if (!ordered.includes(effect)) ordered.push(effect)
  }
  state.effects.splice(0, state.effects.length, ...ordered)
  state.output.width = next.output.width
  state.output.height = next.output.height
  return warnings
}
