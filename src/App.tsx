import { useCallback, useEffect, useRef, useState } from 'react'
import { rpc, supabase } from './api'
import type { Dashboard, MenuItem, OrderRow, Store, Student } from './api'

type Route =
  | { n: 'welcome' } | { n: 'studentLogin' } | { n: 'home' } | { n: 'stores' }
  | { n: 'menu'; store: Store } | { n: 'cart'; store: Store; items: MenuItem[] }
  | { n: 'paid'; orderId: string; total: number; discount: number; storeName: string }
  | { n: 'voice'; orderId: string } | { n: 'orders' } | { n: 'rewards' } | { n: 'topup' } | { n: 'spend' }
  | { n: 'vendorLogin' } | { n: 'vendor' }

const store = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string | null) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ } },
}
const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

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
    if (vToken && !token) setStack(st => (st.length === 1 && st[0].n === 'welcome' ? [{ n: 'vendor' }] : st))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = () => {
    store.set('looply_student', null); store.set('looply_vendor', null)
    setToken(null); setStudent(null); setVToken(null); reset({ n: 'welcome' })
  }

  const ctx = { token, student, setStudent, go, replace, reset, back, say, logout }

  return (
    <div className="phone">
      {route.n === 'welcome' && <Welcome {...ctx} />}
      {route.n === 'studentLogin' && <StudentLogin {...ctx} onAuth={(t, s) => { store.set('looply_student', t); setToken(t); setStudent(s); reset({ n: 'home' }) }} />}
      {route.n === 'home' && student && <Home {...ctx} student={student} />}
      {route.n === 'stores' && <Stores {...ctx} />}
      {route.n === 'menu' && student && <Menu {...ctx} student={student} shop={route.store} />}
      {route.n === 'cart' && student && <Cart {...ctx} student={student} shop={route.store} items={route.items} />}
      {route.n === 'paid' && student && <Paid {...ctx} student={student} r={route} />}
      {route.n === 'voice' && <Voice {...ctx} orderId={route.orderId} />}
      {route.n === 'orders' && <Orders {...ctx} />}
      {route.n === 'rewards' && student && <Rewards {...ctx} student={student} />}
      {route.n === 'topup' && student && <TopUp {...ctx} student={student} />}
      {route.n === 'spend' && <Spend {...ctx} />}
      {route.n === 'vendorLogin' && <VendorLogin back={back} onAuth={t => { store.set('looply_vendor', t); setVToken(t); reset({ n: 'vendor' }) }} />}
      {route.n === 'vendor' && vToken && <Vendor token={vToken} logout={logout} say={say} />}
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

function Header({ title, sub, back, children }: { title: string; sub?: string; back?: () => void; children?: React.ReactNode }) {
  return (
    <div className="hero">
      <div className="row">
        {back && <button className="back" onClick={back} aria-label="Back">‹</button>}
        <div style={{ flex: 1 }}>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  )
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
          <span><b>Student</b><span className="muted small">Pay with your wallet, record a voice note, win offers</span></span>
          <span className="chev">›</span>
        </button>
        <button className="card choice" onClick={() => go({ n: 'vendorLogin' })}>
          <span className="badge dk">V</span>
          <span><b>Store vendor</b><span className="muted small">Manage orders, stock and voice insights</span></span>
          <span className="chev">›</span>
        </button>
        <div className="banner">Voice feedback is the king. 15 seconds after each order unlocks 5% off.</div>
      </div>
    </div>
  )
}

