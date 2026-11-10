import { useCallback, useEffect, useState } from 'react'
import { rpc } from './api'
import type { Reward, RewardsHub, Student } from './api'
import { Confetti, Header, daysLeft, errMsg, rupee } from './ui'
import { ConsentSheet } from './Consent'

// ---------- shared reward maths (mirrors place_order on the server) ----------
export const kindBadge = (r: Reward) => {
  if (!r.kind || r.value === null) return '?'
  return r.kind === 'percent' ? `${r.value}%` : r.kind === 'flat' ? `₹${r.value}` : r.kind === 'cashback_flat' ? `₹${r.value}` : `${r.value}%`
}
export const kindLabel = (r: Reward) =>
  !r.kind ? '' : r.kind === 'percent' || r.kind === 'flat' ? 'OFF' : 'CASHBACK'

export function rewardEffect(r: Reward, subtotal: number, storeId: string): { ok: boolean; why?: string; discount: number; cashback: number } {
  if (r.status !== 'available' || !r.kind || r.value === null) return { ok: false, why: 'Not available', discount: 0, cashback: 0 }
  if (r.store_id && r.store_id !== storeId) return { ok: false, why: `Only at ${r.store_name ?? 'another store'}`, discount: 0, cashback: 0 }
  const min = r.min_order ?? 0
  if (subtotal < min) return { ok: false, why: `Add ${rupee(min - subtotal)} more`, discount: 0, cashback: 0 }
  const cap = r.max_discount ?? 100000
  if (r.kind === 'percent') return { ok: true, discount: Math.min(Math.round((subtotal * r.value) / 100), cap), cashback: 0 }
  if (r.kind === 'flat') return { ok: true, discount: Math.min(r.value, subtotal), cashback: 0 }
  if (r.kind === 'cashback_flat') return { ok: true, discount: 0, cashback: r.value }
  return { ok: true, discount: 0, cashback: Math.min(Math.round((subtotal * r.value) / 100), cap) }
}

// The one rule, in the one set of words used everywhere.
export const RULE = 'Keep feedback on and order 3 times in a month to earn that month’s perk.'

function Ticket({ r, onUse, dim }: { r: Reward; onUse?: () => void; dim?: boolean }) {
  const d = daysLeft(r.expires_at)
  const cash = r.kind === 'cashback_flat' || r.kind === 'cashback_percent'
  return (
    <div className={`ticket ${cash ? 'cash' : ''} ${dim ? 'dim' : ''}`}>
      <div className="stub"><b>{kindBadge(r)}</b><span>{kindLabel(r)}</span></div>
      <div className="body">
        <b>{r.title}</b>
        <p>{r.description}</p>
        <div className="meta">
          {r.store_name && <span className="chip-s">{r.store_name} only</span>}
          {r.status === 'used' ? <span className="chip-s used">Used</span>
            : r.status === 'expired' ? <span className="chip-s used">Expired</span>
            : d !== null && <span className={`chip-s ${d <= 2 ? 'urgent' : ''}`}>{d <= 0 ? 'Expires today' : `${d} day${d === 1 ? '' : 's'} left`}</span>}
        </div>
      </div>
      {onUse && r.status === 'available' && <button className="use" onClick={onUse}>Use</button>}
    </div>
  )
}

function Scratch({ r, token, auto, onDone }: { r: Reward; token: string | null; auto: boolean; onDone: (prize: Reward) => void }) {
  const [phase, setPhase] = useState<'idle' | 'wipe' | 'done'>('idle')
  const [prize, setPrize] = useState<Reward | null>(null)
  const [err, setErr] = useState('')
  const open = useCallback(async () => {
    if (phase !== 'idle') return
    setPhase('wipe'); setErr('')
    try {
      const d = await rpc<Reward>('reveal_reward', { p_token: token, p_id: r.id })
      await new Promise(res => setTimeout(res, 900)) // let the wipe animation play
      const full = { ...r, ...d, status: 'available' as const }
      setPrize(full); setPhase('done'); onDone(full)
    } catch (e) { setErr(errMsg(e)); setPhase('idle') }
  }, [phase, r, token, onDone])
  useEffect(() => { if (auto) { const t = setTimeout(open, 600); return () => clearTimeout(t) } }, [auto, open])

  return (
    <div className={`scratch ${phase}`}>
      {phase === 'done' && prize ? (
        <div className="prize"><Confetti /><span className="small">You won</span><b>{prize.title}</b><p>{prize.description}</p></div>
      ) : (
        <button className="cover" onClick={open} aria-label="Scratch to reveal">
          <span className="sparkle">✦</span><b>{phase === 'wipe' ? 'Revealing…' : 'Scratch to reveal'}</b><span className="small">your monthly perk</span>
        </button>
      )}
      {err && <div className="err">{err}</div>}
    </div>
  )
}

type Props = {
  token: string | null; student: Student; setStudent: (s: Student) => void
  back: () => void; go: (r: { n: 'stores' } | { n: 'topup' }) => void
  openId?: string; refreshStudent: () => void
}

