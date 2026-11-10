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

// Small pictures instead of letter tiles: matched on words in the product name, falling back to the first letter.
const FOOD: [RegExp, string][] = [
  [/roll|wrap/i, '🌯'], [/maggi|noodle/i, '🍜'], [/chai|tea\b/i, '☕'], [/coffee/i, '☕'], [/sandwich/i, '🥪'], [/burger/i, '🍔'], [/pizza/i, '🍕'],
  [/fries/i, '🍟'], [/biscuit|cookie/i, '🍪'], [/bun\b|bread/i, '🍞'], [/cold drink|soda|cola/i, '🥤'], [/watermelon/i, '🍉'], [/orange/i, '🍊'],
  [/coconut/i, '🥥'], [/juice|sugarcane/i, '🧃'], [/lassi|buttermilk|chaas|shake|milk/i, '🥛'], [/kulfi|ice cream|cone/i, '🍦'],
  [/thali|biryani|chole|rice/i, '🍛'], [/notebook|notes\b/i, '📓'], [/pen\b/i, '🖊️'], [/sticky/i, '🗒️'], [/earphone|headphone/i, '🎧'], [/hoodie|tee|shirt/i, '🧥'],
]
export const foodEmoji = (name: string) => FOOD.find(([re]) => re.test(name))?.[1] ?? null

const ICONS: Record<string, string> = {
  orders: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  menu: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  insights: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  store: 'M3 9l1-5h16l1 5M3 9v11h18V9M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3M9 20v-6h6v6',
}
export function TabIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] ?? ICONS.store} /></svg>
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
