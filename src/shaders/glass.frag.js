/**
 * Liquid glass refraction, from GLOW src/glass-overlay-manager.js (GPL-3.0).
 * Adapted for LENTE: runs as a chain pass over y-up framebuffers, so scene
 * lookups flip v, and the glass layer is composited over the source in-shader.
 */
export const GLASS_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_sceneTex;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_size;
uniform float u_radius;
uniform float u_bezel;
uniform float u_thickness;
uniform float u_ior;
uniform float u_blur;
uniform float u_specular;
uniform float u_tint;
uniform float u_shadow;
uniform int u_mode;
uniform vec2 u_brickSize;
uniform vec2 u_brickOffset;
uniform float u_brickGap;

float sdRoundedRect(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float surfaceHeight(float t) {
  float s = 1.0 - t;
  return pow(1.0 - s * s * s * s, 0.25);
}

vec3 sampleScene(vec2 uv) {
  vec2 safeUv = clamp(uv, vec2(0.0), vec2(1.0));
  return texture(u_sceneTex, vec2(safeUv.x, 1.0 - safeUv.y)).rgb;
}

vec3 sampleSceneBlurred(vec2 uv, float radius) {
  if (radius < 0.5) return sampleScene(uv);
  vec3 sum = vec3(0.0);
  vec2 px = 1.0 / u_resolution;
  vec2 offsets[12];
  offsets[0] = vec2(-0.326, -0.406);
  offsets[1] = vec2(-0.840, -0.074);
  offsets[2] = vec2(-0.696, 0.457);
  offsets[3] = vec2(-0.203, 0.621);
  offsets[4] = vec2(0.962, -0.195);
  offsets[5] = vec2(0.473, -0.480);
  offsets[6] = vec2(0.519, 0.767);
  offsets[7] = vec2(0.185, -0.893);
  offsets[8] = vec2(0.507, 0.064);
  offsets[9] = vec2(0.896, 0.412);
  offsets[10] = vec2(-0.322, -0.933);
  offsets[11] = vec2(-0.792, -0.598);
  for (int i = 0; i < 12; i++) {
    sum += sampleScene(uv + offsets[i] * radius * px);
  }
  return sum / 12.0;
}

float tileRoundedSd(vec2 p, out vec2 tileCenter, out vec2 halfSize) {
  vec2 pitch = u_brickSize + vec2(u_brickGap);
  vec2 local = p - u_brickOffset;
  vec2 id = floor((local + 0.5 * pitch) / pitch);
  tileCenter = id * pitch + u_brickOffset;
  halfSize = 0.5 * u_brickSize;
  vec2 q = p - tileCenter;
  float radius = min(u_radius, min(halfSize.x, halfSize.y) - 1.0);
  return sdRoundedRect(q, halfSize, max(1.0, radius));
}

vec4 glassLayer() {
  vec2 screenPx = vec2(vUv.x, 1.0 - vUv.y) * u_resolution;
  vec2 p = screenPx - u_center;

  float sd;
  vec2 halfSize;
  vec2 localP = p;
  if (u_mode == 1) {
    vec2 tileCenter;
    sd = tileRoundedSd(screenPx, tileCenter, halfSize);
    localP = screenPx - tileCenter;
  } else {
    halfSize = max(u_size * 0.5, vec2(1.0));
    float radius = min(u_radius, min(halfSize.x, halfSize.y) - 1.0);
    sd = sdRoundedRect(localP, halfSize, max(1.0, radius));
  }

  if (sd > 0.0) {
    float shadowFalloff = exp(-sd * sd / 800.0);
    float shadowAlpha = u_shadow * shadowFalloff * 0.6;
    return vec4(0.0, 0.0, 0.0, shadowAlpha);
  }

  float distFromEdge = -sd;
  float bezel = min(u_bezel, min(halfSize.x, halfSize.y) - 1.0);
  bezel = max(bezel, 1.0);
  float t = clamp(distFromEdge / bezel, 0.0, 1.0);

  float h = surfaceHeight(t);
  float dt = 0.001;
  float h2 = surfaceHeight(min(t + dt, 1.0));
  float dh = (h2 - h) / dt;

  float slopeAngle = atan(dh * (u_thickness / bezel));
  float sinR = sin(slopeAngle) / max(u_ior, 1.0);
  sinR = clamp(sinR, -1.0, 1.0);
  float thetaR = asin(sinR);
  float displacement = h * u_thickness * (tan(slopeAngle) - tan(thetaR));

  vec2 grad;
  float eps = 0.5;
  if (u_mode == 1) {
    vec2 tileCenter;
    vec2 hs;
    float base = tileRoundedSd(screenPx, tileCenter, hs);
    grad.x = tileRoundedSd(screenPx + vec2(eps, 0.0), tileCenter, hs) - base;
    grad.y = tileRoundedSd(screenPx + vec2(0.0, eps), tileCenter, hs) - base;
  } else {
    grad.x = sdRoundedRect(localP + vec2(eps, 0.0), halfSize, u_radius) - sd;
    grad.y = sdRoundedRect(localP + vec2(0.0, eps), halfSize, u_radius) - sd;
  }
  grad = normalize(grad + vec2(1e-6));
  vec2 offset = -grad * displacement / u_resolution;

  vec2 refractedUV = (screenPx / u_resolution) + offset;
  vec3 color = sampleSceneBlurred(refractedUV, u_blur);

  vec2 lightDir = normalize(vec2(0.5, -0.7));
  float rimDot = abs(dot(grad, lightDir));
  float rimFalloff = 1.0 - smoothstep(0.0, bezel * 0.45, distFromEdge);
  float specHighlight = pow(max(rimDot * rimFalloff, 0.0), 1.5);
  color += vec3(specHighlight * u_specular);

  float innerShadow = 1.0 - smoothstep(0.0, bezel * 0.65, distFromEdge);
  color *= mix(1.0, 0.72, innerShadow * 0.3);

  float innerRim = smoothstep(0.0, 2.0, distFromEdge) * (1.0 - smoothstep(2.0, 5.0, distFromEdge));
  color += vec3(innerRim * 0.14 * u_specular);

  color = mix(color, vec3(1.0), u_tint);
  float alpha = smoothstep(0.0, 1.4, distFromEdge);
  return vec4(color, alpha);
}

void main() {
  vec3 base = texture(u_sceneTex, vUv).rgb;
  vec4 glass = glassLayer();
  fragColor = vec4(mix(base, glass.rgb, glass.a), 1.0);
}`
