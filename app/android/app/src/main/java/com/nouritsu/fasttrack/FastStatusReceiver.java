package com.nouritsu.fasttrack;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Rebuilds the status notification (FastStatus): at the alarm for its next change, after a
 * reboot or an app update (which drop alarms), and when the clock or time zone changes.
 */
public class FastStatusReceiver extends BroadcastReceiver {

    static final String REFRESH = "com.nouritsu.fasttrack.REFRESH_STATUS";

    @Override
    public void onReceive(Context context, Intent intent) {
        FastStatus.update(context);
    }
}
