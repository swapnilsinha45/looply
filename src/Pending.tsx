import type { OrderRow } from './api'
import { rupee } from './ui'

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

// Recent orders that have no voice review yet, with a one-tap way to record it.
export function PendingReviews({ orders, onRecord }: { orders: OrderRow[]; onRecord: (orderId: string) => void }) {
  if (orders.length === 0) return null
  return (
    <>
      <div className="section-title">Share feedback on a recent order</div>
      <div className="pending">
        {orders.map(o => (
          <div key={o.id} className="pending-card">
            <div className="pc-info">
              <b>{o.store_name}</b>
              <span className="small muted pc-items">{o.items}</span>
              <span className="small muted">{rupee(o.total)} · {ago(o.created_at)}</span>
              <span className="pc-reward">Optional · 15 seconds</span>
            </div>
            <button className="pc-btn" onClick={() => onRecord(o.id)}>Record now</button>
          </div>
        ))}
      </div>
    </>
  )
}
