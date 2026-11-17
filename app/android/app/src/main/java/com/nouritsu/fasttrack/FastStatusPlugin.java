package com.nouritsu.fasttrack;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The web app's handle on the status notification: it calls refresh() after saving a change. */
@CapacitorPlugin(name = "FastStatus")
public class FastStatusPlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        FastStatus.update(getContext());
        call.resolve();
    }
}
