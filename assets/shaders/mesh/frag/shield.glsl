    gl_FragColor.rgb = mix(gl_FragColor.rgb, u_shieldState.rgb, sin(u_shieldState.a * 3.1415) * (1.0 - 0.85*max(0.0,dot(-viewDir,normal))) * fract(sin(0.2 * u_shieldState.a * (texCol.r + texCol.g + texCol.b))*16.0));