/*global requirejs */
/**
 * @param armada
 */
requirejs(["armada/armada"], function (armada) {
    "use strict";
    armada.initialize({
        electron: location.hash.indexOf("electron") >= 0,
        local: location.hash.indexOf("local") >= 0
    });
});
