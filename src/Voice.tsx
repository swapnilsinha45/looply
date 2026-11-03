import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rpc, supabase } from './api'
import type { Student } from './api'
import { analyse, sentimentEmoji } from './sentiment'

const TOPICS = ['Taste', 'Wait time', 'Price', 'Hygiene', 'Staff', 'Stock']
const MAX_SECS = 15
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`

const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Props = {
  orderId: string; token: string | null; auto?: boolean
  back: () => void; reset: (r: { n: 'home' }) => void
  setStudent: (s: Student) => void; say: (m: string) => void
}

export default function Voice({ orderId, token, auto, back, reset, setStudent, say }: Props) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'transcribing' | 'review' | 'saving'>('idle')
  const [secs, setSecs] = useState(0)
  const [text, setText] = useState('')
  const [lang, setLang] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)
  const t0 = useRef(0)
  const duration = useRef(0)
  const blob = useRef<Blob | null>(null)
  const alive = useRef(true)

  const result = useMemo(() => analyse(text), [text])
  const topics = useMemo(() => Array.from(new Set([...picked, ...result.topics])), [picked, result.topics])
  const words = text.trim().split(/\s+/).filter(Boolean).length

  useEffect(() => () => {
    alive.current = false
    window.clearInterval(timer.current)
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
    rec.current?.stream.getTracks().forEach(t => t.stop())
  }, [])

  const transcribe = useCallback(async (b: Blob) => {
    setPhase('transcribing'); setNote('')
    try {
      const form = new FormData()
      const ext = b.type.includes('mp4') ? 'mp4' : b.type.includes('ogg') ? 'ogg' : 'webm'
      form.append('file', b, `review.${ext}`)
      form.append('token', token ?? '')
      const res = await fetch(FN_URL, { method: 'POST', headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string }, body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Transcription failed')
      if (!alive.current) return
      setText(String(data.text ?? ''))
      setLang(data.language ? cap(String(data.language)) : null)
      if (!String(data.text ?? '').trim()) setNote("We couldn't hear any words. Re-record, or type your review below.")
    } catch (e) {
      if (!alive.current) return
      setNote(`${e instanceof Error ? e.message : 'Transcription failed'}. You can type your review below.`)
    }
    if (alive.current) setPhase('review')
  }, [token])

  const stop = useCallback(() => {
    if (!rec.current || rec.current.state === 'inactive') return
    duration.current = Math.min(MAX_SECS, Math.max(1, Math.round((Date.now() - t0.current) / 1000)))
    window.clearInterval(timer.current)
    rec.current.stop()
  }, [])

  const start = async () => {
    setErr(''); setNote(''); setText(''); setLang(null); chunks.current = []; blob.current = null
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setErr('Microphone is blocked. Allow mic access, or tap “Type instead”.')
      return
    }
    let mr: MediaRecorder
    try { mr = new MediaRecorder(stream, pickMime() ? { mimeType: pickMime() } : undefined) } catch {
      stream.getTracks().forEach(t => t.stop())
      setErr('Recording is not supported in this browser. Tap “Type instead”.')
      return
    }
    rec.current = mr
    mr.ondataavailable = e => e.data.size && chunks.current.push(e.data)
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const b = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })
      blob.current = b
      if (b.size < 1500) { setNote("We couldn't hear anything. Re-record, or type your review below."); setPhase('review'); return }
      transcribe(b)
    }
    mr.start()
    t0.current = Date.now(); setSecs(0); setPhase('rec')
    timer.current = window.setInterval(() => {
      const s = Math.round((Date.now() - t0.current) / 1000)
      setSecs(s)
      if (s >= MAX_SECS) stop()
    }, 250)
  }

  // arriving from "Tap to record": start listening straight away so recording takes a single tap
  const autoStarted = useRef(false)
  useEffect(() => {
    if (auto && !autoStarted.current) { autoStarted.current = true; start() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeInstead = () => { setNote(''); setText(''); setLang(null); setPhase('review') }
  const rerecord = () => { setText(''); setNote(''); setLang(null); setPhase('idle') }

  const submit = async () => {
    setPhase('saving'); setErr('')
    try {
      let path: string | null = null
      if (blob.current && blob.current.size > 0) {
        const ext = blob.current.type.includes('mp4') ? 'mp4' : blob.current.type.includes('ogg') ? 'ogg' : 'webm'
        const p = `${orderId}/${Date.now()}.${ext}`
        const up = await supabase.storage.from('voice-notes').upload(p, blob.current, { contentType: blob.current.type.split(';')[0] })
        if (!up.error) path = p // audio is best-effort; the text review is what counts
      }
      const s = await rpc<Student>('save_voice_note', {
        p_token: token, p_order: orderId, p_duration: duration.current || Math.min(MAX_SECS, Math.max(1, Math.round(words / 2.5))),
        p_topics: topics, p_path: path, p_transcript: text.trim(),
        p_sentiment: result.label, p_score: result.score, p_aspects: result.aspects, p_language: lang?.toLowerCase() ?? null,
      })
      setStudent(s)
      say(s.notes_count >= 5 ? 'Review sent. 5% offer unlocked!' : `Review sent (${s.notes_count}/5 notes)`)
      reset({ n: 'home' })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save review'); setPhase('review') }
  }

  const pct = Math.round(((result.score + 1) / 2) * 100)
  const busy = phase === 'rec' || phase === 'transcribing' || phase === 'saving'

  return (
    <div className={`screen dark ${phase === 'rec' ? 'rec' : ''}`} style={{ overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 16px 0' }}>
        <button className="back" onClick={back} disabled={busy}>‹</button>
        <b>Voice feedback</b>
      </div>

      {(phase === 'idle' || phase === 'rec' || phase === 'transcribing') && (
        <div style={{ textAlign: 'center', padding: '28px 20px 0' }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>How was your order?</h1>
          <p style={{ color: '#bbb', fontSize: 14 }}>Speak in any language, even a mix, for up to 15 seconds. We detect it for you, and you can edit the text before sending.</p>
          <div className="orb"><div><button onClick={phase === 'rec' ? stop : start} disabled={phase === 'transcribing'} aria-label={phase === 'rec' ? 'Stop' : 'Record'} /></div></div>
          {phase === 'rec' && (<>
            <div className="bigtime">0:{String(secs).padStart(2, '0')} / 0:{MAX_SECS}</div>
            <p className="small" style={{ color: '#bbb' }}>Listening… tap the mic to finish</p>
          </>)}
          {phase === 'transcribing' && <b style={{ color: 'var(--yellow)' }}>Writing down what you said…</b>}
          {phase === 'idle' && (<>
            <b style={{ color: 'var(--yellow)' }}>Tap the mic to start</b>
            <div className="topics" style={{ marginTop: 20 }}>
              {TOPICS.map(t => <button key={t} className={picked.includes(t) ? 'on' : ''} onClick={() => setPicked(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]))}>{t}</button>)}
            </div>
            <p className="small" style={{ color: '#999' }}>Not sure what to say? Pick topics as a prompt.</p>
            <button className="linkbtn" style={{ color: 'var(--yellow)' }} onClick={typeInstead}>Type instead</button>
          </>)}
          {err && <div className="err" style={{ margin: '8px 0' }}>{err}</div>}
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <div style={{ padding: '20px 16px 0' }} className="stack">
          <h1 style={{ margin: 0, fontSize: 26 }}>Check your review</h1>
          <p style={{ color: '#bbb', fontSize: 13, margin: '4px 0 0' }}>
            This is what the store will see. Fix anything we misheard, then send.
            {lang && <> Language detected: <b style={{ color: 'var(--yellow)' }}>{lang}</b>.</>}
          </p>
          {note && <div className="banner small" style={{ color: 'var(--ink)' }}>{note}</div>}
          <textarea className="review" value={text} onChange={e => setText(e.target.value.slice(0, 600))} rows={5} placeholder="Say or type what you thought: taste, wait time, price, staff…" disabled={phase === 'saving'} />
          <div className="small" style={{ color: '#999', textAlign: 'right' }}>{words} words · {text.length}/600</div>

          <div className="sent">
            <div className="sent-head"><span>{sentimentEmoji(result.label)}</span><b style={{ textTransform: 'capitalize' }}>{words ? result.label : 'Waiting for text'}</b>
              <span className="small" style={{ marginLeft: 'auto', color: '#bbb' }}>Sentiment {result.score > 0 ? '+' : ''}{result.score.toFixed(2)}</span></div>
            <div className="meter"><i style={{ left: `${pct}%` }} /></div>
            <div className="meter-labels"><span>Negative</span><span>Neutral</span><span>Positive</span></div>
            {Object.keys(result.aspects).length > 0 && (
              <div className="aspects">
                {Object.entries(result.aspects).map(([k, v]) => (
                  <span key={k} className={`asp ${v > 0.15 ? 'p' : v < -0.15 ? 'n' : ''}`}>{k} {v > 0.15 ? '👍' : v < -0.15 ? '👎' : '·'}</span>
                ))}
              </div>
            )}
          </div>

          <div className="topics">
            {TOPICS.map(t => <button key={t} className={topics.includes(t) ? 'on' : ''} onClick={() => setPicked(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]))}>{t}</button>)}
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={phase === 'saving' || words < 3} onClick={submit}>{phase === 'saving' ? 'Sending…' : words < 3 ? 'Add a few more words to send' : 'Send review'}</button>
          <button className="btn ghost" style={{ color: '#fff', borderColor: '#4a4430' }} disabled={phase === 'saving'} onClick={rerecord}>Re-record</button>
        </div>
      )}

      <div style={{ flex: 1 }} />
      <div className="reward" style={{ marginTop: 16 }}>Reward: 5% off above ₹150 after your 5th note.</div>
      {(phase === 'idle' || phase === 'review') && <button className="linkbtn" style={{ color: '#aaa', marginBottom: 20 }} onClick={() => reset({ n: 'home' })}>Skip</button>}
    </div>
  )
}
