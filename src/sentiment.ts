// Lightweight, offline sentiment analysis for short food/retail reviews.
// English, Hindi (Devanagari + romanised Hinglish) and basic coverage of Marathi, Bengali, Tamil, Telugu,
// Kannada, Gujarati, Punjabi and Malayalam (see lexicons.ts).
// Lexicon scoring with negation, intensifiers, contrast ("but") handling and per-aspect breakdown.
import { POS_X, NEG_X, BOOST_X, NEGATORS_X, POST_NEG, CONTRAST_X, ASPECT_X } from './lexicons'

export type Sentiment = 'positive' | 'neutral' | 'negative'
export type SentimentResult = {
  label: Sentiment
  score: number // -1..1
  aspects: Record<string, number> // topic -> -1..1
  topics: string[]
  highlights: { word: string; polarity: 'pos' | 'neg' }[]
}

const POS: Record<string, number> = {
  good: 1, great: 2, amazing: 2.5, awesome: 2.5, excellent: 2.5, fantastic: 2.5, perfect: 2.5, best: 2.5,
  love: 2, loved: 2, like: 0.7, liked: 0.8, nice: 1, tasty: 1.8, delicious: 2.2, yummy: 2, fresh: 1.4, hot: 0.5,
  crispy: 1.3, flavourful: 1.6, flavorful: 1.6, fast: 1.4, quick: 1.4, quickly: 1.4, prompt: 1.4, instant: 1.2,
  clean: 1.5, hygienic: 1.8, neat: 1.2, spotless: 2, friendly: 1.6, polite: 1.5, helpful: 1.6, kind: 1.3, courteous: 1.5,
  cheap: 1, affordable: 1.5, reasonable: 1.3, worth: 1.5, value: 1, generous: 1.5, filling: 1.2, big: 0.6, huge: 0.8,
  satisfied: 1.5, happy: 1.6, pleased: 1.5, recommend: 1.8, recommended: 1.8, enjoyed: 1.6, wonderful: 2.2, superb: 2.3,
  smooth: 1.1, easy: 1, available: 1, stocked: 1, ready: 0.8, ontime: 1.3, warm: 0.8, mast: 1.8, badhiya: 1.8,
  zabardast: 2.3, shandar: 2.2, accha: 1.2, acha: 1.2, sahi: 1.2, lajawab: 2.3, jhakaas: 2.1,
}
const NEG: Record<string, number> = {
  bad: -1.5, worst: -2.6, terrible: -2.4, awful: -2.4, horrible: -2.4, poor: -1.6, disgusting: -2.6, gross: -2.2,
  hate: -2.2, hated: -2.2, dislike: -1.3, bland: -1.6, tasteless: -2, stale: -2, cold: -1.2, soggy: -1.6, oily: -1.2,
  burnt: -1.8, raw: -1.4, undercooked: -1.8, overcooked: -1.5, salty: -1, spicy: -0.2, slow: -1.5, late: -1.4, delay: -1.4,
  delayed: -1.5, waiting: -0.8, waited: -0.9, long: -1, forever: -1.6, crowded: -0.8, dirty: -2, unhygienic: -2.2,
  filthy: -2.4, messy: -1.5, smelly: -1.8, rude: -2, arrogant: -1.8, unhelpful: -1.7, ignored: -1.6, careless: -1.5,
  expensive: -1.5, costly: -1.4, overpriced: -2, pricey: -1.4, rip: -1.2, ripoff: -2, small: -0.8, tiny: -1, less: -0.5,
  unavailable: -1.6, soldout: -1.6, missing: -1.4, wrong: -1.6, mistake: -1.4, cheated: -2.2, disappointed: -1.8,
  disappointing: -1.9, unhappy: -1.7, angry: -1.8, annoyed: -1.5, frustrated: -1.7, problem: -1.2, issue: -1,
  complaint: -1.4, sick: -2, hair: -2, insect: -2.4, bug: -1.2, fly: -1.2, bekar: -2, ganda: -2, kharab: -1.8,
  bakwas: -2.2, mehenga: -1.5, mehnga: -1.5, dhokha: -2.2, thanda: -1.2, ghatiya: -2.2, faltu: -1.8,
}
const NEGATORS = new Set(['not', 'no', 'never', 'none', 'neither', 'without', "isn't", "wasn't", "don't", "didn't",
  "doesn't", "can't", "couldn't", "won't", "wouldn't", "aren't", "weren't", 'isnt', 'wasnt', 'dont', 'didnt', 'doesnt',
  'cant', 'couldnt', 'wont', 'nahi', 'nahin', 'na', 'mat', 'hardly', 'barely'])
