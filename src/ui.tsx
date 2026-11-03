import type { ReactNode } from 'react'

export const store = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string | null) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ } },
}
export const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export function Header({ title, sub, back, children }: { title: string; sub?: string; back?: () => void; children?: ReactNode }) {
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

export const daysLeft = (iso: string | null) => {
  if (!iso) return null
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return d
}

// A short burst of confetti; purely decorative (aria-hidden), pure CSS.
const COLORS = ['#ffc72c', '#e8820c', '#1c9b66', '#2b4ff6', '#d92d3a', '#8a5cf6']
export function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {Array.from({ length: 26 }).map((_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length],
          animationDelay: `${(i % 9) * 0.06}s`, animationDuration: `${1.1 + (i % 5) * 0.18}s`,
          transform: `rotate(${(i * 47) % 360}deg)`, ['--dx' as string]: `${((i * 53) % 90) - 45}px`,
        }} />
      ))}
    </span>
  )
}
