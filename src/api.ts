import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

export type Store = {
  id: string; code: string; name: string; tags: string; description: string
  pure_veg: boolean; eta_min: number; color: string; open: boolean
}
export type MenuItem = {
  id: string; store_id: string; name: string; description: string
  price: number; veg: boolean; stock: number
}
export type Student = {
  id: string; code: string; name: string; campus: string; wallet: number; notes_count: number
  // returned by save_voice_note
  scratch_id?: string; milestone?: boolean
}
export type OrderRow = {
  id: string; seq: number; total: number; discount: number; status: string
  created_at: string; store_name: string; items: string; has_note: boolean
}
export type Dashboard = {
  store: Store; orders_today: number; revenue_today: number; voice_notes: number; orders_total: number
  low_stock: { id: string; name: string; stock: number }[]
  topics: Record<string, number>
  queue: { id: string; seq: number; total: number; status: string; created_at: string; student_name: string; items: string; note_sec: number | null }[]
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export type RewardKind = 'percent' | 'flat' | 'cashback_flat' | 'cashback_percent'
export type Reward = {
  id: string; status: 'scratch' | 'available' | 'used' | 'expired'; kind: RewardKind | null
  title: string; description: string; value: number | null; min_order: number | null; max_discount: number | null
  store_id: string | null; store_name: string | null; source: string; expires_at: string | null; created_at: string
}
export type Tier = { name: 'Regular' | 'Silver' | 'Gold'; cashback_pct: number; next_name: string | null; next_at: number | null; notes?: number }
export type RewardsHub = {
  student: Student; tier: Tier & { notes: number }; milestone: { progress: number; target: number }
  cashback_total: number; saved_total: number; rewards: Reward[]
  history: { amount: number; kind: string; note: string; created_at: string }[]
}
export type Favourite = {
  id: string; name: string; color: string; tags: string; eta_min: number; open: boolean; orders: number; popular: boolean
  usual: string | null; last_items: { item_id: string; name: string; qty: number }[]
}
export type Feedback = {
  notes: {
    id: string; transcript: string; summary: string | null; sentiment: 'positive' | 'neutral' | 'negative'; sentiment_score: number
    category: string | null; severity: string | null; flags: string[]; topics: string[]; language: string | null; method: string | null
    created_at: string; seq: number | null; student: string; items: string | null
  }[]
  categories: Record<string, number>
  flags: Record<string, number>
}
