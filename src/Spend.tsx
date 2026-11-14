import { useEffect, useState } from 'react'
import { rpc } from './api'
import { Header, errMsg, foodEmoji, rupee } from './ui'

type Spend = {
  orders: number; total: number; avg_order: number; saved: number
  this_week: number; last_week: number; this_month: number; last_month: number
  weekly: { label: string; amount: number }[]; monthly: { label: string; amount: number }[]
  by_category: { category: string; amount: number; items: number }[]
  top_items: { name: string; qty: number; amount: number; category: string; store: string }[]
  by_store: { store: string; amount: number; orders: number }[]
}

export const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  meal: { label: 'Meals', icon: '🍛', color: '#e8820c' },
  snack: { label: 'Snacks', icon: '🍟', color: '#ffc72c' },
  beverage: { label: 'Drinks', icon: '🥤', color: '#2b9fd9' },
  dessert: { label: 'Desserts', icon: '🍦', color: '#d946a8' },
  essentials: { label: 'Essentials', icon: '🛍️', color: '#8a8372' },
}

function Change({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before) return <span className="sp-delta muted">{now ? `nothing ${label}` : 'no spend yet'}</span>
  const p = Math.round(((now - before) / before) * 100)
  return <span className={`sp-delta ${p > 0 ? 'more' : 'less'}`}>{p > 0 ? '▲' : '▼'} {Math.abs(p)}% vs {label}</span>
}

export default function SpendScreen({ token, back }: { token: string | null; back: () => void }) {
  const [s, setS] = useState<Spend | null>(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  useEffect(() => { rpc<Spend>('my_spend', { p_token: token }).then(setS).catch(e => setErr(errMsg(e))) }, [token])

  if (!s) return <div className="screen"><Header title="Spend analysis" sub="Where your wallet goes" back={back} /><div className="center muted">{err || 'Crunching your orders…'}</div></div>
  if (s.orders === 0) return <div className="screen"><Header title="Spend analysis" sub="Where your wallet goes" back={back} /><div className="center muted">No orders yet. Your spending breakdown appears after your first order.</div></div>

  const series = view === 'weekly' ? s.weekly : s.monthly
  const max = Math.max(1, ...series.map(x => x.amount))
  const catTotal = s.by_category.reduce((a, c) => a + c.amount, 0)
  const share = (c: string) => Math.round(((s.by_category.find(x => x.category === c)?.amount ?? 0) / (catTotal || 1)) * 100)
  const food = s.by_category.filter(c => c.category !== 'essentials').reduce((a, c) => a + c.amount, 0)
  const ofFood = (c: string) => (food ? Math.round(((s.by_category.find(x => x.category === c)?.amount ?? 0) / food) * 100) : 0)
  const storeMax = Math.max(1, ...s.by_store.map(x => x.amount))

  return (
    <div className="screen">
      <Header title="Spend analysis" sub="Where your wallet goes" back={back} />
      <div className="scroll stack">
        <div className="sp-stats">
          <div className="card"><span className="muted small">This week</span><b>{rupee(s.this_week)}</b><Change now={s.this_week} before={s.last_week} label="last week" /></div>
          <div className="card"><span className="muted small">This month</span><b>{rupee(s.this_month)}</b><Change now={s.this_month} before={s.last_month} label="last month" /></div>
        </div>

        <div className="card">
          <div className="between">
            <b>{view === 'weekly' ? 'Weekly spending' : 'Monthly spending'}</b>
            <div className="seg mini">
              <button className={view === 'weekly' ? 'on' : ''} onClick={() => setView('weekly')}>Weekly</button>
              <button className={view === 'monthly' ? 'on' : ''} onClick={() => setView('monthly')}>Monthly</button>
            </div>
          </div>
          <div className="sp-chart" role="img" aria-label={`${view} spending`}>
            {series.map((x, i) => (
              <div key={x.label} className={i === series.length - 1 ? 'now' : ''} title={`${x.label}: ${rupee(x.amount)}`}>
                <span className="v">{x.amount ? rupee(x.amount) : ''}</span>
                <i style={{ height: `${(x.amount / max) * 100}%` }} />
                <span className="l">{view === 'weekly' ? x.label.split(' ')[0] + ' ' + x.label.split(' ')[1]?.slice(0, 3) : x.label}</span>
              </div>
            ))}
          </div>
          <div className="small muted">{view === 'weekly' ? 'Each bar is a week starting Monday.' : 'Last 6 months.'} The highlighted bar is the current one.</div>
        </div>

        <div className="card">
          <b>What you buy</b>
          <div className="sp-stack">
            {s.by_category.map(c => <i key={c.category} style={{ width: `${(c.amount / (catTotal || 1)) * 100}%`, background: CATEGORY_META[c.category]?.color ?? '#aaa' }} title={CATEGORY_META[c.category]?.label} />)}
          </div>
          {s.by_category.map(c => (
            <div key={c.category} className="sp-cat">
              <span className="ic">{CATEGORY_META[c.category]?.icon ?? '•'}</span>
              <span className="nm"><b>{CATEGORY_META[c.category]?.label ?? c.category}</b><small>{c.items} item{c.items === 1 ? '' : 's'}</small></span>
              <span className="pc">{share(c.category)}%</span>
              <b className="am">{rupee(c.amount)}</b>
            </div>
          ))}
          {food > 0 && <div className="sp-insight">
            Of your food and drink spend, {ofFood('snack')}% goes on snacks and {ofFood('meal')}% on proper meals{ofFood('beverage') ? `, ${ofFood('beverage')}% on drinks` : ''}.
            {ofFood('snack') >= 50 && ' Snacking is your biggest habit.'}
          </div>}
        </div>

        <div className="card">
          <b>Most ordered</b>
          {s.top_items.map((t, i) => (
            <div key={t.name} className="sp-item">
              <span className="rank">{i + 1}</span>
              <span className="em">{foodEmoji(t.name) ?? CATEGORY_META[t.category]?.icon ?? '•'}</span>
              <span className="nm"><b>{t.name}</b><small>{t.store}</small></span>
              <span className="qty">×{t.qty}</span>
              <b className="am">{rupee(t.amount)}</b>
            </div>
          ))}
        </div>

        <div className="card">
          <b>Where you spend</b>
          {s.by_store.map(x => (
            <div key={x.store} className="c-bar-row sp-store"><span>{x.store}</span>
              <span className="c-track"><i style={{ width: `${(x.amount / storeMax) * 100}%`, background: 'var(--yellow)' }} /></span>
              <b>{rupee(x.amount)}</b></div>
          ))}
        </div>

        <div className="sp-foot">
          <div><b>{s.orders}</b><span>orders</span></div>
          <div><b>{rupee(s.avg_order)}</b><span>average order</span></div>
          <div><b>{rupee(s.saved)}</b><span>saved with perks</span></div>
        </div>
      </div>
    </div>
  )
}
