import { useState } from 'react'
import type { Analytics, Dash, Item } from './Vendor'
import type { Feedback } from './api'
import { CATEGORY, CategoryBars, FlagBars, IgnoredList, NeedsAttention, ReviewCard } from './Feedback'
import type { FeedbackActs } from './Feedback'
import { ItemSheet, StoreTab } from './Vendor'
import { sentimentEmoji } from './sentiment'

type Run = (fn: string, args: Record<string, unknown>, ok?: string) => Promise<boolean>
type Props = { d: Dash; a: Analytics; f: Feedback; act: FeedbackActs; run: Run; logout: () => void; onPhone: () => void; initial?: Section }
type Section = 'overview' | 'orders' | 'products' | 'inventory' | 'insights' | 'sentiment' | 'rewards' | 'settings'

const rupee = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`
const NAV: { id: Section; label: string; group?: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'orders', label: 'Orders' }, { id: 'products', label: 'Products' }, { id: 'inventory', label: 'Inventory' },
  { id: 'insights', label: 'Feedback insights', group: 'Voice intelligence' }, { id: 'sentiment', label: 'Sentiment analysis' },
  { id: 'rewards', label: 'Rewards' }, { id: 'settings', label: 'Settings' },
]
const SUB: Record<Section, string> = {
  overview: 'live from campus orders and voice notes', orders: 'active orders first, done ones move to the Done tab', products: 'your menu and SKUs',
  inventory: 'stock levels and restocking', insights: 'what students actually said, in their own words',
  sentiment: 'how students feel, scored from every voice note', rewards: 'perks for students who keep feedback on and order', settings: 'store profile and account',
}
const NEXT: Record<string, string> = { new: 'preparing', preparing: 'ready', ready: 'done' }
const ACTION: Record<string, string> = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Mark done' }
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

const delta = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null)
const Delta = ({ now, before }: { now: number; before: number }) => {
  const p = delta(now, before)
  if (p === null) return <span className="c-delta muted">no data yesterday</span>
  return <span className={`c-delta ${p >= 0 ? 'up' : 'down'}`}>{p >= 0 ? '▲' : '▼'} {Math.abs(p)}% vs yesterday</span>
}

export default function Console({ d, a, f, act, run, logout, onPhone, initial }: Props) {
  const [sec, setSec] = useState<Section>(initial ?? 'overview')
  const [editing, setEditing] = useState<Item | null>(null)
  const blank: Item = { id: '', sku: '', name: '', description: '', price: 0, veg: true, stock: 20, active: true }
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const save = (i: Item, patch: Partial<Item>) => {
    const n = { ...i, ...patch }
    return run('vendor_upsert_item', { p_id: n.id || null, p_sku: n.sku, p_name: n.name, p_desc: n.description, p_price: n.price, p_veg: n.veg, p_stock: n.stock, p_active: n.active })
  }
  const advance = (id: string, status: string) => run('vendor_set_status', { p_order: id, p_status: NEXT[status] })

  return (
    <div className="console">
      <aside className="c-side">
        <div className="c-brand"><i>L</i><div><b>Looply</b><span>Vendor console</span></div></div>
        <nav>
          {NAV.map(n => (
            <div key={n.id}>
              {n.group && <div className="c-group">{n.group}</div>}
              <button className={sec === n.id ? 'on' : ''} onClick={() => setSec(n.id)}><span className="c-dot" />{n.label}</button>
            </div>
          ))}
        </nav>
        <div className="c-side-foot">
          <div className="c-store"><b>{d.store.name}</b><span>{d.owner.email}</span></div>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="c-main">
        <header className="c-head">
          <div><h1>{NAV.find(n => n.id === sec)!.label}</h1><div className="muted">{today} · {SUB[sec]}</div></div>
          <div className="c-head-r">
            <button className="c-btn ghost" onClick={onPhone}>Phone view</button>
            <span className={`c-pill ${d.store.open ? 'ok' : 'off'}`}>{d.store.open ? '● Accepting orders' : '● Closed'}</span>
            {sec === 'products' && <button className="c-btn" onClick={() => setEditing({ ...blank })}>+ Add product</button>}
          </div>
        </header>

        {sec === 'overview' && (<>
          <div className="c-stats">
            <div className="c-card"><span className="muted">Orders today</span><b>{a.orders_today}</b><Delta now={a.orders_today} before={a.orders_yesterday} /></div>
            <div className="c-card"><span className="muted">Revenue</span><b>{rupee(a.revenue_today)}</b><Delta now={a.revenue_today} before={a.revenue_yesterday} /></div>
            <div className="c-card"><span className="muted">Avg order value</span><b>{rupee(a.avg_order_value)}</b><span className="c-delta muted">today</span></div>
            <div className="c-card"><span className="muted">Actionable feedback</span><b>{a.useful_notes}</b><span className="c-delta up">{a.notes_total ? Math.round((a.useful_notes / a.notes_total) * 100) : 0}% of {a.notes_total} notes are specific</span></div>
          </div>
          <div className="c-grid2">
            <div className="c-card">
              <b className="c-title">Orders by hour</b>
              <div className="muted small">{(() => { const pk = [...a.hourly].sort((x, y) => y.n - x.n)[0]; return pk && pk.n > 0 ? `Peak ${hr(pk.h)}: ${pk.n} orders today` : 'No orders yet today' })()}</div>
              <HourBars data={a.hourly} />
            </div>
            <div className="c-card">
              <b className="c-title">Low stock</b>
              {d.low_stock.length === 0 ? <div className="muted small" style={{ marginTop: 8 }}>Everything is well stocked.</div> :
                d.low_stock.map(i => (
                  <div key={i.id} className="c-row"><span>{i.name}</span><b className="down">{i.stock === 0 ? 'Sold out' : `${i.stock} left`}</b></div>
                ))}
              <button className="c-link" onClick={() => setSec('inventory')}>Open inventory ›</button>
            </div>
          </div>
          <div className="c-grid2">
            <div className="c-card">
              <b className="c-title">Top products today</b><div className="muted small">Units sold</div>
              {a.top_products.length === 0 && <div className="muted small" style={{ marginTop: 8 }}>No sales yet today.</div>}
              {a.top_products.map(p => <BarRow key={p.name} label={p.name} value={p.units} max={a.top_products[0].units} text={String(p.units)} />)}
            </div>
            <div className="c-card">
              <div className="c-between"><b className="c-title">What students talk about</b><button className="c-link" onClick={() => setSec('insights')}>Open insights ›</button></div>
              <div className="muted small">From {a.notes_total} voice notes</div>
              {Object.keys(a.by_theme).length === 0 && <div className="muted small" style={{ marginTop: 8 }}>No voice notes yet.</div>}
              {Object.entries(a.by_theme).sort((x, y) => total(y[1]) - total(x[1])).map(([k, v]) => (
                <BarRow key={k} label={k} value={total(v)} max={Math.max(...Object.values(a.by_theme).map(total))} text={String(total(v))}
                  color={v.neg > v.pos ? 'var(--red)' : 'var(--green)'} />
              ))}
            </div>
          </div>
        </>)}

        {sec === 'orders' && <OrdersTable a={a} advance={advance} />}

        {sec === 'products' && (
          <div className="c-card flush">
            <table className="c-table">
              <thead><tr><th>SKU</th><th>Product</th><th>Price</th><th>Stock</th><th>Type</th><th>Visible</th><th /></tr></thead>
              <tbody>
                {d.items.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24, textAlign: 'center' }}>No products yet. Add your first SKU.</td></tr>}
                {d.items.map(i => (
                  <tr key={i.id} style={{ opacity: i.active ? 1 : 0.55 }}>
                    <td className="muted">{i.sku}</td>
                    <td><b>{i.name}</b><div className="muted small">{i.description}</div></td>
                    <td>{rupee(i.price)}</td>
                    <td className={i.stock <= 10 ? 'down' : ''}>{i.stock}</td>
                    <td><span className={`vegmark ${i.veg ? '' : 'nv'}`} /> {i.veg ? 'Veg' : 'Non-veg'}</td>
                    <td><label className="c-switch"><input type="checkbox" checked={i.active} onChange={() => save(i, { active: !i.active })} /><i /></label></td>
                    <td className="c-actions">
                      <button onClick={() => setEditing(i)}>Edit</button>
                      <button className="danger" onClick={() => { if (confirm(`Delete ${i.name} (${i.sku})? This cannot be undone.`)) run('vendor_delete_item', { p_id: i.id }, `${i.name} deleted`) }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sec === 'inventory' && (
          <div className="c-card flush">
            <table className="c-table">
              <thead><tr><th>SKU</th><th>Product</th><th>In stock</th><th>Status</th><th>Quick restock</th></tr></thead>
              <tbody>
                {d.items.map(i => (
                  <tr key={i.id}>
                    <td className="muted">{i.sku}</td><td><b>{i.name}</b></td>
                    <td><StockInput value={i.stock} onSave={n => save(i, { stock: n })} /></td>
                    <td><span className={`c-chip ${i.stock === 0 ? 'bad' : i.stock <= 10 ? 'warn' : 'good'}`}>{i.stock === 0 ? 'Sold out' : i.stock <= 10 ? 'Low' : 'Healthy'}</span></td>
                    <td className="c-actions"><button onClick={() => save(i, { stock: i.stock + 10 })}>+10</button><button onClick={() => save(i, { stock: i.stock + 50 })}>+50</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sec === 'insights' && <Insights f={f} act={act} />}
        {sec === 'sentiment' && <Sentiment a={a} f={f} act={act} />}

        {sec === 'rewards' && (<>
          <div className="c-stats">
            <div className="c-card"><span className="muted">Feedback received</span><b>{a.notes_total}</b><span className="c-delta muted">all time</span></div>
            <div className="c-card"><span className="muted">Students speaking up</span><b>{a.rewards.students_with_notes}</b><span className="c-delta muted">unique students</span></div>
            <div className="c-card"><span className="muted">Offers redeemed</span><b>{a.rewards.rewarded_orders}</b><span className="c-delta muted">orders using a perk</span></div>
            <div className="c-card"><span className="muted">Discount given</span><b>{rupee(a.rewards.discount_total)}</b><span className="c-delta muted">cost of rewards</span></div>
          </div>
          <div className="c-card"><b className="c-title">How rewards work</b>
            <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>Students earn a monthly perk by keeping feedback on and ordering 3 times in a month. Nobody is paid per note, so the feedback you read is not bought by the unit. Actionable feedback counts notes that name something specific you can act on.</p></div>
        </>)}

        {sec === 'settings' && <div style={{ maxWidth: 560 }}><StoreTab d={d} run={run} logout={logout} /></div>}
      </main>

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSave={async it => {
        if (await save(it, {})) setEditing(null)
      }} />}
    </div>
  )
}

const total = (v: { pos: number; neu: number; neg: number }) => v.pos + v.neu + v.neg
const hr = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? ' AM' : ' PM'}`

