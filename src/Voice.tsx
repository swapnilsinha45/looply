import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rpc, supabase } from './api'
import type { Student } from './api'
import { analyse, sentimentEmoji } from './sentiment'

const TOPICS = ['Taste', 'Wait time', 'Price', 'Hygiene', 'Staff', 'Stock']
const MAX_SECS = 15

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined

type Props = {
  orderId: string; token: string | null
  back: () => void; reset: (r: { n: 'home' }) => void
  setStudent: (s: Student) => void; say: (m: string) => void
}

export default function Voice({ orderId, token, back, reset, setStudent, say }: Props) {
  const [phase, setPhase] = useState<'idle' | 'rec' | 'review' | 'saving'>('idle')
  const [secs, setSecs] = useState(0)
  const [text, setText] = useState('')
  const [live, setLive] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const recog = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const chunks = useRef<Blob[]>([])
  const finalText = useRef('')
  const timer = useRef<number | undefined>(undefined)
  const t0 = useRef(0)
  const duration = useRef(0)
  const blob = useRef<Blob | null>(null)
  const active = useRef(false)

  const result = useMemo(() => analyse(text), [text])
  const topics = useMemo(() => Array.from(new Set([...picked, ...result.topics])), [picked, result.topics])
  const words = text.trim().split(/\s+/).filter(Boolean).length

  const cleanup = useCallback(() => {
    active.current = false
    window.clearInterval(timer.current)
    try { recog.current?.stop() } catch { /* already stopped */ }
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
    rec.current?.stream.getTracks().forEach(t => t.stop())
  }, [])
  useEffect(() => cleanup, [cleanup])

  const stop = useCallback(() => {
    if (!active.current) return
    active.current = false
    duration.current = Math.min(MAX_SECS, Math.max(1, Math.round((Date.now() - t0.current) / 1000)))
    window.clearInterval(timer.current)
    try { recog.current?.stop() } catch { /* ignore */ }
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
    rec.current?.stream.getTracks().forEach(t => t.stop())
    // let the recogniser flush its final result before reviewing
    window.setTimeout(() => {
      setText(finalText.current.trim())
      setLive('')
      setPhase('review')
      if (!SR) setNote("Live transcription isn't supported in this browser. Type or paste your review below.")
      else if (!finalText.current.trim()) setNote("We couldn't catch any words. Re-record, or type your review below.")
    }, 450)
  }, [])

  const start = async () => {
    setErr(''); setNote(''); finalText.current = ''; setLive(''); chunks.current = []; blob.current = null
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setErr('Microphone is blocked. Allow mic access, or tap “Type instead”.')
      return
    }
    try {
      const mr = new MediaRecorder(stream)
      rec.current = mr
      mr.ondataavailable = e => e.data.size && chunks.current.push(e.data)
      mr.onstop = () => { blob.current = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }) }
      mr.start()
    } catch { rec.current = null }

    if (SR) {
      const r = new SR()
      r.lang = 'en-IN'; r.continuous = true; r.interimResults = true
      r.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) finalText.current += res[0].transcript + ' '
          else interim += res[0].transcript
        }
        setLive(`${finalText.current}${interim}`.trim())
      }
      r.onerror = () => { /* surfaced via empty transcript in review */ }
      r.onend = () => { if (active.current) { try { r.start() } catch { /* ignore */ } } }
      recog.current = r
      try { r.start() } catch { /* ignore */ }
    }
    active.current = true
    t0.current = Date.now(); setSecs(0); setPhase('rec')
    timer.current = window.setInterval(() => {
      const s = Math.round((Date.now() - t0.current) / 1000)
      setSecs(s)
      if (s >= MAX_SECS) stop()
    }, 250)
  }

  const typeInstead = () => { setNote(''); setText(''); setPhase('review') }
  const rerecord = () => { setText(''); setNote(''); setPhase('idle') }

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
        p_sentiment: result.label, p_score: result.score, p_aspects: result.aspects,
      })
      setStudent(s)
      say(s.notes_count >= 5 ? 'Review sent. 5% offer unlocked!' : `Review sent (${s.notes_count}/5 notes)`)
      reset({ n: 'home' })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save review'); setPhase('review') }
  }

  const pct = Math.round(((result.score + 1) / 2) * 100)

  return (
    <div className={`screen dark ${phase === 'rec' ? 'rec' : ''}`} style={{ overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 16px 0' }}>
        <button className="back" onClick={back} disabled={phase === 'rec' || phase === 'saving'}>‹</button>
        <b>Voice feedback</b>
      </div>

      {(phase === 'idle' || phase === 'rec') && (
        <div style={{ textAlign: 'center', padding: '28px 20px 0' }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>How was your order?</h1>
          <p style={{ color: '#bbb', fontSize: 14 }}>Speak naturally for up to 15 seconds. You can edit the text before sending.</p>
          <div className="orb"><div><button onClick={phase === 'rec' ? stop : start} aria-label={phase === 'rec' ? 'Stop' : 'Record'} /></div></div>
          {phase === 'rec' ? (
            <>
              <div className="bigtime">0:{String(secs).padStart(2, '0')} / 0:{MAX_SECS}</div>
              <div className="live" aria-live="polite">{live || (SR ? 'Listening…' : 'Recording audio…')}</div>
              <p className="small" style={{ color: '#bbb' }}>Tap the mic to finish</p>
            </>
          ) : (
            <>
              <b style={{ color: 'var(--yellow)' }}>Tap the mic to start</b>
              <div className="topics" style={{ marginTop: 20 }}>
                {TOPICS.map(t => <button key={t} className={picked.includes(t) ? 'on' : ''} onClick={() => setPicked(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]))}>{t}</button>)}
              </div>
              <p className="small" style={{ color: '#999' }}>Not sure what to say? Pick topics as a prompt.</p>
              <button className="linkbtn" style={{ color: 'var(--yellow)' }} onClick={typeInstead}>Type instead</button>
            </>
          )}
          {err && <div className="err" style={{ margin: '8px 0' }}>{err}</div>}
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <div style={{ padding: '20px 16px 0' }} className="stack">
          <h1 style={{ margin: 0, fontSize: 26 }}>Check your review</h1>
          <p style={{ color: '#bbb', fontSize: 13, margin: '4px 0 0' }}>This is what the store will see. Fix anything we misheard, then send.</p>
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