const BOOST: Record<string, number> = {
  very: 1.4, really: 1.4, extremely: 1.7, super: 1.5, so: 1.25, too: 1.3, totally: 1.4, absolutely: 1.6, highly: 1.4,
  incredibly: 1.6, quite: 1.15, bahut: 1.4, bohot: 1.4, ekdum: 1.4, thoda: 0.6, slightly: 0.6, bit: 0.7, little: 0.7,
  somewhat: 0.7, kinda: 0.75, fairly: 0.9, mostly: 0.9,
}
const CONTRAST = new Set(['but', 'however', 'although', 'though', 'lekin', 'par', 'magar', 'yet', 'except'])

export const ASPECTS: Record<string, string[]> = {
  Taste: ['taste', 'tasty', 'flavour', 'flavor', 'food', 'spicy', 'bland', 'delicious', 'yummy', 'fresh', 'stale', 'maggi',
    'chai', 'coffee', 'sandwich', 'roll', 'burger', 'pizza', 'juice', 'portion', 'quality', 'cooked', 'salty', 'sweet', 'swad'],
  'Wait time': ['wait', 'waiting', 'waited', 'slow', 'fast', 'quick', 'quickly', 'late', 'delay', 'delayed', 'time', 'minutes',
    'queue', 'line', 'prompt', 'instant', 'ready', 'long', 'crowded', 'forever', 'der'],
  Price: ['price', 'prices', 'cost', 'costly', 'expensive', 'cheap', 'affordable', 'pricey', 'money', 'worth', 'value',
    'overpriced', 'reasonable', 'rate', 'mrp', 'discount', 'mehenga', 'mehnga', 'paisa', 'rupees'],
  Hygiene: ['clean', 'dirty', 'hygiene', 'hygienic', 'unhygienic', 'smell', 'smelly', 'filthy', 'hair', 'insect', 'fly',
    'bug', 'neat', 'messy', 'spotless', 'safai', 'gloves', 'table'],
  Staff: ['staff', 'service', 'owner', 'uncle', 'bhaiya', 'behaviour', 'behavior', 'rude', 'polite', 'friendly', 'helpful',
    'attitude', 'cashier', 'waiter', 'person', 'people', 'manager', 'smile'],
  Stock: ['stock', 'available', 'availability', 'unavailable', 'soldout', 'sold', 'out', 'missing', 'variety', 'options',
    'menu', 'item', 'items', 'khatam', 'finished'],
}

// Lowercase, compose Unicode and drop the nukta so "बढ़िया"/"बढिया" and "ज़्यादा"/"ज्यादा" match the same entry.
export const norm = (s: string) => s.normalize('NFC').replace(/़/g, '').toLowerCase()
const normMap = (...maps: Record<string, number>[]) => {
  const o: Record<string, number> = {}
  for (const m of maps) for (const [k, v] of Object.entries(m)) o[norm(k)] = v
  return o
}
const POSN = normMap(POS, POS_X)
const NEGN = normMap(NEG, NEG_X)
const BOOSTN = normMap(BOOST, BOOST_X)
const NEGATORSN = new Set([...NEGATORS, ...NEGATORS_X].map(norm))
const POSTNEGN = new Set([...POST_NEG].map(norm))
const CONTRASTN = new Set([...CONTRAST, ...CONTRAST_X].map(norm))
const ASPECT_KEYS: Record<string, Set<string>> = {}
for (const src of [ASPECTS, ASPECT_X]) {
  for (const [k, words] of Object.entries(src)) {
    const set = (ASPECT_KEYS[k] ||= new Set())
    words.forEach(w => set.add(norm(w)))
  }
}

