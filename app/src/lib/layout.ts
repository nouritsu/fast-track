// How the user lays the app out: the pages' order along the tabs, which of them show,
// and the one it opens on; the order of Stats' panes and which are put away. Plain
// functions over the settings, which store.ts checks with them.

export const PAGE_IDS = ['fast', 'calendar', 'stats', 'options', 'info'] as const
export type PageId = (typeof PAGE_IDS)[number]
export const PAGE_NAMES: Record<PageId, string> = { fast: 'Fast', calendar: 'Calendar', stats: 'Stats', options: 'Options', info: 'Info' }

/** Pages that always show: the fast itself, and the options that bring the others back. */
export const FIXED_PAGES: readonly PageId[] = ['fast', 'options']

/** Stats' panes below Summary, which always comes first: it holds the span. */
export const STATS_PANES = ['length', 'goal', 'stages', 'rhythm', 'weight', 'records'] as const
export type StatsPane = (typeof STATS_PANES)[number]
export const STATS_NAMES: Record<StatsPane, string> = {
  length: 'Length',
  goal: 'Goal',
  stages: 'Stages',
  rhythm: 'Rhythm',
  weight: 'Weight',
  records: 'Records',
}

/** `v` as an order of every one of `all`: the known ones in their saved order, then any
 *  it lacks (one a later version added) in their default place at the end. */
export function toOrder<T extends string>(v: unknown, all: readonly T[]): T[] {
  const saved = Array.isArray(v) ? v.filter((x, i): x is T => all.includes(x as T) && v.indexOf(x) === i) : []
  return [...saved, ...all.filter((x) => !saved.includes(x))]
}

/** `v` as a set of the ones in `allowed`, without repeats. */
export const toSubset = <T extends string>(v: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(v) ? allowed.filter((x) => v.includes(x)) : []

/** Moves `id` one place along `order`, towards the start for -1; at an end it stays. */
export function moveIn<T>(order: readonly T[], id: T, by: -1 | 1): T[] {
  const from = order.indexOf(id)
  const to = from + by
  if (from < 0 || to < 0 || to >= order.length) return [...order]
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** The pages along the tabs, in order, without the hidden ones. */
export const shownPages = (order: readonly PageId[], hidden: readonly PageId[]): PageId[] =>
  order.filter((id) => FIXED_PAGES.includes(id) || !hidden.includes(id))

/** The page the app opens on: the chosen one if it shows, else the first. */
export const startPageOf = (start: PageId, shown: readonly PageId[]): PageId => (shown.includes(start) ? start : shown[0])
