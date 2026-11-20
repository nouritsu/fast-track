package com.nouritsu.fasttrack;

import android.content.ContentResolver;
import android.content.Context;
import android.provider.Settings;
import android.text.format.DateFormat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The phone's settings that Options' text size, motion, haptics and clock can follow when set to
 * System (src/lib/display.ts): the font scale, whether animations are on (Accessibility →
 * Remove animations sets the animator scale to 0), whether touch feedback is on, and whether
 * the phone keeps 24-hour time.
 */
@CapacitorPlugin(name = "SystemPrefs")
public class SystemPrefsPlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        Context context = getContext();
        ContentResolver resolver = context.getContentResolver();
        JSObject prefs = new JSObject();
        prefs.put("fontScale", context.getResources().getConfiguration().fontScale);
        prefs.put("animations", Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f);
        prefs.put("haptics", Settings.System.getInt(resolver, Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) != 0);
        prefs.put("clock24", DateFormat.is24HourFormat(context));
        call.resolve(prefs);
    }
}
