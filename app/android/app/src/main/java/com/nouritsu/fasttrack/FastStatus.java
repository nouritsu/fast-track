package com.nouritsu.fasttrack;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
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
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationCompat.ProgressStyle;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.Arrays;
import java.util.Date;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The status notification: an ongoing, silent notification that says whether a fast or an
 * eating window is running, and the fast's stage, with a live timer and a progress bar. Android
 * draws it in the system's own (Material You) colours, except the bar's stage segments.
 *
 * <p>It reads what the web app saves through Capacitor Preferences (the SharedPreferences file
 * "CapacitorStorage", keys "active", "fasts" and "settings"), so the app only has to say that
 * something changed. An alarm at the next change (a stage, the goal, the eating window's end)
 * rebuilds it while the app is closed, and a lazier one every few minutes moves the bar. The
 * stage boundaries mirror src/lib/fasting/stages.ts.
 *
 * <p>The bar is a {@link ProgressStyle}: Android 16 draws its coloured segments and icons
 * (https://developer.android.com/develop/ui/views/notifications/progress-centric), and older
 * versions get the plain progress bar the compat class falls back to. A fast's bar spans the
 * goal, and once past it the next whole 12 hours; the eating window's spans the window and drains.
 * Both ask Android 16 to promote them to a Live Update, a chip in the status bar that shows the
 * timer (https://developer.android.com/develop/ui/views/notifications/live-update).
 */
final class FastStatus {

    static final String CHANNEL = "status";
    static final int ID = 100; // apart from the stage alerts, ids 1 to 4
    static final String PREFS = "CapacitorStorage"; // what Capacitor Preferences saves
    private static final String TAG = "FastStatus";
    private static final long MINUTE = 60_000L;
    private static final long HOUR = 3_600_000L;
    private static final long EXTEND = 12 * HOUR; // how far past the goal the bar reaches, in steps
    private static final String[] STAGES = { "Glucose", "Fat burning", "Ketosis", "Autophagy" };
    private static final int[] STARTS = { 0, 4, 12, 24 }; // hours into the fast
    private static final int CHANGE = 0; // the request codes of the two alarms
    private static final int TICK = 2; // 1 is the export's

    private FastStatus() {}

    /** Shows the notification for the saved state, or removes it, and sets the next alarms. */
    static void update(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        cancelAlarms(context);
        JSONObject settings = parseObject(prefs.getString("settings", null));
        if (!enabled(settings) || !allowed(context)) {
            manager.cancel(ID);
            return;
        }
        createChannel(context);

        long now = System.currentTimeMillis();
        // The icon in the app's accent; the notification itself keeps the system's colours, as
        // a Live Update must (not colorized).
        NotificationCompat.Builder builder = builder(context).setColor(FastColors.accent(context, settings));
        long next; // when the notification next changes, or 0 for never
        int span = 0; // the bar's length in minutes, or 0 for no bar
        JSONObject active = parseObject(prefs.getString("active", null));
        if (active != null) {
            long start = active.optLong("start");
            double goal = active.optDouble("goal", 16);
            long goalAt = start + Math.round(goal * HOUR);
            boolean ahead = now < goalAt; // the goal is still to come
            int stage = stageAt((now - start) / (double) HOUR);
            long stageEnd = stage + 1 < STARTS.length ? start + STARTS[stage + 1] * HOUR : 0;
            // The bar spans the goal; past it, up to the next whole 12 hours, so the tracker keeps moving.
            long barEnd = ahead ? goalAt : start + ((now - start) / EXTEND + 1) * EXTEND;
            StringBuilder text = new StringBuilder(ahead ? "Goal " + time(context, goalAt) : "Goal reached");
            if (stageEnd > 0) text.append(" · ").append(STAGES[stage + 1]).append(' ').append(time(context, stageEnd));
            span = Math.max(1, minutes(barEnd - start));
            builder
                .setContentTitle("Fasting · " + STAGES[stage])
                .setContentText(text)
                // Time left to the goal, then time past it, which a Live Update's chip shows too.
                .setWhen(goalAt)
                .setUsesChronometer(true)
                .setChronometerCountDown(ahead)
                .setStyle(fastBar(context, settings, span, minutes(now - start), minutes(goalAt - start)));
            next = earliest(earliest(ahead ? goalAt : 0, stageEnd), ahead ? 0 : barEnd);
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
                span = Math.max(1, minutes(windowEnd - end));
                builder
                    .setContentTitle("Eating window")
                    .setContentText("Next fast " + time(context, windowEnd))
                    .setWhen(windowEnd)
                    .setUsesChronometer(true)
                    .setChronometerCountDown(true)
                    .setStyle(windowBar(context, settings, span, minutes(windowEnd - now)));
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

        // A fast and an eating window are in progress, which a closed window is not.
        builder.setRequestPromotedOngoing(span > 0);
        try {
            Notification notification = builder.build();
            if (span > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA && !notification.hasPromotableCharacteristics()) {
                Log.w(TAG, "Not eligible for a Live Update");
            }
            manager.notify(ID, notification);
        } catch (SecurityException e) {
            return; // permission withdrawn between the check and here
        }
        if (next > 0) FastStatusReceiver.setAlarm(context, next + 1000, alarmIntent(context, CHANGE)); // just past the change
        // The bar moves between changes; a change before the next tick rebuilds it anyway.
        long tick = span > 0 ? now + tickEvery(span) : 0;
        if (tick > 0 && (next == 0 || tick < next)) FastStatusReceiver.setLazyAlarm(context, tick, alarmIntent(context, TICK));
    }

    private static NotificationCompat.Builder builder(Context context) {
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent tap = PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        return new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(icon(context))
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

    /** The status-bar icon from app/notification.svg; Nix puts it in res/drawable-*. */
    private static int icon(Context context) {
        int icon = context.getResources().getIdentifier("ic_stat_fast", "drawable", context.getPackageName());
        return icon != 0 ? icon : context.getApplicationInfo().icon;
    }

    /**
     * A fast's bar over `span` minutes, drawn like the app's progress line: the time fasted, up
     * to `at` now, in the colours of the stages it went through, and the rest muted, broken
     * where each stage still ahead begins. A small diamond in the stage's colour marks now; a
     * timer opens the bar and a flag closes it, in the accent while the `goal` is the bar's end
     * and green once it is reached, the bar then broken at the goal too. All in minutes from the
     * start. Android draws its own points only as large squares, so the bar has none.
     */
    private static ProgressStyle fastBar(Context context, JSONObject settings, int span, int at, int goal) {
        int[] colors = FastColors.stages(context, settings);
        int accent = FastColors.accent(context, settings);
        int now = Math.max(0, Math.min(at, span));
        TreeSet<Integer> cuts = new TreeSet<>(Arrays.asList(now, span, goal));
        for (int start : STARTS) cuts.add(start * 60);
        ProgressStyle bar = bar(span, now)
            .setProgressTrackerIcon(icon(context, R.drawable.ic_bar_now, colors[stageAt(now / 60.0)]))
            .setProgressStartIcon(icon(context, R.drawable.ic_bar_fast, accent))
            .setProgressEndIcon(icon(context, R.drawable.ic_bar_goal, goal < span ? FastColors.named(context, "green") : accent));
        int from = 0;
        for (int to : cuts.subSet(0, false, span, true)) {
            int color = to <= now ? colors[stageAt(from / 60.0)] : FastColors.rest(context);
            bar.addProgressSegment(new ProgressStyle.Segment(to - from).setColor(color));
            from = to;
        }
        return bar;
    }

    /** The eating window's bar over `span` minutes: the `left` still to go in the accent, the
     *  rest muted, so it drains towards the next fast, from a fork and spoon to a timer. */
    private static ProgressStyle windowBar(Context context, JSONObject settings, int span, int left) {
        int accent = FastColors.accent(context, settings);
        int remaining = Math.max(0, Math.min(left, span));
        ProgressStyle bar = bar(span, remaining)
            .setProgressTrackerIcon(icon(context, R.drawable.ic_bar_now, accent))
            .setProgressStartIcon(icon(context, R.drawable.ic_bar_eat, accent))
            .setProgressEndIcon(icon(context, R.drawable.ic_bar_fast, accent));
        if (remaining > 0) bar.addProgressSegment(new ProgressStyle.Segment(remaining).setColor(accent));
        if (span > remaining) bar.addProgressSegment(new ProgressStyle.Segment(span - remaining).setColor(FastColors.rest(context)));
        return bar;
    }

    /**
     * A bar of `span` minutes at `at`, which shows in the segments' own colours, as the app's
     * line does: Android's fading of what lies ahead turned the pastel stage colours grey on the
     * shade. Below Android 16 it is a plain bar filled to `at`.
     */
    private static ProgressStyle bar(int span, int at) {
        return new ProgressStyle().setStyledByProgress(false).setProgress(at);
    }

    /** One of the bar's drawables (res/drawable/ic_bar_*.xml), in `color`. */
    private static IconCompat icon(Context context, int drawable, int color) {
        return IconCompat.createWithResource(context, drawable).setTint(color);
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Fast status", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Whether you are fasting or eating, and the fast's stage");
        channel.setShowBadge(false);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    /** The status notification is on unless the settings say otherwise. */
    private static boolean enabled(JSONObject settings) {
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

    /** The minutes in `millis`, the bar's unit. */
    private static int minutes(long millis) {
        return (int) Math.max(0, Math.round(millis / (double) MINUTE));
    }

    /** How often the bar is redrawn: every 2% of its `span` in minutes, but within 5 to 15 minutes. */
    private static long tickEvery(int span) {
        return Math.min(15, Math.max(5, span / 50)) * MINUTE;
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

    private static PendingIntent alarmIntent(Context context, int code) {
        Intent intent = new Intent(context, FastStatusReceiver.class).setAction(FastStatusReceiver.REFRESH);
        return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void cancelAlarms(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        alarms.cancel(alarmIntent(context, CHANGE));
        alarms.cancel(alarmIntent(context, TICK));
    }
}
