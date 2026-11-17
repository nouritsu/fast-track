// The status notification on Android (FastStatus.java): it reads the saved state itself,
// so the app only tells it that something changed. In a browser there is none.

import { registerPlugin } from '@capacitor/core'

interface FastStatusPlugin {
  refresh(): Promise<void>
}

const FastStatus = registerPlugin<FastStatusPlugin>('FastStatus', {
  web: { refresh: async () => {} },
})

/** Rebuilds the status notification from what was just saved. */
export async function refreshStatus(): Promise<void> {
  try {
    await FastStatus.refresh()
  } catch {
    // No status notification on this platform: the app works without it.
  }
}
