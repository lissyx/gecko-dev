/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyGlobalGetters(this, ["fetch"]);

const {actionTypes: at, actionCreators: ac} = ChromeUtils.import("resource://activity-stream/common/Actions.jsm");
const {PersistentCache} = ChromeUtils.import("resource://activity-stream/lib/PersistentCache.jsm");

const CACHE_KEY = "discovery_stream";
const LAYOUT_UPDATE_TIME = 30 * 60 * 1000; // 30 minutes
const STARTUP_CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 1 week
const COMPONENT_FEEDS_UPDATE_TIME = 30 * 60 * 1000; // 30 minutes
const SPOCS_FEEDS_UPDATE_TIME = 30 * 60 * 1000; // 30 minutes
const MAX_LIFETIME_CAP = 500; // Guard against misconfiguration on the server
const PREF_CONFIG = "discoverystream.config";
const PREF_OPT_OUT = "discoverystream.optOut.0";
const PREF_SHOW_SPONSORED = "showSponsored";
const PREF_SPOC_IMPRESSIONS = "discoverystream.spoc.impressions";

this.DiscoveryStreamFeed = class DiscoveryStreamFeed {
  constructor() {
    // Internal state for checking if we've intialized all our data
    this.loaded = false;

    // Persistent cache for remote endpoint data.
    this.cache = new PersistentCache(CACHE_KEY, true);
    // Internal in-memory cache for parsing json prefs.
    this._prefCache = {};
  }

  get config() {
    if (this._prefCache.config) {
      return this._prefCache.config;
    }
    try {
      this._prefCache.config = JSON.parse(this.store.getState().Prefs.values[PREF_CONFIG]);

      // Modify the cached config with the user set opt-out for other consumers
      this._prefCache.config.enabled = this._prefCache.config.enabled &&
        !this.store.getState().Prefs.values[PREF_OPT_OUT];
    } catch (e) {
      // istanbul ignore next
      this._prefCache.config = {};
      // istanbul ignore next
      Cu.reportError(`Could not parse preference. Try resetting ${PREF_CONFIG} in about:config.`);
    }
    return this._prefCache.config;
  }

  get showSpocs() {
    // Combine user-set sponsored opt-out with Mozilla-set config
    return this.store.getState().Prefs.values[PREF_SHOW_SPONSORED] && this.config.show_spocs;
  }

  setupPrefs() {
    // Send the initial state of the pref on our reducer
    this.store.dispatch(ac.BroadcastToContent({type: at.DISCOVERY_STREAM_CONFIG_SETUP, data: this.config}));
  }

  uninitPrefs() {
    // Reset in-memory cache
    this._prefCache = {};
  }

  async fetchFromEndpoint(endpoint) {
    if (!endpoint) {
      Cu.reportError("Tried to fetch endpoint but none was configured.");
      return null;
    }
    try {
      const response = await fetch(endpoint, {credentials: "omit"});
      if (!response.ok) {
        // istanbul ignore next
        throw new Error(`${endpoint} returned unexpected status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      // istanbul ignore next
      Cu.reportError(`Failed to fetch ${endpoint}: ${error.message}`);
    }
    // istanbul ignore next
    return null;
  }

  /**
   * Returns true if data in the cache for a particular key has expired or is missing.
   * @param {object} cachedData data returned from cache.get()
   * @param {string} key a cache key
   * @param {string?} url for "feed" only, the URL of the feed.
   * @param {boolean} is this check done at initial browser load
   */
  isExpired({cachedData, key, url, isStartup}) {
    const {layout, spocs, feeds} = cachedData;
    const updateTimePerComponent = {
      "layout": LAYOUT_UPDATE_TIME,
      "spocs": SPOCS_FEEDS_UPDATE_TIME,
      "feed": COMPONENT_FEEDS_UPDATE_TIME,
    };
    const EXPIRATION_TIME = isStartup ? STARTUP_CACHE_EXPIRE_TIME : updateTimePerComponent[key];
    switch (key) {
      case "layout":
        return (!layout || !(Date.now() - layout._timestamp < EXPIRATION_TIME));
      case "spocs":
        return (!spocs || !(Date.now() - spocs.lastUpdated < EXPIRATION_TIME));
      case "feed":
        return (!feeds || !feeds[url] || !(Date.now() - feeds[url].lastUpdated < EXPIRATION_TIME));
      default:
        // istanbul ignore next
        throw new Error(`${key} is not a valid key`);
    }
  }

  async _checkExpirationPerComponent() {
    const cachedData = await this.cache.get() || {};
    const {feeds} = cachedData;
    return {
      layout: this.isExpired({cachedData, key: "layout"}),
      spocs: this.isExpired({cachedData, key: "spocs"}),
      feeds: !feeds || Object.keys(feeds).some(url => this.isExpired({cachedData, key: "feed", url})),
    };
  }

  /**
   * Returns true if any data for the cached endpoints has expired or is missing.
   */
  async checkIfAnyCacheExpired() {
    const expirationPerComponent = await this._checkExpirationPerComponent();
    return expirationPerComponent.layout ||
      expirationPerComponent.spocs ||
      expirationPerComponent.feeds;
  }

  async loadLayout(sendUpdate, isStartup) {
    const cachedData = await this.cache.get() || {};
    let {layout: layoutResponse} = cachedData;
    if (this.isExpired({cachedData, key: "layout", isStartup})) {
      layoutResponse = await this.fetchFromEndpoint(this.config.layout_endpoint);
      if (layoutResponse && layoutResponse.layout) {
        layoutResponse._timestamp = Date.now();
        await this.cache.set("layout", layoutResponse);
      } else {
        Cu.reportError("No response for response.layout prop");
      }
    }

    if (layoutResponse && layoutResponse.layout) {
      sendUpdate({
        type: at.DISCOVERY_STREAM_LAYOUT_UPDATE,
        data: {
          layout: layoutResponse.layout,
          lastUpdated: layoutResponse._timestamp,
        },
      });
    }
    if (layoutResponse && layoutResponse.spocs && layoutResponse.spocs.url) {
      sendUpdate({
        type: at.DISCOVERY_STREAM_SPOCS_ENDPOINT,
        data: layoutResponse.spocs.url,
      });
    }
  }

  async loadComponentFeeds(sendUpdate, isStartup) {
    const {DiscoveryStream} = this.store.getState();
    const newFeeds = {};
    if (DiscoveryStream && DiscoveryStream.layout) {
      for (let row of DiscoveryStream.layout) {
        if (!row || !row.components) {
          continue;
        }
        for (let component of row.components) {
          if (component && component.feed) {
            const {url} = component.feed;
            newFeeds[url] = await this.getComponentFeed(url, isStartup);
          }
        }
      }

      await this.cache.set("feeds", newFeeds);
      sendUpdate({type: at.DISCOVERY_STREAM_FEEDS_UPDATE, data: newFeeds});
    }
  }

  async loadSpocs(sendUpdate, isStartup) {
    const cachedData = await this.cache.get() || {};
    let spocs;

    if (this.showSpocs) {
      spocs = cachedData.spocs;
      if (this.isExpired({cachedData, key: "spocs", isStartup})) {
        const endpoint = this.store.getState().DiscoveryStream.spocs.spocs_endpoint;
        const spocsResponse = await this.fetchFromEndpoint(endpoint);
        if (spocsResponse) {
          spocs = {
            lastUpdated: Date.now(),
            data: spocsResponse,
          };

          this.cleanUpCampaignImpressionPref(spocs.data);
          await this.cache.set("spocs", spocs);
        } else {
          Cu.reportError("No response for spocs_endpoint prop");
        }
      }
    }

    // Use good data if we have it, otherwise nothing.
    // We can have no data if spocs set to off.
    // We can have no data if request fails and there is no good cache.
    // We want to send an update spocs or not, so client can render something.
    spocs = spocs || {
      lastUpdated: Date.now(),
      data: {},
    };

    sendUpdate({
      type: at.DISCOVERY_STREAM_SPOCS_UPDATE,
      data: {
        lastUpdated: spocs.lastUpdated,
        spocs: this.filterSpocs(spocs.data),
      },
    });
  }

  // Filter spocs based on frequency caps
  filterSpocs(data) {
    if (data && data.spocs && data.spocs.length) {
      const {spocs} = data;
      const impressions = this.readImpressionsPref(PREF_SPOC_IMPRESSIONS);
      return {
        ...data,
        spocs: spocs.filter(s => this.isBelowFrequencyCap(impressions, s)),
      };
    }
    return data;
  }

  // Frequency caps are based on campaigns, which may include multiple spocs.
  // We currently support two types of frequency caps:
  // - lifetime: Indicates how many times spocs from a campaign can be shown in total
  // - period: Indicates how many times spocs from a campaign can be shown within a period
  //
  // So, for example, the feed configuration below defines that for campaign 1 no more
  // than 5 spocs can be shown in total, and no more than 2 per hour.
  // "campaign_id": 1,
  // "caps": {
  //  "lifetime": 5,
  //  "campaign": {
  //    "count": 2,
  //    "period": 3600
  //  }
  // }
  isBelowFrequencyCap(impressions, spoc) {
    const campaignImpressions = impressions[spoc.campaign_id];
    if (!campaignImpressions) {
      return true;
    }

    const lifetime = spoc.caps && spoc.caps.lifetime;

    const lifeTimeCap = Math.min(lifetime || MAX_LIFETIME_CAP, MAX_LIFETIME_CAP);
    const lifeTimeCapExceeded = campaignImpressions.length >= lifeTimeCap;
    if (lifeTimeCapExceeded) {
      return false;
    }

    const campaignCap = spoc.caps && spoc.caps.campaign;
    if (campaignCap) {
      const campaignCapExceeded = campaignImpressions
        .filter(i => (Date.now() - i) < (campaignCap.period * 1000)).length >= campaignCap.count;
      return !campaignCapExceeded;
    }
    return true;
  }

  async getComponentFeed(feedUrl, isStartup) {
    const cachedData = await this.cache.get() || {};
    const {feeds} = cachedData;
    let feed = feeds ? feeds[feedUrl] : null;
    if (this.isExpired({cachedData, key: "feed", url: feedUrl, isStartup})) {
      const feedResponse = await this.fetchFromEndpoint(feedUrl);
      if (feedResponse) {
        feed = {
          lastUpdated: Date.now(),
          data: feedResponse,
        };
      } else {
        Cu.reportError("No response for feed");
      }
    }

    return feed;
  }

  /**
   * Called at startup to update cached data in the background.
   */
  async _maybeUpdateCachedData() {
    const expirationPerComponent = await this._checkExpirationPerComponent();
    // Pass in `store.dispatch` to send the updates only to main
    if (expirationPerComponent.layout) {
      await this.loadLayout(this.store.dispatch);
    }
    if (expirationPerComponent.spocs) {
      await this.loadSpocs(this.store.dispatch);
    }
    if (expirationPerComponent.feeds) {
      await this.loadComponentFeeds(this.store.dispatch);
    }
  }

  /**
   * @typedef {Object} RefreshAllOptions
   * @property {boolean} updateOpenTabs - Sends updates to open tabs immediately if true,
   *                                      updates in background if false
   * @property {boolean} isStartup - When the function is called at browser startup
   *
   * Refreshes layout, component feeds, and spocs in order if caches have expired.
   * @param {RefreshAllOptions} options
   */
  async refreshAll(options = {}) {
    const {updateOpenTabs, isStartup} = options;
    const dispatch = updateOpenTabs ?
      action => this.store.dispatch(ac.BroadcastToContent(action)) :
      this.store.dispatch;

    await this.loadLayout(dispatch, isStartup);
    await Promise.all([
      this.loadComponentFeeds(dispatch, isStartup).catch(error => Cu.reportError(`Error trying to load component feeds: ${error}`)),
      this.loadSpocs(dispatch, isStartup).catch(error => Cu.reportError(`Error trying to load spocs feed: ${error}`)),
    ]);
    if (isStartup) {
      await this._maybeUpdateCachedData();
    }

    this.loaded = true;
  }

  async enable() {
    await this.refreshAll({updateOpenTabs: true, isStartup: true});
  }

  async disable() {
    await this.clearCache();
    // Reset reducer
    this.store.dispatch(ac.BroadcastToContent({type: at.DISCOVERY_STREAM_LAYOUT_RESET}));
    this.loaded = false;
  }

  async clearCache() {
    await this.cache.set("layout", {});
    await this.cache.set("feeds", {});
    await this.cache.set("spocs", {});
  }

  async onPrefChange() {
    if (this.config.enabled) {
      // We always want to clear the cache if the pref has changed
      await this.clearCache();
      // Load data from all endpoints
      await this.enable();
    }

    // Clear state and relevant listeners if config.enabled = false.
    if (this.loaded && !this.config.enabled) {
      await this.disable();
    }
  }

  recordCampaignImpression(campaignId) {
    let impressions = this.readImpressionsPref(PREF_SPOC_IMPRESSIONS);

    const timeStamps = impressions[campaignId] || [];
    timeStamps.push(Date.now());
    impressions = {...impressions, [campaignId]: timeStamps};

    this.writeImpressionsPref(PREF_SPOC_IMPRESSIONS, impressions);
  }

  cleanUpCampaignImpressionPref(data) {
    if (data.spocs && data.spocs.length) {
      const campaignIds = data.spocs.map(s => `${s.campaign_id}`);
      this.cleanUpImpressionPref(id => !campaignIds.includes(id), PREF_SPOC_IMPRESSIONS);
    }
  }

  writeImpressionsPref(pref, impressions) {
    this.store.dispatch(ac.SetPref(pref, JSON.stringify(impressions)));
  }

  readImpressionsPref(pref) {
    const prefVal = this.store.getState().Prefs.values[pref];
    return prefVal ? JSON.parse(prefVal) : {};
  }

  cleanUpImpressionPref(isExpired, pref) {
    const impressions = this.readImpressionsPref(pref);
    let changed = false;

    Object
      .keys(impressions)
      .forEach(id => {
        if (isExpired(id)) {
          changed = true;
          delete impressions[id];
        }
      });

    if (changed) {
      this.writeImpressionsPref(pref, impressions);
    }
  }

  async onAction(action) {
    switch (action.type) {
      case at.INIT:
        // During the initialization of Firefox:
        // 1. Set-up listeners and initialize the redux state for config;
        this.setupPrefs();
        // 2. If config.enabled is true, start loading data.
        if (this.config.enabled) {
          await this.enable();
        }
        break;
      case at.SYSTEM_TICK:
        // Only refresh if we loaded once in .enable()
        if (this.config.enabled && this.loaded && await this.checkIfAnyCacheExpired()) {
          await this.refreshAll({updateOpenTabs: false});
        }
        break;
      case at.DISCOVERY_STREAM_CONFIG_SET_VALUE:
        // Disable opt-out if we're explicitly trying to enable
        if (action.data.name === "enabled" && action.data.value) {
          this.store.dispatch(ac.SetPref(PREF_OPT_OUT, false));
        }

        // Use the original string pref to then set a value instead of
        // this.config which has some modifications
        this.store.dispatch(ac.SetPref(PREF_CONFIG, JSON.stringify({
          ...JSON.parse(this.store.getState().Prefs.values[PREF_CONFIG]),
          [action.data.name]: action.data.value,
        })));
        break;
      case at.DISCOVERY_STREAM_CONFIG_CHANGE:
        // When the config pref changes, load or unload data as needed.
        await this.onPrefChange();
        break;
      case at.DISCOVERY_STREAM_OPT_OUT:
        this.store.dispatch(ac.SetPref(PREF_OPT_OUT, true));
        break;
      case at.DISCOVERY_STREAM_SPOC_IMPRESSION:
        if (this.showSpocs) {
          this.recordCampaignImpression(action.data.campaignId);

          const cachedData = await this.cache.get() || {};
          const {spocs} = cachedData;

          this.store.dispatch(ac.AlsoToPreloaded({
            type: at.DISCOVERY_STREAM_SPOCS_UPDATE,
            data: {
              lastUpdated: spocs.lastUpdated,
              spocs: this.filterSpocs(spocs.data),
            },
          }));
        }
        break;
      case at.UNINIT:
        // When this feed is shutting down:
        this.uninitPrefs();
        break;
      case at.PREF_CHANGED:
        switch (action.data.name) {
          case PREF_CONFIG:
          case PREF_OPT_OUT:
            // Clear the cached config and broadcast the newly computed value
            this._prefCache.config = null;
            this.store.dispatch(ac.BroadcastToContent({
              type: at.DISCOVERY_STREAM_CONFIG_CHANGE,
              data: this.config,
            }));
            break;
          // Check if spocs was disabled. Remove them if they were.
          case PREF_SHOW_SPONSORED:
            await this.loadSpocs();
            break;
        }
        break;
    }
  }
};

const EXPORTED_SYMBOLS = ["DiscoveryStreamFeed"];
