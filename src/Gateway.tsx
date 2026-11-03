import { useEffect, useMemo, useRef, useState } from 'react'
import { rpc } from './api'
import type { Student } from './api'
import { Confetti, Header, errMsg, rupee } from './ui'

// A pretend payment gateway. It looks and feels like checkout, but nothing here is sent anywhere
// except the final top_up call, which just adds the amount to the demo wallet.

type Method = 'upi' | 'card' | 'bank'
const BANKS = ['Demo Bank', 'Sample National', 'Test Trust', 'Mock Savings', 'Pretend Union', 'Sandbox Bank']
const PRESETS = [100, 200, 500, 1000]
const STEPS = ['Securing your connection', 'Reaching your bank', 'Confirming the payment']

const groups = (s: string) => s.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
const expiry = (s: string) => { const d = s.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }

function Qr() {
  // deterministic fake QR: three finder squares plus a pseudo-random fill
  const n = 21
  const cells = useMemo(() => {
    const out: [number, number][] = []
    let x = 7
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8)
      x = (x * 1103515245 + 12345) & 0x7fffffff
      if (!inFinder && x % 3 === 0) out.push([r, c])
    }
    return out
  }, [])
  const finder = (r: number, c: number) => (
    <g key={`${r}-${c}`}><rect x={c} y={r} width="7" height="7" fill="#231f14" /><rect x={c + 1} y={r + 1} width="5" height="5" fill="#fff" /><rect x={c + 2} y={r + 2} width="3" height="3" fill="#231f14" /></g>
  )
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="qr" role="img" aria-label="Demo QR code">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      {cells.map(([r, c]) => <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#231f14" />)}
      {finder(0, 0)}{finder(0, n - 7)}{finder(n - 7, 0)}
    </svg>
  )
}

function CountUp({ from, to }: { from: number; to: number }) {
  const [v, setV] = useState(from)
  useEffect(() => {
    const t0 = performance.now(); let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to])
  return <>{rupee(v)}</>
}

