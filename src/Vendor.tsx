import { useCallback, useEffect, useRef, useState } from 'react'
import Console from './Console'
import type { Feedback } from './api'
import { NeedsAttention, ReviewCard, CategoryBars, IgnoredList, TimeFilter, ProductSentiment, inRange, summarise, forProduct } from './Feedback'
import type { Range } from './Feedback'
import { CATEGORIES } from './Auth'
import { TabIcon, store } from './ui'
import Tour, { clearTour, tourPending, vendorSteps } from './Tour'
import type { FeedbackActs } from './Feedback'
import { rpc } from './api'
import { sentimentEmoji } from './sentiment'

export type Item = { id: string; sku: string; name: string; description: string; price: number; veg: boolean; stock: number; active: boolean; category: string; low_stock_at: number }
type Note = { id: string; transcript: string; sentiment: string; sentiment_score: number; duration_sec: number; topics: string[]; created_at: string; student: string; seq: number | null }
export type Dash = {
  store: { id: string; code: string; name: string; tags: string; description: string; pure_veg: boolean; eta_min: number; open: boolean; phone: string | null }
  owner: { name: string; email: string; phone: string | null }
  orders_today: number; revenue_today: number; voice_notes: number; orders_total: number
  items: Item[]
  low_stock: { id: string; name: string; stock: number; low_stock_at: number }[]
  topics: Record<string, number>
  sentiment: { positive: number; neutral: number; negative: number; avg: number }
  aspects: Record<string, { avg: number; n: number }>
  notes: Note[]
  queue: { id: string; seq: number; total: number; status: string; created_at: string; student_name: string; items: string; note_sec: number | null; note_sentiment: string | null }[]
}

export type Analytics = {
  orders_today: number; revenue_today: number; orders_yesterday: number; revenue_yesterday: number; avg_order_value: number
  orders_total: number; notes_total: number; useful_notes: number
  hourly: { h: number; n: number }[]
  top_products: { name: string; units: number }[]
  daily_sentiment: { day: string; score: number | null; n: number }[]
  hourly_sentiment: { h: number; score: number; n: number }[]
  by_product: { name: string; score: number; n: number }[]
  by_theme: Record<string, { pos: number; neu: number; neg: number }>
  sentiment: { positive: number; neutral: number; negative: number; net: number }
  rewards: { rewarded_orders: number; discount_total: number; students_with_notes: number; students_unlocked: number }
  orders: { id: string; seq: number; total: number; status: string; created_at: string; student: string; items: string; note_sentiment: string | null; has_note: boolean }[]
  notes: { id: string; transcript: string; sentiment: string; sentiment_score: number; topics: string[]; language: string | null; created_at: string; seq: number | null; student: string; items: string | null }[]
}

// The Figma "vendor console" layout is for desktop; phones keep the compact app layout.
const useWide = () => {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)')
    const f = () => setWide(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return wide
}

const rupee = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
export const itemArgs = (i: Item) => ({ p_id: i.id || null, p_sku: i.sku, p_name: i.name, p_desc: i.description, p_price: i.price, p_veg: i.veg, p_stock: i.stock, p_active: i.active, p_category: i.category, p_low_stock_at: i.low_stock_at })
const NEXT: Record<string, string> = { new: 'preparing', preparing: 'ready', ready: 'done' }
const LABEL: Record<string, string> = { new: 'New → Prepare', preparing: 'Preparing → Ready', ready: 'Ready → Done' }
// Pause or resume new orders in one tap (testers could not find this inside Store settings).
export const storeOpenArgs = (s: Dash['store'], open: boolean) => ({ p_name: s.name, p_tags: s.tags, p_description: s.description, p_pure_veg: s.pure_veg, p_eta: s.eta_min, p_open: open, p_phone: s.phone ?? '' })
const blank: Item = { id: '', sku: '', name: '', description: '', price: 0, veg: true, stock: 20, active: true, category: 'snack', low_stock_at: 10 }

