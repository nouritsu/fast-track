// The four stages of a fast, by hours since the last meal. The boundaries are the
// commonly cited ones; they vary with the person, the last meal and activity, and
// autophagy's timing in people is uncertain (most evidence is from animals).

export interface Stage {
  id: 'glucose' | 'fat' | 'ketosis' | 'autophagy' // also the stage's colour token, --<id>
  name: string // short, for status lines and the calendar
  term: string // the physiological name, for Info
  from: number // hours into the fast
  about: string // one line for Info
  alert: string // the notification's body when the stage begins
}

export const STAGES: readonly Stage[] = [
  {
    id: 'glucose',
    name: 'Glucose',
    term: 'Fed state',
    from: 0,
    about: "Your last meal's glucose is the main fuel; insulin is high.",
    alert: '',
  },
  {
    id: 'fat',
    name: 'Fat burning',
    term: 'Post-absorptive state',
    from: 4,
    about: 'Insulin falls; the liver draws on its glycogen and fat cells release fatty acids.',
    alert: '4 hours in: insulin is falling and fat is being released.',
  },
  {
    id: 'ketosis',
    name: 'Ketosis',
    term: 'Ketosis',
    from: 12,
    about: 'With glycogen low, the liver turns fat into ketones, a fuel for brain and muscle.',
    alert: '12 hours in: the liver is making ketones.',
  },
  {
    id: 'autophagy',
    name: 'Autophagy',
    term: 'Autophagy',
    from: 24,
    about: 'Cells step up recycling of worn-out parts; clear in animals, less certain in people.',
    alert: '24 hours in: cells are stepping up their recycling.',
  },
]

/** The widest stage name, so status lines can pad to it. */
export const NAME_WIDTH = Math.max(...STAGES.map((s) => s.name.length))

/** The index of the stage `hours` into a fast. */
export function stageIndex(hours: number): number {
  let index = 0
  STAGES.forEach((stage, i) => {
    if (hours >= stage.from) index = i
  })
  return index
}

/** When stage `i` ends, in hours, or Infinity for the last. */
export const stageEnd = (i: number): number => STAGES[i + 1]?.from ?? Infinity

/** "0–4h", "24h+". */
export function stageSpan(i: number): string {
  const end = stageEnd(i)
  return end === Infinity ? `${STAGES[i].from}h+` : `${STAGES[i].from}–${end}h`
}
