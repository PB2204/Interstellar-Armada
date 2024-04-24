/**
 * @param utils Used to check for touch event support
 * @param types Used to read boolean values from local storage
 * @param application Used to check if the application is in debug mode.
 * @param control This module builds its game-specific functionality on the general control module
 * @param keyboard Used to include keyboard input handling
 * @param mouse Used to include mouse input handling
 * @param gamepad Used to include joystick(/gamepad) input handling
 * @param touch Used to include touch input handling
 * @param cameraController This module uses the CameraController class made for SceneGraph
 * @param game To access screen-changing functionality
 * @param resources Used to access the sound effects triggered by controls
 * @param armadaScreens Used for navigation
 * @param strings Used for translation support
 * @param config Used to access settings
 * @param equipment Used to access enums
 */
define([
    "utils/utils",
    "utils/types",
    "modules/application",
    "modules/control/control",
    "modules/control/keyboard",
    "modules/control/mouse",
    "modules/control/gamepad",
    "modules/control/touch",
    "modules/camera-controller",
    "modules/game",
    "modules/media-resources",
    "armada/screens/shared",
    "armada/strings",
    "armada/configuration",
    "armada/logic/equipment"
], function (utils, types, application, control, keyboard, mouse, gamepad, touch, cameraController, game, resources, armadaScreens, strings, config, equipment) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            KEYBOARD_NAME = "keyboard",
            MOUSE_NAME = "mouse",
            JOYSTICK_NAME = "joystick",
            GAMEPAD_NAME = JOYSTICK_NAME,
            TOUCH_NAME = "touch",
            GENERAL_CONTROLLER_NAME = "general",
            FIGHTER_CONTROLLER_NAME = "fighter",
            CAMERA_CONTROLLER_NAME = "camera",
            MODULE_PREFIX = "armada_control_",
            POINTER_LOCK_ENABLED_LOCAL_STORAGE_ID = MODULE_PREFIX + "pointerLockEnabled",
            CANCEL_CRUISE_STRAFE_INTENSITY = 0.1, // a strafing command (strafe left/right, raise/lower) of minimum this intensity will cancel cruise flight mode
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting for strafe speed factor.
             * @type Number
             */
            _strafeSpeedFactor,
            /**
             * Sound clip for the target switch sound.
             * @type SoundClip
             */
            _targetSwitchSound,
            /**
             * Sound clip for the target switch denied sound.
             * @type SoundClip
             */
            _targetSwitchDeniedSound,
            /**
             * Sound clip for the flight mode switch sound.
             * @type SoundClip
             */
            _flightModeSwitchSound,
            /**
             * Sound clip for the missile change sound.
             * @type SoundClip
             */
            _missileChangeSound,
            /**
             * Sound clip for the missile change denied sound.
             * @type SoundClip
             */
            _missileChangeDeniedSound,
            /**
             * Sound clip for toggling missile salvo mode.
             * @type SoundClip
             */
            _missileSalvoSound,
            /**
             * The context storing the current control settings (controllers, input interpreters) that can be accessed through the interface of this module
             * @type ArmadaControlContext
             */
            _context,
            /**
             * A shortcut reference to the input interpreter that handles mouse input stored in the context
             * @type MouseInputInterpreter
             */
            _mouseInputInterpreter,
            // ------------------------------------------------------------------------------
            // public functions
            playMissileChangeSound = function () {
                if (_missileChangeSound) {
                    _missileChangeSound.play();
                }
            };
    keyboard.setModulePrefix(MODULE_PREFIX);
    mouse.setModulePrefix(MODULE_PREFIX);
    gamepad.setModulePrefix(MODULE_PREFIX);
    touch.setModulePrefix(MODULE_PREFIX);
    // #########################################################################
    /**
     * Creates a general controller object.
     * @class The general controller processes and executes the actions that are related
     * to general game control during a battle, (such as 'pause' or 'quit') and not 
     * associated with any particular object.
     * @param {Object} dataJSON The JSON object which contains the data to load the properties
     * of the recognized actions from.
     * @returns {GeneralController}
     */
    function GeneralController(dataJSON) {
        control.Controller.call(this, dataJSON);
        /**
         * The mission which this controller controls.
         * @type Mission
         */
        this._mission = null;
        /**
         * @type Battle
         */
        this._battle = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should be have been created by now.
        // quitting to the menu
        this.setActionFunction("quit", true, function () {
            this._battle.pauseBattle();
            game.setScreen(armadaScreens.INGAME_MENU_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
            control.exitPointerLock();
        }.bind(this));
        // pausing the game
        this.setActionFunction("pause", true, function () {
            // showing an info box automatically pauses the game as implemented in
            // the BattleScreen class
            game.getScreen().showMessage(strings.get(strings.BATTLE.MESSAGE_PAUSED));
        });
        if (application.isDebugVersion()) {
            this.setActionFunction("stopTime", true, function () {
                this._battle.toggleTime();
            }.bind(this));
            // switching to pilot mode
            this.setActionFunction("switchToPilotMode", true, function () {
                _context.switchToPilotMode(this._mission.getPilotedSpacecraft());
            }.bind(this));
            // switching to spectator mode
            this.setActionFunction("switchToSpectatorMode", true, function () {
                _context.switchToSpectatorMode(true, true);
            });
            // toggling the visibility of hitboxes
            this.setActionFunction("toggleHitboxVisibility", true, function () {
                this._mission.toggleHitboxVisibility();
            }.bind(this));
        }
        // toggling the visibility of development-related info (version, FPS count) on screen
        this.setActionFunction("toggleDevInfoVisibility", true, function () {
            game.getScreen().toggleDevInfoVisibility();
        });
        // toggling the visibility of the HUD
        this.setActionFunction("toggleHUDVisibility", true, function () {
            this._battle.toggleHUDVisibility();
        }.bind(this));
        // toggling the mouse controls
        this.setActionFunction("toggleMouseControls", true, function () {
            _context.getInputInterpreter(MOUSE_NAME).toggleEnabled();
            if (_context.isInPilotMode()) {
                if (_context.getInputInterpreter(MOUSE_NAME).isEnabled()) {
                    document.body.style.cursor = 'none';
                    _context.enableMouseTurning();
                } else {
                    document.body.style.cursor = game.getDefaultCursor();
                    control.exitPointerLock();
                }
            }
        });
        // toggling the joystick controls
        this.setActionFunction("toggleJoystickControls", true, function () {
            _context.getInputInterpreter(JOYSTICK_NAME).toggleEnabled();
        });
    }
    GeneralController.prototype = new control.Controller();
    GeneralController.prototype.constructor = GeneralController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    GeneralController.prototype.getType = function () {
        return "general";
    };
    /**
     * Sets the controlled mission to the one passed as parameter.
     * @param {Mission} mission
     */
    GeneralController.prototype.setMission = function (mission) {
        this._mission = mission;
    };
    /**
     * Sets the controlled battle to the one passed as parameter.
     * @param {Battle} battle
     */
    GeneralController.prototype.setBattle = function (battle) {
        this._battle = battle;
    };
    // #########################################################################
    /**
     * Creates a fighter controller object.
     * @class The fighter controller pocesses and executes the actions with which
     * the user can control a space fighter.
     * @extends Controller
     * @param {Object} dataJSON The JSON object which contains the data to load the properties
     * of the recognized actions from.
     * @returns {FighterController}
     */
    function FighterController(dataJSON) {
        control.Controller.call(this, dataJSON);
        /**
         * A reference to the spacecraft (fighter) which this controller controls.
         * @type Spacecraft
         */
        this._controlledSpacecraft = null;
        /**
         * The strafing speed to be used for the controlled spacecraft, in m/s.
         * @type Number
         */
        this._strafeSpeed = 0;
        /**
         * Whether auto-targeting is currently turned on for this controller.
         * @type Boolean
         */
        this._autoTargeting = true;
        /**
         * The angle threshold which should be exceeded to trigger the rotation of non-fixed weapons for auto-aiming, in radians
         * @type Number
         */
        this._weaponAimThreshold = dataJSON.weaponAimThreshold;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created
        // fire the primary weapons of the fighter
        this.setActionFunction("fire", true, function (i, source) {
            this._controlledSpacecraft.requestFire(false, i);
            if (source === _mouseInputInterpreter) {
                _context.enableMouseTurning();
            }
        }.bind(this));
        // launch a missile from the active missile launcher of the fighter
        this.setActionFunction("launchMissile", true, function (i, source) {
            if (!this._controlledSpacecraft.launchMissile(i)) {
                if (_missileChangeDeniedSound) {
                    _missileChangeDeniedSound.play();
                }
            }
            if (source === _mouseInputInterpreter) {
                _context.enableMouseTurning();
            }
        }.bind(this));
        // change to a missile launcher with a different missile equipped
        this.setActionFunction("changeMissile", true, function (i) {
            if (this._controlledSpacecraft.changeMissile(i)) {
                if (_missileChangeSound) {
                    _missileChangeSound.play();
                }
            } else {
                if (_missileChangeDeniedSound) {
                    _missileChangeDeniedSound.play();
                }
            }
        }.bind(this));
        // toggle salvo launching mode of missiles
        this.setActionFunction("toggleSalvo", true, function (i) {
            if (this._controlledSpacecraft.toggleSalvo(i)) {
                if (_missileSalvoSound) {
                    _missileSalvoSound.play();
                }
            } else {
                if (_missileChangeDeniedSound) {
                    _missileChangeDeniedSound.play();
                }
            }
        }.bind(this));
        // changing flight mode (free / combat / cruise)
        this.setActionFunction("changeFlightMode", true, function () {
            if (this._controlledSpacecraft.changeFlightMode()) {
                if (_flightModeSwitchSound) {
                    _flightModeSwitchSound.play();
                }
            }
        }.bind(this));
        // toggling between cruise and combat flight modes
        this.setActionFunction("toggleCruise", true, function () {
            if (this._controlledSpacecraft.toggleCruise()) {
                if (_flightModeSwitchSound) {
                    _flightModeSwitchSound.play();
                }
            }
        }.bind(this));
        // toggling between free and combat flight modes
        this.setActionFunction("toggleFlightAssist", true, function () {
            if (this._controlledSpacecraft.toggleFlightAssist()) {
                if (_flightModeSwitchSound) {
                    _flightModeSwitchSound.play();
                }
            }
        }.bind(this));
        // switch to next hostile target
        this.setActionFunction("nextNearestHostileTarget", true, function () {
            if (this._controlledSpacecraft.targetNextNearestHostile()) {
                _targetSwitchSound.play();
            } else {
                _targetSwitchDeniedSound.play();
            }
        }.bind(this));
        // switch to previous hostile target
        this.setActionFunction("previousNearestHostileTarget", true, function () {
            if (this._controlledSpacecraft.targetPreviousNearestHostile()) {
                _targetSwitchSound.play();
            } else {
                _targetSwitchDeniedSound.play();
            }
        }.bind(this));
        // switch to next target (any)
        this.setActionFunction("nextNearestNonHostileTarget", true, function () {
            if (this._controlledSpacecraft.targetNextNearestNonHostile()) {
                _targetSwitchSound.play();
            } else {
                _targetSwitchDeniedSound.play();
            }
        }.bind(this));
        // toggle auto targeting
        this.setActionFunction("toggleAutoTargeting", true, function () {
            this._autoTargeting = !this._autoTargeting;
        }.bind(this));
        // forward burn
        this.setActionFunctions("forward", function (i) {
            this._controlledSpacecraft.forward(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopForward();
        }.bind(this));
        // reverse burn
        this.setActionFunctions("reverse", function (i) {
            this._controlledSpacecraft.reverse(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopReverse();
        }.bind(this));
        // strafing to left and right
        this.setActionFunctions("strafeLeft", function (i) {
            if ((i === undefined) || (i >= CANCEL_CRUISE_STRAFE_INTENSITY)) {
                if (this._controlledSpacecraft.getFlightMode() === equipment.FlightMode.CRUISE) {
                    if (this._controlledSpacecraft.toggleCruise()) {
                        if (_flightModeSwitchSound) {
                            _flightModeSwitchSound.play();
                        }
                    }
                }
            }
            this._controlledSpacecraft.strafeLeft(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLeftStrafe();
        }.bind(this));
        this.setActionFunctions("strafeRight", function (i) {
            if ((i === undefined) || (i >= CANCEL_CRUISE_STRAFE_INTENSITY)) {
                if (this._controlledSpacecraft.getFlightMode() === equipment.FlightMode.CRUISE) {
                    if (this._controlledSpacecraft.toggleCruise()) {
                        if (_flightModeSwitchSound) {
                            _flightModeSwitchSound.play();
                        }
                    }
                }
            }
            this._controlledSpacecraft.strafeRight(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRightStrafe();
        }.bind(this));
        // strafing up and down
        this.setActionFunctions("raise", function (i) {
            if ((i === undefined) || (i >= CANCEL_CRUISE_STRAFE_INTENSITY)) {
                if (this._controlledSpacecraft.getFlightMode() === equipment.FlightMode.CRUISE) {
                    if (this._controlledSpacecraft.toggleCruise()) {
                        if (_flightModeSwitchSound) {
                            _flightModeSwitchSound.play();
                        }
                    }
                }
            }
            this._controlledSpacecraft.raise(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRaise();
        }.bind(this));
        this.setActionFunctions("lower", function (i) {
            if ((i === undefined) || (i >= CANCEL_CRUISE_STRAFE_INTENSITY)) {
                if (this._controlledSpacecraft.getFlightMode() === equipment.FlightMode.CRUISE) {
                    if (this._controlledSpacecraft.toggleCruise()) {
                        if (_flightModeSwitchSound) {
                            _flightModeSwitchSound.play();
                        }
                    }
                }
            }
            this._controlledSpacecraft.lower(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLower();
        }.bind(this));
        this.setActionFunction("toggleSpeedHolding", true, function () {
            if (this._controlledSpacecraft.toggleSpeedHolding()) {
                if (_flightModeSwitchSound) {
                    _flightModeSwitchSound.play();
                }
            }
        }.bind(this));
        // resetting speed to 0
        this.setActionFunction("resetSpeed", true, function () {
            this._controlledSpacecraft.resetSpeed();
        }.bind(this));
        // turning along the 3 axes
        this.setActionFunction("yawLeft", true, function (i, source) {
            this._controlledSpacecraft.yawLeft(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("yawRight", true, function (i, source) {
            this._controlledSpacecraft.yawRight(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("pitchUp", true, function (i, source) {
            this._controlledSpacecraft.pitchUp(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("pitchDown", true, function (i, source) {
            this._controlledSpacecraft.pitchDown(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("rollLeft", true, function (i) {
            this._controlledSpacecraft.rollLeft(i);
        }.bind(this));
        this.setActionFunction("rollRight", true, function (i) {
            this._controlledSpacecraft.rollRight(i);
        }.bind(this));
        this.setActionFunction("jumpOut", true, function () {
            this._controlledSpacecraft.jumpOut(true);
        }.bind(this));
        this.setActionFunction("toggleSpotlights", true, function () {
            this._controlledSpacecraft.toggleSpotLights();
        }.bind(this));
    }
    FighterController.prototype = new control.Controller();
    FighterController.prototype.constructor = FighterController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    FighterController.prototype.getType = function () {
        return "fighter";
    };
    /**
     * Sets the controlled spacecraft (fighter) for this controller. After called,
     * all controls will take effect on the spacecraft passed here as a parameter.
     * @param {Spacecraft} controlledSpacecraft
     */
    FighterController.prototype.setControlledSpacecraft = function (controlledSpacecraft) {
        this._controlledSpacecraft = controlledSpacecraft;
        if (this._controlledSpacecraft) {
            this._strafeSpeed = _strafeSpeedFactor * this._controlledSpacecraft.getMaxAcceleration();
        }
    };
    /**
     * Same as the method of the parent class, but with a check if there if there is
     * a controlled spacecraft present.
     * @param {Object[]} triggeredActions See Controller.executeActions
     * @param {Number} dt The elapsed time since the last control step, in milliseconds
     */
    FighterController.prototype.executeActions = function (triggeredActions, dt) {
        if (this._controlledSpacecraft) {
            if (this._controlledSpacecraft.isAlive()) {
                this._controlledSpacecraft.prepareForControl();
                // executing user-triggered actions
                control.Controller.prototype.executeActions.call(this, triggeredActions);
                // executing automatic actions
                if (this._autoTargeting && !this._controlledSpacecraft.getTarget()) {
                    if (this._controlledSpacecraft.targetNextBestHostile()) {
                        _targetSwitchSound.play();
                    }
                }
                this._controlledSpacecraft.aimWeapons(this._weaponAimThreshold, 0, dt);
            } else {
                this._controlledSpacecraft = null;
            }
        }
    };
    // -------------------------------------------------------------------------
    // private functions
    /**
     * Creates and returns a sound clip based on the name of the configuration settings its data is stored in
     * @param {String} settingName
     * @returns {SoundClip}
     */
    function _initSound(settingName) {
        return resources.getSoundEffect(
                config.getHUDSetting(settingName).name).createSoundClip(
                resources.SoundCategory.SOUND_EFFECT,
                config.getHUDSetting(settingName).volume);
    }
    // #########################################################################
    /**
     * @class The control context used for the game, building on the general control context 
     * @extends ControlContext
     */
    function ArmadaControlContext() {
        control.ControlContext.call(this);
        /**
         * Whether the context is currently in the mode for controlling a spacecraft as a pilot (as opposed to spectator mode, controlling
         * a free camera)
         * @type Boolean
         */
        this._pilotingMode = false;
        /**
         * Whether mouse turning is currently disabled (automatically happens if the player uses another input device for turning)
         * @type Boolean
         */
        this._mouseTurningDisabled = false;
        /**
         * Whether locking the pointer (using the Pointer Lock API) during the game (to avoid the mouse cursor leaving the window)
         * is enabled
         * @type Boolean
         */
        this._pointerLockEnabled = false;
        this.registerInputInterpreterType(KEYBOARD_NAME, keyboard.KeyboardInputInterpreter);
        this.registerInputInterpreterType(MOUSE_NAME, mouse.MouseInputInterpreter);
        this.registerInputInterpreterType(JOYSTICK_NAME, gamepad.GamepadInputInterpreter);
        if (utils.areTouchEventsSupported()) {
            this.registerInputInterpreterType(TOUCH_NAME, touch.TouchInputInterpreter);
        }
        this.registerControllerType(GENERAL_CONTROLLER_NAME, GeneralController);
        this.registerControllerType(FIGHTER_CONTROLLER_NAME, FighterController);
        this.registerControllerType(CAMERA_CONTROLLER_NAME, cameraController.CameraController);
    }
    ArmadaControlContext.prototype = new control.ControlContext();
    ArmadaControlContext.prototype.constructor = ArmadaControlContext;
    /**
     * @override
     * @param {Object} dataJSON
     * @param {Boolean} [onlyRestoreSettings=false]
     */
    ArmadaControlContext.prototype.loadSettingsFromJSON = function (dataJSON, onlyRestoreSettings) {
        control.ControlContext.prototype.loadSettingsFromJSON.call(this, dataJSON, onlyRestoreSettings);
        if (control.isPointerLockSupported()) {
            this._pointerLockEnabled = dataJSON.pointerLockEnabled;
        }
        if (onlyRestoreSettings) {
            localStorage.removeItem(POINTER_LOCK_ENABLED_LOCAL_STORAGE_ID);
        }
    };
    /**
     * @override
     */
    ArmadaControlContext.prototype.loadSettingsFromLocalStorage = function () {
        if (control.isPointerLockSupported() && localStorage[POINTER_LOCK_ENABLED_LOCAL_STORAGE_ID] !== undefined) {
            this._pointerLockEnabled = types.getBooleanValueFromLocalStorage(POINTER_LOCK_ENABLED_LOCAL_STORAGE_ID, {defaultValue: this._pointerLockEnabled});
        }
        control.ControlContext.prototype.loadSettingsFromLocalStorage.call(this);
    };
    /**
     * Returns whether the context is currently in the mode for controlling a spacecraft as a pilot (as opposed to spectator mode, 
     * controlling a free camera)
     * @returns {Boolean}
     */
    ArmadaControlContext.prototype.isInPilotMode = function () {
        return this._pilotingMode;
    };
    /**
     * Switches to piloting game mode, putting the player in the pilot seat of the given spacecraft.
     * @param {Spacecraft} pilotedSpacecraft
     * @param {Boolean} [skipTransition=false] If true, the camera transition will be instantaneous
     */
    ArmadaControlContext.prototype.switchToPilotMode = function (pilotedSpacecraft, skipTransition) {
        if (!pilotedSpacecraft || !pilotedSpacecraft.isAlive() || this._pilotingMode) {
            return;
        }
        this._pilotingMode = true;
        _targetSwitchSound = _initSound(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_SOUND);
        _targetSwitchDeniedSound = _initSound(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_DENIED_SOUND);
        _flightModeSwitchSound = _initSound(config.BATTLE_SETTINGS.HUD.FLIGHT_MODE_SWITCH_SOUND);
        _missileChangeSound = _initSound(config.BATTLE_SETTINGS.HUD.MISSILE_CHANGE_SOUND);
        _missileChangeDeniedSound = _initSound(config.BATTLE_SETTINGS.HUD.MISSILE_CHANGE_DENIED_SOUND);
        _missileSalvoSound = _initSound(config.BATTLE_SETTINGS.HUD.MISSILE_SALVO_SOUND);
        this.getController(FIGHTER_CONTROLLER_NAME).setControlledSpacecraft(pilotedSpacecraft);
        this.getController(CAMERA_CONTROLLER_NAME).setCameraToFollowObject(
                pilotedSpacecraft.getVisualModel(),
                skipTransition ? 0 : config.getSetting(config.BATTLE_SETTINGS.CAMERA_PILOTING_SWITCH_TRANSITION_DURATION),
                config.getSetting(config.BATTLE_SETTINGS.CAMERA_PILOTING_SWITCH_TRANSITION_STYLE),
                config.getDefaultCameraConfigurationName(pilotedSpacecraft));
        this.disableAction("followNext");
        this.disableAction("followPrevious");
        game.getScreen(armadaScreens.BATTLE_SCREEN_NAME).setHeaderContent("");
        if (this.getInputInterpreter(MOUSE_NAME).isEnabled()) {
            document.body.style.cursor = 'none';
        }
    };
    /**
     * Switches to spectator mode, in which the player can freely move the camera
     * around or follow and inspect any object in the scene.
     * @param {Boolean} [freeCamera=false] Whether to set the camera free at the current position and location.
     * @param {Boolean} [force=false] If true, the settings for spectator mode will be (re)applied even if the current state is already set
     * as spectator mode (useful for first time initialization and to force switch to free camera when following a spacecraft in spectator 
     * mode)
     */
    ArmadaControlContext.prototype.switchToSpectatorMode = function (freeCamera, force) {
        if (this._pilotingMode || force) {
            this._pilotingMode = false;
            this.getController(FIGHTER_CONTROLLER_NAME).setControlledSpacecraft(null);
            if (freeCamera) {
                this.getController(CAMERA_CONTROLLER_NAME).setToFreeCamera(false);
            }
            this.enableAction("followNext");
            this.enableAction("followPrevious");
            game.getScreen(armadaScreens.BATTLE_SCREEN_NAME).setHeaderContent(strings.get(strings.BATTLE.SPECTATOR_MODE));
            document.body.style.cursor = game.getDefaultCursor();
        }
    };
    /**
     * Disables the turning related actions from the mouse input interpreter.
     * To be called when the user turn using an input device other than the mouse.
     */
    ArmadaControlContext.prototype.disableMouseTurning = function () {
        if (!this._mouseTurningDisabled) {
            _mouseInputInterpreter.disableAction("yawLeft");
            _mouseInputInterpreter.disableAction("yawRight");
            _mouseInputInterpreter.disableAction("pitchUp");
            _mouseInputInterpreter.disableAction("pitchDown");
            _mouseInputInterpreter.disableAction("rollLeft");
            _mouseInputInterpreter.disableAction("rollRight");
            this._mouseTurningDisabled = true;
        }
    };
    /**
     * Enables the turning related actions from the mouse input interpreter
     * To be called when the user fires using the mouse.
     */
    ArmadaControlContext.prototype.enableMouseTurning = function () {
        if (this._mouseTurningDisabled) {
            _mouseInputInterpreter.enableAction("yawLeft");
            _mouseInputInterpreter.enableAction("yawRight");
            _mouseInputInterpreter.enableAction("pitchUp");
            _mouseInputInterpreter.enableAction("pitchDown");
            _mouseInputInterpreter.enableAction("rollLeft");
            _mouseInputInterpreter.enableAction("rollRight");
            this._mouseTurningDisabled = false;
        }
        if (!control.isPointerLocked() && (game.getScreen() === game.getScreen(armadaScreens.BATTLE_SCREEN_NAME))) {
            game.getScreen().requestPointerLock(false);
        }
    };
    /**
     * Returns whether mouse turning has been auto-disabled by the player using another input device for turning.
     * @returns {Boolean}
     */
    ArmadaControlContext.prototype.isMouseTurningDisabled = function () {
        return this._mouseTurningDisabled;
    };
    /**
     * Whether locking the pointer (using the Pointer Lock API) during the game (to avoid the mouse cursor leaving
     * the window) is enabled
     * @returns {Boolean}
     */
    ArmadaControlContext.prototype.isPointerLockEnabled = function () {
        return this._pointerLockEnabled;
    };
    /**
     * Turn on/off whether the pointer should be locked during the game (actual combat/mission)
     * @param {Boolean} value
     * @param {Boolean} [saveToLocalStorage=true]
     */
    ArmadaControlContext.prototype.setPointerLockEnabled = function (value, saveToLocalStorage) {
        if (control.isPointerLockSupported()) {
            if (saveToLocalStorage === undefined) {
                saveToLocalStorage = true;
            }
            this._pointerLockEnabled = value;
            if (saveToLocalStorage) {
                localStorage[POINTER_LOCK_ENABLED_LOCAL_STORAGE_ID] = value.toString();
            }
        }
    };
    // -------------------------------------------------------------------------
    // Initialization
    _context = new ArmadaControlContext();
    // -------------------------------------------------------------------------
    // Caching input interpreters
    _context.executeWhenReady(function () {
        _mouseInputInterpreter = _context.getInputInterpreter(MOUSE_NAME);
    });
    // -------------------------------------------------------------------------
    // Caching configuration settings
    config.executeWhenReady(function () {
        _strafeSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.STRAFE_SPEED_FACTOR);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        KEYBOARD_NAME: KEYBOARD_NAME,
        MOUSE_NAME: MOUSE_NAME,
        JOYSTICK_NAME: JOYSTICK_NAME,
        GAMEPAD_NAME: GAMEPAD_NAME,
        GENERAL_CONTROLLER_NAME: GENERAL_CONTROLLER_NAME,
        FIGHTER_CONTROLLER_NAME: FIGHTER_CONTROLLER_NAME,
        CAMERA_CONTROLLER_NAME: CAMERA_CONTROLLER_NAME,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadSettingsFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getControllers: _context.getControllers.bind(_context),
        getController: _context.getController.bind(_context),
        isControllerPriority: _context.isControllerPriority.bind(_context),
        getInputInterpreters: _context.getInputInterpreters.bind(_context),
        getInputInterpreter: _context.getInputInterpreter.bind(_context),
        control: _context.control.bind(_context),
        startListening: _context.startListening.bind(_context),
        stopListening: _context.stopListening.bind(_context),
        isListening: _context.isListening.bind(_context),
        setScreenCenter: _context.setScreenCenter.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        isInPilotMode: _context.isInPilotMode.bind(_context),
        switchToPilotMode: _context.switchToPilotMode.bind(_context),
        switchToSpectatorMode: _context.switchToSpectatorMode.bind(_context),
        isMouseTurningDisabled: _context.isMouseTurningDisabled.bind(_context),
        isPointerLockSupported: control.isPointerLockSupported,
        isPointerLockEnabled: _context.isPointerLockEnabled.bind(_context),
        setPointerLockEnabled: _context.setPointerLockEnabled.bind(_context),
        exitPointerLock: control.exitPointerLock,
        playMissileChangeSound: playMissileChangeSound
    };
});
