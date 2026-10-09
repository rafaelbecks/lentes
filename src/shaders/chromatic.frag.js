/**
 * Port of GLOW's #chromaticAberrationFilter SVG filter (index.html):
 *   red_  = feColorMatrix R×4, feOffset dx=2
 *   blue_ = feColorMatrix G×3 B×10, feOffset dx=-3
 *   feBlend screen
 * The filter does not set color-interpolation-filters, so SVG's default
 * linearRGB applies: gains and the screen blend run on linear light.
 * Channels are disjoint, so screen reduces to picking R from red_ and
 * G, B from blue_. Offsets are output pixels. Amount mixes with the input.
 */
export const CHROMATIC_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uRedShift;
uniform float uBlueShift;
uniform vec3 uGain;
uniform float uAmount;

in vec2 vUv;
out vec4 fragColor;

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec3 base = texture(uSource, vUv).rgb;
  vec2 px = vec2(1.0 / uResolution.x, 0.0);
  vec3 red = toLinear(texture(uSource, vUv - px * uRedShift).rgb);
  vec3 blue = toLinear(texture(uSource, vUv - px * uBlueShift).rgb);
  vec3 a = clamp(vec3(red.r * uGain.r, 0.0, 0.0), 0.0, 1.0);
  vec3 b = clamp(vec3(0.0, blue.g * uGain.g, blue.b * uGain.b), 0.0, 1.0);
  vec3 screen = toSrgb(a + b - a * b);
  fragColor = vec4(mix(base, screen, clamp(uAmount, 0.0, 1.0)), 1.0);
}
`
