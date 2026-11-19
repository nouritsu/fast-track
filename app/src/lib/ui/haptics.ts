// One short vibration for a positive outcome, a double one for a negative. The
// Vibration API works in Android's WebView; the manifest needs VIBRATE. Options can
// turn it off, or leave it to the phone's touch feedback (display.ts).

let enabled = true

export function setHaptics(on: boolean): void {
  enabled = on
}

export function buzz(kind: 'ok' | 'bad'): void {
  if (enabled) navigator.vibrate?.(kind === 'ok' ? 30 : [30, 70, 30])
}

/** The faintest tick, once per step while scrubbing a value. */
export function tick(): void {
  if (enabled) navigator.vibrate?.(8)
}
