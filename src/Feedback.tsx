import { useState } from 'react'
import type { Feedback } from './api'
import { sentimentEmoji } from './sentiment'

type Note = Feedback['notes'][number]

export const SEV: Record<string, { label: string; rank: number }> = {
  critical: { label: 'Critical', rank: 4 }, high: { label: 'High', rank: 3 }, medium: { label: 'Medium', rank: 2 }, low: { label: 'Low', rank: 1 }, none: { label: 'None', rank: 0 },
}
export const FLAG: Record<string, { label: string; good: boolean }> = {
  food_safety: { label: 'Food safety', good: false }, hygiene: { label: 'Hygiene', good: false }, rude_staff: { label: 'Rude staff', good: false },
  overcharged: { label: 'Overcharged', good: false }, wrong_order: { label: 'Wrong order', good: false }, long_wait: { label: 'Long wait', good: false },
  out_of_stock: { label: 'Out of stock', good: false }, cold_food: { label: 'Cold food', good: false }, small_portion: { label: 'Small portion', good: false },
  great_taste: { label: 'Great taste', good: true }, great_service: { label: 'Great service', good: true }, good_value: { label: 'Good value', good: true }, fast_service: { label: 'Fast service', good: true },
}
export const CATEGORY: Record<string, { label: string; color: string }> = {
  praise: { label: 'Praise', color: 'var(--green)' }, complaint: { label: 'Complaint', color: 'var(--red)' },
  suggestion: { label: 'Suggestion', color: '#2b4ff6' }, question: { label: 'Question', color: '#8a5cf6' }, mixed: { label: 'Mixed', color: '#e8a000' },
  uncategorised: { label: 'Not categorised', color: '#a8a290' },
}

const sevRank = (n: Note) => SEV[n.severity ?? 'none']?.rank ?? 0
// Bad reviews: negative overall, or serious on any axis. Worst first, then newest.
export const isBad = (n: Note) => n.sentiment === 'negative' || sevRank(n) >= 3
export const badReviews = (notes: Note[]) =>
  notes.filter(isBad).sort((a, b) => sevRank(b) - sevRank(a) || +new Date(b.created_at) - +new Date(a.created_at))

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

// Vendor actions on one piece of feedback, supplied by the dashboard (which holds the session).
export type FeedbackActs = {
  translate: (id: string) => Promise<string>
  ignore: (id: string, ignored: boolean) => Promise<void>
}

