/**
 * @param utils Used for enum value listing, async execution.
 * @param mat Used for copying matrices
 * @param resources Used for waiting for resource load
 * @param renderableObjects Used for accessing uniform name constants
 * @param lights Used for creating the light sources for the preview scene
 * @param config Used to access default camera configuration settings
 * @param graphics Used to set graphics settings according to the environment
 * @param environments Used to access the environments
 * @param SpacecraftEvents Used to set spacecraft event handlers
 * @param spacecraft Used to create the spacecraft for preview
 * @param common Used to create selectors
 * @param descriptors Used to access enums
 * @param preview This module is based on the common WebGL preview module
 */
define([
    "utils/utils",
    "utils/matrices",
    "modules/media-resources",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "armada/configuration",
    "armada/graphics",
    "armada/logic/environments",
    "armada/logic/SpacecraftEvents",
    "armada/logic/spacecraft",
    "editor/common",
    "editor/descriptors",
    "editor/preview/webgl-preview"
], function (
        utils, mat,
        resources, renderableObjects, lights,
        config, graphics, environments, SpacecraftEvents, spacecraft,
        common, descriptors, preview) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            LIGHT_SOURCES = [
                {
                    color: [1, 1, 1],
                    direction: [1, 0, 1]
                }
            ],
            HITBOX_HIGHLIGHT_COLOR = [0.8, 0.4, 0.3, 0.5],
            ENGINE_STATE_NO_PROPULSION = "no propulsion",
            ENGINE_STATE_OFF = "off",
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "basedOn",
                "model", "shader", "texture",
                "factionColor", "defaultLuminosityFactors",
                "bodies",
                "weaponSlots", "missileLaunchers", "thrusterSlots",
                "loadouts",
                "humSound",
                "explosion",
                "lights", "blinkers"],
            /**
             * The names of the properties the change of which should trigger a refresh of the preview options
             * @type String[]
             */
            OPTION_REFRESH_PROPERIES = [
                "basedOn",
                "loadouts"
            ],
            /**
             * The names of the properties the change of which should trigger a refresh of the info text
             * @type String[]
             */
            INFO_UPDATE_PROPERTIES = [
            ],
            /**
             * The params to pass to spacecraft.simulate()
             * @type Spacecraft~SimulateParams
             */
            SPACECRAFT_SIMULATE_PARAMS = {
                controlThrusters: false,
                applyThrusterForces: false
            },
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Spacecraft
             */
            _spacecraft, _wireframeSpacecraft,
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
             * A reference to the displayed spacecraft class
             * @type SpacecraftClass
             */
            _spacecraftClass,
            /**
             * @type String
             */
            _environmentName, _loadoutName,
            /**
             * The faction color to use on the previewed spacecraft model
             * @type Number[4]
             */
            _factionColor,
            /**
             * Whether the user has changed the original faction color to a custom one
             * @type Boolean
             */
            _factionColorChanged,
            /**
             * The uses of the engine that are currently set to be turned on
             * @type String[]
             */
            _activeEngineUses = [],
            /**
             * Whether the hitbox is currently visible
             * @type Boolean
             */
            _showHitbox,
            /**
             * Used to highlight the hitbox that is currently being edited
             * @type Number
             */
            _highlightedHitboxIndex,
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
                environmentSelector: null,
                loadoutSelector: null,
                factionColorPicker: null,
                engineStateEditor: null,
                engineStatePopup: null,
                explodeButton: null,
                shieldRechargeButton: null
            };
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Returns the regular hitbox color (detemined by game configuration, the same that is shown if hitboxes are turned on in the game)
     * @returns {Number[4]}
     */
    function _hitboxColorFunction() {
        return config.getSetting(config.BATTLE_SETTINGS.HITBOX_COLOR);
    }
    /**
     * Returns the color to be used on the currently edited hitbox
     * @returns {Number[4]}
     */
    function _highlighterHitboxColorFunction() {
        return HITBOX_HIGHLIGHT_COLOR;
    }
    /**
     * Sets the appropriate hitbox visibility and colors for the current settingsF
     */
    function _updateForHitboxState() {
        var i, node, nodes = _spacecraft.getHitbox().getSubnodes();
        if (_showHitbox) {
            i = 0;
            for (node = nodes.getFirst(); node; node = node.next, i++) {
                node.getRenderableObject().setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, (i === _highlightedHitboxIndex) ?
                        _highlighterHitboxColorFunction :
                        _hitboxColorFunction);
            }
            _spacecraft.showHitbox();
        } else {
            _spacecraft.hideHitbox();
        }
    }
    /**
     * Updates the visual models of the thrusters according to the currently set engine state.
     */
    function _updateThrusters() {
        var i;
        if (_spacecraft.getPropulsion()) {
            _spacecraft.resetThrusterBurn();
            for (i = 0; i < _activeEngineUses.length; i++) {
                _spacecraft.addThrusterBurn(_activeEngineUses[i], (
                        (_activeEngineUses[i] === descriptors.ThrusterUse.FORWARD) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.REVERSE) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.STRAFE_LEFT) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.STRAFE_RIGHT) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.RAISE) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.LOWER)) ?
                        _spacecraft.getMaxThrusterMoveBurnLevel() :
                        _spacecraft.getMaxThrusterTurnBurnLevel());
            }
            _spacecraft.updatePropulsionVisuals();
        }
    }
    /**
     * Updates the engine state editor control in the preview options panel according to the current possibilities and settings.
     */
    function _updateEngineStateEditor() {
        var i, checkboxes;
        _optionElements.engineStateEditor.disabled = !_spacecraft.getPropulsion();
        if (_optionElements.engineStateEditor.disabled) {
            _activeEngineUses = [];
            checkboxes = _optionElements.engineStatePopup.getElement().querySelectorAll('input[type="checkbox"]');
            for (i = 0; i < checkboxes.length; i++) {
                checkboxes[i].checked = false;
            }
            _optionElements.engineStatePopup.hide();
        }
        _optionElements.engineStateEditor.innerHTML = _activeEngineUses.length > 0 ?
                (_activeEngineUses[0] + ((_activeEngineUses.length > 1) ? "..." : "")) :
                (_spacecraft.getPropulsion() ? ENGINE_STATE_OFF : ENGINE_STATE_NO_PROPULSION);
    }
    /**
     * Updates the caption and enabled state of the "Explode" button to reflect the current state of the spacecraft
     */
    function _updateExplodeButton() {
        _optionElements.explodeButton.innerHTML = (_spacecraft && _spacecraft.getHitpoints() > 0) ? "Explode" : "Respawn";
        _optionElements.explodeButton.disabled = !_spacecraft || ((_spacecraft.getHitpoints() === 0) && (_spacecraft.isAlive()));
    }
    /**
     * Updates the caption and enabled state of the "Shield recharge" button to reflect the current state of the spacecraft
     */
    function _updateShieldRechargeButton() {
        _optionElements.shieldRechargeButton.disabled = !_spacecraft || (_spacecraft.getHitpoints() <= 0) || !_spacecraft.hasShield();
    }
    /**
     * @typedef {Editor~RefreshParams} Editor~SpacecraftClassRefreshParams
     * @property {String} environmentName The name of the environment to put the previewed spacecraft in
     * @property {String} loadoutName The name of the loadout to be equipped on the previewed spacecraft
     */
    /**
     * 
     */
    function _clear() {
        if (_spacecraft) {
            _spacecraft.destroy();
            _spacecraft = null;
            _wireframeSpacecraft.destroy();
            _wireframeSpacecraft = null;
        }
    }
    /**
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~SpacecraftClassRefreshParams} params
     * @param {Float32Array} orientationMatrix
     * @returns {Boolean}
     */
    function _load(params, orientationMatrix) {
        var
                environmentChanged,
                loadoutChanged,
                shouldReload,
                shadows,
                i;
        params = params || {};
        if (params.preserve) {
            if (params.environmentName === undefined) {
                params.environmentName = _environmentName;
            }
            if (params.loadoutName === undefined) {
                params.loadoutName = _loadoutName;
            }
        }
        environmentChanged = params.environmentName !== _environmentName;
        loadoutChanged = params.loadoutName !== _loadoutName;
        shouldReload = !params.preserve || params.reload;
        if (environmentChanged || shouldReload) {
            shadows = graphics.isShadowMappingEnabled();
            if (params.environmentName) {
                _environment = environments.getEnvironment(params.environmentName);
                if (_environment.hasShadows()) {
                    graphics.setShadowMapping();
                } else {
                    graphics.setShadowMapping(false, false);
                }
            } else {
                _environment = null;
                preview.getScene().setClearColor([0, 0, 0, 1]);
                preview.getScene().setAmbientColor([0, 0, 0]);
                for (i = 0; i < LIGHT_SOURCES.length; i++) {
                    preview.getScene().addDirectionalLightSource(new lights.DirectionalLightSource(LIGHT_SOURCES[i].color, LIGHT_SOURCES[i].direction));
                }
                graphics.setShadowMapping();
            }
            if (shadows !== graphics.isShadowMappingEnabled()) {
                graphics.handleSettingsChanged();
                shouldReload = true;
            }
        }
        if (shouldReload) {
            _clear();
            _spacecraft = new spacecraft.Spacecraft(_spacecraftClass);
            _wireframeSpacecraft = new spacecraft.Spacecraft(_spacecraftClass);
        }
        if (orientationMatrix) {
            _spacecraft.updatePhysicalOrientationMatrix(orientationMatrix);
            _wireframeSpacecraft.updatePhysicalOrientationMatrix(_spacecraft.getPhysicalOrientationMatrix());
        }
        if (loadoutChanged || environmentChanged || shouldReload) {
            if (_loadoutName) {
                _spacecraft.unequip();
                _wireframeSpacecraft.unequip();
                _loadoutName = null;
            }
            if (params.loadoutName) {
                _spacecraft.equipLoadout(_spacecraftClass.getLoadout(params.loadoutName));
                _wireframeSpacecraft.equipLoadout(_spacecraftClass.getLoadout(params.loadoutName));
                _loadoutName = params.loadoutName;
            }
        }
        _spacecraft.addToScene(preview.getScene(), undefined, false,
                (environmentChanged || shouldReload) ?
                {weapons: true, missilesInLaunchers: true, allMissilesInLaunchers: true, lightSources: true, blinkers: true, hitboxes: true, thrusterParticles: true, explosion: true, shield: true, sound: true} :
                {self: false, weapons: true},
                {
                    replaceVisualModel: true,
                    factionColor: _factionColor
                },
                (environmentChanged || shouldReload) ?
                function (model) {
                    preview.setModel(model);
                } :
                null);
        _wireframeSpacecraft.addToScene(preview.getScene(), undefined, true,
                (environmentChanged || shouldReload) ?
                {weapons: true, missilesInLaunchers: true, allMissilesInLaunchers: true} :
                {self: false, weapons: true},
                {
                    replaceVisualModel: true,
                    shaderName: preview.getWireframeShaderName()
                },
                (environmentChanged || shouldReload) ?
                function (model) {
                    preview.setWireframeModel(model);
                } :
                null,
                function (model) {
                    preview.setupWireframeModel(model);
                });
        if (params.environmentName && (environmentChanged || shouldReload)) {
            _environment.addToScene(preview.getScene());
            if (_environment.addParticleEffectsToScene(preview.getScene())) {
                resources.executeWhenReady(preview.startAnimating);
            }
        }
        _environmentName = params.environmentName;
        _updateEngineStateEditor();
        return shouldReload;
    }
    /**
     * Resets the preview settings (those handled through the options, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        _environmentName = null;
        _loadoutName = null;
        if (!_factionColor) {
            _factionColorChanged = false;
        }
        if (!_factionColorChanged) {
            _factionColor = _spacecraftClass.getFactionColor() ? _spacecraftClass.getFactionColor().slice() : [0, 0, 0, 0];
        }
        _activeEngineUses = [];
        _showHitbox = false;
    }
    /**
     * Creates and returns the control that can be used to set the engine state for the preview. Also sets the reference for the 
     * corresponding popup.
     * @returns {Element}
     */
    function _createEngineEditor() {
        var
                button = document.createElement("button"),
                popup = new common.Popup(button, null, {}),
                values = utils.getEnumValues(descriptors.ThrusterUse),
                table, row, cell, propertyEditor, i,
                elementChangeHandler = function (index, value) {
                    var elementIndex = _activeEngineUses.indexOf(values[index]);
                    if (value) {
                        if (elementIndex === -1) {
                            _activeEngineUses.push(values[index]);
                        }
                    } else {
                        if (elementIndex >= 0) {
                            _activeEngineUses.splice(elementIndex, 1);
                        }
                    }
                    _updateEngineStateEditor();
                    _updateThrusters();
                    preview.requestRender();
                };
        table = document.createElement("table");
        for (i = 0; i < values.length; i++) {
            propertyEditor = common.createBooleanInput(_activeEngineUses.indexOf(values[i]) >= 0, elementChangeHandler.bind(_createEngineEditor, i));
            row = document.createElement("tr");
            cell = document.createElement("td");
            cell.appendChild(common.createLabel(values[i].toString()));
            row.appendChild(cell);
            cell = document.createElement("td");
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            table.appendChild(row);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        _optionElements.engineStatePopup = popup;
        // create a button using which the popup can be opened
        button.type = "button";
        button.disabled = true;
        button.onclick = function () {
            popup.toggle();
        };
        return button;
    }
    /**
     * Creates the controls that form the content of the preview options and adds them to the page.
     */
    function _createOptions() {
        // environment selector
        _optionElements.environmentSelector = common.createSelector(environments.getEnvironmentNames(), _environmentName, true, function () {
            preview.updateCanvas({
                preserve: true,
                clearScene: true,
                environmentName: (_optionElements.environmentSelector.value !== "none") ? _optionElements.environmentSelector.value : null
            });
            _updateExplodeButton();
            _updateShieldRechargeButton();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.environmentSelector, "Environment:"));
        // loadout selector
        _optionElements.loadoutSelector = common.createSelector(_spacecraftClass.getLoadoutNames(), _loadoutName, true, function () {
            preview.updateCanvas({
                preserve: true,
                reload: true,
                loadoutName: (_optionElements.loadoutSelector.value !== "none") ? _optionElements.loadoutSelector.value : null
            });
            _updateEngineStateEditor();
            _updateExplodeButton();
            _updateShieldRechargeButton();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.loadoutSelector, "Loadout:"));
        // faction color picker
        _optionElements.factionColorPicker = common.createColorPicker(_factionColor, function () {
            _factionColorChanged = true;
            preview.updateCanvas({
                preserve: true,
                reload: true
            });
            _updateExplodeButton();
            _updateShieldRechargeButton();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.factionColorPicker, "Faction color:"));
        // engine state editor
        _optionElements.engineStateEditor = _createEngineEditor();
        _elements.options.appendChild(preview.createSetting(_optionElements.engineStateEditor, "Engine:"));
        // explode button
        _optionElements.explodeButton = common.createButton("Explode", function () {
            if (_spacecraft.getHitpoints() > 0) {
                _spacecraft.setHitpointsToZero();
                _spacecraft.addEventHandler(SpacecraftEvents.DESTRUCTED, function () {
                    _spacecraft.getVisualModel().getNode().hide();
                    _updateExplodeButton();
                    _updateShieldRechargeButton();
                    return false;
                });
                preview.startAnimating();
            } else {
                if (_spacecraft.getExplosion()) {
                    _spacecraft.getExplosion().finish();
                }
                _spacecraft.getVisualModel().getNode().show();
                _spacecraft.respawn();
                _updateThrusters();
                preview.requestRender();
            }
            _updateExplodeButton();
            _updateShieldRechargeButton();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.explodeButton));
        // shield recharge button
        _optionElements.shieldRechargeButton = common.createButton("Recharge shield", function () {
            _spacecraft.rechargeShield();
            preview.startAnimating();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.shieldRechargeButton));
    }
    /**
     * The animation step (i.e. spacecraft.simulate())
     * @param {Number} dt The time elapsed since the last animation step
     */
    function _animate(dt) {
        if (_spacecraft) {
            _spacecraft.simulate(dt, SPACECRAFT_SIMULATE_PARAMS);
        }
        if (_environment) {
            _environment.simulate();
        }
    }
    /**
     * 
     */
    function _updateForRefresh() {
        _updateForHitboxState();
        if (_spacecraft && (_spacecraft.getHitpoints() <= 0)) {
            _spacecraft.getVisualModel().getNode().show();
            _spacecraft.respawn();
        }
        _updateThrusters();
        _updateExplodeButton();
        _updateShieldRechargeButton();
    }
    /**
     * The handler for when the model is rotated by the user
     */
    function _onModelRotate() {
        var explosion = _spacecraft && _spacecraft.getExplosion();
        if (explosion) {
            explosion.getVisualModel().setOrientationMatrix(mat.copy(_spacecraft.getVisualModel().getOrientationMatrix()));
        }
    }
    /**
     * Returns additional information to be displayed in the info section of the preview
     * @returns {String}
     */
    function _getInfo() {
        var result, firepower, firepowerDecrease;
        result = "";
        if (_spacecraft) {
            if (_spacecraft.getPropulsion()) {
                result += "accel.: " + Math.round(_spacecraft.getMaxAcceleration()) + " m/s², speed: " + Math.round(_spacecraft.getMaxCombatSpeed()) + " m/s, ";
                result += "ang.accel.: " + Math.round(_spacecraft.getMaxAngularAcceleration() * utils.DEG) + " °/s², turn rate: " + Math.round(_spacecraft.getMaxCombatTurnRate()) + " °/s";
            }
            firepower = _spacecraft.getFirepower();
            if (firepower > 0) {
                firepowerDecrease = firepower - _spacecraft.getFirepower(1);
                result += (result ? ", " : "") + " firepower: " + (Math.round(firepower * 100) / 100) + " (-" + (Math.round(firepowerDecrease * 100) / 100) + " / arm.), ";
                result += "range: " + _spacecraft.getWeaponRangesDisplayText() + " m";
            }
            if (_spacecraft.hasShield()) {
                result += (result ? ", " : "") + " shield: " + _spacecraft.getShieldCapacity();
            }
            result += (result ? ", " : "") + "score value: " + _spacecraft.getScoreValue();
            result = "Spacecraft: " + result;
        }
        return result;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * spacecraft class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} spacecraftClass The spacecraft class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, spacecraftClass, params) {
        var sameClass = (_spacecraftClass === spacecraftClass);

        preview.setContext(_previewContext);

        _elements = elements;
        _spacecraftClass = spacecraftClass;
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
    }
    /**
     * Updates the preview for the case when a property of the previewed item is being edited
     * @param {String} name The name of the property that is edited (under which the editing is happening)
     * @param {Number} [index] If the property is an array, this is the index of the element in the array being edited
     */
    function handleStartEdit(name, index) {
        if (name === "bodies") {
            _showHitbox = true;
            _highlightedHitboxIndex = index;
            _updateForHitboxState();
            preview.requestRender();
        }
    }
    /**
     * Updates the preview for the case when a property of the previewed item is no longer being edited
     * @param {String} name The name of the property that is no longer edited 
     */
    function handleStopEdit(name) {
        if (name === "bodies") {
            _showHitbox = false;
            _updateForHitboxState();
            preview.requestRender();
        }
    }
    // ----------------------------------------------------------------------
    // Initialization
    _previewContext = new preview.WebGLPreviewContext({
        renderModeSetting: true,
        lodSetting: true,
        animateButton: true,
        muteCheckbox: true,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES,
        infoUpdateProperties: INFO_UPDATE_PROPERTIES
    }, {
        clear: _clear,
        load: _load,
        updateForRefresh: _updateForRefresh,
        clearSettingsForNewItem: _clearSettingsForNewItem,
        createOptions: _createOptions,
        animate: _animate,
        onModelRotate: _onModelRotate,
        getInfo: _getInfo
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
