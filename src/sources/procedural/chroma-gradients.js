import { FULLSCREEN_TRIANGLE_VERTEX } from './fullscreen-triangle.vert.js'
import { SIMPLEX_NOISE_3D_GLSL } from './simplex-noise-3d.js'

/** Shadertoy-style chroma gradient field (community pattern). */
export const chromaGradientsBackgroundShader = {
  modeValue: 'ChromaGradients',
  displayLabel: 'Chroma gradients',
  needsFeedback: false,
  vertexSource: FULLSCREEN_TRIANGLE_VERTEX,
  uniformNames: [
    'u_resolution', 'u_time', 'u_noiseTimeScale', 'u_noiseUvScale',
    'u_fineNoiseScale', 'u_grainMix', 'u_colorA', 'u_colorB',
    'u_colorAMul', 'u_colorBMul', 'u_mixClampMin', 'u_mixClampMax',
    'u_layer1S', 'u_layer2S', 'u_layer1Z', 'u_layer2Z'
  ],
  fragmentSource: `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_noiseTimeScale;
uniform float u_noiseUvScale;
uniform float u_fineNoiseScale;
uniform float u_grainMix;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_colorAMul;
uniform float u_colorBMul;
uniform float u_mixClampMin;
uniform float u_mixClampMax;
uniform float u_layer1S;
uniform float u_layer2S;
uniform float u_layer1Z;
uniform float u_layer2Z;
out vec4 fragColor;

${SIMPLEX_NOISE_3D_GLSL}

float N(vec2 uv, float o) {
  float t = (u_time + o) * u_noiseTimeScale;
  float n = snoise(vec3(uv.x * u_noiseUvScale + t, uv.y * u_noiseUvScale - t, t));
  return snoise(vec3(n * 0.2, n * 0.7, t * 0.1));
}

float cLayer(vec2 uv, float n, float s, float z) {
  return smoothstep(smoothstep(0.1, s, length(uv)), 0.0, length(uv * vec2(z * 0.8, z) + n * 0.3) - 0.3);
}

void main() {
  vec2 I = gl_FragCoord.xy;
  vec2 uv = (I - 0.5 * u_resolution.xy) / u_resolution.y;
  float c1 = cLayer(uv, N(uv * 0.6, 1.0), u_layer1S, u_layer1Z);
  float c2 = cLayer(uv, N(uv * 0.5, 3.0), u_layer2S, u_layer2Z);
  float n = u_grainMix * snoise(vec3(uv * u_fineNoiseScale, u_time * 0.2));
  vec3 colOut = mix(
    vec3(n * 0.1 + 0.9),
    vec3(n) + mix(u_colorA * u_colorAMul, u_colorB * u_colorBMul, clamp(c1 - c2, u_mixClampMin, u_mixClampMax)),
    clamp(c1 + c2, 0.0, 1.0)
  );
  fragColor = vec4(colOut, 1.0);
}
`,
  applyUniforms (gl, u, c, w, h, time) {
    gl.uniform2f(u.u_resolution, w, h)
    gl.uniform1f(u.u_time, time)
    gl.uniform1f(u.u_noiseTimeScale, c.SHADER_BACKGROUND_CHROMA_NOISE_TIME_SCALE ?? 0.2)
    gl.uniform1f(u.u_noiseUvScale, c.SHADER_BACKGROUND_CHROMA_NOISE_UV_SCALE ?? 0.9)
    gl.uniform1f(u.u_fineNoiseScale, c.SHADER_BACKGROUND_CHROMA_FINE_NOISE_SCALE ?? 300)
    gl.uniform1f(u.u_grainMix, c.SHADER_BACKGROUND_CHROMA_GRAIN_MIX ?? 0.08)
    const ca = c.SHADER_BACKGROUND_CHROMA_COLOR_A || { r: 1, g: 0.5, b: 0 }
    const cb = c.SHADER_BACKGROUND_CHROMA_COLOR_B || { r: 0.75, g: 0.3, b: 1 }
    gl.uniform3f(u.u_colorA, ca.r, ca.g, ca.b)
    gl.uniform3f(u.u_colorB, cb.r, cb.g, cb.b)
    gl.uniform1f(u.u_colorAMul, c.SHADER_BACKGROUND_CHROMA_COLOR_A_MUL ?? 1.3)
    gl.uniform1f(u.u_colorBMul, c.SHADER_BACKGROUND_CHROMA_COLOR_B_MUL ?? 0.9)
    gl.uniform1f(u.u_mixClampMin, c.SHADER_BACKGROUND_CHROMA_MIX_CLAMP_MIN ?? -0.14)
    gl.uniform1f(u.u_mixClampMax, c.SHADER_BACKGROUND_CHROMA_MIX_CLAMP_MAX ?? 0.9)
    gl.uniform1f(u.u_layer1S, c.SHADER_BACKGROUND_CHROMA_LAYER1_S ?? 1.2)
    gl.uniform1f(u.u_layer2S, c.SHADER_BACKGROUND_CHROMA_LAYER2_S ?? 1.5)
    gl.uniform1f(u.u_layer1Z, c.SHADER_BACKGROUND_CHROMA_LAYER1_Z ?? 1.1)
    gl.uniform1f(u.u_layer2Z, c.SHADER_BACKGROUND_CHROMA_LAYER2_Z ?? 1.4)
  }
}
