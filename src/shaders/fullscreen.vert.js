/**
 * Full-screen triangle for `gl.drawArrays(TRIANGLES, 0, 3)`.
 * Vertex positions match GLOW's fullscreen triangle
 * (src/shaders/background/glsl/fullscreen-triangle.vert.js).
 * `vUv` is the extra channel LENTE needs for image sampling.
 */
export const FULLSCREEN_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`
