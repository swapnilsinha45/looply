import { useCallback, useEffect, useState } from 'react'
import Console from './Console'
import { rpc } from './api'
import { sentimentEmoji } from './sentiment'

export type Item = { id: string; sku: string; name: string; description: string; price: number; veg: boolean; stock: number; active: boolean }
type Note = { id: string; transcript: string; sentiment: string; sentiment_score: number; duration_sec: number; topics: string[]; created_at: string; student: string; seq: number | null }
export type Dash = {
  store: { id: string; code: string; name: string; tags: string; description: string; pure_veg: boolean; eta_min: number; open: boolean; phone: string | null }
  owner: { name: string; email: string; phone: string | null }
  orders_today: number; revenue_today: number; voice_notes: number; orders_total: number
  items: Item[]
  low_stock: { id: string; name: string; stock: number }[]
  topics: Record<string, number>
  sentiment: { positive: number; neutral: number; negative: number; avg: number }
  aspects: Record<string, { avg: number; n: number }>
  notes: Note[]
  queue: { id: string; seq: number; total: number; status: string; created_at: string; student_name: string; items: string; note_sec: number | null; note_sentiment: string | null }[]
}

export type Analytics = {
  orders_today: number; revenue_today: number; orders_yesterday: number; revenue_yesterday: number; avg_order_value: number
  orders_total: number; notes_total: number
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
const NEXT: Record<string, string> = { new: 'preparing', preparing: 'ready', ready: 'done' }
const LABEL: Record<string, string> = { new: 'New → Prepare', preparing: 'Preparing → Ready', ready: 'Ready → Done' }
const blank: Item = { id: '', sku: '', name: '', description: '', price: 0, veg: true, stock: 20, active: true }

export default function Vendor({ token, logout, say }: { token: string; logout: () => void; say: (m: string) => void }) {
  const [d, setD] = useState<Dash | null>(null)
  const [a, setA] = useState<Analytics | null>(null)
  const wide = useWide()
  const [tab, setTab] = useState<'orders' | 'menu' | 'insights' | 'store'>('orders')
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)

  const load = useCallback(() => Promise.all([
    rpc<Dash>('vendor_dashboard', { p_token: token }),
    rpc<Analytics>('vendor_analytics', { p_token: token }),
  ]).then(([x, y]) => { setD(x); setA(y); setErr('') }).catch(e => {
    setErr(errMsg(e)); if (/expired/i.test(errMsg(e))) logout()
  }), [token, logout])
  useEffect(() => { load(); const t = setInterval(() => { if (!editing) load() }, 5000); return () => clearInterval(t) }, [load, editing])

  const run = async (fn: string, args: Record<string, unknown>, ok?: string) => {
    try { await rpc(fn, { p_token: token, ...args }); if (ok) say(ok); await load(); return true } catch (e) { say(errMsg(e)); return false }
  }
  if (!d || !a) return <div className="center">{err || 'Loading dashboard…'}</div>
  if (wide) return <Console d={d} a={a} run={run} logout={logout} />

  const advance = (id: string, status: string) => run('vendor_set_status', { p_order: id, p_status: NEXT[status] })
  const restock = (i: Item) => run('vendor_upsert_item', { p_id: i.id, p_sku: i.sku, p_name: i.name, p_desc: i.description, p_price: i.price, p_veg: i.veg, p_stock: i.stock + 50, p_active: i.active }, `${i.name} restocked +50`)
  const pct = d.orders_total ? Math.round((d.voice_notes / d.orders_total) * 100) : 0

  return (
    <div className="screen">
      <div className="hero">
        <div className="row">
          <div style={{ flex: 1 }}><h1 style={{ fontSize: 22 }}>{d.store.name}</h1>
            <div className="sub">{d.store.open ? 'Accepting orders' : 'Closed to new orders'} · {d.store.code}</div></div>
          <span className="badge-v">VENDOR</span>
        </div>
      </div>

      <div className="scroll stack">
        {tab === 'orders' && (<>
          <div className="stats">
            <div className="card stat"><span className="muted small">Orders today</span><b>{a.orders_today}</b></div>
            <div className="card stat"><span className="muted small">Revenue today</span><b>{rupee(a.revenue_today)}</b></div>
            <div className="card stat"><span className="muted small">Voice notes</span><b>{d.voice_notes}</b><span className="up">{pct}% of orders</span></div>
            <div className="card stat"><span className="muted small">Mood</span><b>{d.sentiment.positive + d.sentiment.neutral + d.sentiment.negative ? sentimentEmoji(d.sentiment.avg > 0.15 ? 'positive' : d.sentiment.avg < -0.15 ? 'negative' : 'neutral') : '—'}</b>
              <span className="small muted">avg {d.sentiment.avg > 0 ? '+' : ''}{d.sentiment.avg}</span></div>
          </div>
          {d.low_stock.map(i => {
            const it = d.items.find(x => x.id === i.id)
            return <div key={i.id} className="alert"><span>{i.name}: {i.stock === 0 ? 'sold out' : `only ${i.stock} left`}.</span>{it && <button onClick={() => restock(it)}>Restock +50 ›</button>}</div>
          })}
          <b>Live queue</b>
          {d.queue.length === 0 && <div className="muted center" style={{ padding: 16 }}>No open orders. New orders appear here within 5 seconds.</div>}
          {d.queue.map(o => (
            <div key={o.id} className="card"><div className="qrow">
              <div><b>#{o.seq}</b> {o.student_name}<div className="small muted" style={{ marginTop: 4 }}>{o.items}</div>
                {o.note_sec != null && <span className="note">Voice note {sentimentEmoji(o.note_sentiment ?? 'neutral')} {o.note_sec}s</span>}</div>
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
                  <span className="small" style={{ color: i.stock <= 10 ? 'var(--red)' : 'var(--muted)', fontWeight: 700 }}>{i.stock === 0 ? 'Sold out' : `${i.stock} in stock`}</span></div>
              </div>
              <div className="actions">
                <button onClick={() => setEditing(i)}>Edit</button>
                <button onClick={() => restock(i)}>+50 stock</button>
                <button onClick={() => run('vendor_upsert_item', { p_id: i.id, p_sku: i.sku, p_name: i.name, p_desc: i.description, p_price: i.price, p_veg: i.veg, p_stock: i.stock, p_active: !i.active })}>{i.active ? 'Hide' : 'Show'}</button>
                <button className="danger" onClick={() => { if (confirm(`Delete ${i.name} (${i.sku})? This cannot be undone.`)) run('vendor_delete_item', { p_id: i.id }, `${i.name} deleted`) }}>Delete</button>
              </div>
            </div>
          ))}
        </>)}

        {tab === 'insights' && <Insights d={d} />}
        {tab === 'store' && <StoreTab d={d} run={run} logout={logout} />}
      </div>

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSave={async it => {
        const ok = await run('vendor_upsert_item', { p_id: it.id || null, p_sku: it.sku, p_name: it.name, p_desc: it.description, p_price: it.price, p_veg: it.veg, p_stock: it.stock, p_active: it.active }, it.id ? 'Product updated' : 'Product added')
        if (ok) setEditing(null)
      }} />}

      <div className="tabs">
        {(['orders', 'menu', 'insights', 'store'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'menu' ? 'Products' : t[0].toUpperCase() + t.slice(1)}</button>)}
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

function Insights({ d }: { d: Dash }) {
  const s = d.sentiment
  const total = s.positive + s.neutral + s.negative
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`
  return (<>
    <div className="card">
      <b>Voice sentiment</b>
      {total === 0 ? <div className="muted small" style={{ marginTop: 6 }}>No voice notes yet. Reviews students send will be analysed here.</div> : (<>
        <div className="stackbar"><i style={{ width: w(s.positive), background: 'var(--green)' }} /><i style={{ width: w(s.neutral), background: '#c9c2ad' }} /><i style={{ width: w(s.negative), background: 'var(--red)' }} /></div>
        <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>😊 {s.positive} positive</span><span>😐 {s.neutral} neutral</span><span>😞 {s.negative} negative</span></div>
        <div className="muted small" style={{ marginTop: 6 }}>Average score {s.avg > 0 ? '+' : ''}{s.avg} (−1 to +1) from {total} notes</div>
      </>)}
    </div>
    {Object.keys(d.aspects).length > 0 && <div className="card"><b>What students talk about</b>
      {Object.entries(d.aspects).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => (
        <div key={k} className="aspect-row"><span>{k} <span className="muted small">({v.n})</span></span>
          <span className="abar"><i style={{ left: `${((v.avg + 1) / 2) * 100}%`, background: v.avg > 0.15 ? 'var(--green)' : v.avg < -0.15 ? 'var(--red)' : '#999' }} /></span>
          <b className="small" style={{ width: 40, textAlign: 'right', color: v.avg > 0.15 ? 'var(--green)' : v.avg < -0.15 ? 'var(--red)' : 'var(--muted)' }}>{v.avg > 0 ? '+' : ''}{v.avg}</b></div>
      ))}
    </div>}
    <b>Latest reviews</b>
    {d.notes.length === 0 && <div className="muted center">Nothing here yet.</div>}
    {d.notes.map(n => (
      <div key={n.id} className="card">
        <div className="qrow"><span>{sentimentEmoji(n.sentiment)} <b style={{ textTransform: 'capitalize' }}>{n.sentiment}</b> <span className="muted small">{n.sentiment_score > 0 ? '+' : ''}{n.sentiment_score.toFixed(2)}</span></span>
          <span className="small muted">{n.student}{n.seq ? ` · #${n.seq}` : ''}</span></div>
        <p style={{ margin: '8px 0', fontSize: 14 }}>“{n.transcript}”</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{n.topics.map(t => <span key={t} className="chip-s">{t}</span>)}</div>
      </div>
    ))}
  </>)
}

export function StoreTab({ d, run, logout }: { d: Dash; run: (fn: string, a: Record<string, unknown>, ok?: string) => Promise<boolean>; logout: () => void }) {
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
    <button className="btn ghost" onClick={logout}>Sign out</button>
  </>)
}
