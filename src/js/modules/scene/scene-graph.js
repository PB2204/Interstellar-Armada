/**
 * @param utils Used for shallow copying
 * @param types Used for type checking.
 * @param vec Used for 3D vector operations.
 * @param mat Used for 3D (and 4D) matrix operations.
 * @param application Used for displaying errors and logging (and intentional crashing)
 * @param managedGL Used for handling managed framebuffers, creating uniform names, feature checking
 * @param egomModel Used for debug stats management
 * @param containers Used for linked lists
 * @param camera Used for creating default cameras for scenes
 * @param renderableObjects Used to create container nodes and for accessing render queue bits
 */
define([
    "utils/utils",
    "utils/types",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl",
    "modules/egom-model",
    "modules/containers",
    "modules/scene/camera",
    "modules/scene/renderable-objects"
], function (utils, types, vec, mat, application, managedGL, egomModel, containers, camera, renderableObjects) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
            /**
             * The bits to use when putting objects into render queues
             */
            RENDER_QUEUE_FRONT_BIT = renderableObjects.RENDER_QUEUE_FRONT_BIT,
            RENDER_QUEUE_DISTANCE_BIT = renderableObjects.RENDER_QUEUE_DISTANCE_BIT,
            /**
             * For new LOD contexts, this will be the default value for the reference size
             * @type Number
             */
            DEFAULT_LOD_REFERENCE_SIZE = 100,
            /**
             * For new LOD contexts, this wil be the default value for the minimum relative size
             * @type Number
             */
            DEFAULT_LOD_MINIMUM_RELATIVE_SIZE = 0.05,
            // the raw names of uniforms using which the various renderable object classes make their properties available to shaders
            // the actual shader uniform names are created by ManagedGL, using these names as a basis, and adding the appropriate prefixes/suffixes
            /**
             * When creating a shadow map framebuffer, this prefix will be added before the light index for which it is created.
             * @type String
             */
            SHADOW_MAP_BUFFER_NAME_PREFIX = "shadow-map-buffer-",
            /**
             * When creating a shadow map framebuffer, this infix will be added in between the indices of the light and the shadow map range
             * for which it is created.
             * @type String
             */
            SHADOW_MAP_BUFFER_NAME_INFIX = "-",
            /**
             * The number of available priorities with which new point light sources can be added. If set to e.g. 5, the available priorities
             * will be 0 to 4
             * @type Number
             */
            MAX_POINT_LIGHT_PRIORITIES = 5,
            // the names of uniforms that scenes provide values for (these names will be pre/suffixed by ManagedGL)
            /**
             * @type String
             */
            UNIFORM_AMBIENT_COLOR_NAME = "ambientColor",
            UNIFORM_NUM_DIRECTIONAL_LIGHTS_NAME = "numDirLights",
            UNIFORM_DIRECTIONAL_LIGHTS_ARRAY_NAME = "dirLights",
            UNIFORM_NUM_POINT_LIGHTS_NAME = "numPointLights",
            UNIFORM_POINT_LIGHTS_ARRAY_NAME = "pointLights",
            UNIFORM_NUM_SPOT_LIGHTS_NAME = "numSpotLights",
            UNIFORM_SPOT_LIGHTS_ARRAY_NAME = "spotLights",
            UNIFORM_VIEW_MATRIX_NAME = "cameraMatrix",
            UNIFORM_PROJECTION_MATRIX_NAME = "projMatrix",
            UNIFORM_VIEW_PROJECTION_MATRIX_NAME = "viewProjMatrix",
            UNIFORM_VIEW_ORIENTATION_MATRIX_NAME = "cameraOrientationMatrix",
            UNIFORM_VIEW_ASPECT_NAME = "aspect",
            UNIFORM_VIEWPORT_SIZE_NAME = "viewportSize",
            UNIFORM_EYE_POSITION_VECTOR_NAME = "eyePos",
            UNIFORM_SHADOW_MAPPING_RANGES_ARRAY_NAME = "shadowMapRanges",
            UNIFORM_SHADOW_MAPPING_SHADOW_MAPS_ARRAY_NAME = "shadowMaps",
            UNIFORM_SHADOW_MAPPING_SHADOW_MAP_SAMPLE_OFFSET_ARRAY_NAME = "shadowMapSampleOffsets",
            SHADOW_MAP_SAMPLE_OFFSETS = [
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,
                -1.0, 0.0,
                0.0, -1.0,
                1.0, 1.0,
                1.0, -1.0,
                -1.0, 1.0,
                -1.0, -1.0
            ],
            /**
             * The index of the array storing the front - opaque render queues in the main render queues array of scenes.
             * @type Number
             */
            FRONT_OPAQUE_RENDER_QUEUES_INDEX = 0,
            /**
             * The index of the array storing the front - transparent render queues in the main render queues array of scenes.
             * @type Number
             */
            FRONT_TRANSPARENT_RENDER_QUEUES_INDEX = 1,
            /**
             * The index of the array storing the distance - opaque render queues in the main render queues array of scenes.
             * @type Number
             */
            DISTANCE_OPAQUE_RENDER_QUEUES_INDEX = 2,
            /**
             * The index of the array storing the distance - transparent render queues in the main render queues array of scenes.
             * @type Number
             */
            DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX = 3,
            /**
             * A color mask to be set when all color components should be updated.
             * @type Number[4]
             */
            COLOR_MASK_ALL_TRUE = [true, true, true, true],
            /**
             * This name is used for the full viewport quad models created for render-to-texture effects / post-processing / etc
             * @type String
             */
            FVQ_NAME = "fvq",
            /**
             * This name is used for the framebuffers created for stereoscopic rendering (render-to-texture)
             * @type String
             */
            STEREOSCOPY_FRAMEBUFFER_NAME = "stereo",
            /**
             * Name for the uniform used to pass the texture unit for stereoscopic rendering
             * @type String
             */
            UNIFORM_STEREOSCOPY_TEXTURE_NAME = "stereo",
            /**
             * Name for the uniform used to pass the texture unit for shadow map debug rendering
             * @type String
             */
            UNIFORM_SHADOW_MAP_DEBUG_TEXTURE_NAME = "shadowMapDebug",
            /**
             * This string is available to other modules through a public function so that an arbitrary piece of information from this 
             * module can be exposed for debug purposes.
             * @type String
             */
            _debugInfo = "";
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Queries a module-level string for debug purposes.
     * @returns {String}
     */
    function getDebugInfo() {
        return _debugInfo;
    }
    // #########################################################################
    /**
     * @struct Holds a certain LOD configuration to be used for making LOD 
     * decisions while rendering.
     * @constructor
     * @param {Number} maxEnabledLOD The highest LOD that can be chosen while 
     * rendering.
     * @param {Number[]} thresholds The threshold size in pixels for each LOD.
     * For each object the highest LOD, for which its size exceeds the 
     * threshold, will be used.
     * @param {Boolean} compensateForObjectSize Whether a compensated object 
     * size should be taken into account for the LOD decision, taking objects
     * bigger than a reference size as smaller, and smallers ones as bigger.
     * This is used to make better LOD decisions for objects spanning a wide
     * range of sizes, but having more similar size details.
     * @param {Number} [referenceSize] The size that should be taken as is, when
     * compensation is enabled.
     * @param {Number} [minimumRelativeSize] If the relative size of a object 
     * inside a parent (compared to the size of the parent) is smaller than this
     * value, this value will be used instead to calculate the relative visible
     * size.
     * @returns {LODContext}
     */
    function LODContext(maxEnabledLOD, thresholds, compensateForObjectSize, referenceSize, minimumRelativeSize) {
        /**
         * The highest renderable LOD.
         * @type type Number
         */
        this.maxEnabledLOD = maxEnabledLOD;
        /**
         * The threshold for each LOD that a renderable object must exceed (in 
         * size) to be drawn with that LOD.
         * @type Number[]
         */
        this.thresholds = thresholds;
        /**
         * Whether a compensated object size should be taken into account for 
         * the LOD decision, taking objects bigger than a reference size as 
         * smaller, and smallers ones as bigger.
         * This is used to make better LOD decisions for objects spanning a wide
         * range of sizes, but having more similar size details.
         * @type Boolean
         */
        this.compensateForObjectSize = (compensateForObjectSize === true);
        /**
         * The size that should be taken as is, when compensation is enabled.
         * @type Number
         */
        this.referenceSize = referenceSize || DEFAULT_LOD_REFERENCE_SIZE;
        /**
         * If the relative size of a object inside a parent (compared to the 
         * size of the parent) is smaller than this value, this value will be 
         * used instead to calculate the relative visible size.
         * @type Number
         */
        this.minimumRelativeSize = minimumRelativeSize || DEFAULT_LOD_MINIMUM_RELATIVE_SIZE;
    }
    // #########################################################################
    /**
     * @constructor
     * @struct
     * @param {ManagedGLContext} context
     * @param {Boolean} depthMask
     * @param {Scene} scene
     * @param {RenderableObject} parent
     * @param {Camera} camera
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @param {LODContext} lodContext
     * @param {Number} dt
     * @param {Boolean} [useInstancing=false] 
     * @param {Number} [instanceQueueIndex]
     * @param {DirectionalLight} [light]
     * @returns {RenderParameters}
     */
    function RenderParameters(context, depthMask, scene, parent, camera, viewportWidth, viewportHeight, lodContext, dt, useInstancing, instanceQueueIndex, light) {
        /**
         * @type ManagedGLContext
         */
        this.context = context;
        /**
         * @type Boolean
         */
        this.depthMask = depthMask;
        /**
         * @type Scene
         */
        this.scene = scene;
        /**
         * @type RenderableObject
         */
        this.parent = parent;
        /**
         * @type Camera
         */
        this.camera = camera;
        /**
         * @type Number
         */
        this.viewportWidth = viewportWidth;
        /**
         * @type Number
         */
        this.viewportHeight = viewportHeight;
        /**
         * @type LODContext
         */
        this.lodContext = lodContext;
        /**
         * @type Number
         */
        this.dt = dt || 0;
        /**
         * @type Boolean
         */
        this.useInstancing = useInstancing || false;
        /**
         * @type Number
         */
        this.instanceQueueIndex = instanceQueueIndex;
        /**
         * @type DirectionalLight
         */
        this.light = light;
    }
    // #########################################################################
    /**
     * @class A node on the rendering tree, that can hold a renderable object as 
     * well as references to children nodes.
     * @constructor
     * @param {RenderableObject} renderableObject
     * @param {Boolean} [renderToShadowMap=true] If false, this node and its subnodes will never be rendered to shadow maps
     * @param {Boolean} [instancedSubnodes=false] If true, then when this node is added to render queues and it has enough subnodes for
     * instanced rendering, only its first subnode will be checked about which queues it should be added to, and all the subnodes will be 
     * added to the same queues together, without checking them for further subnodes. Use this on container nodes storing large amounts
     * of (leaf) subnodes that are suitable for instancing to improve performance.
     * @param {Boolean} [instancing=false] If true and instancing is available, the node will be rendered using instancing.
     */
    function RenderableNode(renderableObject, renderToShadowMap, instancedSubnodes, instancing) {
        /**
         * The object this node holds that can be rendered.
         * @type RenderableObject
         */
        this._renderableObject = renderableObject;
        renderableObject.setNode(this);
        /**
         * The scene this node is part of.
         * @type Scene
         */
        this._scene = null;
        /**
         * A reference to the parent node of this node.
         * @type RenderableNode
         */
        this._parent = null;
        /**
         * The list of subnodes (children) this node is connected to.
         * @type DirectDoubleLinkedList
         */
        this._subnodes = new containers.DirectDoubleLinkedList();
        /**
         * A flag to mark whether this node and its subnodes should be rendered.
         * @type Boolean
         */
        this._visible = true;
        /**
         * A variable to hold the rendering parameters passed to the held object
         * before each render, in order to avoid creating a new object to store
         * these at each render.
         * @type RenderParameters
         */
        this._renderParameters = new RenderParameters();
        /**
         * A list of camera configurations that are associated with this node.
         * @type CameraConfiguration[]
         */
        this._cameraConfigurations = null;
        /**
         * If false, this node and its subnodes are never rendered to shadow maps
         * @type Boolean
         */
        this._isRenderedToShadowMap = renderToShadowMap !== false;
        /**
         * Whether this node has subnodes of the same type, which are leaf nodes and are suitable for instancing, so can be added to the
         * same instanced queue.
         * @type Boolean
         */
        this._hasInstancedSubnodes = instancedSubnodes;
        /**
         * Whether the node is to be rendered using instancing.
         * @type Number
         */
        this._instancing = !!instancing;
        /**
         * A shortcut cache variable that is set to true once this node is set to be resuable or it is found reusable in a check, so that
         * later this can be determined in one step
         * @type Boolean
         */
        this._canBeReused = false;
        // direct linked list element properties
        this.next = null;
        this.previous = null;
        this.list = null;
    }
    /**
     * Returns whether this node can be reused to hold a different object.
     * @returns {Boolean}
     */
    RenderableNode.prototype.canBeReused = function () {
        var subnode;
        if (this._canBeReused) {
            return true;
        }
        if (this._renderableObject.canBeReused()) {
            for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
                if (subnode.canBeReused() === false) {
                    return false;
                }
            }
            this._canBeReused = true;
            return true;
        }
        return false;
    };
    /**
     * Returns the scene this node is part of.
     * @returns {Scene}
     */
    RenderableNode.prototype.getScene = function () {
        return this._scene;
    };
    /**
     * Sets up the node (and its subnodes) as part of the passed scene.
     * @param {Scene} scene
     * @param {Boolean} [addToContexts=false]
     */
    RenderableNode.prototype.setScene = function (scene, addToContexts) {
        var subnode;
        this._scene = scene;
        if (scene && addToContexts) {
            scene.addObjectToContexts(this._renderableObject);
        }
        for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
            subnode.setScene(scene, addToContexts);
        }
    };
    /**
     * Adds the node to the appropriate render queue out of the passed ones based on what shader does its object use.
     * Do not call from outside.
     * @param {RenderableNode[][]} renderQueues The render queues, each being an array of renderable nodes using the same shader.
     * @returns {Number}
     */
    RenderableNode.prototype.addToRenderQueue = function (renderQueues) {
        var i;
        if (!this._instancing) {
            for (i = 0; i < renderQueues.length; i++) {
                if ((renderQueues[i].length > 0) &&
                        (!renderQueues[i][0].getInstancing()) &&
                        (this._renderableObject.shouldGoInSameRenderQueue(renderQueues[i][0].getRenderableObject()))) {
                    renderQueues[i].push(this);
                    return i;
                }
            }
        } else {
            for (i = 0; i < renderQueues.length; i++) {
                if ((renderQueues[i].length > 0) &&
                        (renderQueues[i][0].getInstancing()) &&
                        (this._renderableObject.shouldGoInSameRenderQueueInstanced(renderQueues[i][0].getRenderableObject()))) {
                    renderQueues[i].push(this);
                    return i;
                }
            }
        }
        renderQueues.push([this]);
        return renderQueues.length - 1;
    };
    /**
     * Performs the animation of the object stored at this node if needed and adds this node to one of the passed render queues, to the one 
     * which has nodes using the same shader as this ones, so that rendering nodes in one queue will not require a shader change. Adds the 
     * subnodes to the queues as well, but does not add either itself or the subnodes if it is not set to visible as they do no need to be 
     * rendered.
     * @param {RenderableNode[][][]} renderQueues A two dimensional array of render queues. Meaning of indices: 
     * -1st: front / distance, transparent / opaque render queues
     * -2nd: queues storing nodes that should be rendered together
     * -3rd: the nodes to render
     * @param {Boolean} distanceRendering Whether distance rendering is enabled (if not, the node will be added to the front queues without
     * distance checks)
     * @param {Camera} camera The camera from the view point of which renderable nodes need to be organized to front and distant nodes
     * @param {Number} dt The elapsed time since the last render, for animation, in milliseconds
     * @param {queueBits} [parentQueueBits] The render queue bits of the parent node
     */
    RenderableNode.prototype.animateAndAddToRenderQueues = function (renderQueues, distanceRendering, camera, dt, parentQueueBits) {
        var queueBits, subnode, next, renderQueueIndex, transparent, opaque, object;
        if (!this._visible) {
            return;
        }
        if (this._renderableObject.resetForNewFrame) {
            this._renderableObject.resetForNewFrame();
        }
        if (this._scene.shouldAnimate()) {
            this._renderableObject.animate(dt);
        }
        if (this._renderableObject.canBeReused()) {
            return;
        }
        transparent = this._renderableObject.isRenderedWithoutDepthMask();
        opaque = this._renderableObject.isRenderedWithDepthMask();
        if (transparent || opaque) {
            if (distanceRendering) {
                queueBits = this._renderableObject.getRenderQueueBits(camera, parentQueueBits);
                if (queueBits & RENDER_QUEUE_FRONT_BIT) {
                    if (transparent) {
                        this.addToRenderQueue(renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX]);
                    }
                    if (opaque) {
                        this.addToRenderQueue(renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX]);
                    }
                }
                if (queueBits & RENDER_QUEUE_DISTANCE_BIT) {
                    if (transparent) {
                        this.addToRenderQueue(renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX]);
                    }
                    if (opaque) {
                        this.addToRenderQueue(renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX]);
                    }
                }
            } else {
                // if distance rendering is disabled, skip the check and add to the front queues
                if (transparent) {
                    this.addToRenderQueue(renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX]);
                }
                if (opaque) {
                    this.addToRenderQueue(renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX]);
                }
            }
        }
        if (this._subnodes.getLength() > 0) {
            // if children are inside the parent, they will take its render queue bits, so make sure they are calculated
            if (queueBits === undefined) {
                queueBits = distanceRendering ? this._renderableObject.getRenderQueueBits(camera, parentQueueBits) : RENDER_QUEUE_FRONT_BIT;
            }
            if (!this._hasInstancedSubnodes || !this._subnodes.getFirst().getInstancing()) {
                for (subnode = this._subnodes.getFirst(); subnode; subnode = next) {
                    next = subnode.next;
                    subnode.animateAndAddToRenderQueues(renderQueues, distanceRendering, camera, dt, queueBits);
                }
            } else {
                // if subnodes can be added to the same instanced queue, do the addition and animation directly and do not go into recursion further
                // as a result, we need to do the frame reset manually for them as well here
                if (this._scene.shouldAnimate()) {
                    for (subnode = this._subnodes.getFirst(); subnode; subnode = next) {
                        next = subnode.next;
                        object = subnode.getRenderableObject();
                        object.animate(dt);
                        if (object.resetForNewFrame) {
                            object.resetForNewFrame();
                        }
                    }
                } else {
                    for (subnode = this._subnodes.getFirst(); subnode; subnode = next) {
                        next = subnode.next;
                        object = subnode.getRenderableObject();
                        if (object.resetForNewFrame) {
                            object.resetForNewFrame();
                        }
                    }
                }
                subnode = this._subnodes.getFirst();
                // the animation might have removed all the subnodes
                if (subnode) {
                    transparent = subnode.getRenderableObject().isRenderedWithoutDepthMask();
                    opaque = subnode.getRenderableObject().isRenderedWithDepthMask();
                    if (transparent || opaque) {
                        queueBits = subnode.getRenderableObject().getRenderQueueBits(camera, queueBits);
                        if (queueBits & RENDER_QUEUE_FRONT_BIT) {
                            if (transparent) {
                                renderQueueIndex = subnode.addToRenderQueue(renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX]);
                                renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                                this._subnodes.appendToArray(renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex]);
                            }
                            if (opaque) {
                                renderQueueIndex = subnode.addToRenderQueue(renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX]);
                                renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                                this._subnodes.appendToArray(renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex]);
                            }
                        }
                        if (queueBits & RENDER_QUEUE_DISTANCE_BIT) {
                            if (transparent) {
                                renderQueueIndex = subnode.addToRenderQueue(renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX]);
                                renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                                this._subnodes.appendToArray(renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex]);
                            }
                            if (opaque) {
                                renderQueueIndex = subnode.addToRenderQueue(renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX]);
                                renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                                this._subnodes.appendToArray(renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex]);
                            }
                        }
                    }
                }
            }
        }
    };
    /**
     * Sets up the node to have a new parent.
     * @param {RenderableNode} parent
     */
    RenderableNode.prototype.setParent = function (parent) {
        this._parent = parent;
        this.setScene(parent.getScene());
        if (this._renderableObject.setParent) {
            this._renderableObject.setParent(parent.getRenderableObject());
        }
    };
    /**
     * Returns the renderable object held by this node.
     * @returns {RenderableObject}
     */
    RenderableNode.prototype.getRenderableObject = function () {
        return this._renderableObject;
    };
    /**
     * Returns whether the node (and its subnodes) are set to be rendered.
     * @returns {Boolean}
     */
    RenderableNode.prototype.isVisible = function () {
        return this._visible && (!this._parent || this._parent.isVisible());
    };
    /**
     * Sets the node (and its visible subnodes) to be rendered from now on.
     */
    RenderableNode.prototype.show = function () {
        this._visible = true;
    };
    /**
     * Sets the node and its subnodes not to be rendered from now on.
     */
    RenderableNode.prototype.hide = function () {
        this._visible = false;
    };
    /**
     * Switches the visibility of the node to the opposite.
     */
    RenderableNode.prototype.toggleVisibility = function () {
        this._visible = !this._visible;
    };
    /**
     * Adds a subnode to this node.
     * @param {RenderableNode} subnode The subnode to be added to the rendering tree. 
     * It will be rendered relative to this object (transformation matrices stack)
     * @param {Boolean} [addToContexts=false]
     * @returns {RenderableNode} The added subnode, for convenience
     */
    RenderableNode.prototype.addSubnode = function (subnode, addToContexts) {
        this._subnodes.add(subnode);
        subnode.setParent(this);
        if (this._scene) {
            subnode.setScene(this._scene, addToContexts);
        }
        return subnode;
    };
    /**
     * Returns the array of subnodes this node has.
     * @returns {RenderableNode[]}
     */
    RenderableNode.prototype.getSubnodes = function () {
        return this._subnodes;
    };
    /**
     * Return the first subnode of this node.
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getFirstSubnode = function () {
        return this._subnodes.getFirst();
    };
    /**
     * Returns the node coming after the specified node among the subnodes of this node. If the given node is not among the subnodes,
     * returns the first subnode.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getNextSubnode = function (currentNode) {
        return this._subnodes.getNext(currentNode);
    };
    /**
     * Returns the node coming before the specified node among the subnodes of this node. If the given node is not among the subnodes,
     * returns the last subnode.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getPreviousSubnode = function (currentNode) {
        return this._subnodes.getPrevious(currentNode);
    };
    /**
     * Adds a new associated camera configuration to this node.
     * @param {CameraConfiguration} cameraConfiguration
     */
    RenderableNode.prototype.addCameraConfiguration = function (cameraConfiguration) {
        if (!this._cameraConfigurations) {
            this._cameraConfigurations = [];
        }
        this._cameraConfigurations.push(cameraConfiguration);
    };
    /**
     * Returns whether the given camera configuration is among the ones associated with this node.
     * @param {CameraConfiguration} cameraConfiguration
     * @returns {Boolean}
     */
    RenderableNode.prototype.hasCameraConfiguration = function (cameraConfiguration) {
        var i;
        if (!this._cameraConfigurations) {
            return false;
        }
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i] === cameraConfiguration) {
                return true;
            }
        }
        return false;
    };
    /**
     * Returns the camera configuration the comes after the one passed as parameter in the list of associated camera configurations.
     * If the last configuration is passed, returns the first one. Returns the first configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * Excludes camera configurations that return true to shouldExcludeFromCycle()
     * @param {CameraConfiguration} currentCameraConfiguration
     * @returns {CameraConfiguration}
     */
    RenderableNode.prototype.getNextCameraConfiguration = function (currentCameraConfiguration) {
        var i, currentIndex, length;
        if (!this._cameraConfigurations) {
            return null;
        }
        length = this._cameraConfigurations.length;
        if (length <= 0) {
            return null;
        }
        if (!currentCameraConfiguration) {
            currentIndex = -1;
        } else {
            for (i = 0; i < length; i++) {
                if (this._cameraConfigurations[i] === currentCameraConfiguration) {
                    currentIndex = i;
                    break;
                }
            }
            if (i >= length) {
                application.crash(); // the current configuration was not in the list
                return;
            }
        }
        i = (currentIndex + 1) % length;
        while ((i !== currentIndex) && this._cameraConfigurations[i].shouldExcludeFromCycle()) {
            i = (i + 1) % length;
        }
        return this._cameraConfigurations[i];
    };
    /**
     * Returns the camera configuration the comes before the one passed as parameter in the list of associated camera configurations.
     * If the first configuration is passed, returns the last one. Returns the last configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * Excludes camera configurations that return true to shouldExcludeFromCycle()
     * @param {CameraConfiguration} [currentCameraConfiguration]
     * @returns {CameraConfiguration}
     */
    RenderableNode.prototype.getPreviousCameraConfiguration = function (currentCameraConfiguration) {
        var i, currentIndex, length;
        if (!this._cameraConfigurations) {
            return null;
        }
        length = this._cameraConfigurations.length;
        if (length <= 0) {
            return null;
        }
        if (!currentCameraConfiguration) {
            currentIndex = length;
        } else {
            for (i = (length - 1); i >= 0; i--) {
                if (this._cameraConfigurations[i] === currentCameraConfiguration) {
                    currentIndex = i;
                    break;
                }
            }
            if (i < 0) {
                application.crash(); // the current configuration was not in the list
                return;
            }
        }
        i = (currentIndex + length - 1) % length;
        while ((i !== currentIndex) && this._cameraConfigurations[i].shouldExcludeFromCycle()) {
            i = (i + length - 1) % length;
        }
        return this._cameraConfigurations[i];
    };
    /**
     * Returns a list of the associated camera configurations that have the specified name.
     * @param {String} name
     * @returns {CameraConfiguration[]}
     */
    RenderableNode.prototype.getCameraConfigurationsWithName = function (name) {
        var result = [], i;
        if (this._cameraConfigurations) {
            for (i = 0; i < this._cameraConfigurations.length; i++) {
                if (this._cameraConfigurations[i].getName() === name) {
                    result.push(this._cameraConfigurations[i]);
                }
            }
        }
        return result;
    };
    /**
     * Resets the default settings of all the associated camera configurations.
     */
    RenderableNode.prototype.resetCameraConfigurations = function () {
        var i;
        if (this._cameraConfigurations) {
            for (i = 0; i < this._cameraConfigurations.length; i++) {
                this._cameraConfigurations[i].resetToDefaults();
            }
        }
    };
    /**
     * Logs the information about this node (used for logging scene graph structure)
     * @param {Number} level How deep is this node located within its scene graph.
     */
    RenderableNode.prototype.log = function (level) {
        var i, subnode, msg = "", typeName = this._renderableObject.constructor.name;
        for (i = 0; i < level; i++) {
            msg += ". ";
        }
        msg += typeName;
        application.log_DEBUG(msg);
        this._scene.increaseCount(typeName);
        for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
            subnode.log(level + 1);
        }
    };
    /**
     * Sets up the stored render parameters that are passed to the held renderable object for the next rendering.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     * @param {Boolean} [useInstancing=false] 
     * @param {Number} [instanceQueueIndex]
     * @param {DirectionalLight} [light]
     */
    RenderableNode.prototype.setRenderParameters = function (context, screenWidth, screenHeight, depthMask, useInstancing, instanceQueueIndex, light) {
        var rp = this._renderParameters;
        rp.context = context;
        rp.depthMask = depthMask;
        rp.scene = this._scene;
        rp.parent = this._parent ? this._parent.getRenderableObject() : null;
        rp.camera = this._scene.getCamera();
        rp.viewportWidth = screenWidth;
        rp.viewportHeight = screenHeight;
        rp.lodContext = this._scene.getLODContext();
        rp.useInstancing = useInstancing;
        rp.instanceQueueIndex = instanceQueueIndex;
        rp.light = light;
    };
    /**
     * Renders the object at this node and all subnodes, if visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     * @param {Boolean} [withoutSubnodes=false] If true, subnodes will not be rendered.
     * @param {Boolean} [useInstancing=false] If true, the node will not be rendered, just its data will be added to the corresponding 
     * instance attribute buffers.
     * @param {Number} [instanceQueueIndex] This index identifies the instance queue so that instance attribute buffer data for different
     * queues using the same shader do not mix
     * @param {Boolean} [noReset=false] If true, resetForNewFrame() will not be called on the node and its subnodes (used when the nodes are added to render
     * queues, as in that case the reset is already called there)
     * @returns {Boolean} Whether the node was rendered.
     */
    RenderableNode.prototype.render = function (context, screenWidth, screenHeight, depthMask, withoutSubnodes, useInstancing, instanceQueueIndex, noReset) {
        var subnode, result;
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            if (!noReset && this._renderableObject.resetForNewFrame) {
                this._renderableObject.resetForNewFrame();
            }
            if (this._renderableObject.mightBeRendered()) {
                this.setRenderParameters(context, screenWidth, screenHeight, depthMask, useInstancing, instanceQueueIndex);
                result = this._renderableObject.render(this._renderParameters);
            } else {
                result = false;
            }
            if (!withoutSubnodes) {
                for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
                    subnode.render(context, screenWidth, screenHeight, depthMask, withoutSubnodes, useInstancing, instanceQueueIndex, noReset);
                }
            }
            return result;
        }
        return false;
    };
    /**
     * Call this on the first node of an instance render queue comprised of nodes that should be rendered together as instances. Sets up
     * the instance buffers so that the nodes in the queue can add their own data to it before rendering.
     * @param {ManagedGLContext} context
     * @param {Number} instanceQueueIndex This identifies the instance queue so if multiple queues use the same shader, their instance
     * attribute data will not mix
     * @param {Number} instanceCount The number of instances in this queue
     */
    RenderableNode.prototype.prepareForInstancedRender = function (context, instanceQueueIndex, instanceCount) {
        this._renderableObject.prepareForInstancedRender(context, this._scene, instanceQueueIndex, instanceCount);
    };
    /**
     * Call this on any of the nodes of an instance queue after all of them have been set up to render them all.
     * @param {ManagedGLContex} context
     * @param {Number} instanceQueueIndex
     * @param {Number} instanceCount
     */
    RenderableNode.prototype.renderInstances = function (context, instanceQueueIndex, instanceCount) {
        this._renderableObject.renderInstances(context, instanceQueueIndex, instanceCount);
    };
    /**
     * Renders the object at this node and all subnodes to the shadow map, if it is visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {DirectionalLight} [light]
     * @returns {Boolean}
     */
    RenderableNode.prototype.renderToShadowMap = function (context, screenWidth, screenHeight, light) {
        var subnode, result;
        // the visible property determines visibility of all subnodes as well
        if (this._visible && this._isRenderedToShadowMap) {
            if (this._renderableObject.mightBeRenderedToShadowMap()) {
                this.setRenderParameters(context, screenWidth, screenHeight, true, undefined, undefined, light);
                result = this._renderableObject.renderToShadowMap(this._renderParameters);
            } else {
                result = false;
            }
            // recursive rendering of all subnodes
            for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
                subnode.renderToShadowMap(context, screenWidth, screenHeight, light);
            }
            return result;
        }
        return false;
    };
    /**
     * Executes the given callback function passing the held renderable object as a parameter to it and recursively calls for the execution 
     * for all the subnodes.
     * @param {Function} callback
     */
    RenderableNode.prototype.execute = function (callback) {
        var subnode;
        callback(this._renderableObject);
        for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
            subnode.execute(callback);
        }
    };
    /**
     * Adds and sets up all resources needed to render the held object and all
     * subnodes to the given context.
     * @param {ManagedGLContext} context
     */
    RenderableNode.prototype.addToContext = function (context) {
        var subnode;
        this._renderableObject.addToContext(context);
        for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
            subnode.addToContext(context);
        }
    };
    /**
     * Returns the managed shader that the renderable object stored at this node uses.
     * @returns {unresolved}
     */
    RenderableNode.prototype.getShader = function () {
        return this._renderableObject.getShader();
    };
    /**
     * Sets the shader to use for the held object and for all subnodes.
     * @param {ManagedShader} shader
     */
    RenderableNode.prototype.setShader = function (shader) {
        var subnode;
        this._renderableObject.setShader(shader);
        for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
            subnode.setShader(shader);
        }
    };
    /**
     * Marks the node and all its subnodes (and their renderable objects) as reusable.
     * @param {Boolean} removeFromParent If true, the node is also removed from its parent (if it has one)
     */
    RenderableNode.prototype.markAsReusable = function (removeFromParent) {
        var subnode, next;
        this._renderableObject.markAsReusable(removeFromParent);
        // need to mark all subnodes as reusable in case they hold pooled objects
        for (subnode = this._subnodes.getFirst(); subnode; subnode = next) {
            next = subnode.next;
            subnode.markAsReusable(removeFromParent);
        }
        this._canBeReused = true;
        if (removeFromParent && this._parent) {
            this._parent.removeSubnode(this, true);
        }
    };
    /**
     * Gets called when the contained renderable object is marked reusable.
     * @param {Boolean} removeFromParent If true, the node is removed from its parent (if it has one)
     */
    RenderableNode.prototype.handleObjectBecameReusable = function (removeFromParent) {
        if (removeFromParent && this._parent && (this._subnodes.getLength() === 0)) {
            this._parent.removeSubnode(this, true);
        }
    };
    /**
     * Removes all subnodes from the subtree of this object that are deleted or
     * are marked for deletion.
     */
    RenderableNode.prototype.cleanUp = function () {
        var subnode, next;
        subnode = this._subnodes.getFirst();
        while (subnode) {
            next = subnode.next;
            if (subnode.canBeReused()) {
                this._subnodes.remove(subnode);
            }
            subnode = next;
        }
        for (subnode = this._subnodes.getFirst(); subnode; subnode = subnode.next) {
            subnode.cleanUp();
        }
    };
    /**
     * Returns wether to enable instancing for the render queues this node is put in.
     * @returns {Boolean}
     */
    RenderableNode.prototype.getInstancing = function () {
        return this._instancing;
    };
    /**
     * Remove the given subnode from this node.
     * @param {RenderableNode} subnode 
     * @param {Boolean} removeFromParent If true, the node is removed from its parent in case no subnodes are left under it and it has no
     * non-reusable renderable object itself.
     */
    RenderableNode.prototype.removeSubnode = function (subnode, removeFromParent) {
        this._subnodes.remove(subnode);
        if (removeFromParent && (this._subnodes.getLength() === 0) && this._renderableObject.canBeReused()) {
            if (this._parent) {
                this._parent.removeSubnode(this, true);
            }
        }
    };
    /**
     * Removes all subnodes from this node.
     * @param {Boolean} [hard=false] If true, also removes the reference to the subnode list stored in the subnodes.
     */
    RenderableNode.prototype.removeSubnodes = function (hard) {
        this._subnodes.clear(hard);
    };
    /**
     * Removes all references stored by this object. Recursively destroys all subnodes.
     */
    RenderableNode.prototype.destroy = function () {
        var subnode, next;
        this._renderableObject.setNode(null);
        this._renderableObject = null;
        this._scene = null;
        this._parent = null;
        if (this._subnodes) {
            for (subnode = this._subnodes.getFirst(); subnode; subnode = next) {
                next = subnode.next;
                subnode.destroy();
                subnode = null;
            }
            this._subnodes = null;
        }
        this._renderParameters = null;
        this._cameraConfigurations = null;
        this.next = null;
        this.previous = null;
        this.list = null;
    };
    // #########################################################################
    /**
     * @typedef Scene~CameraSettings
     * @property {Boolean} [useVerticalValues]
     * @property {Number} viewDistance
     * @property {CameraConfiguration} [configuration]
     * @property {Boolean} [fps]
     * @property {Float32Array} [positionMatrix]
     * @property {Float32Array} [orientationMatrix]
     * @property {Number} [fov]
     * @property {Number[2]} [fovRange]
     * @property {Number} [span]
     * @property {Number} [transitionDuration]
     * @property {String} [transitionStyle] (enum Camera.TransitionStyle)
     */
    /**
     * @class An object to hold a hierarchic scene graph and webGL configuration for rendering.
     * @param {Number} left The relative X position of the bottom left corner of the viewport on the canvas in 0-1 range.
     * @param {Number} bottom The relative Y position of the bottom left corner of the viewport on the canvas in 0-1 range.
     * @param {Number} width The width of the viewport relative to the canvas.
     * @param {Number} height The height of the viewport relative to the canvas.
     * @param {Boolean} clearColorOnRender Whether to clear the color buffer every time at the beginning of rendering the scene.
     * @param {Boolean[4]} clearColorMask Which components shall be cleared if the color buffer is to be cleared.
     * @param {Number[4]} clearColor What color to use when clearing the buffer (RGBA components).
     * @param {Boolean} clearDepthOnRender Whether to clear the depth buffer every time at the beginning of rendering the scene.
     * @param {LODContext} lodContext The LOD threshold and configuration to be used
     * for rendering object with the appropriate level of detail.
     * @param {Number} maxRenderedDirectionalLights The maximum number of directional lights that should be considered when rendering this scene.
     * @param {Number} maxRenderedPointLights The maximum number of point lights that should be considered when rendering this scene.
     * @param {Number} maxRenderedSpotLights The maximum number of spot lights that should be considered when rendering this scene.
     * @param {Scene~CameraSettings} cameraSettings The properties based on which the camera for this scene will be set up.
     * @param {Boolean} [distanceRendering=true] Whether distance rendering should be turned on for this scene. Distance rendering renders far away 
     * objects with a second camera, thus increasing view range, but causes computational overhead even if all objects are near.
     */
    function Scene(left, bottom, width, height, clearColorOnRender, clearColorMask, clearColor, clearDepthOnRender, lodContext, maxRenderedDirectionalLights, maxRenderedPointLights, maxRenderedSpotLights, cameraSettings, distanceRendering) {
        /**
         * The relative X coordinate of the bottom left corner of the viewport on the canvas in 0-1 range.
         * @type Number
         */
        this._left = left;
        /**
         * The relative Y coordinate of the bottom left corner of the viewport on the canvas in 0-1 range.
         * @type Number
         */
        this._bottom = bottom;
        /**
         * The width of the viewport relative to the canvas.
         * @type Number
         */
        this._width = width;
        /**
         * The height of the viewport relative to the canvas.
         * @type Number
         */
        this._height = height;
        /**
         * Whether to clear the color buffer every time at the beginning of rendering the scene.
         * @type Boolean
         */
        this._shouldClearColorOnRender = clearColorOnRender;
        /**
         * Which components shall be cleared if the color buffer is to be cleared.
         * @type Boolean[4]
         */
        this._clearColorMask = clearColorMask;
        /**
         * What color to use when clearing the buffer (RGBA components).
         * @type Number[4]
         */
        this._clearColor = clearColor;
        /**
         * Whether to clear the depth buffer every time at the beginning of rendering the scene.
         * @type Boolean
         */
        this._shouldClearDepthOnRender = clearDepthOnRender;
        /**
         * The root node for the node tree storing the background objects. (rendered behind the main objects, without depth check)
         * @type RenderableNode
         */
        this._rootBackgroundNode = null;
        /**
         * The root node for the node tree storing the main scene objects.
         * @type RenderableNode
         */
        this._rootNode = null;
        /**
         * The root node for the node tree storing the UI objects (rendered on top of the background and main objects without depth check)
         * @type RenderableNode
         */
        this._rootUINode = null;
        /**
         * An array for any special objects that need to be moved when the scene is moved to follow the camera (with a translatev() method)
         * @type Object[]
         */
        this._objectsToMove = null;
        /**
         * The color of ambient light in the scene
         * @type Number[3]
         */
        this._ambientColor = [0, 0, 0];
        /**
         * The list of directional light sources that are available to all objects in the scene.
         * @type DirectionalLightSource[]
         */
        this._directionalLights = [];
        /**
         * The maximum number of directional light sources that should be considered when rendering this scene.
         * @type Number
         */
        this._maxRenderedDirectionalLights = maxRenderedDirectionalLights || 0;
        /**
         * The number of directional lights to be rendered for the current frame
         * @type Number
         */
        this._renderedDirectionalLights = 0;
        /**
         * This array stores the (calculated) data about the directional lights that is in the right format to be sent to the shaders as uniforms.
         * @type SceneGraph~DirectionalLightUniformData[]
         */
        this._directionalLightUniformData = new Array(this._maxRenderedDirectionalLights);
        /**
         * The lists of point light sources that are available to all objects in the scene, ordered by the priorities of the light sources.
         * The first list contains the light sources with the highest priority. If the amount of light sources that can be rendered is 
         * smaller than the stored light sources, the ones with higher priority will be chosen for rendering.
         * @type PointLightSource[][]
         */
        this._pointLightPriorityArrays = null;
        /**
         * The maximum number of point light sources that should be considered when rendering this scene.
         * @type Number
         */
        this._maxRenderedPointLights = maxRenderedPointLights || 0;
        /**
         * The number of point lights to be rendered for the current frame
         * @type Number
         */
        this._renderedPointLights = 0;
        /**
         * This array stores the (calculated) data about the point lights that is in the right format to be sent to the shaders as uniforms.
         * @type SceneGraph~PointLightUniformData[]
         */
        this._pointLightUniformData = new Array(this._maxRenderedPointLights);
        /**
         * The list of spot light sources that are available to all objects in the scene.
         * @type SpotLightSource[]
         */
        this._spotLights = [];
        /**
         * The maximum number of spot light sources that should be considered when rendering this scene.
         * @type Number
         */
        this._maxRenderedSpotLights = maxRenderedSpotLights || 0;
        /**
         * The number of spot lights to be rendered for the current frame
         * @type Number
         */
        this._renderedSpotLights = 0;
        /**
         * This array stores the (calculated) data about the spot lights that is in the right format to be sent to the shaders as uniforms.
         * @type SceneGraph~SpotLightUniformData[]
         */
        this._spotLightUniformData = new Array(this._maxRenderedSpotLights);
        /**
         * The root node for the node tree that contains the objects which are not part of the scene right when it is added to a context,
         * but will be added later, so their resources also need to be added to the context.
         * @type RenderableNode
         */
        this._rootResourceNode = null;
        /**
         * Stores the IDs with which resource nodes were added to this scene, so that attempting to add another object with the same ID
         * will not add another node, and thus duplicates can be avoided
         * @type Object.<String, String>
         */
        this._resourceObjectIDs = null;
        /**
         * The camera used for rendering this scene.
         * @type Camera
         */
        this._camera = new camera.Camera(
                this,
                this._width / this._height,
                cameraSettings.useVerticalValues,
                cameraSettings.viewDistance,
                cameraSettings.configuration || camera.getFreeCameraConfiguration(
                        cameraSettings.fps,
                        cameraSettings.positionMatrix || mat.IDENTITY4,
                        cameraSettings.orientationMatrix || mat.IDENTITY4,
                        cameraSettings.fov,
                        (cameraSettings.fovRange && cameraSettings.fovRange[0]) || cameraSettings.fov,
                        (cameraSettings.fovRange && cameraSettings.fovRange[1]) || cameraSettings.fov,
                        cameraSettings.span),
                cameraSettings.transitionDuration,
                cameraSettings.transitionStyle);
        /**
         * The context that stores the LOD settings for rendering models in this scene with multiple LOD meshes.
         * @type LODContext
         */
        this._lodContext = lodContext;
        /**
         * Whether shadow maps should be rendered and used when rendering this scene.
         * @type Boolean
         */
        this._shadowMappingEnabled = false;
        /**
         * A reference to the shader that is to be used for rendering shadow maps.
         * @type ManagedShader
         */
        this._shadowMappingShader = null;
        /**
         * The size (width and height in texels) of the framebuffer textures to which the shadow maps should be rendered.
         * @type Number
         */
        this._shadowMapTextureSize = 0;
        /**
         * The array of sizes (width and height) of the shadow maps in world-coordinates. For each light source, one shadow map is rendered
         * for each range in this array.
         * @type Float32Array
         */
        this._shadowMapRanges = new Float32Array([]);
        /**
         * The factor that determines the depth of the shadow maps in world coordinates. The depth is calculated by multiplying the shadow
         * map size (width and height) by this factor. For depth, a smaller accuracy is enough (to avoid shadow lines on surfaces which the
         * light hits at a sharp angle), therefore the shadow map can cover more area on this axis, resulting in farther objects casting
         * shadows (or the same objects casting shadows with a finer quality)
         * @type Number
         */
        this._shadowMapDepthRatio = 0;
        /**
         * @type Number
         */
        this._numShadowMapSamples = 0;
        /**
         * When sampling a shadow map for PCF, the samples will be taken from coordinates offset from the center by these vectors.
         * @type Number[][]
         */
        this._shadowMapSampleOffsets = [];
        /**
         * The functions that can be used to set the values of non-camera-related (e.g. light) uniform variables (which need to be
         * updated once every frame) in shaders when rendering this scene. When rendering any object in this scene with a shader 
         * that has a uniform with one of the names this object has a function for, its values will be calculated with the function 
         * and passed to the shader.
         * @type Object.<String, Function>
         */
        this._uniformValueFunctions = {};
        /**
         * Same as _uniformValueFunctions, but for camera-related uniforms (which might need to be updated several times during one 
         * frame - for extended camera / stereographic rendering)
         * @type Object.<String, Function>
         */
        this._cameraUniformValueFunctions = {};
        /**
         * Same as _uniformValueFunctions, but for uniforms that only need to be updated when a context is set up. (e.g. shadow mapping
         * settings)
         * @type Object.<String, Function>
         */
        this._constantUniformValueFunctions = {};
        /**
         * The uniform value functions to be used for the shaders rendering the full viewport quads containing rendered stereoscopic images
         * of this scene.
         * @type Object.<String, Function>
         */
        this._stereoscopicUniformValueFunctions = {};
        /**
         * The index of the texture unit where the framebuffer texture used for rendering the stereoscopic images of this scene was 
         * last bound.
         * @type Number
         */
        this._stereoscopicTextureUnit = 0;
        // setting up the uniform value function for stereoscopic rendering (to pass the bound framebuffer)
        this._stereoscopicUniformValueFunctions[managedGL.getUniformName(managedGL.getTextureUniformRawName(UNIFORM_STEREOSCOPY_TEXTURE_NAME))] = function () {
            return this._stereoscopicTextureUnit;
        }.bind(this);
        /**
         * The uniform value functions to be used for the shader rendering the shadow map for debugging
         * @type Object.<String, Function>
         */
        this._shadowMapDebugUniformValueFunctions = {};
        /**
         * The index of the texture unit where the framebuffer texture used for rendering the shadow map for debugging was last bound.
         * @type Number
         */
        this._shadowMapTextureUnit = 0;
        // setting up the uniform value function for shadow map debug rendering (to pass the bound framebuffer)
        this._shadowMapDebugUniformValueFunctions[managedGL.getUniformName(UNIFORM_SHADOW_MAP_DEBUG_TEXTURE_NAME)] = function () {
            return this._shadowMapTextureUnit;
        }.bind(this);
        /**
         * This array that stores those uniform value function bindings that are not the same across all contexts the scene has been added to.
         * In each element of the array, the bindings corresponding to the context with the same index are stored. For example, the function
         * with the key "uniformName" in the object at index 2 will return the value for the uniform named "uniformName" for shaders when
         * rendering on the third context this scene has been added to.
         * @type Array.<Object.<String, Function>>
         */
        this._contextUniformValueFunctions = [];
        /**
         * Same as _contextUniformValueFunctions, but for uniforms that only need to be updated when a context is set up. (e.g. shadow mapping
         * settings)
         * @type Array.<Object.<String, Function>>
         */
        this._contextConstantUniformValueFunctions = [];
        /**
         * Whether light sources and objects in the scene should be animated when rendering based on the elapsed time since the last render.
         * @type Boolean
         */
        this._shouldAnimate = true;
        /**
         * Whether the camera state (position, orientation, FOV etc) should be updated when rendering based on the elapsed time since the 
         * last render. (e.g. if the camera is moving or transitioning, that should be progressed)
         * @type Boolean
         */
        this._shouldUpdateCamera = true;
        /**
         * The array of managed contexts to which this scene has been added. The scene needs to be added to a managed context before it can
         * be rendered to it, so that it sets up the vertex buffers and framebuffers of the context to contain the vertices and shadow map 
         * buffers required to render this scene.
         * @type ManagedGLContext[]
         */
        this._contexts = [];
        /**
         * Whether distance is turned on for this scene. Distance rendering renders far away objects with a second camera, thus increasing 
         * view range, but causes computational overhead even if all objects are near.
         * @type Boolean
         */
        this._distanceRendering = (distanceRendering !== undefined) ? distanceRendering : true;
        /**
         * The array of arrays of render queues, with each queue being an array of nodes in the scene that need to be rendered and use the same 
         * shader. This way, rendering all the queues after each other requires the minimum amount of shader switches and thus scene
         * uniform (such as light source) assignments.
         * This top level array contains four elements corresponding to the four categories of render queues depending on whether they are
         * front or distance queues and transparent or opaque queues.
         * @type RenderableNode[][][]
         */
        this._renderQueues = this._distanceRendering ? [[], [], [], []] : [[], []];
        /**
         * The array of renderable nodes to be rendered to the next shadow map.
         * @type RenderableNode[]
         */
        this._shadowQueue = null;
        /**
         * A flag storing whether the scene uniforms have already been assigned at least once during the current frame. If the whole scene
         * is rendered using just one shader, there are no shader switches and thus no automatic scene uniform assignments, so this flag
         * is used to make sure that uniform values get updated for each frame even in this case.
         * @type Boolean
         */
        this._uniformsUpdatedForFrame = false;
        /**
         * The set containing the shaders for which the values of the non-camera related (e.g. light) scene uniforms (which 
         * need to be updated once every frame) have been updated for the current frame.
         * This is used to avoid updating the scene uniforms for the same shader multiple times during one frame.
         * @type Set
         */
        this._uniformsUpdated = new Set();
        /**
         * Similar to _uniformsUpdated, but marks updates for camera-related uniforms, which might need to be updated multiple times during
         * a frame - for extended camera / stereographic rendering.
         * @type Set
         */
        this._cameraUniformsUpdated = new Set();
        /**
         * Similar to _uniformsUpdated, but marks updates for uniforms which only need to be updated when a context is set up (e.g. shadow
         * mapping settings)
         * @type Set
         */
        this._constantUniformsUpdated = new Set();
        /**
         * Used for debug stat logging - counting the number of nodes in the scene.
         * @type Number
         */
        this._nodeCount = 0;
        /**
         * Used for debug stat logging - counting the number of nodes per object type in the scene.
         * @type Object.<String, Number>
         */
        this._nodeCountByType = null;
        /**
         * Stores the rendering statistics for the current frame about the scene graph in debug mode (shadow map rendering not included)
         * @type ModelDebugStats
         */
        this._mainDebugStats = null;
        /**
         * Stores the rendering statistics for the current frame about the shadow maps in debug mode
         * @type ModelDebugStats
         */
        this._shadowMapDebugStats = null;
        /**
         * (enum Scene.StereoscopicMode) In what stereoscopic mode to render this scene.
         * @type String
         */
        this._stereoscopicMode = Scene.StereoscopicMode.NONE;
        /**
         * For anaglyph stereoscopic rendering, the shader to be used for rendering scene for the left eye (with a red filter)
         * @type ManagedShader
         */
        this._redShader = null;
        /**
         * For anaglyph stereoscopic rendering, the shader to be used for rendering scene for the right eye (with a cyan filter)
         * @type ManagedShader
         */
        this._cyanShader = null;
        /**
         * The framebuffer used for rendering the left and right eye images when in stereoscopic mode
         * @type FrameBuffer
         */
        this._stereoscopicFrameBuffer = null;
        /**
         * For side by side stereoscopic rendering, the shader to be used for rendering scene for the left eye (offset to the left)
         * @type ManagedShader
         */
        this._leftShader = null;
        /**
         * For side by side stereoscopic rendering, the shader to be used for rendering scene for the right eye (offset to the right)
         * @type ManagedShader
         */
        this._rightShader = null;
        /**
         * When in side by side stereoscopic rendering mode, this value determines whether to use the original aspect ratio when 
         * rendering the two images (false means rendering the original area, condensed, thus at half the aspect ratio)
         * @type Boolean
         */
        this._sideBySideOriginalAspect = false;
        /**
         * Whether shadow map debugging (rendering shadow map on screen) is currently enabled
         * @type Boolean
         */
        this._shadowMapDebugging = false;
        /**
         * If shadow map rendering on screen is enabled, which light's shadow map to render
         * @type Number
         */
        this._shadowMapDebugLightIndex = 0;
        /**
         * If shadow map rendering on screen is enabled, which shadow map range (cascade) to render
         * @type Number
         */
        this._shadowMapDebugRangeIndex = 0;
        /**
         * The shader used to render a shadow map on the screen for debugging
         * @type ManagedShader
         */
        this._shadowMapDebugShader = null;
        this._initNodes();
        this.clearPointLights();
        this._setGeneralUniformValueFunctions();
    }
    /**
     * Scenes can be rendered in one of these stereoscopic modes
     * @enum String
     */
    Scene.StereoscopicMode = {
        /** Non-stereoscopig (plain, simple) rendering */
        NONE: "none",
        /** Anaglyph stereoscopic rendering - the scene rendered twice, on top of itself, using two different color filters */
        ANAGLYPH: "anaglyph",
        /** Side by side stereoscopic rendering - the scene rendered twice, reduced to 50% horizontal size, on the left and right side of the viewport */
        SIDE_BY_SIDE: "sideBySide"
    };
    /**
     * Set the color to use when clearing the buffer (RGBA components).
     * @param {Number[4]} value
     */
    Scene.prototype.setClearColor = function (value) {
        this._clearColor = value;
    };
    /**
     * Set the color of ambient light in the scene
     * @param {Number[3]} value
     */
    Scene.prototype.setAmbientColor = function (value) {
        this._ambientColor = value;
    };
    /**
     * Sets the uniform value functions for the scene that can be used to set all the uniforms referring to data that belongs to the whole
     * scene. After this, any shader used when rendering objects of this scene using any of these uniforms will get the data.
     */
    Scene.prototype._setGeneralUniformValueFunctions = function () {
        this.setUniformValueFunction(UNIFORM_AMBIENT_COLOR_NAME, function () {
            return this._ambientColor;
        });
        this.setUniformValueFunction(UNIFORM_NUM_DIRECTIONAL_LIGHTS_NAME, function () {
            return this._renderedDirectionalLights;
        });
        this.setUniformValueFunction(UNIFORM_DIRECTIONAL_LIGHTS_ARRAY_NAME, function () {
            return this._directionalLightUniformData;
        });
        this.setUniformValueFunction(UNIFORM_NUM_POINT_LIGHTS_NAME, function () {
            return this._renderedPointLights;
        });
        this.setUniformValueFunction(UNIFORM_POINT_LIGHTS_ARRAY_NAME, function () {
            return this._pointLightUniformData;
        });
        this.setUniformValueFunction(UNIFORM_NUM_SPOT_LIGHTS_NAME, function () {
            return this._renderedSpotLights;
        });
        this.setUniformValueFunction(UNIFORM_SPOT_LIGHTS_ARRAY_NAME, function () {
            return this._spotLightUniformData;
        });
        this.setCameraUniformValueFunction(UNIFORM_VIEW_MATRIX_NAME, function () {
            return this._camera.getViewMatrix();
        });
        this.setCameraUniformValueFunction(UNIFORM_VIEW_ORIENTATION_MATRIX_NAME, function () {
            return this._camera.getInverseOrientationMatrix();
        });
        this.setCameraUniformValueFunction(UNIFORM_VIEW_ASPECT_NAME, function () {
            return this._camera.getAspect();
        });
        this.setCameraUniformValueFunction(UNIFORM_PROJECTION_MATRIX_NAME, function () {
            return this._camera.getProjectionMatrix();
        });
        this.setCameraUniformValueFunction(UNIFORM_VIEW_PROJECTION_MATRIX_NAME, function () {
            return mat.prod4Aux(this._camera.getViewMatrix(), this._camera.getProjectionMatrix());
        });
        this.setCameraUniformValueFunction(UNIFORM_EYE_POSITION_VECTOR_NAME, function () {
            return vec.floatVector3Aux(this._camera.getCameraPositionVector());
        });
    };
    /**
     * Sets the uniform value functions for the scene that can be used to set all the uniforms referring to data that is uniform for all
     * objects within this scene while rendering to the associated context with the passed index. (but might be different for different
     * contexts)
     * @param {Number} contextIndex
     */
    Scene.prototype._setContextUniformValueFunctions = function (contextIndex) {
        var gl = this._contexts[contextIndex].gl,
                viewportSize = [0, 0];
        this.setContextUniformValueFunction(contextIndex, UNIFORM_VIEWPORT_SIZE_NAME, function () {
            viewportSize[0] = gl.drawingBufferWidth * this._width;
            viewportSize[1] = gl.drawingBufferHeight * this._height;
            return viewportSize;
        });
    };
    /**
     * Sets the uniform value functions for the uniforms that are needed by shaders that want to use shadow mapping to provide the up-to-date
     * data for this scene.
     * @param {Number} [contextIndex] Shadow maps to be passed to uniforms are different for each context, and so this index tells which
     * context (of the ones the scene has been added to) do the functions need to be set for. If omitted, they will be set for all associated
     * contexts.
     */
    Scene.prototype._setShadowMappedShaderUniformValueFunctions = function (contextIndex) {
        var i;
        // there are some functions that are the same for all contexts, so only set these once, when the first context is chosen
        if (contextIndex === 0) {
            this.setConstantUniformValueFunction(UNIFORM_SHADOW_MAPPING_RANGES_ARRAY_NAME, function () {
                return this._shadowMapRanges;
            });
            this.setConstantUniformValueFunction(UNIFORM_SHADOW_MAPPING_SHADOW_MAP_SAMPLE_OFFSET_ARRAY_NAME, function () {
                return this._shadowMapSampleOffsets;
            });
        }
        // if a specific index was given, set the values functions for that context
        if (contextIndex !== undefined) {
            // NOTE: if multiple scenes use the same, shadow-map-utilizing shader, the uniform value set below will clash 
            // as it is specified as a constant, set only for the first frame
            // However, this is not a use case for now, so we can skip updating the uniform for better performance
            // To avoid clashing the below code should be refactored so that the function simply returns the array, which is
            // created during the first frame
            this.setContextConstantUniformValueFunction(contextIndex, UNIFORM_SHADOW_MAPPING_SHADOW_MAPS_ARRAY_NAME, function () {
                var j, k, shadowMaps = [];
                for (j = 0; (j < this._directionalLights.length) && (j < this._maxRenderedDirectionalLights); j++) {
                    for (k = 0; k < this._shadowMapRanges.length; k++) {
                        shadowMaps.push(this._contexts[contextIndex].getFrameBuffer(this._directionalLights[j].getShadowMapBufferName(k)).getLastTextureBindLocation(this._contexts[contextIndex].getName()));
                    }
                }
                return new Int32Array(shadowMaps);
            });
            // if no specific index was given, set the functions up for all contexts
        } else {
            for (i = 0; i < this._contexts.length; i++) {
                this._setShadowMappedShaderUniformValueFunctions(i);
            }
        }
    };
    /**
     * Updates the data of static lights sources of the scene and sets it up to be used in shaders.
     * This needs to be called to update the light matrices used in shadow mapped shaders.
     */
    Scene.prototype._updateStaticLightUniformData = function () {
        var i;
        this._renderedDirectionalLights = Math.min(this._directionalLights.length, this._maxRenderedDirectionalLights);
        // for directional lights, simply collect all the up-to-date data from all the lights
        for (i = 0; i < this._renderedDirectionalLights; i++) {
            this._directionalLightUniformData[i] = this._directionalLights[i].getUniformData();
        }
        if (i < this._maxRenderedDirectionalLights) {
            // when setting uniforms, ignore the irrelevant part of the array
            this._directionalLightUniformData[i] = null;
        }
    };
    /**
     * Clears the data stored for uniforms about dynamic light sources, so after calling this, the
     * data will not be sent to shaders when assigning scene uniforms.
     */
    Scene.prototype._clearDynamicLightUniformData = function () {
        this._renderedPointLights = 0;
        this._pointLightUniformData[0] = null;
        this._renderedSpotLights = 0;
        this._spotLightUniformData[0] = null;
    };
    /**
     * Updates the calculated data about the stored dynamic light sources to up-to-date state for the current render step and collects them in
     * a format that can be sent to the shaders. Those properties of light sources that are needed only for rendering are not calculated
     * if the light source cannot be rendered in this step.
     * @param {Number} dt The time elapsed since the last update, in milliseconds.
     */
    Scene.prototype._updateDynamicLightUniformData = function (dt) {
        var i, j, count, max;
        // for point lights, collect the lights to be rendered going through the priority lists, starting from the highest priority, and
        // perform a full update (including e.g. world position calculation) only for those light sources that can be rendered
        for (i = 0, count = 0; (i < this._pointLightPriorityArrays.length); i++) {
            for (j = 0; (j < this._pointLightPriorityArrays[i].length) && (count < this._maxRenderedPointLights); j++) {
                if (this._pointLightPriorityArrays[i][j].isVisible()) {
                    this._pointLightPriorityArrays[i][j].update(dt);
                    if (this._pointLightPriorityArrays[i][j].shouldBeRendered(this._camera)) {
                        this._pointLightUniformData[count] = this._pointLightPriorityArrays[i][j].getUniformData();
                        count++;
                    }
                }
            }
            // for the lights sources in this priority list that cannot be rendered, the state still needs to be updated to make sure if
            // they get rendered at one point, their state will be correct
            while (j < this._pointLightPriorityArrays[i].length) {
                if (this._pointLightPriorityArrays[i][j].isVisible()) {
                    this._pointLightPriorityArrays[i][j].updateState(dt);
                }
                j++;
            }
        }
        this._renderedPointLights = count;
        if (count < this._maxRenderedPointLights) {
            this._pointLightUniformData[count] = null; // when setting the uniforms, ignore the irrelevant part of the array
        }
        // for spot lights, only calculate the rendered ones fully, like with point lights, but there are no priorities here
        count = 0;
        for (i = 0, max = Math.min(this._spotLights.length, this._maxRenderedSpotLights); (i < this._spotLights.length) && (count < max); i++) {
            if (this._spotLights[i].isVisible()) {
                this._spotLights[i].update(dt);
                if (this._spotLights[i].shouldBeRendered(this._camera)) {
                    this._spotLightUniformData[count] = this._spotLights[i].getUniformData();
                    count++;
                }
            }
        }
        this._renderedSpotLights = count;
        if (count < this._maxRenderedSpotLights) {
            this._spotLightUniformData[count] = null; // when setting the uniforms, ignore the irrelevant part of the array
        }
    };
    /**
     * Returns the framebuffer name prefix to use for the shadow maps for the light with the given index.
     * @param {Number} lightIndex
     * @returns {String}
     */
    Scene.prototype._getShadowMapBufferNamePrefix = function (lightIndex) {
        return SHADOW_MAP_BUFFER_NAME_PREFIX + lightIndex + SHADOW_MAP_BUFFER_NAME_INFIX;
    };
    /**
     * Returns the width a rendering of this scene should use when rendered on the passed context, in pixels.
     * @param {ManagedGLContext} context
     * @returns {Number}
     */
    Scene.prototype._getWidthInPixels = function (context) {
        return context.gl.drawingBufferWidth * this._width;
    };
    /**
     * Returns the height a rendering of this scene should use when rendered on the passed context, in pixels.
     * @param {ManagedGLContext} context
     * @returns {Number}
     */
    Scene.prototype._getHeightInPixels = function (context) {
        return context.gl.drawingBufferHeight * this._height;
    };
    /**
     * Does all preparations needed to render the scene to the associated context with the given index, according to the current scene 
     * settings. If no index is given, preparations are done for all contexts.
     * @param {Number} [contextIndex]
     */
    Scene.prototype._setupContext = function (contextIndex) {
        var i, context;
        this._constantUniformsUpdated.clear();
        // if a specific index is given, set up the corresponding context
        if (contextIndex !== undefined) {
            context = this._contexts[contextIndex];
            this._setContextUniformValueFunctions(contextIndex);
            // if shadow mapping is to be used, some additional preparations are needed
            if (this._shadowMappingEnabled) {
                context.addShader(this._shadowMappingShader);
                this._setShadowMappedShaderUniformValueFunctions(contextIndex);
            }
            for (i = 0; (i < this._directionalLights.length) && (i < this._maxRenderedDirectionalLights); i++) {
                this._directionalLights[i].addToContext(this._contexts[contextIndex], this._shadowMappingEnabled, this._getShadowMapBufferNamePrefix(i), this._shadowMapRanges.length, this._shadowMapTextureSize);
            }
            // set up stereoscopic rendering
            if (this._stereoscopicMode !== Scene.StereoscopicMode.NONE) {
                // set up anaglyph stereoscopic rendering
                if (this._stereoscopicMode === Scene.StereoscopicMode.ANAGLYPH) {
                    context.addShader(this._redShader);
                    context.addShader(this._cyanShader);
                    // set up side by side stereoscopic rendering
                } else if (this._stereoscopicMode === Scene.StereoscopicMode.SIDE_BY_SIDE) {
                    context.addShader(this._leftShader);
                    context.addShader(this._rightShader);
                }
                this._stereoscopicFrameBuffer = this._stereoscopicFrameBuffer || new managedGL.FrameBuffer(STEREOSCOPY_FRAMEBUFFER_NAME,
                        this._getWidthInPixels(context), this._getHeightInPixels(context), false);
                context.addFrameBuffer(this._stereoscopicFrameBuffer);
                this._fvq = this._fvq || egomModel.fvqModel(FVQ_NAME);
                this._fvq.addToContext(context, false);
            }
            if (this._shadowMapDebugging) {
                context.addShader(this._shadowMapDebugShader);
                this._fvq = this._fvq || egomModel.fvqModel(FVQ_NAME);
                this._fvq.addToContext(context, false);
            }
        } else {
            // if no specific index is given, set up all associated contexts
            for (i = 0; i < this._contexts.length; i++) {
                this._setupContext(i);
            }
        }
    };
    /**
     * Sets the scene up for anaglyph stereoscopic rendering mode, according to the passed parameters.
     * Call before setting up the contexts!
     * @param {Object} params
     */
    Scene.prototype.setAnaglyphRendering = function (params) {
        this._stereoscopicMode = Scene.StereoscopicMode.ANAGLYPH;
        this._redShader = params.redShader;
        this._cyanShader = params.cyanShader;
        if (params.interocularDistance !== undefined) {
            this._camera.setInterocularDistance(params.interocularDistance);
        }
        if (params.convergenceDistance !== undefined) {
            this._camera.setStereoscopicConvergenceDistance(params.convergenceDistance);
        }
    };
    /**
     * Sets the scene up for side by side stereoscopic rendering mode, according to the passed parameters.
     * Call before setting up the contexts!
     * @param {Object} params
     */
    Scene.prototype.setSideBySideRendering = function (params) {
        this._stereoscopicMode = Scene.StereoscopicMode.SIDE_BY_SIDE;
        this._leftShader = params.leftShader;
        this._rightShader = params.rightShader;
        if (params.interocularDistance !== undefined) {
            this._camera.setInterocularDistance(params.interocularDistance);
        }
        if (params.convergenceDistance !== undefined) {
            this._camera.setStereoscopicConvergenceDistance(params.convergenceDistance);
        }
        if (params.originalAspect !== undefined) {
            this._sideBySideOriginalAspect = params.originalAspect;
        }
    };
    /**
     * Sets the scene up for rendering shadow maps for debugging
     * @param {Object} params
     */
    Scene.prototype.setupShadowMapDebugging = function (params) {
        this._shadowMapDebugging = true;
        this._shadowMapDebugShader = params.shader;
        this._shadowMapDebugLightIndex = params.lightIndex || 0;
        this._shadowMapDebugRangeIndex = params.rangeIndex || 0;
    };
    /**
     * Sets new relative coordinates for the viewport of this scene - when the scene is rendered to a canvas, its viewport will be 
     * calculated by scaling these relative coordinates to the size of the canvas.
     * @param {Number} left
     * @param {Number} bottom
     * @param {Number} width
     * @param {Number} height
     */
    Scene.prototype.setRelativeViewport = function (left, bottom, width, height) {
        this._left = left;
        this._bottom = bottom;
        this._width = width;
        this._height = height;
    };
    /**
     * The scene can be rendered on a managed context after it has been added to it using this function. This makes sure the context is
     * prepared correctly, with all the resources such as vertex and frame buffers needed to render this scene are added. After this,
     * the setup function of the managed context needs to be called to make sure all the data from the scene is pulled to the buffers.
     * @param {ManagedGLContext} context
     */
    Scene.prototype.addToContext = function (context) {
        var contextIndex = this._contexts.findIndex(function (element) {
            return element.getName() === context.getName();
        });
        if (contextIndex < 0) {
            this._contexts.push(context);
            contextIndex = this._contexts.length - 1;
        }
        this._setupContext(contextIndex);
        // adding all the nodes
        this._rootBackgroundNode.addToContext(context);
        this._rootNode.addToContext(context);
        this._rootUINode.addToContext(context);
        this._rootResourceNode.addToContext(context);
    };
    /**
     * If the shadow mapping properties were appropriately set up, after this call the scene will be rendered using shadow mapping.
     */
    Scene.prototype.enableShadowMapping = function () {
        if (this._shadowMappingShader && this._shadowMapRanges.length > 0) {
            this._shadowMappingEnabled = true;
            this._setupContext();
        } else {
            application.showError("Cannot enable shadow mapping, as no shadow mapping shader or no shadow mapping ranges were specified");
        }
    };
    /**
     * After this call, the scene will be rendered without using shadow mapping.
     */
    Scene.prototype.disableShadowMapping = function () {
        this._shadowMappingEnabled = false;
    };
    /**
     * Switches whether shadow mapping for this scene is turned on to its opposite state.
     */
    Scene.prototype.toggleShadowMapping = function () {
        this._shadowMappingEnabled = !this._shadowMappingEnabled;
        if (this._shadowMappingEnabled) {
            this.enableShadowMapping();
        } else {
            this.disableShadowMapping();
        }
    };
    /**
     * Sets a new list of shadow map ranges to use when rendering this scene.
     * @param {Number[]} ranges
     */
    Scene.prototype.setShadowMapRanges = function (ranges) {
        this._shadowMapRanges = new Float32Array(ranges);
        this._setupContext();
    };
    /**
     * @typedef Scene~ShadowMappingParams
     * @property {Boolean} [enable]
     * @property {ManagedShader} [shader]
     * @property {Number} [textureSize]
     * @property {Number[]} [ranges]
     * @property {Number} [depthRatio]
     * @property {Number} [numSamples]
     * @property {Boolean} [deferSetup=false]
     */
    /**
     * Sets the parameters of shadow mapping that are defined in the passed object, and leaves the others at their current value. If there
     * is no object passed, resets all shadow mapping parameters to their void value.
     * @param {Scene~ShadowMappingParams} [params]
     */
    Scene.prototype.setShadowMapping = function (params) {
        if (params) {
            this._shadowMappingEnabled = (params.enable !== undefined) ? params.enable : this._shadowMappingEnabled;
            this._shadowMappingShader = params.shader || this._shadowMappingShader;
            this._shadowMapTextureSize = params.textureSize || this._shadowMapTextureSize;
            this._shadowMapRanges = params.ranges ? new Float32Array(params.ranges) : this._shadowMapRanges;
            this._shadowMapDepthRatio = params.depthRatio || this._shadowMapDepthRatio;
            this._numShadowMapSamples = params.numSamples ? types.getNumberValueInRange(
                    "shadowMappingParams.numSamples",
                    params.numSamples,
                    this._shadowMappingEnabled ? 1 : 0,
                    this._shadowMappingEnabled ? SHADOW_MAP_SAMPLE_OFFSETS.length / 2 : 0,
                    this._shadowMappingEnabled ? 1 : 0) : params.numSamples;
            this._shadowMapSampleOffsets = SHADOW_MAP_SAMPLE_OFFSETS.slice(0, 2 * this._numShadowMapSamples);
            if (!params.deferSetup) {
                this._setupContext();
            }
        } else {
            this._shadowMappingEnabled = false;
            this._shadowMappingShader = null;
            this._shadowMapTextureSize = 0;
            this._shadowMapRanges = new Float32Array([]);
            this._shadowMapDepthRatio = 0;
            this._numShadowMapSamples = 0;
            this._shadowMapSampleOffsets = [];
        }
        this._constantUniformsUpdated.clear();
    };
    /**
     * 
     * @returns {RenderableNode}
     */
    Scene.prototype.getRootNode = function () {
        return this._rootNode;
    };
    /**
     * Returns the camera that is used when rendering this scene.
     * @returns {Camera}
     */
    Scene.prototype.getCamera = function () {
        return this._camera;
    };
    /**
     * Returns whether this scene is set to animate when it is rendered.
     * @returns {Boolean}
     */
    Scene.prototype.shouldAnimate = function () {
        return this._shouldAnimate;
    };
    /**
     * Sets whether this scene should animate when it is rendered.
     * @param {Boolean} value
     */
    Scene.prototype.setShouldAnimate = function (value) {
        this._shouldAnimate = value;
    };
    /**
     * Sets whether this scene should update its camera's state when it is rendered.
     * @param {Boolean} value
     */
    Scene.prototype.setShouldUpdateCamera = function (value) {
        this._shouldUpdateCamera = value;
    };
    /**
     * Adds a new node containing the passed renderable object to be rendered among the background objects of this scene. The background
     * objects are rendered before the main scene objects, without depth checking, on top of each other in the order they were added.
     * @param {RenderableObject} backgroundObject The object to add.
     * @returns {RenderableNode} The node that was created to contain the passed object.
     */
    Scene.prototype.addBackgroundObject = function (backgroundObject) {
        var node = new RenderableNode(backgroundObject, false);
        this._rootBackgroundNode.addSubnode(node);
        return node;
    };
    /**
     * Adds a new node containing the passed renderable object to be rendered among the main scene objects of this scene. 
     * If the passed object already has an associated node, uses that one instead.
     * @param {RenderableObject} newObject The object to add.
     * @param {Boolean} [renderedToShadowMap=true] If false, the node for this object and its subnodes will never be rendered to shadow maps
     * @param {Boolean} [instancing=false] When true, the object will be rendered using instancing.
     * @returns {RenderableNode} The node that was created / used to contain the passed object.
     */
    Scene.prototype.addObject = function (newObject, renderedToShadowMap, instancing) {
        var node = newObject.getNode() || new RenderableNode(newObject, renderedToShadowMap, false, instancing);
        this._rootNode.addSubnode(node);
        return node;
    };
    /**
     * Adds the given node to the main scene object nodes of this scene, and returns it for convenience.
     * @param {RenderableNode} node
     * @returns {RenderableNode}
     */
    Scene.prototype.addNode = function (node) {
        this._rootNode.addSubnode(node);
        return node;
    };
    /**
     * Adds a new node to the UI node tree, which will be rendered atop the background and main scene objects, without depth buffer.
     * @param {RebderableObject} uiObject
     * @returns {RenderableNode} The node that was created to contain the passed object.
     */
    Scene.prototype.addUIObject = function (uiObject) {
        var node = new RenderableNode(uiObject, false);
        this._rootUINode.addSubnode(node);
        return node;
    };
    /**
     * Adds the passed renderable object to all contexts this scene is associated with. Should be called when the node or an ancestor of the
     * node of an object is added to this scene. (automatically called by RenderableNode)
     * @param {RenderableObject} renderableObject
     */
    Scene.prototype.addObjectToContexts = function (renderableObject) {
        var i;
        for (i = 0; i < this._contexts.length; i++) {
            renderableObject.addToContext(this._contexts[i]);
        }
    };
    /**
     * Adds the passed object to the list of objects that moved (by calling translatev() on them) when the scene is moved to follow the camera
     * @param {Object} object
     */
    Scene.prototype.addObjectToMove = function (object) {
        this._objectsToMove.push(object);
    };
    /**
     * Clears all nodes and lights from the scene.
     * @param {Boolean} [hard=false] If true, also removes the list references from the nodes.
     */
    Scene.prototype.clear = function (hard) {
        this.clearNodes(hard);
        this.clearDirectionalLights();
        this.clearPointLights();
        this.clearSpotLights();
    };
    /**
     * Initializes the root nodes for this scene.
     */
    Scene.prototype._initNodes = function () {
        // we are adding RenderableObject3D so if nodes with object 3D-s are added, they will have a parent with position and orientation
        // a size of 0 is specified so that no child 3D objects will ever think they are inside their parent
        this._rootBackgroundNode = new RenderableNode(new renderableObjects.RenderableObject3D(null, false, false, mat.IDENTITY4, mat.IDENTITY4, mat.IDENTITY4, undefined, 0, false, true), false);
        this._rootBackgroundNode.setScene(this);
        this._rootNode = new RenderableNode(new renderableObjects.RenderableObject3D(null, false, false, mat.IDENTITY4, mat.IDENTITY4, mat.IDENTITY4, undefined, 0, false, true));
        this._rootNode.setScene(this);
        this._rootResourceNode = new RenderableNode(new renderableObjects.RenderableObject3D(null, false, false, mat.IDENTITY4, mat.IDENTITY4, mat.IDENTITY4, undefined, 1, false, true), false);
        this._rootResourceNode.setScene(this);
        this._resourceObjectIDs = {};
        this._rootUINode = new RenderableNode(new renderableObjects.RenderableObject3D(null, false, false, mat.IDENTITY4, mat.IDENTITY4, mat.IDENTITY4, undefined, 0, false, true), false);
        this._rootUINode.setScene(this);
        this._objectsToMove = [];
    };
    /**
     * Clears all added nodes from this scene.
     * @param {Boolean} [hard=false] If true, also removes the list references from the nodes.
     */
    Scene.prototype.clearNodes = function (hard) {
        if (this._rootBackgroundNode) {
            this._rootBackgroundNode.removeSubnodes(hard);
        }
        if (this._rootNode) {
            this._rootNode.removeSubnodes(hard);
        }
        if (this._rootResourceNode) {
            this._rootResourceNode.removeSubnodes(hard);
        }
        this._resourceObjectIDs = {};
        if (this._rootUINode) {
            this._rootUINode.removeSubnodes(hard);
        }
        this._objectsToMove.length = 0;
    };
    /**
     * Removes all the previously added directional light sources from the scene.
     */
    Scene.prototype.clearDirectionalLights = function () {
        this._directionalLights = [];
    };
    /**
     * Removes all the previously added point light sources from the scene.
     */
    Scene.prototype.clearPointLights = function () {
        var i;
        this._pointLightPriorityArrays = new Array(MAX_POINT_LIGHT_PRIORITIES);
        for (i = 0; i < MAX_POINT_LIGHT_PRIORITIES; i++) {
            this._pointLightPriorityArrays[i] = [];
        }
    };
    /**
     * Removes all the previously added spot light sources from the scene.
     */
    Scene.prototype.clearSpotLights = function () {
        this._spotLights = [];
    };
    /**
     * Returns an array containing all the top level main objects of the scene.
     * @returns {RenderableObject[]}
     */
    Scene.prototype.getAllObjects = function () {
        var result = [], subnode, subnodes = this._rootNode.getSubnodes();
        for (subnode = subnodes.getFirst(); subnode; subnode = subnode.next) {
            result.push(subnode.getRenderableObject());
        }
        return result;
    };
    /**
     * Returns an array containing all the top level main objects of the scene that have functions defined to access their position and 
     * orientation.
     * @returns {RenderableObject3D[]}
     */
    Scene.prototype.getAll3DObjects = function () {
        var o, result = [], subnode, subnodes = this._rootNode.getSubnodes();
        for (subnode = subnodes.getFirst(); subnode; subnode = subnode.next) {
            o = subnode.getRenderableObject();
            if (o.getPositionMatrix && o.getOrientationMatrix) {
                result.push(o);
            }
        }
        return result;
    };
    /**
     * Moves (translates) all movable root level main object in the scene by the passed vector.
     * @param {Number[3]} v A 3D vector.
     */
    Scene.prototype.moveAllObjectsByVector = function (v) {
        var i, o, subnode, subnodes = this._rootNode.getSubnodes();
        for (subnode = subnodes.getFirst(); subnode; subnode = subnode.next) {
            o = subnode.getRenderableObject();
            if (o.translatev) {
                o.translatev(v);
            }
        }
        for (i = 0; i < this._objectsToMove.length; i++) {
            this._objectsToMove[i].translatev(v);
        }
    };
    /**
     * If the current positon of the scene's camera exceeds plus/minus the given limit on any of the three axes, moves the camera back to 
     * the origo and moves all the objects in the scene to stay in sync with the camera as well as returns the vector by which the objects
     * have been moved. Otherwise returns null.
     * @param {Number} limit
     * @returns {Number[3]|null}
     */
    Scene.prototype.moveCameraToOrigoIfNeeded = function (limit) {
        var result = this._camera.moveToOrigoIfNeeded(limit);
        if (result) {
            this.moveAllObjectsByVector(result);
        }
        return result;
    };
    /**
     * Returns the node storing the first added main scene object.
     * @returns {RenderableNode}
     */
    Scene.prototype.getFirstNode = function () {
        return this._rootNode.getFirstSubnode();
    };
    /**
     * Returns the node coming after the passed one among the nodes storing the main scene objects.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    Scene.prototype.getNextNode = function (currentNode) {
        return this._rootNode.getNextSubnode(currentNode);
    };
    /**
     * Returns the node coming before the passed one among the nodes storing the main scene objects.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    Scene.prototype.getPreviousNode = function (currentNode) {
        return this._rootNode.getPreviousSubnode(currentNode);
    };
    /**
     * Returns whether the resources of an object have already been added to the scene with the passed ID
     * @param {String} id
     * @returns {Boolean}
     */
    Scene.prototype.hasResourcesOfObject = function (id) {
        return !!this._resourceObjectIDs[id];
    };
    /**
     * Marks the resources of the passed renderable object to be added to any contexts this scene will get added to. This will make it 
     * possible to dynamically add objects of this type to the scene after it has already been added to a context, as its resources (such
     * as vertices in the vertex buffers of the context) will be available.
     * @param {RenderableObject} [object] Can be omitted, in which case the passed id will simply be marked as having its resources added
     * @param {String} [id] If given, the resources will only be added if no other object has been added with the same ID as this before
     */
    Scene.prototype.addResourcesOfObject = function (object, id) {
        var node;
        if (!id || !this._resourceObjectIDs[id]) {
            if (object) {
                node = new RenderableNode(object, false);
                this._rootResourceNode.addSubnode(node, true);
                // mark it as reusable so in case this is a pooled object, the pooled instance can be marked free
                node.markAsReusable(false);
            }
            if (id) {
                this._resourceObjectIDs[id] = true;
            }
        }
    };
    /**
     * Adds the passed directional light source to this scene.
     * @param {DirectionalLightSource} lightSource
     */
    Scene.prototype.addDirectionalLightSource = function (lightSource) {
        this._directionalLights.push(lightSource);
    };
    /**
     * Adds the passed point light source to this scene with the given priority. The highest priority is 0 and larger number means lower
     * priority, with the number of available priority determined by MAX_POINT_LIGHT_PRIORITIES. If there are more point light sources in
     * the scene than the rendering limit, the ones with the higher priority will be rendered.
     * @param {PointLightSource} lightSource
     * @param {Number} priority
     */
    Scene.prototype.addPointLightSource = function (lightSource, priority) {
        priority = Math.min(priority || 0, MAX_POINT_LIGHT_PRIORITIES - 1);
        this._pointLightPriorityArrays[priority].push(lightSource);
    };
    /**
     * Adds the passed spot light source to this scene.
     * @param {SpotLightSource} lightSource
     */
    Scene.prototype.addSpotLightSource = function (lightSource) {
        this._spotLights.push(lightSource);
    };
    /**
     * Returns the LOD context containing the settings that govern how the LOD of multi-LOD models is chosen when rendering this scene.
     * @returns {LODContext}
     */
    Scene.prototype.getLODContext = function () {
        return this._lodContext;
    };
    /**
     * Sets the passed function to be called when a shader asks for the value of a non-camera-related uniform (which need to be updated
     * once every frame) with the given name while rendering this scene. The name given here is appropriately prefixed/suffixed by ManagedGL. 
     * The value of this will be the scene instance, when calling the function.
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setUniformValueFunction = function (rawUniformName, valueFunction) {
        this._uniformValueFunctions[managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Same as setUniformValueFunction, but for camera-related uniforms (which might need to be updated multiple times during one
     * frame, such as for extended or stereoscopic cameras)
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setCameraUniformValueFunction = function (rawUniformName, valueFunction) {
        this._cameraUniformValueFunctions[managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Same as setUniformValueFunction, but for uniforms which only need to be updated when the contexts are set up.
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setConstantUniformValueFunction = function (rawUniformName, valueFunction) {
        this._constantUniformValueFunctions[managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Sets the passed function to be called when a shader asks for the value of a uniform with the given name while rendering this scene to
     * the associated context with the given index.
     * The name given here is appropriately prefixed/suffixed by ManagedGL. The value of this will be the scene instance, when calling the
     * function.
     * Use for uniforms which need to be updated every frame.
     * @param {Number} contextIndex
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setContextUniformValueFunction = function (contextIndex, rawUniformName, valueFunction) {
        if (!this._contextUniformValueFunctions[contextIndex]) {
            this._contextUniformValueFunctions[contextIndex] = {};
        }
        this._contextUniformValueFunctions[contextIndex][managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Same as setContextUniformValueFunction, but for uniforms which only need to be updated when the context is set up.
     * @param {Number} contextIndex
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setContextConstantUniformValueFunction = function (contextIndex, rawUniformName, valueFunction) {
        if (!this._contextConstantUniformValueFunctions[contextIndex]) {
            this._contextConstantUniformValueFunctions[contextIndex] = {};
        }
        this._contextConstantUniformValueFunctions[contextIndex][managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Adds a new camera configuration that will be associated with the scene itself.
     * @param {CameraConfiguration} cameraConfiguration
     */
    Scene.prototype.addCameraConfiguration = function (cameraConfiguration) {
        this._rootNode.addCameraConfiguration(cameraConfiguration);
    };
    /**
     * Returns whether the given camera configuration is among the ones associated with this scene.
     * @param {CameraConfiguration} cameraConfiguration
     * @returns {Boolean}
     */
    Scene.prototype.hasCameraConfiguration = function (cameraConfiguration) {
        return this._rootNode.hasCameraConfiguration(cameraConfiguration);
    };
    /**
     * Returns the camera configuration the comes after the one passed as parameter in the list of associated camera configurations.
     * If the last configuration is passed, returns the first one. Returns the first configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * @param {CameraConfiguration} [currentCameraConfiguration]
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getNextCameraConfiguration = function (currentCameraConfiguration) {
        return this._rootNode.getNextCameraConfiguration(currentCameraConfiguration);
    };
    /**
     * Returns the camera configuration the comes before the one passed as parameter in the list of associated camera configurations.
     * If the first configuration is passed, returns the last one. Returns the last configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * @param {CameraConfiguration} [currentCameraConfiguration]
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getPreviousCameraConfiguration = function (currentCameraConfiguration) {
        return this._rootNode.getPreviousCameraConfiguration(currentCameraConfiguration);
    };
    /**
     * Returns a list of the associated camera configurations that have the specified name.
     * @param {String} name
     * @returns {CameraConfiguration[]}
     */
    Scene.prototype.getCameraConfigurationsWithName = function (name) {
        return this._rootNode.getCameraConfigurationsWithName(name);
    };
    /**
     * Hides the UI node tree (it will not be rendered in subsequent render calls until shown again)
     */
    Scene.prototype.hideUI = function () {
        this._rootUINode.hide();
    };
    /**
     * Shows the UI node tree (it will be rendered in subsequent render calls until hidden)
     */
    Scene.prototype.showUI = function () {
        this._rootUINode.show();
    };
    /**
     * Assigns all uniforms in the given shader program that the scene has a value function for, using the appropriate webGL calls.
     * The matching is done based on the names of the uniforms.
     * @param {ManagedGLContext} context 
     * @param {ManagedShader} shader
     */
    Scene.prototype.assignUniforms = function (context, shader) {
        if (!this._uniformsUpdated.has(shader)) {
            shader.assignUniforms(context, this._uniformValueFunctions);
            shader.assignUniforms(context, this._contextUniformValueFunctions[this._contexts.indexOf(context)]);
            this._uniformsUpdated.add(shader);
            this._uniformsUpdatedForFrame = true;
        }
        if (!this._cameraUniformsUpdated.has(shader)) {
            shader.assignUniforms(context, this._cameraUniformValueFunctions);
            this._cameraUniformsUpdated.add(shader);
        }
        if (!this._constantUniformsUpdated.has(shader)) {
            shader.assignUniforms(context, this._constantUniformValueFunctions);
            shader.assignUniforms(context, this._contextConstantUniformValueFunctions[this._contexts.indexOf(context)]);
            this._constantUniformsUpdated.add(shader);
        }
    };
    /**
     * Cleans up the light sources, removing the ones that no longer have an active source object.
     */
    Scene.prototype.cleanUpLights = function () {
        var i, j, k, prio;
        // cleaning up dynamic point light sources
        for (prio = 0; prio < this._pointLightPriorityArrays.length; prio++) {
            for (i = 0; i < this._pointLightPriorityArrays[prio].length; i++) {
                j = i;
                k = 0;
                while ((j < this._pointLightPriorityArrays[prio].length) && ((!this._pointLightPriorityArrays[prio][j]) || (this._pointLightPriorityArrays[prio][j].canBeReused() === true))) {
                    j++;
                    k++;
                }
                this._pointLightPriorityArrays[prio].splice(i, k);
            }
        }
        // cleaning up dynamic spot light sources 
        for (i = 0; i < this._spotLights.length; i++) {
            j = i;
            k = 0;
            while ((j < this._spotLights.length) && ((!this._spotLights[j]) || (this._spotLights[j].canBeReused() === true))) {
                j++;
                k++;
            }
            this._spotLights.splice(i, k);
        }
    };
    /**
     * Renders the main scene objects for a shadow map after it has been set up appropriately for a light source and shadow map range.
     * This method only performs the rendering itself (clearing the background and rendering the nodes on it)
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     * @param {DirectionalLight} light
     */
    Scene.prototype._renderShadowMap = function (context, widthInPixels, heightInPixels, light) {
        var gl = context.gl, i, newShadowQueue;
        application.log_DEBUG("Starting new shadow map...", 4);
        if (this._shadowQueue.length > 0) {
            if (managedGL.areDepthTexturesAvailable()) {
                gl.clear(gl.DEPTH_BUFFER_BIT);
            } else {
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            }
            newShadowQueue = [];
            for (i = 0; i < this._shadowQueue.length; i++) {
                if (this._shadowQueue[i].renderToShadowMap(context, widthInPixels, heightInPixels, light)) {
                    newShadowQueue.push(this._shadowQueue[i]);
                }
            }
            this._shadowQueue = newShadowQueue;
        }
    };
    /**
     * If shadow mapping is enabled, renders all the shadow maps according to the current settings to separate textures, and binds all these
     * textures to be used by subsequent shaders.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     */
    Scene.prototype._renderShadowMaps = function (context, widthInPixels, heightInPixels) {
        var i, j, gl = context.gl, subnode;
        // rendering the shadow maps, if needed
        if (this._shadowMappingEnabled) {
            application.log_DEBUG("Rendering shadow maps for scene...", 4);
            // common GL state setup
            gl.viewport(0, 0, this._shadowMapTextureSize, this._shadowMapTextureSize);
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            context.setColorMask(COLOR_MASK_ALL_TRUE);
            context.disableBlending();
            context.setDepthMask(true);
            // choosing the shadow map shader
            context.setCurrentShader(this._shadowMappingShader);
            this.assignUniforms(context, this._shadowMappingShader);
            // rendering for each light source and shadow map range
            for (i = 0; (i < this._directionalLights.length) && (i < this._maxRenderedDirectionalLights); i++) {
                this._directionalLights[i].reset();
                this._shadowQueue = new Array(this._rootNode.getSubnodes().getLength());
                for (j = 0, subnode = this._rootNode.getSubnodes().getFirst(); subnode; subnode = subnode.next, j++) {
                    this._shadowQueue[j] = subnode;
                }
                application.log_DEBUG("Rendering shadow maps for light " + i + "...", 4);
                for (j = this._shadowMapRanges.length - 1; j >= 0; j--) {
                    this._directionalLights[i].startShadowMap(context, this._camera, j, this._shadowMapRanges[j], this._shadowMapRanges[j] * this._shadowMapDepthRatio);
                    this._renderShadowMap(context, widthInPixels, heightInPixels, this._directionalLights[i]);
                }
            }
            // binding the created textures to be used by the subsequent rendering calls
            for (i = 0; (i < this._directionalLights.length) && (i < this._maxRenderedDirectionalLights); i++) {
                for (j = 0; j < this._shadowMapRanges.length; j++) {
                    context.bindTexture(context.getFrameBuffer(this._directionalLights[i].getShadowMapBufferName(j)), undefined, true);
                }
            }
        }
        // switch back to rendering to the screen
        context.setCurrentFrameBuffer(null);
    };
    /**
     * Renders the background node tree using appropriate context settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     */
    Scene.prototype._renderBackgroundObjects = function (context, widthInPixels, heightInPixels) {
        application.log_DEBUG("Rendering background objects of scene...", 4);
        // preparing to render background objects
        context.enableBlending();
        context.setDepthMask(false);
        // rendering background objects
        this._rootBackgroundNode.render(context, widthInPixels, heightInPixels, false);
    };
    /**
     * Renders the specified render queues of the scene with the given settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     * @param {RenderableNode[]} renderQueue
     * @param {Number} index This is the index to identify the queue in case it is rendered in instanced mode.
     * @param {Boolean} depthMask
     */
    Scene.prototype._renderQueue = function (context, widthInPixels, heightInPixels, renderQueue, index, depthMask) {
        var i, queueLength = renderQueue.length, count;
        if (queueLength > 0) {
            if (renderQueue[0].getInstancing() && context.instancingExt) {
                count = 0;
                renderQueue[0].prepareForInstancedRender(context, index, queueLength);
                for (i = 0; i < queueLength; i++) {
                    if (renderQueue[i].render(context, widthInPixels, heightInPixels, depthMask, true, true, index, true)) {
                        count++;
                    }
                }
                if (count > 0) {
                    renderQueue[0].renderInstances(context, index, count);
                }
            } else {
                for (i = 0; i < queueLength; i++) {
                    renderQueue[i].render(context, widthInPixels, heightInPixels, depthMask, true, undefined, undefined, true);
                }
            }
        }
    };
    /**
     * Renders all the objects stored in the passed render queues in two passes (one for transparent and another for opaque triangles) with
     * appropriate context settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     * @param {RenderableNode[][]} opaqueRenderQueues The queues storing the nodes to render, with nodes using the same shader in each queue.
     * In these queues should be the nodes that contain objects that should be rendered in opaque mode.
     * @param {RenderableNode[][]} transparentRenderQueues In these queues should be the nodes that contain objects that should be rendered 
     * in transparent mode.
     * @param {Boolean} renderBackground If true, the background objects are rendered as well.
     */
    Scene.prototype._renderMainObjects = function (context, widthInPixels, heightInPixels, opaqueRenderQueues, transparentRenderQueues, renderBackground) {
        var i;
        // preparing to render main scene objects
        // first rendering pass: rendering the non-transparent triangles with Z buffer writing turned on
        application.log_DEBUG("Rendering opaque phase...", 4);
        if (opaqueRenderQueues.length > 0) {
            context.setDepthMask(true);
            context.disableBlending();
            // rendering using the render queues instead of the scene hierarchy to provide better performance by minimizing shader switches
            for (i = 0; i < opaqueRenderQueues.length; i++) {
                this._renderQueue(context, widthInPixels, heightInPixels, opaqueRenderQueues[i], i, true);
            }
        }
        // rendering the background objects after the opaque pass so background will only be rendered where it is not occluded by opaque
        // triangles. Transparent triangles are not changing the depth buffer so they would be overwritten by the background if it was 
        // rendered after them
        if (renderBackground) {
            this._renderBackgroundObjects(context, widthInPixels, heightInPixels);
        }
        // second rendering pass: rendering the transparent triangles with Z buffer writing turned off
        application.log_DEBUG("Rendering transparent phase...", 4);
        if (transparentRenderQueues.length > 0) {
            context.setDepthMask(false);
            context.enableBlending();
            // rendering using the render queues instead of the scene hierarchy to provide better performance by minimizing shader switches
            for (i = 0; i < transparentRenderQueues.length; i++) {
                this._renderQueue(context, widthInPixels, heightInPixels, transparentRenderQueues[i], i, false);
            }
        }
    };
    /**
     * Renders the UI node tree using appropriate context settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     */
    Scene.prototype._renderUIObjects = function (context, widthInPixels, heightInPixels) {
        var originalCamera, gl = context.gl; // caching the variable for easier access
        if (this._rootUINode.isVisible() && this._rootUINode.getSubnodes().getLength() > 0) {
            // rendering UI elements based on 3D positions should work both for positions inside the front and the distance range
            originalCamera = this._camera;
            if (this._distanceRendering) {
                this._camera = this._camera.getExtendedCamera(true);
            }
            // preparing to render UI objects
            context.enableBlending();
            gl.disable(gl.DEPTH_TEST);
            context.setDepthMask(false);
            // rendering background objects
            this._rootUINode.render(context, widthInPixels, heightInPixels, false);
            gl.enable(gl.DEPTH_TEST);
            this._camera = originalCamera;
        }
    };
    /**
     * An internal method used for rendering all objects, but without any proper frame data / shadow map preparation.
     * Used multiple times within one frame for stereoscopic rendering.
     * @param {ManagedGLContext} context
     * @param {Boolean} distanceQueuesNotEmpty
     * @param {Boolean} frontQueuesNotEmpty
     * @param {Number} widthInPixels
     * @param {Number} heightInPixels
     * @param {Number} dt The time elapsed since the last render step, for animation, in milliseconds
     */
    Scene.prototype._render = function (context, distanceQueuesNotEmpty, frontQueuesNotEmpty, widthInPixels, heightInPixels, dt) {
        var gl = context.gl, clearBits, originalCamera;
        if (this._shouldClearColorOnRender) {
            context.setColorMask(this._clearColorMask);
            gl.clearColor(this._clearColor[0], this._clearColor[1], this._clearColor[2], this._clearColor[3]);
        }
        // glClear is affected by the depth mask, so we need to turn it on here!
        // (it's disabled for the second (transparent) render pass)
        context.setDepthMask(true);
        // clearing color and depth buffers as set for this scene
        clearBits = this._shouldClearColorOnRender ? gl.COLOR_BUFFER_BIT : 0;
        clearBits = this._shouldClearDepthOnRender ? clearBits | gl.DEPTH_BUFFER_BIT : clearBits;
        gl.clear(clearBits);
        // -----------------------------------------------------------------------
        // rendering the queues storing distant main objects
        if (distanceQueuesNotEmpty) {
            // switching to an extended camera
            originalCamera = this._camera;
            this._camera = this._camera.getExtendedCamera();
            this._cameraUniformsUpdated.clear();
            // dynamic lights are not support for these objects as they are not really visible but expensive
            this._clearDynamicLightUniformData();
            this._renderMainObjects(context, widthInPixels, heightInPixels, this._renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX], this._renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX], true);
            // switching back the camera
            this._camera = originalCamera;
            // there is no overlap in the two view frustums, simply a new blank depth buffer can be used for the front objects
            context.setDepthMask(true);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this._cameraUniformsUpdated.clear();
        }
        // -----------------------------------------------------------------------
        // rendering the queues storing front (close) main objects
        // the background objects are rendered within _renderMainObjects so it needs to be called here even
        // if there are no main objects in the scene at all 
        if (frontQueuesNotEmpty || !distanceQueuesNotEmpty) {
            // filling the arrays storing the light source data for uniforms that need it
            this._updateDynamicLightUniformData(this._shouldAnimate ? dt : 0);
            if (context.getCurrentShader()) {
                // uniforms need to be updated with the new camera and light data in case the first used shader for the front object is the
                // same as the last one used for the distant objects
                this.assignUniforms(context, context.getCurrentShader());
            }
            this._renderMainObjects(context, widthInPixels, heightInPixels, this._renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX], this._renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX], !distanceQueuesNotEmpty);
        }
        // -----------------------------------------------------------------------
        // rendering the UI objects
        this._renderUIObjects(context, widthInPixels, heightInPixels);
    };
    /**
     * Renders the whole scene applying the general configuration and then rendering all background and main scene objects (as well as
     * shadow maps if applicable).
     * @param {ManagedGLContext} context
     * @param {Number} dt The time elapsed since the last render step, for animation, in milliseconds
     */
    Scene.prototype.render = function (context, dt) {
        var gl = context.gl,
                frontQueuesNotEmpty, distanceQueuesNotEmpty,
                bufferWidth = gl.drawingBufferWidth,
                bufferHeight = gl.drawingBufferHeight,
                widthInPixels = bufferWidth * this._width,
                heightInPixels = bufferHeight * this._height,
                anaglyph, leftShader, rightShader,
                lightsUpdated;
        application.log_DEBUG("Rendering scene...", 3);
        egomModel.resetDebugStats();
        this._camera.setAspect(widthInPixels / heightInPixels);
        // updating camera
        if (this._shouldUpdateCamera) {
            this._camera.update(dt);
        }
        // scene uniforms will need to be updated for this frame
        this._uniformsUpdated.clear();
        this._cameraUniformsUpdated.clear();
        lightsUpdated = false;
        // if only one shader is used in rendering the whole scene, we will need to update its uniforms (as they are normally updated 
        // every time a new shader is set)
        if ((this._uniformsUpdatedForFrame === false) && context.getCurrentShader()) {
            this._updateStaticLightUniformData();
            this.assignUniforms(context, context.getCurrentShader());
            lightsUpdated = true;
        }
        this._uniformsUpdatedForFrame = false;
        // animating all the needed nodes and preparing them for rendering by organizing them to render queues
        this._renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX].length = 0;
        this._renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX].length = 0;
        if (this._distanceRendering) {
            this._renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX].length = 0;
            this._renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX].length = 0;
        }
        this._rootNode.animateAndAddToRenderQueues(this._renderQueues, this._distanceRendering, this._camera, dt);
        this.cleanUpLights(); // the animation might have removed some light sources
        frontQueuesNotEmpty = (this._renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX].length > 0) || (this._renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX].length > 0);
        distanceQueuesNotEmpty = this._distanceRendering && ((this._renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX].length > 0) || (this._renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX].length > 0));
        // rendering shadow maps
        if (frontQueuesNotEmpty) {
            this._renderShadowMaps(context, widthInPixels, heightInPixels);
            if (this._shadowMappingEnabled) {
                lightsUpdated = false;
            }
        }
        if (application.isDebugVersion()) {
            this._shadowMapDebugStats = utils.shallowCopy(egomModel.getDebugStats());
            egomModel.resetDebugStats();
        }
        if (!lightsUpdated) {
            // updating the light matrices to be consistent with the shadow maps
            this._updateStaticLightUniformData();
        }
        // viewport preparation
        gl.viewport(this._left * bufferWidth, this._bottom * bufferHeight, widthInPixels, heightInPixels);

        if (this._stereoscopicMode !== Scene.StereoscopicMode.NONE) {
            anaglyph = this._stereoscopicMode === Scene.StereoscopicMode.ANAGLYPH;
            if (anaglyph) {
                leftShader = this._redShader;
                rightShader = this._cyanShader;
            } else {
                leftShader = this._leftShader;
                rightShader = this._rightShader;
            }
            context.setCurrentFrameBuffer(STEREOSCOPY_FRAMEBUFFER_NAME);
            this._camera.setLeftEye();
            if (this._sideBySideOriginalAspect) {
                this._camera.setAspect(widthInPixels * 0.5 / heightInPixels);
            }
            this._cameraUniformsUpdated.clear();
            this._render(context, distanceQueuesNotEmpty, frontQueuesNotEmpty, widthInPixels * (anaglyph ? 1.0 : 0.5), heightInPixels, dt);
            context.setCurrentFrameBuffer(null);
            context.setCurrentShader(leftShader);
            this._stereoscopicTextureUnit = context.bindTexture(context.getFrameBuffer(STEREOSCOPY_FRAMEBUFFER_NAME), undefined, true);
            leftShader.assignUniforms(context, this._stereoscopicUniformValueFunctions);
            this._fvq.render(context, false, true);

            context.setCurrentFrameBuffer(STEREOSCOPY_FRAMEBUFFER_NAME);
            this._camera.setRightEye();
            this._cameraUniformsUpdated.clear();
            this._render(context, distanceQueuesNotEmpty, frontQueuesNotEmpty, widthInPixels * (anaglyph ? 1.0 : 0.5), heightInPixels, 0);
            context.setCurrentFrameBuffer(null);
            context.setCurrentShader(rightShader);
            rightShader.assignUniforms(context, this._stereoscopicUniformValueFunctions);
            this._fvq.render(context, false, true);
        } else {
            this._render(context, distanceQueuesNotEmpty, frontQueuesNotEmpty, widthInPixels, heightInPixels, dt);
        }
        if (this._shadowMapDebugging) {
            context.setCurrentShader(this._shadowMapDebugShader);
            this._shadowMapTextureUnit = context.bindTexture(context.getFrameBuffer(this._directionalLights[this._shadowMapDebugLightIndex].getShadowMapBufferName(this._shadowMapDebugRangeIndex)), undefined, true);
            this._shadowMapDebugShader.assignUniforms(context, this._shadowMapDebugUniformValueFunctions);
            this._fvq.render(context, false, true);
        }
        if (application.isDebugVersion()) {
            this._mainDebugStats = utils.shallowCopy(egomModel.getDebugStats());
        }
    };
    /**
     * Used during debug stats logging - increases the counter corresponding to the passed object type.
     * @param {String} objectType The object type (constructor name)
     */
    Scene.prototype.increaseCount = function (objectType) {
        this._nodeCount++;
        this._nodeCountByType[objectType] = this._nodeCountByType[objectType] || 0;
        this._nodeCountByType[objectType]++;
    };
    /**
     * Logs the structure of the scene and some statistics about it.
     */
    Scene.prototype.logNodes = function () {
        var objectTypes, i;
        application.log_DEBUG("--------------");
        this._nodeCount = 0;
        this._nodeCountByType = {};
        application.log_DEBUG("Scene structure:");
        this._rootNode.log(0);
        application.log_DEBUG("Scene statistics:");
        application.log_DEBUG("Total node count: " + this._nodeCount);
        application.log_DEBUG("Count by type:");
        objectTypes = Object.keys(this._nodeCountByType);
        for (i = 0; i < objectTypes.length; i++) {
            application.log_DEBUG("[" + objectTypes[i] + "]: " + this._nodeCountByType[objectTypes[i]]);
        }
        application.log_DEBUG("--------------");
    };
    /**
     * Returns the rendering statistics for the current frame about the scene graph in debug mode (shadow map rendering not included)
     * @returns {ModelDebugStats}
     */
    Scene.prototype.getMainDebugStats = function () {
        return this._mainDebugStats;
    };
    /**
     * Stores the rendering statistics for the current frame about the shadow maps in debug mode
     * @returns {ModelDebugStats}
     */
    Scene.prototype.getShadowMapDebugStats = function () {
        return this._shadowMapDebugStats;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getDebugInfo: getDebugInfo,
        LODContext: LODContext,
        RenderableNode: RenderableNode,
        Scene: Scene
    };
});