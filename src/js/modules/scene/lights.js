/**
 * @param vec Used for 3D (and 4D) vector operations.
 * @param mat Used for 3D (and 4D) matrix operations.
 * @param managedGL Used for handling managed framebuffers, creating uniform names, feature checking
 */
define([
    "utils/vectors",
    "utils/matrices",
    "modules/managed-gl"
], function (vec, mat, managedGL) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
            // the names of uniforms that light sources provide values for (these names will be pre/suffixed by ManagedGL)
            /**
             * When rendering a shadow map, the light matrix data will be loaded to the uniform with this name.
             * @type String
             */
            UNIFORM_LIGHT_MATRIX_NAME = "lightMatrix",
            /**
             * When rendering a shadow map, the shadow map parameters will be loaded to the uniform with this name.
             * @type String
             */
            UNIFORM_SHADOW_MAP_PARAMS_NAME = "shadowMapParams",
            /**
             * The near value to use for light space perspective shadow mapping, when the view is fully perpendicular to the light direction
             * @type Number
             */
            _lispsmMinimumNear = 10,
            /**
             * In light space perspective shadow mapping, when the view is not perpendicular to the light direction, the near value should be 
             * increased for weaker perspective effect. The increase is multiplied by this factor.
             * @type Number
             */
            _lispsmNearFactor = 100;
    // #########################################################################
    /**
     * Set up the general parameters to use for light space perspective shadow mapping from now on
     * @param {Number} minimumNear
     * @param {Number} nearFactor
     */
    function setupLiSPSM(minimumNear, nearFactor) {
        _lispsmMinimumNear = minimumNear;
        _lispsmNearFactor = nearFactor;
    }
    // #########################################################################
    /**
     * @typedef {Object} SceneGraph~DirectionalLightUniformData
     * @property {Number[3]} color
     * @property {Number[3]} direction
     * @property {Float32Array} matrix
     * @property {Float32Array} translationVector
     */
    /**
     * @class A simple directional light source that all objects in the scene will have access to and can cast shadows using a set of
     * shadow maps that have increasing spans around the camera position to provide higher resolution for objects close to the camera.
     * @param {Number[3]} color The color of the light the source emits.
     * @param {Number[3]} direction The direction this light source emits light FROM (the opposite of the direction of the light rays
     * themselves)
     */
    function DirectionalLightSource(color, direction) {
        /**
         * The color of the light the source emits.
         * @type Number[3]
         */
        this._color = color;
        /**
         * A unit vector indicating the direction this light source emits light FROM (the opposite of the direction of the light rays
         * themselves)
         * @type Number[3]
         */
        this._direction = vec.normal3(direction);
        /**
         * The inverse of the rotation matrix pointing towards this light source.
         * @type Float32Array
         */
        this._orientationMatrix = mat.inverseOfRotation4(mat.lookTowards4Aux(this._direction));
        /**
         * The matrix that transforms a world coordinate into a shadow map coordinate for this light source. Depends on the camera position,
         * but does not take into account that the actual center of the shadow map is in front of the camera, at different positions for
         * each range, so the resulting coordinates will have to be translated using a stored translation unit vector and the size of the
         * ranges.
         * @type Float32Array
         */
        this._baseMatrix = mat.identity4();
        /**
         * Whether the currently stored base matrix value is up-to-date.
         * @type Boolean
         */
        this._baseMatrixValid = false;
        /**
         * A cached value of the near value of the latest calculated LiSP transformation matrix
         * @type Number
         */
        this._near = 0;
        /**
         * A cached value of the far value of the latest calculated LiSP transformation matrix
         * @type Number
         */
        this._far = 0;
        /**
         * Stores the latest calculated LiSP transformation matrix
         * @type Float32Array
         */
        this._lispMatrix = mat.copy([
            1, 0, 0, 0,
            0, 1, 0, -1,
            0, 0, 1, 0,
            0, 0, 0, 0
        ]);
        /**
         * The prefix to use for creating frambuffer names for the shadow maps of different ranges for this light source.
         * @type String
         */
        this._shadowMapBufferNamePrefix = null;
        /**
         * The functions returning the values for the shader uniforms used for shadow mapping for this light source.
         * @type Object.<String, Function>
         */
        this._uniformValueFunctions = {};
        /**
         * Holds the data to be passed to the corresponding uniform struct.
         * @type SceneGraph~DirectionalLightUniformData
         */
        this._uniformData = {
            color: this._color,
            direction: [this._direction[0], this._direction[1], this._direction[2], 1], // fourth coordinate is parallelism
            matrix: this._baseMatrix
        };
        /**
         * Stores the values to be passed to the shadow mapping shader. Parallelism is how much is the view direction parallel to the light direction
         * (the cosine of their angle)
         * [range, depth, parallelism]
         * @type Number[3]
         */
        this._shadowMapParams = [0, 0, 1];
        // set uniform value functions
        this._uniformValueFunctions[managedGL.getUniformName(UNIFORM_LIGHT_MATRIX_NAME)] = function () {
            return this._baseMatrix;
        }.bind(this);
        this._uniformValueFunctions[managedGL.getUniformName(UNIFORM_SHADOW_MAP_PARAMS_NAME)] = function () {
            return this._shadowMapParams;
        }.bind(this);
    }
    /**
     * Returns the name of the shadow map framebuffer to use for rendering the shadow map of the range with the given index for this light source.
     * @param {Number} rangeIndex
     * @returns {String}
     */
    DirectionalLightSource.prototype.getShadowMapBufferName = function (rangeIndex) {
        return this._shadowMapBufferNamePrefix + rangeIndex.toString();
    };
    /**
     * Performs all necessary actions to prepare for rendering shadow maps for this light source using the passed context with the passed
     * parameters.
     * @param {ManagedGLContext} context The context to use for rendering shadow maps.
     * @param {Boolean} shadowMappingEnabled Whether shadow mapping is enabled for rendering.
     * @param {String} shadowMapBufferNamePrefix The prefix to use for creating frambuffer names for the shadow maps of different ranges for this light source.
     * @param {Number} numRanges The number of shadow map( range)s that will have to be rendered.
     * @param {Number} shadowMapTextureSize The size (width and height, in texels) that the shadow map framebuffers should have
     */
    DirectionalLightSource.prototype.addToContext = function (context, shadowMappingEnabled, shadowMapBufferNamePrefix, numRanges, shadowMapTextureSize) {
        var i, name, existingBuffer;
        this._shadowMapBufferNamePrefix = shadowMapBufferNamePrefix;
        if (shadowMappingEnabled) {
            for (i = 0; i < numRanges; i++) {
                name = this.getShadowMapBufferName(i);
                existingBuffer = context.getFrameBuffer(name);
                context.addFrameBuffer(
                        new managedGL.FrameBuffer(name, shadowMapTextureSize, shadowMapTextureSize, true),
                        existingBuffer && (existingBuffer.getWidth() !== shadowMapTextureSize));
            }
        }
    };
    /**
     * Call at the beginning of each render to clear stored values that refer to the state of the previous render.
     */
    DirectionalLightSource.prototype.reset = function () {
        this._baseMatrixValid = false;
    };
    /**
     * Updates the stored Light-Space Perspective transformation matrix according to the latest started shadow map
     * @returns {Float32Array}
     */
    DirectionalLightSource.prototype._updateLiSPMatrix = function () {
        var
                range = this._shadowMapParams[0],
                depth = this._shadowMapParams[1];
        this._near = (_lispsmNearFactor + range) * this._shadowMapParams[2] + _lispsmMinimumNear;
        this._far = 2.0 * range + this._near;
        this._lispMatrix[0] = this._far / range;
        this._lispMatrix[5] = (this._far + this._near) / (this._far - this._near);
        this._lispMatrix[10] = this._far / depth;
        this._lispMatrix[13] = 2.0 * this._far * this._near / (this._far - this._near);
    };
    /**
     * Returns whether an object specified by the passed transformation matrix and size should be rendered onto
     * the current (latest started) shadow map for this light
     * @param {Float32Array} modelMatrix
     * @param {Number} size
     * @returns {Boolean}
     */
    DirectionalLightSource.prototype.isInsideCurrentMap = function (modelMatrix, size) {
        var
                positionInLightSpace, x, y1, y2, z, w, wp,
                range = this._shadowMapParams[0],
                parallelism = this._shadowMapParams[2];
        size *= 0.5;
        // position / orientation transformation
        positionInLightSpace = vec.prodTranslationModel3Aux(modelMatrix, this._baseMatrix);
        // additional position transformation
        positionInLightSpace[1] -= parallelism * range + this._near;
        positionInLightSpace[2] = -positionInLightSpace[2] + parallelism * range;
        // perspective transformation (multiplying with the list matrix manually, only considering the non-zero elements)
        x = positionInLightSpace[0] * this._lispMatrix[0]; // left-right plane
        y1 = (positionInLightSpace[1] + size) * this._lispMatrix[5] + this._lispMatrix[13]; // far plane
        y2 = (positionInLightSpace[1] - size) * this._lispMatrix[5] + this._lispMatrix[13]; // near plane
        z = positionInLightSpace[2] * this._lispMatrix[10]; // top-bottom plane
        w = -positionInLightSpace[1];
        wp = Math.max(w, 0); // w-positive - for objects behind the projection point, w would be negative, indicating a negative (mirrored) frustum,
        // possibly resulting in false negative result when checking side planes, if part of the object is still in front of the
        // projection point:
        //
        // top down view on XY plane, field of view above 'p' projection point:
        //
        //   \     /
        //    \   /
        //     \^/   _
        //      p    |
        //     / \   |
        //    / |----o
        //   /     \
        //
        // object 'o' is behind projection point 'p', but it is still visible, yet it would fail the X coordinate check as at the
        // o point, the w will be even more negative (w will follow the frustum, the bottom-left / top-right diagonal line here)

        return (Math.abs(x) - size * this._lispMatrix[0] < wp) && // left-right plane
                ((y1 > 0) || (y1 > -(w - size))) && // far plane (w is calculated for y1 by also negating the added size)
                ((y2 < 0) || (y2 < (w + size))) && // near plane (w is calculated for y2 by also negating the subtracted size)
                (Math.abs(z) - size * this._lispMatrix[10] < wp); // top-bottom plane
    };
    /**
     * Performs all actions necesary to set up the passed context for rendering the shadow map of the given range for this light source.
     * Assumes that an appropriate shadow mapping shader is already bound (since that would be the same for the different ranges and light
     * sources)
     * @param {ManagedGLContext} context The context to set up for shadow map rendering.
     * @param {Camera} camera The camera used for the rendering (since the positions of the shadow maps in the world depend on it)
     * @param {Number} rangeIndex The index of the shadow map range that is to be rendered
     * @param {Number} range The range of this shadow map (the size of the shadow map area on axes X and Y)
     * @param {Number} depth The depth of this shadow map (the size of the shadow map area on axis Z)
     */
    DirectionalLightSource.prototype.startShadowMap = function (context, camera, rangeIndex, range, depth) {
        var viewDir, cos;
        context.setCurrentFrameBuffer(this.getShadowMapBufferName(rangeIndex));
        viewDir = vec.getRowC43Aux(camera.getCameraOrientationMatrix());
        cos = Math.abs(vec.dot3(viewDir, this._direction)); // parallelism, which will determine the amount of perspective transformation
        this._shadowMapParams[0] = range;
        this._shadowMapParams[1] = depth;
        this._shadowMapParams[2] = cos;
        // this will be the matrix that transforms a world-space coordinate into shadow-space coordinate for this particular shadow map
        // (not counting the light-space perspective transform)
        if (!this._baseMatrixValid) {
            // up vector on shadow map is aligned with camera view direction, so as a result with the perspective transform
            mat.setInverseOfRotation4(this._orientationMatrix, mat.lookTowards4Aux(this._direction, viewDir));
            mat.setProdTranslationRotation4(this._baseMatrix, camera.getInversePositionMatrix(), this._orientationMatrix);
            this._baseMatrixValid = true;
        }
        this._uniformData.direction[3] = cos;
        this._updateLiSPMatrix();
        context.getCurrentShader().assignUniforms(context, this._uniformValueFunctions);
    };
    /**
     * Returns an object that can be used to set the uniform object representing this light source in a shader using it.
     * @returns {SceneGraph~DirectionalLightUniformData}
     */
    DirectionalLightSource.prototype.getUniformData = function () {
        return this._uniformData;
    };
    // #########################################################################
    /**
     * @typedef {Object} PointLightSource~LightState
     * @property {Number[3]} color
     * @property {Number} intensity
     * @property {Number} timeToReach
     */
    /**
     * @typedef {Object} SceneGraph~PointLightUniformData
     * @property {Number[4]} color The RGB color and the intensity of the light.
     * @property {Number[3]} position
     */
    /**
     * @class Represents a point-like light source that can be bound to one or more object in a scene, following their position.
     * @param {Number[3]} color The color of the light emitted by this source.
     * @param {Number} intensity The intensity of the light - the level of lighting for point light sources depends on the distance
     * from the illuminated object, and it will be multiplied by this factor. This value corresponds by the intensity emitted by one of the
     * objects, the total intensity will be multiplied by the total number of objects participating in this light source.
     * @param {Number[3]} positionVector The position of the light source - if there is no specific object emitting it, then relative to the
     * scene origo, if there is one specific object, then relative to that object, and if there are multiple object, this value is not 
     * considered.
     * @param {RenderableObject3D[]} emittingObjects The list of objects that together emit this light source. Needs to have at least
     * one object, and if multiple objects are specified, the light will be positioned at the average position of those objects. In this case, 
     * all objects will be considered to contribute the same amount of intensity of the same color.
     * @param {PointLightSource~LightState[]} [states] The list of states this light source should go through, if a dynamic behavior is
     * desired.
     * @param {Boolean} [looping] If states are given, this parameter tells whether to loop through them, starting over once the last
     * state is reached, or just stay in it.
     */
    function PointLightSource(color, intensity, positionVector, emittingObjects, states, looping) {
        /**
         * The intensity of light emitted by one object
         * @type Number
         */
        this._objectIntensity = intensity;
        /**
         * The position vector of this light source relative to the scene, if there are no emitting objects, and relative to the emitting 
         * object, if there is one. If there are multiple objects, this value is not considered.
         * @type Number[3]
         */
        this._relativePositionVector = positionVector;
        /**
         * Stores the calculated value of whether this point light has a non-zero relative position set, because position calculation can
         * be much simpler then.
         * @type Boolean
         */
        this._hasRelativePosition = (positionVector && ((positionVector[0] !== 0) || (positionVector[1] !== 0) || (positionVector[2] !== 0)));
        /**
         * The list of all objects acting together as this light source. Needs to have at least one element.
         * @type RenderableObject3D[]
         */
        this._emittingObjects = emittingObjects;
        /**
         * Stores the calculated value of whether this light has exactly one emitting object set, because some calculations can be simpler if so.
         * @type Boolean
         */
        this._singleEmittingObject = (!!emittingObjects && (emittingObjects.length === 1));
        /**
         * The calculated position vector of this light source in world-space.
         * @type Number[3]
         */
        this._positionVector = [0, 0, 0];
        /**
         * The list of states (storing the values for attributes like color and intensity) this light source will go through.
         * Should have at least two elements.
         * If it is not given, the light source will have a static state.
         * @type PointLightSource~LightState[]
         */
        this._states = states;
        /**
         * The time elapsed since transitioning to the current state, in milliseconds.
         * @type Number
         */
        this._timeSinceLastTransition = 0;
        /**
         * The index of the current state the light source is in - it might be transitioning already to the next state, in which case its
         * actual attributes will be determined as a combination of the ones defined in these two states.
         * @type Number
         */
        this._currentStateIndex = 0;
        /**
         * If this light source has states, whether to start over after reaching the last one.
         * @type Boolean
         */
        this._looping = looping;
        /**
         * A cached value of the color vector to be assigned to uniforms (containing the RGB color and the intensity)
         * @type Number[4]
         */
        this._uniformColor = [color[0], color[1], color[2], intensity * (emittingObjects ? emittingObjects.length : 1)];
        /**
         * Holds the data to be passed to the corresponding uniform struct.
         * @type SceneGraph~PointLightUniformData
         */
        this._uniformData = {
            color: this._uniformColor,
            position: this._positionVector
        };
    }
    /**
     * Returns whether the light is currently visible in the scene (it has at least one visible emitting object)
     * @returns {Boolean}
     */
    PointLightSource.prototype.isVisible = function () {
        var i;
        if (this._singleEmittingObject) {
            return this._emittingObjects[0].isVisible();
        }
        for (i = 0; i < this._emittingObjects.length; i++) {
            if (this._emittingObjects[i] && !this._emittingObjects[i].canBeReused() && this._emittingObjects[i].isVisible()) {
                return true;
            }
        }
        return false;
    };
    /**
     * Updates the properties of the light source that are defined in the state list.
     * @param {Number} dt The elapsed time since the last update, in milliseconds.
     */
    PointLightSource.prototype.updateState = function (dt) {
        var nextStateIndex, stateProgress;
        if (this._states && (dt > 0)) {
            this._timeSinceLastTransition += dt;
            // find out which state did we arrive to and which is next
            nextStateIndex = (this._currentStateIndex + 1) % this._states.length;
            while (this._timeSinceLastTransition > this._states[nextStateIndex].timeToReach) {
                if ((nextStateIndex === 0) && (!this._looping)) {
                    nextStateIndex = this._states.length - 1;
                    this._timeSinceLastTransition = this._states[nextStateIndex].timeToReach;
                    break;
                }
                this._timeSinceLastTransition -= this._states[nextStateIndex].timeToReach;
                nextStateIndex = (nextStateIndex + 1) % this._states.length;
            }
            this._currentStateIndex = (nextStateIndex === 0) ? (this._states.length - 1) : (nextStateIndex - 1);
            // calculate the relative progress
            stateProgress = this._timeSinceLastTransition / this._states[nextStateIndex].timeToReach;
            this.setObjectIntensity(this._states[this._currentStateIndex].intensity * (1.0 - stateProgress) + this._states[nextStateIndex].intensity * stateProgress);
            this.setColor(vec.sum3Aux(
                    vec.scaled3Aux(this._states[this._currentStateIndex].color, 1.0 - stateProgress),
                    vec.scaled3Aux(this._states[nextStateIndex].color, stateProgress)));
        }
    };
    /**
     * Updates the properties of the light source based on the status of the emitting objects and the current state of the light source.
     * @param {Number} dt The time elapsed since the last update, in milliseconds
     */
    PointLightSource.prototype.update = function (dt) {
        var i, count;
        this.updateState(dt);
        // calculate attributes that depend on the emitting objects
        if (this._singleEmittingObject) {
            this._uniformColor[3] = this._objectIntensity;
            this._emittingObjects[0].copyPositionToVector(this._positionVector);
            if (this._hasRelativePosition) {
                vec.add3(this._positionVector, vec.prodVec3Mat4Aux(this._relativePositionVector, mat.prod3x3SubOf4Aux(this._emittingObjects[0].getCascadeScalingMatrix(), this._emittingObjects[0].getOrientationMatrix())));
            }
        } else {
            vec.setNull3(this._positionVector);
            count = 0;
            for (i = 0; i < this._emittingObjects.length; i++) {
                if (this._emittingObjects[i] && !this._emittingObjects[i].canBeReused() && this._emittingObjects[i].isVisible()) {
                    this._emittingObjects[i].addPositionToVector(this._positionVector);
                    count++;
                }
            }
            if (count > 1) {
                this._positionVector[0] /= count;
                this._positionVector[1] /= count;
                this._positionVector[2] /= count;
            }
            this._uniformColor[3] = this._objectIntensity * count;
        }
    };
    /**
     * Returns an object that can be used to set the uniform object representing this light source in a shader using it.
     * @returns {SceneGraph~PointLightUniformData}
     */
    PointLightSource.prototype.getUniformData = function () {
        return this._uniformData;
    };
    /**
     * Returns whether this light source object can be reused as the light source it represents is not needed anymore (all its emitting
     * objects have been deleted)
     * @returns {Boolean}
     */
    PointLightSource.prototype.canBeReused = function () {
        var i;
        if (this._singleEmittingObject) {
            return this._emittingObjects[0].canBeReused();
        }
        for (i = 0; i < this._emittingObjects.length; i++) {
            if (this._emittingObjects[i] && !this._emittingObjects[i].canBeReused()) {
                return false;
            }
        }
        return true;
    };
    /**
     * Sets a new color for the light emitted by this source.
     * @param {Number[3]} value
     */
    PointLightSource.prototype.setColor = function (value) {
        this._uniformColor[0] = value[0];
        this._uniformColor[1] = value[1];
        this._uniformColor[2] = value[2];
    };
    /**
     * Sets a new intensity for the light emitted by the objects contributing to this light source.
     * @param {Number} value
     */
    PointLightSource.prototype.setObjectIntensity = function (value) {
        this._objectIntensity = value;
    };
    /**
     * Adds a new emitting object to the ones contributing to this light source. All objects should be of the same type (color and intensity)
     * @param {RenderableObject3D} emittingObject
     */
    PointLightSource.prototype.addEmittingObject = function (emittingObject) {
        this._emittingObjects.push(emittingObject);
        this._singleEmittingObject = (this._emittingObjects.length === 1);
    };
    /**
     * Returns whether the light source should be considered for rendering if the passed camera is used.
     * @param {Camera} camera
     * @returns {Boolean}
     */
    PointLightSource.prototype.shouldBeRendered = function (camera) {
        var viewMatrix = camera.getViewMatrix();
        // calculating the Z position in camera space by multiplying the world space position vector with the view matrix (only the applicable parts)
        return (this._uniformColor[3] > 0) && ((this._positionVector[0] * viewMatrix[2] + this._positionVector[1] * viewMatrix[6] + this._positionVector[2] * viewMatrix[10] + viewMatrix[14]) < this._uniformColor[3]);
    };
    /**
     * Sets the animation state of the light source to be the one occuring after the passed amount of time from the start
     * @param {Number} elapsedTime In milliseconds
     */
    PointLightSource.prototype.setAnimationTime = function (elapsedTime) {
        this._timeSinceLastTransition = 0;
        this._currentStateIndex = 0;
        this.updateState(elapsedTime);
    };
    // #########################################################################
    /**
     * @typedef {SceneGraph~PointLightUniformData} SceneGraph~SpotLightUniformData
     * @property {Number[4]} color The RGB color and the intensity of the light.
     * @property {Number[4]} spot The spot direction (XYZ) and the cutoff angle cosine
     * @property {Number[4]} position The position in world-space (XYZ) and the full intensity angle cosine (or zero)
     */
    /**
     * @class A directed point-like light source.
     * @param {Number[3]} color The color of the light emitted by this source.
     * @param {Number} intensity The intensity of the light - the level of lighting for point light sources depends on the distance
     * from the illuminated object, and it will be multiplied by this factor.
     * @param {Number[3]} positionVector The position of the light source relative to the object.
     * @param {Number[3]} spotDirection The (relative) direction in which the light cone of this light source is pointed. If there is one
     * emitting object, the direction will be relative to the orientation of that object, otherwise it will be taken as absolute.
     * @param {Number} spotCutoffAngle Light will not be emitted in directions with angles larger than this to the primary spot direction.
     * In degrees.
     * @param {Number} spotFullIntensityAngle Light will be emitted at full intensity only in direction with angles smaller than this to the
     * primary direction. Between this and the cutoff angle, the intensity will transition to zero. If this is larger than the cutoff angle,
     * light will be emitted with full intensity everywhere within the cutoff angle. In degrees.
     * @param {RenderableObject3D} emittingObject The object emitting the spot light.
     */
    function SpotLightSource(color, intensity, positionVector, spotDirection, spotCutoffAngle, spotFullIntensityAngle, emittingObject) {
        /**
         * Whether the spot light is turned on and emitting.
         * @type Boolean
         */
        this._visible = true;
        /**
         * The array storing the color and intensity values to be passed to the shaders.
         * @type Number[4]
         */
        this._uniformColor = [color[0], color[1], color[2], intensity];
        /**
         * The position of the light source relative to the emitting object.
         * @type Number[3]
         */
        this._relativePositionVector = positionVector;
        /**
         * The calculated position of the light source in world space.
         * The 4th coordinate is the cosine of the full intensity angle (zero if there if full intensity needs to be applied everywhere)
         * @type Number[4]
         */
        this._positionVector = [0, 0, 0, (spotFullIntensityAngle < spotCutoffAngle) ? Math.cos(Math.radians(spotFullIntensityAngle)) : 0];
        /**
         * The (relative) direction in which the light cone of this light source is pointed.
         * The direction will be relative to the orientation of the emitting object.
         * @type Number[3]
         */
        this._relativeSpotDirection = spotDirection;
        /**
         * The object emitting the light.
         * @type RenderableObject3D
         */
        this._emittingObject = emittingObject;
        /**
         * Holds the data to be passed to the corresponding uniform struct.
         * @type SceneGraph~StopLightUniformData
         */
        this._uniformData = {
            color: this._uniformColor,
            position: this._positionVector,
            // The 4th coordinate is the cosine of the cutoff angle.
            spot: [0, 0, 0, Math.cos(Math.radians(spotCutoffAngle))]
        };
    }
    /**
     * Returns whether the light is currently visible in the scene
     * @returns {Boolean}
     */
    SpotLightSource.prototype.isVisible = function () {
        return this._visible && this._emittingObject.isVisible();
    };
    /**
     * Updates the properties of the light source based on the status of the emitting object.
     */
    SpotLightSource.prototype.update = function () {
        // calculate attributes that depend on the emitting object
        this._emittingObject.copyPositionToVector(this._positionVector);
        vec.add3(this._positionVector, vec.prodVec3Mat4Aux(this._relativePositionVector, mat.prod3x3SubOf4Aux(this._emittingObject.getCascadeScalingMatrix(), this._emittingObject.getOrientationMatrix())));
        vec.setProdVec3Mat4(this._uniformData.spot, this._relativeSpotDirection, this._emittingObject.getOrientationMatrix());
    };
    /**
     * @returns {SceneGraph~SpotLightUniformData}
     */
    SpotLightSource.prototype.getUniformData = function () {
        return this._uniformData;
    };
    /**
     * Returns whether this light source object can be reused as the light source it represents is not needed anymore (its emitting
     * object has been deleted)
     * @returns {Boolean}
     */
    SpotLightSource.prototype.canBeReused = function () {
        return this._emittingObject.canBeReused();
    };
    /**
     * Returns whether the light source should be considered for rendering if the passed camera is used.
     * @param {Camera} camera
     * @returns {Boolean}
     */
    SpotLightSource.prototype.shouldBeRendered = function (camera) {
        var viewMatrix = camera.getViewMatrix();
        // calculating the Z position in camera space by multiplying the world space position vector with the view matrix (only the applicable parts)
        return ((this._positionVector[0] * viewMatrix[2] + this._positionVector[1] * viewMatrix[6] + this._positionVector[2] * viewMatrix[10] + viewMatrix[14]) < this._uniformColor[3]);
    };
    /**
     * Causes the light source to not be rendered (isVisible() and shouldBeRendered() to be false) and its position not be updated
     */
    SpotLightSource.prototype.hide = function () {
        this._visible = false;
    };
    /**
     * Restores the default visibility state of the light source (where rendering depends on camera frustum and current intensity)
     */
    SpotLightSource.prototype.show = function () {
        this._visible = true;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        setupLiSPSM: setupLiSPSM,
        DirectionalLightSource: DirectionalLightSource,
        PointLightSource: PointLightSource,
        SpotLightSource: SpotLightSource
    };
});