export default function Vendor({ token, logout, say, startDesktop }: { token: string; logout: () => void; say: (m: string) => void; startDesktop?: boolean }) {
  const [d, setD] = useState<Dash | null>(null)
  const [a, setA] = useState<Analytics | null>(null)
  const [f, setF] = useState<Feedback | null>(null)
  const wide = useWide()
  // always opens in the phone layout; the desktop console is one tap away
  const [view, setView] = useState<'phone' | 'desktop'>(startDesktop ? 'desktop' : 'phone')
  const [tab, setTab] = useState<'orders' | 'menu' | 'insights' | 'store'>('orders')
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)
  const [restocking, setRestocking] = useState<Item | null>(null)
  const lowSeen = useRef<Set<string> | null>(null)
  const [touring, setTouring] = useState(false)
  const tourChecked = useRef(false)

  const load = useCallback(() => Promise.all([
    rpc<Dash>('vendor_dashboard', { p_token: token }),
    rpc<Analytics>('vendor_analytics', { p_token: token }),
    rpc<Feedback>('vendor_feedback', { p_token: token }),
  ]).then(([x, y, z]) => {
    if (lowSeen.current) for (const i of x.low_stock) if (!lowSeen.current.has(i.id)) say(i.stock === 0 ? `${i.name} just sold out. Restock it from Products.` : `${i.name} is running low: ${i.stock} left`)
    lowSeen.current = new Set(x.low_stock.map(i => i.id))
    setD(x); setA(y); setF(z); setErr('')
  }).catch(e => {
    setErr(errMsg(e)); if (/expired/i.test(errMsg(e))) logout()
  }), [token, logout, say])
  useEffect(() => { load(); const t = setInterval(() => { if (!editing) load() }, 5000); return () => clearInterval(t) }, [load, editing])

  const run = async (fn: string, args: Record<string, unknown>, ok?: string) => {
    try { await rpc(fn, { p_token: token, ...args }); if (ok) say(ok); await load(); return true } catch (e) { say(errMsg(e)); return false }
  }
  const act: FeedbackActs = {
    translate: async id => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
        body: JSON.stringify({ token, note_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Translation failed')
      return data.translation as string
    },
    ignore: async (id, ignored) => {
      try {
        await rpc('vendor_ignore_note', { p_token: token, p_id: id, p_ignored: ignored })
        say(ignored ? 'Feedback ignored. You can restore it under Ignored feedback.' : 'Feedback restored')
        await load()
      } catch (e) { say(errMsg(e)) }
    },
  }
  useEffect(() => {
    if (!d || tourChecked.current) return
    tourChecked.current = true
    if (tourPending()) setTouring(true)
  }, [d])
  const endTour = useCallback(() => { clearTour(); setTouring(false); setTab('orders') }, [])

  if (!d || !a || !f) return <div className="center">{err || 'Loading dashboard…'}</div>
  if (wide && view === 'desktop') return <Console d={d} a={a} f={f} act={act} run={run} logout={logout} onPhone={() => setView('phone')} touring={touring} onTour={() => setTouring(true)} onTourEnd={endTour} />

  const doRestock = async (i: Item, qty: number) => { if (await run('vendor_restock', { p_item: i.id, p_qty: qty }, `Added ${qty} to ${i.name}`)) setRestocking(null) }

  const advance = (id: string, status: string) => run('vendor_set_status', { p_order: id, p_status: NEXT[status] })

  return (
    <div className="screen">
      <div className="hero">
        <div className="row">
          <div style={{ flex: 1 }}><h1 style={{ fontSize: 22 }}>{d.store.name}</h1>
            <div className="sub">{d.store.open ? 'Accepting orders' : 'Closed to new orders'} · {d.store.code}</div></div>
          <button data-tour="pause" className={`pause-btn ${d.store.open ? '' : 'closed'}`} onClick={() => run('vendor_update_store', storeOpenArgs(d.store, !d.store.open), d.store.open ? 'New orders paused' : 'Accepting orders again')}>
            {d.store.open ? 'Pause orders' : 'Resume orders'}</button>
        </div>
        {wide && <button data-tour="desktop" className="desk-btn" onClick={() => setView('desktop')}>Open desktop dashboard <span>›</span></button>}
      </div>

      <div className="scroll stack">
        <StockAlerts low={d.low_stock} items={d.items} onRestock={setRestocking} />
        {tab === 'orders' && (<>
          <div className="stats" data-tour="stats">
            <div className="card stat"><span className="muted small">Orders today</span><b>{a.orders_today}</b></div>
            <div className="card stat"><span className="muted small">Revenue today</span><b>{rupee(a.revenue_today)}</b></div>
            <div className="card stat"><span className="muted small">Actionable feedback</span><b>{a.useful_notes}</b><span className="up">{a.notes_total ? Math.round((a.useful_notes / a.notes_total) * 100) : 0}% of {a.notes_total} notes</span></div>
            <div className="card stat"><span className="muted small">Student mood</span><b>{d.sentiment.positive + d.sentiment.neutral + d.sentiment.negative ? sentimentEmoji(d.sentiment.avg > 0.15 ? 'positive' : d.sentiment.avg < -0.15 ? 'negative' : 'neutral') : '—'}</b>
              <span className="small muted">How reviews feel overall: {d.sentiment.avg > 0 ? '+' : ''}{Math.round(d.sentiment.avg * 100)} on a −100 to +100 scale</span></div>
          </div>
          <b>Active orders <span className="muted small">({d.queue.length})</span></b>
          {d.queue.length === 0 && <div className="muted center" style={{ padding: 16 }}>No active orders. Done orders leave this list, and new ones appear within 5 seconds.</div>}
          {d.queue.map(o => (
            <div key={o.id} className="card"><div className="qrow">
              <div><b>#{o.seq}</b><div className="small muted" style={{ marginTop: 4 }}>{o.items}</div></div>
              <div className="r"><b>{rupee(o.total)}</b>
                <button className={`status ${o.status}`} onClick={() => advance(o.id, o.status)}>{LABEL[o.status]}</button></div>
            </div></div>
          ))}
        </>)}

        {tab === 'menu' && (<>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <b>{d.items.length} product{d.items.length === 1 ? '' : 's'}</b>
            <button className="add" onClick={() => setEditing({ ...blank })}>+ Add product</button>
          </div>
          {d.items.length === 0 && <div className="muted center">No products yet. Add your first SKU.</div>}
          {d.items.map(i => (
            <div key={i.id} className="card" style={{ opacity: i.active ? 1 : 0.6 }}>
              <div className="qrow">
                <div style={{ minWidth: 0 }}>
                  <div className="small muted">{i.sku}{!i.active && ' · hidden from students'}</div>
                  <b style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className={`vegmark ${i.veg ? '' : 'nv'}`} />{i.name}</b>
                  <div className="small muted">{i.description}</div>
                </div>
                <div className="r"><b>{rupee(i.price)}</b>
                  <span className="small" style={{ color: i.stock <= i.low_stock_at ? 'var(--red)' : 'var(--muted)', fontWeight: 700 }}>{i.stock === 0 ? 'Sold out' : `${i.stock} in stock`}</span>
                  <span className="small muted">warn at {i.low_stock_at}</span></div>
              </div>
              <div className="actions">
                <button onClick={() => setEditing(i)}>Edit</button>
                <button onClick={() => setRestocking(i)}>Restock</button>
                <button onClick={() => run('vendor_upsert_item', itemArgs({ ...i, active: !i.active }))}>{i.active ? 'Hide' : 'Show'}</button>
                <button className="danger" onClick={() => { if (confirm(`Delete ${i.name} (${i.sku})? This cannot be undone.`)) run('vendor_delete_item', { p_id: i.id }, `${i.name} deleted`) }}>Delete</button>
              </div>
            </div>
          ))}
        </>)}

        {tab === 'insights' && <Insights d={d} f={f} act={act} />}
        {tab === 'store' && <StoreTab d={d} run={run} logout={logout} onTour={() => setTouring(true)} />}
      </div>

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSave={async it => {
        const ok = await run('vendor_upsert_item', itemArgs(it), it.id ? 'Product updated' : 'Product added')
        if (ok) setEditing(null)
      }} />}
      {restocking && <RestockSheet item={restocking} onClose={() => setRestocking(null)} onAdd={q => doRestock(restocking, q)} />}

      {touring && <Tour steps={vendorSteps(d.store.name, wide)} setTab={setTab} onClose={endTour} />}
      <div className="tabs">
        {(['orders', 'menu', 'insights', 'store'] as const).map(t => <button key={t} data-tour={t === 'menu' ? 'products' : t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}><TabIcon name={t} /><span>{t === 'menu' ? 'Products' : t[0].toUpperCase() + t.slice(1)}</span></button>)}
      </div>
    </div>
  )
}

