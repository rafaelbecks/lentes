import { VALUE_NOISE_GLSL } from './value-noise.js'

/**
 * Film grain driven by GLOW's value noise.
 * Amount, scale, and speed stand in for the grained.js overlay used by
 * Cartografías (src/grain/grainParams.js) without a second DOM canvas.
 */
export const NOISE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform float uAmount;
uniform float uScale;
uniform float uTime;

in vec2 vUv;
out vec4 fragColor;

${VALUE_NOISE_GLSL}

void main() {
  vec3 color = texture(uSource, vUv).rgb;
  float n = snoise(vec3(vUv * uScale, uTime));
  color += n * uAmount;
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`
