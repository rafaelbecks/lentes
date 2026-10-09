function compile (gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source.trim())
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Shader compile failed'
    gl.deleteShader(shader)
    throw new Error(log)
  }
  return shader
}

export function createProgram (gl, vertexSource, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Program link failed'
    gl.deleteProgram(program)
    throw new Error(log)
  }
  return program
}

export function uniformLocations (gl, program, names) {
  const locations = {}
  for (const name of names) {
    locations[name] = gl.getUniformLocation(program, name)
  }
  return locations
}

/**
 * Program plus the locations of all active uniforms. Names the compiler
 * dropped read as undefined, which WebGL treats as null (a no-op upload).
 */
export function createPass (gl, vertexSource, fragmentSource) {
  const program = createProgram(gl, vertexSource, fragmentSource)
  const u = {}
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i)
    const name = info.name.replace(/\[0\]$/, '')
    u[name] = gl.getUniformLocation(program, name)
  }
  return { program, u }
}