function BarRow({ label, value, max, text, color }: { label: string; value: number; max: number; text: string; color?: string }) {
  return (
    <div className="c-bar-row"><span>{label}</span>
      <span className="c-track"><i style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color ?? 'var(--yellow)' }} /></span>
      <b>{text}</b></div>
  )
}

function HourBars({ data }: { data: { h: number; n: number }[] }) {
  const max = Math.max(1, ...data.map(x => x.n))
  const peak = data.reduce((p, x) => (x.n > p.n ? x : p), data[0])
  const shown = data.filter(x => x.h >= 7)
  return (
    <div className="c-hours">
      {shown.map(x => (
        <div key={x.h} title={`${hr(x.h)}: ${x.n} orders`}>
          <span className="n">{x.n || ''}</span>
          <i style={{ height: `${(x.n / max) * 100}%`, background: x.n === peak.n && x.n > 0 ? 'var(--orange)' : 'var(--yellow)' }} />
          <span className="h">{x.h % 12 || 12}</span>
        </div>
      ))}
    </div>
  )
}

function StockInput({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value))
  const commit = () => { const n = Math.max(0, Math.min(100000, Math.floor(Number(v)) || 0)); setV(String(n)); if (n !== value) onSave(n) }
  return <input className="c-stock" inputMode="numeric" value={v} onChange={e => setV(e.target.value.replace(/\D/g, ''))} onBlur={commit} onKeyDown={e => e.key === 'Enter' && (e.currentTarget.blur())} />
}

