import { analyse } from './sentiment'
import type { SentimentResult } from './sentiment'

export type Analysis = {
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
  category: string
  severity: string
  aspects: Record<string, number>
  topics: string[]
  flags: string[]
  summary: string | null
  language: string | null
  method: 'llm' | 'lexicon'
}

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`

// Offline fallback: map the word-list result onto the same shape the AI service returns.
export function lexiconAnalysis(text: string, r: SentimentResult = analyse(text)): Analysis {
  const neg = r.label === 'negative'
  return {
    sentiment: r.label, score: r.score, aspects: r.aspects, topics: r.topics, flags: [], summary: null, language: null, method: 'lexicon',
    category: neg ? 'complaint' : r.label === 'positive' ? 'praise' : 'mixed',
    severity: neg ? (r.score < -0.6 ? 'high' : 'medium') : 'none',
  }
}

// AI aspect-based analysis (any language, mixed languages, sarcasm). Falls back to the word list if it is unreachable.
export async function deepAnalyse(text: string, token: string | null): Promise<Analysis> {
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
      body: JSON.stringify({ token, text }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const d = await res.json()
    if (!d.sentiment) throw new Error('bad response')
    return d as Analysis
  } catch {
    return lexiconAnalysis(text)
  }
}
