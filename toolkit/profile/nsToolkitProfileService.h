
/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsToolkitProfileService_h
#define nsToolkitProfileService_h

#include "nsIToolkitProfileService.h"
#include "nsIToolkitProfile.h"
#include "nsIFactory.h"
#include "nsSimpleEnumerator.h"
#include "nsProfileLock.h"
#include "nsINIParser.h"

class nsToolkitProfile final : public nsIToolkitProfile {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSITOOLKITPROFILE

  friend class nsToolkitProfileService;
  RefPtr<nsToolkitProfile> mNext;
  nsToolkitProfile* mPrev;

 private:
  ~nsToolkitProfile() = default;

  nsToolkitProfile(const nsACString& aName, nsIFile* aRootDir,
                   nsIFile* aLocalDir, nsToolkitProfile* aPrev);

  nsresult RemoveInternal(bool aRemoveFiles, bool aInBackground);

  friend class nsToolkitProfileLock;

  nsCString mName;
  nsCOMPtr<nsIFile> mRootDir;
  nsCOMPtr<nsIFile> mLocalDir;
  nsIProfileLock* mLock;
};

class nsToolkitProfileLock final : public nsIProfileLock {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIPROFILELOCK

  nsresult Init(nsToolkitProfile* aProfile, nsIProfileUnlocker** aUnlocker);
  nsresult Init(nsIFile* aDirectory, nsIFile* aLocalDirectory,
                nsIProfileUnlocker** aUnlocker);

  nsToolkitProfileLock() = default;

 private:
  ~nsToolkitProfileLock();

  RefPtr<nsToolkitProfile> mProfile;
  nsCOMPtr<nsIFile> mDirectory;
  nsCOMPtr<nsIFile> mLocalDirectory;

  nsProfileLock mLock;
};

class nsToolkitProfileFactory final : public nsIFactory {
  ~nsToolkitProfileFactory() = default;

 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIFACTORY
};

class nsToolkitProfileService final : public nsIToolkitProfileService {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSITOOLKITPROFILESERVICE

  nsresult SelectStartupProfile(int* aArgc, char* aArgv[], bool aIsResetting,
                                nsIFile** aRootDir, nsIFile** aLocalDir,
                                nsIToolkitProfile** aProfile, bool* aDidCreate);
  nsresult CreateResetProfile(nsIToolkitProfile** aNewProfile);
  nsresult ApplyResetProfile(nsIToolkitProfile* aOldProfile);
  void CompleteStartup();

 private:
  friend class nsToolkitProfile;
  friend class nsToolkitProfileFactory;
  friend nsresult NS_NewToolkitProfileService(nsIToolkitProfileService**);

  nsToolkitProfileService();
  ~nsToolkitProfileService();

  nsresult Init();

  nsresult CreateTimesInternal(nsIFile* profileDir);
  void GetProfileByDir(nsIFile* aRootDir, nsIFile* aLocalDir,
                       nsIToolkitProfile** aResult);

  nsresult GetProfileDescriptor(nsIToolkitProfile* aProfile,
                                nsACString& aDescriptor, bool* aIsRelative);
  bool IsProfileForCurrentInstall(nsIToolkitProfile* aProfile);
  void ClearProfileFromOtherInstalls(nsIToolkitProfile* aProfile);
  bool MaybeMakeDefaultDedicatedProfile(nsIToolkitProfile* aProfile);
  bool IsSnapEnvironment();

  // Returns the known install hashes from the installs database. Modifying the
  // installs database is safe while iterating the returned array.
  nsTArray<nsCString> GetKnownInstalls();

  // Tracks whether SelectStartupProfile has been called.
  bool mStartupProfileSelected;
  // The first profile in a linked list of profiles loaded from profiles.ini.
  RefPtr<nsToolkitProfile> mFirst;
  // The profile selected for use at startup, if it exists in profiles.ini.
  nsCOMPtr<nsIToolkitProfile> mCurrent;
  // The profile selected for this install in installs.ini.
  nsCOMPtr<nsIToolkitProfile> mDedicatedProfile;
  // The default profile used by non-dev-edition builds.
  nsCOMPtr<nsIToolkitProfile> mNormalDefault;
  // The profile used if mUseDevEditionProfile is true (the default on
  // dev-edition builds).
  nsCOMPtr<nsIToolkitProfile> mDevEditionDefault;
  // The directory that holds profiles.ini and profile directories.
  nsCOMPtr<nsIFile> mAppData;
  // The directory that holds the cache files for profiles.
  nsCOMPtr<nsIFile> mTempData;
  // The location of profiles.ini.
  nsCOMPtr<nsIFile> mListFile;
  // The location of installs.ini.
  nsCOMPtr<nsIFile> mInstallFile;
  // The data loaded from installs.ini.
  nsINIParser mInstallData;
  // The install hash for the currently running install.
  nsCString mInstallHash;
  // Whether to start with the selected profile by default.
  bool mStartWithLast;
  // True if during startup it appeared that this is the first run.
  bool mIsFirstRun;
  // True if the default profile is the separate dev-edition-profile.
  bool mUseDevEditionProfile;
  // True if this install should use a dedicated default profile.
  const bool mUseDedicatedProfile;
  // True if during startup no dedicated profile was already selected, an old
  // default profile existed but was rejected so a new profile was created.
  bool mCreatedAlternateProfile;
  nsString mStartupReason;
  bool mMaybeLockProfile;

  static nsToolkitProfileService* gService;

  class ProfileEnumerator final : public nsSimpleEnumerator {
   public:
    NS_DECL_NSISIMPLEENUMERATOR

    const nsID& DefaultInterface() override {
      return NS_GET_IID(nsIToolkitProfile);
    }

    explicit ProfileEnumerator(nsToolkitProfile* first) { mCurrent = first; }

   private:
    RefPtr<nsToolkitProfile> mCurrent;
  };
};

#endif
