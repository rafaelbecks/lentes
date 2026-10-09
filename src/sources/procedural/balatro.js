import { FULLSCREEN_TRIANGLE_VERTEX } from './fullscreen-triangle.vert.js'

/** Balatro-style background; original game by localthunk (https://www.playbalatro.com). */
export const balatroBackgroundShader = {
  modeValue: 'Balatro',
  displayLabel: 'Balatro',
  needsFeedback: false,
  vertexSource: FULLSCREEN_TRIANGLE_VERTEX,
  uniformNames: [
    'u_resolution', 'u_time', 'u_spinRotation', 'u_spinSpeed', 'u_offset',
    'u_colour1', 'u_colour2', 'u_colour3', 'u_contrast', 'u_lighting',
    'u_spinAmount', 'u_pixelFilter', 'u_spinEase', 'u_isRotate'
  ],
  fragmentSource: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_spinRotation;
uniform float u_spinSpeed;
uniform vec2 u_offset;
uniform vec4 u_colour1;
uniform vec4 u_colour2;
uniform vec4 u_colour3;
uniform float u_contrast;
uniform float u_lighting;
uniform float u_spinAmount;
uniform float u_pixelFilter;
uniform float u_spinEase;
uniform bool u_isRotate;
out vec4 fragColor;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
  float pixel_size = length(screenSize.xy) / max(u_pixelFilter, 1.0);
  vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - u_offset;
  float uv_len = length(uv);
  float speed = (u_spinRotation * u_spinEase * 0.2);
  if (u_isRotate) {
    speed = u_time * speed;
  }
  speed += 302.2;
  float new_pixel_angle = atan(uv.y, uv.x) + speed - u_spinEase * 20.0 * (1.0 * u_spinAmount * uv_len + (1.0 - 1.0 * u_spinAmount));
  vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
  uv = vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid;
  uv *= 30.0;
  speed = u_time * u_spinSpeed;
  vec2 uv2 = vec2(uv.x + uv.y);
  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121), sin(uv2.x - 0.113 * speed));
    uv -= 1.0 * cos(uv.x + uv.y) - 1.0 * sin(uv.x * 0.711 - uv.y);
  }
  float contrast_mod = (0.25 * u_contrast + 0.5 * u_spinAmount + 1.2);
  float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
  float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
  float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (u_lighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + u_lighting * max(c2p * 5.0 - 4.0, 0.0);
  return (0.3 / u_contrast) * u_colour1 + (1.0 - 0.3 / u_contrast) * (u_colour1 * c1p + u_colour2 * c2p + vec4(c3p * u_colour3.rgb, c3p * u_colour1.a)) + light;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / u_resolution.xy;
  fragColor = effect(u_resolution.xy, uv * u_resolution.xy);
}
`,
  applyUniforms (gl, u, c, w, h, time) {
    gl.uniform2f(u.u_resolution, w, h)
    gl.uniform1f(u.u_time, time)
    gl.uniform1f(u.u_spinRotation, c.SHADER_BACKGROUND_BALATRO_SPIN_ROTATION ?? -2)
    gl.uniform1f(u.u_spinSpeed, c.SHADER_BACKGROUND_BALATRO_SPIN_SPEED ?? 7)
    gl.uniform2f(u.u_offset, c.SHADER_BACKGROUND_BALATRO_OFFSET_X ?? 0, c.SHADER_BACKGROUND_BALATRO_OFFSET_Y ?? 0)
    const pick = (k, def) => c[k] || def
    const c1 = pick('SHADER_BACKGROUND_BALATRO_COLOR_1', { r: 0.871, g: 0.267, b: 0.231 })
    const c2 = pick('SHADER_BACKGROUND_BALATRO_COLOR_2', { r: 0, g: 0.42, b: 0.706 })
    const c3 = pick('SHADER_BACKGROUND_BALATRO_COLOR_3', { r: 0.086, g: 0.137, b: 0.145 })
    gl.uniform4f(u.u_colour1, c1.r, c1.g, c1.b, 1)
    gl.uniform4f(u.u_colour2, c2.r, c2.g, c2.b, 1)
    gl.uniform4f(u.u_colour3, c3.r, c3.g, c3.b, 1)
    gl.uniform1f(u.u_contrast, Math.max(0.1, c.SHADER_BACKGROUND_BALATRO_CONTRAST ?? 3.5))
    gl.uniform1f(u.u_lighting, c.SHADER_BACKGROUND_BALATRO_LIGHTING ?? 0.4)
    gl.uniform1f(u.u_spinAmount, c.SHADER_BACKGROUND_BALATRO_SPIN_AMOUNT ?? 0.25)
    gl.uniform1f(u.u_pixelFilter, Math.max(1, c.SHADER_BACKGROUND_BALATRO_PIXEL_FILTER ?? 745))
    gl.uniform1f(u.u_spinEase, c.SHADER_BACKGROUND_BALATRO_SPIN_EASE ?? 1)
    gl.uniform1i(u.u_isRotate, c.SHADER_BACKGROUND_BALATRO_IS_ROTATE ? 1 : 0)
  }
}
