// The four stages of a fast, by hours since the last meal. The boundaries are the
// commonly cited ones; they vary with the person, the last meal and activity, and
// autophagy's timing in people is uncertain (most evidence is from animals).

/** A paper or reference chapter about a stage, checked against its PubMed or NCBI
 *  Bookshelf record. */
export interface Source {
  title: string
  who: string // the authors, short
  where: string // journal or book, and year
  url: string // its PubMed or NCBI Bookshelf page
  note?: string // a caveat, as "in mice"
}

const pubmed = (pmid: number) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
const bookshelf = (id: string) => `https://www.ncbi.nlm.nih.gov/books/${id}/`

export interface Stage {
  id: 'glucose' | 'fat' | 'ketosis' | 'autophagy' // also the stage's colour token, --<id>
  name: string // short, for status lines and the calendar
  term: string // the physiological name, for Info
  from: number // hours into the fast
  about: string // one line for Info
  alert: string // the notification's body when the stage begins
  sources: Source[] // further reading, in Info
}

export const STAGES: readonly Stage[] = [
  {
    id: 'glucose',
    name: 'Glucose',
    term: 'Fed state',
    from: 0,
    about: "Your last meal's glucose is the main fuel; insulin is high.",
    alert: '',
    sources: [
      {
        title: 'Physiology, Glucose Metabolism',
        who: 'Nakrani, Wineland, Anjum',
        where: 'StatPearls, NCBI Bookshelf',
        url: bookshelf('NBK560599'),
      },
      {
        title: 'Physiology, Fasting',
        who: 'Sanvictores, Casale, Huecker',
        where: 'StatPearls, NCBI Bookshelf',
        url: bookshelf('NBK534877'),
      },
    ],
  },
  {
    id: 'fat',
    name: 'Fat burning',
    term: 'Post-absorptive state',
    from: 4,
    about: 'Insulin falls; the liver draws on its glycogen and fat cells release fatty acids.',
    alert: '4 hours in: insulin is falling and fat is being released.',
    sources: [
      {
        title: 'Fuel metabolism in starvation',
        who: 'Cahill',
        where: 'Annual Review of Nutrition, 2006',
        url: pubmed(16848698),
      },
      {
        title: 'Fasting: molecular mechanisms and clinical applications',
        who: 'Longo, Mattson',
        where: 'Cell Metabolism, 2014',
        url: pubmed(24440038),
      },
    ],
  },
  {
    id: 'ketosis',
    name: 'Ketosis',
    term: 'Ketosis',
    from: 12,
    about: 'With glycogen low, the liver turns fat into ketones, a fuel for brain and muscle.',
    alert: '12 hours in: the liver is making ketones.',
    sources: [
      {
        title: 'Flipping the metabolic switch: understanding and applying the health benefits of fasting',
        who: 'Anton et al.',
        where: 'Obesity, 2018',
        url: pubmed(29086496),
      },
      {
        title: 'Multi-dimensional roles of ketone bodies in fuel metabolism, signaling, and therapeutics',
        who: 'Puchalska, Crawford',
        where: 'Cell Metabolism, 2017',
        url: pubmed(28178565),
      },
      {
        title: 'Biochemistry, Ketogenesis',
        who: 'Rahimi, Gupta',
        where: 'StatPearls, NCBI Bookshelf',
        url: bookshelf('NBK493179'),
      },
    ],
  },
  {
    id: 'autophagy',
    name: 'Autophagy',
    term: 'Autophagy',
    from: 24,
    about: 'Cells step up recycling of worn-out parts; clear in animals, less certain in people.',
    alert: '24 hours in: cells are stepping up their recycling.',
    sources: [
      {
        title: 'The effect of fasting or calorie restriction on autophagy induction: a review of the literature',
        who: 'Bagherniya et al.',
        where: 'Ageing Research Reviews, 2018',
        url: pubmed(30172870),
      },
      {
        title: 'Short-term fasting induces profound neuronal autophagy',
        who: 'Alirezaei et al.',
        where: 'Autophagy, 2010',
        url: pubmed(20534972),
        note: 'in mice',
      },
      {
        title: 'Effects of intermittent fasting on health, aging, and disease',
        who: 'de Cabo, Mattson',
        where: 'New England Journal of Medicine, 2019',
        url: pubmed(31881139),
      },
    ],
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
