/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef dom_tabs_ContentThread_h
#define dom_tabs_ContentThread_h 1

#include "mozilla/ipc/ProcessChild.h"
#include "mozilla/ipc/ScopedXREEmbed.h"
#include "ContentChild.h"

#if defined(XP_WIN)
#  include "mozilla/mscom/MainThreadRuntime.h"
#endif

namespace mozilla {
namespace dom {

/**
 * ContentProcess is a singleton on the content process which represents
 * the main thread where tab instances live.
 */
class ContentProcess : public mozilla::ipc::ProcessChild {
  typedef mozilla::ipc::ProcessChild ProcessChild;

 public:
  explicit ContentProcess(ProcessId aParentPid) : ProcessChild(aParentPid) {}

  ~ContentProcess() {}

  virtual bool Init(int aArgc, char* aArgv[]) override;
  virtual void CleanUp() override;

 private:
  ContentChild mContent;
  mozilla::ipc::ScopedXREEmbed mXREEmbed;

#if defined(XP_WIN)
  // This object initializes and configures COM.
  mozilla::mscom::MainThreadRuntime mCOMRuntime;
#endif

  DISALLOW_EVIL_CONSTRUCTORS(ContentProcess);
};

}  // namespace dom
}  // namespace mozilla

#endif  // ifndef dom_tabs_ContentThread_h
