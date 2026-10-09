/**
 * Combine up to three processed source textures (alpha = coverage).
 * Blend formulas mirror src/mixer/blend.js.
 * Uncovered pixels (letterbox) do not contribute to a weighted blend.
 */
export const MIX_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform float uReady0;
uniform float uReady1;
uniform float uReady2;
uniform int uMode;
uniform int uSolo;
uniform int uFadeA;
uniform int uFadeB;
uniform float uFade;
uniform vec3 uWeights;
uniform int uBlend;

in vec2 vUv;
out vec4 fragColor;

vec4 take(sampler2D tex, float ready) {
  if (ready < 0.5) return vec4(0.0);
  return texture(tex, vUv);
}

vec4 pick(int index, vec4 s0, vec4 s1, vec4 s2) {
  if (index == 1) return s1;
  if (index == 2) return s2;
  return s0;
}

vec3 pairBlend(vec3 a, vec3 b, int mode) {
  if (mode == 1) return a + b;
  if (mode == 2) return a * b;
  if (mode == 3) return abs(a - b);
  return b;
}

void main() {
  vec4 s0 = take(uTex0, uReady0);
  vec4 s1 = take(uTex1, uReady1);
  vec4 s2 = take(uTex2, uReady2);
  vec3 color = vec3(0.0);

  if (uMode == 0) {
    vec4 solo = pick(uSolo, s0, s1, s2);
    color = solo.a > 0.5 ? solo.rgb : vec3(0.0);
  } else if (uMode == 1) {
    vec4 sa = pick(uFadeA, s0, s1, s2);
    vec4 sb = pick(uFadeB, s0, s1, s2);
    vec3 a = sa.a > 0.5 ? sa.rgb : vec3(0.0);
    vec3 b = sb.a > 0.5 ? sb.rgb : vec3(0.0);
    float t = clamp(uFade, 0.0, 1.0);
    if (uBlend == 0) color = mix(a, b, t);
    else color = mix(a, pairBlend(a, b, uBlend), t);
  } else if (uBlend == 0) {
    float w0 = s0.a > 0.5 ? max(uWeights.x, 0.0) : 0.0;
    float w1 = s1.a > 0.5 ? max(uWeights.y, 0.0) : 0.0;
    float w2 = s2.a > 0.5 ? max(uWeights.z, 0.0) : 0.0;
    float sum = w0 + w1 + w2;
    if (sum > 0.0) color = (s0.rgb * w0 + s1.rgb * w1 + s2.rgb * w2) / sum;
  } else if (uBlend == 1) {
    float w0 = s0.a > 0.5 ? max(uWeights.x, 0.0) : 0.0;
    float w1 = s1.a > 0.5 ? max(uWeights.y, 0.0) : 0.0;
    float w2 = s2.a > 0.5 ? max(uWeights.z, 0.0) : 0.0;
    color = s0.rgb * w0 + s1.rgb * w1 + s2.rgb * w2;
  } else if (uBlend == 2) {
    color = vec3(1.0);
    float used = 0.0;
    if (s0.a > 0.5 && uWeights.x > 0.0) {
      color *= mix(vec3(1.0), s0.rgb, clamp(uWeights.x, 0.0, 1.0));
      used = 1.0;
    }
    if (s1.a > 0.5 && uWeights.y > 0.0) {
      color *= mix(vec3(1.0), s1.rgb, clamp(uWeights.y, 0.0, 1.0));
      used = 1.0;
    }
    if (s2.a > 0.5 && uWeights.z > 0.0) {
      color *= mix(vec3(1.0), s2.rgb, clamp(uWeights.z, 0.0, 1.0));
      used = 1.0;
    }
    if (used < 0.5) color = vec3(0.0);
  } else {
    float started = 0.0;
    if (s0.a > 0.5) {
      color = s0.rgb * max(uWeights.x, 0.0);
      started = 1.0;
    }
    if (s1.a > 0.5) {
      vec3 sample1 = s1.rgb * max(uWeights.y, 0.0);
      color = started > 0.5 ? abs(color - sample1) : sample1;
      started = 1.0;
    }
    if (s2.a > 0.5) {
      vec3 sample2 = s2.rgb * max(uWeights.z, 0.0);
      color = started > 0.5 ? abs(color - sample2) : sample2;
    }
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`