export default function Gateway({ student, token, back, setStudent }: {
  student: Student; token: string | null; back: () => void; setStudent: (s: Student) => void
}) {
  const [step, setStep] = useState<'amount' | 'pay' | 'processing' | 'success'>('amount')
  const [amt, setAmt] = useState(200)
  const [method, setMethod] = useState<Method>('upi')
  const [upi, setUpi] = useState('')
  const [card, setCard] = useState({ num: '4242 4242 4242 4242', name: student.name.toUpperCase(), exp: '12/30', cvv: '123' })
  const [bank, setBank] = useState('')
  const [err, setErr] = useState('')
  const [phase, setPhase] = useState(0)
  const [txn, setTxn] = useState('')
  const before = useRef(student.wallet)

  const amountOk = Number.isInteger(amt) && amt >= 1 && amt <= 2000
  const payOk = method === 'upi' ? /^[\w.-]{2,}@[\w]{2,}$/.test(upi.trim()) || upi === 'qr'
    : method === 'card' ? card.num.replace(/\D/g, '').length === 16 && /^\d{2}\/\d{2}$/.test(card.exp) && card.cvv.length >= 3 && card.name.trim().length > 1
    : !!bank

  const pay = async () => {
    setErr(''); setStep('processing'); setPhase(0); before.current = student.wallet
    const timers = [setTimeout(() => setPhase(1), 900), setTimeout(() => setPhase(2), 1800)]
    try {
      const [s] = await Promise.all([rpc<Student>('top_up', { p_token: token, p_amount: amt }), new Promise(r => setTimeout(r, 2700))])
      setStudent(s)
      setTxn('LPY' + Math.random().toString(10).slice(2, 12))
      setStep('success')
    } catch (e) { setErr(errMsg(e)); setStep('pay') } finally { timers.forEach(clearTimeout) }
  }

  if (step === 'processing') return (
    <div className="screen gw-dark">
      <div className="gw-proc">
        <div className="gw-shield"><span /><i>L</i></div>
        <h2>Paying {rupee(amt)}</h2>
        <div className="gw-steps">
          {STEPS.map((s, i) => <div key={s} className={i < phase ? 'done' : i === phase ? 'now' : ''}><span>{i < phase ? '✓' : ''}</span>{s}</div>)}
        </div>
        <div className="small" style={{ opacity: .6 }}>Please don’t close this screen</div>
      </div>
    </div>
  )

  if (step === 'success') return (
    <div className="screen gw-dark">
      <div className="gw-success">
        <Confetti />
        <div className="gw-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg></div>
        <h1>{rupee(amt)} added</h1>
        <p>Your Looply wallet is topped up.</p>
        <div className="gw-receipt">
          <div><span>New balance</span><b><CountUp from={before.current} to={student.wallet} /></b></div>
          <div><span>Paid with</span><b>{method === 'upi' ? 'UPI' : method === 'card' ? `Card ···· ${card.num.slice(-4)}` : bank}</b></div>
          <div><span>Reference</span><b>{txn}</b></div>
          <div><span>Time</span><b>{new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b></div>
        </div>
        <button className="btn" onClick={back}>Done</button>
        <div className="small" style={{ opacity: .55, marginTop: 10 }}>Demo payment, no real money moved</div>
      </div>
    </div>
  )

  return (
    <div className="screen">
      <Header title="Add money" sub={`Balance ${rupee(student.wallet)}`} back={step === 'pay' ? () => setStep('amount') : back} />
      <div className="scroll stack">
        {step === 'amount' && (<>
          <div className="gw-amount">
            <span className="muted small">How much would you like to add?</span>
            <div className="gw-big"><span>₹</span>
              <input inputMode="numeric" aria-label="Amount" value={amt || ''} onChange={e => setAmt(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </div>
            <input type="range" min={50} max={2000} step={50} value={Math.min(2000, Math.max(50, amt))} onChange={e => setAmt(Number(e.target.value))} className="gw-range" aria-label="Amount slider" />
            <div className="gw-presets">{PRESETS.map(p => <button key={p} className={amt === p ? 'on' : ''} onClick={() => setAmt(p)}>{rupee(p)}</button>)}</div>
          </div>
          <div className="gw-after card"><span className="muted small">Balance after adding</span><b>{rupee(student.wallet + (amountOk ? amt : 0))}</b></div>
          {!amountOk && amt > 2000 && <div className="err">The most you can add at once is ₹2,000.</div>}
          <button className="btn dk" disabled={!amountOk} onClick={() => setStep('pay')}>Continue to pay</button>
        </>)}

        {step === 'pay' && (<>
          <div className="gw-bill"><span>Paying</span><b>{rupee(amt)}</b><span className="gw-lock">Secured checkout</span></div>
          <div className="seg">
            {(['upi', 'card', 'bank'] as Method[]).map(m => <button key={m} type="button" className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{m === 'upi' ? 'UPI' : m === 'card' ? 'Card' : 'Netbanking'}</button>)}
          </div>

          {method === 'upi' && (<div className="card stack">
            <div><div className="label">UPI ID</div>
              <input className="field" value={upi === 'qr' ? '' : upi} onChange={e => setUpi(e.target.value)} placeholder="yourname@demo" autoCapitalize="none" inputMode="email" /></div>
            <div className="gw-or"><span>or</span></div>
            <button type="button" className={`gw-qr ${upi === 'qr' ? 'on' : ''}`} onClick={() => setUpi(upi === 'qr' ? '' : 'qr')}>
              <Qr /><span><b>Scan to pay</b><small>Demo QR, tap to select</small></span>
            </button>
          </div>)}

          {method === 'card' && (<div className="stack">
            <div className="gw-card">
              <div className="chip" /><div className="num">{card.num || '•••• •••• •••• ••••'}</div>
              <div className="row"><div><small>CARD HOLDER</small><b>{card.name || 'YOUR NAME'}</b></div><div><small>EXPIRES</small><b>{card.exp || 'MM/YY'}</b></div></div>
            </div>
            <div className="card stack">
              <div><div className="label">Card number</div><input className="field sm" inputMode="numeric" value={card.num} onChange={e => setCard({ ...card, num: groups(e.target.value) })} /></div>
              <div><div className="label">Name on card</div><input className="field sm" value={card.name} onChange={e => setCard({ ...card, name: e.target.value.toUpperCase().slice(0, 26) })} /></div>
              <div className="two">
                <div><div className="label">Expiry</div><input className="field sm" inputMode="numeric" value={card.exp} onChange={e => setCard({ ...card, exp: expiry(e.target.value) })} placeholder="MM/YY" /></div>
                <div><div className="label">CVV</div><input className="field sm" inputMode="numeric" type="password" value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>
              </div>
            </div>
          </div>)}

          {method === 'bank' && (<div className="gw-banks">
            {BANKS.map(b => <button key={b} className={bank === b ? 'on' : ''} onClick={() => setBank(b)}><i>{b[0]}</i>{b}</button>)}
          </div>)}

          <div className="banner small">This is a demo checkout. No real payment is made and nothing you type here leaves your phone. A test card is already filled in.</div>
          {err && <div className="err">{err}</div>}
          <button className="btn dk" disabled={!payOk} onClick={pay}>Pay {rupee(amt)}</button>
        </>)}
      </div>
    </div>
  )
}