// \p{M} keeps Devanagari/Tamil/etc. vowel signs attached to their letters
const tokenize = (s: string) =>
  norm(s).replace(/’/g, "'").replace(/sold out/g, 'soldout').replace(/on time/g, 'ontime').replace(/rip[\s-]?off/g, 'ripoff')
    .replace(/[^\p{L}\p{M}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean)

function scoreTokens(tokens: string[], hl?: SentimentResult['highlights']): number {
  let total = 0
  tokens.forEach((t, i) => {
    let base = POSN[t] ?? NEGN[t] ?? 0
    if (!base) return
    // look back up to 3 tokens for intensifiers / negators
    let mult = 1
    let negated = false
    for (let k = 1; k <= 3 && i - k >= 0; k++) {
      const p = tokens[i - k]
      if (BOOSTN[p] !== undefined) mult *= BOOSTN[p]
      if (NEGATORSN.has(p) || p.endsWith("n't")) negated = true
    }
    // Hindi and other SOV languages put the negator after the word: "accha nahi tha"
    for (let k = 1; k <= 2 && i + k < tokens.length; k++) if (POSTNEGN.has(tokens[i + k])) negated = true
    if (negated) base = -base * 0.75
    const v = base * mult
    total += v
    if (hl) hl.push({ word: t, polarity: v >= 0 ? 'pos' : 'neg' })
  })
  return total
}

const squash = (raw: number) => raw / Math.sqrt(raw * raw + 6)

// A clause is a run of words between sentence ends, commas, or contrast words ("but", "lekin"...).
// Aspects are scored per clause, so "food was great but the wait was long" gives Taste +, Wait time −.
function clauses(text: string): { toks: string[]; afterContrast: boolean }[] {
  const out: { toks: string[]; afterContrast: boolean }[] = []
  let after = false
  for (const sentence of text.split(/[.!?;\n।॥]+/)) {
    let cur: string[] = []
    const flush = () => { if (cur.length) out.push({ toks: cur, afterContrast: after }); cur = [] }
    for (const t of tokenize(sentence.replace(/,/g, ' , '))) {
      if (t === ',') { flush(); continue }
      if (CONTRASTN.has(t)) { flush(); after = true; continue }
      cur.push(t)
    }
    flush()
    after = false
  }
  return out
}

export function analyse(text: string): SentimentResult {
  const clean = text.trim()
  const highlights: SentimentResult['highlights'] = []
  if (!clean) return { label: 'neutral', score: 0, aspects: {}, topics: [], highlights }

  const sums: Record<string, number[]> = {}
  let raw = 0
  for (const c of clauses(clean)) {
    const r = scoreTokens(c.toks, highlights)
    raw += c.afterContrast ? r * 1.5 : r // the clause after "but" carries the verdict
    const sc = squash(r)
    for (const aspect of Object.keys(ASPECT_KEYS)) {
      if (c.toks.some(t => ASPECT_KEYS[aspect].has(t))) (sums[aspect] ||= []).push(sc)
    }
  }
  const bang = Math.min((clean.match(/!/g) || []).length, 3) * 0.1
  const score = Math.round(squash(raw * (1 + bang)) * 100) / 100

  const aspects: Record<string, number> = {}
  for (const [k, arr] of Object.entries(sums)) {
    const avg = arr.reduce((x, y) => x + y, 0) / arr.length
    if (Math.abs(avg) > 0.02) aspects[k] = Math.round(avg * 100) / 100
  }
  const label: Sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral'
  return { label, score, aspects, topics: Object.keys(sums), highlights }
}

export const sentimentEmoji = (s: string) => (s === 'positive' ? '😊' : s === 'negative' ? '😞' : '😐')
