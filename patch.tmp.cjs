const fs = require('fs')
let s = fs.readFileSync('src/sentiment.ts', 'utf8')
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a); s = s.replace(a, b) }

rep("// Lightweight, offline sentiment analysis for short food/retail reviews (English + common Hinglish).",
    "// Lightweight, offline sentiment analysis for short food/retail reviews.\n// English, Hindi (Devanagari + romanised Hinglish) and basic coverage of Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, Punjabi, Malayalam.\nimport { POS_X, NEG_X, BOOST_X, NEGATORS_X, POST_NEG, CONTRAST_X, ASPECT_X } from './lexicons'")

// merged, normalised structures go right before tokenize
rep("const tokenize = (s: string) =>",
`export const norm = (s: string) => s.normalize('NFC').replace(/\u093C/g, '').toLowerCase()
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
for (const src of [ASPECTS, ASPECT_X]) for (const [k, words] of Object.entries(src)) {
  const set = (ASPECT_KEYS[k] ||= new Set())
  words.forEach(w => set.add(norm(w)))
}

const tokenize = (s: string) =>`)

rep("s.toLowerCase().replace(/sold out/g", "norm(s).replace(/\u2019/g, \"'\").replace(/sold out/g")
rep("[^\p{L}\p{N}'\s]", "[^\p{L}\p{M}\p{N}'\s]")
rep("let base = POS[t] ?? NEG[t] ?? 0", "let base = POSN[t] ?? NEGN[t] ?? 0")
rep("if (BOOST[p] !== undefined) mult *= BOOST[p]", "if (BOOSTN[p] !== undefined) mult *= BOOSTN[p]")
rep("if (NEGATORS.has(p) || p.endsWith(\"n't\")) negated = true\n    }",
    "if (NEGATORSN.has(p) || p.endsWith(\"n't\")) negated = true\n    }\n    // Hindi and other SOV languages put the negator after the word: \"accha nahi tha\"\n    for (let k = 1; k <= 2 && i + k < tokens.length; k++) if (POSTNEGN.has(tokens[i + k])) negated = true")
rep("if (CONTRAST.has(t))", "if (CONTRASTN.has(t))")
rep("if (c.toks.some(t => keys.includes(t)))", "if (c.toks.some(t => ASPECT_KEYS[aspect].has(t)))")
rep("for (const [aspect, keys] of Object.entries(ASPECTS))", "for (const aspect of Object.keys(ASPECT_KEYS))")
fs.writeFileSync('src/sentiment.ts', s)

let l = fs.readFileSync('src/lexicons.ts', 'utf8')
l = l.replace("'ना', 'मत', 'बिना', 'कभी नहीं', ", "'मत', 'बिना', ").replace(" 'না', 'இல்லை',", " 'இல்லை',")
fs.writeFileSync('src/lexicons.ts', l)
