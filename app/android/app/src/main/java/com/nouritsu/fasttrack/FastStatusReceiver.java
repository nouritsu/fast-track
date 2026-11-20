package com.nouritsu.fasttrack;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * The app's alarms and the system events that move them: the status notification's next
 * change, its bar's refreshes and a swipe that dismissed it (FastStatus), a regular export
 * (FastExport), and a reboot, an app update or a clock change, which drop or shift them.
 */
public class FastStatusReceiver extends BroadcastReceiver {

    static final String REFRESH = "com.nouritsu.fasttrack.REFRESH_STATUS";
    static final String EXPORT = "com.nouritsu.fasttrack.RUN_EXPORT";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (EXPORT.equals(intent.getAction())) {
            FastExport.run(context);
            return;
        }
        FastStatus.update(context);
        if (!REFRESH.equals(intent.getAction())) FastExport.schedule(context);
    }

    /** Sets `alarm` for `at`: exact when Android allows it, else as close as its batching makes it. */
    static void setAlarm(Context context, long at, PendingIntent alarm) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
        if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm);
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm);
    }

    /**
     * Sets `alarm` for about `at` without waking the phone: if it is asleep then, the alarm
     * waits until it wakes. For a refresh that only matters while someone is looking.
     */
    static void setLazyAlarm(Context context, long at, PendingIntent alarm) {
        context.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC, at, alarm);
    }
}
