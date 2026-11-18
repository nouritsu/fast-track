package com.nouritsu.fasttrack;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.text.format.DateFormat;
import android.text.format.DateUtils;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Date;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The status notification: an ongoing, silent notification that says whether a fast or an
 * eating window is running, and the fast's stage, with a live timer. Android draws it in the
 * system's own (Material You) colours.
 *
 * <p>It reads what the web app saves through Capacitor Preferences (the SharedPreferences file
 * "CapacitorStorage", keys "active", "fasts" and "settings"), so the app only has to say that
 * something changed. An alarm at the next change (a stage, the goal, the eating window's end)
 * rebuilds it while the app is closed. The stage boundaries mirror src/lib/fasting/stages.ts.
 */
final class FastStatus {

    static final String CHANNEL = "status";
    static final int ID = 100; // apart from the stage alerts, ids 1 to 4
    private static final long HOUR = 3_600_000L;
    private static final String[] STAGES = { "Glucose", "Fat burning", "Ketosis", "Autophagy" };
    private static final int[] STARTS = { 0, 4, 12, 24 }; // hours into the fast

    private FastStatus() {}

    /** Shows the notification for the saved state, or removes it, and sets the next alarm. */
    static void update(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        cancelAlarm(context);
        if (!enabled(prefs) || !allowed(context)) {
            manager.cancel(ID);
            return;
        }
        createChannel(context);

        long now = System.currentTimeMillis();
        NotificationCompat.Builder builder = builder(context);
        long next; // when the notification next changes, or 0 for never
        JSONObject active = parseObject(prefs.getString("active", null));
        if (active != null) {
            long start = active.optLong("start");
            double goal = active.optDouble("goal", 16);
            long goalAt = start + Math.round(goal * HOUR);
            int stage = stageAt((now - start) / (double) HOUR);
            long stageEnd = stage + 1 < STARTS.length ? start + STARTS[stage + 1] * HOUR : 0;
            StringBuilder text = new StringBuilder(now < goalAt ? "Goal " + time(context, goalAt) : "Goal reached");
            if (stageEnd > 0) text.append(" · ").append(STAGES[stage + 1]).append(' ').append(time(context, stageEnd));
            builder
                .setContentTitle("Fasting · " + STAGES[stage])
                .setContentText(text)
                .setWhen(start)
                .setUsesChronometer(true);
            next = earliest(now < goalAt ? goalAt : 0, stageEnd);
        } else {
            JSONObject last = lastFast(prefs.getString("fasts", null));
            if (last == null) {
                manager.cancel(ID); // nothing to say before the first fast
                return;
            }
            long end = last.optLong("end");
            double goal = last.optDouble("goal", 16);
            long windowEnd = end + Math.round(Math.max(0, 24 - goal) * HOUR);
            if (now < windowEnd) {
                builder
                    .setContentTitle("Eating window")
                    .setContentText("Next fast " + time(context, windowEnd))
                    .setWhen(windowEnd)
                    .setUsesChronometer(true)
                    .setChronometerCountDown(true);
                next = windowEnd;
            } else {
                builder
                    .setContentTitle("Not fasting")
                    .setContentText("Eating window closed " + time(context, windowEnd))
                    .setWhen(windowEnd)
                    .setUsesChronometer(true);
                next = 0;
            }
        }

        try {
            manager.notify(ID, builder.build());
        } catch (SecurityException e) {
            return; // permission withdrawn between the check and here
        }
        if (next > 0) setAlarm(context, next + 1000); // just past the change
    }

    private static NotificationCompat.Builder builder(Context context) {
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent tap = PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        // The status-bar icon from app/notification.svg; Nix puts it in res/drawable-*.
        int icon = context.getResources().getIdentifier("ic_stat_fast", "drawable", context.getPackageName());
        return new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(icon != 0 ? icon : context.getApplicationInfo().icon)
            .setContentIntent(tap)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            // On the lock screen, the phone's setting decides whether its details show.
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Fast status", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Whether you are fasting or eating, and the fast's stage");
        channel.setShowBadge(false);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    /** The status notification is on unless the settings say otherwise. */
    private static boolean enabled(SharedPreferences prefs) {
        JSONObject settings = parseObject(prefs.getString("settings", null));
        return settings == null || settings.optBoolean("status", true);
    }

    private static boolean allowed(Context context) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false;
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    private static int stageAt(double hours) {
        int stage = 0;
        for (int i = 0; i < STARTS.length; i++) if (hours >= STARTS[i]) stage = i;
        return stage;
    }

    /** "19:39" today, else "Wed 19:39", in the phone's 12- or 24-hour format. */
    private static String time(Context context, long at) {
        String clock = DateFormat.getTimeFormat(context).format(new Date(at));
        if (DateUtils.isToday(at)) return clock;
        return DateFormat.format("EEE", at) + " " + clock;
    }

    private static long earliest(long a, long b) {
        if (a == 0) return b;
        if (b == 0) return a;
        return Math.min(a, b);
    }

    private static JSONObject lastFast(String json) {
        try {
            JSONArray fasts = new JSONArray(json);
            JSONObject last = null;
            for (int i = 0; i < fasts.length(); i++) {
                JSONObject fast = fasts.getJSONObject(i);
                if (last == null || fast.optLong("end") > last.optLong("end")) last = fast;
            }
            return last;
        } catch (Exception e) {
            return null;
        }
    }

    private static JSONObject parseObject(String json) {
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static PendingIntent alarmIntent(Context context) {
        Intent intent = new Intent(context, FastStatusReceiver.class).setAction(FastStatusReceiver.REFRESH);
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Exact when the system allows it, else as close as Android's batching makes it. */
    private static void setAlarm(Context context, long at) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
        if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent(context));
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent(context));
    }

    private static void cancelAlarm(Context context) {
        context.getSystemService(AlarmManager.class).cancel(alarmIntent(context));
    }
}
