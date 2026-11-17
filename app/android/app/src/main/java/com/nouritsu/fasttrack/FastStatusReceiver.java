package com.nouritsu.fasttrack;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * The app's alarms and the system events that move them: the status notification's next
 * change (FastStatus), a regular export (FastExport), and a reboot, an app update or a
 * clock change, which drop or shift both.
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
}
