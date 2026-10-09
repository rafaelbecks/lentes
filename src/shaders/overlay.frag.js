/**
 * Flat color composite. Modes follow the subset of GLOW track blend modes
 * that stay well-defined as a single color over an image
 * (src/track-blend-modes.js): multiply, screen, overlay, difference, lighter.
 */
export const OVERLAY_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec3 uColor;
uniform float uOpacity;
uniform int uMode;

in vec2 vUv;
out vec4 fragColor;

vec3 composite(vec3 base, vec3 blend, int mode) {
  if (mode == 0) return base * blend;
  if (mode == 1) return 1.0 - (1.0 - base) * (1.0 - blend);
  if (mode == 3) return abs(base - blend);
  if (mode == 4) return base + blend;
  vec3 low = 2.0 * base * blend;
  vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
  return mix(low, high, step(vec3(0.5), base));
}

void main() {
  vec3 base = texture(uSource, vUv).rgb;
  vec3 mixed = mix(base, composite(base, uColor, uMode), clamp(uOpacity, 0.0, 1.0));
  fragColor = vec4(clamp(mixed, 0.0, 1.0), 1.0);
}
`
