/**
 * @param utils Used for string formatting
 * @param game Used for navigation
 * @param analytics Used for registering actions for analytics
 * @param screens The multiplayer games screen is a subclass of HTMLScreen
 * @param components Used for creating the InfoBox for the screen
 * @param config Used to get multiplayer settings configuration
 * @param audio Used for music management
 * @param networking Used for communicating with the game server to query the
 * list of multiplayer games and host or join them
 * @param strings Used for translation
 * @param armadaScreens Used for navigation
 * @param classes Used to get spacecraft class names
 */
define([
    "utils/utils",
    "modules/game",
    "modules/analytics",
    "modules/screens",
    "modules/components",
    "armada/configuration",
    "armada/audio",
    "armada/networking",
    "armada/strings",
    "armada/screens/shared",
    "armada/logic/classes"
], function (utils, game, analytics, screens, components, config, audio, networking, strings, armadaScreens, classes) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            INFO_BOX_ID = "infoBox",
            BACK_BUTTON_ID = "backButton",
            REFRESH_BUTTON_ID = "refreshButton",
            CREATE_GAME_BUTTON_ID = "createGameButton",
            SERVER_INFO_CONTAINER_ID = "serverInfoContainer",
            CONNECTING_LABEL_ID = "connectingLabel",
            NO_AVAILABLE_GAMES_ID = "noAvailableGamesLabel",
            SERVER_VERSION_VALUE_ID = "serverVersionValue",
            SERVER_REGION_VALUE_ID = "serverRegionValue",
            ONLINE_PLAYERS_VALUE_ID = "onlinePlayersValue",
            ONLINE_GAMES_COUNT_ID = "onlineGamesCount",
            SERVER_PING_VALUE_ID = "serverPingValue",
            GAMES_TABLE_ID = "gamesTable",
            GAMES_LIST_ID = "gamesList",
            PLAYER_POPUP_BACKGROUND_ID = "playerPopupBackground",
            PLAYER_NAME_INPUT_ID = "playerNameInput",
            PLAYER_OK_BUTTON_ID = "playerOkButton",
            PLAYER_CANCEL_BUTTON_ID = "playerCancelButton",
            CREATE_GAME_POPUP_BACKGROUND_ID = "createGamePopupBackground",
            CREATE_GAME_MODE_CONTAINER_ID = "createGameModeContainer",
            CREATE_GAME_MAX_PLAYERS_CONTAINER_ID = "createGameMaxPlayersContainer",
            CREATE_GAME_SPACECRAFTS_CONTAINER_ID = "createGameSpacecraftsContainer",
            CREATE_GAME_CREATE_BUTTON_ID = "createGameCreateButton",
            CREATE_GAME_CANCEL_BUTTON_ID = "createGameCancelButton",
            CREATE_GAME_NAME_ID = "createGameName",
            CREATE_GAME_MODE_ID = "createGameMode",
            CREATE_GAME_MAX_PLAYERS_ID = "createGameMaxPlayers",
            CREATE_GAME_SPACECRAFTS_ID = "createGameSpacecrafts",
            SMALL_NUMBER_SELECTOR_CLASS = "smallNumberSelector",
            PLAYERS_COLUMN_CLASS = "playersColumn",
            STARTED_COLUMN_CLASS = "startedColumn",
            JOIN_COLUMN_CLASS = "joinColumn",
            GAMES_REFRESH_INTERVAL = 5000,
            MIN_PLAYER_NAME_LENGTH = 2,
            MAX_PLAYER_NAME_LENGTH = 18,
            MIN_GAME_NAME_LENGTH = 3,
            MAX_GAME_NAME_LENGTH = 18;
    // ------------------------------------------------------------------------------
    // private functions
    function _mapGameModeValue(option) {
        return strings.get(strings.MULTI_GAME_MODE.PREFIX, option, option);
    }
    function _mapMaxPlayerValue(option) {
        return option.toString();
    }
    function _mapSpacecraftOption(option) {
        return {
            getCaption: function () {
                return classes.getSpacecraftClass(option).getDisplayName();
            },
            value: option
        };
    }
    function _getGameModeValues() {
        return Object.values(networking.GameMode).map(_mapGameModeValue);
    }
    function _getMaxPlayerValues() {
        return config.getSetting(config.MULTI_SETTINGS.MAX_PLAYER_OPTIONS).map(_mapMaxPlayerValue);
    }
    function _getSpacecraftOptions() {
        return config.getSetting(config.MULTI_SETTINGS.SPACECRAFTS).map(_mapSpacecraftOption);
    }
    // #########################################################################
    /**
     * @class Provides the behaviour for the Multiplayer Games screen
     * @extends HTMLScreen
     */
    function MultiGamesScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.MULTI_GAMES_SCREEN_NAME,
                armadaScreens.MULTI_GAMES_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.MULTI_GAMES_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                {
                    show: function () {
                        audio.resetMasterVolume();
                        audio.resetMusicVolume();
                        audio.playMusic(armadaScreens.MENU_THEME);
                    }
                },
                this._getKeyCommands(),
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._refreshButton = this.registerSimpleComponent(REFRESH_BUTTON_ID);
        /** @type SimpleComponent */
        this._createGameButton = this.registerSimpleComponent(CREATE_GAME_BUTTON_ID);
        /** @type SimpleComponent */
        this._serverInfoContainer = this.registerSimpleComponent(SERVER_INFO_CONTAINER_ID);
        /** @type SimpleComponent */
        this._connectingLabel = this.registerSimpleComponent(CONNECTING_LABEL_ID);
        /** @type SimpleComponent */
        this._noAvailableGamesLabel = this.registerSimpleComponent(NO_AVAILABLE_GAMES_ID);
        /** @type SimpleComponent */
        this._serverVersionValue = this.registerSimpleComponent(SERVER_VERSION_VALUE_ID);
        /** @type SimpleComponent */
        this._serverRegionValue = this.registerSimpleComponent(SERVER_REGION_VALUE_ID);
        /** @type SimpleComponent */
        this._onlinePlayersValue = this.registerSimpleComponent(ONLINE_PLAYERS_VALUE_ID);
        /** @type SimpleComponent */
        this._onlineGamesCount = this.registerSimpleComponent(ONLINE_GAMES_COUNT_ID);
        /** @type SimpleComponent */
        this._serverPingValue = this.registerSimpleComponent(SERVER_PING_VALUE_ID);
        /** @type SimpleComponent */
        this._gamesTable = this.registerSimpleComponent(GAMES_TABLE_ID);
        /** @type SimpleComponent */
        this._gamesList = this.registerSimpleComponent(GAMES_LIST_ID);
        /** @type SimpleComponent */
        this._createGamePopupBackground = this.registerSimpleComponent(CREATE_GAME_POPUP_BACKGROUND_ID);
        /** @type SimpleComponent */
        this._createGameCreateButton = this.registerSimpleComponent(CREATE_GAME_CREATE_BUTTON_ID);
        /** @type SimpleComponent */
        this._createGameCancelButton = this.registerSimpleComponent(CREATE_GAME_CANCEL_BUTTON_ID);
        /** @type SimpleComponent */
        this._createGameNameInput = this.registerSimpleComponent(CREATE_GAME_NAME_ID);
        /** @type SimpleComponent */
        this._playerPopupBackground = this.registerSimpleComponent(PLAYER_POPUP_BACKGROUND_ID);
        /** @type SimpleComponent */
        this._playerOkButton = this.registerSimpleComponent(PLAYER_OK_BUTTON_ID);
        /** @type SimpleComponent */
        this._playerCancelButton = this.registerSimpleComponent(PLAYER_CANCEL_BUTTON_ID);
        /** @type SimpleComponent */
        this._playerNameInput = this.registerSimpleComponent(PLAYER_NAME_INPUT_ID);
        /** @type Selector */
        this._createGameModeSelector = null;
        /** @type Selector */
        this._createGameMaxPlayersSelector = null;
        /** @type CheckGroup */
        this._createGameSpacecraftsCheckGroup = null;
        /**
         * @type InfoBox
         */
        this._infoBox = this.registerExternalComponent(new components.InfoBox(
                INFO_BOX_ID,
                armadaScreens.INFO_BOX_SOURCE,
                {cssFilename: armadaScreens.INFO_BOX_CSS},
                strings.INFO_BOX.HEADER.name,
                strings.INFO_BOX.OK_BUTTON.name,
                {
                    buttonselect: armadaScreens.playButtonSelectSound,
                    buttonclick: armadaScreens.playButtonClickSound
                }));
        /** @type Number */
        this._interval = -1;
        config.executeWhenReady(function () {
            this._createGameModeSelector = this.registerExternalComponent(
                    new components.Selector(
                            CREATE_GAME_MODE_ID,
                            armadaScreens.SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.SELECTOR_CSS,
                                selectorClassName: SMALL_NUMBER_SELECTOR_CLASS
                            },
                            {id: strings.MULTI_GAMES.GAME_MODE.name},
                            _getGameModeValues()),
                    CREATE_GAME_MODE_CONTAINER_ID);
            this._createGameMaxPlayersSelector = this.registerExternalComponent(
                    new components.Selector(
                            CREATE_GAME_MAX_PLAYERS_ID,
                            armadaScreens.SELECTOR_SOURCE,
                            {
                                cssFilename: armadaScreens.SELECTOR_CSS,
                                selectorClassName: SMALL_NUMBER_SELECTOR_CLASS
                            },
                            {id: strings.MULTI_GAMES.MAX_PLAYERS.name},
                            _getMaxPlayerValues()),
                    CREATE_GAME_MAX_PLAYERS_CONTAINER_ID);
            this._createGameSpacecraftsCheckGroup = this.registerExternalComponent(
                    new components.CheckGroup(
                            CREATE_GAME_SPACECRAFTS_ID,
                            armadaScreens.CHECK_GROUP_SOURCE,
                            {
                                cssFilename: armadaScreens.CHECK_GROUP_CSS
                            },
                            _getSpacecraftOptions(),
                            {
                                select: armadaScreens.playButtonSelectSound,
                                change: function () {
                                    armadaScreens.playButtonClickSound(true);
                                    this._updateCreateGameCreateButton();
                                }.bind(this)
                            }),
                    CREATE_GAME_SPACECRAFTS_CONTAINER_ID);
        }.bind(this));
    }
    MultiGamesScreen.prototype = new screens.HTMLScreen();
    MultiGamesScreen.prototype.constructor = MultiGamesScreen;
    /**
     * Adds the screen key commands to the given key commands object and returns the result.
     * @param {Object.<String, Function>} [keyCommands] If not given, an object with just the screen key commands
     * will be returned.
     */
    MultiGamesScreen.prototype._getKeyCommands = function (keyCommands) {
        keyCommands = keyCommands || {};
        keyCommands.escape = function () {
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
        };
        return keyCommands;
    };
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     * @param {Function} [onButtonClick]
     */
    MultiGamesScreen.prototype._showMessage = function (message, onButtonClick) {
        this._infoBox.updateMessage(message);
        this._infoBox.onButtonClick(function () {
            armadaScreens.playButtonClickSound();
            if (onButtonClick) {
                onButtonClick();
            }
        });
        this._infoBox.show();
    };
    /**
     * Stops periodically querying the game list from the server
     */
    MultiGamesScreen.prototype._cancelInterval = function () {
        if (this._interval !== -1) {
            clearInterval(this._interval);
            this._interval = -1;
        }
    };
    /**
     * Enables / disables the Ok button on the player name prompt popup
     * according to the currently entered player name
     */
    MultiGamesScreen.prototype._updatePlayerOkButton = function () {
        if (this._playerNameInput.getElement().value.length >= MIN_PLAYER_NAME_LENGTH) {
            this._playerOkButton.enable();
        } else {
            this._playerOkButton.disable();
        }
    };
    /**
     * Enables / disables the Create button on the create game popup according
     * to the currently entered game name
     */
    MultiGamesScreen.prototype._updateCreateGameCreateButton = function () {
        if ((this._createGameNameInput.getElement().value.length >= MIN_GAME_NAME_LENGTH) &&
                (this._createGameSpacecraftsCheckGroup.getValue().length > 0)) {
            this._createGameCreateButton.enable();
        } else {
            this._createGameCreateButton.disable();
        }
    };
    /**
     * Disconnects from the multiplayer server and other players and stops
     * sending any messages, returns to the main menu.
     */
    MultiGamesScreen.prototype._quitMultiplayer = function () {
        this._cancelInterval();
        networking.onConnect(null);
        networking.onDisconnect(null);
        networking.disconnect();
        game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MultiGamesScreen.prototype.setActive = function (active) {
        var
                disconnectErrorShown = false,
                refresh = networking.listGames.bind(this, this._updateGamesList.bind(this));
        screens.HTMLScreen.prototype.setActive.call(this, active);
        if (active) {
            if (!networking.isConnected()) {
                this._refreshButton.disable();
                this._createGameButton.disable();
                this._serverInfoContainer.hide();
                this._connectingLabel.show();
                networking.onConnect(function () {
                    this._interval = setInterval(refresh, GAMES_REFRESH_INTERVAL);
                    refresh();
                    this._createGameButton.enable();
                    this._connectingLabel.hide();
                    this._serverVersionValue.setTextContent(networking.getServerApiVersion());
                    this._serverRegionValue.setTextContent(strings.get(strings.SERVER_REGION.PREFIX, networking.getServerRegion(), networking.getServerRegion()));
                    this._serverInfoContainer.show();
                }.bind(this));
                networking.connect();
            } else {
                this._interval = setInterval(refresh, GAMES_REFRESH_INTERVAL);
                refresh();
            }
            networking.onDisconnect(function (wasConnected) {
                this._cancelInterval();
                this._createGamePopupBackground.hide();
                this._playerPopupBackground.hide();
                if (!disconnectErrorShown) {
                    this._showMessage(
                            strings.get(wasConnected ?
                                    strings.MULTI_GAMES.DISCONNECT_MESSAGE :
                                    strings.MULTI_GAMES.CANNOT_CONNECT_MESSAGE),
                            function () {
                                game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                            }.bind(this));
                }
            }.bind(this));
            networking.onError(function (errorCode) {
                var message, callback;
                switch (errorCode) {
                    case networking.ERROR_CODE_GAME_NOT_FOUND:
                        message = strings.MULTI_GAMES.GAME_NOT_FOUND_ERROR;
                        break;
                    case networking.ERROR_CODE_GAME_IS_FULL:
                        message = strings.MULTI_GAMES.GAME_IS_FULL_ERROR;
                        break;
                    case networking.ERROR_CODE_GAME_ALREADY_STARTED:
                        message = strings.MULTI_GAMES.GAME_ALREADY_STARTED_ERROR;
                        break;
                    case networking.ERROR_CODE_PLAYER_NAME_ALREADY_EXISTS:
                        message = strings.MULTI_GAMES.PLAYER_NAME_ALREADY_EXISTS_ERROR;
                        callback = function () {
                            this._playerPopupBackground.show();
                        }.bind(this);
                        break;
                    case networking.ERROR_CODE_GAME_NAME_ALREADY_EXISTS:
                        message = strings.MULTI_GAMES.GAME_NAME_ALREADY_EXISTS_ERROR;
                        break;
                    case networking.ERROR_CODE_INVALID_GAME_SETTINGS:
                        message = strings.MULTI_GAMES.INVALID_GAME_SETTINGS_ERROR;
                        break;
                    case networking.ERROR_CODE_INVALID_PLAYER_NAME:
                        message = strings.MULTI_GAMES.INVALID_PLAYER_NAME_ERROR;
                        callback = function () {
                            this._createGamePopupBackground.hide();
                            this._playerPopupBackground.show();
                        }.bind(this);
                        break;
                    case networking.ERROR_CODE_INVALID_TEXT:
                        message = strings.MULTI_GAMES.INVALID_TEXT_ERROR;
                        break;
                    case networking.ERROR_CODE_SERVER_IS_FULL:
                        message = strings.MULTI_GAMES.SERVER_IS_FULL_ERROR;
                        callback = function () {
                            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }.bind(this);
                        disconnectErrorShown = true;
                        break;
                    case networking.ERROR_CODE_INCOMPATIBLE_API_VERSION:
                        message = strings.MULTI_GAMES.INCOMPATIBLE_API_VERSION_ERROR;
                        callback = function () {
                            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }.bind(this);
                        disconnectErrorShown = true;
                        break;
                    case networking.ERROR_CODE_NO_WELCOME:
                        message = strings.MULTI_GAMES.NO_WELCOME_ERROR;
                        callback = function () {
                            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
                        }.bind(this);
                        disconnectErrorShown = true;
                        break;
                }
                this._showMessage(utils.formatString(strings.get(message), {
                    serverVersion: networking.getServerApiVersion(),
                    clientVersion: networking.getClientApiVersion()
                }), callback);
            }.bind(this));
            this._createGamePopupBackground.hide();
            if (!networking.getPlayerName()) {
                this._playerPopupBackground.show();
                this._playerNameInput.getElement().focus();
            }
            this._updatePlayerOkButton();
            this._createGameCreateButton.disable();
        } else {
            this._cancelInterval();
            networking.onError(null);
        }
    };
    /**
     * @override
     */
    MultiGamesScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._quitMultiplayer();
            return false;
        }.bind(this);
        this._refreshButton.getElement().onclick = function () {
            networking.listGames(this._updateGamesList.bind(this));
            return false;
        }.bind(this);
        this._createGameButton.getElement().onclick = function () {
            this._createGamePopupBackground.show();
            this._updateCreateGameCreateButton();
            this._createGameNameInput.getElement().focus();
            return false;
        }.bind(this);
        this._createGameCancelButton.getElement().onclick = function () {
            this._createGamePopupBackground.hide();
            return false;
        }.bind(this);
        this._createGameNameInput.getElement().maxLength = MAX_GAME_NAME_LENGTH;
        this._createGameNameInput.getElement().onkeyup = function () {
            this._updateCreateGameCreateButton();
            return false;
        }.bind(this);
        this._createGameCreateButton.getElement().onclick = function () {
            networking.createGame({
                gameName: this._createGameNameInput.getElement().value,
                gameMode: Object.values(networking.GameMode)[this._createGameModeSelector.getSelectedIndex()],
                maxPlayers: +this._createGameMaxPlayersSelector.getSelectedValue(),
                settings: {
                    spacecrafts: this._createGameSpacecraftsCheckGroup.getValue()
                }
            }, function () {
                analytics.sendEvent("multicreate");
                game.closeOrNavigateTo(armadaScreens.MULTI_LOBBY_SCREEN_NAME);
            });
            return false;
        }.bind(this);
        this._playerCancelButton.getElement().onclick = function () {
            this._quitMultiplayer();
            return false;
        }.bind(this);
        this._playerNameInput.getElement().maxLength = MAX_PLAYER_NAME_LENGTH;
        this._playerNameInput.getElement().onkeyup = function () {
            this._updatePlayerOkButton();
        }.bind(this);
        this._playerOkButton.getElement().onclick = function () {
            networking.setPlayerName(this._playerNameInput.getElement().value);
            this._playerPopupBackground.hide();
            return false;
        }.bind(this);
        this._createGamePopupBackground.hide();
    };
    /**
     * @override
     */
    MultiGamesScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._createGameModeSelector.setValueList(_getGameModeValues());
        this._createGameModeSelector.refreshValue();
    };
    /**
     * Updates the game list display according to the passed data (the "games"
     * field should contain the array of Game models)
     * @param {Object} data
     */
    MultiGamesScreen.prototype._updateGamesList = function (data) {
        var i, button, games = data.games,
                getJoinButtonId = function (index) {
                    return "join-game-" + index;
                },
                joinButtonAction = function (index) {
                    networking.joinGame({
                        gameName: games[index].name
                    }, function () {
                        analytics.sendEvent("multijoin");
                        game.closeOrNavigateTo(armadaScreens.MULTI_LOBBY_SCREEN_NAME);
                    });
                };
        this._onlinePlayersValue.setContent(data.players);
        this._onlineGamesCount.setContent(games.length);
        this._serverPingValue.setContent(Math.round(networking.getServerPing()) + " ms");
        if (games.length > 0) {
            this._gamesList.setContent("");
            /**
             * @param {Game} game 
             * @param {Number} index
             */
            games.forEach(function (game, index) {
                var tr, td, button;
                tr = document.createElement("tr");
                td = document.createElement("td");
                td.textContent = game.name;
                tr.appendChild(td);
                td = document.createElement("td");
                td.textContent = strings.get(strings.MULTI_GAME_MODE.PREFIX, game.mode, game.mode);
                tr.appendChild(td);
                td = document.createElement("td");
                td.textContent = game.host;
                tr.appendChild(td);
                td = document.createElement("td");
                td.className = PLAYERS_COLUMN_CLASS;
                td.textContent = game.playerCount + "/" + game.maxPlayers;
                tr.appendChild(td);
                td = document.createElement("td");
                td.className = STARTED_COLUMN_CLASS;
                td.textContent = strings.get(game.started ? strings.MULTI_GAMES.STARTED_YES : strings.MULTI_GAMES.STARTED_NO);
                tr.appendChild(td);
                td = document.createElement("td");
                td.className = JOIN_COLUMN_CLASS;
                if ((game.playerCount < game.maxPlayers) && !game.started) {
                    button = document.createElement("button");
                    button.id = getJoinButtonId(index);
                    button.textContent = strings.get(strings.MULTI_GAMES.JOIN_BUTTON);
                    td.appendChild(button);
                }
                tr.appendChild(td);
                this._gamesList.getElement().appendChild(tr);
            }.bind(this));
            for (i = 0; i < games.length; i++) {
                button = document.getElementById(getJoinButtonId(i));
                if (button) {
                    button.onclick = joinButtonAction.bind(this, i);
                }
            }
            this._gamesTable.show();
            this._noAvailableGamesLabel.hide();
        } else {
            this._gamesTable.hide();
            this._noAvailableGamesLabel.show();
        }
        this._refreshButton.enable();
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getMultiGamesScreen: function () {
            return new MultiGamesScreen();
        }
    };
});