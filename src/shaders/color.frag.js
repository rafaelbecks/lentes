/**
 * Point color grade.
 * Brightness, contrast, and saturation follow the CSS filter model used by
 * GLOW canvas filters (src/canvas-filter-configs.js): 100 is unchanged.
 * Threshold and posterize are extra LENTE grades in the same pass.
 */
export const COLOR_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uThreshold;
uniform float uPosterize;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 color = texture(uSource, vUv).rgb;
  color *= uBrightness / 100.0;
  color = (color - 0.5) * (uContrast / 100.0) + 0.5;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation / 100.0);
  if (uThreshold > 0.0) {
    float y = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = vec3(y >= uThreshold ? 1.0 : 0.0);
  }
  if (uPosterize >= 2.0) {
    color = clamp(color, 0.0, 1.0);
    color = floor(color * uPosterize) / (uPosterize - 1.0);
  }
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`
