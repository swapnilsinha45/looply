import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rpc } from './api'
import { ConsentSheet } from './Consent'
import type { Student } from './api'
import { sentimentEmoji } from './sentiment'
import { deepAnalyse, lexiconAnalysis } from './analysis'
import type { Analysis } from './analysis'

// Plain words for the score, so it reads as a result rather than a setting.
const moodWords = (s: number) => (s <= -0.6 ? 'Very negative' : s < -0.15 ? 'Negative' : s <= 0.15 ? 'Neutral or mixed' : s < 0.6 ? 'Positive' : 'Very positive')

const TOPICS = ['Taste', 'Wait time', 'Price', 'Hygiene', 'Staff', 'Stock']
const MAX_SECS = 15
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`

const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Props = {
  orderId: string; token: string | null; auto?: boolean; feedbackOn: boolean
  back: () => void; reset: (r: { n: 'home' }) => void
  setStudent: (s: Student) => void; say: (m: string) => void
}

export default function Voice({ orderId, token, auto, feedbackOn, back, reset, setStudent, say }: Props) {
  const [consented, setConsented] = useState(feedbackOn)
  const [phase, setPhase] = useState<'idle' | 'rec' | 'transcribing' | 'review' | 'saving'>('idle')
  const [stage, setStage] = useState('')
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

  // What the student sees is the same AI reading the store gets; the word-list reading fills in until it arrives.
  const [ai, setAi] = useState<{ text: string; a: Analysis } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const quick = useMemo(() => lexiconAnalysis(text), [text])
  const current = !!ai && ai.text === text.trim()
  const shown: Analysis = current ? ai!.a : quick
  const fromAi = current && ai!.a.method === 'llm'
  const topics = useMemo(() => Array.from(new Set([...picked, ...shown.topics])), [picked, shown.topics])
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
    if (!consented) return // nothing is recorded until the student has agreed
    setErr(''); setNote(''); setText(''); setLang(null); chunks.current = []; blob.current = null
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      // Say what went wrong and how to fix it (a Useberry tester got stuck switching microphones).
      const name = (e as DOMException)?.name
      setErr(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone is blocked. Tap the lock or settings icon next to the web address, set Microphone to Allow, then tap Record again. Or tap “Type instead”.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No microphone found. Plug in or switch on a microphone, then tap Record again. Or tap “Type instead”.'
          : name === 'NotReadableError' || name === 'AbortError'
            ? 'Another app or tab is using the microphone. Close it (or end the call), then tap Record again.'
            : 'Could not start the microphone. Check your browser’s microphone setting, then tap Record again, or tap “Type instead”.')
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
    if (auto && consented && !autoStarted.current) { autoStarted.current = true; start() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeInstead = () => { setNote(''); setText(''); setLang(null); setPhase('review') }
  const rerecord = () => { setText(''); setNote(''); setLang(null); setPhase('idle') }

  const submit = async () => {
    setPhase('saving'); setErr('')
    try {
      const path: string | null = null // audio is never stored: only the text is kept
      setStage('Reading your review…')
      // reuse the reading already shown if the text hasn't changed; otherwise read it now (falls back to the word list if offline)
      const an = current ? ai!.a : await deepAnalyse(text.trim(), token)
      setStage('Saving…')
      const s = await rpc<Student>('save_voice_note', {
        p_token: token, p_order: orderId, p_duration: duration.current || Math.min(MAX_SECS, Math.max(1, Math.round(words / 2.5))),
        p_topics: Array.from(new Set([...picked, ...an.topics])), p_path: path, p_transcript: text.trim(),
        p_sentiment: an.sentiment, p_score: an.score, p_aspects: an.aspects, p_language: (an.language ?? lang)?.toLowerCase() ?? null,
        p_category: an.category, p_severity: an.severity, p_flags: an.flags, p_summary: an.summary, p_method: an.method,
      })
      setStudent(s)
      say(s.gift ? `Thanks! You unlocked ${s.gift}. It’s in Rewards.` : 'Thanks. The store sees your words as “Student”, never your name.')
      reset({ n: 'home' })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save review'); setPhase('review') }
  }

  // read the review with the AI once the student pauses typing (1.2 s), so the preview matches what the store will see
  useEffect(() => {
    const t = text.trim()
    if (phase !== 'review' || !consented || t.split(/\s+/).filter(Boolean).length < 3 || ai?.text === t) return
    const h = setTimeout(async () => {
      setAiBusy(true)
      const a = await deepAnalyse(t, token)
      setAi({ text: t, a }); setAiBusy(false)
    }, 1200)
    return () => clearTimeout(h)
  }, [text, phase, consented, token, ai?.text])

  const busy = phase === 'rec' || phase === 'transcribing' || phase === 'saving'
  const neg = shown.score < 0 ? Math.round(Math.abs(shown.score) * 100) : 0
  const pos = shown.score > 0 ? Math.round(shown.score * 100) : 0

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

          <div className="sent" aria-live="polite">
            <div className="sent-title">
              <span>How the store will read this</span>
              <span className={`src ${fromAi ? 'ai' : ''}`}>{fromAi ? 'AI reading' : aiBusy ? 'Reading…' : 'Quick reading'}</span>
            </div>
            <div className="sent-head">
              <span>{words ? sentimentEmoji(shown.sentiment) : '…'}</span>
              <b>{words ? moodWords(shown.score) : 'Waiting for your words'}</b>
              {words > 0 && <span className="small" style={{ marginLeft: 'auto', color: '#bbb' }}>{shown.score > 0 ? '+' : ''}{Math.round(shown.score * 100)} / 100</span>}
            </div>
            {/* a result, not a control: fills out from the centre towards the mood, with no handle to drag */}
            <div className="mood-bar" role="img" aria-label={`Mood ${moodWords(shown.score)}, ${Math.round(shown.score * 100)} out of 100`}>
              <span className="half neg"><i style={{ width: `${neg}%` }} /></span>
              <span className="half pos"><i style={{ width: `${pos}%` }} /></span>
            </div>
            <div className="meter-labels"><span>Negative</span><span>Neutral</span><span>Positive</span></div>
            {Object.keys(shown.aspects).length > 0 && (<>
              <div className="small" style={{ color: '#bbb', marginTop: 12 }}>What we picked up</div>
              <div className="aspects">
                {Object.entries(shown.aspects).map(([k, v]) => (
                  <span key={k} className={`asp ${v > 0.15 ? 'p' : v < -0.15 ? 'n' : ''}`}>{k}: {v > 0.15 ? 'good 👍' : v < -0.15 ? 'poor 👎' : 'mixed'}</span>
                ))}
              </div>
            </>)}
            <div className="small" style={{ color: '#8f8a78', marginTop: 10 }}>This is our reading of your words. To change it, edit the text above.</div>
          </div>

          <div className="small" style={{ color: '#bbb' }}>Tag topics (optional)</div>
          <div className="topics">
            {TOPICS.map(t => <button key={t} className={topics.includes(t) ? 'on' : ''} onClick={() => setPicked(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]))}>{t}</button>)}
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={phase === 'saving' || words < 3} onClick={submit}>{phase === 'saving' ? (stage || 'Sending…') : words < 3 ? 'Add a few more words to send' : 'Send review'}</button>
          <button className="btn ghost" style={{ color: '#fff', borderColor: '#4a4430' }} disabled={phase === 'saving'} onClick={rerecord}>Re-record</button>
        </div>
      )}

      <div style={{ flex: 1 }} />
      <div className="reward" style={{ marginTop: 16 }}>Optional. The store sees your words as “Student”, never your name or audio.</div>
      {(phase === 'idle' || phase === 'review') && <button className="linkbtn" style={{ color: '#aaa', marginBottom: 20 }} onClick={() => reset({ n: 'home' })}>Skip</button>}
      {!consented && <ConsentSheet token={token} onCancel={() => reset({ n: 'home' })}
        onDone={s => { setStudent(s); setConsented(true); if (auto) setTimeout(() => { autoStarted.current = true; start() }, 60) }} />}
    </div>
  )
}
