/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: set ts=8 sts=2 et sw=2 tw=80:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef vm_TaggedProto_h
#define vm_TaggedProto_h

#include "mozilla/Maybe.h"

#include "gc/Tracer.h"

namespace js {

// Information about an object prototype, which can be either a particular
// object, null, or a lazily generated object. The latter is only used by
// certain kinds of proxies.
class TaggedProto {
 public:
  static JSObject* const LazyProto;

  TaggedProto() : proto(nullptr) {}
  TaggedProto(const TaggedProto& other) : proto(other.proto) {}
  explicit TaggedProto(JSObject* proto) : proto(proto) {}

  uintptr_t toWord() const { return uintptr_t(proto); }

  bool isDynamic() const { return proto == LazyProto; }
  bool isObject() const {
    /* Skip nullptr and LazyProto. */
    return uintptr_t(proto) > uintptr_t(TaggedProto::LazyProto);
  }
  JSObject* toObject() const {
    MOZ_ASSERT(isObject());
    return proto;
  }
  JSObject* toObjectOrNull() const {
    MOZ_ASSERT(!proto || isObject());
    return proto;
  }
  JSObject* raw() const { return proto; }

  bool operator==(const TaggedProto& other) const {
    return proto == other.proto;
  }
  bool operator!=(const TaggedProto& other) const {
    return proto != other.proto;
  }

  HashNumber hashCode() const;

  void trace(JSTracer* trc) {
    if (isObject()) {
      TraceManuallyBarrieredEdge(trc, &proto, "TaggedProto");
    }
  }

 private:
  JSObject* proto;
};

template <>
struct MovableCellHasher<TaggedProto> {
  using Key = TaggedProto;
  using Lookup = TaggedProto;

  static bool hasHash(const Lookup& l) {
    return !l.isObject() || MovableCellHasher<JSObject*>::hasHash(l.toObject());
  }
  static bool ensureHash(const Lookup& l) {
    return !l.isObject() ||
           MovableCellHasher<JSObject*>::ensureHash(l.toObject());
  }
  static HashNumber hash(const Lookup& l) {
    if (l.isDynamic()) {
      return uint64_t(1);
    }
    if (!l.isObject()) {
      return uint64_t(0);
    }
    return MovableCellHasher<JSObject*>::hash(l.toObject());
  }
  static bool match(const Key& k, const Lookup& l) {
    return k.isDynamic() == l.isDynamic() && k.isObject() == l.isObject() &&
           (!k.isObject() ||
            MovableCellHasher<JSObject*>::match(k.toObject(), l.toObject()));
  }
};

#ifdef DEBUG
MOZ_ALWAYS_INLINE void AssertTaggedProtoIsNotGray(const TaggedProto& proto) {
  if (proto.isObject()) {
    JS::AssertObjectIsNotGray(proto.toObject());
  }
}
#endif

template <>
struct InternalBarrierMethods<TaggedProto> {
  static void preBarrier(TaggedProto& proto);

  static void postBarrier(TaggedProto* vp, TaggedProto prev, TaggedProto next);

  static void readBarrier(const TaggedProto& proto);

  static bool isMarkable(const TaggedProto& proto) { return proto.isObject(); }

#ifdef DEBUG
  static void assertThingIsNotGray(const TaggedProto& proto) {
    AssertTaggedProtoIsNotGray(proto);
  }
#endif
};

template <class Wrapper>
class WrappedPtrOperations<TaggedProto, Wrapper> {
  const TaggedProto& value() const {
    return static_cast<const Wrapper*>(this)->get();
  }

 public:
  uintptr_t toWord() const { return value().toWord(); }
  inline bool isDynamic() const { return value().isDynamic(); }
  inline bool isObject() const { return value().isObject(); }
  inline JSObject* toObject() const { return value().toObject(); }
  inline JSObject* toObjectOrNull() const { return value().toObjectOrNull(); }
  JSObject* raw() const { return value().raw(); }
  HashNumber hashCode() const { return value().hashCode(); }
  uint64_t uniqueId() const { return value().uniqueId(); }
};

// If the TaggedProto is a JSObject pointer, convert to that type and call |f|
// with the pointer. If the TaggedProto is lazy, returns None().
template <typename F>
auto MapGCThingTyped(const TaggedProto& proto, F&& f) {
  if (proto.isObject()) {
    return mozilla::Some(f(proto.toObject()));
  }
  using ReturnType = decltype(f(static_cast<JSObject*>(nullptr)));
  return mozilla::Maybe<ReturnType>();
}

template <typename F>
bool ApplyGCThingTyped(const TaggedProto& proto, F&& f) {
  return MapGCThingTyped(proto, [&f](auto t) { f(t); return true; }).isSome();
}

// Since JSObject pointers are either nullptr or a valid object and since the
// object layout of TaggedProto is identical to a bare object pointer, we can
// safely treat a pointer to an already-rooted object (e.g. HandleObject) as a
// pointer to a TaggedProto.
inline Handle<TaggedProto> AsTaggedProto(HandleObject obj) {
  static_assert(sizeof(JSObject*) == sizeof(TaggedProto),
                "TaggedProto must be binary compatible with JSObject");
  return Handle<TaggedProto>::fromMarkedLocation(
      reinterpret_cast<TaggedProto const*>(obj.address()));
}

}  // namespace js

#endif  // vm_TaggedProto_h
