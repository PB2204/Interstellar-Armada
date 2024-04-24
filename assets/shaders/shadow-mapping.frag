#version 100

#define DEPTH_TEXTURES 0

precision mediump float;

#if !DEPTH_TEXTURES
varying float v_depth;
#endif

void main() {
    #if !DEPTH_TEXTURES
    vec2 packedDepth = clamp(v_depth, 0.0, 1.0) * vec2(255.0, 255.0);
    packedDepth.x = fract(packedDepth.x);
    packedDepth.y = floor(packedDepth.y) / 255.0;
    gl_FragColor = vec4(0.0, 0.0, packedDepth);
    #endif
}