/**
 * @param asyncResource ScreenManager is an AsyncResource as it tracks the loading state of the screens it manages
 * @param application Used to display error messages
 */
define([
    "modules/async-resource",
    "modules/application"
], function (asyncResource, application) {
    "use strict";
    /**
     * The screen manager instance used to store and access screens
     * @type ScreenManager
     */
    var _screenManager;
    /**
     * @class
     * @extends AsyncResource
     */
    function ScreenManager() {
        asyncResource.AsyncResource.call(this);
        /**
         * The game's available screens stored in an associative array, with the 
         * keys being the names of the screens.
         * @type Object.<String, HTMLScreen>
         * @default {}
         */
        this._screens = {};
        /**
         * The list of screens that have been covered by superimposing (instead of
         * switching to) other pages on top.
         * @type HTMLScreen[]
         * @default []
         */
        this._coveredScreens = [];
        /**
         * A reference to the currently active (displayed) screen of the game.
         * @type HTMLScreen
         * @default null
         */
        this._currentScreen = null;
        /**
         * How many screens have been loaded and are ready to use so far
         * @type Number
         */
        this._screensLoaded = 0;
        /**
         * How many screens need to be loaded total
         * @type Number
         */
        this._screensToLoad = 0;
    }
    ScreenManager.prototype = new asyncResource.AsyncResource();
    ScreenManager.prototype.constructor = ScreenManager;
    /**
     * Returns the game screen with the specified name that the game has.
     * @param {String} [screenName] If not given, returns the current screen
     * @returns {HTMLScreen}
     */
    ScreenManager.prototype.getScreen = function (screenName) {
        return screenName ?
                this._screens[screenName] :
                this._currentScreen;
    };
    /**
     * Adds a new screen to the list that can be set as current later.
     * @param {HTMLScreen} screen The new game screen to be added.
     * @param {Boolean} [addBackground=false] Whether to add a background <div>
     * next to the screen container <div> that can be used when the screen is
     * superimposed on other screens
     * @param {Boolean} [keepModelAfterAdding=false] Whether to keep storing the original DOM model
     * of the screen after adding it to the current document (so that it can be added again later)
     */
    ScreenManager.prototype.addScreen = function (screen, addBackground, keepModelAfterAdding) {
        var onScreenReadyFunction = function () {
            this._screensLoaded++;
            if (this._screensLoaded === this._screensToLoad) {
                this.setToReady();
            }
        }.bind(this);
        this.resetReadyState();
        this._screensToLoad++;
        this._screens[screen.getName()] = screen;
        screen.addScreenToPage(onScreenReadyFunction, addBackground, keepModelAfterAdding);
        if (!this._currentScreen) {
            this._currentScreen = screen;
            this._currentScreen.setActive(true);
        }
    };
    /**
     * Sets the current game screen to the one with the specified name (from the
     * list of available screens), including updating the HTML body.
     * @param {String} screenName
     * @param {Boolean} [superimpose=false] Whether the screen should be 
     * superimposed on top of the current one.
     * @param {Number[4]} [backgroundColor] The color of the background in case the
     * screen is set superimposed. @see HTMLScreen#superimposeOnPage
     */
    ScreenManager.prototype.setCurrentScreen = function (screenName, superimpose, backgroundColor) {
        var i, screen = this.getScreen(screenName);
        if (!screen) {
            application.showError("Cannot switch to screen '" + screenName + "', because it does not exist!");
            return;
        }
        if ((superimpose !== true) && (this._currentScreen !== null)) {
            this._currentScreen.hide();
            for (i = 0; i < this._coveredScreens.length; i++) {
                this._coveredScreens[i].hide();
            }
        }
        if (superimpose === true) {
            this._coveredScreens.push(this._currentScreen);
            this._currentScreen.setActive(false);
            this._currentScreen = screen;
            screen.superimposeOnPage(backgroundColor);
        } else {
            this._currentScreen = screen;
            screen.show();
        }
        // the show event handler of the screen might set/superimpose a new screen, in which case it should not be set active
        if (this._currentScreen === screen) {
            this._currentScreen.setActive(true);
        }
    };
    /**
     * Closes the topmost superimposed screen, revealing the one below.
     */
    ScreenManager.prototype.closeSuperimposedScreen = function () {
        this._currentScreen.hide();
        this._currentScreen = this._coveredScreens.pop();
        this._currentScreen.setActive(true);
    };
    /**
     * If the current screen was superimposed, closes it, otherwise simply navigates to
     * (sets) the screen with the given name.
     * @param {String} screenName
     */
    ScreenManager.prototype.closeOrNavigateTo = function (screenName) {
        if (this._currentScreen.isSuperimposed()) {
            this.closeSuperimposedScreen();
        } else {
            this.setCurrentScreen(screenName);
        }
    };
    /**
     * Updates the components on all screens to reflect the application's current state.
     */
    ScreenManager.prototype.updateAllScreens = function () {
        var screenName;
        for (screenName in this._screens) {
            if (this._screens.hasOwnProperty(screenName)) {
                this._screens[screenName].updateScreen();
            }
        }
    };
    _screenManager = new ScreenManager();
    return {
        getScreen: _screenManager.getScreen.bind(_screenManager),
        addScreen: _screenManager.addScreen.bind(_screenManager),
        setCurrentScreen: _screenManager.setCurrentScreen.bind(_screenManager),
        closeSuperimposedScreen: _screenManager.closeSuperimposedScreen.bind(_screenManager),
        closeOrNavigateTo: _screenManager.closeOrNavigateTo.bind(_screenManager),
        updateAllScreens: _screenManager.updateAllScreens.bind(_screenManager),
        executeWhenReady: _screenManager.executeWhenReady.bind(_screenManager)
    };
});