// Whether times of day read on a 12-hour clock ("8:49 PM") or a 24-hour one ("20:49"):
// Options' Clock, where System follows the phone (display.ts). State, so every time on
// screen is drawn again when it changes.

export const hours = $state({ twelve: false })

/** An hour of the day as the clock reads it: "08", or "8 AM". */
export const hourOf = (h: number): string => (hours.twelve ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : String(h).padStart(2, '0'))
