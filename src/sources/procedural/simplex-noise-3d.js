/**
 * Compact 3D value noise (trilinear), exposed as `snoise(vec3)` for Shadertoy-style snippets.
 * Lighter than full simplex; stable across WebGL2 implementations.
 */
export const SIMPLEX_NOISE_3D_GLSL = `
float hash3n(float n) { return fract(sin(n) * 43758.5453); }
float vnoise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(
    mix(mix(hash3n(n + 0.0), hash3n(n + 1.0), f.x), mix(hash3n(n + 57.0), hash3n(n + 58.0), f.x), f.y),
    mix(mix(hash3n(n + 113.0), hash3n(n + 114.0), f.x), mix(hash3n(n + 170.0), hash3n(n + 171.0), f.x), f.y),
    f.z);
}
float snoise(vec3 v) { return vnoise(v) * 2.0 - 1.0; }
`
