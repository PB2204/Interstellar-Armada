#version 100

precision mediump float;
	
uniform lowp vec4 u_color;
	
void main() {
    gl_FragColor = u_color;
}