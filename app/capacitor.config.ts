import type { CapacitorConfig } from '@capacitor/cli'

// The Android app: the Vite build in a WebView, served from https://localhost/.
// nix/apk.nix copies it in before Gradle runs.
const config: CapacitorConfig = {
  appId: 'com.nouritsu.fasttrack', // never changes: another id is another app, with empty storage
  appName: 'Fast Track',
  webDir: 'dist',
  // Catppuccin Mocha's base, behind the WebView until the page paints.
  backgroundColor: '#1e1e2e',
  plugins: {
    // The page draws under the status and navigation bars and pads itself by
    // --safe-area-inset-*; src/lib/theme.ts sets the bars' icon colour.
    SystemBars: { insetsHandling: 'css' },
    // Stage alerts: the status-bar icon from app/notification.svg (nix/app-assets.nix), tinted mauve.
    LocalNotifications: { smallIcon: 'ic_stat_fast', iconColor: '#cba6f7' },
  },
}

export default config
