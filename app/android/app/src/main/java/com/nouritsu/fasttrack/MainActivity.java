package com.nouritsu.fasttrack;

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
     * Asks for the display's fastest refresh rate. With adaptive refresh rate (Android 15+)
     * the WebView draws at the "normal" rate, 60 Hz, so animations look slower than in a
     * browser. The window's explicit rate counts only while it is on screen and drawing.
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