export function ReviewCard({ n, compact, act, ignored }: { n: Note; compact?: boolean; act?: FeedbackActs; ignored?: boolean }) {
  const [tr, setTr] = useState<string | null>(n.translation)
  const [show, setShow] = useState(!!n.translation)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const sev = n.severity && n.severity !== 'none' ? n.severity : null
  const english = /^english$/i.test(n.language ?? '')

  const translate = async () => {
    if (tr) { setShow(v => !v); return }
    setBusy(true); setErr('')
    try { setTr(await act!.translate(n.id)); setShow(true) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not translate') }
    finally { setBusy(false) }
  }
  const ignore = async () => { setBusy(true); try { await act!.ignore(n.id, !ignored) } finally { setBusy(false) } }

  return (
    <div className={`fb-card ${isBad(n) && !ignored ? 'bad' : ''} ${ignored ? 'ignored' : ''}`}>
      <div className="fb-top">
        <span>{sentimentEmoji(n.sentiment)} <b style={{ textTransform: 'capitalize' }}>{n.sentiment}</b>
          {sev && <span className={`sev ${sev}`}>{SEV[sev].label}</span>}
          {n.category && <span className="cat">{CATEGORY[n.category]?.label ?? n.category}</span>}</span>
        <span className="muted small">{n.student}{n.seq ? ` · #${n.seq}` : ''} · {ago(n.created_at)}</span>
      </div>
      {n.summary && <p className="fb-summary">{n.summary}</p>}
      <p className={`fb-quote ${compact ? 'small' : ''}`}>“{n.transcript}”</p>
      {tr && show && <p className="fb-trans"><span>English</span>{tr}</p>}
      {err && <div className="fb-err">{err}</div>}
      <div className="fb-tags">
        {n.flags.map(f => <span key={f} className={`flag ${FLAG[f]?.good ? 'good' : 'bad'}`}>{FLAG[f]?.label ?? f}</span>)}
        {n.language && <span className="flag lang">{n.language[0].toUpperCase() + n.language.slice(1)}</span>}
        {n.items && <span className="muted small">Ordered: {n.items}</span>}
        {act && (
          <span className="fb-actions">
            {!english && <button onClick={translate} disabled={busy} aria-label="Translate to English">{busy && !tr ? 'Translating…' : tr ? (show ? 'Hide translation' : 'Show translation') : 'Translate'}</button>}
            <button className={ignored ? '' : 'ignore'} onClick={ignore} disabled={busy} aria-label={ignored ? 'Restore feedback' : 'Ignore feedback'}>{ignored ? 'Restore' : 'Ignore'}</button>
          </span>
        )}
      </div>
    </div>
  )
}

export function NeedsAttention({ notes, limit = 4, act }: { notes: Note[]; limit?: number; act?: FeedbackActs }) {
  const [all, setAll] = useState(false)
  const bad = badReviews(notes)
  const critical = bad.filter(n => sevRank(n) >= 4).length
  const shown = all ? bad : bad.slice(0, limit)
  return (
    <div className="fb-section">
      <div className="fb-head">
        <b>Needs attention</b>
        <span className="muted small">{bad.length === 0 ? 'Nothing to fix right now' : `${bad.length} bad review${bad.length === 1 ? '' : 's'}${critical ? ` · ${critical} critical` : ''}`}</span>
      </div>
      {bad.length === 0 && <div className="fb-empty">No bad reviews. Keep it up.</div>}
      {shown.map(n => <ReviewCard key={n.id} n={n} act={act} />)}
      {bad.length > limit && <button className="c-link" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${bad.length}`}</button>}
    </div>
  )
}

// Feedback the vendor marked irrelevant. It is left out of every count and chart, and can be restored.
export function IgnoredList({ notes, act }: { notes: Note[]; act: FeedbackActs }) {
  const [open, setOpen] = useState(false)
  if (notes.length === 0) return null
  return (
    <div className="fb-section">
      <button className="c-link" style={{ marginTop: 0 }} onClick={() => setOpen(v => !v)}>{open ? 'Hide' : 'Show'} ignored feedback ({notes.length})</button>
      {open && <div className="muted small">Ignored feedback is not counted in your sentiment, themes or charts.</div>}
      {open && notes.map(n => <ReviewCard key={n.id} n={n} act={act} ignored compact />)}
    </div>
  )
}

export function CategoryBars({ categories }: { categories: Record<string, number> }) {
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, e) => s + e[1], 0)
  if (!total) return <div className="muted small">No reviews yet.</div>
  return (<div>
    <div className="c-stack tall">{entries.map(([k, v]) => <i key={k} style={{ width: `${(v / total) * 100}%`, background: CATEGORY[k]?.color ?? '#aaa' }} title={`${CATEGORY[k]?.label ?? k}: ${v}`} />)}</div>
    <div className="legend">{entries.map(([k, v]) => <span key={k}><i style={{ background: CATEGORY[k]?.color ?? '#aaa' }} />{CATEGORY[k]?.label ?? k} <b>{v}</b></span>)}</div>
  </div>)
}

export function FlagBars({ flags, good }: { flags: Record<string, number>; good: boolean }) {
  const entries = Object.entries(flags).filter(([k]) => (FLAG[k]?.good ?? false) === good).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(e => e[1]))
  if (entries.length === 0) return <div className="muted small">{good ? 'No praise tags yet.' : 'No issues tagged. Nice.'}</div>
  return (<div>{entries.map(([k, v]) => (
    <div key={k} className="c-bar-row"><span>{FLAG[k]?.label ?? k}</span>
      <span className="c-track"><i style={{ width: `${(v / max) * 100}%`, background: good ? 'var(--green)' : 'var(--red)' }} /></span><b>{v}</b></div>
  ))}</div>)
}