export function ItemSheet({ item, onClose, onSave }: { item: Item; onClose: () => void; onSave: (i: Item) => void }) {
  const [f, setF] = useState(item)
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setF(x => ({ ...x, [k]: v }))
  const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0))
  return (
    <div className="sheet-bg" onClick={onClose}>
      <form className="sheet" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onSave(f) }}>
        <h2 style={{ margin: '0 0 12px' }}>{item.id ? 'Edit product' : 'Add product'}</h2>
        <div className="two">
          <label><div className="label">SKU</div><input className="field sm" value={f.sku} onChange={e => set('sku', e.target.value.toUpperCase())} placeholder="Auto" maxLength={20} /></label>
          <label><div className="label">Product name</div><input className="field sm" value={f.name} onChange={e => set('name', e.target.value)} required maxLength={60} /></label>
        </div>
        <label><div className="label">Description</div><input className="field sm" value={f.description} onChange={e => set('description', e.target.value)} maxLength={100} /></label>
        <div className="two">
          <label><div className="label">Price (₹)</div><input className="field sm" inputMode="numeric" value={f.price} onChange={e => set('price', num(e.target.value))} /></label>
          <label><div className="label">Stock</div><input className="field sm" inputMode="numeric" value={f.stock} onChange={e => set('stock', num(e.target.value))} /></label>
        </div>
        <div className="two">
          <label><div className="label">Category</div>
            <select className="field sm" value={f.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label><div className="label">Warn me at</div><input className="field sm" inputMode="numeric" value={f.low_stock_at} onChange={e => set('low_stock_at', num(e.target.value))} aria-describedby="warn-help" /></label>
        </div>
        <div id="warn-help" className="small muted">You get an alert when stock falls to this number. Stock goes down by itself with every order.</div>
        <div className="two" style={{ margin: '10px 0' }}>
          <label className="check-row"><input type="checkbox" checked={f.veg} onChange={e => set('veg', e.target.checked)} /> Vegetarian</label>
          <label className="check-row"><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> Visible to students</label>
        </div>
        <button className="btn" disabled={!f.name.trim()}>{item.id ? 'Save changes' : 'Add product'}</button>
        <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </form>
    </div>
  )
}

