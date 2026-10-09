import { FULLSCREEN_TRIANGLE_VERTEX } from './fullscreen-triangle.vert.js'

/** CC-BY-NC-SA-4.0 — @WorkingClassHacker / @Frostbyte (Shadertoy community). */
export const discoSunBackgroundShader = {
  modeValue: 'DiscoSunVortex',
  displayLabel: 'Disco Sun Vortex',
  needsFeedback: false,
  vertexSource: FULLSCREEN_TRIANGLE_VERTEX,
  uniformNames: ['u_resolution', 'u_time', 'u_paletteVariant', 'u_paletteBase', 'u_paletteWave', 'u_shimmerScale'],
  fragmentSource: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_paletteVariant;
uniform float u_paletteBase;
uniform float u_paletteWave;
uniform float u_shimmerScale;
out vec4 fragColor;

#define R(a) mat2(cos(a + vec4(0.0, 33.0, 11.0, 0.0)))

vec3 palette(float t) {
  const vec3 a = vec3(0.50, 0.38, 0.26);
  const vec3 b = vec3(0.50, 0.35, 0.25);
  const vec3 c = vec3(1.00);
  const vec3 d = vec3(0.00, 0.12, 0.25);
  return a + b * cos(6.2831853 * (c * t + d));
}

vec3 palette2(float t) {
  const vec3 a = vec3(0.742702, 0.908877, 0.959831);
  const vec3 b = vec3(-0.711000, 0.275000, -0.052000);
  const vec3 c = vec3(1.000000, 1.855000, 1.000000);
  const vec3 d = vec3(0.180000, 0.091000, 0.380000);
  return a + b * cos(6.2831853 * (c * t + d));
}

void main() {
  vec2 u = gl_FragCoord.xy;
  vec2 uv = (u - 0.5 * u_resolution.xy + 0.5) / u_resolution.y;
  float t = mod(u_time, 6.283185);
  vec3 p = vec3(0.0);
  vec3 d = normalize(vec3(2.0 * u - u_resolution.xy, u_resolution.y));
  p.z = t;
  vec4 fc = vec4(0.0);
  float s;
  for (int k = 0; k < 20; k++) {
    p.xy *= R(-p.z * 0.01 - t * 0.05);
    s = 0.6;
    s = max(s, 4.0 * (-length(p.xy) + 10.0));
    s += abs(p.y * 0.004 + sin(t - p.x * 0.5) * 0.9 + 1.0);
    p += d * s;
    fc += 1.0 / (s * 0.2);
  }
  float palArg = length(p) / (abs(sin(u_time * 0.02) * u_paletteWave) + u_paletteBase);
  vec3 pal = u_paletteVariant != 0 ? palette2(palArg) : palette(palArg);
  fragColor = fc * vec4(pal, 1.0);
  fragColor -= u_shimmerScale * smoothstep(
    0.001,
    abs(sin(u_time * 5.0)),
    0.7 - length(sin(uv * 200.0) / 1.5) - abs(uv.y) + 0.2
  );
  fragColor /= 0.5e2;
  float l = length(uv);
  fragColor *= 1.2 - l;
  vec3 pm3 = u_paletteVariant != 0 ? palette2(l - 0.23) : palette(l - 0.23);
  vec4 pm4 = vec4(pm3, pm3.r);
  fragColor = mix(fragColor, pm4, 1.0 - smoothstep(0.01, 0.95, l));
  fragColor = vec4(tanh(fragColor.rgb + fragColor.rgb), 1.0);
}
`,
  applyUniforms (gl, u, c, w, h, time) {
    gl.uniform2f(u.u_resolution, w, h)
    gl.uniform1f(u.u_time, time)
    gl.uniform1i(u.u_paletteVariant, (c.SHADER_BACKGROUND_DISCO_PALETTE_VARIANT ?? 0) | 0)
    gl.uniform1f(u.u_paletteBase, Math.max(0.01, c.SHADER_BACKGROUND_DISCO_PALETTE_BASE ?? 6))
    gl.uniform1f(u.u_paletteWave, Math.max(0.01, c.SHADER_BACKGROUND_DISCO_PALETTE_WAVE ?? 50))
    gl.uniform1f(u.u_shimmerScale, Math.max(0, c.SHADER_BACKGROUND_DISCO_SHIMMER ?? 20))
  }
}
