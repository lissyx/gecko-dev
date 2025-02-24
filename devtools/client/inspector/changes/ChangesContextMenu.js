/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

loader.lazyRequireGetter(this, "Menu", "devtools/client/framework/menu");
loader.lazyRequireGetter(this, "MenuItem", "devtools/client/framework/menu-item");

const { getStr } = require("./utils/l10n");

/**
 * Context menu for the Changes panel with options to select, copy and export CSS changes.
 */
class ChangesContextMenu {
  /**
   * @param {ChangesView} view
   */
  constructor(view) {
    this.view = view;
    this.inspector = this.view.inspector;
    // Document object to which the Changes panel belongs to.
    this.document = this.view.document;
    // DOM element container for the Changes panel content.
    this.panel = this.document.getElementById("sidebar-panel-changes");
    // Window object to which the Changes panel belongs to.
    this.window = this.document.defaultView;

    this._onCopySelection = this.view.copySelection.bind(this.view);
    this._onCopyChanges = this.view.copyChanges.bind(this.view);
    this._onSelectAll = this._onSelectAll.bind(this);
  }

  show(event) {
    this._openMenu({
      target: event.target,
      screenX: event.screenX,
      screenY: event.screenY,
    });
  }

  _openMenu({ target, screenX = 0, screenY = 0 } = {}) {
    this.window.focus();

    const menu = new Menu();

    // Copy option
    const menuitemCopy = new MenuItem({
      label: getStr("changes.contextmenu.copy"),
      accesskey: getStr("changes.contextmenu.copy.accessKey"),
      click: this._onCopySelection,
      disabled: !this._hasTextSelected(),
    });
    menu.append(menuitemCopy);

    const ruleEl = target.closest("[data-rule-id]");
    const ruleId = ruleEl ? ruleEl.dataset.ruleId : null;
    const sourceEl = target.closest("[data-source-id]");
    const sourceId = sourceEl ? sourceEl.dataset.sourceId : null;

    // When both rule id and source id are found, deal with just for that rule.
    if (ruleId && sourceId) {
      // Copy Changes option
      menu.append(new MenuItem({
        label: getStr("changes.contextmenu.copyChanges"),
        click: () => this._onCopyChanges(ruleId, sourceId),
      }));

      menu.append(new MenuItem({
        type: "separator",
      }));
    }

    // When only the source id is found, deal with all changed rules in that source.
    if (!ruleId && sourceId) {
      // Copy All Changes option
      menu.append(new MenuItem({
        label: getStr("changes.contextmenu.copyAllChanges"),
        click: () => this._onCopyChanges(null, sourceId),
      }));

      menu.append(new MenuItem({
        type: "separator",
      }));
    }

    // Select All option
    const menuitemSelectAll = new MenuItem({
      label: getStr("changes.contextmenu.selectAll"),
      accesskey: getStr("changes.contextmenu.selectAll.accessKey"),
      click: this._onSelectAll,
    });
    menu.append(menuitemSelectAll);

    menu.popup(screenX, screenY, this.inspector.toolbox);
    return menu;
  }

  _hasTextSelected() {
    const selection = this.window.getSelection();
    return selection.toString() && !selection.isCollapsed;
  }

  /**
   * Select all text.
   */
  _onSelectAll() {
    const selection = this.window.getSelection();
    selection.selectAllChildren(this.panel);
  }

  destroy() {
    this.inspector = null;
    this.panel = null;
    this.view = null;
    this.window = null;
  }
}

module.exports = ChangesContextMenu;
