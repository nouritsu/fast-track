// One short vibration for a positive outcome, a double one for a negative. The
// Vibration API works in Android's WebView; the manifest needs VIBRATE.
export function buzz(kind: 'ok' | 'bad'): void {
  navigator.vibrate?.(kind === 'ok' ? 30 : [30, 70, 30])
}

/** The faintest tick, once per step while scrubbing a value. */
export function tick(): void {
  navigator.vibrate?.(8)
}