function StudentLogin({ back, onAuth }: Ctx & { onAuth: (t: string, s: Student) => void }) {
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<Student & { token: string }>('student_login', { p_code: code.trim(), p_password: pw })
      onAuth(r.token, r)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Header title="Student sign in" sub="Use your campus ID" back={back} />
      <form className="scroll stack" onSubmit={e => { e.preventDefault(); submit() }}>
        <div><div className="label">Student ID</div>
          <input className="field" value={code} onChange={e => setCode(e.target.value)} placeholder="PGP2026-114" autoCapitalize="characters" autoComplete="username" /></div>
        <div><div className="label">Password</div>
          <input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></div>
        {err && <div className="err">{err}</div>}
        <div className="banner small">Demo account: ID <b>PGP2026-114</b>, password <b>looply123</b></div>
        <button type="button" className="pill" onClick={() => { setCode('PGP2026-114'); setPw('looply123') }}>Autofill demo student</button>
        <button className="btn" disabled={busy || !code || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}

function Home({ student, go, logout }: Ctx & { student: Student }) {
  const left = Math.max(0, 5 - student.notes_count)
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
        <div className="grid3">
          <button className="card tile" onClick={() => go({ n: 'orders' })}><div className="dot" />Order history</button>
          <button className="card tile" onClick={() => go({ n: 'rewards' })}><div className="dot" />My rewards</button>
          <button className="card tile" onClick={() => go({ n: 'topup' })}><div className="dot" />Top up</button>
        </div>
        <button className="promo" onClick={() => go({ n: 'rewards' })}>
          <span className="mic" />
          <span><b>Speak &amp; save 5%</b><br /><span className="muted small">Voice notes recorded {Math.min(student.notes_count, 5)} / 5 for the next offer</span>
            {left === 0 && <span className="small" style={{ color: 'var(--green)', fontWeight: 700 }}> · Offer unlocked!</span>}</span>
        </button>
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

function Menu({ shop, student, back, go }: Ctx & { shop: Store; student: Student }) {
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  useEffect(() => {
    supabase.from('menu_items').select('*').eq('store_id', shop.id).order('sort').then(({ data }) => setItems(data as MenuItem[]))
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
  const sub = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const eligible = student.notes_count >= 5 && sub > 150
  const disc = eligible ? Math.round(sub * 0.05) : 0
  const total = sub - disc
  const change = (id: string, d: number) => setLines(ls => ls.map(l => (l.id === id ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter(l => l.qty > 0))
  useEffect(() => { if (lines.length === 0) back() }, [lines.length, back])
  const pay = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<{ order_id: string; total: number; discount: number; student: Student }>('place_order', {
        p_token: token, p_store: shop.id, p_items: lines.map(l => ({ item_id: l.id, qty: l.qty })),
      })
      setStudent(r.student)
      replace({ n: 'paid', orderId: r.order_id, total: r.total, discount: r.discount, storeName: shop.name })
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
        <div className="card">
          <div className="sum"><span className="muted">Order total</span><b>{rupee(sub)}</b></div>
          {disc > 0 && <div className="sum" style={{ color: 'var(--green)' }}><span>Voice reward 5% off</span><b>−{rupee(disc)}</b></div>}
          <div className="sum"><span className="muted">Wallet balance now</span><b>{rupee(student.wallet)}</b></div>
          <div className="left"><div><b style={{ fontSize: 14 }}>Amount left after purchase</b><div className="small muted">Updates as you add items</div></div><b>{rupee(student.wallet - total)}</b></div>
        </div>
        {student.notes_count >= 5 && sub <= 150 && <div className="banner small">Voice reward ready: add {rupee(151 - sub)} more to get 5% off.</div>}
        <div className="card choice sel"><span className="badge dk" style={{ width: 34, height: 34, fontSize: 16 }}>L</span><b style={{ fontSize: 15 }}>Pay with Looply wallet</b><span style={{ marginLeft: 'auto', color: 'var(--green)', fontWeight: 700, fontSize: 12 }}>Selected</span></div>
        {err && <div className="err">{err}</div>}
      </div>
      <div className="footer"><button className="btn dk" disabled={busy || total > student.wallet} onClick={pay}>
        {total > student.wallet ? 'Not enough balance — top up' : busy ? 'Paying…' : `Pay ${rupee(total)}`}</button></div>
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
        {r.discount > 0 && <div className="small" style={{ color: 'var(--yellow)', marginTop: 6 }}>You saved {rupee(r.discount)} with your voice reward 🎉</div>}
      </div>
      <div className="voice-card">
        <span className="chip">THE KEY STEP · VOICE IS KING</span>
        <h2>Say it in 15 seconds.<br />Win prizes &amp; offers.</h2>
        <div className="orb"><div><span className="core" /></div></div>
        <p className="small" style={{ margin: '0 0 16px' }}>Your voice note beats any star rating. We turn it into insights for the store, and you earn 5% off orders above ₹150.</p>
        <button className="btn dk" onClick={() => go({ n: 'voice', orderId: r.orderId })}>● Tap to record (15 sec)</button>
      </div>
      <button className="linkbtn" style={{ color: '#aaa', marginBottom: 24 }} onClick={() => reset({ n: 'home' })}>Skip for now</button>
    </div>
  )
}

const TOPICS = ['Taste', 'Wait time', 'Price', 'Hygiene', 'Staff', 'Stock']

function Voice({ orderId, token, back, reset, setStudent, say }: Ctx & { orderId: string }) {
  const [topics, setTopics] = useState<string[]>([])
  const [phase, setPhase] = useState<'idle' | 'rec' | 'saving'>('idle')
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)
  const started = useRef(0)

  const finish = useCallback(async (blob: Blob, duration: number) => {
    setPhase('saving')
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const path = `${orderId}/${Date.now()}.${ext}`
      const up = await supabase.storage.from('voice-notes').upload(path, blob, { contentType: blob.type.split(';')[0] })
      if (up.error) throw up.error
      const s = await rpc<Student>('save_voice_note', { p_token: token, p_order: orderId, p_duration: duration, p_topics: topics, p_path: path })
      setStudent(s)
      say(s.notes_count >= 5 ? 'Voice note saved. 5% offer unlocked!' : `Voice note saved (${s.notes_count}/5)`)
      reset({ n: 'home' })
    } catch (e) { setErr(errMsg(e)); setPhase('idle') }
  }, [orderId, token, topics, setStudent, say, reset])

  const stop = useCallback(() => { window.clearInterval(timer.current); recorder.current?.state === 'recording' && recorder.current.stop() }, [])
  useEffect(() => () => { window.clearInterval(timer.current); recorder.current?.stream.getTracks().forEach(t => t.stop()) }, [])

  const start = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recorder.current = rec; chunks.current = []
      rec.ondataavailable = e => e.data.size && chunks.current.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const dur = Math.round((Date.now() - started.current) / 1000)
        finish(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }), dur)
      }
      rec.start(); started.current = Date.now(); setSecs(0); setPhase('rec')
      timer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - started.current) / 1000)
        setSecs(s); if (s >= 15) stop()
      }, 250)
    } catch {
      setErr('Microphone is blocked or unavailable. Allow mic access in your browser and try again.')
    }
  }

  return (
    <div className={`screen dark ${phase === 'rec' ? 'rec' : ''}`} style={{ overflowY: 'auto' }}>
      <div className="row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 16px 0' }}>
        <button className="back" style={{ background: '#3a3524', color: '#fff' }} onClick={back} disabled={phase !== 'idle'}>‹</button>
        <b>Voice feedback</b>
      </div>
      <div style={{ textAlign: 'center', padding: '28px 20px 0' }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>How was your order?</h1>
        <p style={{ color: '#bbb', fontSize: 14 }}>Speak naturally for 10–15 seconds. Taste, wait time, price, anything.</p>
        <div className="orb"><div><button onClick={phase === 'rec' ? stop : start} disabled={phase === 'saving'} aria-label="Record" /></div></div>
        {phase === 'rec' ? <div className="bigtime">0:{String(secs).padStart(2, '0')} / 0:15</div>
          : <b style={{ color: 'var(--yellow)' }}>{phase === 'saving' ? 'Saving your note…' : 'Tap the mic to start'}</b>}
        {phase === 'rec' && <p className="small" style={{ color: '#bbb' }}>Tap the mic again to finish</p>}
        <div className="topics" style={{ marginTop: 20 }}>
          {TOPICS.map(t => <button key={t} className={topics.includes(t) ? 'on' : ''} onClick={() => setTopics(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]))}>{t}</button>)}
        </div>
        <p className="small" style={{ color: '#999' }}>Not sure what to say? Pick topics as a prompt.</p>
        {err && <div className="err" style={{ margin: '8px 0' }}>{err}</div>}
      </div>
      <div style={{ flex: 1 }} />
      <div className="reward">Reward: 5% off above ₹150 after your 5th note.</div>
      {phase === 'idle' && <button className="linkbtn" style={{ color: '#aaa', marginBottom: 20 }} onClick={() => reset({ n: 'home' })}>Skip</button>}
    </div>
  )
}

