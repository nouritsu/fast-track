package com.nouritsu.fasttrack;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The status notification and exports (FastStatus, FastExport), and weights from
        // openScale; registered before the bridge starts.
        registerPlugin(FastStatusPlugin.class);
        registerPlugin(OpenScalePlugin.class);
        super.onCreate(savedInstanceState);
        preferFastestRefreshRate();
    }

    /**
     * The status notification's stage colours follow day and night (FastColors), and a manifest
     * receiver can't hear of the switch (ACTION_CONFIGURATION_CHANGED goes only to registered
     * ones), so while the app is in memory this redraws it at once. Otherwise the next refresh does.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        FastStatus.update(this);
    }

    /**
     * Asks for the display's fastest refresh rate; with adaptive refresh rate the WebView
     * draws at 60 Hz: https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate
     */
    private void preferFastestRefreshRate() {
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? getDisplay()
                : getWindowManager().getDefaultDisplay();
        if (display == null) return;

        float fastest = 0;
        for (Display.Mode mode : display.getSupportedModes()) {
            fastest = Math.max(fastest, mode.getRefreshRate());
        }

        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        attributes.preferredRefreshRate = fastest;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            attributes.setFrameRatePowerSavingsBalanced(false);
        }
        getWindow().setAttributes(attributes);
    }
}
