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
export type Student = { id: string; code: string; name: string; campus: string; wallet: number; notes_count: number }
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