function Orders({ back, token }: Ctx) {
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
            {o.has_note && <span className="note">Voice note sent</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Rewards({ student, back, go }: Ctx & { student: Student }) {
  const n = Math.min(student.notes_count, 5)
  return (
    <div className="screen">
      <Header title="My rewards" sub="Voice notes unlock offers" back={back} />
      <div className="scroll stack">
        <div className="card center" style={{ padding: 24 }}>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{n} / 5</div>
          <div className="muted">voice notes toward 5% off</div>
          <div style={{ display: 'flex', gap: 6, margin: '16px 0' }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 10, borderRadius: 6, background: i < n ? 'var(--yellow)' : 'var(--line)' }} />)}
          </div>
          <b>{n >= 5 ? 'Offer unlocked: 5% off your next order above ₹150' : `${5 - n} more note${5 - n > 1 ? 's' : ''} to unlock 5% off`}</b>
        </div>
        <button className="btn" onClick={() => go({ n: 'stores' })}>Order now</button>
      </div>
    </div>
  )
}

function TopUp({ student, back, token, setStudent, say }: Ctx & { student: Student }) {
  const [amt, setAmt] = useState(200)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true); setErr('')
    try { setStudent(await rpc<Student>('top_up', { p_token: token, p_amount: amt })); say(`${rupee(amt)} added to wallet`); back() }
    catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Header title="Add money" sub={`Current balance ${rupee(student.wallet)}`} back={back} />
      <div className="scroll stack">
        <div className="grid3">{[100, 200, 500].map(a => <button key={a} className={`card tile ${amt === a ? 'choice sel' : ''}`} style={{ fontSize: 18 }} onClick={() => setAmt(a)}>{rupee(a)}</button>)}</div>
        <input className="field" type="number" min={1} max={2000} value={amt} onChange={e => setAmt(Number(e.target.value))} />
        <div className="banner small">Demo wallet: money is simulated, no real payment is taken.</div>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy || !(amt >= 1 && amt <= 2000)} onClick={add}>{busy ? 'Adding…' : `Add ${rupee(amt || 0)}`}</button>
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

