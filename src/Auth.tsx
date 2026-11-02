import { useState } from 'react'
import { rpc } from './api'
import type { Student } from './api'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const IIMB = /^[a-z0-9._%+-]+@iimb\.ac\.in$/i

function Top({ title, sub, back, badge }: { title: string; sub: string; back: () => void; badge?: string }) {
  return (
    <div className="hero"><div className="row"><button className="back" onClick={back}>‹</button>
      <div style={{ flex: 1 }}><h1>{title}</h1><div className="sub">{sub}</div></div>
      {badge && <span className="badge-v">{badge}</span>}</div></div>
  )
}

function Seg({ value, onChange }: { value: 'in' | 'up'; onChange: (v: 'in' | 'up') => void }) {
  return (
    <div className="seg">
      <button type="button" className={value === 'in' ? 'on' : ''} onClick={() => onChange('in')}>Sign in</button>
      <button type="button" className={value === 'up' ? 'on' : ''} onClick={() => onChange('up')}>Create account</button>
    </div>
  )
}

export function StudentAuth({ back, onAuth }: { back: () => void; onAuth: (t: string, s: Student) => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const emailOk = IIMB.test(email.trim())
  const valid = mode === 'in' ? email.trim() && pw : name.trim().length > 1 && emailOk && pw.length >= 8

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const r = mode === 'in'
        ? await rpc<Student & { token: string }>('student_login', { p_id: email.trim(), p_password: pw })
        : await rpc<Student & { token: string }>('student_signup', { p_name: name.trim(), p_email: email.trim(), p_password: pw, p_code: code.trim() })
      onAuth(r.token, r)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="screen">
      <Top title="Student" sub={mode === 'in' ? 'Welcome back' : 'Use your IIMB email to get verified instantly'} back={back} />
      <form className="scroll stack" onSubmit={e => { e.preventDefault(); if (valid) submit() }}>
        <Seg value={mode} onChange={m => { setMode(m); setErr('') }} />
        {mode === 'up' && <div><div className="label">Full name</div>
          <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></div>}
        <div><div className="label">{mode === 'in' ? 'IIMB email or student ID' : 'IIMB email'}</div>
          <input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder={mode === 'in' ? 'you@iimb.ac.in or PGP2026-114' : 'you@iimb.ac.in'} autoCapitalize="none" autoComplete="username" inputMode="email" />
          {mode === 'up' && email.length > 3 && (emailOk
            ? <div className="hint ok">✓ IIMB email, you will be verified automatically</div>
            : <div className="hint bad">Only @iimb.ac.in emails can create a student account</div>)}</div>
        {mode === 'up' && <div><div className="label">Student ID (optional)</div>
          <input className="field" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. PGP2026-114" autoCapitalize="characters" /></div>}
        <div><div className="label">Password</div>
          <input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={mode === 'up' ? 'At least 8 characters' : 'Your password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></div>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy || !valid}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        {mode === 'in' && (<>
          <div className="banner small">Demo student: <b>durgesh@iimb.ac.in</b> / <b>looply123</b></div>
          <button type="button" className="pill" onClick={() => { setEmail('durgesh@iimb.ac.in'); setPw('looply123') }}>Autofill demo student</button>
        </>)}
      </form>
    </div>
  )
}

type Row = { name: string; price: string; stock: string; veg: boolean; sku: string }
const emptyRow = (): Row => ({ name: '', price: '', stock: '20', veg: true, sku: '' })
const COLORS = ['#F59E0B', '#D9480F', '#DC2F3A', '#6D44DC', '#1E6FD9', '#2E9E48', '#0E9AA7', '#C2255C']
const DEMOS = ['hgs', 'snc', 'aml', 'mrs', 'gmc', 'juc']

