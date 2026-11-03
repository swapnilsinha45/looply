import { createClient } from 'npm:@supabase/supabase-js@2'

// On-demand English translation of one student review for the store that received it.
// Auth is the vendor's Looply session token; the store can only translate its own feedback.
// The result is cached on the row, so each review is translated at most once.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
const SYSTEM = `You translate short customer reviews into natural English. The review may be in any Indian language, romanised Hinglish, or a mix. Keep the meaning, tone and any sarcasm. Keep dish names, shop names and people's names as they are. Do not add, explain or censor anything. Return ONLY a JSON object: {"translation": "..."}.`

async function translate(key: string, text: string) {
  for (const model of MODELS) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 1200, reasoning_effort: 'low', response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Review:\n"""\n${text}\n"""` }],
      }),
    })
    if (res.ok) {
      try {
        const out = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? '{}')
        const t = String(out.translation ?? '').trim()
        if (t) return t.slice(0, 1200)
      } catch { /* try the next model */ }
    } else console.error('groq', model, res.status, await res.text())
  }
  throw new Error('translation failed')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const { token, note_id } = await req.json()
    if (!token || !note_id) return json({ error: 'Missing session or feedback' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: auth } = await db.from('store_auth').select('store_id').eq('token', token).maybeSingle()
    if (!auth) return json({ error: 'Session expired' }, 401)

    const { data: note } = await db.from('voice_notes').select('id, transcript, translation_en, store_id').eq('id', note_id).maybeSingle()
    if (!note || note.store_id !== auth.store_id) return json({ error: 'Feedback not found' }, 404)
    if (note.translation_en) return json({ translation: note.translation_en, cached: true })

    const { data: secret } = await db.from('app_secrets').select('value').eq('name', 'groq_api_key').maybeSingle()
    if (!secret) return json({ error: 'Translation is not configured yet' }, 503)

    const translation = await translate(secret.value, note.transcript)
    await db.from('voice_notes').update({ translation_en: translation }).eq('id', note.id)
    return json({ translation, cached: false })
  } catch (e) {
    console.error(e)
    return json({ error: 'Translation failed. Try again.' }, 502)
  }
})
