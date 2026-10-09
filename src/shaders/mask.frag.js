/**
 * Shape mask. Inside the shape keeps the chain; outside shows black, a flat
 * color, or one processed source. Distance functions after Inigo Quilez
 * (https://iquilezles.org/articles/distfunctions2d/, MIT).
 * Shapes: 0 circle, 1 square, 2 triangle, 3 polygon, 4 star, 5 ring.
 * Center is in top-left normalized coordinates (like the stage pointer).
 */
export const MASK_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform sampler2D uOutside;
uniform int uOutsideMode;
uniform float uOutsideReady;
uniform vec3 uColor;
uniform int uShape;
uniform vec2 uCenter;
uniform float uSize;
uniform float uStretch;
uniform float uRotation;
uniform float uSides;
uniform float uSoftness;
uniform float uInvert;
uniform float uCanvasAspect;

in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265359;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRegularPolygon(vec2 p, float r, float n) {
  float an = PI / n;
  vec2 acs = vec2(cos(an), sin(an));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p.y += clamp(-p.y, 0.0, r * acs.y);
  return length(p) * sign(p.x);
}

float sdStar(vec2 p, float r, float n, float m) {
  float an = PI / n;
  float en = PI / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float shapeDistance(vec2 p) {
  if (uShape == 1) return sdBox(p, vec2(0.5));
  if (uShape == 2) return sdRegularPolygon(p, 0.5, 3.0);
  if (uShape == 3) return sdRegularPolygon(p, 0.5, max(uSides, 3.0));
  if (uShape == 4) {
    float n = max(uSides, 3.0);
    return sdStar(p, 0.5, n, clamp(n * 0.45, 2.0, n));
  }
  if (uShape == 5) return abs(length(p) - 0.4) - 0.1;
  return length(p) - 0.5;
}

void main() {
  vec3 inside = texture(uSource, vUv).rgb;
  vec2 center = vec2(uCenter.x, 1.0 - uCenter.y);
  vec2 p = (vUv - center) * vec2(uCanvasAspect, 1.0);
  float c = cos(uRotation);
  float s = sin(uRotation);
  p = mat2(c, -s, s, c) * p;
  p /= max(uSize, 0.001);
  p.x /= max(uStretch, 0.01);
  float d = shapeDistance(p);
  float edge = max(uSoftness, 0.0005);
  float alpha = 1.0 - smoothstep(-edge, edge, d);
  alpha = mix(alpha, 1.0 - alpha, uInvert);

  vec3 outside = vec3(0.0);
  if (uOutsideMode == 1) outside = uColor;
  else if (uOutsideMode == 2 && uOutsideReady > 0.5) {
    vec4 other = texture(uOutside, vUv);
    outside = other.rgb * other.a;
  }
  fragColor = vec4(mix(outside, inside, alpha), 1.0);
}
`
