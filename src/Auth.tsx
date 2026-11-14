import { useEffect, useState } from 'react'
import { rpc } from './api'
import type { Student } from './api'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
const IIMB = /^[a-z0-9._%+-]+@iimb\.ac\.in$/i
type Role = 'student' | 'vendor'
type Purpose = 'verify' | 'reset'

// Asks the send-code edge function to email a 6-digit code. It answers the same way whether or not the account exists.
async function sendCode(email: string, role: Role, purpose: Purpose) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
    body: JSON.stringify({ email, role, purpose }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not send the code')
}

// student_login / vendor_login raise "EMAIL_NOT_VERIFIED:<email>" when the password is right but the email is unproven
const unverifiedEmail = (e: unknown) => { const m = errMsg(e).match(/EMAIL_NOT_VERIFIED:(\S+)/); return m ? m[1] : null }

function Top({ title, sub, back, badge }: { title: string; sub: string; back: () => void; badge?: string }) {
  return (
    <div className="hero"><div className="row"><button className="back" onClick={back} aria-label="Back">‹</button>
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

// Enter the emailed code. Resending is rate limited on the server too (3 codes per 15 minutes).
function CodeStep({ email, role, note, onVerified }: { email: string; role: Role; note: string; onVerified: (data: Record<string, unknown>) => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState(note)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(30)
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t) }, [wait])
  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<Record<string, unknown>>('verify_email', { p_email: email, p_role: role, p_code: code })
      if (r.error) setErr(String(r.error)); else onVerified(r)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const resend = async () => {
    setErr(''); setWait(30)
    try { await sendCode(email, role, 'verify'); setInfo(`We sent a new code to ${email}.`) } catch (e) { setErr(errMsg(e)) }
  }
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (code.length === 6) submit() }}>
      <div className="verify-head"><span className="verify-icon">✉</span><div><b>Check your email</b><span className="small muted">{info}</span></div></div>
      <div><div className="label">6-digit code</div>
        <input className="field code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" autoFocus /></div>
      {err && <div className="err">{err}</div>}
      <button className="btn" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify and continue'}</button>
      <button type="button" className="linkbtn" disabled={wait > 0} onClick={resend}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
      <div className="small muted" style={{ textAlign: 'center' }}>Codes expire after 10 minutes. Check spam if you can’t see it.</div>
    </form>
  )
}

// Forgot password: email -> code + new password.
function ForgotFlow({ role, onDone }: { role: Role; onDone: (msg: string) => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const request = async () => {
    setBusy(true); setErr('')
    try { await sendCode(email.trim(), role, 'reset'); setSent(true) } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const reset = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<{ ok?: boolean; error?: string }>('reset_password', { p_email: email.trim(), p_role: role, p_code: code, p_password: pw })
      if (r.error) setErr(r.error); else onDone('Password updated. Sign in with your new password.')
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return !sent ? (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (email.trim()) request() }}>
      <div className="small muted">Enter your account email. If it exists, we will email you a 6-digit code.</div>
      <input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoCapitalize="none" inputMode="email" autoComplete="username" />
      {err && <div className="err">{err}</div>}
      <button className="btn" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Email me a code'}</button>
    </form>
  ) : (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (code.length === 6 && pw.length >= 8) reset() }}>
      <div className="small muted">If {email.trim()} has an account, a code is on its way.</div>
      <div><div className="label">6-digit code</div><input className="field code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" /></div>
      <div><div className="label">New password</div><input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></div>
      {err && <div className="err">{err}</div>}
      <button className="btn" disabled={busy || code.length !== 6 || pw.length < 8}>{busy ? 'Saving…' : 'Set new password'}</button>
    </form>
  )
}

