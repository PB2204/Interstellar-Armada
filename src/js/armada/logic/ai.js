/**
 * @param utils Used for PI related constants
 * @param vec Used for vector operations the AIs need to calculate their actions.
 * @param mat Used for matrix operations the AIs need to calculate their actions.
 * @param application Used for displaying error messages
 * @param physics Used for accessing the constant of how long rotation does a rotation matrix represent.
 * @param config Used for accessing game configuration/settings.
 * @param SpacecraftEvents Used for setting spacecraft event handlers
 * @param classes used for accessing spacecraft turn style enum type
 * @param equipment Used to access the FlightMode enum
 * @param formations Used for formations
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/physics",
    "armada/configuration",
    "armada/logic/SpacecraftEvents",
    "armada/logic/classes",
    "armada/logic/equipment",
    "armada/logic/formations",
    "utils/polyfill"
], function (utils, vec, mat, application, physics, config, SpacecraftEvents, classes, equipment, formations) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            /**
             * The types (IDs) of spacecraft commands that AIs can interpret and execute
             * @enum {String}
             */
            SpacecraftCommand = {
                /** A command to activate the jump engines of the spacecraft (to jump in / out) */
                JUMP: "jump",
                /** A command to set a list of target spacecrafts */
                TARGET: "target",
                /** A command to stand down and not attack new targets until a new target command is issued.
                 * Also cancels currently executed move commands. */
                STAND_DOWN: "standDown",
                /** A move command to approach or distance the spacecraft from another spacecraft */
                REACH_DISTANCE: "reachDistance",
                /** A command to cancel the currently executed move command (and get back to engaging enemies) */
                CANCEL_MOVE: "cancelMove"
            },
            /**
             * Specifies the direction of jump commands
             * @enum {String}
             */
            JumpCommandWay = {
                IN: "in",
                OUT: "out"
            },
            /**
             * @enum {Number}
             * The possible phases of the charge action of fighters.
             */
            ChargePhase = {
                /**
                 * The phase when the fighter is not performing a charge action.
                 */
                NONE: -1,
                /**
                 * The phase when the fighter is charging at its target with increased speed.
                 */
                APPROACH_ATTACK: 0,
                /**
                 * The phase when the fighter is evading its target to avoid collision and heads towards a destination beyond it.
                 */
                EVADE: 1
            },
            /**
             * @enum {Number}
             * The possible move command states the AI can be in (the move command it is currently executing)
             */
            MoveCommand = {
                NONE: -1,
                REACH_DISTANCE: 0
            },
            // ------------------------------------------------------------------------------
            // constants
            /**
             * The type identifier to be used when creating fighter AIs.
             * @type String
             */
            FIGHTER_AI_NAME = "fighter",
            /**
             * The type identifier to be used when creating ship AIs.
             * @type String
             */
            SHIP_AI_NAME = "ship",
            /**
             * The type identifier to be used when creating station AIs.
             * @type String
             */
            STATION_AI_NAME = "station",
            /**
             * The type identifier to be used when creating sentry AIs.
             * @type String
             */
            SENTRY_AI_NAME = "sentry",
            /**
             * Spacecrafts will stop turning towards the specified direction when reaching this angle (in radians).
             * @type Number
             */
            TURN_THRESHOLD_ANGLE = 0.002,
            /**
             * The factor to apply when converting angular velocity (turning) matrix angles to rad / s.
             * @type Number
             */
            ANGULAR_VELOCITY_CONVERSION_FACTOR = 1000 / physics.ANGULAR_VELOCITY_MATRIX_DURATION,
            /**
             * Both yaw and pitch needs to be below this angle to consider a fighter facing its target. (in radians)
             * @type Number
             */
            TARGET_FACING_ANGLE_THRESHOLD = Math.radians(45),
            /**
             * When starting a new attack run, fighters will approach their targets to at least the distance that is their weapon range
             * multiplied by this factor.
             * @type Number
             */
            BASE_MAX_DISTANCE_FACTOR = 0.3,
            /**
             * When closing in on a target because of having difficulties hitting it at the current distance, the maximum approach distance 
             * factor will be decreased to this value maximum (gradually).
             * @type Number
             */
            CLOSE_MAX_DISTANCE_FACTOR = 0.125,
            /**
             * When closing in on a target because of having difficulties hitting it at the current distance, the maximum approach distance 
             * is decreased this much in one step.
             * @type Number
             */
            MAX_DISTANCE_FACTOR_DECREMENT = 0.05,
            /**
             * The maximum approach ditance factor will be decreased by one step (decrement) after this many missed shots at the target.
             * @type Number
             */
            CLOSE_IN_TRIGGER_MISS_COUNT = 5,
            /**
             * During normal (not charge) attacks, fighters will keep a distance of at least its weapon range multiplied by this factor
             * from the target.
             * @type Number
             */
            MIN_DISTANCE_FACTOR = 0.06,
            /**
             * Fighters will start evasive maneuvers if their current target fires at them from a distance farther than their range 
             * multiplied by this number.
             * @type Number
             */
            MIN_EVADE_DISTANCE_FACTOR = 0.5,
            /**
             * During normal (not charge) attacks or when executing move commands, fighters will approach / back off with a
             * maximum speed equal to their acceleration multiplied by this factor.
             * @type Number
             */
            APPROACH_SPEED_FACTOR = 2,
            /**
             * When executing move commands, spacecrafts will move with this speed (in cruise mode) if they are farther than
             * FAR_APPROACH_THRESHOLD distance away from their target position
             * @type Number
             */
            FAR_APPROACH_SPEED_FACTOR = 4,
            /**
             * When executing move commands, a spacecraft is considered to be "far" from its target location if it is farther
             * then this distance (in meters), and as a result it will set a higher speed (see FAR_APPROACH_SPEED_FACTOR)
             * @type Number
             */
            FAR_APPROACH_THRESHOLD = 1000,
            /**
             * During charge attacks, fighters will approach with a maximum speed equal to their acceleration multiplied by this 
             * factor.
             * @type Number
             */
            CHARGE_SPEED_FACTOR = 4,
            /**
             * During charge attacks, fighters will evade with a maximum speed equal to their acceleration multiplied by this 
             * factor.
             * @type Number
             */
            CHARGE_EVADE_SPEED_FACTOR = 2,
            /**
             * Fighters will initiate a charge attack if they are unable to hit their target after firing this many shots at it.
             * @type Number
             */
            CHARGE_TRIGGER_MISS_COUNT = 15,
            /**
             * Fighters will initiate a charge attack if they are hit by spacecrafts other than their current target this many times.
             * @type Number
             */
            CHARGE_TRIGGER_HIT_COUNT = 4,
            /**
             * When strafing to avoid a spacecraft blocking the current firing path, fighters will strafe (along each axis) with a maximum
             * speed equal to their acceleration multiplied by this factor.
             * @type Number
             */
            BLOCK_AVOIDANCE_SPEED_FACTOR = 1,
            /**
             * Fighters will open fire if they are able to aim within an angle under which an object of the size of their target multiplied
             * by this factor is visible at the current target distance.
             * @type Number
             */
            FIRE_THRESHOLD_ANGLE_FACTOR = 0.25,
            /**
             * Fighters will initiate a rolling maneuver after missing their target for this many shots.
             * @type Number
             */
            ROLL_CORRECTION_TRIGGERING_MISS_COUNT = 3,
            /**
             * Fighters will roll this much during one roll correction maneuver (in radians).
             * @type Number
             */
            ROLL_CORRECTION_ANGLE = Math.radians(45),
            /**
             * The distance within which a spacecraft has to be from a certain place (destination vector) to be considered being at that 
             * place, in meters.
             * @type Number
             */
            EXACT_PLACE_RANGE = 1,
            /**
             * When charge attacking, fighters will start the evade maneuver after reaching a critical distance, with an evade vector that
             * is 45 degrees from the attack vector and has a length of the critical distance multiplied by this factor.
             * @type Number
             */
            CHARGE_EVADE_VECTOR_LENGTH_FACTOR = 1,
            /**
             * When performing evasive maneuvers, fighters will strafe with a maximum speed equal to their acceleration mutliplied by this
             * factor.
             * @type Number
             */
            EVASIVE_MANEUVER_SPEED_FACTOR = 1,
            /**
             * Fighters will perform one evasive maneuver for this long, in milliseconds.
             * @type Number
             */
            EVASIVE_MANEUVER_DURATION = 1000,
            /**
             * Fighters will update the offset vector they use to aim at their target in this interval, in milliseconds.
             * @type Number
             */
            TARGET_OFFSET_UPDATE_INTERVAL = 1500,
            /**
             * When starting a new attack run, a random aiming error will be calculated for fighter in the range of +/- this many degrees
             * along both axes
             * @type Number
             */
            MAX_AIM_ERROR = Math.radians(2),
            /**
             * Every time a new target offset is calculated, if it is not significantly different from the previous one, the maximum aiming
             * error is reduced by multiplying the current maximum by this factor. (otherwise, a new aiming error with the same maximum is
             * calculated)
             * @type Number
             */
            AIM_ERROR_REDUCTION_FACTOR = 0.5,
            /**
             * The square of the length of the difference between a newly calculated and the previous target offset needs to be less than 
             * this number in order to reduce the aiming error. (in meters)
             * @type Number
             */
            AIM_ERROR_REDUCTION_THRESHOLD = 25 * 25,
            /**
             * Once aimed, fighters will start firing after this time elapses, in milliseconds. (to simulate a reaction time)
             * @type Number
             */
            FIRE_DELAY = 350,
            /**
             * Fighters will start their evasive maneuvers this much time after triggered, in milliseconds. (to simulate a reaction time)
             * @type Number
             */
            EVASIVE_MANEUVER_DELAY = 200,
            /**
             * When attacking an enemy, ships will approach their targets to at least the distance that is their weapon range
             * multiplied by this factor.
             * @type Number
             */
            SHIP_MAX_DISTANCE_FACTOR = 0.9,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting determining for maximum how long should spacecrafts accelerate their turning, in
             * seconds.
             * @type Number
             */
            _turnAccelerationDuration = 0,
            /**
             * Cached value of the constant part of the expression calculating the intensity for turning (yawing and pitching), that only 
             * depends on constant configuration values.
             * @type Number
             */
            _turnIntensityBaseFactor = 0,
            /**
             * The random generator for creating positions for anchor-distance-based jump in sequences, so that it runs from the
             * same seed (the seed itself is random generated currently, but can be fixed for testing purposes / later use)
             * @type Function
             */
            _jumpInPositionSeed,
            /**
             * The random generator for determining AI aim errors.
             * @type Function
             */
            _aimErrorSeed,
            /**
             * The random generator used when determining AI evasive maneuver vectors.
             * @type Function
             */
            _evasionSeed,
            /**
             * The random generator used when determining AI charge maneuver vectors.
             * @type Function
             */
            _chargeSeed,
            /**
             * An associative array storing the constructors for the various types of AI by the string identifiers of the types.
             * @type Object
             */
            _aiConstructors,
            /**
             * A reusable object to store the result of angle calculations
             * @type Object
             */
            _angles = {
                yaw: 0,
                pitch: 0,
                roll: 0
            },
            /**
             * Reusable vector to avoid creating more garbage per frame
             * @type Number[3]
             */
            _targetPositionVector = [0, 0, 0],
            /**
             * Reusable vector to avoid creating more garbage per frame
             * @type Number[3]
             */
            _vectorToTarget = [0, 0, 0],
            /**
             * The default AI context (storing the actual AIs) the methods of which are exposed by this module.
             * @type AIContext
             */
            _context;
    // ##############################################################################
    /**
     * Returns a list of all the valid AI types
     * @returns {String[]}
     */
    function getAITypes() {
        return Object.keys(_aiConstructors);
    }
    /**
     * Resets the seed used to generate random jump in positions to the default values.
     * After calling this, the same sequence of random jump in position can be consistently
     * reproduced.
     */
    function resetJumpInPositionSeed() {
        _jumpInPositionSeed = Math.seed(config.getSetting(config.GENERAL_SETTINGS.DEFAULT_RANDOM_SEED));
    }
    /**
     * Resets all the seeds that are used to generate random values in this module.
     */
    function resetRandomSeeds() {
        resetJumpInPositionSeed();
        _aimErrorSeed = Math.seed(config.getSetting(config.GENERAL_SETTINGS.DEFAULT_RANDOM_SEED));
        _evasionSeed = Math.seed(config.getSetting(config.GENERAL_SETTINGS.DEFAULT_RANDOM_SEED));
        _chargeSeed = Math.seed(config.getSetting(config.GENERAL_SETTINGS.DEFAULT_RANDOM_SEED));
    }
    /**
     * Sets the position of the passed spacecraft according to the passed jump in command data.
     * The data must be fully prepared with lead and index set.
     * @param {Spacecraft} spacecraft
     * @param {SpacecraftEvents~CommandData} data
     * @param {Mission} mission
     * @returns {Boolean}
     */
    function positionForInwardJump(spacecraft, data, mission) {
        var /**@type Spacecraft*/ anchor;
        if (data.lead && (data.index > 0) && (data.jump.formation)) {
            // setting position and orientation based on a formation
            spacecraft.setPhysicalPosition(formations.getPositionInFormation(data.jump.formation, data.index, data.lead.getPhysicalPositionVector(), data.lead.getPhysicalOrientationMatrix()));
            spacecraft.updatePhysicalOrientationMatrix(data.lead.getPhysicalOrientationMatrix());
        } else if (data.jump.anchor) {
            // clear cached reference to the anchor spacecraft for every new execution of the command
            if (data.clearCache) {
                data.jump.anchorSpacecraft = null;
                data.clearCache = false;
            }
            // setting position and orientation based on an anchor ship
            anchor = data.jump.anchorSpacecraft || mission.getSpacecraft(data.jump.anchor);
            if (anchor) {
                data.jump.anchorSpacecraft = anchor;
                // setting random position with matching orientation at given distance
                if (data.jump.distance) {
                    spacecraft.updatePhysicalOrientationMatrix(mat.prod3x3SubOf4Aux(
                            mat.rotationX4Aux((_jumpInPositionSeed() - 0.5) * Math.PI),
                            mat.rotationZ4Aux(_jumpInPositionSeed() * utils.DOUBLE_PI)));
                    spacecraft.setPhysicalPosition(vec.getRowB43ScaledAux(spacecraft.getPhysicalOrientationMatrix(), -data.jump.distance));
                } else {
                    // overwriting position
                    if (data.jump.position) {
                        spacecraft.setPhysicalPosition(data.jump.position);
                    }
                    // overwriting orientation
                    if (data.jump.rotations) {
                        spacecraft.updatePhysicalOrientationMatrix(mat.rotation4FromJSON(data.jump.rotations));
                    }
                }
                // transforming to anchor-relative position and orientation
                if (data.jump.relative) {
                    spacecraft.setPhysicalPosition(vec.prodTranslationRotation3Aux(
                            spacecraft.getPhysicalPositionMatrix(),
                            anchor.getPhysicalOrientationMatrix()));
                    spacecraft.updatePhysicalOrientationMatrix(mat.prod3x3SubOf4Aux(
                            spacecraft.getPhysicalOrientationMatrix(),
                            anchor.getPhysicalOrientationMatrix()));
                }
                // adding position of the anchor ship
                spacecraft.setPhysicalPosition(vec.sum3Aux(
                        spacecraft.getPhysicalPositionVector(),
                        anchor.getPhysicalPositionVector()));
            } else if (data.jump.fallbackPosition) {
                // fallback to a specified position if the anchor spacecraft has been destroyed (will not be deterministic, depends on camera location)
                spacecraft.setPhysicalPosition(data.jump.fallbackPosition);
                if (data.jump.fallbackRotations) {
                    spacecraft.updatePhysicalOrientationMatrix(mat.rotation4FromJSON(data.jump.fallbackRotations));
                }
            } else {
                application.log_DEBUG("Warning: '" + spacecraft.getDisplayName() + "' has an invalid anchor for inward jump: '" + data.jump.anchor + "' and no fallback specified. Jump will be skipped. Might be because the anchor is already destroyed.");
                return false;
            }
        }
        return true;
    }
    // ##############################################################################
    /**
     * @class
     * An abstract AI class that provides some generally useful methods for controlling a spacecraft.
     * @param {Spacecraft} spacecraft The AI will control this spacecraft.
     * @param {Mission} mission The mission within which this AI will control the spacecraft
     */
    function SpacecraftAI(spacecraft, mission) {
        /**
         * The spacecraft this AI is controlling.
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The mission within which this AI controls the spacecraft.
         * @type Mission
         */
        this._mission = mission;
        /**
         * While true, the spacecraft should come to a halt and not engage any targets.
         * @type Boolean
         */
        this._standingDown = false;
        /**
         * The list of targets this spacecraft should destroy, in order of priority
         * @type Spacecraft
         */
        this._targetList = null;
        /**
         * While true, the spacecraft should not engage spacecrafts outside of its target list (even if provoked)
         * @type Boolean
         */
        this._priorityTargets = false;
        /**
         * The number of hits suffered from ships that are not the current target while facing the current target (reset when not facing the
         * target or when a new attack run starts)
         * @type Number
         */
        this._hitCountByNonTarget = 0;
        /**
         * Cached value of the range of the first weapon of the controlled spacecraft (at still position).
         * @type Number
         */
        this._weaponRange = (this._spacecraft && (this._spacecraft.getWeapons().length > 0)) ? this._spacecraft.getWeapons()[0].getRange(0) : 0;
        /**
         * Whether the controlled spacecraft is currently attacking its target
         * Needs to be updated by the overridden control() method!!
         * @type Boolean
         */
        this._attackingTarget = false;
        /**
         * The currently executed move command
         * @type Number
         */
        this._moveCommand = MoveCommand.NONE;
        /**
         * The target spacecraft of the currently executed move command (position/distance
         * specified in the command will be relative to this spacecraft)
         * @type Spacecraft
         */
        this._moveCommandTarget = null;
        /**
         * The minimum distance to be reached to satisfy the current move command
         * @type Number
         */
        this._moveCommandMinDistance = 0;
        /**
         * The maximum distance to be reached to satisfy the current move command
         * @type Number
         */
        this._moveCommandMaxDistance = 0;
        // attaching handlers to the spacecraft events
        if (this._spacecraft) {
            this._spacecraft.setSpeedHolding(true);
            this._spacecraft.addEventHandler(SpacecraftEvents.BEING_HIT, this._handleBeingHit.bind(this));
            this._spacecraft.addEventHandler(SpacecraftEvents.COMMAND_RECEIVED, this._handleCommand.bind(this));
        }
    }
    /**
     * Controls the spacecraft to turn (yaw and pitch) in the desired direction specified by two angles.
     * @param {Number} yaw The yaw angle of the direction to turn towards, with a positive number meaning a direction to the left, in radians.
     * @param {Number} pitch The pitch angle of the direction to turn towards, with a positive number meaning a direction upwards, in radians.
     * @param {Number} dt The time passed since the last turn command in milliseconds - for an estimation of the time the set yaw and pitch 
     * angular velocity will be in effect, so that they can be limited to avoid overshooting the desired angles
     */
    SpacecraftAI.prototype.turn = function (yaw, pitch, dt) {
        var turningMatrix, angularVelocity, angularAcceleration, turnStopAngle, turnIntensityFactor;
        turningMatrix = this._spacecraft.getTurningMatrix();
        angularAcceleration = this._spacecraft.getMaxAngularAcceleration();
        // a turn intensity of 1 means to accelerate the angular velocity to TURN_ACCELERATION_DURATION_S * acceleration (in rad / sec) and
        // lower values represent a linear portion of this intended angular velocity
        // the base intensity factor converts dt to seconds and counts in TURN_ACCELERATION_DURATION_S
        // based on angle = angular velocity * time, we choose an angular velocity that will not overshoot the intended angle in the next dt
        // milliseconds (which will mean about the next simulation step with relatively stable framerates)
        turnIntensityFactor = _turnIntensityBaseFactor / (angularAcceleration * dt);
        // calculating how much will the spacecraft turn at the current angular velocity if it starts decelerating right now
        angularVelocity = Math.sign(turningMatrix[4]) * vec.angle2y(turningMatrix[4], turningMatrix[5]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), TURN_THRESHOLD_ANGLE);
        if (yaw > turnStopAngle) {
            this._spacecraft.yawLeft(Math.min(Math.max(0, turnIntensityFactor * (yaw - turnStopAngle)), 1));
        } else if (yaw < -turnStopAngle) {
            this._spacecraft.yawRight(Math.min(Math.max(0, turnIntensityFactor * (-yaw - turnStopAngle)), 1));
        }
        angularVelocity = Math.sign(turningMatrix[6]) * vec.angle2x(turningMatrix[5], turningMatrix[6]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), TURN_THRESHOLD_ANGLE);
        if (pitch > turnStopAngle) {
            this._spacecraft.pitchUp(Math.min(Math.max(0, turnIntensityFactor * (pitch - turnStopAngle)), 1));
        } else if (pitch < -turnStopAngle) {
            this._spacecraft.pitchDown(Math.min(Math.max(0, turnIntensityFactor * (-pitch - turnStopAngle)), 1));
        }
    };
    /**
     * Controls the spacecraft to turn (roll and yaw) in the desired direction specified by two angles.
     * @param {Number} roll The roll angle of the direction to turn towards
     * @param {Number} yaw The yaw angle of the direction to turn towards
     * @param {Number} dt The time passed since the last turn command in milliseconds - for an estimation of the time the set yaw and pitch 
     * angular velocity will be in effect, so that they can be limited to avoid overshooting the desired angles
     */
    SpacecraftAI.prototype.rollAndYaw = function (roll, yaw, dt) {
        var turningMatrix, angularVelocity, angularAcceleration, turnStopAngle, turnIntensityFactor;
        turningMatrix = this._spacecraft.getTurningMatrix();
        angularAcceleration = this._spacecraft.getMaxAngularAcceleration();
        // a turn intensity of 1 means to accelerate the angular velocity to TURN_ACCELERATION_DURATION_S * acceleration (in rad / sec) and
        // lower values represent a linear portion of this intended angular velocity
        // the base intensity factor converts dt to seconds and counts in TURN_ACCELERATION_DURATION_S
        // based on angle = angular velocity * time, we choose an angular velocity that will not overshoot the intended angle in the next dt
        // milliseconds (which will mean about the next simulation step with relatively stable framerates)
        turnIntensityFactor = _turnIntensityBaseFactor / (angularAcceleration * dt);
        // calculating how much will the spacecraft turn at the current angular velocity if it starts decelerating right now
        angularVelocity = Math.sign(turningMatrix[2]) * vec.angle2x(turningMatrix[0], turningMatrix[2]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), TURN_THRESHOLD_ANGLE);
        if (roll > turnStopAngle) {
            this._spacecraft.rollLeft(Math.min(Math.max(0, turnIntensityFactor * (roll - turnStopAngle)), 1));
        } else if (roll < -turnStopAngle) {
            this._spacecraft.rollRight(Math.min(Math.max(0, turnIntensityFactor * (-roll - turnStopAngle)), 1));
        }
        angularVelocity = Math.sign(turningMatrix[4]) * vec.angle2y(turningMatrix[4], turningMatrix[5]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), TURN_THRESHOLD_ANGLE);
        if (yaw > turnStopAngle) {
            this._spacecraft.yawLeft(Math.min(Math.max(0, turnIntensityFactor * (yaw - turnStopAngle)), 1));
        } else if (yaw < -turnStopAngle) {
            this._spacecraft.yawRight(Math.min(Math.max(0, turnIntensityFactor * (-yaw - turnStopAngle)), 1));
        }
    };
    /**
     * Controls the spacecraft to turn (roll and pitch) in the desired direction specified by two angles.
     * @param {Number} roll The roll angle of the direction to turn towards
     * @param {Number} pitch The pitch angle of the direction to turn towards
     * @param {Number} dt The time passed since the last turn command in milliseconds - for an estimation of the time the set yaw and pitch 
     * angular velocity will be in effect, so that they can be limited to avoid overshooting the desired angles
     */
    SpacecraftAI.prototype.rollAndPitch = function (roll, pitch, dt) {
        var turningMatrix, angularVelocity, angularAcceleration, turnStopAngle, turnIntensityFactor;
        turningMatrix = this._spacecraft.getTurningMatrix();
        angularAcceleration = this._spacecraft.getMaxAngularAcceleration();
        turnIntensityFactor = _turnIntensityBaseFactor / (angularAcceleration * dt);
        angularVelocity = Math.sign(turningMatrix[2]) * vec.angle2x(turningMatrix[0], turningMatrix[2]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), TURN_THRESHOLD_ANGLE);
        if (roll > turnStopAngle) {
            this._spacecraft.rollLeft(Math.min(Math.max(0, turnIntensityFactor * (roll - turnStopAngle)), 1));
        } else if (roll < -turnStopAngle) {
            this._spacecraft.rollRight(Math.min(Math.max(0, turnIntensityFactor * (-roll - turnStopAngle)), 1));
        }
        angularVelocity = Math.sign(turningMatrix[6]) * vec.angle2x(turningMatrix[5], turningMatrix[6]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), TURN_THRESHOLD_ANGLE);
        if (pitch > turnStopAngle) {
            this._spacecraft.pitchUp(Math.min(Math.max(0, turnIntensityFactor * (pitch - turnStopAngle)), 1));
        } else if (pitch < -turnStopAngle) {
            this._spacecraft.pitchDown(Math.min(Math.max(0, turnIntensityFactor * (-pitch - turnStopAngle)), 1));
        }
    };
    /**
     * Can be used to set an appropriate forward / reverse speed for the controlled spacecraft so that its distance from a target it is
     * pointing towards is within a desired range.
     * @param {Number} currentDistance The distance from the target to approach (the spacecraft must be pointing towards this target, at least roughly)
     * @param {Number} maxDistance The upper limit of the desired distance from the target. If the spacecraft is farther, it will close in. (move forward)
     * @param {Number} minDistance The lower limit of the desired distance from the target. If the spacecraft is closer, it will back off. (move backward)
     * @param {Number} maxSpeed The maximum forward/reverse speed to use when closing in / backing off.
     */
    SpacecraftAI.prototype.approach = function (currentDistance, maxDistance, minDistance, maxSpeed) {
        var speed, stopDistance;
        speed = this._spacecraft.getRelativeVelocityMatrix()[13];
        // calculate the distance the spacecraft will travel if we reset the speed to zero right away so that we can start slowing down in time
        stopDistance = speed * speed / (2 * this._spacecraft.getMaxAcceleration());
        if (speed < 0) {
            stopDistance = -stopDistance;
        }
        if (currentDistance - stopDistance > maxDistance) {
            this._spacecraft.setSpeedTarget(maxSpeed);
        } else if ((minDistance >= 0) && (currentDistance - stopDistance < minDistance)) {
            this._spacecraft.setSpeedTarget(-maxSpeed);
        } else {
            this._spacecraft.resetSpeed();
        }
    };
    /**
     * Turns the spacecraft (engages turning thrusters) according to its turn style to make sure its attack vector points
     * towards the given target direction. (within the spacecraft's attack threshold angle)
     * @param {Number[3]} relativeTargetDirection The direction (unit) vector pointing towards the target in object space
     * @param {Number} dt The milliseconds passed since the last simulation step
     */
    SpacecraftAI.prototype.orientToAttackPosition = function (relativeTargetDirection, dt) {
        var
                /** @type Number[2] */
                angles,
                /** @type Number */
                thresholdAngle, angleDiff1, angleDiff2;
        angles = this._spacecraft.getClass().getAttackVectorAngles();
        thresholdAngle = this._spacecraft.getClass().getAttackThresholdAngle();
        switch (this._spacecraft.getClass().getTurnStyle()) {
            case classes.SpacecraftTurnStyle.YAW_PITCH:
                if ((Math.abs(_angles.yaw - angles[0]) > thresholdAngle) || (Math.abs(_angles.pitch - angles[1]) > thresholdAngle)) {
                    this.turn(_angles.yaw - angles[0], _angles.pitch - angles[1], dt);
                }
                break;
            case classes.SpacecraftTurnStyle.ROLL_YAW:
                vec.getRollAndYaw(_angles, relativeTargetDirection, true);
                angleDiff1 = _angles.roll - angles[0];
                angleDiff2 = _angles.yaw - angles[1];
                if ((Math.abs(angleDiff1) > thresholdAngle) || (Math.abs(angleDiff2) > thresholdAngle)) {
                    if (Math.abs(angleDiff2) > utils.HALF_PI) {
                        angleDiff1 = 0;
                    } else if (Math.abs(angleDiff1) > utils.HALF_PI) {
                        angleDiff2 = 0;
                    }
                    this.rollAndYaw(angleDiff1, angleDiff2, dt);
                }
                break;
            case classes.SpacecraftTurnStyle.ROLL_PITCH:
                vec.getRollAndPitch(_angles, relativeTargetDirection, true);
                angleDiff1 = _angles.roll - angles[0];
                angleDiff2 = _angles.pitch - angles[1];
                if ((Math.abs(angleDiff1) > thresholdAngle) || (Math.abs(angleDiff2) > thresholdAngle)) {
                    if (Math.abs(angleDiff2) > utils.HALF_PI) {
                        angleDiff1 = 0;
                    } else if (Math.abs(angleDiff1 - Math.sign(angleDiff1) * Math.PI) < Math.abs(angleDiff1)) {
                        angleDiff1 -= Math.sign(angleDiff1) * Math.PI;
                        _angles.pitch = -_angles.pitch;
                    }
                    this.rollAndPitch(angleDiff1, _angles.pitch - angles[1], dt);
                }
                break;
        }
    };
    /**
     * Updates the AI state in case a new target has been selected by the spacecraft.
     */
    SpacecraftAI.prototype._handleTargetSwitch = function () {
        this._hitCountByNonTarget = 0;
    };
    /**
     * Returns whether the passed spacecraft should be kept in the target list
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    SpacecraftAI._targetListFilterFunction = function (spacecraft) {
        return spacecraft.isAlive();
    };
    /**
     * Sets the appropriate target for the controlled spacecraft based on the current internal state of the AI
     * @param {Spacecraft} [newTarget] When given, this target will be set if the current state allows it (e.g. not
     * standing down, no higher priority current target set)
     */
    SpacecraftAI.prototype._updateTarget = function (newTarget) {
        var i, oldTarget;
        // not engaging any targets while standing down
        if (this._standingDown) {
            this._spacecraft.setTarget(null);
            return;
        }
        oldTarget = this._spacecraft.getTarget();
        // remove destroyed spacecrafts from target list
        if (this._targetList) {
            this._targetList = this._targetList.filter(SpacecraftAI._targetListFilterFunction);
        }
        // if there is a target list set...
        if (this._targetList && (this._targetList.length > 0)) {
            // if the targets are priority...
            if (this._priorityTargets) {
                //only allow switching to new targets within the list
                if (newTarget) {
                    if (this._targetList.indexOf(newTarget) >= 0) {
                        this._spacecraft.setTarget(newTarget);
                    }
                } else {
                    // find new targets from within the list first, and also try to find a new target, if the current
                    // one is not from the list (for example switch when a priority target jumps in)
                    if (!oldTarget || (this._targetList.indexOf(oldTarget) < 0)) {
                        for (i = 0; i < this._targetList.length; i++) {
                            if (!this._targetList[i].isAway()) {
                                this._spacecraft.setTarget(this._targetList[i]);
                                break;
                            }
                        }
                        if (!oldTarget && (i >= this._targetList.length)) {
                            this._spacecraft.targetNextBestHostile();
                        }
                    }
                }
            } else {
                // for non-priority targets, allow switching to any new target (for example when provoked)
                if (newTarget) {
                    this._spacecraft.setTarget(newTarget);
                } else if (!oldTarget) {
                    // find a new target from the list, if possible, and any hostile, if not
                    for (i = 0; i < this._targetList.length; i++) {
                        if (!this._targetList[i].isAway()) {
                            this._spacecraft.setTarget(this._targetList[i]);
                            break;
                        }
                    }
                    if (i >= this._targetList.length) {
                        this._spacecraft.targetNextBestHostile();
                    }
                }
            }
        } else {
            // if there is no specific target list, switch to the new target, if specified, otherwise just find
            // a new target if the current one has been destroyed
            if (newTarget) {
                this._spacecraft.setTarget(newTarget);
            } else if (!oldTarget) {
                this._spacecraft.targetNextBestHostile();
            }
        }
        // call the appropriate handler if the target changed
        if (this._spacecraft.getTarget() !== oldTarget) {
            this._handleTargetSwitch();
        }
    };
    /**
     * Updates the AI state for when the spacecraft has been hit.
     * @param {SpacecraftEvents~BeingHitData} data 
     */
    SpacecraftAI.prototype._handleBeingHit = function (data) {
        var spacecraft = data.spacecraft;
        // if being hit by a (still alive and present) hostile ship while having different target
        if (
                this._spacecraft && this._spacecraft.isAlive() &&
                spacecraft.isAlive() && !spacecraft.isAway() && spacecraft.isHostile(this._spacecraft) &&
                this._spacecraft.getTarget() && (this._spacecraft.getTarget() !== spacecraft)) {
            // switch target in case the current target is not targeting us anyway or is out of range
            if ((this._spacecraft.getTarget().getTarget() !== this._spacecraft) || !this._attackingTarget) {
                this._updateTarget(spacecraft);
            }
            this._hitCountByNonTarget++;
        }
    };
    /**
     * Executes the command that the spacecraft received
     * @param {SpacecraftEvents~CommandData} data
     */
    SpacecraftAI.prototype._handleCommand = function (data) {
        var
                /**@type Number*/ i,
                /**@type String*/ way,
                /**@type Spacecraft*/ target;
        switch (data.command) {
            case SpacecraftCommand.JUMP:
                // handling jump command
                // determining jump direction (inward / outward)
                if (data.jump && data.jump.way) {
                    way = data.jump.way;
                } else {
                    way = this._spacecraft.isAway() ? JumpCommandWay.IN : JumpCommandWay.OUT;
                }
                if (way === JumpCommandWay.IN) {
                    if (this._spacecraft.isAway()) {
                        // processing parameters for inward jumps
                        if (data.jump) {
                            if (!positionForInwardJump(this._spacecraft, data, this._mission)) {
                                break;
                            }
                        }
                        this._spacecraft.jumpIn();
                    }
                } else {
                    this._spacecraft.jumpOut(false);
                }
                break;
            case SpacecraftCommand.TARGET:
                // handling target command
                if (data.target) {
                    // clear cached reference to the target spacecrafts for every new execution of the command
                    if (data.clearCache) {
                        data.target.targetSpacecrafts = null;
                        data.clearCache = false;
                    }
                    // if the target spacecrafts have already been queried, just copy the list
                    if (data.target.targetSpacecrafts) {
                        this._targetList = data.target.targetSpacecrafts.slice();
                    } else {
                        // otherwise query them, create and save the list now:
                        if (data.target.single) {
                            // selecting a single target
                            target = this._mission.getSpacecraft(data.target.single);
                            if (target) {
                                this._targetList = [target];
                            } else {
                                application.log_DEBUG("Warning: '" + this._spacecraft.getDisplayName() + "' has an invalid target specified: '" + data.target.single + "'. Might be because the ship is already destroyed.");
                            }
                        } else if (data.target.list) {
                            // selecting a target list
                            this._targetList = [];
                            for (i = 0; i < data.target.list.length; i++) {
                                target = this._mission.getSpacecraft(data.target.list[i]);
                                if (target) {
                                    this._targetList.push(target);
                                } else {
                                    application.log_DEBUG("Warning: '" + this._spacecraft.getDisplayName() + "' has an invalid target specified: '" + data.target.list[i] + "'. Might be because the ship is already destroyed.");
                                }
                            }
                        } else if (data.target.squads) {
                            // selecting a list of squads as target
                            this._targetList = [];
                            for (i = 0; i < data.target.squads.length; i++) {
                                this._targetList = this._targetList.concat(this._mission.getSpacecraftsInSquad(data.target.squads[i]));
                            }
                        } else if (data.target.none) {
                            this._targetList = null;
                        } else {
                            application.showError("'" + this._spacecraft.getDisplayName() + "' has no target specified for targeting command!");
                        }
                        // save the target list for further spacecrafts executing the same command
                        if (this._targetList) {
                            data.target.targetSpacecrafts = this._targetList.slice();
                        }
                    }
                    if (this._targetList && (this._targetList.length > 0)) {
                        this._spacecraft.setTarget(this._targetList[0]);
                        this._standingDown = false;
                    } else if (data.target.none) {
                        this._spacecraft.setTarget(null);
                    }
                    this._priorityTargets = (data.target.priority === true);
                }
                break;
            case SpacecraftCommand.STAND_DOWN:
                // handling stand down command
                this._standingDown = true;
                this._cancelMoveCommand();
                break;
            case SpacecraftCommand.REACH_DISTANCE:
                // handling reach distance command
                if (data.reachDistance) {
                    target = this._mission.getSpacecraft(data.reachDistance.target);
                    if (target && target.isAlive() && !target.isAway()) {
                        this._moveCommand = MoveCommand.REACH_DISTANCE;
                        this._moveCommandTarget = target;
                        this._moveCommandMinDistance = data.reachDistance.minDistance || 0;
                        this._moveCommandMaxDistance = data.reachDistance.maxDistance || 0;
                    }
                }
                break;
            case SpacecraftCommand.CANCEL_MOVE:
                // handling cancel move command
                this._cancelMoveCommand();
                break;
            default:
                application.showError("Unknown spacecraft command: '" + data.command + "'!");
        }
    };
    /**
     * Cancels the currently executed move command, so the spacecraft AI will get back to the
     * default behavior (engaging hostile targets)
     */
    SpacecraftAI.prototype._cancelMoveCommand = function () {
        this._moveCommand = MoveCommand.NONE;
        this._moveCommandTarget = null;
    };
    /**
     * Executes the current move command (if any) by turning/setting speed and cancels it if it has been conpleted
     * or no longer valid (e.g. the move command target has been destroyed or left)
     * @param {Number[3]} positionVector The position vector of the controlled spacecraft
     * @param {Float32Array} orientationMatrix The orientation matrix of the controlled spacecraft
     * @param {Number} acceleration The acceleration of the controlled spacecraft (m/s^2)
     * @param {Number} dt Time elapsed since last simulation step (milliseconds)
     */
    SpacecraftAI.prototype._executeMoveCommand = function (positionVector, orientationMatrix, acceleration, dt) {
        var relativeTargetDirection, targetDistance, facingTarget, isFar, moveCommandCompleted;
        switch (this._moveCommand) {
            case MoveCommand.REACH_DISTANCE:
                if (!this._moveCommandTarget || !this._moveCommandTarget.isAlive() || this._moveCommandTarget.isAway()) {
                    this._cancelMoveCommand();
                    return;
                }
                relativeTargetDirection = vec.prodMat4Vec3Aux(
                        orientationMatrix,
                        vec.diff3Aux(this._moveCommandTarget.getPhysicalPositionVector(), positionVector));
                targetDistance = vec.extractLength3(relativeTargetDirection);
                moveCommandCompleted = true;
                if (this._moveCommandMaxDistance !== 0) {
                    // approach target, because we are too far
                    if (targetDistance > this._moveCommandMaxDistance) {
                        vec.getYawAndPitch(_angles, relativeTargetDirection);
                        facingTarget = (Math.abs(_angles.yaw) < TARGET_FACING_ANGLE_THRESHOLD) && (Math.abs(_angles.pitch) < TARGET_FACING_ANGLE_THRESHOLD);
                        this.turn(_angles.yaw, _angles.pitch, dt);
                        isFar = targetDistance > this._moveCommandMaxDistance + FAR_APPROACH_THRESHOLD;
                        this._spacecraft.changeFlightMode(isFar ? equipment.FlightMode.CRUISE : equipment.FlightMode.COMBAT);
                        if (facingTarget) {
                            this.approach(targetDistance, this._moveCommandMaxDistance, 0, acceleration * (isFar ? FAR_APPROACH_SPEED_FACTOR : APPROACH_SPEED_FACTOR));
                        } else {
                            this._spacecraft.resetSpeed();
                        }
                        moveCommandCompleted = false;
                    }
                }
                if (this._moveCommandMinDistance !== 0) {
                    // get away from target, because we are too close
                    if (targetDistance < this._moveCommandMinDistance) {
                        vec.scale3(relativeTargetDirection, -1);
                        vec.getYawAndPitch(_angles, relativeTargetDirection);
                        facingTarget = (Math.abs(_angles.yaw) < TARGET_FACING_ANGLE_THRESHOLD) && (Math.abs(_angles.pitch) < TARGET_FACING_ANGLE_THRESHOLD);
                        this.turn(_angles.yaw, _angles.pitch, dt);
                        isFar = targetDistance < this._moveCommandMinDistance - FAR_APPROACH_THRESHOLD;
                        this._spacecraft.changeFlightMode(isFar ? equipment.FlightMode.CRUISE : equipment.FlightMode.COMBAT);
                        if (facingTarget) {
                            this.approach(this._moveCommandMinDistance - targetDistance, 0, 0, acceleration * (isFar ? FAR_APPROACH_SPEED_FACTOR : APPROACH_SPEED_FACTOR));
                        } else {
                            this._spacecraft.resetSpeed();
                        }
                        moveCommandCompleted = false;
                    }
                }
                if (moveCommandCompleted) {
                    this._cancelMoveCommand();
                }
                break;
        }
    };
    // ##############################################################################
    /**
     * @class
     * @extends SpacecraftAI
     * An AI that is suitable to control a fighter - that is a spacecraft with the assumptions that it is small, maneuverable and has its
     * guns pointing forward, requiring it to face its target when firing.
     * @param {Spacecraft} fighter The fighter to control
     * @param {Mission} mission The mission within which this AI will control the fighter
     */
    function FighterAI(fighter, mission) {
        var reactionTimeFactor = ((mission.getPilotedSpacecraft() && mission.getPilotedSpacecraft().isHostile(fighter)) ? mission.getDifficultyLevel().getEnemyReactionTimeFactor() : 1);
        SpacecraftAI.call(this, fighter, mission);
        /**
         * The time elapsed since finishing the last roll movement while firing (reset when not firing or when a new attack run starts), in 
         * milliseconds.
         * @type Number
         */
        this._timeSinceLastRoll = 0;
        /**
         * The time elapsed since last hitting the current target while firing (reset when not facing the target or when a new attack run 
         * starts), in milliseconds.
         * @type Number
         */
        this._timeSinceLastTargetHit = 0;
        /**
         * The time elapsed since last closing in (decreasing the approach distance by one decrement) while firing (reset when not facing 
         * the target or when a new attack run starts), in milliseconds.
         * @type Number
         */
        this._timeSinceLastClosingIn = 0;
        /**
         * The amount of time left before starting an evasive maneuver, in milliseconds.
         * @type Number
         */
        this._evasiveManeuverDelayLeft = 0;
        /**
         * The amount of time to wait before starting evasive maneuvers, in milliseconds.
         * @type Number
         */
        this._evasiveManeuverDelay = EVASIVE_MANEUVER_DELAY * reactionTimeFactor;
        /**
         * The time elapsed since the current evasive maneuver started, in milliseconds, or -1 if there is no evasive maneuver in progress.
         * @type Number
         */
        this._evasiveManeuverTime = -1;
        /**
         * The 2D vector describing the strafing velocity (horizontal and vertical) with which the current evasive maneuver should be 
         * carried out.
         * @type Number
         */
        this._evasiveVelocityVector = [0, 0];
        /**
         * The time elapsed since the start of the current roll maneuver in milliseconds, or -1 if the fighter is not rolling currently.
         * @type Number
         */
        this._rollTime = -1;
        /**
         * The current phase of the charge maneuver the fighter is performing. (enum ChargePhase)
         * @type Number
         */
        this._chargePhase = ChargePhase.NONE;
        /**
         * The 3D vector describing the world-space position of the destination point where the fighter should head to during the evade 
         * phase of the charge maneuver. (in meters)
         * @type Number
         */
        this._chargeDestination = [0, 0, 0];
        /**
         * When peforming a normal (not charge) attack, the fighter will approach its target to be at a maximum distance which equals the
         * range of its weapons multiplied by this factor. This starts out at a base value and is decreased gradually if the fighter 
         * cannot hit its target at the current distance.
         * @type Number
         */
        this._maxDistanceFactor = BASE_MAX_DISTANCE_FACTOR;
        /**
         * If the firing path of the fighter is blocked by another spacecraft, a reference of that spacecraft is stored in this variable
         * so that a detailed check about whether the blocking still persists can be performed for this specific craft (but doesn't need
         * to be performed for other spacecrafts). It is null if the firing path isn't blocked.
         * @type Spacecraft|null
         */
        this._isBlockedBy = null;
        /**
         * Cached value of whether the controlled spacecraft is currently facing its target.
         * @type Boolean
         */
        this._facingTarget = false;
        /**
         * Cached value of the distance to the current target of the controlled spacecraft.
         * @type Boolean
         */
        this._targetDistance = 0;
        /**
         * When aiming at the target, this regularly (but not continuously) updated offset vector is used to compensate for (approximate) 
         * its movement
         * @type Array
         */
        this._targetOffset = [0, 0, 0];
        /**
         * Countdown timer for when to update the stored target offset vector. In milliseconds.
         * @type Number
         */
        this._targetOffsetUpdateTimeLeft = 0;
        /**
         * The current maximum to use when calculating the next aiming error.
         * @type Number
         */
        this._maxAimError = 0;
        /**
         * The current aiming error by which the aim angles are offset. (yaw, pitch)
         * @type Array
         */
        this._aimError = [0, 0];
        /**
         * The amount of time left before starting to fire, in milliseconds.
         * @type Number
         */
        this._fireDelayLeft = 0;
        /**
         * The amount of time to wait before starting to fire after aiming, in milliseconds.
         * @type Number
         */
        this._fireDelay = FIRE_DELAY * reactionTimeFactor;
        /**
         * The list of missiles that we fired at the current target (to avoid overkill by launching too many)
         * @type Missile[]
         */
        this._missilesOnTarget = [];
        // attaching handlers to the various spacecraft events
        this._spacecraft.addEventHandler(SpacecraftEvents.TARGET_HIT, this._handleTargetHit.bind(this));
        this._spacecraft.addEventHandler(SpacecraftEvents.ANY_SPACECRAFT_HIT, this._handleAnySpacecraftHit.bind(this));
        this._spacecraft.addEventHandler(SpacecraftEvents.TARGET_FIRED, this._handleTargetFired.bind(this));
    }
    FighterAI.prototype = new SpacecraftAI();
    FighterAI.prototype.constructor = FighterAI;
    /**
     * Calculates a new random aiming error based on the current maximum.
     */
    FighterAI.prototype._updateAimError = function () {
        this._aimError[0] = (_aimErrorSeed() - 0.5) * 2 * this._maxAimError;
        this._aimError[1] = (_aimErrorSeed() - 0.5) * 2 * this._maxAimError;
    };
    /**
     * Sets up the state of the AI to perform a new attack run, to be used when switching to a new target or after a charge maneuver has 
     * been finished. The approach distance, attack path blocking state and triggers for charge, close-in, roll are reset. Does not cancel
     * in progress evasive maneuvers.
     */
    FighterAI.prototype._startNewAttackRun = function () {
        this._chargePhase = ChargePhase.NONE;
        this._spacecraft.changeFlightMode(equipment.FlightMode.COMBAT);
        this._hitCountByNonTarget = 0;
        this._timeSinceLastTargetHit = 0;
        this._timeSinceLastClosingIn = 0;
        this._timeSinceLastRoll = 0;
        this._maxDistanceFactor = BASE_MAX_DISTANCE_FACTOR;
        this._isBlockedBy = null;
        this._rollTime = -1;
        this._targetOffset = [0, 0, 0];
        this._targetOffsetUpdateTimeLeft = TARGET_OFFSET_UPDATE_INTERVAL;
        this._maxAimError = MAX_AIM_ERROR;
        this._fireDelayLeft = this._fireDelay;
        this._updateAimError();
    };
    /**
     * @override
     */
    FighterAI.prototype._handleTargetSwitch = function () {
        SpacecraftAI.prototype._handleTargetSwitch.call(this);
        this._missilesOnTarget.length = 0;
        this._startNewAttackRun();
    };
    /**
     * If there is no evasive maneuver in progress, triggers a new one, which will start after the evasive maneuver delay (reaction time)
     * @returns {Boolean} Whether a new evasive maneuver has been triggered
     */
    FighterAI.prototype._triggerEvasiveManeuver = function () {
        if (this._evasiveManeuverTime < 0) {
            this._evasiveManeuverDelayLeft = this._evasiveManeuverDelay;
            this._evasiveManeuverTime = 0;
            return true;
        }
        return false;
    };
    /**
     * @override
     * @param {SpacecraftEvents~BeingHitData} data 
     */
    FighterAI.prototype._handleBeingHit = function (data) {
        // initiating a new evasive maneuver in case one is not already in progress
        // if the attack path is blocked by a spacecraft, then we are already strafing, so no evasive maneuver is started
        if (!this._isBlockedBy) {
            if (this._triggerEvasiveManeuver()) {
                // marking the direction opposite to the hit position so an appropriate evasive vector can be calculated
                this._evasiveVelocityVector[0] = -data.hitPosition[0];
                this._evasiveVelocityVector[1] = -data.hitPosition[2];
                vec.normalize2(this._evasiveVelocityVector);
            }
        }
        SpacecraftAI.prototype._handleBeingHit.call(this, data);
    };
    /**
     * Updates the AI state for when the controlled fighter has successfully hit its current target.
     */
    FighterAI.prototype._handleTargetHit = function () {
        this._timeSinceLastTargetHit = 0;
    };
    /**
     * Updates the AI state for when the controlled fighter has hit any spacecraft (including itself and its current target)
     * @param {SpacecraftEvents~AnySpacecraftHitData} data
     */
    FighterAI.prototype._handleAnySpacecraftHit = function (data) {
        var spacecraft = data.spacecraft;
        // if a spacecraft other than the controlled one or the current target is hit while performing either a normal or charge attack
        // (but not evading) we mark the hit spacecraft as blocking the firing path, triggering blocker avoidance strafing maneuvers
        // if a blocking spacecraft is already mark, we overwrite it only if it is hostile, as the new one might be friendly, which means
        // we should not continue firing until the path is clear again
        if (this._spacecraft && this._spacecraft.isAlive() && (spacecraft !== this._spacecraft) && (this._chargePhase !== ChargePhase.EVADE) && (spacecraft !== this._spacecraft.getTarget()) && (!this._isBlockedBy || (this._isBlockedBy.isHostile(this._spacecraft)))) {
            this._isBlockedBy = spacecraft;
            // block avoidance controls strafing just like evasive maneuvers, therefore both cannot be active at the same time
            this._evasiveManeuverTime = -1;
            // charge attacks are canceled so we do not run into the blocking spacecraft
            this._chargePhase = ChargePhase.NONE;
            this._spacecraft.changeFlightMode(equipment.FlightMode.COMBAT);
        }
    };
    /**
     * Updates the AI state for when the current target of the controlled spacecraft fires.
     */
    FighterAI.prototype._handleTargetFired = function () {
        var angle;
        // if we see the current target firing at us, start a random evasive maneuver
        if (!this._isBlockedBy &&
                this._facingTarget && this._spacecraft && this._spacecraft.getTarget() && (this._spacecraft.getTarget().getTarget() === this._spacecraft) &&
                (this._targetDistance > this._weaponRange * MIN_EVADE_DISTANCE_FACTOR)) {
            if (this._triggerEvasiveManeuver()) {
                angle = _evasionSeed() * utils.DOUBLE_PI;
                this._evasiveVelocityVector[0] = 1;
                this._evasiveVelocityVector[1] = 0;
                vec.rotate2(this._evasiveVelocityVector, angle);
            }
        }
    };
    /**
     * Updates the AI state for the case when the battle scene with all objects has been moved by a vector, updating stored world-space
     * positions.
     * @param {Number[3]} vector
     */
    FighterAI.prototype.handleSceneMoved = function (vector) {
        vec.add3(this._chargeDestination, vector);
    };
    /**
     * Performs all spacecraft controlling actions (turning, rolling, targeting, firing, strafing, setting speed etc) based on the current
     * state of the AI and updates the state accordingly. Should be called once in every battle simulation step.
     * @param {Number} dt The time elapsed since the last control step, in milliseconds.
     */
    FighterAI.prototype.control = function (dt) {
        var
                /** @type Spacecraft */
                target,
                /** @type Missile */
                missile,
                /** @type Number[3] */
                positionVector, newOffset,
                relativeTargetDirection, relativeBlockerPosition,
                /** @type Number */
                i,
                targetHitTime, hitpoints,
                ownSize, targetSize,
                fireThresholdAngle,
                acceleration, minDistance, maxDistance, speed, blockAvoidanceSpeed, baseDistance,
                weaponCooldown,
                rollDuration, rollWaitTime,
                angularAcceleration, maxAngularVelocity,
                worldProjectileVelocity,
                closeInTriggerTime,
                range,
                /** @type Boolean */
                stillBlocked, strafingHandled,
                /** @type Array */
                weapons,
                /** @type Float32Array */
                orientationMatrix, targetPosition;
        // only perform anything if the controlled spacecraft still exists
        if (this._spacecraft) {
            // if the controlled spacecraft has been destroyed, remove the reference
            if (!this._spacecraft.isAlive()) {
                this._spacecraft = null;
                return;
            }
            // if the spacecraft is not on the battlefield, don't do anything
            if (this._spacecraft.isAway()) {
                return;
            }
            // .................................................................................................
            // state setup
            strafingHandled = false;
            // .................................................................................................
            // targeting
            this._updateTarget();
            // .................................................................................................
            // caching / referencing commonly needed variables
            acceleration = this._spacecraft.getMaxAcceleration();
            ownSize = this._spacecraft.getVisualModel().getScaledSize();
            // caching / referencing needed variables
            positionVector = this._spacecraft.getPhysicalPositionVector();
            orientationMatrix = this._spacecraft.getPhysicalOrientationMatrix();
            speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            target = this._spacecraft.getTarget();
            this._attackingTarget = false;
            // updating missile on target array
            for (i = 0; i < this._missilesOnTarget.length; i++) {
                if (this._missilesOnTarget[i].getTarget() !== target) {
                    this._missilesOnTarget.splice(i, 1);
                    i--;
                }
            }
            this._executeMoveCommand(positionVector, orientationMatrix, acceleration, dt);
            if (this._moveCommand === MoveCommand.NONE) {
                // .................................................................................................
                // evade phase of charge maneuver
                if (this._chargePhase === ChargePhase.EVADE) {
                    this._attackingTarget = !!target;
                    vec.setDiff3(_vectorToTarget, this._chargeDestination, positionVector);
                    relativeTargetDirection = vec.prodMat4Vec3Aux(
                            orientationMatrix,
                            _vectorToTarget);
                    this._targetDistance = vec.extractLength3(relativeTargetDirection);
                    vec.getYawAndPitch(_angles, relativeTargetDirection);
                    this.turn(_angles.yaw, _angles.pitch, dt);
                    this._spacecraft.setSpeedTarget(acceleration * CHARGE_EVADE_SPEED_FACTOR);
                    if ((this._targetDistance <= EXACT_PLACE_RANGE) || (relativeTargetDirection[1] < 0) || (speed < 0)) {
                        this._startNewAttackRun();
                    }
                    // .................................................................................................
                    // attacking current target
                } else if (target) {
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // setting up variables
                    targetPosition = target.getPhysicalPositionMatrix();
                    _targetPositionVector[0] = targetPosition[12];
                    _targetPositionVector[1] = targetPosition[13];
                    _targetPositionVector[2] = targetPosition[14];
                    // updating target offset and aim error, if it is time
                    if (this._targetOffsetUpdateTimeLeft <= 0) {
                        this._targetOffsetUpdateTimeLeft = TARGET_OFFSET_UPDATE_INTERVAL;
                        newOffset = vec.diff3Aux(this._spacecraft.getTargetHitPosition(), _targetPositionVector);
                        if (vec.length3Squared(vec.diff3Aux(this._targetOffset, newOffset)) < AIM_ERROR_REDUCTION_THRESHOLD) {
                            this._maxAimError *= AIM_ERROR_REDUCTION_FACTOR;
                        } else {
                            this._maxAimError = MAX_AIM_ERROR;
                        }
                        this._targetOffset[0] = newOffset[0];
                        this._targetOffset[1] = newOffset[1];
                        this._targetOffset[2] = newOffset[2];
                        this._updateAimError();
                    } else {
                        this._targetOffsetUpdateTimeLeft -= dt;
                    }
                    vec.add3(_targetPositionVector, this._targetOffset);
                    vec.setDiff3(_vectorToTarget, _targetPositionVector, positionVector);
                    relativeTargetDirection = vec.prodMat4Vec3Aux(
                            orientationMatrix,
                            _vectorToTarget);
                    this._targetDistance = vec.extractLength3(relativeTargetDirection);
                    vec.getYawAndPitch(_angles, relativeTargetDirection);
                    _angles.yaw += this._aimError[0];
                    _angles.pitch += this._aimError[1];
                    this._facingTarget = (Math.abs(_angles.yaw) < TARGET_FACING_ANGLE_THRESHOLD) && (Math.abs(_angles.pitch) < TARGET_FACING_ANGLE_THRESHOLD);
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // turning towards target
                    this.turn(_angles.yaw, _angles.pitch, dt);
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // handling if another spacecraft blocks the attack path
                    if (this._isBlockedBy) {
                        stillBlocked = false;
                        if (this._isBlockedBy.isAlive() && this._facingTarget) {
                            // checking if the blocking spacecraft is still in the way
                            if (this._isBlockedBy.getPhysicalModel().checkHit(mat.translation4vAux(_targetPositionVector), mat.translation4vAux(_vectorToTarget), 1000, ownSize * 0.25)) {
                                relativeBlockerPosition = vec.prodMat4Vec3Aux(
                                        orientationMatrix,
                                        vec.diffVec3Mat4Aux(
                                                positionVector,
                                                this._isBlockedBy.getPhysicalPositionMatrix()));
                                blockAvoidanceSpeed = acceleration * BLOCK_AVOIDANCE_SPEED_FACTOR;
                                if (relativeBlockerPosition[0] > 0) {
                                    this._spacecraft.strafeRight(blockAvoidanceSpeed);
                                    stillBlocked = true;
                                } else {
                                    this._spacecraft.strafeLeft(blockAvoidanceSpeed);
                                    stillBlocked = true;
                                }
                                if (relativeBlockerPosition[2] < 0) {
                                    this._spacecraft.lower(blockAvoidanceSpeed);
                                    stillBlocked = true;
                                } else {
                                    this._spacecraft.raise(blockAvoidanceSpeed);
                                    stillBlocked = true;
                                }
                            }
                        }
                        if (!stillBlocked) {
                            this._isBlockedBy = null;
                            this._spacecraft.stopLeftStrafe();
                            this._spacecraft.stopRightStrafe();
                            this._spacecraft.stopLower();
                            this._spacecraft.stopRaise();
                        }
                        strafingHandled = true;
                    }
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // actions based on weapons
                    weapons = this._spacecraft.getWeapons();
                    if (weapons && weapons.length > 0) {
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // firing
                        targetSize = target.getVisualModel().getScaledSize();
                        fireThresholdAngle = Math.atan(FIRE_THRESHOLD_ANGLE_FACTOR * targetSize / this._targetDistance);
                        worldProjectileVelocity = weapons[0].getProjectileVelocity() + speed;
                        targetHitTime = this._targetDistance / worldProjectileVelocity * 1000;
                        weaponCooldown = weapons[0].getCooldown();
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // aiming turnable weapons towards target
                        this._spacecraft.aimWeapons(TURN_THRESHOLD_ANGLE, fireThresholdAngle, dt);
                        if (!this._facingTarget) {
                            this._timeSinceLastClosingIn = 0;
                            this._timeSinceLastTargetHit = 0;
                            this._hitCountByNonTarget = 0;
                        }
                        range = weapons[0].getRange(speed);
                        if (vec.length3Squared(vec.diff3Aux(this._spacecraft.getTargetHitPosition(), positionVector)) <= range * range) {
                            // within range...
                            this._attackingTarget = true;
                            if ((Math.abs(_angles.yaw) < fireThresholdAngle) &&
                                    (Math.abs(_angles.pitch) < fireThresholdAngle) &&
                                    (!this._isBlockedBy || this._isBlockedBy.isHostile(this._spacecraft))) {
                                // finished aiming...
                                if (this._fireDelayLeft > 0) {
                                    this._fireDelayLeft -= dt;
                                } else {
                                    this._spacecraft.fire();
                                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                    // if we are not hitting the target despite not being blocked and firing in the right direction, roll the spacecraft
                                    if (!this._isBlockedBy) {
                                        this._timeSinceLastRoll += dt;
                                        this._timeSinceLastTargetHit += dt;
                                        this._timeSinceLastClosingIn += dt;
                                        // starting roll if needed
                                        rollWaitTime = targetHitTime + ROLL_CORRECTION_TRIGGERING_MISS_COUNT * weaponCooldown;
                                        if ((this._timeSinceLastRoll > rollWaitTime) && (this._timeSinceLastTargetHit > rollWaitTime)) {
                                            this._rollTime = 0;
                                        }
                                        // performing coll
                                        if (this._rollTime >= 0) {
                                            this._spacecraft.rollLeft();
                                            this._timeSinceLastRoll = 0;
                                            this._rollTime += dt;
                                            // calculating the duration of rolling based on the angle we would like to roll (in seconds)
                                            angularAcceleration = this._spacecraft.getMaxAngularAcceleration();
                                            maxAngularVelocity = angularAcceleration * _turnAccelerationDuration;
                                            rollDuration = (ROLL_CORRECTION_ANGLE > maxAngularVelocity * _turnAccelerationDuration) ?
                                                    _turnAccelerationDuration + (ROLL_CORRECTION_ANGLE - (maxAngularVelocity * _turnAccelerationDuration)) / maxAngularVelocity :
                                                    Math.sqrt(4 * ROLL_CORRECTION_ANGLE / angularAcceleration) / 2;
                                            // stopping roll (converting to milliseconds)
                                            if (this._rollTime > rollDuration * 1000) {
                                                this._rollTime = -1;
                                            }
                                        }
                                    }
                                }
                            } else {
                                this._timeSinceLastRoll = 0;
                                this._fireDelayLeft = this._fireDelay;
                            }
                        } else {
                            this._timeSinceLastRoll = 0;
                            this._fireDelayLeft = this._fireDelay;
                        }
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // launching missiles
                        if (this._spacecraft.getActiveMissileLauncher()) {
                            // do not launch anti-ship missiles against fighters or vice versa
                            if (this._spacecraft.getActiveMissileLauncher().getMissileClass().isAntiShip() === target.isFighter()) {
                                this._spacecraft.changeMissile();
                            } else {
                                // do not launch additional missiles if there are already enough of them on their way to destroy the target (launched by us)
                                hitpoints = target.getHitpoints() + target.getShieldCapacity();
                                for (i = 0; i < this._missilesOnTarget.length; i++) {
                                    hitpoints -= this._missilesOnTarget[i].getClass().getDamage(0);
                                }
                                if (hitpoints > 0) {
                                    missile = this._spacecraft.launchMissile();
                                    if (missile) {
                                        this._missilesOnTarget.push(missile);
                                    }
                                }
                            }
                        }
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // initiating charge
                        if ((this._chargePhase === ChargePhase.NONE) && ((this._hitCountByNonTarget >= CHARGE_TRIGGER_HIT_COUNT) || ((this._timeSinceLastTargetHit > targetHitTime + CHARGE_TRIGGER_MISS_COUNT * weaponCooldown)))) {
                            this._chargePhase = ChargePhase.APPROACH_ATTACK;
                            this._spacecraft.changeFlightMode(equipment.FlightMode.CRUISE);
                        }
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // managing distance from target based on weapons range
                        // normal (non-charging behaviour)
                        if (this._chargePhase === ChargePhase.NONE) {
                            // closing in the distance if we are unable to hit the target at the current range
                            closeInTriggerTime = targetHitTime + CLOSE_IN_TRIGGER_MISS_COUNT * weaponCooldown;
                            if ((this._timeSinceLastClosingIn > closeInTriggerTime) && (this._timeSinceLastTargetHit > closeInTriggerTime) && (this._maxDistanceFactor > CLOSE_MAX_DISTANCE_FACTOR)) {
                                this._maxDistanceFactor = Math.max(this._maxDistanceFactor - MAX_DISTANCE_FACTOR_DECREMENT, CLOSE_MAX_DISTANCE_FACTOR);
                                this._timeSinceLastClosingIn = 0;
                            }
                            baseDistance = 0.5 * (ownSize + targetSize);
                            maxDistance = baseDistance + this._maxDistanceFactor * this._weaponRange;
                            minDistance = baseDistance + MIN_DISTANCE_FACTOR * this._weaponRange;
                            if (!this._facingTarget) {
                                this._spacecraft.resetSpeed();
                            } else {
                                this.approach(this._targetDistance, maxDistance, minDistance, acceleration * APPROACH_SPEED_FACTOR);
                            }
                            // charge attack behaviour (closing in at higher speed, without slowing)
                        } else if (this._chargePhase === ChargePhase.APPROACH_ATTACK) {
                            // calculating the distance at which the spacecraft will be able to avoid collision at charge speed
                            maxDistance = Math.sqrt((targetSize + ownSize * 0.5) * 2 / acceleration) * acceleration * CHARGE_SPEED_FACTOR;
                            if (!this._facingTarget) {
                                this._chargePhase = ChargePhase.NONE;
                                this._spacecraft.changeFlightMode(equipment.FlightMode.COMBAT);
                                this._spacecraft.resetSpeed();
                            } else {
                                this._spacecraft.setSpeedTarget(acceleration * CHARGE_SPEED_FACTOR);
                                // when the critical distance is reached, mark a destination beyond the target to head towards it
                                if (this._targetDistance <= maxDistance) {
                                    this._chargePhase = ChargePhase.EVADE;
                                    this._spacecraft.changeFlightMode(equipment.FlightMode.COMBAT);
                                    vec.normalize3(_vectorToTarget);
                                    vec.setSum3(this._chargeDestination,
                                            positionVector,
                                            vec.scaled3Aux(
                                                    vec.diff3Aux(
                                                            vec.sum3Aux(
                                                                    _targetPositionVector,
                                                                    vec.scaled3Aux(vec.normalize3(vec.prodVec3Mat3Aux(vec.perpendicular3(_vectorToTarget), mat.rotation3Aux(_vectorToTarget, _chargeSeed() * utils.DOUBLE_PI))), maxDistance)),
                                                            positionVector),
                                                    CHARGE_EVADE_VECTOR_LENGTH_FACTOR));
                                }
                            }
                        }
                    } else {
                        this._spacecraft.resetSpeed();
                    }
                } else {
                    this._facingTarget = false;
                    this._targetDistance = 0;
                    this._spacecraft.resetSpeed();
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // aiming turnable weapons towards default position
                    this._spacecraft.aimWeapons(TURN_THRESHOLD_ANGLE, 0, dt);
                }
            }
            if (!strafingHandled) {
                // .................................................................................................
                // performing evasive maneuver when hit
                if ((this._evasiveManeuverTime >= 0) && (this._evasiveManeuverDelayLeft <= 0)) {
                    // when initiating an evasive maneuver, the evasive velocity vector is a unit vector pointing in the opposite direction
                    // to where the spacecraft has been hit, so we scale it to the required speed and randomly rotate it -90 to +90 degrees
                    if (this._evasiveManeuverTime === 0) {
                        this._evasiveVelocityVector[0] *= acceleration * EVASIVE_MANEUVER_SPEED_FACTOR;
                        this._evasiveVelocityVector[1] *= acceleration * EVASIVE_MANEUVER_SPEED_FACTOR;
                        vec.rotate2(this._evasiveVelocityVector, (_evasionSeed() - 0.5) * Math.PI);
                    }
                    // setting the appropriate strafing speeds
                    if (this._evasiveVelocityVector[0] > 0) {
                        this._spacecraft.strafeRight(this._evasiveVelocityVector[0]);
                    } else if (this._evasiveVelocityVector[0] < 0) {
                        this._spacecraft.strafeLeft(-this._evasiveVelocityVector[0]);
                    } else {
                        this._spacecraft.stopLeftStrafe();
                        this._spacecraft.stopRightStrafe();
                    }
                    if (this._evasiveVelocityVector[1] > 0) {
                        this._spacecraft.raise(this._evasiveVelocityVector[1]);
                    } else if (this._evasiveVelocityVector[1] < 0) {
                        this._spacecraft.lower(-this._evasiveVelocityVector[1]);
                    } else {
                        this._spacecraft.stopLower();
                        this._spacecraft.stopRaise();
                    }
                    this._evasiveManeuverTime += dt;
                    if (this._evasiveManeuverTime > EVASIVE_MANEUVER_DURATION) {
                        this._evasiveManeuverTime = -1;
                    }
                    // if no evasive maneuver is in progress and the firing path is not blocked, cancel all strafing
                } else {
                    if (this._evasiveManeuverDelayLeft > 0) {
                        this._evasiveManeuverDelayLeft -= dt;
                    }
                    this._spacecraft.stopLeftStrafe();
                    this._spacecraft.stopRightStrafe();
                    this._spacecraft.stopLower();
                    this._spacecraft.stopRaise();
                }
            }
        }
    };
    // ##############################################################################
    /**
     * @class
     * @extends SpacecraftAI
     * An AI that is suitable to control a ship - that is a spacecraft with the assumptions that it is larger, its weapons are rotatable,
     * it has an attack vector and threshold angle defined which determine the direction of the ship while attacking and it has a turning
     * style defined which governs how to orient itself to the proper direction.
     * @param {Spacecraft} ship The ship to control
     * @param {Mission} mission The mission within which this AI will control the ship
     */
    function ShipAI(ship, mission) {
        SpacecraftAI.call(this, ship, mission);
    }
    ShipAI.prototype = new SpacecraftAI();
    ShipAI.prototype.constructor = ShipAI;
    /**
     * Updates the AI state for the case when the battle scene with all objects has been moved by a vector, updating stored world-space
     * positions.
     */
    ShipAI.prototype.handleSceneMoved = function () {
        return;
    };
    /**
     * Performs all spacecraft controlling actions (turning, orienting, targeting, firing, setting speed etc) based on the current
     * state of the AI and updates the state accordingly. Should be called once in every battle simulation step.
     * @param {Number} dt The time elapsed since the last control step, in milliseconds.
     */
    ShipAI.prototype.control = function (dt) {
        var
                /** @type Spacecraft */
                target,
                /** @type Number[3] */
                positionVector,
                relativeTargetDirection,
                /** @type Number */
                targetDistance,
                ownSize, targetSize, fireThresholdAngle,
                acceleration, maxDistance, baseDistance,
                range,
                /** @type Boolean */
                facingTarget, hostileTarget,
                /** @type Array */
                weapons,
                /** @type Float32Array */
                orientationMatrix;
        // only perform anything if the controlled spacecraft still exists
        if (this._spacecraft) {
            // if the controlled spacecraft has been destroyed, remove the reference
            if (!this._spacecraft.isAlive()) {
                this._spacecraft = null;
                return;
            }
            // if the spacecraft is not on the battlefield, don't do anything
            if (this._spacecraft.isAway()) {
                return;
            }
            // .................................................................................................
            // targeting
            this._updateTarget();
            // .................................................................................................
            // caching / referencing commonly needed variables
            acceleration = this._spacecraft.getMaxAcceleration();
            ownSize = this._spacecraft.getVisualModel().getScaledSize();
            // caching / referencing needed variables
            positionVector = this._spacecraft.getPhysicalPositionVector();
            orientationMatrix = this._spacecraft.getPhysicalOrientationMatrix();
            target = this._spacecraft.getTarget();
            this._attackingTarget = false;
            this._executeMoveCommand(positionVector, orientationMatrix, acceleration, dt);
            if (target) {
                hostileTarget = target.isHostile(this._spacecraft);
                relativeTargetDirection = vec.prodMat4Vec3(
                        orientationMatrix,
                        vec.diffTranslation3Aux(target.getPhysicalPositionMatrix(), this._spacecraft.getPhysicalPositionMatrix()));
                targetDistance = vec.extractLength3(relativeTargetDirection);
                if (hostileTarget) {
                    vec.getYawAndPitch(_angles, relativeTargetDirection);
                    facingTarget = (Math.abs(_angles.yaw) < TARGET_FACING_ANGLE_THRESHOLD) && (Math.abs(_angles.pitch) < TARGET_FACING_ANGLE_THRESHOLD);
                }
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // actions based on weapons
                weapons = this._spacecraft.getWeapons();
                if (weapons && weapons.length > 0) {
                    targetSize = target.getVisualModel().getScaledSize();
                    fireThresholdAngle = Math.atan(FIRE_THRESHOLD_ANGLE_FACTOR * targetSize / targetDistance);
                    if (hostileTarget) {
                        baseDistance = 0.25 * ownSize;
                        maxDistance = baseDistance + SHIP_MAX_DISTANCE_FACTOR * this._weaponRange;
                    }
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // aiming turnable weapons towards target
                    this._spacecraft.aimWeapons(TURN_THRESHOLD_ANGLE, fireThresholdAngle, dt);
                    if (hostileTarget) {
                        if (this._moveCommand === MoveCommand.NONE) {
                            if (!facingTarget) {
                                this._spacecraft.resetSpeed();
                            } else {
                                this.approach(targetDistance, maxDistance, 0, acceleration * APPROACH_SPEED_FACTOR);
                            }
                            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            // turning towards target
                            if (targetDistance > maxDistance) {
                                this.turn(_angles.yaw, _angles.pitch, dt);
                            } else {
                                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                // orienting into attack position
                                this.orientToAttackPosition(relativeTargetDirection, dt);
                            }
                        }
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // firing
                        range = weapons[0].getRange(this._spacecraft.getRelativeVelocityMatrix()[13]);
                        if (vec.length3Squared(vec.diff3Aux(this._spacecraft.getTargetHitPosition(), positionVector)) - baseDistance <= range * range) {
                            this._spacecraft.fire(true);
                            this._attackingTarget = true;
                        }
                    } else {
                        // friendly target
                        this._spacecraft.resetSpeed();
                    }
                }
            } else {
                // if there is no target...
                if (this._moveCommand === MoveCommand.NONE) {
                    this._spacecraft.resetSpeed();
                }
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // aiming turnable weapons towards default position
                this._spacecraft.aimWeapons(TURN_THRESHOLD_ANGLE, 0, dt);
            }
        }
    };
    // ##############################################################################
    /**
     * @class
     * @extends SpacecraftAI
     * An AI that is suitable to control a space station - that is a spacecraft with the assumption that it shouldn't rotate
     * or move (unless specifically ordered via a move command), just aim its turrets at the most suitable enemy target and fire.
     * @param {Spacecraft} station The station to control
     * @param {Mission} mission The mission within which this AI will control the station
     * @param {Boolean} [shouldTurn=false] If true, the station is supposed to turn into attack orientation, but not move
     */
    function StationAI(station, mission, shouldTurn) {
        SpacecraftAI.call(this, station, mission);
        /**
         * Whether the station is supposed to turn into attack orientation
         * @type Boolean
         */
        this._shouldTurn = !!shouldTurn;
    }
    StationAI.prototype = new SpacecraftAI();
    StationAI.prototype.constructor = StationAI;
    /**
     * Updates the AI state for the case when the battle scene with all objects has been moved by a vector, updating stored world-space
     * positions.
     */
    StationAI.prototype.handleSceneMoved = function () {
        return;
    };
    /**
     * Performs all spacecraft controlling actions (turning, orienting, targeting, firing, setting speed etc) based on the current
     * state of the AI and updates the state accordingly. Should be called once in every battle simulation step.
     * @param {Number} dt The time elapsed since the last control step, in milliseconds.
     */
    StationAI.prototype.control = function (dt) {
        var
                /** @type Spacecraft */
                target,
                /** @type Number[3] */
                positionVector,
                relativeTargetDirection,
                /** @type Number */
                targetDistance,
                ownSize, targetSize, fireThresholdAngle,
                acceleration, baseDistance,
                range,
                /** @type Boolean */
                hostileTarget,
                /** @type Array */
                weapons,
                /** @type Float32Array */
                orientationMatrix;
        // only perform anything if the controlled spacecraft still exists
        if (this._spacecraft) {
            // if the controlled spacecraft has been destroyed, remove the reference
            if (!this._spacecraft.isAlive()) {
                this._spacecraft = null;
                return;
            }
            // if the spacecraft is not on the battlefield, don't do anything
            if (this._spacecraft.isAway()) {
                return;
            }
            // .................................................................................................
            // targeting
            this._updateTarget();
            // .................................................................................................
            // caching / referencing commonly needed variables
            acceleration = this._spacecraft.getMaxAcceleration();
            ownSize = this._spacecraft.getVisualModel().getScaledSize();
            // caching / referencing needed variables
            positionVector = this._spacecraft.getPhysicalPositionVector();
            orientationMatrix = this._spacecraft.getPhysicalOrientationMatrix();
            target = this._spacecraft.getTarget();
            this._attackingTarget = false;
            this._executeMoveCommand(positionVector, orientationMatrix, acceleration, dt);
            if (target) {
                hostileTarget = target.isHostile(this._spacecraft);
                relativeTargetDirection = vec.prodMat4Vec3(
                        orientationMatrix,
                        vec.diffTranslation3Aux(target.getPhysicalPositionMatrix(), this._spacecraft.getPhysicalPositionMatrix()));
                targetDistance = vec.extractLength3(relativeTargetDirection);
                if (this._shouldTurn && (this._moveCommand === MoveCommand.NONE)) {
                    this.orientToAttackPosition(relativeTargetDirection, dt);
                }
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // actions based on weapons
                weapons = this._spacecraft.getWeapons();
                if (weapons && weapons.length > 0) {
                    targetSize = target.getVisualModel().getScaledSize();
                    fireThresholdAngle = Math.atan(FIRE_THRESHOLD_ANGLE_FACTOR * targetSize / targetDistance);
                    if (hostileTarget) {
                        baseDistance = 0.25 * ownSize;
                    }
                    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    // aiming turnable weapons towards target
                    this._spacecraft.aimWeapons(TURN_THRESHOLD_ANGLE, fireThresholdAngle, dt);
                    if (hostileTarget) {
                        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                        // firing
                        range = weapons[0].getRange(this._spacecraft.getRelativeVelocityMatrix()[13]);
                        if (vec.length3Squared(vec.diff3Aux(this._spacecraft.getTargetHitPosition(), positionVector)) - baseDistance <= range * range) {
                            this._spacecraft.fire(true);
                            this._attackingTarget = true;
                        }
                    }
                }
            } else {
                // if there is no target...
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // aiming turnable weapons towards default position
                this._spacecraft.aimWeapons(TURN_THRESHOLD_ANGLE, 0, dt);
            }
            if (this._moveCommand === MoveCommand.NONE) {
                this._spacecraft.resetSpeed();
            }
        }
    };
    // ##############################################################################
    /**
     * @class
     * @extends StationAI
     * An AI that is suitable to control a sentry gun - that is a spacecraft with the assumption that it should rotate but
     * not move (unless specifically ordered via a move command), aim its turrets at the most suitable enemy target and fire.
     * @param {Spacecraft} sentry The sentry to control
     * @param {Mission} mission The mission within which this AI will control the sentry
     */
    function SentryAI(sentry, mission) {
        StationAI.call(this, sentry, mission, true);
    }
    SentryAI.prototype = new StationAI();
    SentryAI.prototype.constructor = SentryAI;
    // ##############################################################################
    /**
     * @class
     * Stores and manages a list of AIs that belong to the same battle simulation.
     */
    function AIContext() {
        /**
         * The list of managed AIs.
         * @type Array
         */
        this._ais = [];
    }
    /**
     * Removes all the stored AIs.
     */
    AIContext.prototype.clearAIs = function () {
        this._ais = [];
    };
    /**
     * Adds a new AI of the type associated with the passed type name and sets it up to control the passed spacecraft.
     * @param {String} aiTypeName
     * @param {Spacecraft} spacecraft
     * @param {Mission} mission 
     */
    AIContext.prototype.addAI = function (aiTypeName, spacecraft, mission) {
        this._ais.push(new _aiConstructors[aiTypeName](spacecraft, mission));
    };
    /**
     * Performs the control step for all the stored AIs.
     * @param {Number} dt the time elapsed since the last control step, in milliseconds.
     */
    AIContext.prototype.control = function (dt) {
        var i;
        for (i = 0; i < this._ais.length; i++) {
            this._ais[i].control(dt);
        }
    };
    /**
     * Updates the state of all the stored AIs for the case when the scene where the battle simulation happens (all the object in it) has 
     * been moved by the given vector.
     * @param {Number[3]} vector
     */
    AIContext.prototype.handleSceneMoved = function (vector) {
        var i;
        for (i = 0; i < this._ais.length; i++) {
            this._ais[i].handleSceneMoved(vector);
        }
    };
    // setting up the associative array of AI constructors
    _aiConstructors = {};
    _aiConstructors[FIGHTER_AI_NAME] = FighterAI;
    _aiConstructors[SHIP_AI_NAME] = ShipAI;
    _aiConstructors[STATION_AI_NAME] = StationAI;
    _aiConstructors[SENTRY_AI_NAME] = SentryAI;
    // creating the default context
    _context = new AIContext(_aiConstructors);
    // caching frequently used configuration values
    config.executeWhenReady(function () {
        _turnAccelerationDuration = config.getSetting(config.BATTLE_SETTINGS.TURN_ACCELERATION_DURATION_S);
        _turnIntensityBaseFactor = 1000 / _turnAccelerationDuration;
        _jumpInPositionSeed = Math.seed(Math.random());
        _aimErrorSeed = Math.seed(Math.random());
        _evasionSeed = Math.seed(Math.random());
        _chargeSeed = Math.seed(Math.random());
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        SpacecraftCommand: SpacecraftCommand,
        JumpCommandWay: JumpCommandWay,
        getAITypes: getAITypes,
        resetJumpInPositionSeed: resetJumpInPositionSeed,
        resetRandomSeeds: resetRandomSeeds,
        positionForInwardJump: positionForInwardJump,
        clearAIs: _context.clearAIs.bind(_context),
        addAI: _context.addAI.bind(_context),
        control: _context.control.bind(_context),
        handleSceneMoved: _context.handleSceneMoved.bind(_context)
    };
});