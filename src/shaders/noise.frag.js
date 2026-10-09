/**
 * Grain after grained.js by Sarath Saleem (MIT), as used in GLOW and
 * Cartografías. grained.js paints a patternWidth × patternHeight tile with a
 * random gray rect (grainWidth × grainHeight) every grainDensity pixels at
 * grainOpacity, tiles it over a 300% layer, and jumps that layer through
 * fixed keyframes with steps(grainSpeed) over grainChaos seconds.
 * Here the tile is a hash per cell and the keyframe offset is computed per
 * frame. Pixels are output pixels, top-left origin, like the CSS original.
 */
export const NOISE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAnimate;
uniform vec2 uPattern;
uniform vec2 uGrain;
uniform float uDensity;
uniform float uOpacity;
uniform float uChaos;
uniform float uSpeed;
uniform float uSeed;

in vec2 vUv;
out vec4 fragColor;

const vec2 KEYS[11] = vec2[11](
  vec2(-10.0, 10.0), vec2(-25.0, 0.0), vec2(-30.0, 10.0), vec2(-30.0, 30.0),
  vec2(-20.0, 20.0), vec2(-15.0, 10.0), vec2(-20.0, 20.0), vec2(-5.0, 20.0),
  vec2(-25.0, 5.0), vec2(-30.0, 25.0), vec2(-10.0, 10.0)
);

float cellGray(vec2 cell) {
  float h = fract(sin(dot(cell + uSeed, vec2(127.1, 311.7))) * 43758.5453);
  return floor(h * 256.0) / 255.0;
}

vec2 layerShift() {
  if (uAnimate < 0.5) return vec2(0.0);
  float steps = max(floor(uSpeed), 1.0);
  float phase = fract(uTime / max(uChaos, 0.01));
  float k = floor(phase * steps) / steps * 10.0;
  int i = int(floor(k));
  vec2 a = KEYS[i];
  vec2 b = KEYS[min(i + 1, 10)];
  return mix(a, b, fract(k)) * 0.03 * uResolution;
}

void main() {
  vec3 base = texture(uSource, vUv).rgb;
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) - layerShift();
  vec2 tile = mod(px, max(uPattern, vec2(1.0)));
  float density = max(uDensity, 1.0);
  vec2 local = mod(tile, density);
  if (local.x >= uGrain.x || local.y >= uGrain.y) {
    fragColor = vec4(base, 1.0);
    return;
  }
  float gray = cellGray(floor(tile / density));
  fragColor = vec4(mix(base, vec3(gray), clamp(uOpacity, 0.0, 1.0)), 1.0);
}
`
