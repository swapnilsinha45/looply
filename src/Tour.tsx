import { useEffect, useLayoutEffect, useState } from 'react'
import { store } from './ui'

// A short guided tour for a vendor's first visit: a spotlight on each part of the phone dashboard.
// Steps point at elements marked with data-tour="...". Each step can switch the tab first.
export type VTab = 'orders' | 'menu' | 'insights' | 'store'
type Step = { target?: string; tab?: VTab; title: string; body: string }

export const tourKey = (storeId: string) => `looply_tour_done_${storeId}`
export const tourDone = (storeId: string) => store.get(tourKey(storeId)) === '1'

export function vendorSteps(storeName: string, wide: boolean): Step[] {
  return [
    { title: `Welcome to Looply, ${storeName}`, body: 'A one-minute tour of your dashboard. You can skip it now and replay it any time from the Store tab.' },
    { target: 'orders', tab: 'orders', title: 'Orders arrive here', body: 'New orders show up within 5 seconds. Tap the status button to move each one along: Prepare, then Ready, then Done.' },
    { target: 'pause', tab: 'orders', title: 'Need a break?', body: 'Pause new orders in one tap. Tap again to start accepting orders.' },
    { target: 'stats', tab: 'orders', title: 'Your day at a glance', body: 'Orders and revenue today, how many notes were actionable, and the overall student mood from −100 to +100.' },
    { target: 'products', tab: 'menu', title: 'Products and stock', body: 'Add products with + Add product. Stock falls by itself with every order. Set “Warn me at” and you get an alert before an item runs out.' },
    { target: 'insights', tab: 'insights', title: 'What students say', body: 'Voice reviews, anonymous: you see “Student”, never names. “Needs attention” lists the serious complaints first. Translate or Ignore any review.' },
    ...(wide ? [{ target: 'desktop', tab: 'orders' as VTab, title: 'Bigger screen?', body: 'Open the desktop dashboard for charts by product, hour and day.' }] : []),
    { target: 'store', tab: 'store', title: 'Your store settings', body: 'Edit your name, prep time and phone here. You can replay this tour from this tab whenever you like.' },
  ]
}

export default function Tour({ steps, setTab, onClose }: { steps: Step[]; setTab: (t: VTab) => void; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => { if (step.tab) setTab(step.tab) }, [step, setTab])

  // find the highlighted element after the tab renders; follow it on scroll and resize
  useLayoutEffect(() => {
    if (!step.target) { setRect(null); return }
    let raf = 0
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const first = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)?.scrollIntoView({ block: 'nearest' })
      measure()
    }, 60)
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    window.addEventListener('resize', onMove); window.addEventListener('scroll', onMove, true)
    return () => { clearTimeout(first); cancelAnimationFrame(raf); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true) }
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI(n => Math.min(n + 1, steps.length - 1))
      if (e.key === 'ArrowLeft') setI(n => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, steps.length])

  const pad = 6
  const vh = window.innerHeight
  // the card sits below the highlight when there is room, otherwise above it
  const below = rect ? rect.bottom + 190 < vh : true
  const cardStyle: React.CSSProperties = rect
    ? below ? { top: Math.min(rect.bottom + pad + 10, vh - 200) } : { bottom: Math.max(vh - rect.top + pad + 10, 12) }
    : { top: '50%', transform: 'translateY(-50%)' }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect
        ? <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={cardStyle}>
        <div className="tour-count">{i + 1} of {steps.length}</div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">{steps.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          {!last && <button className="tour-skip" onClick={onClose}>Skip tour</button>}
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="tour-back" onClick={() => setI(i - 1)}>Back</button>}
          <button className="tour-next" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Start using Looply' : i === 0 ? 'Show me' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
