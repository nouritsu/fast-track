package com.nouritsu.fasttrack;

import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Weights from openScale (github.com/oliexdev/openScale), read through its content
 * provider, API version 3 (openScale 3.1): content://com.health.openscale.provider/users
 * lists its users (_ID, username); .../measurements/{user} their measurements (_ID,
 * datetime in epoch ms, values_json: an array of {identity, unit, value, ...} in canonical
 * units). The weight is the value whose identity is builtin.weight, in kg. Reading needs
 * openScale's READ_WRITE_DATA permission, which the user grants once.
 */
@CapacitorPlugin(
    name = "OpenScale",
    permissions = { @Permission(alias = OpenScalePlugin.ACCESS, strings = { OpenScalePlugin.PERMISSION }) }
)
public class OpenScalePlugin extends Plugin {

    static final String PACKAGE = "com.health.openscale";
    static final String PERMISSION = "com.health.openscale.READ_WRITE_DATA";
    static final String ACCESS = "openscale";
    private static final Uri PROVIDER = Uri.parse("content://com.health.openscale.provider");
    private static final String WEIGHT = "builtin.weight";
    private static final String TAG = "FastTrack/OpenScale";

    /** Whether openScale is installed and Fast Track may read it. */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    /** Asks for the permission if needed; resolves with the status after. */
    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (!installed() || getPermissionState(ACCESS) == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias(ACCESS, call, "accessAnswered");
    }

    @PermissionCallback
    private void accessAnswered(PluginCall call) {
        call.resolve(status());
    }

    /** openScale's users: { users: [{ id, name }] }. */
    @PluginMethod
    public void users(PluginCall call) {
        if (!readable(call)) return;
        JSArray users = new JSArray();
        try (Cursor cursor = getContext().getContentResolver().query(PROVIDER.buildUpon().appendPath("users").build(), null, null, null, null)) {
            if (cursor != null) {
                int id = cursor.getColumnIndex("_ID");
                int name = cursor.getColumnIndex("username");
                while (cursor.moveToNext()) {
                    JSObject user = new JSObject();
                    user.put("id", cursor.getLong(id));
                    user.put("name", name >= 0 ? cursor.getString(name) : "");
                    users.put(user);
                }
            }
            Log.i(TAG, "users: " + (cursor == null ? "no answer" : users.length()));
        } catch (Exception e) {
            Log.w(TAG, "users failed", e);
            call.reject("openScale did not answer: " + e.getMessage());
            return;
        }
        JSObject result = new JSObject();
        result.put("users", users);
        call.resolve(result);
    }

    /** One user's weights: { weights: [{ at, kg }], rows, seen }, with how many measurements
     *  openScale returned and the value identities it carried, to tell why none were weights. */
    @PluginMethod
    public void weights(PluginCall call) {
        if (!readable(call)) return;
        // Read as any number: a small one comes over from the web as an Integer, which
        // PluginCall.getLong turns into null.
        if (!call.getData().has("userId")) {
            call.reject("userId is missing");
            return;
        }
        long user = call.getData().optLong("userId");
        Uri uri = PROVIDER.buildUpon().appendPath("measurements").appendPath(String.valueOf(user)).build();
        JSArray weights = new JSArray();
        java.util.Set<String> seen = new java.util.TreeSet<>();
        int rows = -1; // -1: openScale did not answer
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { "_ID", "datetime", "values_json" }, null, null, null)) {
            if (cursor != null) {
                rows = cursor.getCount();
                int at = cursor.getColumnIndex("datetime");
                int values = cursor.getColumnIndex("values_json");
                while (cursor.moveToNext()) {
                    String json = cursor.getString(values);
                    if (seen.size() < 12) identities(json, seen);
                    Double kg = weightOf(json);
                    if (kg == null) continue;
                    JSObject weight = new JSObject();
                    weight.put("at", cursor.getLong(at));
                    weight.put("kg", kg);
                    weights.put(weight);
                }
            }
            Log.i(TAG, "measurements for user " + user + ": " + rows + " rows, " + weights.length() + " weights, values " + seen);
        } catch (Exception e) {
            Log.w(TAG, "measurements failed for user " + user, e);
            call.reject("openScale did not answer: " + e.getMessage());
            return;
        }
        JSObject result = new JSObject();
        result.put("weights", weights);
        result.put("rows", rows);
        result.put("seen", new JSArray(seen));
        call.resolve(result);
    }

    /** The identities of a measurement's values, for the report when none is a weight. */
    private static void identities(String json, java.util.Set<String> into) {
        if (json == null) return;
        try {
            JSONArray values = new JSONArray(json);
            for (int i = 0; i < values.length(); i++) into.add(values.getJSONObject(i).optString("identity", "?"));
        } catch (Exception e) {
            into.add("unreadable values_json");
        }
    }

    private static Double weightOf(String json) {
        if (json == null) return null;
        try {
            JSONArray values = new JSONArray(json);
            for (int i = 0; i < values.length(); i++) {
                JSONObject value = values.getJSONObject(i);
                if (WEIGHT.equals(value.optString("identity")) && value.has("value")) return value.getDouble("value");
            }
        } catch (Exception e) {
            // a measurement this version cannot read: skipped
        }
        return null;
    }

    private boolean readable(PluginCall call) {
        if (!installed()) {
            call.reject("openScale is not installed");
            return false;
        }
        if (getPermissionState(ACCESS) != PermissionState.GRANTED) {
            call.reject("Fast Track may not read openScale yet");
            return false;
        }
        return true;
    }

    private boolean installed() {
        try {
            getContext().getPackageManager().getPackageInfo(PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private JSObject status() {
        JSObject status = new JSObject();
        status.put("installed", installed());
        status.put("granted", installed() && getPermissionState(ACCESS) == PermissionState.GRANTED);
        return status;
    }
}
