/*global requirejs */
/**
 * @param editor
 */
requirejs(["editor/editor"], function (editor) {
    "use strict";
    editor.initialize({electron: false});
});
