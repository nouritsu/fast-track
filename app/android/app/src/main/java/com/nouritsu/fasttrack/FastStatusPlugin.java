package com.nouritsu.fasttrack;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web app's handle on its Android side: it calls refresh() after saving a change, and
 * the status notification (FastStatus) and the regular exports' alarm (FastExport) follow.
 */
@CapacitorPlugin(name = "FastStatus")
public class FastStatusPlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        FastStatus.update(getContext());
        FastExport.schedule(getContext());
        call.resolve();
    }
}
