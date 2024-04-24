/*global requirejs */

/**
 * @param utils Used for deep copying 
 * @param application Used for logging, configuration setup and downloading files
 * @param resources Used for loading the resource configuration and displaying it in the Resources window
 * @param lights Used to set up light space perspective shadow mapping
 * @param constants Used for accessing the previously run version number in the local storage
 * @param config Used to load game configuration and settings from file
 * @param graphics Used to load the graphics settings from file
 * @param classes Used to display the class structure in the Items window and access the selected class for preview and properties
 * @param environments Used to load the environments 
 * @param missions Used to load the missions 
 * @param control Used to load game controllers so they can be used in previews
 * @param strings Used to load translations
 * @param common Used for clearing open popups
 * @param descriptors Used to determine whether the descriptor for a specific resource / class category is available
 * @param properties Used to generate the content of the Properties window
 * @param shaderPreview Used to create previews for shader resources
 * @param skyboxPreview Used to create previews for skybox classes
 * @param backgroundObjectPreview Used to create previews for background object classes
 * @param explosionPreview Used to create previews for explosion classes
 * @param projectilePreview Used to create previews for projectile classes
 * @param weaponPreview Used to create previews for weapon classes
 * @param missilePreview Used to create previews for missile classes
 * @param spacecraftPreview Used to create previews for spacecraft classes
 * @param environmentPreview Used to create previews for environments
 * @param missionPreview Used to create previews for missions
 */
