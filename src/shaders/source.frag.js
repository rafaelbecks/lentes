/**
 * Per-source processing: contain the picture inside a pixel box (the whole
 * frame for a camera or shader; width × height for a file), then flips,
 * gain, saturation, hue rotation and invert. Writes coverage to alpha so
 * the mixer can ignore the area outside the picture.
 * Hue rotation uses the CSS hue-rotate() matrix, as GLOW's hue filter does.
 */
export const SOURCE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uBox;
uniform vec2 uCenter;
uniform float uSrcAspect;
uniform vec2 uFlip;
uniform float uGain;
uniform float uSaturation;
uniform float uHue;
uniform float uInvert;

in vec2 vUv;
out vec4 fragColor;

vec3 hueRotate(vec3 c, float a) {
  float cosA = cos(a);
  float sinA = sin(a);
  mat3 m = mat3(
    0.213 + cosA * 0.787 - sinA * 0.213,
    0.213 - cosA * 0.213 + sinA * 0.143,
    0.213 - cosA * 0.213 - sinA * 0.787,
    0.715 - cosA * 0.715 - sinA * 0.715,
    0.715 + cosA * 0.285 + sinA * 0.140,
    0.715 - cosA * 0.715 + sinA * 0.715,
    0.072 - cosA * 0.072 + sinA * 0.928,
    0.072 - cosA * 0.072 - sinA * 0.283,
    0.072 + cosA * 0.928 + sinA * 0.072
  );
  return m * c;
}

void main() {
  vec2 box = max(uBox, vec2(1.0));
  float boxAspect = box.x / box.y;
  float spanX;
  float spanY;
  if (uSrcAspect > boxAspect) {
    spanX = box.x / uResolution.x;
    spanY = spanX * uResolution.x / (uSrcAspect * uResolution.y);
  } else {
    spanY = box.y / uResolution.y;
    spanX = spanY * uSrcAspect * uResolution.y / uResolution.x;
  }
  float x0 = uCenter.x - spanX * 0.5;
  float y0 = uCenter.y - spanY * 0.5;
  if (vUv.x < x0 || vUv.x > x0 + spanX || vUv.y < y0 || vUv.y > y0 + spanY) {
    fragColor = vec4(0.0);
    return;
  }
  vec2 suv = vec2((vUv.x - x0) / spanX, (vUv.y - y0) / spanY);
  suv = mix(suv, 1.0 - suv, uFlip);
  vec3 color = texture(uSource, suv).rgb * uGain;
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(l), color, uSaturation);
  if (abs(uHue) > 0.0001) color = hueRotate(color, uHue);
  color = clamp(color, 0.0, 1.0);
  color = mix(color, 1.0 - color, uInvert);
  fragColor = vec4(color, 1.0);
}
`
