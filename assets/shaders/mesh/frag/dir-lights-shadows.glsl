    float diffuseFactor;
    float specularFactor;

    float lighted;
    float notCovered;
    vec3 shadowMapPosition;

    // the factor for how much the fragment needs to be shaded by the shadows
    // for the largest shadow map, add a fade out factor towards the end of the range
    float shade;

    float distFromEye = length(v_viewDir);

    // going through each static, directional light source
    // start and end indices need to be constant
    for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
        // only go through actual light sources
        if (i < u_numDirLights) {
            // how much is the fragment lighted based on angle
            diffuseFactor = max(0.0, dot(+u_dirLights[i].direction.xyz, normal));
            // how much is the fragment lighted based on shadows
            lighted = 0.0;
            // any calculations only need to be done if the fragment gets lit somewhat in the first place
            if (diffuseFactor > 0.0) {
                // start from not being obscured
                lighted = 1.0;
                // At each step, we only need to check for objects obscuring the current fragment
                // that lie outside of the scope of the previous check.
                // minimum depth of obscuring objects to check that are above the previously checked area
                float minDepthAbove = 0.0; 
                // maximum depth of obscuring objects to check that are below the previously checked area
                float maxDepthBelow = 1.0;
                // whether the projection of this fragment to the shadow map planes has already
                // fallen into the covered area
                notCovered = 1.0;
                float range = 0.0;
                float parallelism = u_dirLights[i].direction.w;
                // going through each shadow map (start and end indices need to be constant)
                for (int j = 0; j < MAX_SHADOW_MAP_RANGES; j++) {
                    // the range of the current shadow map (length of the area covered from center
                    // to the sides of the map in world coordinates)
                    range = u_shadowMapRanges[j];
                    float depthRange = range * SHADOW_MAP_DEPTH_RATIO;
                    // the coordinates in shadow mapping space translated to have the current map center in the origo
                    // an offset based on the normal vector of the surface is also applied to help eliminate shadow acne, which has a higher coefficient for surfaces more parallel to the light
                    float normalOffsetScale = NORMAL_OFFSET_SCALE / SHADOW_MAP_TEXTURE_SIZE;
                    // calculate texture coordinates on the current shadow map
                    shadowMapPosition = v_shadowMapPosition[i].xyz;
                    shadowMapPosition += normalize(v_shadowMapNormal[i]) * (normalOffsetScale * range * (-1.0 * diffuseFactor * diffuseFactor + 1.0));
                    // calculate texture coordinates on the current shadow map
                    highp float shMapDepthCoord = shadowMapPosition.z;

#include "lisptm.glsl"
                    vec4 temp = LiSPTM * vec4(shadowMapPosition.xy - vec2(0.0, parallelism * range + near), shMapDepthCoord - parallelism * range, 1.0);
                    shadowMapPosition = temp.xyz / temp.w;
                    shMapDepthCoord = shadowMapPosition.z;

                    // convert from -1.0;1.0 range to 0.0;1.0
                    vec2 shMapTexCoords = shadowMapPosition.xy * 0.5 + vec2(0.5, 0.5);
                    float depth = shMapDepthCoord * 0.5 + 0.5;
                    // only check the texture if we have valid coordinates for it
                    if (shMapTexCoords == clamp(shMapTexCoords, 0.0, 1.0)) {
                        shade = 1.0 - ifEqualInt(j, MAX_SHADOW_MAP_RANGES - 1) * clamp(
                                    max((abs(shadowMapPosition.x) - SHADOW_DISTANCE_FADEOUT_START) * SHADOW_DISTANCE_FADEOUT_FACTOR, 0.0) +
                                    max((abs(shadowMapPosition.y) - SHADOW_DISTANCE_FADEOUT_START) * SHADOW_DISTANCE_FADEOUT_FACTOR, 0.0) +
                                    clamp((abs(shMapDepthCoord) - SHADOW_DISTANCE_FADEOUT_START) * SHADOW_DISTANCE_FADEOUT_FACTOR, 0.0, 1.0),
                                0.0, 1.0);
                        highp vec4 shadowMapTexel[NUM_SHADOW_MAP_SAMPLES];
                        // read the value of the texel from the shadow map
                        // indexing samplers with loop variables is not supported by specification
                        int shMapIndex = i * MAX_SHADOW_MAP_RANGES + j;
                        for (int k = 0; k < NUM_SHADOW_MAP_SAMPLES; k++) {
                            vec2 shadowMapSampleOffset = v_shadowMapSampleOffsetTransform[i] * u_shadowMapSampleOffsets[k];
                            if (shMapIndex == 0) shadowMapTexel[k] = texture2D(u_shadowMaps[0], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 1) shadowMapTexel[k] = texture2D(u_shadowMaps[1], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 2) shadowMapTexel[k] = texture2D(u_shadowMaps[2], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 3) shadowMapTexel[k] = texture2D(u_shadowMaps[3], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 4) shadowMapTexel[k] = texture2D(u_shadowMaps[4], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 5) shadowMapTexel[k] = texture2D(u_shadowMaps[5], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 6) shadowMapTexel[k] = texture2D(u_shadowMaps[6], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 7) shadowMapTexel[k] = texture2D(u_shadowMaps[7], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 8) shadowMapTexel[k] = texture2D(u_shadowMaps[8], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 9) shadowMapTexel[k] = texture2D(u_shadowMaps[9], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 10) shadowMapTexel[k] = texture2D(u_shadowMaps[10], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 11) shadowMapTexel[k] = texture2D(u_shadowMaps[11], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 12) shadowMapTexel[k] = texture2D(u_shadowMaps[12], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 13) shadowMapTexel[k] = texture2D(u_shadowMaps[13], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            else if (shMapIndex == 14) shadowMapTexel[k] = texture2D(u_shadowMaps[14], shMapTexCoords + shadowMapSampleOffset / SHADOW_MAP_TEXTURE_SIZE);
                            // unpacking the depth value
                            #if !DEPTH_TEXTURES
                            float texelDepth = dot(shadowMapTexel[k].ba, vec2(1.0 / 255.0, 1.0));
                            #else
                            float texelDepth = 1.0 - shadowMapTexel[k].r;
                            #endif
                            // values for checking if the depth is in the area not covered by previous shadow maps
                            float absDepth = (texelDepth * 2.0 * depthRange) - (depthRange + shadowMapPosition.z);
                            float absErrorTolerance = 1.0 / 255.0 * depthRange;
                            // check if there is depth content on the texel, which is in a range not checked before
                            // (by depth or by coordinates)
                            lighted = max(0.0, lighted - 
                                min(1.0, ifGreater(texelDepth, max(depth + DEPTH_ERROR_TOLERANCE, 0.0)) * 
                                    (
                                        ifGreaterEqual(absDepth, minDepthAbove - absErrorTolerance) + 
                                        ifGreaterEqual(maxDepthBelow + absErrorTolerance, absDepth) + 
                                        notCovered)) * 
                                shade / float(NUM_SHADOW_MAP_SAMPLES));
                            if (lighted == 0.0) {
                                break;
                            }
                        }
                        if (lighted == 0.0) {
                            break;
                        }
                        // save the state that the XY position of this fragment has already been inside the
                        // area covered by a shadow map - but only after the previous state has been checked
                        notCovered = 0.0;
                    }
                    // set the variables to exclude the already checked depth region in the next step
                    minDepthAbove = -shadowMapPosition.z + depthRange;
                    maxDepthBelow = -shadowMapPosition.z - depthRange;
                }

                specularFactor = ifGreater(min(shininess, lighted), 0.0) * pow(max(dot(normal, normalize(u_dirLights[i].direction.xyz - viewDir)), 0.0), shininess);

                gl_FragColor.rgb += lighted *
                    vec3(
                        // the RGB components
                            clamp(
                            // diffuse light reflected for different light sources
                            u_dirLights[i].color * diffuseFactor
                            // clamp each component
                            , 0.0, 1.0)
                            // modulate with the colors from the vertices and the texture
                            // the above components cannot make the surface lighter then
                            // the modulated diffuse texture
                            * diffuseColor.rgb
                            // add specular lighting, this can make the surface "overlighted"
                            + specularFactor * u_dirLights[i].color * texSpec.rgb
                    );
            }
        }
    }