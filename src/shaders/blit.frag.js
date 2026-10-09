export const BLIT_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = texture(uSource, vUv);
}
`
