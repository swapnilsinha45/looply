import { useEffect, useState } from 'react'
import { rpc, supabase } from './api'
import Voice from './Voice'
import Vendor from './Vendor'
import { StudentAuth, VendorAuth } from './Auth'
import RewardsScreen, { rewardEffect } from './Rewards'
import Gateway from './Gateway'
import { PendingReviews } from './Pending'
import { Header, errMsg, rupee, store } from './ui'
import type { Favourite, MenuItem, OrderRow, Reward, RewardsHub, Store, Student } from './api'

type Route =
  | { n: 'welcome' } | { n: 'studentLogin' } | { n: 'home' } | { n: 'stores' }
  | { n: 'menu'; store: Store; prefill?: { item_id: string; qty: number }[] } | { n: 'cart'; store: Store; items: MenuItem[] }
  | { n: 'paid'; orderId: string; total: number; discount: number; cashback: number; storeName: string }
  | { n: 'voice'; orderId: string; auto?: boolean } | { n: 'orders' } | { n: 'rewards'; open?: string; milestone?: boolean } | { n: 'topup' } | { n: 'spend' }
  | { n: 'vendorLogin'; desktop?: boolean } | { n: 'vendor'; desktop?: boolean }

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ n: 'welcome' }])
  const route = stack[stack.length - 1]
  const [token, setToken] = useState<string | null>(store.get('looply_student'))
  const [student, setStudent] = useState<Student | null>(null)
  const [vToken, setVToken] = useState<string | null>(store.get('looply_vendor'))
  const [toast, setToast] = useState('')

  const go = (r: Route) => setStack(s => [...s, r])
  const replace = (r: Route) => setStack(s => [...s.slice(0, -1), r])
  const reset = (r: Route) => setStack([r])
  const back = () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  // restore sessions
  useEffect(() => {
    if (token) {
      rpc<Student>('student_me', { p_token: token })
        .then(s => { setStudent(s); setStack(st => (st.length === 1 && st[0].n === 'welcome' ? [{ n: 'home' }] : st)) })
        .catch(() => { store.set('looply_student', null); setToken(null) })
    }
    // the desktop dashboard has a shareable link: /#vendor
    if (window.location.hash === '#vendor') setStack(vToken ? [{ n: 'vendor' }] : [{ n: 'welcome' }, { n: 'vendorLogin' }])
    else if (vToken && !token) setStack(st => (st.length === 1 && st[0].n === 'welcome' ? [{ n: 'vendor' }] : st))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = () => {
    store.set('looply_student', null); store.set('looply_vendor', null)
    setToken(null); setStudent(null); setVToken(null); reset({ n: 'welcome' })
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }

  const ctx = { token, student, setStudent, go, replace, reset, back, say, logout }

  return (
    <div className="phone">
      {route.n === 'welcome' && <Welcome {...ctx} />}
      {route.n === 'studentLogin' && <StudentAuth back={back} onAuth={(t, s) => { store.set('looply_student', t); setToken(t); setStudent(s); reset({ n: 'home' }) }} />}
      {route.n === 'home' && student && <Home {...ctx} student={student} />}
      {route.n === 'stores' && <Stores {...ctx} />}
      {route.n === 'menu' && student && <Menu {...ctx} student={student} shop={route.store} prefill={route.prefill} />}
      {route.n === 'cart' && student && <Cart {...ctx} student={student} shop={route.store} items={route.items} />}
      {route.n === 'paid' && student && <Paid {...ctx} student={student} r={route} />}
      {route.n === 'voice' && <Voice orderId={route.orderId} auto={route.auto} token={token} back={back} reset={reset} setStudent={setStudent} say={say} />}
      {route.n === 'orders' && <Orders {...ctx} />}
      {route.n === 'rewards' && student && <RewardsScreen token={token} back={back} go={go} openId={route.open} milestone={route.milestone}
        refreshStudent={() => rpc<Student>('student_me', { p_token: token }).then(setStudent).catch(() => {})} />}
      {route.n === 'topup' && student && <Gateway student={student} token={token} back={back} setStudent={setStudent} />}
      {route.n === 'spend' && <Spend {...ctx} />}
      {route.n === 'vendorLogin' && <VendorAuth back={back} onAuth={t => { store.set('looply_vendor', t); setVToken(t); reset({ n: 'vendor', desktop: route.desktop }) }} />}
      {route.n === 'vendor' && vToken && <Vendor token={vToken} logout={logout} say={say} startDesktop={route.desktop} />}
      {!student && ['home', 'menu', 'cart', 'paid', 'rewards', 'topup'].includes(route.n) && <div className="center">Loading…</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

type Ctx = {
  token: string | null; student: Student | null; setStudent: (s: Student) => void
  go: (r: Route) => void; replace: (r: Route) => void; reset: (r: Route) => void; back: () => void
  say: (m: string) => void; logout: () => void
}

function Welcome({ go }: Ctx) {
  return (
    <div className="screen">
      <div className="hero big">
        <div className="logo"><i>L</i>Looply</div>
        <p className="tagline">Pay at campus stores.<br />Speak your feedback.<br />Earn rewards.</p>
      </div>
      <div className="scroll stack">
        <div className="label" style={{ marginTop: 6 }}>Continue as</div>
        <button className="card choice sel" onClick={() => go({ n: 'studentLogin' })}>
          <span className="badge">S</span>
          <span><b>Student</b><span className="muted small">Pay with your wallet, record a voice note, win rewards</span></span>
          <span className="chev">›</span>
        </button>
        <button className="card choice" onClick={() => go({ n: 'vendorLogin' })}>
          <span className="badge dk">V</span>
          <span><b>Store vendor</b><span className="muted small">Manage orders, stock and voice insights</span></span>
          <span className="chev">›</span>
        </button>
        <div className="banner">Voice feedback is the king. 15 seconds after each order earns a scratch card.</div>
        <a className="linkbtn" href="#vendor" onClick={e => { e.preventDefault(); go({ n: 'vendorLogin', desktop: true }) }}>Open vendor web dashboard ›</a>
      </div>
    </div>
  )
}

const asStore = (f: Favourite): Store => ({ id: f.id, code: '', name: f.name, tags: f.tags, description: '', pure_veg: false, eta_min: f.eta_min, color: f.color, open: f.open })
const TIER_COLOR: Record<string, string> = { Regular: '#8a8372', Silver: '#8e9aa6', Gold: '#d99a00' }

function Home({ student, token, go, logout }: Ctx & { student: Student }) {
  const [favs, setFavs] = useState<Favourite[] | null>(null)
  const [hub, setHub] = useState<RewardsHub | null>(null)
  const [unreviewed, setUnreviewed] = useState<OrderRow[]>([])
  useEffect(() => {
    rpc<OrderRow[]>('my_orders', { p_token: token }).then(rows => setUnreviewed(rows.filter(o => !o.has_note).slice(0, 2))).catch(() => {})
    rpc<Favourite[]>('my_favourites', { p_token: token }).then(setFavs).catch(() => setFavs([]))
    rpc<RewardsHub>('my_rewards', { p_token: token }).then(setHub).catch(() => {})
  }, [token, student.wallet, student.notes_count])
  const scratch = hub?.rewards.filter(r => r.status === 'scratch').length ?? 0
  const coupons = hub?.rewards.filter(r => r.status === 'available').length ?? 0
  const left = hub ? hub.milestone.target - hub.milestone.progress : 5 - student.notes_count
  return (
    <div className="screen">
      <div className="hero">
        <div className="row">
          <div style={{ flex: 1 }}><h1 style={{ fontSize: 24 }}>Hi, {student.name}</h1><div className="sub">{student.code} · {student.campus}</div></div>
          <button className="small" style={{ fontWeight: 700 }} onClick={logout}>Sign out</button>
        </div>
        <div className="wallet">
          <div><div className="small" style={{ opacity: .7 }}>Looply wallet</div><div className="amt"><span>₹</span>{student.wallet}</div></div>
          <button className="btn-sm" onClick={() => go({ n: 'topup' })}>+ Add money</button>
        </div>
      </div>
      <div className="scroll stack">
        <button className="pay-hero" onClick={() => go({ n: 'stores' })}>
          <div><h2>Pay at store</h2><p>Pick a campus store, build your order, pay in one tap</p></div>
          <span className="go">→</span>
        </button>

        <button className="rewards-hero" onClick={() => go({ n: 'rewards' })}>
          <div className="rh-top">
            <span className="rh-title">Rewards</span>
            {hub && <span className="tier-badge" style={{ background: TIER_COLOR[hub.tier.name] }}>{hub.tier.name}</span>}
            {scratch > 0 && <span className="rh-pulse">{scratch} scratch card{scratch > 1 ? 's' : ''} ready</span>}
          </div>
          <div className="rh-stats">
            <div><b>{coupons}</b><span>coupons</span></div>
            <div><b>{rupee(hub?.cashback_total ?? 0)}</b><span>cashback earned</span></div>
            <div><b>{rupee(hub?.saved_total ?? 0)}</b><span>saved</span></div>
          </div>
          <div className="rh-progress">
            <div className="pips">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < (hub?.milestone.progress ?? student.notes_count) ? 'on' : ''} />)}</div>
            <span>{left <= 0 ? 'Coupon unlocked!' : `${left} voice note${left === 1 ? '' : 's'} to your next 5% off coupon`}</span>
          </div>
        </button>

        <PendingReviews orders={unreviewed} onRecord={id => go({ n: 'voice', orderId: id, auto: true })} />

        {favs && favs.length > 0 && (<>
          <div className="section-title">{favs.some(f => !f.popular) ? 'Your favourites' : 'Popular on campus'}</div>
          <div className="fav-row">
            {favs.map(f => (
              <button key={f.id} className="fav"
                onClick={() => go({ n: 'menu', store: asStore(f), prefill: f.popular ? undefined : f.last_items.map(i => ({ item_id: i.item_id, qty: i.qty })) })}>
                <span className="avatar" style={{ background: f.color, width: 40, height: 40, fontSize: 17 }}>{f.name[0]}</span>
                <b>{f.name}</b>
                <span className="small muted">{f.usual ? (f.popular ? `Try: ${f.usual}` : `Usually: ${f.usual}`) : f.tags}</span>
                <span className="fav-cta">{f.popular ? 'View menu ›' : f.last_items.length ? 'Order again ›' : 'Open ›'}</span>
              </button>
            ))}
          </div>
        </>)}

        <div className="grid3">
          <button className="card tile" onClick={() => go({ n: 'orders' })}><div className="dot" />Order history</button>
          <button className="card tile" onClick={() => go({ n: 'rewards' })}><div className="dot" />My rewards</button>
          <button className="card tile" onClick={() => go({ n: 'topup' })}><div className="dot" />Add money</button>
        </div>
        <button className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }} onClick={() => go({ n: 'spend' })}>
          <span className="bars"><i style={{ height: 8 }} /><i style={{ height: 14 }} /><i style={{ height: 10 }} /><i style={{ height: 20 }} /><i style={{ height: 16 }} /></span>
          <b style={{ flex: 1, textAlign: 'left' }}>Spend analysis</b><span style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 13 }}>View ›</span>
        </button>
      </div>
    </div>
  )
}

