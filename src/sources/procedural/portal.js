import { FULLSCREEN_TRIANGLE_VERTEX } from './fullscreen-triangle.vert.js'

export const portalBackgroundShader = {
  modeValue: 'Portal',
  displayLabel: 'Portal',
  needsFeedback: false,
  vertexSource: FULLSCREEN_TRIANGLE_VERTEX,
  uniformNames: ['u_resolution', 'u_time', 'u_timeOffset', 'u_timeDivisor', 'u_brightness'],
  fragmentSource: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_timeOffset;
uniform float u_timeDivisor;
uniform float u_brightness;
out vec4 fragColor;

const float PI = 3.14159265359;

float uT;
float sintime(float lowerBound, float upperBound, float offset) {
  return mix(lowerBound, upperBound, (sin(uT * PI * 2.0 + offset) * 0.5 + 0.5));
}

mat2 g(float a) {
  return mat2(cos(a), -sin(a), sin(a), cos(a));
}

void main() {
  uT = (u_time + u_timeOffset) / max(u_timeDivisor, 0.001);
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
  vec3 finalColor;
  vec2 uv0 = uv;
  uv = fract(abs(uv) * (6.4 + sintime(-3.0, 1.0, 0.0))) - 0.5;
  for (int c = 0; c < 3; c++) {
    float dst = 1e6;
    for (float j = -1.0; j <= 1.0; j++) {
      for (float i = -1.0; i <= 1.0; i++) {
        vec2 nuv = uv + vec2(i, j);
        float l = length(nuv);
        float ma = l + sintime(-1.0, 1.0, l);
        float ic = l * length(uv0) * sintime(-1.0, 1.0, 0.0) * 14.0 + uT * ma * 0.05 + float(c) * 0.5 * sintime(0.1, 1.0, PI);
        nuv = nuv * ma * g(ic) + vec2(sintime(-0.4, 0.8, 0.0), sintime(-0.4, 0.8, PI / 2.0));
        dst = min(dst, length(nuv));
      }
    }
    uv += dst * sintime(0.0, 0.08, 0.0);
    finalColor[c] = u_brightness / max(dst, 1e-5);
  }
  fragColor = vec4(finalColor, 1.0);
}
`,
  applyUniforms (gl, u, c, w, h, time) {
    gl.uniform2f(u.u_resolution, w, h)
    gl.uniform1f(u.u_time, time)
    gl.uniform1f(u.u_timeOffset, c.SHADER_BACKGROUND_PORTAL_TIME_OFFSET ?? 4)
    gl.uniform1f(u.u_timeDivisor, Math.max(0.001, c.SHADER_BACKGROUND_PORTAL_TIME_DIVISOR ?? 15))
    gl.uniform1f(u.u_brightness, c.SHADER_BACKGROUND_PORTAL_BRIGHTNESS ?? 0.15)
  }
}
