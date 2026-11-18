package com.nouritsu.fasttrack;

import android.content.Context;
import android.content.res.Configuration;
import org.json.JSONObject;

/**
 * The stage colours for the status notification's bar. The web app saves the user's choice in
 * the settings as `"colors": {"glucose": "blue", ...}`, each a lowercase Catppuccin accent
 * name; a missing key or an unknown name gives the stage's default. The names resolve to
 * Mocha when the system is in dark mode and to Latte otherwise, with the hexes of src/app.css.
 */
final class FastColors {

    private static final String[] NAMES = {
        "rosewater", "flamingo", "pink", "mauve", "red", "maroon", "peach",
        "yellow", "green", "teal", "sky", "sapphire", "blue", "lavender",
    };
    // In the order of NAMES.
    private static final int[] MOCHA = {
        0xF5E0DC, 0xF2CDCD, 0xF5C2E7, 0xCBA6F7, 0xF38BA8, 0xEBA0AC, 0xFAB387,
        0xF9E2AF, 0xA6E3A1, 0x94E2D5, 0x89DCEB, 0x74C7EC, 0x89B4FA, 0xB4BEFE,
    };
    private static final int[] LATTE = {
        0xDC8A78, 0xDD7878, 0xEA76CB, 0x8839EF, 0xD20F39, 0xE64553, 0xFE640B,
        0xDF8E1D, 0x40A02B, 0x179299, 0x04A5E5, 0x209FB5, 0x1E66F5, 0x7287FD,
    };
    private static final int MOCHA_CRUST = 0x11111B;
    private static final int LATTE_BASE = 0xEFF1F5;

    // The keys of FastStatus.STAGES in the settings and their defaults, as --glucose to
    // --autophagy in src/app.css.
    private static final String[] KEYS = { "glucose", "fat", "ketosis", "autophagy" };
    private static final String[] DEFAULTS = { "blue", "peach", "red", "mauve" };

    private FastColors() {}

    /** The colour of each stage, as opaque ARGB, from the settings (null for none saved). */
    static int[] stages(Context context, JSONObject settings) {
        JSONObject colors = settings == null ? null : settings.optJSONObject("colors");
        int[] palette = dark(context) ? MOCHA : LATTE;
        int[] result = new int[KEYS.length];
        for (int i = 0; i < KEYS.length; i++) {
            String name = colors == null ? DEFAULTS[i] : colors.optString(KEYS[i], DEFAULTS[i]);
            int index = indexOf(name);
            if (index < 0) index = indexOf(DEFAULTS[i]);
            result[i] = 0xFF000000 | palette[index];
        }
        return result;
    }

    /** A colour that reads on the stage colours: Mocha's crust, or Latte's base. */
    static int onStage(Context context) {
        return 0xFF000000 | (dark(context) ? MOCHA_CRUST : LATTE_BASE);
    }

    /** Whether the system is in dark mode. */
    private static boolean dark(Context context) {
        int night = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return night == Configuration.UI_MODE_NIGHT_YES;
    }

    private static int indexOf(String name) {
        for (int i = 0; i < NAMES.length; i++) if (NAMES[i].equals(name)) return i;
        return -1;
    }
}
