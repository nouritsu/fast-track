package com.nouritsu.fasttrack;

import android.content.Context;
import android.content.res.Configuration;
import org.json.JSONObject;

/**
 * The colours of the status notification's bar. The web app saves the user's choice in the
 * settings as `"colors": {"accent": "mauve", "glucose": "blue", ...}`, each a lowercase
 * Catppuccin accent name; a missing key or an unknown name gives its default. The names resolve
 * to Mocha when the system is in dark mode and to Latte otherwise, with the hexes of
 * src/app.css.
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
    // Overlay 0, what the app draws muted lines in: the part of a bar still to come.
    private static final int MOCHA_REST = 0x6C7086;
    private static final int LATTE_REST = 0x9CA0B0;

    // The keys of FastStatus.STAGES in the settings and their defaults, as --glucose to
    // --autophagy in src/app.css.
    private static final String[] KEYS = { "glucose", "fat", "ketosis", "autophagy" };
    private static final String[] DEFAULTS = { "blue", "peach", "red", "mauve" };

    private FastColors() {}

    /** The colour of each stage, as opaque ARGB, from the settings (null for none saved). */
    static int[] stages(Context context, JSONObject settings) {
        int[] result = new int[KEYS.length];
        for (int i = 0; i < KEYS.length; i++) result[i] = pick(context, settings, KEYS[i], DEFAULTS[i]);
        return result;
    }

    /** The app's accent. */
    static int accent(Context context, JSONObject settings) {
        return pick(context, settings, "accent", "mauve");
    }

    /** A muted colour for the part of a bar still to come. */
    static int rest(Context context) {
        return 0xFF000000 | (dark(context) ? MOCHA_REST : LATTE_REST);
    }

    private static int pick(Context context, JSONObject settings, String key, String fallback) {
        JSONObject colors = settings == null ? null : settings.optJSONObject("colors");
        int index = indexOf(colors == null ? fallback : colors.optString(key, fallback));
        if (index < 0) index = indexOf(fallback);
        return 0xFF000000 | (dark(context) ? MOCHA : LATTE)[index];
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
