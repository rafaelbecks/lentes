/**
 * Glass displacement, after Shadertoy WXKyWc (itself after Three.js Journey
 * lesson 45): a normal map shifts the lookup, `uv + n.xy * strength`, and
 * lights the slopes facing the light. The Shadertoy reads its normals from an
 * image on iChannel1; here they come from a height field (ripples, noise or
 * tiles) so nothing has to be loaded.
 */
export const DISPLACE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform int uPattern;
uniform vec2 uCenter;
uniform float uScale;
uniform float uRelief;
uniform float uBevel;
uniform float uStrength;
uniform float uLight;
uniform vec3 uLightDir;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

float height(vec2 p) {
  if (uPattern == 1) {
    vec2 q = p * uScale * 0.5 + vec2(uTime * 0.31, uTime * 0.17);
    float h = 0.0;
    float amp = 0.6;
    for (int i = 0; i < 3; i++) {
      h += amp * valueNoise(q);
      q = q * 2.03 + vec2(1.7, 9.2);
      amp *= 0.35;
    }
    return h;
  }
  if (uPattern == 2) {
    vec2 q = fract(p * uScale) - 0.5;
    float edge = max(abs(q.x), abs(q.y));
    return 1.0 - smoothstep(0.5 - max(uBevel, 0.01) * 0.5, 0.5, edge);
  }
  float r = length(p);
  return 0.5 + 0.5 * sin(r * uScale * 6.2831853 - uTime * 6.2831853);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - uCenter) * vec2(aspect, 1.0);
  float e = 0.5 / max(uResolution.y, 1.0);
  float h = height(p);
  vec2 grad = vec2(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h) / e;
  vec3 normal = normalize(vec3(-grad * uRelief / max(uScale, 0.001), 1.0));

  vec2 uv = vUv + normal.xy * uStrength;
  vec4 color = texture(uSource, uv);
  float lightness = clamp(dot(normal, uLightDir), 0.0, 1.0);
  color.rgb += lightness * uLight;
  fragColor = vec4(color.rgb, 1.0);
}`
