import { useCallback, useEffect, useState } from 'react'
import { rpc } from './api'
import type { Reward, RewardsHub } from './api'
import { Confetti, Header, daysLeft, errMsg, rupee } from './ui'

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

const TIER_COLOR: Record<string, string> = { Regular: '#8a8372', Silver: '#8e9aa6', Gold: '#d99a00' }

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
          <span className="sparkle">✦</span><b>{phase === 'wipe' ? 'Revealing…' : 'Scratch to reveal'}</b><span className="small">from your voice note</span>
        </button>
      )}
      {err && <div className="err">{err}</div>}
    </div>
  )
}

type Props = {
  token: string | null; back: () => void; go: (r: { n: 'stores' } | { n: 'topup' }) => void
  openId?: string; milestone?: boolean; refreshStudent: () => void
}

export default function RewardsScreen({ token, back, go, openId, milestone, refreshStudent }: Props) {
  const [hub, setHub] = useState<RewardsHub | null>(null)
  const [err, setErr] = useState('')
  const [showOld, setShowOld] = useState(false)

  const load = useCallback(() => rpc<RewardsHub>('my_rewards', { p_token: token }).then(setHub).catch(e => setErr(errMsg(e))), [token])
  useEffect(() => { load() }, [load])

  if (!hub) return <div className="screen"><Header title="Rewards" sub="Speak, earn, save" back={back} /><div className="center muted">{err || 'Loading your rewards…'}</div></div>

  const scratch = hub.rewards.filter(r => r.status === 'scratch')
  const live = hub.rewards.filter(r => r.status === 'available')
  const old = hub.rewards.filter(r => r.status === 'used' || r.status === 'expired')
  const t = hub.tier
  const tierPct = t.next_at ? Math.min(100, Math.round((t.notes / t.next_at) * 100)) : 100
  const potential = live.reduce((s, r) => s + (r.kind === 'flat' || r.kind === 'cashback_flat' ? r.value ?? 0 : 0), 0)

  return (
    <div className="screen">
      <Header title="Rewards" sub="Speak, earn, save" back={back} />
      <div className="scroll stack">
        {milestone && <div className="banner celebrate"><Confetti /> <b>Milestone reached!</b> A 5% off coupon was added to your rewards.</div>}

        <div className="tier-card" style={{ ['--tier' as string]: TIER_COLOR[t.name] }}>
          <div className="tier-top">
            <span className="tier-badge">{t.name}</span>
            <span className="small">{t.cashback_pct ? `${t.cashback_pct}% cashback on every order` : 'Reach Silver for cashback on every order'}</span>
          </div>
          <div className="tier-grid">
            <div><b>{rupee(hub.saved_total)}</b><span>saved so far</span></div>
            <div><b>{rupee(hub.cashback_total)}</b><span>cashback earned</span></div>
            <div><b>{live.length + scratch.length}</b><span>rewards waiting</span></div>
          </div>
          <div className="small" style={{ marginTop: 14 }}>
            {t.next_name ? `${t.notes} of ${t.next_at} voice notes to ${t.next_name}` : 'Top tier reached. Thank you for speaking up!'}
          </div>
          <div className="bar"><i style={{ width: `${tierPct}%` }} /></div>
        </div>

        <div className="card milestone">
          <div className="between"><b>Next coupon</b><span className="small muted">5% off, every 5 voice notes</span></div>
          <div className="pips">
            {Array.from({ length: hub.milestone.target }).map((_, i) => <span key={i} className={i < hub.milestone.progress ? 'on' : ''}>{i < hub.milestone.progress ? '●' : i + 1}</span>)}
          </div>
          <div className="small muted">{hub.milestone.target - hub.milestone.progress} more voice note{hub.milestone.target - hub.milestone.progress === 1 ? '' : 's'} to unlock it</div>
        </div>

        {scratch.length > 0 && (<>
          <div className="section-title">Scratch cards <span className="count">{scratch.length}</span></div>
          <div className="scratch-row">
            {scratch.map(r => <Scratch key={r.id} r={r} token={token} auto={r.id === openId} onDone={() => { load(); refreshStudent() }} />)}
          </div>
        </>)}

        <div className="section-title">Your coupons <span className="count">{live.length}</span></div>
        {live.length === 0 && <div className="card center muted small" style={{ padding: 24 }}>No coupons yet. Record a voice note after your next order to earn a scratch card.</div>}
        {live.map(r => <Ticket key={r.id} r={r} onUse={() => go({ n: 'stores' })} />)}
        {potential > 0 && <div className="small muted" style={{ textAlign: 'center' }}>Worth up to {rupee(potential)} in flat savings</div>}

        <div className="section-title">How to earn</div>
        <div className="card earn">
          <div><i>1</i><div><b>Order and pay</b><p>Every order at a campus store builds your history and your favourites.</p></div></div>
          <div><i>2</i><div><b>Speak for 15 seconds</b><p>Each voice note gives you a scratch card with a coupon or cashback.</p></div></div>
          <div><i>3</i><div><b>Every 5th note</b><p>Unlocks a 5% off coupon for orders above ₹150.</p></div></div>
          <div><i>4</i><div><b>Climb the tiers</b><p>Silver at 5 notes gives 2% cashback on every order. Gold at 15 notes gives 3%.</p></div></div>
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

        <button className="btn" onClick={() => go({ n: 'stores' })}>Order now and use a reward</button>
        <button className="btn ghost" onClick={() => go({ n: 'topup' })}>Add money</button>
      </div>
    </div>
  )
}