// Restock by typing how many units arrived: no fixed +10 / +50 jumps.
export function RestockSheet({ item, onClose, onAdd }: { item: Item; onClose: () => void; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState('')
  const n = Math.min(10000, Number(qty) || 0)
  return (
    <div className="sheet-bg" onClick={onClose}>
      <form className="sheet" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (n > 0) onAdd(n) }}>
        <h2 style={{ margin: '0 0 4px' }}>Restock {item.name}</h2>
        <div className="small muted">{item.sku} · now {item.stock} in stock · warns at {item.low_stock_at}</div>
        <label style={{ display: 'block', marginTop: 14 }}><div className="label">Units received</div>
          <input className="field" inputMode="numeric" autoFocus value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="e.g. 24" /></label>
        {n > 0 && <div className="restock-preview">New stock will be <b>{item.stock + n}</b></div>}
        <button className="btn" disabled={n < 1} style={{ marginTop: 12 }}>{n > 0 ? `Add ${n} unit${n === 1 ? '' : 's'}` : 'Enter a quantity'}</button>
        <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
      </form>
    </div>
  )
}

function StockAlerts({ low, items, onRestock }: { low: Dash['low_stock']; items: Item[]; onRestock: (i: Item) => void }) {
  if (low.length === 0) return null
  const out = low.filter(i => i.stock === 0)
  return (
    <div className="stock-alerts" role="alert">
      <b>{out.length ? `${out.length} sold out` : ''}{out.length && low.length > out.length ? ' · ' : ''}{low.length > out.length ? `${low.length - out.length} running low` : ''}</b>
      {low.map(i => {
        const it = items.find(x => x.id === i.id)
        return (
          <div key={i.id} className={`sa-row ${i.stock === 0 ? 'out' : ''}`}>
            <span>{i.name}: {i.stock === 0 ? 'sold out' : `${i.stock} left (warns at ${i.low_stock_at})`}</span>
            {it && <button onClick={() => onRestock(it)}>Restock</button>}
          </div>
        )
      })}
    </div>
  )
}

