/** WebGL2 passthrough for `gl.drawArrays(TRIANGLES, 0, 3)` full-screen triangle. */
export const FULLSCREEN_TRIANGLE_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`
