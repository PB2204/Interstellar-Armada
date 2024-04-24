/**
 * @param resources Used for waiting for resource load
 * @param control Used for accessing the camer controller
 * @param graphics Used to set graphics settings according to the environment
 * @param common Used to create the option elements
 * @param preview This module is based on the common WebGL preview module
 */
define([
    "modules/media-resources",
    "armada/control",
    "armada/graphics",
    "editor/common",
    "editor/preview/webgl-preview"
], function (
        resources,
        control, graphics,
        common, preview) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "color", "skyboxes", "backgroundObjects", "dustClouds", "particleEffects"
            ],
            /**
             * The names of the properties the change of which should trigger a refresh of the preview options
             * @type String[]
             */
            OPTION_REFRESH_PROPERIES = [
            ],
            /**
             * The names of the properties the change of which should trigger a refresh of the info text
             * @type String[]
             */
            INFO_UPDATE_PROPERTIES = [
            ],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Environment
             */
            _environment,
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * 
             * @type CameraController
             */
            _cameraController,
            /**
             * 
             * @type Number
             */
            _cameraSpeed,
            /**
             * Stores the WebGL preview context information for spacecraft class previews
             * @type WebGLPreviewContext
             */
            _previewContext,
            /**
             * 
             * @type Object
             */
            _optionElements = {
                cameraSpeedEditor: null
            };
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * @typedef {Editor~RefreshParams} Editor~EnvironmentRefreshParams
     * @property {Number} cameraSpeed
     */
    /**
     * 
     */
    function _clear() {
        if (_environment) {
            _environment.removeFromScene();
        }
        if (_cameraController) {
            _cameraController.stop();
        }
    }
    /**
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~EnvironmentRefreshParams} params
     */
    function _load(params) {
        var shadows;
        params = params || {};
        if (params.preserve) {
            if (params.cameraSpeed === undefined) {
                params.cameraSpeed = _cameraSpeed;
            }
        }
        shadows = graphics.isShadowMappingEnabled();
        if (_environment.hasShadows()) {
            graphics.setShadowMapping();
        } else {
            graphics.setShadowMapping(false, false);
        }
        if (shadows !== graphics.isShadowMappingEnabled()) {
            graphics.handleSettingsChanged();
        }
        _environment.addToScene(preview.getScene());
        if (_environment.addParticleEffectsToScene(preview.getScene())) {
            resources.executeWhenReady(preview.startAnimating);
        }
        _cameraSpeed = params.cameraSpeed;
    }
    /**
     * Resets the preview settings (those handled through the optionns, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        _cameraSpeed = 0;
    }
    /**
     * Creates the controls that form the content of the preview options and adds them to the page.
     */
    function _createOptions() {
        // environment selector
        _optionElements.cameraSpeedEditor = common.createNumericInput(_cameraSpeed, {}, function (value) {
            preview.updateCanvas({
                preserve: true,
                clearScene: true,
                cameraSpeed: value
            });
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.cameraSpeedEditor, "Camera speed:"));
    }
    /**
     * The animation step (i.e. environment.simulate())
     * @param {Number} dt The time elapsed since the last animation step
     */
    function _animate(dt) {
        if (_environment) {
            _cameraController.executeActions((_cameraSpeed > 0) ? [[{
                        name: "cameraMoveForward",
                        intensity: _cameraSpeed / _cameraController.getMaxSpeed()
                    }]] : [], dt);
            _environment.simulate();
        }
    }
    /**
     * 
     */
    function _updateForRefresh() {
        return true;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * spacecraft class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} environment The spacecraft class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, environment, params) {
        var sameClass = (_environment === environment);

        preview.setContext(_previewContext);

        _elements = elements;
        _environment = environment;
        _cameraController = control.getController("camera");
        if (sameClass) {
            if (!params) {
                params = {
                    preserve: true,
                    reload: true
                };
            }
        } else {
            preview.clearSettingsForNewItem();
        }
        preview.refresh(elements, params);
        _cameraController.setControlledCamera(preview.getScene().getCamera());
    }
    /**
     * Updates the preview for the case when a property of the previewed item is being edited
     */
    function handleStartEdit() {
        return true;
    }
    /**
     * Updates the preview for the case when a property of the previewed item is no longer being edited
     */
    function handleStopEdit() {
        return true;
    }
    // ----------------------------------------------------------------------
    // Initialization
    _previewContext = new preview.WebGLPreviewContext({
        renderModeSetting: false,
        lodSetting: false,
        animateButton: true,
        muteCheckbox: false,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES,
        infoUpdateProperties: INFO_UPDATE_PROPERTIES
    }, {
        clear: _clear,
        load: _load,
        updateForRefresh: _updateForRefresh,
        clearSettingsForNewItem: _clearSettingsForNewItem,
        createOptions: _createOptions,
        animate: _animate
    });
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh,
        clear: preview.clear,
        handleDataChanged: preview.handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit
    };
});
