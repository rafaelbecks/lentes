import { migrate } from './migrations.js'

/**
 * Copy a project document into the live state objects the UI is bound to.
 * Object identity is kept so Tweakpane bindings stay valid.
 */
export function applyProject (state, project) {
  const { project: next, warnings } = migrate(project)
  state.name = next.name
  for (let i = 0; i < 3; i++) {
    const { slot, ...source } = next.inputs[i]
    Object.assign(state.inputs[i], source)
  }
  const { weights, mutes, ...mixer } = next.mixer
  Object.assign(state.mixer, mixer)
  state.mixer.weights.splice(0, state.mixer.weights.length, ...weights)
  state.mixer.mutes.splice(0, state.mixer.mutes.length, ...mutes)
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
  state.modulation.modulators.splice(0, state.modulation.modulators.length, ...next.modulation.modulators)
  state.output.width = next.output.width
  state.output.height = next.output.height
  return warnings
}
