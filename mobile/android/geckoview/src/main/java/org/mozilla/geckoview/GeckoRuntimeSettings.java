/* -*- Mode: Java; c-basic-offset: 4; tab-width: 20; indent-tabs-mode: nil; -*-
 * vim: ts=4 sw=4 expandtab:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.geckoview;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

import android.app.Service;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Parcel;
import android.os.Parcelable;
import android.support.annotation.AnyThread;
import android.support.annotation.IntDef;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;

import org.mozilla.gecko.EventDispatcher;
import org.mozilla.gecko.util.GeckoBundle;

@AnyThread
public final class GeckoRuntimeSettings extends RuntimeSettings {
    /**
     * Settings builder used to construct the settings object.
     */
    @AnyThread
    public static final class Builder
            extends RuntimeSettings.Builder<GeckoRuntimeSettings> {
        @Override
        protected @NonNull GeckoRuntimeSettings newSettings(
                final GeckoRuntimeSettings settings) {
            return new GeckoRuntimeSettings(settings);
        }

        /**
         * Set the content process hint flag.
         *
         * @param use If true, this will reload the content process for future use.
         *            Default is false.
         * @return This Builder instance.

         */
        public @NonNull Builder useContentProcessHint(final boolean use) {
            getSettings().mUseContentProcess = use;
            return this;
        }

        /**
         * Set the custom Gecko process arguments.
         *
         * @param args The Gecko process arguments.
         * @return This Builder instance.
         */
        public @NonNull Builder arguments(final @NonNull String[] args) {
            if (args == null) {
                throw new IllegalArgumentException("Arguments must not  be null");
            }
            getSettings().mArgs = args;
            return this;
        }

        /**
         * Set the custom Gecko intent extras.
         *
         * @param extras The Gecko intent extras.
         * @return This Builder instance.
         */
        public @NonNull Builder extras(final @NonNull Bundle extras) {
            if (extras == null) {
                throw new IllegalArgumentException("Extras must not  be null");
            }
            getSettings().mExtras = extras;
            return this;
        }

        /**
         * Set whether JavaScript support should be enabled.
         *
         * @param flag A flag determining whether JavaScript should be enabled.
         *             Default is true.
         * @return This Builder instance.
         */
        public @NonNull Builder javaScriptEnabled(final boolean flag) {
            getSettings().mJavaScript.set(flag);
            return this;
        }

        /**
         * Set whether remote debugging support should be enabled.
         *
         * @param enabled True if remote debugging should be enabled.
         * @return This Builder instance.
         */
        public @NonNull Builder remoteDebuggingEnabled(final boolean enabled) {
            getSettings().mRemoteDebugging.set(enabled);
            return this;
        }

        /**
         * Set whether support for web fonts should be enabled.
         *
         * @param flag A flag determining whether web fonts should be enabled.
         *             Default is true.
         * @return This Builder instance.
         */
        public @NonNull Builder webFontsEnabled(final boolean flag) {
            getSettings().mWebFonts.set(flag ? 1 : 0);
            return this;
        }

        /**
         * Set whether there should be a pause during startup. This is useful if you need to
         * wait for a debugger to attach.
         *
         * @param enabled A flag determining whether there will be a pause early in startup.
         *                Defaults to false.
         * @return This Builder.
         */
        public @NonNull Builder pauseForDebugger(boolean enabled) {
            getSettings().mDebugPause = enabled;
            return this;
        }
        /**
         * Set whether the to report the full bit depth of the device.
         *
         * By default, 24 bits are reported for high memory devices and 16 bits
         * for low memory devices. If set to true, the device's maximum bit depth is
         * reported. On most modern devices this will be 32 bit screen depth.
         *
         * @param enable A flag determining whether maximum screen depth should be used.
         * @return This Builder.
         */
        public @NonNull Builder useMaxScreenDepth(boolean enable) {
            getSettings().mUseMaxScreenDepth = enable;
            return this;
        }

        /**
         * Set whether or not web console messages should go to logcat.
         *
         * Note: If enabled, Gecko performance may be negatively impacted if
         * content makes heavy use of the console API.
         *
         * @param enabled A flag determining whether or not web console messages should be
         *                printed to logcat.
         * @return The builder instance.
         */
        public @NonNull Builder consoleOutput(boolean enabled) {
            getSettings().mConsoleOutput.set(enabled);
            return this;
        }

        /**
         * Set the display density override.
         *
         * @param density The display density value to use for overriding the system default.
         * @return The builder instance.
         */
        public @NonNull Builder displayDensityOverride(float density) {
            getSettings().mDisplayDensityOverride = density;
            return this;
        }

        /**
         * Set the display DPI override.
         *
         * @param dpi The display DPI value to use for overriding the system default.
         * @return The builder instance.
         */
        public @NonNull Builder displayDpiOverride(int dpi) {
            getSettings().mDisplayDpiOverride = dpi;
            return this;
        }

        /**
         * Set the screen size override.
         *
         * @param width The screen width value to use for overriding the system default.
         * @param height The screen height value to use for overriding the system default.
         * @return The builder instance.
         */
        public @NonNull Builder screenSizeOverride(int width, int height) {
            getSettings().mScreenWidthOverride = width;
            getSettings().mScreenHeightOverride = height;
            return this;
        }

        /**
         * When set, the specified {@link android.app.Service} will be started by
         * an {@link android.content.Intent} with action {@link GeckoRuntime#ACTION_CRASHED} when
         * a crash is encountered. Crash details can be found in the Intent extras, such as
         * {@link GeckoRuntime#EXTRA_MINIDUMP_PATH}.
         * <br><br>
         * The crash handler Service must be declared to run in a different process from
         * the {@link GeckoRuntime}. Additionally, the handler will be run as a foreground service,
         * so the normal rules about activating a foreground service apply.
         * <br><br>
         * In practice, you have one of three
         * options once the crash handler is started:
         * <ul>
         * <li>Call {@link android.app.Service#startForeground(int, android.app.Notification)}. You can then
         * take as much time as necessary to report the crash.</li>
         * <li>Start an activity. Unless you also call {@link android.app.Service#startForeground(int, android.app.Notification)}
         * this should be in a different process from the crash handler, since Android will
         * kill the crash handler process as part of the background execution limitations.</li>
         * <li>Schedule work via {@link android.app.job.JobScheduler}. This will allow you to
         * do substantial work in the background without execution limits.</li>
         * </ul><br>
         * You can use {@link CrashReporter} to send the report to Mozilla, which provides Mozilla
         * with data needed to fix the crash. Be aware that the minidump may contain
         * personally identifiable information (PII). Consult Mozilla's
         * <a href="https://www.mozilla.org/en-US/privacy/">privacy policy</a> for information
         * on how this data will be handled.
         *
         * @param handler The class for the crash handler Service.
         * @return This builder instance.
         *
         * @see <a href="https://developer.android.com/about/versions/oreo/background">Android Background Execution Limits</a>
         * @see GeckoRuntime#ACTION_CRASHED
         */
        public @NonNull Builder crashHandler(final Class<? extends Service> handler) {
            getSettings().mCrashHandler = handler;
            return this;
        }

        /**
         * Set the locale.
         *
         * @param requestedLocales List of locale codes in Gecko format ("en" or "en-US").
         * @return The builder instance.
         */
        public @NonNull Builder locales(String[] requestedLocales) {
            getSettings().mRequestedLocales = requestedLocales;
            return this;
        }

        public @NonNull Builder contentBlocking(
                final @NonNull ContentBlocking.Settings cb) {
            getSettings().mContentBlocking = cb;
            return this;
        }
    }

    private GeckoRuntime mRuntime;
    /* package */ boolean mUseContentProcess;
    /* package */ String[] mArgs;
    /* package */ Bundle mExtras;

    /* package */ ContentBlocking.Settings mContentBlocking;

    public @NonNull ContentBlocking.Settings getContentBlocking() {
        return mContentBlocking;
    }

    /* package */ final Pref<Boolean> mJavaScript = new Pref<Boolean>(
        "javascript.enabled", true);
    /* package */ final Pref<Boolean> mRemoteDebugging = new Pref<Boolean>(
        "devtools.debugger.remote-enabled", false);
    /* package */ final Pref<Integer> mWebFonts = new Pref<Integer>(
        "browser.display.use_document_fonts", 1);
    /* package */ final Pref<Boolean> mConsoleOutput = new Pref<Boolean>(
        "geckoview.console.enabled", false);

    /* package */ boolean mDebugPause;
    /* package */ boolean mUseMaxScreenDepth;
    /* package */ float mDisplayDensityOverride = -1.0f;
    /* package */ int mDisplayDpiOverride;
    /* package */ int mScreenWidthOverride;
    /* package */ int mScreenHeightOverride;
    /* package */ Class<? extends Service> mCrashHandler;
    /* package */ String[] mRequestedLocales;

    /**
     * Attach and commit the settings to the given runtime.
     * @param runtime The runtime to attach to.
     */
    /* package */ void attachTo(final @NonNull GeckoRuntime runtime) {
        mRuntime = runtime;
        commit();
    }

    @Override // RuntimeSettings
    public @Nullable GeckoRuntime getRuntime() {
        return mRuntime;
    }

    /* package */ GeckoRuntimeSettings() {
        this(null);
    }

    /* package */ GeckoRuntimeSettings(final @Nullable GeckoRuntimeSettings settings) {
        super(/* parent */ null);

        if (settings == null) {
            mArgs = new String[0];
            mExtras = new Bundle();
            mContentBlocking = new ContentBlocking.Settings(
                    this /* parent */, null /* settings */);
            return;
        }

        updateSettings(settings);
    }

    private void updateSettings(final @NonNull GeckoRuntimeSettings settings) {
        updatePrefs(settings);

        mUseContentProcess = settings.getUseContentProcessHint();
        mArgs = settings.getArguments().clone();
        mExtras = new Bundle(settings.getExtras());
        mContentBlocking = new ContentBlocking.Settings(
                this /* parent */, settings.mContentBlocking);

        mDebugPause = settings.mDebugPause;
        mUseMaxScreenDepth = settings.mUseMaxScreenDepth;
        mDisplayDensityOverride = settings.mDisplayDensityOverride;
        mDisplayDpiOverride = settings.mDisplayDpiOverride;
        mScreenWidthOverride = settings.mScreenWidthOverride;
        mScreenHeightOverride = settings.mScreenHeightOverride;
        mCrashHandler = settings.mCrashHandler;
        mRequestedLocales = settings.mRequestedLocales;
    }

    /* package */ void commit() {
        commitLocales();
        commitResetPrefs();
    }

    /**
     * Get the content process hint flag.
     *
     * @return The content process hint flag.
     */
    public boolean getUseContentProcessHint() {
        return mUseContentProcess;
    }

    /**
     * Get the custom Gecko process arguments.
     *
     * @return The Gecko process arguments.
     */
    public @NonNull String[] getArguments() {
        return mArgs;
    }

    /**
     * Get the custom Gecko intent extras.
     *
     * @return The Gecko intent extras.
     */
    public @NonNull Bundle getExtras() {
        return mExtras;
    }

    /**
     * Get whether JavaScript support is enabled.
     *
     * @return Whether JavaScript support is enabled.
     */
    public boolean getJavaScriptEnabled() {
        return mJavaScript.get();
    }

    /**
     * Set whether JavaScript support should be enabled.
     *
     * @param flag A flag determining whether JavaScript should be enabled.
     * @return This GeckoRuntimeSettings instance.
     */
    public @NonNull GeckoRuntimeSettings setJavaScriptEnabled(final boolean flag) {
        mJavaScript.commit(flag);
        return this;
    }

    /**
     * Get whether remote debugging support is enabled.
     *
     * @return True if remote debugging support is enabled.
     */
    public boolean getRemoteDebuggingEnabled() {
        return mRemoteDebugging.get();
    }

    /**
     * Set whether remote debugging support should be enabled.
     *
     * @param enabled True if remote debugging should be enabled.
     * @return This GeckoRuntimeSettings instance.
     */
    public @NonNull GeckoRuntimeSettings setRemoteDebuggingEnabled(final boolean enabled) {
        mRemoteDebugging.commit(enabled);
        return this;
    }

    /**
     * Get whether web fonts support is enabled.
     *
     * @return Whether web fonts support is enabled.
     */
    public boolean getWebFontsEnabled() {
        return mWebFonts.get() != 0 ? true : false;
    }

    /**
     * Set whether support for web fonts should be enabled.
     *
     * @param flag A flag determining whether web fonts should be enabled.
     * @return This GeckoRuntimeSettings instance.
     */
    public @NonNull GeckoRuntimeSettings setWebFontsEnabled(final boolean flag) {
        mWebFonts.commit(flag ? 1 : 0);
        return this;
    }

    /**
     * Gets whether the pause-for-debugger is enabled or not.
     *
     * @return True if the pause is enabled.
     */
    public boolean getPauseForDebuggerEnabled() { return mDebugPause; }

    /**
     * Gets whether the compositor should use the maximum screen depth when rendering.
     *
     * @return True if the maximum screen depth should be used.
     */
    public boolean getUseMaxScreenDepth() { return mUseMaxScreenDepth; }

    /**
     * Gets the display density override value.
     *
     * @return Returns a positive number. Will return null if not set.
     */
    public @Nullable Float getDisplayDensityOverride() {
        if (mDisplayDensityOverride > 0.0f) {
            return mDisplayDensityOverride;
        }
        return null;
    }

    /**
     * Gets the display DPI override value.
     *
     * @return Returns a positive number. Will return null if not set.
     */
    public @Nullable Integer getDisplayDpiOverride() {
        if (mDisplayDpiOverride > 0) {
            return mDisplayDpiOverride;
        }
        return null;
    }

    public @Nullable Class<? extends Service> getCrashHandler() {
        return mCrashHandler;
    }

    /**
     * Gets the screen size  override value.
     *
     * @return Returns a Rect containing the dimensions to use for the window size.
     * Will return null if not set.
     */
    public @Nullable Rect getScreenSizeOverride() {
        if ((mScreenWidthOverride > 0) && (mScreenHeightOverride > 0)) {
            return new Rect(0, 0, mScreenWidthOverride, mScreenHeightOverride);
        }
        return null;
    }

    /**
     * Gets the list of requested locales.
     *
     * @return A list of locale codes in Gecko format ("en" or "en-US").
     */
    public @Nullable String[] getLocales() {
        return mRequestedLocales;
    }

    /**
     * Set the locale.
     *
     * @param requestedLocales An ordered list of locales in Gecko format ("en-US").
     */
    public void setLocales(@Nullable String[] requestedLocales) {
        mRequestedLocales = requestedLocales;
        commitLocales();
    }

    private void commitLocales() {
        if (mRequestedLocales == null) {
            return;
        }
        final GeckoBundle data = new GeckoBundle(1);
        data.putStringArray("requestedLocales", mRequestedLocales);
        EventDispatcher.getInstance().dispatch("GeckoView:SetLocale", data);
    }

    /**
     * Set whether or not web console messages should go to logcat.
     *
     * Note: If enabled, Gecko performance may be negatively impacted if
     * content makes heavy use of the console API.
     *
     * @param enabled A flag determining whether or not web console messages should be
     *                printed to logcat.
     * @return This GeckoRuntimeSettings instance.
     */

    public @NonNull GeckoRuntimeSettings setConsoleOutputEnabled(boolean enabled) {
        mConsoleOutput.commit(enabled);
        return this;
    }

    /**
     * Get whether or not web console messages are sent to logcat.
     *
     * @return True if console output is enabled.
     */
    public boolean getConsoleOutputEnabled() {
        return mConsoleOutput.get();
    }

    @Override // Parcelable
    public void writeToParcel(Parcel out, int flags) {
        super.writeToParcel(out, flags);

        ParcelableUtils.writeBoolean(out, mUseContentProcess);
        out.writeStringArray(mArgs);
        mExtras.writeToParcel(out, flags);
        ParcelableUtils.writeBoolean(out, mDebugPause);
        ParcelableUtils.writeBoolean(out, mUseMaxScreenDepth);
        out.writeFloat(mDisplayDensityOverride);
        out.writeInt(mDisplayDpiOverride);
        out.writeInt(mScreenWidthOverride);
        out.writeInt(mScreenHeightOverride);
        out.writeString(mCrashHandler != null ? mCrashHandler.getName() : null);
        out.writeStringArray(mRequestedLocales);
    }

    // AIDL code may call readFromParcel even though it's not part of Parcelable.
    public void readFromParcel(final @NonNull Parcel source) {
        super.readFromParcel(source);

        mUseContentProcess = ParcelableUtils.readBoolean(source);
        mArgs = source.createStringArray();
        mExtras.readFromParcel(source);
        mDebugPause = ParcelableUtils.readBoolean(source);
        mUseMaxScreenDepth = ParcelableUtils.readBoolean(source);
        mDisplayDensityOverride = source.readFloat();
        mDisplayDpiOverride = source.readInt();
        mScreenWidthOverride = source.readInt();
        mScreenHeightOverride = source.readInt();

        final String crashHandlerName = source.readString();
        if (crashHandlerName != null) {
            try {
                @SuppressWarnings("unchecked")
                final Class<? extends Service> handler =
                        (Class<? extends Service>) Class.forName(crashHandlerName);

                mCrashHandler = handler;
            } catch (ClassNotFoundException e) {
            }
        }

        mRequestedLocales = source.createStringArray();
    }

    public static final Parcelable.Creator<GeckoRuntimeSettings> CREATOR
        = new Parcelable.Creator<GeckoRuntimeSettings>() {
        @Override
        public GeckoRuntimeSettings createFromParcel(final Parcel in) {
            final GeckoRuntimeSettings settings = new GeckoRuntimeSettings();
            settings.readFromParcel(in);
            return settings;
        }

        @Override
        public GeckoRuntimeSettings[] newArray(final int size) {
            return new GeckoRuntimeSettings[size];
        }
    };
}
