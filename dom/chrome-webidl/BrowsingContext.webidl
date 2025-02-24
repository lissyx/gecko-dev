/* -*- Mode: IDL; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

interface nsIDocShell;

[Exposed=Window, ChromeOnly]
interface BrowsingContext {
  static BrowsingContext? get(unsigned long long aId);

  readonly attribute BrowsingContext? parent;

  sequence<BrowsingContext> getChildren();

  readonly attribute nsIDocShell? docShell;

  readonly attribute unsigned long long id;

  readonly attribute BrowsingContext? opener;

  readonly attribute BrowsingContextGroup group;
};

[Exposed=Window, ChromeOnly]
interface CanonicalBrowsingContext : BrowsingContext {
  sequence<WindowGlobalParent> getWindowGlobals();

  readonly attribute WindowGlobalParent? currentWindowGlobal;
};

[Exposed=Window, ChromeOnly]
interface BrowsingContextGroup {
  sequence<BrowsingContext> getToplevels();
};
