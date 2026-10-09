/**
 * Rain Screen — Jakob Thomsen, Shadertoy 4ljXDy (CC BY-NC-SA 3.0), via GLOW
 * src/glass-overlay-manager.js. Scene lookup flips v for y-up framebuffers.
 */
export const RAIN_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_sceneTex;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_distortion;
uniform float u_noiseScale;
uniform float u_timeScale;
uniform float u_patternDrift;
uniform float u_sharpness;

#define PI 3.1415926

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 18.5453);
}

float grid_noise(float t, vec2 v) {
  vec2 fl = floor(v), fr = fract(v);
  float mindist = 1e9;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 pos = 0.5 + 0.5 * cos(2.0 * PI * (t * u_patternDrift + hash(fl + offset)) + vec2(0.0, 1.6));
      mindist = min(mindist, length(pos + offset - fr));
    }
  }
  return mindist;
}

float blob_noise(float t, vec2 v, float s) {
  return pow(0.5 + 0.5 * cos(PI * clamp(grid_noise(t, v) * 2.0, 0.0, 1.0)), s);
}

vec3 blob_noise_normal(float t, vec2 v, float s) {
  vec2 e = vec2(0.01, 0.0);
  return normalize(vec3(
    blob_noise(t, v + e.xy, s) - blob_noise(t, v - e.xy, s),
    blob_noise(t, v + e.yx, s) - blob_noise(t, v - e.yx, s),
    1.0));
}

float blob_noises(float t, vec2 p, float s) {
  float h = 0.0;
  const float n = 3.0;
  for (float i = 0.0; i < n; i++) {
    vec2 q = vec2(0.0, 1.0 * t * (i + 1.0) / n) + 1.0 * p;
    h += pow(0.5 + 0.5 * cos(PI * clamp(grid_noise(t, q * (i + 1.0)) * 2.0, 0.0, 1.0)), s);
  }
  return h / n;
}

vec3 blob_noises_normal(float t, vec2 p, float s) {
  float d = 0.01;
  return normalize(vec3(
    blob_noises(t, p + vec2(d, 0.0), s) - blob_noises(t, p + vec2(-d, 0.0), s),
    blob_noises(t, p + vec2(0.0, d), s) - blob_noises(t, p + vec2(0.0, -d), s),
    d));
}

void main() {
  float t = u_time * u_timeScale;
  vec2 p = vec2(vUv.x, 1.0 - vUv.y);
  vec2 r = vec2(1.0, u_resolution.y / u_resolution.x);
  vec3 n = blob_noises_normal(t, u_noiseScale * p * r, u_sharpness);
  vec2 uv = clamp(p + u_distortion * n.xy, vec2(0.0), vec2(1.0));
  fragColor = texture(u_sceneTex, vec2(uv.x, 1.0 - uv.y));
  fragColor.a = 1.0;
}`