export function VendorAuth({ back, onAuth }: { back: () => void; onAuth: (t: string) => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [owner, setOwner] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [desc, setDesc] = useState('')
  const [pureVeg, setPureVeg] = useState(false)
  const [eta, setEta] = useState('10')
  const [color, setColor] = useState(COLORS[0])
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const emailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim())
  const filled = rows.filter(r => r.name.trim())
  const skus = filled.map(r => r.sku.trim().toUpperCase()).filter(Boolean)
  const dupSku = new Set(skus).size !== skus.length
  const step1 = owner.trim().length > 1 && emailOk && pw.length >= 8
  const step2 = name.trim().length > 1 && Number(eta) > 0
  const step3 = filled.length > 0 && filled.every(r => Number(r.price) >= 0 && r.price !== '') && !dupSku

  const setRow = (i: number, p: Partial<Row>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...p } : r)))

  const login = async () => {
    setBusy(true); setErr('')
    try { onAuth((await rpc<{ token: string }>('vendor_login', { p_email: email.trim(), p_password: pw })).token) }
    catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const signup = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<{ token: string }>('vendor_signup', {
        p_owner: owner.trim(), p_email: email.trim(), p_password: pw, p_phone: phone.trim(), p_name: name.trim(), p_tags: tags.trim(),
        p_description: desc.trim(), p_pure_veg: pureVeg, p_eta: Number(eta), p_color: color,
        p_items: filled.map(r => ({ name: r.name.trim(), price: Number(r.price), stock: Number(r.stock) || 0, veg: r.veg, sku: r.sku.trim() })),
      })
      onAuth(r.token)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="screen">
      <Top title="Vendor" sub={mode === 'in' ? 'Store manager access' : `Set up your store · step ${step} of 3`} back={mode === 'up' && step > 1 ? () => setStep(step - 1) : back} badge="VENDOR" />
      <form className="scroll stack" onSubmit={e => { e.preventDefault(); if (mode === 'in') login(); else if (step < 3) setStep(step + 1); else signup() }}>
        {step === 1 && <Seg value={mode} onChange={m => { setMode(m); setStep(1); setErr('') }} />}

        {mode === 'in' && (<>
          <div><div className="label">Email</div>
            <input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="store@example.com" autoCapitalize="none" inputMode="email" autoComplete="username" /></div>
          <div><div className="label">Password</div>
            <input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" /></div>
          {err && <div className="err">{err}</div>}
          <button className="btn dk" disabled={busy || !email.trim() || !pw}>{busy ? 'Signing in…' : 'Open store dashboard'}</button>
          <div className="banner small">Demo stores use password <b>looply123</b> with these emails. Tap to fill:
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {DEMOS.map(c => <button type="button" className="pill" key={c} onClick={() => { setEmail(`${c}@looply.demo`); setPw('looply123') }}>{c}@looply.demo</button>)}
            </div></div>
        </>)}

        {mode === 'up' && step === 1 && (<>
          <div><div className="label">Owner / manager name</div><input className="field" value={owner} onChange={e => setOwner(e.target.value)} autoComplete="name" /></div>
          <div><div className="label">Email</div><input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="store@example.com" autoCapitalize="none" inputMode="email" autoComplete="username" />
            {email.length > 3 && !emailOk && <div className="hint bad">Enter a valid email</div>}</div>
          <div><div className="label">Phone (optional)</div><input className="field" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" /></div>
          <div><div className="label">Password</div><input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></div>
          <button className="btn dk" disabled={!step1}>Next: store details</button>
        </>)}

        {mode === 'up' && step === 2 && (<>
          <div><div className="label">Store name</div><input className="field" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><div className="label">Categories</div><input className="field" value={tags} onChange={e => setTags(e.target.value)} placeholder="Snacks · Tea · Rolls" /></div>
          <div><div className="label">Description</div><input className="field" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What do you sell?" maxLength={160} /></div>
          <div className="two">
            <div><div className="label">Prep time (min)</div><input className="field" inputMode="numeric" value={eta} onChange={e => setEta(e.target.value.replace(/\D/g, ''))} /></div>
            <label className="check-row" style={{ alignSelf: 'end', paddingBottom: 14 }}><input type="checkbox" checked={pureVeg} onChange={e => setPureVeg(e.target.checked)} /> Pure veg</label>
          </div>
          <div><div className="label">Store colour</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{COLORS.map(c => <button type="button" key={c} onClick={() => setColor(c)} aria-label={c}
              style={{ width: 34, height: 34, borderRadius: '50%', background: c, outline: color === c ? '3px solid var(--ink)' : 'none', outlineOffset: 2 }} />)}</div></div>
          <button className="btn dk" disabled={!step2}>Next: add products</button>
        </>)}

        {mode === 'up' && step === 3 && (<>
          <div className="banner small">Add your starting products. Leave SKU blank to auto-generate. You can add, edit and delete products later from the dashboard.</div>
          {rows.map((r, i) => (
            <div className="card sku-row" key={i}>
              <div className="two"><input className="field sm" placeholder="Product name" value={r.name} onChange={e => setRow(i, { name: e.target.value })} />
                <input className="field sm" placeholder="SKU (optional)" value={r.sku} onChange={e => setRow(i, { sku: e.target.value.toUpperCase() })} /></div>
              <div className="two" style={{ marginTop: 8 }}>
                <input className="field sm" placeholder="Price ₹" inputMode="numeric" value={r.price} onChange={e => setRow(i, { price: e.target.value.replace(/\D/g, '') })} />
                <input className="field sm" placeholder="Stock" inputMode="numeric" value={r.stock} onChange={e => setRow(i, { stock: e.target.value.replace(/\D/g, '') })} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <label className="check-row"><input type="checkbox" checked={r.veg} onChange={e => setRow(i, { veg: e.target.checked })} /> Veg</label>
                {rows.length > 1 && <button type="button" className="small" style={{ color: 'var(--red)', fontWeight: 700 }} onClick={() => setRows(rs => rs.filter((_, k) => k !== i))}>Remove</button>}
              </div>
            </div>
          ))}
          {rows.length < 20 && <button type="button" className="btn ghost" onClick={() => setRows(rs => [...rs, emptyRow()])}>+ Add another product</button>}
          {dupSku && <div className="err">Two products use the same SKU. SKUs must be unique.</div>}
          {err && <div className="err">{err}</div>}
          <button className="btn dk" disabled={busy || !step3}>{busy ? 'Creating store…' : `Create store with ${filled.length} product${filled.length === 1 ? '' : 's'}`}</button>
        </>)}
      </form>
    </div>
  )
}