function VendorLogin({ back, onAuth }: { back: () => void; onAuth: (t: string) => void }) {
  const [stores, setStores] = useState<Store[]>([])
  const [sid, setSid] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { supabase.from('stores').select('*').order('sort').then(({ data }) => { setStores(data as Store[]); setSid((data as Store[])?.[0]?.id ?? '') }) }, [])
  const cur = stores.find(s => s.id === sid)
  const submit = async () => {
    setErr('')
    try { onAuth((await rpc<{ token: string }>('vendor_login', { p_store: sid, p_pin: pin })).token) } catch (e) { setErr(errMsg(e)) }
  }
  return (
    <div className="screen">
      <div className="hero"><div className="row"><button className="back" onClick={back}>‹</button>
        <div style={{ flex: 1 }}><h1>Vendor sign in</h1><div className="sub">Store manager access</div></div><span className="badge-v">VENDOR</span></div></div>
      <form className="scroll stack" onSubmit={e => { e.preventDefault(); submit() }}>
        <div><div className="label">Store</div>
          <select className="field" value={sid} onChange={e => setSid(e.target.value)}>{stores.map(s => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select></div>
        <div><div className="label">Staff PIN</div>
          <input className="field" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div>
        <div className="banner small">Demo PIN for every store: <b>1234</b> {cur && <>· {cur.name}</>}</div>
        {err && <div className="err">{err}</div>}
        <button className="btn dk" disabled={!pin || !sid}>Open store dashboard</button>
      </form>
    </div>
  )
}

const NEXT: Record<string, string> = { new: 'preparing', preparing: 'ready', ready: 'done' }

function Vendor({ token, logout, say }: { token: string; logout: () => void; say: (m: string) => void }) {
  const [d, setD] = useState<Dashboard | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => rpc<Dashboard>('vendor_dashboard', { p_token: token }).then(setD).catch(e => {
    setErr(errMsg(e)); if (/expired/i.test(errMsg(e))) logout()
  }), [token, logout])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  const advance = async (id: string, status: string) => { try { await rpc('vendor_set_status', { p_token: token, p_order: id, p_status: NEXT[status] }); load() } catch (e) { say(errMsg(e)) } }
  const restock = async (id: string) => { try { await rpc('vendor_restock', { p_token: token, p_item: id, p_qty: 50 }); say('Restocked +50'); load() } catch (e) { say(errMsg(e)) } }
  if (!d) return <div className="center">{err || 'Loading dashboard…'}</div>
  const pct = d.orders_total ? Math.round((d.voice_notes / d.orders_total) * 100) : 0
  return (
    <div className="screen">
      <div className="hero"><div className="row"><div style={{ flex: 1 }}><h1 style={{ fontSize: 22 }}>{d.store.name}</h1><div className="sub">{d.store.open ? 'Accepting orders' : 'Closed'} · live, refreshes every 5s</div></div>
        <span className="badge-v">VENDOR</span></div></div>
      <div className="scroll stack">
        <div className="stats">
          <div className="card stat"><span className="muted small">Orders today</span><b>{d.orders_today}</b></div>
          <div className="card stat"><span className="muted small">Revenue today</span><b>{rupee(Number(d.revenue_today))}</b></div>
          <div className="card stat"><span className="muted small">Voice notes</span><b>{d.voice_notes}</b><span className="up">{pct}% of orders</span></div>
          <div className="card stat"><span className="muted small">Top voice topics</span>
            <div className="small" style={{ marginTop: 6, fontWeight: 700 }}>{Object.entries(d.topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, c]) => `${t} (${c})`).join(', ') || '—'}</div></div>
        </div>
        {d.low_stock.map(i => (
          <div key={i.id} className="alert"><span>{i.name}: {i.stock === 0 ? 'sold out' : `only ${i.stock} left`}.</span><button onClick={() => restock(i.id)}>Restock ›</button></div>
        ))}
        <b>Live queue</b>
        {d.queue.length === 0 && <div className="muted center" style={{ padding: 16 }}>No open orders. New orders appear here instantly.</div>}
        {d.queue.map(o => (
          <div key={o.id} className="card"><div className="qrow">
            <div><b>#{o.seq}</b> {o.student_name}<div className="small muted" style={{ marginTop: 4 }}>{o.items}</div>
              {o.note_sec != null && <span className="note">Voice note ▶ {o.note_sec}s</span>}</div>
            <div className="r"><b>{rupee(o.total)}</b>
              <button className={`status ${o.status}`} onClick={() => advance(o.id, o.status)}>{o.status === 'new' ? 'New → Prepare' : o.status === 'preparing' ? 'Preparing → Ready' : 'Ready → Done'}</button></div>
          </div></div>
        ))}
      </div>
      <div className="tabs"><button className="on">Orders</button><button onClick={logout}>Sign out</button></div>
    </div>
  )
}
