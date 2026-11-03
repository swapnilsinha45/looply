import { createClient } from 'npm:@supabase/supabase-js@2'

// Aspect-based sentiment for a student's review, any language or a mix, via Groq (free tier).
// Auth is the student's Looply session token. The review text itself is never translated or changed here.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const PER_HOUR = 60
// Groq retires models over time: try the strongest first, fall back to the smaller one.
const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
const ASPECTS = ['Taste', 'Wait time', 'Price', 'Hygiene', 'Staff', 'Stock']
const FLAGS = ['food_safety', 'hygiene', 'rude_staff', 'overcharged', 'wrong_order', 'long_wait', 'out_of_stock', 'cold_food', 'small_portion',
  'great_taste', 'great_service', 'good_value', 'fast_service']
const CATEGORIES = ['praise', 'complaint', 'suggestion', 'question', 'mixed']
const SEVERITIES = ['none', 'low', 'medium', 'high', 'critical']

const SYSTEM = `You analyse short customer reviews of a campus food or retail store. A review may be in English, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, Punjabi, Malayalam, romanised Hinglish, or a mix of languages in one sentence. Understand it as a native speaker would, including sarcasm, negation and slang. Do not translate the review; only analyse it.

Return ONLY a JSON object with exactly these keys:
- sentiment: "positive" | "neutral" | "negative" (overall feeling)
- score: number from -1 to 1 (-1 very negative, 0 neutral or truly mixed, 1 very positive)
- category: "praise" | "complaint" | "suggestion" | "question" | "mixed" (mixed = clearly both praise and complaint)
- severity: "none" | "low" | "medium" | "high" | "critical". critical = food safety, illness, foreign object, harassment. high = rude or abusive staff, overcharging, wrong or missing order, very long wait. medium = clear complaint. low = minor gripe. none = no problem.
- aspects: object mapping ONLY the aspects the review actually talks about to a number from -1 to 1. Allowed keys: ${ASPECTS.join(', ')}. Omit aspects that are not mentioned.
- flags: array using only these values: ${FLAGS.join(', ')}.
- summary: one plain English sentence, at most 20 words, for the store owner.
- language: the main language of the review, in English (e.g. "Hindi", "Hinglish", "English").`

const clamp = (n: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0))

async function callGroq(key: string, text: string) {
  let lastStatus = 0
  for (const model of MODELS) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 1500, reasoning_effort: 'low', response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Review:\n"""\n${text}\n"""` }],
      }),
    })
    lastStatus = res.status
    if (res.ok) {
      const data = await res.json()
      try { return { raw: JSON.parse(data.choices?.[0]?.message?.content ?? '{}'), model } } catch { continue }
    }
    console.error('groq', model, res.status, await res.text())
  }
  throw new Error(`groq ${lastStatus}`)
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const { token, text } = await req.json()
    const review = String(text ?? '').trim().slice(0, 600)
    if (!token || !review) return json({ error: 'Missing review or session' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: auth } = await db.from('student_auth').select('student_id').eq('token', token).maybeSingle()
    if (!auth) return json({ error: 'Session expired' }, 401)

    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await db.from('transcribe_log').select('id', { count: 'exact', head: true })
      .eq('student_id', auth.student_id).eq('kind', 'analyze').gte('created_at', since)
    if ((count ?? 0) >= PER_HOUR) return json({ error: 'Too many reviews this hour' }, 429)

    const { data: secret } = await db.from('app_secrets').select('value').eq('name', 'groq_api_key').maybeSingle()
    if (!secret) return json({ error: 'Analysis is not configured yet' }, 503)

    const { raw, model } = await callGroq(secret.value, review)

    const sentiment = ['positive', 'neutral', 'negative'].includes(raw.sentiment) ? raw.sentiment : 'neutral'
    const aspects: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw.aspects ?? {})) {
      const n = Math.round(clamp(v, -1, 1) * 100) / 100
      if (ASPECTS.includes(k) && Math.abs(n) >= 0.05) aspects[k] = n // 0 means "not mentioned"
    }
    const out = {
      sentiment,
      score: Math.round(clamp(raw.score, -1, 1) * 100) / 100,
      category: CATEGORIES.includes(raw.category) ? raw.category : sentiment === 'negative' ? 'complaint' : sentiment === 'positive' ? 'praise' : 'mixed',
      severity: SEVERITIES.includes(raw.severity) ? raw.severity : 'none',
      aspects,
      topics: Object.keys(aspects),
      flags: (Array.isArray(raw.flags) ? raw.flags : []).filter((f: string) => FLAGS.includes(f)),
      summary: String(raw.summary ?? '').slice(0, 240),
      language: String(raw.language ?? '').slice(0, 24) || null,
      method: 'llm',
      model,
    }
    // keep label and score consistent even if the model disagrees with itself
    if (out.sentiment === 'positive' && out.score < 0.1) out.score = 0.3
    if (out.sentiment === 'negative' && out.score > -0.1) out.score = -0.3
    if (out.sentiment === 'neutral' && Math.abs(out.score) > 0.4) out.score = 0

    await db.from('transcribe_log').insert({ student_id: auth.student_id, language: out.language, kind: 'analyze' })
    return json(out)
  } catch (e) {
    console.error(e)
    return json({ error: 'Analysis failed' }, 502)
  }
})
