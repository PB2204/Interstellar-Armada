/**
 * @param utils Used for formatting time
 * @param game Used for navigation 
 * @param screens The debriefing screen is a subclass of HTMLScreen
 * @param config Used for accessing music fading config
 * @param strings Used for translation support
 * @param audio Used for setting music theme
 * @param armadaScreens Used for navigation
 * @param missionEvents Used to access MissionState enum
 */
define([
    "utils/utils",
    "modules/game",
    "modules/screens",
    "armada/configuration",
    "armada/strings",
    "armada/audio",
    "armada/screens/shared",
    "armada/logic/missions/events"
], function (utils, game, screens, config, strings, audio, armadaScreens, missionEvents) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_ID = "title",
            MEDAL_ID = "medal",
            MEDAL_IMAGE_SOURCE = "assets/images/empire_{performance}_100.png",
            MEDAL_IMAGE_NO_SCORE = "white",
            SCORE_CONTAINER_ID = "scoreContainer",
            SCORE_SPAN_ID = "score",
            NEW_RECORD_ID = "newRecord",
            DESCRIPTION_PARAGRAPH_ID = "description",
            OBJECTIVES_TABLE_ID = "objectivesTable",
            COMPLETED_OBJECTIVE_CLASS_NAME = "completedObjective",
            FAILED_OBJECTIVE_CLASS_NAME = "failedObjective",
            OBJECTIVE_TEXT_CELL_CLASS_NAME = "statLabelCell",
            SCORE_BREAKDOWN_CONTAINER_ID = "scoreBreakdownContainer",
            // statistics cells
            TIME_CELL_ID = "timeCell",
            KILLS_CELL_ID = "killsCell",
            DAMAGE_CELL_ID = "damageCell",
            HIT_RATIO_CELL_ID = "hitRatioCell",
            MISSILE_DAMAGE_CELL_ID = "missileDamageCell",
            MISSILE_HIT_RATIO_CELL_ID = "missileHitRatioCell",
            HULL_INTEGRITY_CELL_ID = "hullIntegrityCell",
            TEAM_SURVIVAL_CELL_ID = "teamSurvivalCell",
            // score breakdown cells
            BASE_SCORE_CELL_ID = "baseScoreCell",
            HIT_RATIO_BONUS_CELL_ID = "hitRatioBonusCell",
            HULL_INTEGRITY_BONUS_CELL_ID = "hullIntegrityBonusCell",
            TEAM_SURVIVAL_BONUS_CELL_ID = "teamSurvivalBonusCell",
            // bottom buttons
            RESTART_BUTTON_ID = "restartButton",
            NEXT_BUTTON_ID = "nextButton",
            // ------------------------------------------------------------------------------
            // private variables
            _shouldPlayVictoryMusic;
    // ##############################################################################
    /**
     * @class A class to represent the Mission debriefing screen in the game. Describes the dynamic behaviour on that screen.
     * @extends HTMLScreen
     */
    function DebriefingScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.DEBRIEFING_SCREEN_NAME,
                armadaScreens.DEBRIEFING_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.DEBRIEFING_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(
                                _shouldPlayVictoryMusic ? armadaScreens.DEBRIEFING_VICTORY_THEME : armadaScreens.DEBRIEFING_DEFEAT_THEME,
                                undefined,
                                config.getSetting(config.BATTLE_SETTINGS.DEBRIEFING_THEME_FADE_IN_DURATION));
                    }
                },
                {
                    "escape": function () {
                        game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                    }
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type String */
        this._nextMissionName = null;
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._title = this.registerSimpleComponent(TITLE_ID);
        /** @type SimpleComponent */
        this._medal = this.registerSimpleComponent(MEDAL_ID);
        /** @type SimpleComponent */
        this._scoreContainer = this.registerSimpleComponent(SCORE_CONTAINER_ID);
        /** @type SimpleComponent */
        this._scoreSpan = this.registerSimpleComponent(SCORE_SPAN_ID);
        /** @type SimpleComponent */
        this._newRecord = this.registerSimpleComponent(NEW_RECORD_ID);
        /** @type SimpleComponent */
        this._descriptionParagraph = this.registerSimpleComponent(DESCRIPTION_PARAGRAPH_ID);
        /** @type SimpleComponent */
        this._objectivesTable = this.registerSimpleComponent(OBJECTIVES_TABLE_ID);
        /** @type SimpleComponent */
        this._scoreBreakdownContainer = this.registerSimpleComponent(SCORE_BREAKDOWN_CONTAINER_ID);
        /** @type SimpleComponent */
        this._timeCell = this.registerSimpleComponent(TIME_CELL_ID);
        /** @type SimpleComponent */
        this._killsCell = this.registerSimpleComponent(KILLS_CELL_ID);
        /** @type SimpleComponent */
        this._damageCell = this.registerSimpleComponent(DAMAGE_CELL_ID);
        /** @type SimpleComponent */
        this._hitRatioCell = this.registerSimpleComponent(HIT_RATIO_CELL_ID);
        /** @type SimpleComponent */
        this._missileDamageCell = this.registerSimpleComponent(MISSILE_DAMAGE_CELL_ID);
        /** @type SimpleComponent */
        this._missileHitRatioCell = this.registerSimpleComponent(MISSILE_HIT_RATIO_CELL_ID);
        /** @type SimpleComponent */
        this._hullIntegrityCell = this.registerSimpleComponent(HULL_INTEGRITY_CELL_ID);
        /** @type SimpleComponent */
        this._teamSurvivalCell = this.registerSimpleComponent(TEAM_SURVIVAL_CELL_ID);
        /** @type SimpleComponent */
        this._baseScoreCell = this.registerSimpleComponent(BASE_SCORE_CELL_ID);
        /** @type SimpleComponent */
        this._hitRatioBonusCell = this.registerSimpleComponent(HIT_RATIO_BONUS_CELL_ID);
        /** @type SimpleComponent */
        this._hullIntegrityBonusCell = this.registerSimpleComponent(HULL_INTEGRITY_BONUS_CELL_ID);
        /** @type SimpleComponent */
        this._teamSurvivalBonusCell = this.registerSimpleComponent(TEAM_SURVIVAL_BONUS_CELL_ID);
        /** @type SimpleComponent */
        this._restartButton = this.registerSimpleComponent(RESTART_BUTTON_ID);
        /** @type SimpleComponent */
        this._nextButton = this.registerSimpleComponent(NEXT_BUTTON_ID);
    }
    DebriefingScreen.prototype = new screens.HTMLScreen();
    DebriefingScreen.prototype.constructor = DebriefingScreen;
    /**
     * @override
     */
    DebriefingScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MISSIONS_SCREEN_NAME);
            return false;
        }.bind(this);
        this._restartButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.BATTLE_SCREEN_NAME);
            game.getScreen().startNewBattle({
                restart: true
            });
            return false;
        }.bind(this);
        this._nextButton.getElement().onclick = function () {
            game.closeOrNavigateTo(armadaScreens.MISSIONS_SCREEN_NAME);
            game.getScreen().selectMission(this._nextMissionName);
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    DebriefingScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
    };
    /**
     * @typedef {Object} DebriefingScreen~Data
     * @property {Number} missionState (enum missionEvents.MissionState)
     * @property {String[]} objectives
     * @property {Boolean[]} objectivesCompleted
     * @property {String} performance
     * @property {String} nextPerformanceScore
     * @property {Number} score 
     * @property {Boolean} isRecord
     * @property {Number} elapsedTime
     * @property {Number} kills
     * @property {Number} damageDealt
     * @property {Number} hitRatio
     * @property {Number} missileDamageDealt
     * @property {Number} missilesLaunched
     * @property {Number} missilesHit
     * @property {Number} hullIntegrity
     * @property {Number} teamSurvival
     * @property {Number} baseScore
     * @property {Number} hitRatioBonus
     * @property {Number} hullIntegrityBonus
     * @property {Number} teamSurvivalBonus
     * @property {String} [nextMissionName]
     */
    /**
     * Sets the contents of the screen's HTML element to show the passed data (score, statistics...) of the mission
     * @param {DebriefingScreen~Data} data
     */
    DebriefingScreen.prototype.setData = function (data) {
        var medalText, hasScore, description, i, completed;
        hasScore = (data.missionState === missionEvents.MissionState.COMPLETED);
        _shouldPlayVictoryMusic = (data.missionState === missionEvents.MissionState.COMPLETED) ||
                (data.missionState === missionEvents.MissionState.NONE);
        medalText = hasScore ? strings.get(strings.PERFORMANCE_LEVEL.PREFIX, data.performance) : "";
        this._title.setContent((data.missionState === missionEvents.MissionState.COMPLETED) ?
                strings.get(strings.DEBRIEFING.VICTORY_TITLE) :
                ((data.missionState === missionEvents.MissionState.NONE) ?
                        strings.get(strings.DEBRIEFING.GENERIC_TITLE) :
                        strings.get(strings.DEBRIEFING.DEFEAT_TITLE)));
        this._medal.getElement().src = utils.formatString(MEDAL_IMAGE_SOURCE, {
            performance: (data.missionState !== missionEvents.MissionState.NONE) ? data.performance : MEDAL_IMAGE_NO_SCORE
        });
        this._scoreContainer.setVisible(hasScore);
        this._scoreSpan.setVisible(hasScore);
        if (this._scoreSpan.isVisible()) {
            this._scoreSpan.setContent(strings.get(strings.DEBRIEFING.SCORE), {
                score: data.score
            });
        }
        this._newRecord.setVisible(hasScore && data.isRecord);
        switch (data.missionState) {
            case missionEvents.MissionState.COMPLETED:
                description =
                        utils.formatString(strings.get(strings.DEBRIEFING.DESCRIPTION_VICTORY), {
                            performance: strings.getDefiniteArticleForWord(medalText) + " <strong>" + medalText + "</strong>"
                        }) +
                        (data.nextPerformanceScore ? utils.formatString(strings.get(strings.DEBRIEFING.DESCRIPTION_NEXT_PERFORMANCE), {
                            score: data.nextPerformanceScore
                        }) : "");
                break;
            case missionEvents.MissionState.NONE:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_GENERIC);
                break;
            case missionEvents.MissionState.FAILED:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_FAIL);
                break;
            case missionEvents.MissionState.DEFEAT:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_DEFEAT);
                break;
            default:
                description = strings.get(strings.DEBRIEFING.DESCRIPTION_LEFT_EARLY);
        }
        this._descriptionParagraph.setContent(description);
        description = "";
        for (i = 0; i < data.objectives.length; i++) {
            completed = (data.missionState === missionEvents.MissionState.COMPLETED) || data.objectivesCompleted[i];
            description += '<tr><td class="' + (completed ? COMPLETED_OBJECTIVE_CLASS_NAME : FAILED_OBJECTIVE_CLASS_NAME) + '">' +
                    (completed ? strings.get(strings.DEBRIEFING.COMPLETED) : strings.get(strings.DEBRIEFING.FAILED)) +
                    ':</td><td class="' + OBJECTIVE_TEXT_CELL_CLASS_NAME + '">' + data.objectives[i] + "</td></tr>";
        }
        this._objectivesTable.setContent(description);
        this._timeCell.setContent(utils.formatTimeToMinutes(data.elapsedTime));
        this._killsCell.setContent(data.kills.toString());
        this._damageCell.setContent(data.damageDealt.toString());
        this._hitRatioCell.setContent((data.hitRatio > 0) ? Math.round(100 * data.hitRatio) + "%" : "-");
        this._missileDamageCell.setContent(data.missileDamageDealt.toString());
        this._missileHitRatioCell.setContent(data.missilesHit.toString() + " / " + data.missilesLaunched.toString());
        this._hullIntegrityCell.setContent(Math.round(100 * data.hullIntegrity) + "%");
        this._teamSurvivalCell.setContent((data.teamSurvival !== undefined) ? (Math.round(100 * data.teamSurvival) + "%") : "-");
        this._scoreBreakdownContainer.setVisible(hasScore);
        if (this._scoreBreakdownContainer.isVisible()) {
            this._baseScoreCell.setContent(data.baseScore.toString());
            this._hitRatioBonusCell.setContent(data.hitRatioBonus.toString());
            this._hullIntegrityBonusCell.setContent(data.hullIntegrityBonus.toString());
            this._teamSurvivalBonusCell.setContent(data.teamSurvivalBonus ? data.teamSurvivalBonus.toString() : "-");
        }
        this._nextMissionName = data.nextMissionName;
        if (this._nextMissionName) {
            this._nextButton.show();
        } else {
            this._nextButton.hide();
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getDebriefingScreen: function () {
            return new DebriefingScreen();
        }
    };
});