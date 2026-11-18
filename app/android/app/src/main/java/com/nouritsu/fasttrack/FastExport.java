package com.nouritsu.fasttrack;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Environment;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Regular exports: at each run time the web app planned (src/lib/fasting/autoexport.ts,
 * saved as "exportPlan" in CapacitorStorage), writes a backup like the app's own export
 * (src/lib/fasting/backup.ts) to Documents/FastTrack/, records how it went as
 * "autoExport", and sets an alarm for the next run. It makes a file a day, or with the
 * app's keepOneFile setting one file that each run replaces.
 */
final class FastExport {

    static final String FOLDER = "FastTrack";

    private FastExport() {}

    /** Sets the alarm for the next planned run after now, or none. */
    static void schedule(Context context) {
        SharedPreferences prefs = prefs(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        alarms.cancel(intent(context));
        long next = nextRun(prefs.getString("exportPlan", null), System.currentTimeMillis());
        if (next > 0) FastStatusReceiver.setAlarm(context, next, intent(context));
    }

    /** Writes the backup now, records the result, and schedules the next run. */
    static void run(Context context) {
        SharedPreferences prefs = prefs(context);
        JSONObject result = new JSONObject();
        try {
            result.put("at", iso(new Date()));
            File file = write(backup(prefs), keepOneFile(prefs));
            result.put("path", "Documents/" + FOLDER + "/" + file.getName());
        } catch (Exception e) {
            try {
                result.put("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            } catch (Exception ignored) {
                // JSONObject.put only fails on a null key
            }
        }
        prefs.edit().putString("autoExport", result.toString()).apply();
        schedule(context);
    }

    /** The same shape as the app's export, so its Import reads it. */
    private static String backup(SharedPreferences prefs) throws Exception {
        JSONObject backup = new JSONObject();
        backup.put("format", "fast-track-backup");
        backup.put("version", 1);
        backup.put("exported_at", iso(new Date()));
        String settings = prefs.getString("settings", null);
        backup.put("settings", settings != null ? new JSONObject(settings) : new JSONObject());
        String fasts = prefs.getString("fasts", null);
        backup.put("fasts", fasts != null ? new JSONArray(fasts) : new JSONArray());
        return backup.toString(1);
    }

    /** Whether the app's settings say to keep one file; no when they cannot be read. */
    private static boolean keepOneFile(SharedPreferences prefs) {
        try {
            String settings = prefs.getString("settings", null);
            return settings != null && new JSONObject(settings).optBoolean("keepOneFile", false);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * One file a day, fast-track-YYYY-MM-DD.json, which a later run that day replaces; or
     * with keepOne fast-track.json, which every run replaces.
     */
    private static File write(String json, boolean keepOne) throws Exception {
        File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), FOLDER);
        if (!folder.isDirectory() && !folder.mkdirs()) throw new Exception("cannot create " + folder);
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
        File file = new File(folder, keepOne ? "fast-track.json" : "fast-track-" + day + ".json");
        try (Writer out = new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8)) {
            out.write(json);
        } catch (FileNotFoundException e) {
            // Android 11 and newer let only the app that made a file replace it, so one an
            // earlier install left cannot be written over.
            if (file.exists() && String.valueOf(e.getMessage()).contains("EACCES")) {
                throw new Exception("cannot replace Documents/" + FOLDER + "/" + file.getName() + ", which an earlier install left; delete it in a file manager");
            }
            throw e;
        }
        return file;
    }

    private static long nextRun(String plan, long now) {
        if (plan == null) return 0;
        try {
            JSONArray runs = new JSONObject(plan).getJSONArray("runs");
            for (int i = 0; i < runs.length(); i++) {
                long at = runs.getLong(i);
                if (at > now) return at;
            }
        } catch (Exception e) {
            // a plan the app will rewrite when it next opens
        }
        return 0;
    }

    private static String iso(Date at) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(at);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(FastStatus.PREFS, Context.MODE_PRIVATE);
    }

    private static PendingIntent intent(Context context) {
        Intent intent = new Intent(context, FastStatusReceiver.class).setAction(FastStatusReceiver.EXPORT);
        return PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