define([
    "utils/utils",
    "modules/application",
    "modules/media-resources",
    "modules/scene/lights",
    "armada/constants",
    "armada/configuration",
    "armada/graphics",
    "armada/logic/classes",
    "armada/logic/environments",
    "armada/logic/missions",
    "armada/control",
    "armada/strings",
    "editor/common",
    "editor/descriptors",
    "editor/properties",
    "editor/preview/shader-preview",
    "editor/preview/skybox-preview",
    "editor/preview/backgroundObject-preview",
    "editor/preview/explosion-preview",
    "editor/preview/projectile-preview",
    "editor/preview/weapon-preview",
    "editor/preview/missile-preview",
    "editor/preview/spacecraft-preview",
    "editor/preview/environment-preview",
    "editor/preview/mission-preview"
], function (
        utils,
        application, resources, lights,
        constants, config, graphics, classes,
        environments, missions,
        control, strings,
        common, descriptors, properties,
        shaderPreview,
        skyboxPreview, backgroundObjectPreview, explosionPreview, projectilePreview, weaponPreview, missilePreview, spacecraftPreview, environmentPreview, missionPreview) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // Constants
            ITEMS_WINDOW_ID = "items",
            PREVIEW_WINDOW_ID = "preview",
            PROPERTIES_WINDOW_ID = "properties",
            // history
            BACK_BUTTON_ID = "backButton",
            FORWARD_BUTTON_ID = "forwardButton",
            // new item
            NEW_ITEM_BUTTON_ID = "newItemButton",
            NEW_ITEM_DIALOG_ID = "newItemDialog",
            NEW_ITEM_TYPE_ID = "newItemType",
            NEW_ITEM_CATEGORY_CONTAINER_ID = "newItemCategoryContainer",
            NEW_ITEM_CATEGORY_ID = "newItemCategory",
            NEW_ITEM_BASE_ID = "newItemBase",
            NEW_ITEM_NAME_ID = "newItemName",
            NEW_ITEM_DIALOG_FILLER_ID = "newItemDialogFiller",
            NEW_ITEM_CREATE_BUTTON_ID = "newItemCreate",
            NEW_ITEM_CANCEL_BUTTON_ID = "newItemCancel",
            // export items
            EXPORT_BUTTON_ID = "exportButton",
            EXPORT_DIALOG_ID = "exportDialog",
            EXPORT_TYPE_ID = "exportType",
            EXPORT_NAME_ID = "exportName",
            EXPORT_NAME_CONTAINER_ID = "exportNameContainer",
            EXPORT_ITEM_ID = "exportItem",
            EXPORT_ITEM_CONTAINER_ID = "exportItemContainer",
            EXPORT_AUTHOR_ID = "exportAuthor",
            EXPORT_EXPORT_BUTTON_ID = "exportExport",
            EXPORT_CANCEL_BUTTON_ID = "exportCancel",
            // import items
            IMPORT_BUTTON_ID = "importButton",
            IMPORT_DIALOG_ID = "importDialog",
            IMPORT_TYPE_ID = "importType",
            IMPORT_FILE_ID = "importFile",
            IMPORT_IMPORT_BUTTON_ID = "importImport",
            IMPORT_CANCEL_BUTTON_ID = "importCancel",
            // classes
            WINDOW_LABEL_CLASS = "windowLabel",
            WINDOW_CONTENT_CLASS = "windowContent",
            SELECTED_CLASS = "selected",
            ITEM_TYPE_LABEL_CLASS = "itemType",
            CATEGORY_CLASS = "category",
            ELEMENT_LIST_CLASS = "elementList",
            ELEMENT_CLASS = "element",
            ELEMENT_INSERTING_CLASS = "inserting",
            ELEMENT_DRAGOVER_CLASS = "dragover",
            ENVIRONMENTS_CATEGORY = "environments",
            MISSIONS_CATEGORY = "missions",
            ID_SEPARATOR = "_",
            ELEMENT_LI_ID_PREFIX = "element_",
            PREVIEW_OPTIONS_ID = "previewOptions",
            PREVIEW_DIV_ID = "previewDiv",
            PREVIEW_CANVAS_ID = "previewCanvas",
            PREVIEW_INFO_ID = "previewInfo",
            PREVIEW_TOOLTIP_ID = "previewTooltip",
            NO_ITEM_SELECTED_TEXT = "select an item from the left or click New or Import in the top left menu",
            TUTORIAL_TEXT = 'for more information, check out the <a href="docs/editor/tutorial/00-index.html" target="_blank">Getting started guide</a>',
            NO_PREVIEW_TEXT = "preview not available for this type of item",
            NO_PROPERTIES_TEXT = "properties not available for this type of item",
            // ------------------------------------------------------------------------------
            // Private variables
            /**
             * The content of the Preview window for an item belonging to a specific category is generated based on the module stored within this
             * object, at the key that is the same as the category name
             * @type Object
             */
            _previews = {
                "shaders": shaderPreview,
                "skyboxClasses": skyboxPreview,
                "backgroundObjectClasses": backgroundObjectPreview,
                "explosionClasses": explosionPreview,
                "projectileClasses": projectilePreview,
                "weaponClasses": weaponPreview,
                "missileClasses": missilePreview,
                "spacecraftClasses": spacecraftPreview,
                "environments": environmentPreview,
                "missions": missionPreview
            },
            /**
             * The HTML elements (<span>) that corresponds to the various items, by type, category and string id
             * Also stores references to the lists containing the items on the category level: _itemElements[type][category]._list
             * @type Object.<String, Object.<String, Object.<String,Element>>>
             */
            _itemElements,
            /**
             * The HTML element (<span>) that corresponds to the currently selected item
             * @type Element
             */
            _selectedItemElement,
            /**
             * The data of the currently selected item
             * @type Editor~Item
             */
            _selectedItem = {
                type: common.ItemType.NONE,
                name: "",
                category: "",
                reference: null,
                data: null
            },
            /**
             * The history of selected items, in chronological order, so the user can go back (/forward)
             * @type Editor~Item[]
             */
            _itemHistory = [],
            /**
             * The index of the currently selected item within the _itemHistory list
             * @type Number
             */
            _historyIndex = -1,
            _backButton,
            _forwardButton,
            _resourceList,
            _classList,
            _environmentList,
            _missionList,
            _selectItem,
            _newItemDialog,
            _exportDialog,
            _importDialog,
            _initNewItemDialog,
            _initExportDialog;
    // ------------------------------------------------------------------------------
    // Private functions
    /**
     * Expands a (sub)list, optionally scrolling to make sure the specified item is visible
     * @param {Element} listElement The HTML element representing the list. (e.g. <ul>)
     * @param {Element} [itemElement] The HTML element representing the item to scroll to
     */
    function _expandList(listElement, itemElement) {
        var parent;
        listElement.hidden = false;
        if (itemElement) {
            parent = document.getElementById(ITEMS_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS);
            if (itemElement.offsetTop < parent.scrollTop) {
                parent.scrollTop = itemElement.offsetTop;
            } else if (itemElement.offsetTop + itemElement.offsetHeight > parent.scrollTop + parent.clientHeight) {
                parent.scrollTop = itemElement.offsetTop + itemElement.offsetHeight - parent.clientHeight;
            }
        }
    }
    /**
     * Toggles a (sub)list between expanded / collapsed state.
     * @param {Element} listElement The HTML element representing the list. (e.g. <ul>)
     */
    function _toggleList(listElement) {
        listElement.hidden = !listElement.hidden;
    }
    /**
     * Creates and returns a <div> element with the CSS class associated with (window) labels and the passed text.
     * @param {String} text
     * @returns {Element}
     */
    function _createLabel(text) {
        var label = document.createElement("div");
        label.classList.add(WINDOW_LABEL_CLASS);
        label.innerHTML = text;
        return label;
    }
    /**
     * Hides the window label that is below the passed element in the DOM.
     * @param {Element} parent
     */
    function _hideLabel(parent) {
        var label = parent.querySelector("div." + WINDOW_LABEL_CLASS);
        label.hidden = true;
    }
    /**
     * Sets a new text for the window label that is below the passed element in the DOM.
     * @param {Element} parent
     * @param {String} text
     */
    function _setLabel(parent, text) {
        var label = parent.querySelector("div." + WINDOW_LABEL_CLASS);
        label.hidden = false;
        label.innerHTML = text;
    }
    /**
     * Clears the currently open preview (if any), so that a new one can be opened (or the missing preview text shown)
     */
    function _clearPreview() {
        if ((_selectedItem.type !== common.ItemType.NONE) && (_previews[_selectedItem.category])) {
            _previews[_selectedItem.category].clear();
        }
    }
    /**
     * Loads the content of the Preview window for the currently selected element.
     */
    function _loadPreview() {
        var
                previewWindowContent = document.getElementById(PREVIEW_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS),
                previewOptions = previewWindowContent.querySelector("div#" + PREVIEW_OPTIONS_ID),
                previewDiv = document.getElementById(PREVIEW_DIV_ID),
                previewCanvas = document.getElementById(PREVIEW_CANVAS_ID),
                previewInfo = document.getElementById(PREVIEW_INFO_ID),
                previewTooltip = document.getElementById(PREVIEW_TOOLTIP_ID);
        if (_selectedItem.type === common.ItemType.NONE) {
            previewDiv.hidden = true;
            previewCanvas.hidden = true;
            previewOptions.hidden = true;
            previewInfo.hidden = true;
            previewTooltip.hidden = true;
            _setLabel(previewWindowContent, NO_ITEM_SELECTED_TEXT);
        } else if (!_previews[_selectedItem.category]) {
            previewDiv.hidden = true;
            previewCanvas.hidden = true;
            previewOptions.hidden = true;
            previewInfo.hidden = true;
            previewTooltip.hidden = true;
            _setLabel(previewWindowContent, NO_PREVIEW_TEXT);
        } else {
            _hideLabel(previewWindowContent);
            _previews[_selectedItem.category].refresh({
                options: previewOptions,
                div: previewDiv,
                canvas: previewCanvas,
                info: previewInfo,
                tooltip: previewTooltip
            }, _selectedItem.reference);
        }
    }
    /**
     * In case the property accessed within the passed data is a reference to an item with the passed old name and in the same category 
     * as currently selected, changes the reference to the passed new name
     * @param {Object|Array} data The data within to access the property to check
     * @param {String|Number} accessor The key of the property (for objects) or the index of the element (for arrays) to access the property to check
     * @param {Type} type The type describing the accessed property
     * @param {String} oldName 
     * @param {String} newName
     * @param {Function} categoryGetter A function that should return the category of reference (e.g. "textures" or "projectileClasses") for a passed type
     * @returns {Boolean}
     */
    function _changeReference(data, accessor, type, oldName, newName, categoryGetter) {
        var index;
        // if the property is a reference type in the same category as currently selected (e.g. we have a texture selected and the property is a texture reference)
        if ((categoryGetter(type) === _selectedItem.category)) {
            // references are either enums (a simple string reference) or sets (an array of string references)
            switch (type.getBaseType()) {
                case descriptors.BaseType.ENUM:
                    if (data[accessor] === oldName) {
                        data[accessor] = newName;
                        return true;
                    }
                    break;
                case descriptors.BaseType.SET:
                    index = data[accessor].indexOf(oldName);
                    if (index >= 0) {
                        data[accessor][index] = newName;
                        return true;
                    }
                    break;
            }
        }
        return false;
    }
    /**
     * Checks for all references within the passed data using the passed type information, and replaces all references having the passed
     * old name in the same category as currently selected to the passed new name. 
     * E.g. we want to replace texture references to the "explosion" texture to references to the "shard" texture in an explosion class,
     * because we have just renamed the corresponding texture (so we have it selected)
     * See the parameter examples on how to do that.
     * @param {} data The data in which to look for references. Will be interpreted based on the type info to recursively check for references
     * within arrays / objects. E.g. the initialization JSON object for an explosion class
     * @param {Type} type The information describing the type of the passed data. E.g. the EXPLOSION_CLASS item descriptor
     * @param {String} oldName The old name which to replace e.g. "explosion"
     * @param {String} newName The new name which to replace e.g. "shard"
     * @param {Function} categoryGetter Should return the category of reference if a type is passed to it. E.g. passing a texture reference
     * type descriptor to it, should return "textures" if we are looking for resource references (but not if we are looking for class references)
     */
    function _changeReferences(data, type, oldName, newName, categoryGetter) {
        var propertyDescriptors, propertyDescriptorNames, i, childType, keys;
        if (data) {
            switch (type.getBaseType()) {
                case descriptors.BaseType.OBJECT:
                    propertyDescriptors = type.getProperties();
                    propertyDescriptorNames = Object.keys(propertyDescriptors);
                    for (i = 0; i < propertyDescriptorNames.length; i++) {
                        childType = new descriptors.Type(propertyDescriptors[propertyDescriptorNames[i]].type);
                        if (!_changeReference(data, propertyDescriptors[propertyDescriptorNames[i]].name, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[propertyDescriptors[propertyDescriptorNames[i]].name], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
                case descriptors.BaseType.ARRAY:
                    childType = type.getElementType();
                    for (i = 0; i < data.length; i++) {
                        if (!_changeReference(data, i, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[i], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
                case descriptors.BaseType.ASSOCIATIVE_ARRAY:
                    childType = type.getElementType();
                    keys = Object.keys(data);
                    for (i = 0; i < keys.length; i++) {
                        if (!_changeReference(data, keys[i], childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[keys[i]], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
                case descriptors.BaseType.PAIRS:
                    for (i = 0; i < data.length; i++) {
                        childType = type.getFirstType();
                        if (!_changeReference(data[i], 0, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[i][0], childType, oldName, newName, categoryGetter);
                        }
                        childType = type.getSecondType();
                        if (!_changeReference(data[i], 1, childType, oldName, newName, categoryGetter)) {
                            _changeReferences(data[i][1], childType, oldName, newName, categoryGetter);
                        }
                    }
                    break;
            }
        }
    }
    /**
     * Updates the URL hash to describe the currently selected item
     */
    function _updateHash() {
        location.hash = _selectedItem.type + "/" + _selectedItem.category + "/" + _selectedItem.name;
    }
    /**
     * Creates and returns a function that can be used when the name of an item is changed
     * @param {String} oldName
     * @param {String} newName
     * @param {Function} categoryGetter Should return the reference category of a property if the type info of the property is passed to it,
     * of the same item type as the item that has been changed (resource / class / etc)
     * @returns {Function}
     */
    function _createItemNameChangeHandler(oldName, newName, categoryGetter) {
        return function (itemInstance, categoryName) {
            var descriptor = descriptors.itemDescriptors[categoryName];
            if (descriptor) {
                _changeReferences(itemInstance.getData(), new descriptors.Type(descriptor), oldName, newName, categoryGetter, true);
            }
            itemInstance.reloadData();
        };
    }
    /**
     * A function to execute whenever the name property of the selected item is changed
     */
    function _handleNameChange() {
        var newName = _selectedItem.data.name, oldName = _selectedItemElement.innerHTML, nameChangeHandler;
        if (newName && (newName !== oldName)) {
            switch (_selectedItem.type) {
                case common.ItemType.RESOURCE:
                    resources.renameResource(_selectedItem.category, oldName, newName);
                    nameChangeHandler = _createItemNameChangeHandler(oldName, newName, function (type) {
                        return type.getResourceReference();
                    });
                    break;
                case common.ItemType.CLASS:
                    classes.renameClass(_selectedItem.category, oldName, newName);
                    nameChangeHandler = _createItemNameChangeHandler(oldName, newName, function (type) {
                        return type.getClassReference();
                    });
                    break;
                case common.ItemType.MISSION:
                    newName = utils.getFilenameWithoutExtension(_selectedItem.data.name);
                    if (newName !== oldName) {
                        application.showError("Name change not supported for this type of item!");
                    }
                    return;
                default:
                    application.showError("Name change not supported for this type of item!");
                    return;
            }
            _selectedItemElement.innerHTML = newName;
            _selectedItem.name = newName;
            _itemElements[_selectedItem.type][_selectedItem.category][newName] = _itemElements[_selectedItem.type][_selectedItem.category][oldName];
            delete _itemElements[_selectedItem.type][_selectedItem.category][oldName];
            resources.executeForAllResources(nameChangeHandler);
            classes.executeForAllClasses(nameChangeHandler);
            environments.executeForAllEnvironments(nameChangeHandler);
            _updateHash();
        }
    }
    /**
     * Updates the enabled / disabled states of history back / forward buttons, to be called every time
     * we move within history
     */
    function _updateHistoryButtons() {
        _backButton.disabled = _historyIndex <= 0;
        _forwardButton.disabled = _historyIndex >= (_itemHistory.length - 1);
    }
    /**
     * Loads the content of the Properties window for the currently selected element.
     */
    function _loadProperties() {
        var windowContent = document.getElementById(PROPERTIES_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS);
        windowContent.innerHTML = "";
        if (_selectedItem.type === common.ItemType.NONE) {
            windowContent.appendChild(_createLabel(NO_ITEM_SELECTED_TEXT));
        } else if (!descriptors.itemDescriptors[_selectedItem.category]) {
            windowContent.appendChild(_createLabel(NO_PROPERTIES_TEXT));
        } else {
            properties.createProperties(windowContent, _selectedItem, _previews[_selectedItem.category], _handleNameChange, _selectItem);
        }
    }
    /**
     * Sets the data the passed item and loads the appropriate Preview and Properties windows for it, if available
     * Only to be used by _selectItem and history operations - outside of these, use _selectItem
     * @param {String} type (enum ItemType) The type of the selected item
     * @param {String} name The name (id) of the selected item
     * @param {String} category The category the selected item belongs to (this will determine the format of the Preview and Properties windows)
     * @param {Element} [element] The HTML element (<span>) that references the item in the category list (if not given, will be looked up from the _itemElements object)
     */
    function _loadItem(type, name, category, element) {
        var reference;
        _newItemDialog.hidden = true;
        _exportDialog.hidden = true;
        reference = common.getItemReference({type: type, name: name, category: category}, true);
        if (reference) {
            if (_selectedItemElement) {
                _selectedItemElement.classList.remove(SELECTED_CLASS);
            }
            common.removePopups();
            _clearPreview();
            _selectedItem.type = type;
            _selectedItem.name = name;
            _selectedItem.category = category;
            _selectedItem.reference = reference;
            _selectedItem.data = reference.getData();
            _loadProperties();
            _loadPreview();
            if (!element) {
                element = _itemElements[_selectedItem.type][_selectedItem.category][_selectedItem.name];
            }
            _expandList(_itemElements[_selectedItem.type][_selectedItem.category]._list, element);
            _selectedItemElement = element;
            _selectedItemElement.classList.add(SELECTED_CLASS);
            _updateHash();
        }
    }
    /**
     * Sets up the variables and handlers for the history back / forward buttons (to be called at startup)
     */
    function _loadHistoryButtons() {
        _backButton = document.getElementById(BACK_BUTTON_ID);
        _forwardButton = document.getElementById(FORWARD_BUTTON_ID);
        _backButton.onclick = function () {
            var item;
            _historyIndex--;
            item = _itemHistory[_historyIndex];
            _loadItem(item.type, item.name, item.category);
            _updateHistoryButtons();
        };
        _forwardButton.onclick = function () {
            var item;
            _historyIndex++;
            item = _itemHistory[_historyIndex];
            _loadItem(item.type, item.name, item.category);
            _updateHistoryButtons();
        };
    }
    /**
     * Sets the data for a new selected item and loads the appropriate Preview and Properties windows for it, if available
     * Also updates selection history
     * @param {String} type (enum ItemType) The type of the selected item
     * @param {String} name The name (id) of the selected item
     * @param {String} category The category the selected item belongs to (this will determine the format of the Preview and Properties windows)
     * @param {Element} [element] The HTML element (<span>) that references the item in the category list (if not given, will be looked up from the _itemElements object)
     */
    _selectItem = function (type, name, category, element) {
        if ((_selectedItem.type !== type) || (_selectedItem.name !== name) || (_selectedItem.category !== category)) {
            _loadItem(type, name, category, element);
            if ((_itemHistory.length > 0) && (_historyIndex < (_itemHistory.length - 1))) {
                _itemHistory.splice(_historyIndex + 1);
            }
            _itemHistory.push({type: type, name: name, category: category, element: element});
            _historyIndex = _itemHistory.length - 1;
            _updateHistoryButtons();
        }
    };
    /**
     * Creates and returns a function that can be used as the onclick event handler on an element representing a selectable item (such as
     * a resource or game class)
     * @param {Element} element The element that represents the item (typically <span>, showing the name of the item)
     * @param {String} type (enum ItemType) The type this item belongs to
     * @param {String} category The category the item belongs to (e.g. "spacecraftClasses")
     * @param {String} name The name (string ID) of the item (e.g. "falcon")
     * @returns {Function}
     */
    function _createElementClickHandler(element, type, category, name) {
        return function () {
            _selectItem(type, name, category, element);
        };
    }
    /**
     * Returns a string that can be used as a drag and drop dataTransfer type for items of the passed type and category
     * @param {String} type
     * @param {String} category
     * @returns {String}
     */
    function _getItemDataTransferType(type, category) {
        return (type + "/" + category).toLowerCase();
    }
    /**
     * Creates and returns a handler for the dragstart event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragStartHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            event.dataTransfer.setData(dataTransferType, element.id);
            element.classList.add(ELEMENT_INSERTING_CLASS);
        };
    }
    /**
     * Creates and returns a handler for the dragend event for item elements (<li> tags)
     * @param {Element} element
     * @returns {Function}
     */
    function _createElementDragEndHandler(element) {
        return function () {
            element.classList.remove(ELEMENT_INSERTING_CLASS);
        };
    }
    /**
     * Creates and returns a handler for the dragenter event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragEnterHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var hasCorrectType = event.dataTransfer.types.indexOf(dataTransferType) >= 0;
            if (hasCorrectType && (event.dataTransfer.getData(dataTransferType) !== element.id)) {
                element.classList.add(ELEMENT_DRAGOVER_CLASS);
                event.preventDefault();
            }
        };
    }
    /**
     * Creates and returns a handler for the dragover event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragOverHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var hasCorrectType = event.dataTransfer.types.indexOf(dataTransferType) >= 0;
            if (hasCorrectType && (event.dataTransfer.getData(dataTransferType) !== element.id)) {
                event.preventDefault();
            }
        };
    }
    /**
     * Creates and returns a handler for the dragleave event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDragLeaveHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var hasCorrectType = event.dataTransfer.types.indexOf(dataTransferType) >= 0;
            if (hasCorrectType) {
                element.classList.remove(ELEMENT_DRAGOVER_CLASS);
            }
        };
    }
    /**
     * Creates and returns a handler for the drop event for item elements (<li> tags)
     * @param {Element} element
     * @param {String} type
     * @param {String} category
     * @returns {Function}
     */
    function _createElementDropHandler(element, type, category) {
        var dataTransferType = _getItemDataTransferType(type, category);
        return function (event) {
            var otherElement = document.getElementById(event.dataTransfer.getData(dataTransferType));
            element.classList.remove(ELEMENT_DRAGOVER_CLASS);
            element.parentNode.insertBefore(otherElement, element.nextSibling);
            switch (type) {
                case common.ItemType.RESOURCE:
                    resources.moveResourceAfter(category, otherElement.firstChild.textContent, element.firstChild.textContent);
                    break;
                case common.ItemType.CLASS:
                    classes.moveClassAfter(category, otherElement.firstChild.textContent, element.firstChild.textContent);
                    break;
                default:
                    application.showError("Cannot move element of type '" + type + "'!");
            }
        };
    }
    /**
     * Returns the info object that can be embedded at the beginning of exported files (e.g. classes)
     * @param {String} name The name to be included in the info
     * @param {String} author The author to be included in the info
     * @returns {Object}
     */
    function _getInfoObject(name, author) {
        return {
            name: name,
            author: author,
            comment: "Created by Interstellar Armada editor",
            version: application.getVersion(),
            creationTime: new Date().toString()
        };
    }
    /**
     * Returns the stringified info object that can be embedded at the beginning of exported files (e.g. classes)
     * @param {String} name The name to be included in the info
     * @param {String} author The author to be included in the info
     * @returns {String}
     */
    function _getInfoString(name, author) {
        return JSON.stringify(_getInfoObject(name, author));
    }
    /**
     * Returns the string that can be used as the content of an exported file 
     * @param {String} name The name to be included in the info section of the file
     * @param {String} author The author to be included in the info section of the file
     * @param {String[]} categories The list of the categories to include in the file
     * @param {Function} getNamesFunction The function that returns the names of the items to be included for a given category
     * @param {Function} getItemFunction  The function that returns the data of items to be included, given the category and name of the item
     * @returns {String}
     */
    function _getItemsString(name, author, categories, getNamesFunction, getItemFunction) {
        var i, j, itemNames, result, itemData;
        result = '{"info":' + _getInfoString(name, author);
        for (i = 0; i < categories.length; i++) {
            result += ',"' + categories[i] + '":[';
            itemNames = getNamesFunction(categories[i]);
            for (j = 0; j < itemNames.length; j++) {
                itemData = getItemFunction(categories[i], itemNames[j]).getData();
                if (itemData) {
                    result += ((j > 0) ? ',' : '') + JSON.stringify(itemData);
                }
            }
            result += ']';
        }
        result += "}";
        return result;
    }
    /**
     * Exports the passed string into a JSON file the download of which is then triggered
     * @param {String} name The name of the file (without extension)
     * @param {String} string The string to use as the contents of the file
     */
    function _exportString(name, string) {
        var
                blob = new Blob([string], {type: "text/json"}),
                e = document.createEvent("MouseEvents"),
                a = document.createElement("a");
        a.download = name + ".json";
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ["text/json", a.download, a.href].join(":");
        e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);
    }
    /**
     * Sets up the event handlers for the elements in the export dialog
     */
    function _loadExportDialog() {
        var
                exportType = document.getElementById(EXPORT_TYPE_ID),
                exportName = document.getElementById(EXPORT_NAME_ID),
                exportNameContainer = document.getElementById(EXPORT_NAME_CONTAINER_ID),
                exportItem = document.getElementById(EXPORT_ITEM_ID),
                exportItemContainer = document.getElementById(EXPORT_ITEM_CONTAINER_ID),
                exportAuthor = document.getElementById(EXPORT_AUTHOR_ID),
                exportExport = document.getElementById(EXPORT_EXPORT_BUTTON_ID),
                exportCancel = document.getElementById(EXPORT_CANCEL_BUTTON_ID),
                typeOptions = [common.ItemType.RESOURCE, common.ItemType.CLASS, common.ItemType.ENVIRONMENT, common.ItemType.MISSION],
                getMissions = function () {
                    return missions.getMissionNames().map(function (missionName) {
                        return utils.getFilenameWithoutExtension(missionName);
                    });
                };
        common.setSelectorOptions(exportType, typeOptions);
        exportType.onchange = function () {
            if (exportType.value === common.ItemType.MISSION) {
                common.setSelectorOptions(exportItem, getMissions());
                exportNameContainer.hidden = true;
                exportItemContainer.hidden = false;
            } else {
                exportName.value = exportType.value;
                exportNameContainer.hidden = false;
                exportItemContainer.hidden = true;
            }
        };
        exportType.onchange();
        exportExport.onclick = function () {
            switch (exportType.value) {
                case common.ItemType.RESOURCE:
                    _exportString(
                            exportName.value,
                            _getItemsString(
                                    exportName.value,
                                    exportAuthor.value,
                                    resources.getResourceTypes(),
                                    resources.getResourceNames,
                                    resources.getResource));
                    break;
                case common.ItemType.CLASS:
                    _exportString(
                            exportName.value,
                            _getItemsString(
                                    exportName.value,
                                    exportAuthor.value,
                                    classes.getClassCategories(),
                                    classes.getClassNames,
                                    classes.getClass));
                    break;
                case common.ItemType.ENVIRONMENT:
                    _exportString(
                            exportName.value,
                            _getItemsString(
                                    exportName.value,
                                    exportAuthor.value,
                                    [ENVIRONMENTS_CATEGORY],
                                    environments.getEnvironmentNames,
                                    function (categoryName, itemName) {
                                        return (categoryName === ENVIRONMENTS_CATEGORY) ? environments.getEnvironment(itemName) : null;
                                    }));
                    break;
                case common.ItemType.MISSION:
                    missions.requestMissionDescriptor(missions.getMissionNames()[exportItem.selectedIndex], function (missionDescriptor) {
                        var data = Object.assign({info: _getInfoObject(missionDescriptor.getName(), exportAuthor.value)}, missionDescriptor.getData());
                        delete data.name;
                        _exportString(
                                exportItem.value,
                                JSON.stringify(data));
                    });
                    break;
                default:
                    application.showError("Exporting " + exportType.value + " is not yet implemented!");
            }
            _exportDialog.hidden = true;
        };
        exportCancel.onclick = function () {
            _exportDialog.hidden = true;
        };
        _initExportDialog = function () {
            var index;
            if (_selectedItem) {
                index = typeOptions.indexOf(_selectedItem.type);
                if (index >= 0) {
                    exportType.selectedIndex = index;
                    exportType.onchange();
                    if (exportType.value === common.ItemType.MISSION) {
                        index = getMissions().indexOf(utils.getFilenameWithoutExtension(_selectedItem.name));
                        if (index >= 0) {
                            exportItem.selectedIndex = index;
                        }
                    }
                }
            }
        };
    }
    /**
     * Creates and returns a collapsable list (<ul> tag) containing the categories of the game items belonging to the passed type.
     * @param {String} itemType (enum ItemType)
     * @returns {Element}
     */
    function _createCategoryList(itemType) {
        var result = document.createElement("div"),
                itemTypeLabel,
                categories, categoryList, categoryElement, categorySpan,
                items, itemList, itemElement, itemSpan,
                i, j, getItems;
        switch (itemType) {
            case common.ItemType.RESOURCE:
                categories = resources.getResourceTypes();
                getItems = resources.getResourceNames;
                break;
            case common.ItemType.CLASS:
                categories = classes.getClassCategories();
                getItems = classes.getClassNames;
                break;
            case common.ItemType.ENVIRONMENT:
                categories = [ENVIRONMENTS_CATEGORY];
                getItems = environments.getEnvironmentNames;
                break;
            case common.ItemType.MISSION:
                categories = [MISSIONS_CATEGORY];
                getItems = missions.getMissionNames.bind(this, undefined);
                break;
            default:
                application.crash();
        }
        _itemElements[itemType] = {};
        itemTypeLabel = document.createElement("div");
        itemTypeLabel.classList.add(ITEM_TYPE_LABEL_CLASS);
        itemTypeLabel.textContent = itemType;
        result.appendChild(itemTypeLabel);
        categoryList = document.createElement("ul");
        for (i = 0; i < categories.length; i++) {
            categoryElement = document.createElement("li");
            categoryElement.classList.add(CATEGORY_CLASS);
            categorySpan = document.createElement("span");
            categorySpan.classList.add(CATEGORY_CLASS);
            categorySpan.innerHTML = categories[i];
            categoryElement.appendChild(categorySpan);
            _itemElements[itemType][categories[i]] = {};
            itemList = document.createElement("ul");
            itemList.classList.add(ELEMENT_LIST_CLASS);
            items = getItems(categories[i]);
            for (j = 0; j < items.length; j++) {
                itemElement = document.createElement("li");
                itemElement.setAttribute("id", ELEMENT_LI_ID_PREFIX + itemType + ID_SEPARATOR + categories[i] + ID_SEPARATOR + items[j]);
                itemElement.classList.add(ELEMENT_CLASS);
                itemElement.draggable = (itemType === common.ItemType.RESOURCE) || (itemType === common.ItemType.CLASS);
                itemSpan = document.createElement("span");
                itemSpan.classList.add(ELEMENT_CLASS);
                itemSpan.textContent = items[j];
                if (itemType === common.ItemType.MISSION) {
                    itemSpan.textContent = utils.getFilenameWithoutExtension(itemSpan.textContent);
                }
                itemElement.appendChild(itemSpan);
                _itemElements[itemType][categories[i]][items[j]] = itemSpan;
                itemSpan.onclick = _createElementClickHandler(itemSpan, itemType, categories[i], items[j]);
                if (itemElement.draggable) {
                    itemElement.ondragstart = _createElementDragStartHandler(itemElement, itemType, categories[i], itemElement.id);
                    itemElement.ondragend = _createElementDragEndHandler(itemElement);
                    itemElement.ondragenter = _createElementDragEnterHandler(itemElement, itemType, categories[i]);
                    itemElement.ondragover = _createElementDragOverHandler(itemElement, itemType, categories[i]);
                    itemElement.ondragleave = _createElementDragLeaveHandler(itemElement, itemType, categories[i]);
                    itemElement.ondrop = _createElementDropHandler(itemElement, itemType, categories[i]);
                }
                itemList.appendChild(itemElement);
            }
            itemList.hidden = true;
            categoryElement.appendChild(itemList);
            categorySpan.onclick = _toggleList.bind(this, itemList);
            _itemElements[itemType][categories[i]]._list = itemList;
            categoryList.appendChild(categoryElement);
        }
        result.appendChild(categoryList);
        return result;
    }
    /**
     * Loads the content of the Items window - collapsable lists of game items of each category. Call after the configuration has been 
     * loaded.
     */
    function _loadItems() {
        var windowContent = document.getElementById(ITEMS_WINDOW_ID).querySelector("." + WINDOW_CONTENT_CLASS);
        _hideLabel(windowContent);
        _itemElements = {};
        if (_resourceList) {
            windowContent.removeChild(_resourceList);
        }
        _resourceList = _createCategoryList(common.ItemType.RESOURCE);
        windowContent.appendChild(_resourceList);
        if (_classList) {
            windowContent.removeChild(_classList);
        }
        _classList = _createCategoryList(common.ItemType.CLASS);
        windowContent.appendChild(_classList);
        if (_environmentList) {
            windowContent.removeChild(_environmentList);
        }
        _environmentList = _createCategoryList(common.ItemType.ENVIRONMENT);
        windowContent.appendChild(_environmentList);
        if (_missionList) {
            windowContent.removeChild(_missionList);
        }
        _missionList = _createCategoryList(common.ItemType.MISSION);
        windowContent.appendChild(_missionList);
    }
    /**
     * Sets up the event handlers for the elements in the import dialog
     */
    function _loadImportDialog() {
        var
                importType = document.getElementById(IMPORT_TYPE_ID),
                importFile = document.getElementById(IMPORT_FILE_ID),
                importImport = document.getElementById(IMPORT_IMPORT_BUTTON_ID),
                importCancel = document.getElementById(IMPORT_CANCEL_BUTTON_ID),
                typeOptions = [common.ItemType.MISSION];
        common.setSelectorOptions(importType, typeOptions);
        importImport.onclick = function () {
            switch (importType.value) {
                case common.ItemType.MISSION:
                    var file = importFile.files[0];
                    if (file) {
                        file.text().then(function (text) {
                            var data;
                            try {
                                data = JSON.parse(text);
                            } catch (e) {
                                application.showError("The selected file doesn't seem to be a valid mission file!", application.ErrorSeverity.MINOR);
                                return;
                            }
                            if (data) {
                                data.name = file.name;
                                if (missions.getMissionNames().indexOf(data.name) >= 0) {
                                    application.showError("A mission with this filename already exists!", application.ErrorSeverity.MINOR);
                                } else {
                                    missions.createMissionDescriptor(data);
                                    _loadItems();
                                    _selectItem(importType.value, data.name, common.ItemType.MISSION);
                                }
                            }
                        }.bind(this)).catch(function () {
                            application.showError("Error while loading the mission file!", application.ErrorSeverity.MINOR);
                        });
                    }
                    break;
                default:
                    application.showError("Importing " + importType.value + " is not yet implemented!");
            }
            _importDialog.hidden = true;
        };
        importCancel.onclick = function () {
            _importDialog.hidden = true;
        };
    }
    /**
     * Loads the default values and sets the change handlers for the contents of the New item dialog
     */
    function _loadNewItemDialog() {
        var
                newItemType = document.getElementById(NEW_ITEM_TYPE_ID),
                newItemCategory = document.getElementById(NEW_ITEM_CATEGORY_ID),
                newItemBase = document.getElementById(NEW_ITEM_BASE_ID),
                newItemName = document.getElementById(NEW_ITEM_NAME_ID),
                createButton = document.getElementById(NEW_ITEM_CREATE_BUTTON_ID),
                cancelButton = document.getElementById(NEW_ITEM_CANCEL_BUTTON_ID),
                typeOptions = [common.ItemType.RESOURCE, common.ItemType.CLASS, common.ItemType.ENVIRONMENT, common.ItemType.MISSION],
                getItems, create, createAsync;
        common.setSelectorOptions(newItemType, typeOptions);
        newItemType.onchange = function () {
            switch (newItemType.value) {
                case common.ItemType.RESOURCE:
                    common.setSelectorOptions(newItemCategory, resources.getResourceTypes());
                    getItems = resources.getResourceNames;
                    create = function () {
                        var newItemData = ((newItemBase.selectedIndex > 0) ?
                                utils.deepCopy(resources.getResource(newItemCategory.value, newItemBase.value).getData()) :
                                properties.getDefaultItemData(
                                        descriptors.itemDescriptors[newItemCategory.value],
                                        newItemName.value,
                                        newItemType.value,
                                        newItemCategory.value));
                        newItemData.name = newItemName.value;
                        resources.createResource(newItemCategory.value, newItemData);
                    };
                    break;
                case common.ItemType.CLASS:
                    common.setSelectorOptions(newItemCategory, classes.getClassCategories());
                    getItems = classes.getClassNames;
                    create = function () {
                        var newItemData = ((newItemBase.selectedIndex > 0) ?
                                utils.deepCopy(classes.getClass(newItemCategory.value, newItemBase.value).getData()) :
                                properties.getDefaultItemData(
                                        descriptors.itemDescriptors[newItemCategory.value],
                                        newItemName.value,
                                        newItemType.value,
                                        newItemCategory.value));
                        newItemData.name = newItemName.value;
                        classes.createClass(newItemCategory.value, newItemData);
                    };
                    break;
                case common.ItemType.ENVIRONMENT:
                    common.setSelectorOptions(newItemCategory, [ENVIRONMENTS_CATEGORY]);
                    getItems = environments.getEnvironmentNames;
                    create = function () {
                        var newItemData = ((newItemBase.selectedIndex > 0) ?
                                utils.deepCopy(environments.getEnvironment(newItemBase.value).getData()) :
                                properties.getDefaultItemData(
                                        descriptors.itemDescriptors[newItemCategory.value],
                                        newItemName.value,
                                        newItemType.value,
                                        newItemCategory.value));
                        newItemData.name = newItemName.value;
                        environments.createEnvironment(newItemData);
                    };
                    break;
                case common.ItemType.MISSION:
                    common.setSelectorOptions(newItemCategory, [MISSIONS_CATEGORY]);
                    getItems = missions.getMissionNames.bind(this, undefined);
                    create = null;
                    createAsync = function (callback) {
                        var newItemData;
                        if (newItemBase.selectedIndex > 0) {
                            missions.requestMissionDescriptor(newItemBase.value, function (missionDescriptor) {
                                newItemData = utils.deepCopy(missionDescriptor.getData());
                                newItemData.name = newItemName.value;
                                missions.createMissionDescriptor(newItemData);
                                callback();
                            });
                        } else {
                            newItemData = utils.deepCopy(properties.getDefaultItemData(
                                    descriptors.itemDescriptors[newItemCategory.value],
                                    newItemName.value,
                                    newItemType.value,
                                    newItemCategory.value));
                            newItemData.name = newItemName.value;
                            missions.createMissionDescriptor(newItemData);
                            callback();
                        }
                    };
                    break;
                default:
                    getItems = null;
                    create = null;
                    createAsync = null;
                    application.showError("Creating " + newItemType.value + " is not yet implemented!");
            }
            document.getElementById(NEW_ITEM_CATEGORY_CONTAINER_ID).hidden = newItemCategory.options.length < 2;
            document.getElementById(NEW_ITEM_DIALOG_FILLER_ID).hidden = newItemCategory.options.length >= 2;
            newItemCategory.onchange();
        };
        newItemCategory.onchange = function () {
            if (getItems) {
                common.setSelectorOptions(newItemBase, ["none"].concat(getItems(newItemCategory.value)));
                if (newItemType.value === common.ItemType.MISSION) {
                    newItemName.value = "mission";
                } else {
                    newItemName.value = newItemCategory.value;
                    if (newItemName.value.indexOf("Classes") >= 0) {
                        newItemName.value = newItemName.value.substring(0, newItemName.value.indexOf("Classes"));
                    } else if (newItemName.value[newItemName.value.length - 1] === "s") {
                        newItemName.value = newItemName.value.substring(0, newItemName.value.length - 1);
                    }
                }
            }
        };
        newItemBase.onchange = function () {
            if (newItemBase.selectedIndex > 0) {
                if (newItemType.value === common.ItemType.MISSION) {
                    newItemName.value = newItemBase.value;
                    if (newItemName.value.indexOf(".json") === newItemName.value.length - 5) {
                        newItemName.value = newItemName.value.substring(0, newItemName.value.length - 5);
                    }
                    newItemName.value = newItemName.value + "_copy";
                } else {
                    newItemName.value = newItemBase.value + "_copy";
                }
            } else {
                if (newItemType.value === common.ItemType.MISSION) {
                    newItemName.value = "newMission";
                } else {
                    newItemName.value = newItemCategory.value;
                }
            }
        };
        newItemType.onchange();
        createButton.onclick = function () {
            var itemNames;
            if (getItems) {
                itemNames = getItems(newItemCategory.value);
                if (itemNames.indexOf(newItemName.value) >= 0) {
                    application.showError("Cannot create item: '" + newItemName.value + "' already exists!", application.ErrorSeverity.MINOR);
                    return;
                }
                if (create) {
                    create();
                    _loadItems();
                    _newItemDialog.hidden = true;
                    _selectItem(newItemType.value, newItemName.value, newItemCategory.value);
                } else if (createAsync) {
                    createAsync(function () {
                        _loadItems();
                        _newItemDialog.hidden = true;
                        _selectItem(newItemType.value, newItemName.value, newItemCategory.value);
                    });
                }
            }
        };
        cancelButton.onclick = function () {
            _newItemDialog.hidden = true;
        };
        _initNewItemDialog = function () {
            var index;
            if (_selectedItem) {
                index = typeOptions.indexOf(_selectedItem.type);
                if (index >= 0) {
                    newItemType.selectedIndex = index;
                    newItemType.onchange();
                    index = common.getSelectorOptions(newItemCategory).indexOf(_selectedItem.category);
                    if (index >= 0) {
                        newItemCategory.selectedIndex = index;
                        newItemCategory.onchange();
                    }
                }
            }
        };
    }
    /**
     * Sets up the content for all dialogs
     */
    function _loadDialogs() {
        _newItemDialog = document.getElementById(NEW_ITEM_DIALOG_ID);
        _exportDialog = document.getElementById(EXPORT_DIALOG_ID);
        _importDialog = document.getElementById(IMPORT_DIALOG_ID);
        document.getElementById(NEW_ITEM_BUTTON_ID).onclick = function () {
            _newItemDialog.hidden = !_newItemDialog.hidden;
            if (!_newItemDialog.hidden) {
                _initNewItemDialog();
                _exportDialog.hidden = true;
                _importDialog.hidden = true;
            }
        };
        _loadNewItemDialog();

        document.getElementById(EXPORT_BUTTON_ID).onclick = function () {
            _exportDialog.hidden = !_exportDialog.hidden;
            if (!_exportDialog.hidden) {
                _initExportDialog();
                _newItemDialog.hidden = true;
                _importDialog.hidden = true;
            }
        };
        _loadExportDialog();

        document.getElementById(IMPORT_BUTTON_ID).onclick = function () {
            _importDialog.hidden = !_importDialog.hidden;
            if (!_importDialog.hidden) {
                _newItemDialog.hidden = true;
                _exportDialog.hidden = true;
            }
        };
        _loadImportDialog();
    }
    /**
     * Sends an asynchronous request to get the JSON file describing the game settings and sets the callback function to set them and
     * load the content of the Items window
     * @param {{folder: String, filename: String}} settingsFileDescriptor
     */
    function _requestSettingsLoad(settingsFileDescriptor) {
        application.requestTextFile(settingsFileDescriptor.folder, settingsFileDescriptor.filename, function (settingsText) {
            var settingsJSON = JSON.parse(settingsText);
            application.log("Loading game settings...", 1);
            graphics.loadSettingsFromJSON(settingsJSON.graphics);
            graphics.loadSettingsFromLocalStorage();
            config.loadSettingsFromJSON(settingsJSON.logic);
            graphics.executeWhenReady(function () {
                lights.setupLiSPSM(graphics.getLispsmMinimumNear(), graphics.getLispsmNearFactor());
            });
            config.executeWhenReady(function () {
                environments.requestLoad();
                environments.executeWhenReady(function () {
                    missions.requestLoad(true);
                    missions.executeWhenReady(function () {
                        var hash;
                        application.log("Game settings loaded.", 1);
                        localStorage[constants.VERSION_LOCAL_STORAGE_ID] = application.getVersion();
                        application.log("Initialization completed.");
                        _setLabel(document.getElementById(PREVIEW_WINDOW_ID), NO_ITEM_SELECTED_TEXT + "<br>" + TUTORIAL_TEXT);
                        _setLabel(document.getElementById(PROPERTIES_WINDOW_ID), NO_ITEM_SELECTED_TEXT);
                        _loadItems();
                        _loadHistoryButtons();
                        _loadDialogs();
                        if (location.hash) {
                            hash = location.hash.substring(1).split("/");
                            if (hash.length > 3) {
                                _selectItem(hash[0], location.hash.substring(3 + hash[0].length + hash[1].length), hash[1]);
                            } else if (hash.length === 3) {
                                _selectItem(hash[0], hash[2], hash[1]);
                            } else if (hash.length > 0) {
                                if (hash[0] === common.ItemType.MISSION) {
                                    _selectedItem.type = common.ItemType.MISSION;
                                    _selectedItem.category = MISSIONS_CATEGORY;
                                    _expandList(_itemElements[_selectedItem.type][_selectedItem.category]._list);
                                    if (hash.length === 2) {
                                        if (hash[1] === "create") {
                                            document.getElementById(NEW_ITEM_BUTTON_ID).click();
                                        } else if (hash[1] === "import") {
                                            document.getElementById(IMPORT_BUTTON_ID).click();
                                        }
                                    }
                                }
                            }
                        }
                    });
                });
            });
        });
    }
    /**
     * Starts the whole initialization / setup process by sending an asynchronous request to get the JSON file describing the game 
     * configuration and setting the callback to continue when it is loaded.
     */
    function _requestConfigLoad() {
        application.requestTextFile("config", "config.json", function (configText) {
            var configJSON = JSON.parse(configText);
            application.log("Loading configuration...");
            application.setFolders(configJSON.folders);
            application.setLogVerbosity(configJSON.logVerbosity);
            application.setVersion(configJSON.version);
            application.setDebugVersion(configJSON.debugVersion);
            application.log("Game version is: " + application.getVersion(), 1);
            requirejs([
                "modules/media-resources"
            ], function (resources) {
                var language = "English";
                config.loadConfigurationFromJSON(configJSON.dataFiles.logic);
                graphics.loadConfigurationFromJSON(configJSON.graphics);
                missions.loadConfigurationFromJSON(configJSON.logic);
                control.loadConfigurationFromJSON(configJSON.control);
                resources.requestConfigLoad(configJSON.dataFiles.media.resources, function () {
                    application.log("Configuration loaded.");
                });
                application.requestTextFile(
                        configJSON.configFiles.strings[language].folder,
                        configJSON.configFiles.strings[language].filename,
                        function (responseText) {
                            strings.loadStrings(language, JSON.parse(responseText), strings);
                            strings.setLanguage(language);
                            _requestSettingsLoad(configJSON.configFiles.settings);
                        });
            });
        });
    }
    /**
     * The function to handle the window resize event
     * @returns {}
     */
    function _handleResize() {
        common.alignPopups();
    }
    // ------------------------------------------------------------------------------
    // The public interface of the module
    return {
        initialize: function (data) {
            application.log("Initializing the Interstellar Armada Editor...");
            application.useElectron(data.electron);
            application.setPreviouslyRunVersion(localStorage[constants.VERSION_LOCAL_STORAGE_ID]);
            _requestConfigLoad();
            window.addEventListener("resize", _handleResize);
        }
    };
});
