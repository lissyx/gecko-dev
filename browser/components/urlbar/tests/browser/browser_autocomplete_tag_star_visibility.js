/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for the bookmark star being correct displayed for results matching
 * tags.
 */

add_task(async function() {
  registerCleanupFunction(async function() {
    await PlacesUtils.bookmarks.eraseEverything();
  });

  async function addTagItem(tagName) {
    let url = `http://example.com/this/is/tagged/${tagName}`;
    await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.unfiledGuid,
      url,
      title: `test ${tagName}`,
    });
    PlacesUtils.tagging.tagURI(Services.io.newURI(url), [tagName]);
    await PlacesTestUtils.addVisits({uri: url, title: `Test page with tag ${tagName}`});
  }

  // We use different tags for each part of the test, as otherwise the
  // autocomplete code tries to be smart by using the previously cached element
  // without updating it (since all parameters it knows about are the same).

  let testcases = [{
    description: "Test with suggest.bookmark=true",
    tagName: "tagtest1",
    prefs: {
      "suggest.bookmark": true,
    },
    input: "tagtest1",
    expected: {
      typeImageVisible: true,
    },
  }, {
    description: "Test with suggest.bookmark=false",
    tagName: "tagtest2",
    prefs: {
      "suggest.bookmark": false,
    },
    input: "tagtest2",
    expected: {
      typeImageVisible: false,
    },
  }, {
    description: "Test with suggest.bookmark=true (again)",
    tagName: "tagtest3",
    prefs: {
      "suggest.bookmark": true,
    },
    input: "tagtest3",
    expected: {
      typeImageVisible: true,
    },
  }, {
    description: "Test with bookmark restriction token",
    tagName: "tagtest4",
    prefs: {
      "suggest.bookmark": true,
    },
    input: "* tagtest4",
    expected: {
      typeImageVisible: true,
    },
  }, {
    description: "Test with history restriction token",
    tagName: "tagtest5",
    prefs: {
      "suggest.bookmark": true,
    },
    input: "^ tagtest5",
    expected: {
      typeImageVisible: false,
    },
  }];

  for (let testcase of testcases) {
    // TODO: Bug 1526051 - Fix searching for tags when suggest.bookmark is false.
    if (UrlbarPrefs.get("quantumbar") &&
        (testcase.tagName == "tagtest2" ||
         testcase.tagName == "tagtest5")) {
      continue;
    }
    info(`Test case: ${testcase.description}`);

    await addTagItem(testcase.tagName);
    for (let prefName of Object.keys(testcase.prefs)) {
      Services.prefs.setBoolPref(`browser.urlbar.${prefName}`, testcase.prefs[prefName]);
    }

    await promiseAutocompleteResultPopup(testcase.input);

    Assert.greaterOrEqual(UrlbarTestUtils.getResultCount(window), 2,
      "Should be at least two results");

    let result = await UrlbarTestUtils.getDetailsOfResultAt(window, 1);

    Assert.equal(result.type, UrlbarUtils.RESULT_TYPE.URL,
      "Should have a URL result type");
    Assert.deepEqual(result.tags, [testcase.tagName],
      "Should have the expected tag");

    if (testcase.expected.typeImageVisible) {
      Assert.equal(result.displayed.typeIcon, "url(\"chrome://browser/skin/bookmark.svg\")",
        "Should have the star image displayed or not as expected");
    } else {
      Assert.equal(result.displayed.typeIcon, "none",
        "Should have the star image displayed or not as expected");
    }

    await UrlbarTestUtils.promisePopupClose(window);
  }
});
