/*
 * Tests that an old-style default profile not previously used by any build
 * doesn't get updated to a dedicated profile for this build and we don't set
 * the flag to show the user info about dedicated profiles.
 */

add_task(async () => {
  let hash = xreDirProvider.getInstallHash();
  let defaultProfile = makeRandomProfileDir("default");

  writeProfilesIni({
    profiles: [{
      name: PROFILE_DEFAULT,
      path: defaultProfile.leafName,
      default: true,
    }],
  });

  let service = getProfileService();
  let { profile: selectedProfile, didCreate } = selectStartupProfile();
  checkStartupReason("firstrun-created-default");

  let profileData = readProfilesIni();
  let installData = readInstallsIni();

  Assert.ok(profileData.options.startWithLastProfile, "Should be set to start with the last profile.");
  Assert.equal(profileData.profiles.length, 2, "Should have the right number of profiles.");

  // The name ordering is different for dev edition.
  if (AppConstants.MOZ_DEV_EDITION) {
    profileData.profiles.reverse();
  }

  let profile = profileData.profiles[0];
  Assert.equal(profile.name, PROFILE_DEFAULT, "Should have the right name.");
  Assert.equal(profile.path, defaultProfile.leafName, "Should be the original default profile.");
  Assert.ok(profile.default, "Should be marked as the old-style default.");
  profile = profileData.profiles[1];
  Assert.equal(profile.name, DEDICATED_NAME, "Should have the right name.");
  Assert.notEqual(profile.path, defaultProfile.leafName, "Should not be the original default profile.");
  Assert.ok(!profile.default, "Should not be marked as the old-style default.");

  Assert.equal(Object.keys(installData.installs).length, 1, "Should be a default for installs.");
  Assert.equal(installData.installs[hash].default, profile.path, "Should have the right default profile.");
  Assert.ok(installData.installs[hash].locked, "Should have locked as we created this profile for this install.");

  checkProfileService(profileData, installData);

  Assert.ok(didCreate, "Should have created a new profile.");
  Assert.ok(!service.createdAlternateProfile, "Should not have created an alternate profile.");
  Assert.ok(!selectedProfile.rootDir.equals(defaultProfile), "Should not be using the old directory.");
  Assert.equal(selectedProfile.name, DEDICATED_NAME);
});