export default function RewardsScreen({ token, student, setStudent, back, go, openId, refreshStudent }: Props) {
  const [hub, setHub] = useState<RewardsHub | null>(null)
  const [err, setErr] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [consent, setConsent] = useState(false)

  const load = useCallback(() => rpc<RewardsHub>('my_rewards', { p_token: token }).then(setHub).catch(e => setErr(errMsg(e))), [token])
  useEffect(() => { load() }, [load])

  const toggle = async () => {
    if (!student.feedback_on) { setConsent(true); return }
    if (!confirm('Turn feedback off? You will stop earning the monthly perk. Feedback you already shared stays as it is.')) return
    try { setStudent(await rpc<Student>('set_feedback', { p_token: token, p_on: false })); load() } catch (e) { setErr(errMsg(e)) }
  }

  if (!hub) return <div className="screen"><Header title="Rewards" sub="Feedback Club" back={back} /><div className="center muted">{err || 'Loading your rewards…'}</div></div>

  const on = student.feedback_on === true
  const scratch = hub.rewards.filter(r => r.status === 'scratch')
  const live = hub.rewards.filter(r => r.status === 'available')
  const old = hub.rewards.filter(r => r.status === 'used' || r.status === 'expired')
  const { orders, target, perk_earned: earned, resets } = hub.month
  const resetsOn = new Date(resets).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const status = !on
    ? (orders >= target && !earned ? 'Turn feedback on and your next order earns this month’s perk.' : 'Turn feedback on to start earning this month’s perk.')
    : earned ? 'You earned this month’s perk. It is in your scratch cards below.'
    : orders >= target ? 'Your next order earns this month’s perk.'
    : `${target - orders} more order${target - orders === 1 ? '' : 's'} this month. Resets ${resetsOn}.`

  return (
    <div className="screen">
      <Header title="Rewards" sub="Feedback Club" back={back} />
      <div className="scroll stack">
        <div className={`club ${on ? 'on' : ''}`}>
          <div className="club-top">
            <div><b>Feedback is {on ? 'on' : 'off'}</b><span>Anonymous: stores see “Student”, never your name</span></div>
            <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label="Feedback" onClick={toggle}><i /></button>
          </div>
          <p className="rule">{RULE}</p>
          <div className="pips">
            {Array.from({ length: target }).map((_, i) => <span key={i} className={i < Math.min(orders, target) ? 'on' : ''}>{i < Math.min(orders, target) ? '●' : i + 1}</span>)}
            <span className="pip-label">{Math.min(orders, target)} of {target} orders this month</span>
          </div>
          <div className="small status">{status}</div>
        </div>

        <div className="tier-grid light">
          <div><b>{rupee(hub.saved_total)}</b><span>saved so far</span></div>
          <div><b>{rupee(hub.cashback_total)}</b><span>cashback earned</span></div>
          <div><b>{live.length + scratch.length}</b><span>rewards waiting</span></div>
        </div>

        {scratch.length > 0 && (<>
          <div className="section-title">Scratch cards <span className="count">{scratch.length}</span></div>
          <div className="scratch-row">
            {scratch.map(r => <Scratch key={r.id} r={r} token={token} auto={r.id === openId} onDone={() => { load(); refreshStudent() }} />)}
          </div>
        </>)}

        <div className="section-title">Your coupons <span className="count">{live.length}</span></div>
        {live.length === 0 && <div className="card center muted small" style={{ padding: 24 }}>No coupons yet. {RULE}</div>}
        {live.map(r => <Ticket key={r.id} r={r} onUse={() => go({ n: 'stores' })} />)}

        <div className="section-title">How it works</div>
        <div className="card earn">
          <div><i>1</i><div><b>Order at a campus store</b><p>Your orders move you forward. Writing feedback is optional.</p></div></div>
          <div><i>2</i><div><b>Keep feedback on</b><p>You agree once to share anonymous feedback. Stores see your words as “Student”, never your name or audio.</p></div></div>
          <div><i>3</i><div><b>Order 3 times in a month</b><p>You earn that month’s perk: a scratch card with a coupon or cashback.</p></div></div>
          <div><i>4</i><div><b>Nobody is paid per note</b><p>Feedback is never bought by the unit, so honest feedback stays honest.</p></div></div>
        </div>

        <div className="section-title">Wallet activity</div>
        <div className="card">
          {hub.history.length === 0 && <div className="muted small">Nothing yet.</div>}
          {hub.history.map((h, i) => (
            <div key={i} className="txn"><div><b>{h.kind === 'cashback' ? 'Cashback' : h.kind === 'topup' ? 'Money added' : 'Payment'}</b><div className="muted small">{h.note}</div></div>
              <b className={h.amount >= 0 ? 'up' : ''}>{h.amount >= 0 ? '+' : '−'}{rupee(Math.abs(h.amount))}</b></div>
          ))}
        </div>

        {old.length > 0 && (<>
          <button className="linkbtn" onClick={() => setShowOld(v => !v)}>{showOld ? 'Hide' : 'Show'} used and expired ({old.length})</button>
          {showOld && old.map(r => <Ticket key={r.id} r={r} dim />)}
        </>)}

        <button className="btn" onClick={() => go({ n: 'stores' })}>Order now</button>
        <button className="btn ghost" onClick={() => go({ n: 'topup' })}>Add money</button>
      </div>
      {consent && <ConsentSheet token={token} onCancel={() => setConsent(false)} onDone={s => { setStudent(s); setConsent(false); load() }} />}
    </div>
  )
}
