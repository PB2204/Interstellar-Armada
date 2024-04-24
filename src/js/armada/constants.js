define(function () {
    "use strict";
    var
            GAME_NAME = "Interstellar Armada",
            LOCAL_STORAGE_PREFIX = "armada_",
            LANGUAGE_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "language",
            VERSION_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "version";
    // constants to be accessable for all game modules
    return {
        GAME_NAME: GAME_NAME,
        LOCAL_STORAGE_PREFIX: LOCAL_STORAGE_PREFIX,
        LANGUAGE_LOCAL_STORAGE_ID: LANGUAGE_LOCAL_STORAGE_ID,
        VERSION_LOCAL_STORAGE_ID: VERSION_LOCAL_STORAGE_ID
    };
});