function Stores({ back, go }: Ctx) {
  const [stores, setStores] = useState<Store[] | null>(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.from('stores').select('*').order('sort').then(({ data, error }) => {
      if (error) setErr(error.message); else setStores(data as Store[])
    })
  }, [])
  const list = (stores ?? []).filter(s => `${s.name} ${s.tags} ${s.description}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="screen">
      <Header title="Campus stores" sub={stores ? `${stores.filter(s => s.open).length} open now · tap a store to order` : 'Loading…'} back={back}>
        <input className="search" placeholder="Search stores or dishes" value={q} onChange={e => setQ(e.target.value)} />
      </Header>
      <div className="scroll stack">
        {err && <div className="err">{err}</div>}
        {list.map(s => (
          <button key={s.id} className="card store" onClick={() => go({ n: 'menu', store: s })}>
            <div className="top">
              <span className="avatar" style={{ background: s.color }}>{s.name[0]}</span>
              <div style={{ flex: 1 }}>
                <h3>{s.name}{s.pure_veg && <span className="veg-tag">● Pure Veg</span>}</h3>
                <div className="muted small">{s.tags}</div>
                <div className="small" style={{ marginTop: 4 }}>{s.description}</div>
              </div>
            </div>
            <div className="meta"><span className="on">● {s.open ? 'Open' : 'Closed'}</span>· ~{s.eta_min} min · Voice rewards on<b>Order ›</b></div>
          </button>
        ))}
        {stores && list.length === 0 && <div className="muted center">No stores match “{q}”.</div>}
      </div>
    </div>
  )
}

function Menu({ shop, student, back, go, prefill }: Ctx & { shop: Store; student: Student; prefill?: { item_id: string; qty: number }[] }) {
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  useEffect(() => {
    supabase.from('menu_items').select('*').eq('store_id', shop.id).eq('active', true).order('sort').then(({ data }) => {
      const rows = data as MenuItem[]
      setItems(rows)
      if (prefill?.length) { // "Order again": start with last time's basket
        const q: Record<string, number> = {}
        for (const p of prefill) { const it = rows.find(r => r.id === p.item_id); if (it && it.stock > 0) q[it.id] = Math.min(p.qty, it.stock) }
        setQty(q)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id])
  const total = (items ?? []).reduce((s, i) => s + i.price * (qty[i.id] ?? 0), 0)
  const count = Object.values(qty).reduce((a, b) => a + b, 0)
  const set = (id: string, d: number, max: number) => setQty(q => ({ ...q, [id]: Math.min(max, Math.max(0, (q[id] ?? 0) + d)) }))
  return (
    <div className="screen">
      <div className="hero">
        <div className="row">
          <button className="back" onClick={back}>‹</button>
          <span className="avatar" style={{ background: shop.color, width: 40, height: 40, fontSize: 17 }}>{shop.name[0]}</span>
          <div><h1 style={{ fontSize: 18 }}>{shop.name}</h1><div className="sub">{shop.tags}</div></div>
        </div>
        <div className="card small" style={{ marginTop: 12, padding: '10px 14px' }}>Wallet <b>₹{student.wallet}</b> <span className="muted">· {count ? `${count} item${count > 1 ? 's' : ''} in cart` : 'Cart starts empty, tap ADD to build your order'}</span></div>
      </div>
      <div className="scroll stack">
        {!items && <div className="center muted">Loading menu…</div>}
        {items?.map(i => (
          <div key={i.id} className="card item">
            <span className="thumb">{i.name[0]}</span>
            <div className="info">
              <b><span className={`vegmark ${i.veg ? '' : 'nv'}`} />{i.name}</b>
              <p>{i.description}</p>
              <b>{rupee(i.price)}</b>
              {i.stock <= 5 && i.stock > 0 && <span className="small" style={{ color: 'var(--red)', fontWeight: 700 }}>Only {i.stock} left</span>}
            </div>
            {i.stock === 0 ? <span className="small muted">Sold out</span>
              : (qty[i.id] ?? 0) === 0 ? <button className="add" onClick={() => set(i.id, 1, i.stock)}>ADD</button>
              : <div className="stepper"><button onClick={() => set(i.id, -1, i.stock)}>−</button>{qty[i.id]}<button onClick={() => set(i.id, 1, i.stock)}>+</button></div>}
          </div>
        ))}
      </div>
      <div className="footer">
        <div className="sum small muted"><span>Balance after this order</span><b style={{ color: total > student.wallet ? 'var(--red)' : 'var(--ink)' }}>{rupee(student.wallet - total)}</b></div>
        <button className="btn" disabled={count === 0}
          onClick={() => go({ n: 'cart', store: shop, items: (items ?? []).filter(i => qty[i.id]).map(i => ({ ...i, stock: qty[i.id] })) })}>
          {count ? `View cart · ${rupee(total)}` : 'Add items to continue'}
        </button>
      </div>
    </div>
  )
}

// stock on the items passed to Cart holds the selected quantity
function Cart({ shop, items: init, student, back, replace, setStudent, token }: Ctx & { shop: Store; items: MenuItem[]; student: Student }) {
  const [lines, setLines] = useState(init.map(i => ({ ...i, qty: i.stock })))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [tierPct, setTierPct] = useState(0)
  const [pick, setPick] = useState<string | null | undefined>(undefined) // undefined = best available, null = none
  useEffect(() => {
    rpc<RewardsHub>('my_rewards', { p_token: token }).then(h => { setRewards(h.rewards.filter(r => r.status === 'available')); setTierPct(h.tier.cashback_pct) }).catch(() => {})
  }, [token])

  const sub = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const options = rewards.map(r => ({ r, e: rewardEffect(r, sub, shop.id) }))
  const best = options.filter(o => o.e.ok).sort((a, b) => b.e.discount + b.e.cashback - (a.e.discount + a.e.cashback))[0]
  const chosenId = pick === undefined ? best?.r.id ?? null : pick
  const chosen = options.find(o => o.r.id === chosenId && o.e.ok)
  const disc = chosen?.e.discount ?? 0
  const total = sub - disc
  const rewardCb = chosen?.e.cashback ?? 0
  const tierCb = Math.floor((total * tierPct) / 100)
  const change = (id: string, d: number) => setLines(ls => ls.map(l => (l.id === id ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter(l => l.qty > 0))
  useEffect(() => { if (lines.length === 0) back() }, [lines.length, back])
  const pay = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<{ order_id: string; total: number; discount: number; cashback: number; student: Student }>('place_order', {
        p_token: token, p_store: shop.id, p_items: lines.map(l => ({ item_id: l.id, qty: l.qty })), p_reward: chosen ? chosen.r.id : null,
      })
      setStudent(r.student)
      replace({ n: 'paid', orderId: r.order_id, total: r.total, discount: r.discount, cashback: r.cashback, storeName: shop.name })
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Header title="Your cart & payment" sub={shop.name} back={back} />
      <div className="scroll stack">
        {lines.map(l => (
          <div key={l.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}><b>{l.name}</b><div className="muted small">{rupee(l.price)} each</div></div>
            <div className="stepper"><button onClick={() => change(l.id, -1)}>−</button>{l.qty}<button onClick={() => change(l.id, 1)}>+</button></div>
            <b style={{ width: 52, textAlign: 'right' }}>{rupee(l.price * l.qty)}</b>
          </div>
        ))}

        <div className="card coupons">
          <div className="between"><b>Coupons &amp; cashback</b><span className="small muted">{options.length ? `${options.filter(o => o.e.ok).length} of ${options.length} can be used` : 'None yet'}</span></div>
          {options.length === 0 && <div className="small muted" style={{ marginTop: 8 }}>Record a voice note after this order to earn a scratch card.</div>}
          {options.map(({ r, e }) => (
            <button key={r.id} className={`opt ${chosen?.r.id === r.id ? 'on' : ''}`} disabled={!e.ok} onClick={() => setPick(chosen?.r.id === r.id ? null : r.id)}>
              <span className="radio" />
              <span className="t"><b>{r.title}</b><small>{e.ok ? r.description : e.why}</small></span>
              <span className="v">{e.ok ? (e.discount ? `−${rupee(e.discount)}` : `+${rupee(e.cashback)}`) : ''}</span>
            </button>
          ))}
          {options.length > 0 && !chosen && <div className="small muted" style={{ marginTop: 6 }}>No coupon applied</div>}
        </div>

        <div className="card">
          {disc > 0 && <>
            <div className="sum"><span className="muted">Subtotal</span><b>{rupee(sub)}</b></div>
            <div className="sum" style={{ color: 'var(--green)' }}><span>{chosen?.r.title} applied</span><b>−{rupee(disc)}</b></div>
          </>}
          <div className="total-row"><div><div className="muted small">Order total</div><div className="small muted">{lines.reduce((n, l) => n + l.qty, 0)} item(s)</div></div><b className="total-amt">{rupee(total)}</b></div>
          <div className="sum small"><span className="muted">Wallet balance now</span><b>{rupee(student.wallet)}</b></div>
          <div className="sum small"><span className="muted">Amount left after purchase</span><b style={{ color: student.wallet - total < 0 ? 'var(--red)' : 'var(--ink)' }}>{rupee(student.wallet - total)}</b></div>
          {rewardCb + tierCb > 0 && <div className="cashback-note">
            <b>+{rupee(rewardCb + tierCb)} cashback</b>
            <span>{rewardCb > 0 ? `${rupee(rewardCb)} from your coupon` : ''}{rewardCb > 0 && tierCb > 0 ? ' + ' : ''}{tierCb > 0 ? `${rupee(tierCb)} tier bonus` : ''}, credited right after you pay</span>
          </div>}
        </div>
        <div className="card choice sel"><span className="badge dk" style={{ width: 34, height: 34, fontSize: 16 }}>L</span><b style={{ fontSize: 15 }}>Pay with Looply wallet</b><span style={{ marginLeft: 'auto', color: 'var(--green)', fontWeight: 700, fontSize: 12 }}>Selected</span></div>
        {err && <div className="err">{err}</div>}
      </div>
      <div className="footer"><button className="btn dk" disabled={busy || total > student.wallet} onClick={pay}>
        {total > student.wallet ? 'Not enough balance — add money' : busy ? 'Paying…' : `Pay ${rupee(total)}`}</button></div>
    </div>
  )
}

function Paid({ student, r, go, reset }: Ctx & { student: Student; r: Extract<Route, { n: 'paid' }> }) {
  return (
    <div className="screen dark" style={{ overflowY: 'auto' }}>
      <div className="paid">
        <div className="check">✓</div>
        <h1 style={{ margin: 0 }}>Paid {rupee(r.total)}</h1>
        <div className="muted small" style={{ color: '#bbb' }}>{r.storeName} · Wallet balance now <b style={{ color: '#fff' }}>{rupee(student.wallet)}</b></div>
        {r.discount > 0 && <div className="small" style={{ color: 'var(--yellow)', marginTop: 6 }}>You saved {rupee(r.discount)} with your coupon 🎉</div>}
        {r.cashback > 0 && <div className="small" style={{ color: '#8ff0c0', marginTop: 4 }}>+{rupee(r.cashback)} cashback added to your wallet</div>}
      </div>
      <div className="voice-card">
        <span className="chip">THE KEY STEP · VOICE IS KING</span>
        <h2>Say it in 15 seconds.<br />Win a scratch card.</h2>
        <div className="orb"><div><span className="core" /></div></div>
        <p className="small" style={{ margin: '0 0 16px' }}>Your voice note beats any star rating. Every note earns a scratch card with a coupon or cashback, and every 5th unlocks 5% off.</p>
        <button className="btn dk" onClick={() => go({ n: 'voice', orderId: r.orderId, auto: true })}>● Tap to record (15 sec)</button>
      </div>
      <button className="linkbtn" style={{ color: '#aaa', marginBottom: 24 }} onClick={() => reset({ n: 'home' })}>Skip for now</button>
    </div>
  )
}

function Orders({ back, token, go }: Ctx) {
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { rpc<OrderRow[]>('my_orders', { p_token: token }).then(setRows).catch(e => setErr(errMsg(e))) }, [token])
  return (
    <div className="screen">
      <Header title="Order history" sub="Your last 50 orders" back={back} />
      <div className="scroll stack">
        {err && <div className="err">{err}</div>}
        {rows?.length === 0 && <div className="center muted">No orders yet. Pay at a store to get started.</div>}
        {rows?.map(o => (
          <div key={o.id} className="card">
            <div className="qrow"><div><b>{o.store_name}</b><div className="muted small">#{o.seq} · {new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div></div>
              <div className="r"><b>{rupee(o.total)}</b><span className={`status ${o.status}`}>{o.status}</span></div></div>
            <div className="small" style={{ marginTop: 6 }}>{o.items}</div>
            {o.has_note ? <span className="note">Voice note sent</span>
              : <button className="review-btn" onClick={() => go({ n: 'voice', orderId: o.id, auto: true })}>● Record review <small>earns a scratch card</small></button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Spend({ back, token }: Ctx) {
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  useEffect(() => { rpc<OrderRow[]>('my_orders', { p_token: token }).then(setRows).catch(() => setRows([])) }, [token])
  const byStore: Record<string, number> = {}
  rows?.forEach(o => { byStore[o.store_name] = (byStore[o.store_name] ?? 0) + o.total })
  const entries = Object.entries(byStore).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(e => e[1]))
  const total = entries.reduce((s, e) => s + e[1], 0)
  return (
    <div className="screen">
      <Header title="Spend analysis" sub="Where your wallet goes" back={back} />
      <div className="scroll stack">
        <div className="card"><div className="muted small">Total spent</div><b style={{ fontSize: 30 }}>{rupee(total)}</b></div>
        {entries.length === 0 && <div className="center muted">No spending yet.</div>}
        {entries.length > 0 && <div className="card"><div className="chart">
          {entries.map(([name, v]) => <div key={name}>{rupee(v)}<i style={{ height: `${(v / max) * 80}%` }} /><span className="muted" style={{ fontSize: 10 }}>{name.split(' ')[0]}</span></div>)}
        </div></div>}
      </div>
    </div>
  )
}