function Insights({ d, f, act }: { d: Dash; f: Feedback; act: FeedbackActs }) {
  const [range, setRange] = useState<Range>('month')
  const [product, setProduct] = useState<string | null>(null)
  const inPeriod = f.notes.filter(n => inRange(n, range))
  const notes = inPeriod.filter(n => forProduct(n, product))
  const s = summarise(notes)
  const total = s.positive + s.neutral + s.negative
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`
  void d
  return (<>
    <TimeFilter value={range} onChange={r => { setRange(r); setProduct(null) }} notes={f.notes} />
    {product && <div className="filter-pill">Showing <b>{product}</b> <button onClick={() => setProduct(null)} aria-label="Clear product filter">✕</button></div>}
    <NeedsAttention notes={notes} limit={3} act={act} />
    <div className="card">
      <b>Voice sentiment</b>
      {total === 0 ? <div className="muted small" style={{ marginTop: 6 }}>No reviews in this period.</div> : (<>
        <div className="stackbar"><i style={{ width: w(s.positive), background: 'var(--green)' }} /><i style={{ width: w(s.neutral), background: '#c9c2ad' }} /><i style={{ width: w(s.negative), background: 'var(--red)' }} /></div>
        <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>😊 {s.positive} positive</span><span>😐 {s.neutral} neutral</span><span>😞 {s.negative} negative</span></div>
        <div className="muted small" style={{ marginTop: 6 }}>Average mood {s.avg > 0 ? '+' : ''}{Math.round(s.avg * 100)} (−100 to +100) from {total} review{total === 1 ? '' : 's'}</div>
      </>)}
    </div>
    <div className="card"><b>By product</b><div style={{ marginTop: 10 }}><ProductSentiment notes={inPeriod} selected={product} onSelect={setProduct} /></div></div>
    <div className="card"><b>Types of feedback</b><div style={{ marginTop: 10 }}><CategoryBars categories={s.categories} /></div></div>
    {Object.keys(s.aspects).length > 0 && <div className="card"><b>What students talk about</b>
      {Object.entries(s.aspects).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => { const avg = v.sum / v.n; return (
        <div key={k} className="aspect-row"><span>{k} <span className="muted small">({v.n})</span></span>
          <span className="abar"><i style={{ left: `${((avg + 1) / 2) * 100}%`, background: avg > 0.15 ? 'var(--green)' : avg < -0.15 ? 'var(--red)' : '#999' }} /></span>
          <b className="small" style={{ width: 40, textAlign: 'right', color: avg > 0.15 ? 'var(--green)' : avg < -0.15 ? 'var(--red)' : 'var(--muted)' }}>{avg > 0 ? '+' : ''}{Math.round(avg * 100)}</b></div>) })}
    </div>}
    <b>Reviews <span className="muted small">({notes.length})</span></b>
    {notes.length === 0 && <div className="muted center">Nothing here for this period.</div>}
    {notes.slice(0, 30).map(n => <ReviewCard key={n.id} n={n} compact act={act} />)}
    <IgnoredList notes={f.ignored} act={act} />
  </>)
}

export function StoreTab({ d, run, logout, onTour }: { d: Dash; run: (fn: string, a: Record<string, unknown>, ok?: string) => Promise<boolean>; logout: () => void; onTour?: () => void }) {
  const s = d.store
  const [f, setF] = useState({ name: s.name, tags: s.tags, description: s.description, pure_veg: s.pure_veg, eta: s.eta_min, open: s.open, phone: s.phone ?? '' })
  return (<>
    <form className="card stack" onSubmit={e => { e.preventDefault(); run('vendor_update_store', { p_name: f.name, p_tags: f.tags, p_description: f.description, p_pure_veg: f.pure_veg, p_eta: f.eta, p_open: f.open, p_phone: f.phone }, 'Store updated') }}>
      <b>Store settings</b>
      <label><div className="label">Store name</div><input className="field sm" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label><div className="label">Categories</div><input className="field sm" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} /></label>
      <label><div className="label">Description</div><input className="field sm" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
      <div className="two">
        <label><div className="label">Prep time (min)</div><input className="field sm" inputMode="numeric" value={f.eta} onChange={e => setF({ ...f, eta: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
        <label><div className="label">Phone</div><input className="field sm" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
      </div>
      <label className="check-row"><input type="checkbox" checked={f.pure_veg} onChange={e => setF({ ...f, pure_veg: e.target.checked })} /> Pure vegetarian store</label>
      <label className="check-row"><input type="checkbox" checked={f.open} onChange={e => setF({ ...f, open: e.target.checked })} /> Open for orders</label>
      <button className="btn">Save store</button>
    </form>
    <div className="card small"><b>Account</b><div className="muted" style={{ marginTop: 6 }}>{d.owner.name} · {d.owner.email}</div></div>
    {onTour && <button className="btn ghost" onClick={onTour}>Take the tour again</button>}
    <button className="btn ghost" onClick={logout}>Sign out</button>
    <DeleteAccount storeName={s.name} logout={logout} />
  </>)
}

// Delete the vendor account after the password is typed again. Stores with past orders are closed,
// hidden and stripped of personal details so students keep their own history; empty stores are removed fully.
function DeleteAccount({ storeName, logout }: { storeName: string; logout: () => void }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const del = async () => {
    setBusy(true); setErr('')
    try {
      await rpc('vendor_delete_account', { p_token: store.get('looply_vendor'), p_password: pw })
      logout()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (<>
    <button className="btn danger-link" onClick={() => setOpen(true)}>Delete account</button>
    {open && (
      <div className="sheet-bg" onClick={() => !busy && setOpen(false)}>
        <form className="sheet" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (pw) del() }}>
          <h2 style={{ margin: '0 0 6px' }}>Delete {storeName}?</h2>
          <p className="small muted" style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
            Your login, menu and contact details are deleted and the store disappears for students. This cannot be undone.
            Students keep their own past orders and reviews.</p>
          <label><div className="label">Type your password to confirm</div>
            <input className="field" type="password" autoComplete="current-password" autoFocus value={pw} onChange={e => setPw(e.target.value)} /></label>
          {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
          <button className="btn danger" disabled={!pw || busy} style={{ marginTop: 12 }}>{busy ? 'Deleting…' : 'Delete account permanently'}</button>
          <button type="button" className="btn ghost" style={{ marginTop: 8 }} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        </form>
      </div>
    )}
  </>)
}
