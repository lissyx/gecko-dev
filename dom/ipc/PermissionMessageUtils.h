/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_dom_permission_message_utils_h__
#define mozilla_dom_permission_message_utils_h__

#include "ipc/IPCMessageUtils.h"
#include "nsCOMPtr.h"
#include "nsIPrincipal.h"

namespace IPC {

template <>
struct ParamTraits<nsIPrincipal> {
  static void Write(Message* aMsg, nsIPrincipal* aParam);
  static bool Read(const Message* aMsg, PickleIterator* aIter,
                   RefPtr<nsIPrincipal>* aResult);
};

/**
 * Legacy IPC::Principal type. Use nsIPrincipal directly in new IPDL code.
 */
class Principal {
  friend struct ParamTraits<Principal>;

 public:
  Principal() : mPrincipal(nullptr) {}

  explicit Principal(nsIPrincipal* aPrincipal) : mPrincipal(aPrincipal) {}

  operator nsIPrincipal*() const { return mPrincipal.get(); }

  Principal& operator=(const Principal& aOther) {
    mPrincipal = aOther.mPrincipal;
    return *this;
  }

 private:
  RefPtr<nsIPrincipal> mPrincipal;
};

template <>
struct ParamTraits<Principal> {
  typedef Principal paramType;
  static void Write(Message* aMsg, const paramType& aParam) {
    WriteParam(aMsg, aParam.mPrincipal);
  }
  static bool Read(const Message* aMsg, PickleIterator* aIter,
                   paramType* aResult) {
    return ReadParam(aMsg, aIter, &aResult->mPrincipal);
  }
};

}  // namespace IPC

#endif  // mozilla_dom_permission_message_utils_h__