function OrdersTable({ a, advance }: { a: Analytics; advance: (id: string, status: string) => void }) {
  const [f, setF] = useState<'active' | 'new' | 'preparing' | 'ready' | 'done' | 'all'>('active')
  const n = (s: string) => a.orders.filter(o => o.status === s).length
  const rows = a.orders.filter(o => (f === 'all' ? true : f === 'active' ? o.status !== 'done' : o.status === f))
  const active = a.orders.filter(o => o.status !== 'done').length
  const chips: [typeof f, string][] = [['active', `Active ${active}`], ['new', `New ${n('new')}`], ['preparing', `Preparing ${n('preparing')}`], ['ready', `Ready ${n('ready')}`], ['done', `Done ${n('done')}`], ['all', `All ${a.orders.length}`]]
  return (<>
    <div className="c-chips">{chips.map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
    <div className="c-card flush">
      <table className="c-table">
        <thead><tr><th>Order</th><th>Items</th><th>Amount</th><th>Time</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 24, textAlign: 'center' }}>Nothing here. Orders marked done leave Active, and new ones appear within 5 seconds.</td></tr>}
          {rows.map(o => (
            <tr key={o.id}>
              <td><b>#{o.seq}</b></td>
              <td>{o.items}</td>
              <td>{rupee(o.total)}</td><td className="muted">{time(o.created_at)}</td>
              <td><span className={`status ${o.status}`}>{o.status[0].toUpperCase() + o.status.slice(1)}</span></td>
              <td className="c-actions">{NEXT[o.status] && <button onClick={() => advance(o.id, o.status)}>{ACTION[o.status]}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>)
}

function Insights({ f, act }: { f: Feedback; act: FeedbackActs }) {
  const [sent, setSent] = useState('all')
  const [cat, setCat] = useState('all')
  const cats = Array.from(new Set(f.notes.map(n => n.category).filter(Boolean))) as string[]
  const rows = f.notes.filter(n => (sent === 'all' || n.sentiment === sent) && (cat === 'all' || n.category === cat))
  return (<>
    <div className="c-chips">
      {['all', 'positive', 'neutral', 'negative'].map(s => <button key={s} className={sent === s ? 'on' : ''} onClick={() => setSent(s)}>{s === 'all' ? 'All feelings' : `${sentimentEmoji(s)} ${s[0].toUpperCase() + s.slice(1)}`}</button>)}
      <span className="c-sep" />
      {['all', ...cats].map(t => <button key={t} className={cat === t ? 'on' : ''} onClick={() => setCat(t)}>{t === 'all' ? 'All types' : CATEGORY[t]?.label ?? t}</button>)}
    </div>
    {rows.length === 0 && <div className="c-card muted center">No voice notes match. They appear here as soon as students send them.</div>}
    <div className="c-notes">{rows.map(n => <ReviewCard key={n.id} n={n} act={act} />)}</div>
    <IgnoredList notes={f.ignored} act={act} />
  </>)
}

function Sentiment({ a, f, act }: { a: Analytics; f: Feedback; act: FeedbackActs }) {
  const s = a.sentiment
  const all = s.positive + s.neutral + s.negative
  const pct = (n: number) => (all ? Math.round((n / all) * 100) : 0)
  return (<>
    <div className="c-stats">
      <div className="c-card"><span className="muted">Positive</span><b>{s.positive} · {pct(s.positive)}%</b></div>
      <div className="c-card"><span className="muted">Neutral</span><b>{s.neutral} · {pct(s.neutral)}%</b></div>
      <div className="c-card"><span className="muted">Negative</span><b className={s.negative ? 'down' : ''}>{s.negative} · {pct(s.negative)}%</b></div>
      <div className="c-card"><span className="muted">Net sentiment</span><b className={s.net >= 0 ? 'up' : 'down'}>{s.net > 0 ? '+' : ''}{s.net}</b><span className="c-delta muted">−100 to +100</span></div>
    </div>

    <div className="c-grid2">
      <div className="c-card"><NeedsAttention notes={f.notes} limit={4} act={act} /></div>
      <div className="stack">
        <div className="c-card"><b className="c-title">Types of feedback</b><div className="muted small" style={{ marginBottom: 10 }}>Praise, complaints, suggestions and questions</div><CategoryBars categories={f.categories} /></div>
        <div className="c-card"><b className="c-title">What went wrong</b><div className="muted small" style={{ marginBottom: 6 }}>Issues students flagged</div><FlagBars flags={f.flags} good={false} /></div>
        <div className="c-card"><b className="c-title">What went right</b><div className="muted small" style={{ marginBottom: 6 }}>Praise students gave</div><FlagBars flags={f.flags} good /></div>
      </div>
    </div>

    <div className="c-grid2">
      <div className="c-card"><b className="c-title">Net sentiment, last 7 days</b><div className="muted small">Daily score from −100 to +100</div><Line data={a.daily_sentiment} /></div>
      <div className="c-card"><b className="c-title">Net sentiment by hour</b><div className="muted small">When the mood dips (all time)</div>
        {a.hourly_sentiment.length === 0 ? <div className="muted small" style={{ marginTop: 12 }}>Not enough notes yet.</div> :
          <div className="c-hours short">{a.hourly_sentiment.map(x => (
            <div key={x.h} title={`${hr(x.h)}: ${x.score} (${x.n} notes)`}><span className="n">{x.score}</span>
              <i style={{ height: `${Math.max(6, Math.abs(x.score))}%`, background: x.score >= 0 ? 'var(--green)' : 'var(--red)' }} /><span className="h">{x.h % 12 || 12}</span></div>))}</div>}
      </div>
    </div>
    <div className="c-grid2">
      <div className="c-card"><b className="c-title">By product</b><div className="muted small">Net sentiment of voice notes on orders containing it</div>
        {a.by_product.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>No notes linked to products yet.</div>}
        {a.by_product.map(p => (
          <div key={p.name} className="c-bar-row"><span>{p.name}</span>
            <span className="c-track"><i style={{ width: `${Math.max(3, Math.abs(p.score))}%`, background: p.score >= 0 ? 'var(--green)' : 'var(--red)' }} /></span>
            <b className={p.score >= 0 ? 'up' : 'down'}>{p.score > 0 ? '+' : ''}{p.score}</b></div>))}
      </div>
      <div className="c-card"><b className="c-title">By theme</b><div className="muted small">Share of positive / neutral / negative</div>
        {Object.keys(a.by_theme).length === 0 && <div className="muted small" style={{ marginTop: 12 }}>No themes detected yet.</div>}
        {Object.entries(a.by_theme).map(([k, v]) => { const t = total(v); return (
          <div key={k} className="c-bar-row"><span>{k}</span>
            <span className="c-stack"><i style={{ width: `${(v.pos / t) * 100}%`, background: 'var(--green)' }} /><i style={{ width: `${(v.neu / t) * 100}%`, background: '#f2b600' }} /><i style={{ width: `${(v.neg / t) * 100}%`, background: 'var(--red)' }} /></span>
            <b className="muted small">{t}</b></div>) })}
      </div>
    </div>
  </>)
}

function Line({ data }: { data: { day: string; score: number | null; n: number }[] }) {
  const W = 520, H = 170, P = 24
  const pts = data.map((p, i) => ({ ...p, x: P + (i * (W - 2 * P)) / Math.max(1, data.length - 1), y: p.score === null ? null : P + ((100 - p.score) / 200) * (H - 2 * P) }))
  const real = pts.filter(p => p.y !== null) as (typeof pts[number] & { y: number })[]
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="c-line" role="img" aria-label="Net sentiment by day">
      <line x1={P} x2={W - P} y1={P + (H - 2 * P) / 2} y2={P + (H - 2 * P) / 2} stroke="var(--line)" strokeDasharray="4 4" />
      {real.length > 1 && <polyline points={real.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#e8920c" strokeWidth="3" strokeLinejoin="round" />}
      {real.map(p => <g key={p.day + p.x}><circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#e8920c" strokeWidth="3"><title>{`${p.day}: ${p.score} (${p.n} notes)`}</title></circle></g>)}
      {pts.map(p => <text key={p.day + p.x} x={p.x} y={H + 14} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.day}</text>)}
      {real.length === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--muted)">No voice notes in the last 7 days</text>}
    </svg>
  )
}