export function StudentAuth({ back, onAuth }: { back: () => void; onAuth: (t: string, s: Student) => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'verify' | 'forgot'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [verifyEmail, setVerifyEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const emailOk = IIMB.test(email.trim())
  const valid = mode === 'in' ? email.trim() && pw : name.trim().length > 1 && emailOk && pw.length >= 8

  const toVerify = async (em: string, why: string) => {
    setVerifyEmail(em); setMode('verify'); setNotice(why)
    try { await sendCode(em, 'student', 'verify') } catch (e) { setErr(errMsg(e)) }
  }
  const submit = async () => {
    setBusy(true); setErr(''); setNotice('')
    try {
      if (mode === 'in') {
        const r = await rpc<Student & { token: string }>('student_login', { p_id: email.trim(), p_password: pw })
        onAuth(r.token, r)
      } else {
        const r = await rpc<(Student & { token: string }) | { needs_verification: true; email: string }>('student_signup', { p_name: name.trim(), p_email: email.trim(), p_password: pw, p_code: code.trim() })
        if ('needs_verification' in r) await toVerify(r.email, `We sent a 6-digit code to ${r.email}. Enter it to finish creating your account.`)
        else onAuth(r.token, r)
      }
    } catch (e) {
      const em = unverifiedEmail(e)
      if (em) await toVerify(em, `Your email isn’t verified yet. We sent a code to ${em}.`)
      else setErr(errMsg(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="screen">
      <Top title="Student" sub={mode === 'verify' ? 'Verify your IIMB email' : mode === 'forgot' ? 'Reset your password' : mode === 'in' ? 'Welcome back' : 'Use your IIMB email'} back={mode === 'verify' || mode === 'forgot' ? () => { setMode('in'); setErr('') } : back} />
      <div className="scroll stack">
        {mode === 'verify' && <CodeStep email={verifyEmail} role="student" note={notice} onVerified={r => onAuth(String(r.token), r as unknown as Student)} />}
        {mode === 'forgot' && <ForgotFlow role="student" onDone={m => { setMode('in'); setNotice(m) }} />}
        {(mode === 'in' || mode === 'up') && (
          <form className="stack" onSubmit={e => { e.preventDefault(); if (valid) submit() }}>
            <Seg value={mode} onChange={m => { setMode(m); setErr(''); setNotice('') }} />
            {notice && <div className="banner small">{notice}</div>}
            {mode === 'up' && <div><div className="label">Full name</div>
              <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></div>}
            <div><div className="label">{mode === 'in' ? 'IIMB email or student ID' : 'IIMB email'}</div>
              <input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder={mode === 'in' ? 'you@iimb.ac.in or PGP2026-114' : 'you@iimb.ac.in'} autoCapitalize="none" autoComplete="username" inputMode="email" />
              {mode === 'up' && email.length > 3 && (emailOk
                ? <div className="hint ok">✓ IIMB email. We will send a code to confirm it’s yours.</div>
                : <div className="hint bad">Only @iimb.ac.in emails can create a student account</div>)}</div>
            {mode === 'up' && <div><div className="label">Student ID (optional)</div>
              <input className="field" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. PGP2026-114" autoCapitalize="characters" /></div>}
            <div><div className="label">Password</div>
              <input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={mode === 'up' ? 'At least 8 characters' : 'Your password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></div>
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy || !valid}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
            {mode === 'in' && (<>
              <button type="button" className="linkbtn" onClick={() => { setMode('forgot'); setErr('') }}>Forgot password?</button>
              <div className="banner small">Demo student: <b>durgesh@iimb.ac.in</b> / <b>looply123</b></div>
              <button type="button" className="pill" onClick={() => { setEmail('durgesh@iimb.ac.in'); setPw('looply123') }}>Autofill demo student</button>
            </>)}
          </form>
        )}
      </div>
    </div>
  )
}

type Row = { name: string; price: string; stock: string; veg: boolean; sku: string; category: string }
const emptyRow = (): Row => ({ name: '', price: '', stock: '20', veg: true, sku: '', category: 'snack' })
const COLORS = ['#F59E0B', '#D9480F', '#DC2F3A', '#6D44DC', '#1E6FD9', '#2E9E48', '#0E9AA7', '#C2255C']
const DEMOS = ['hgs', 'snc', 'aml', 'mrs', 'gmc', 'juc']
export const CATEGORIES: [string, string][] = [['meal', 'Meal'], ['snack', 'Snack'], ['beverage', 'Drink'], ['dessert', 'Dessert'], ['essentials', 'Essentials']]

export function VendorAuth({ back, onAuth }: { back: () => void; onAuth: (t: string) => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'verify' | 'forgot'>('in')
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
  const [notice, setNotice] = useState('')
  const [verifyEmail, setVerifyEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const emailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim())
  const filled = rows.filter(r => r.name.trim())
  const skus = filled.map(r => r.sku.trim().toUpperCase()).filter(Boolean)
  const dupSku = new Set(skus).size !== skus.length
  const step1 = owner.trim().length > 1 && emailOk && pw.length >= 8
  const step2 = name.trim().length > 1 && Number(eta) > 0
  const step3 = filled.length > 0 && filled.every(r => Number(r.price) >= 0 && r.price !== '') && !dupSku

  const setRow = (i: number, p: Partial<Row>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...p } : r)))
  const toVerify = async (em: string, why: string) => {
    setVerifyEmail(em); setMode('verify'); setNotice(why)
    try { await sendCode(em, 'vendor', 'verify') } catch (e) { setErr(errMsg(e)) }
  }

  const login = async () => {
    setBusy(true); setErr(''); setNotice('')
    try { onAuth((await rpc<{ token: string }>('vendor_login', { p_email: email.trim(), p_password: pw })).token) }
    catch (e) {
      const em = unverifiedEmail(e)
      if (em) await toVerify(em, `This email isn’t verified yet. We sent a code to ${em}.`)
      else setErr(errMsg(e))
    } finally { setBusy(false) }
  }
  const signup = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rpc<{ token: string } | { needs_verification: true; email: string }>('vendor_signup', {
        p_owner: owner.trim(), p_email: email.trim(), p_password: pw, p_phone: phone.trim(), p_name: name.trim(), p_tags: tags.trim(),
        p_description: desc.trim(), p_pure_veg: pureVeg, p_eta: Number(eta), p_color: color,
        p_items: filled.map(r => ({ name: r.name.trim(), price: Number(r.price), stock: Number(r.stock) || 0, veg: r.veg, sku: r.sku.trim(), category: r.category })),
      })
      if ('needs_verification' in r) await toVerify(r.email, `Your store is set up. We sent a 6-digit code to ${r.email} to confirm it’s yours.`)
      else onAuth(r.token)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  const sub = mode === 'verify' ? 'Verify your email' : mode === 'forgot' ? 'Reset your password' : mode === 'in' ? 'Store manager access' : `Set up your store · step ${step} of 3`
  const goBack = mode === 'verify' || mode === 'forgot' ? () => { setMode('in'); setErr('') } : mode === 'up' && step > 1 ? () => setStep(step - 1) : back

  return (
    <div className="screen">
      <Top title="Vendor" sub={sub} back={goBack} badge="VENDOR" />
      <div className="scroll stack">
        {mode === 'verify' && <CodeStep email={verifyEmail} role="vendor" note={notice} onVerified={r => onAuth(String(r.token))} />}
        {mode === 'forgot' && <ForgotFlow role="vendor" onDone={m => { setMode('in'); setNotice(m) }} />}
        {(mode === 'in' || mode === 'up') && (
          <form className="stack" onSubmit={e => { e.preventDefault(); if (mode === 'in') login(); else if (step < 3) setStep(step + 1); else signup() }}>
            {step === 1 && <Seg value={mode} onChange={m => { setMode(m); setStep(1); setErr(''); setNotice('') }} />}
            {notice && <div className="banner small">{notice}</div>}

            {mode === 'in' && (<>
              <div><div className="label">Email</div>
                <input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="store@example.com" autoCapitalize="none" inputMode="email" autoComplete="username" /></div>
              <div><div className="label">Password</div>
                <input className="field" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" /></div>
              {err && <div className="err">{err}</div>}
              <button className="btn dk" disabled={busy || !email.trim() || !pw}>{busy ? 'Signing in…' : 'Open store dashboard'}</button>
              <button type="button" className="linkbtn" onClick={() => { setMode('forgot'); setErr('') }}>Forgot password?</button>
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
                  <div className="two" style={{ marginTop: 8, alignItems: 'center' }}>
                    <select className="field sm" value={r.category} onChange={e => setRow(i, { category: e.target.value })} aria-label="Category">
                      {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label className="check-row"><input type="checkbox" checked={r.veg} onChange={e => setRow(i, { veg: e.target.checked })} /> Veg</label>
                      {rows.length > 1 && <button type="button" className="small" style={{ color: 'var(--red)', fontWeight: 700 }} onClick={() => setRows(rs => rs.filter((_, k) => k !== i))}>Remove</button>}
                    </div>
                  </div>
                </div>
              ))}
              {rows.length < 20 && <button type="button" className="btn ghost" onClick={() => setRows(rs => [...rs, emptyRow()])}>+ Add another product</button>}
              {dupSku && <div className="err">Two products use the same SKU. SKUs must be unique.</div>}
              {err && <div className="err">{err}</div>}
              <button className="btn dk" disabled={busy || !step3}>{busy ? 'Creating store…' : `Create store with ${filled.length} product${filled.length === 1 ? '' : 's'}`}</button>
            </>)}
          </form>
        )}
      </div>
    </div>
  )
}
