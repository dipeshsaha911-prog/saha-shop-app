// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ─── INVENTORY ─────────────────────────────────────────────────────────────

export async function fetchInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('brand')
  if (error) throw error
  return data
}

/**
 * Update buying and selling price for an item.
 * The DB trigger (log_price_change) will auto-record the change in price_history.
 */
export async function updateItemPrice(itemId, buyingPrice, sellingPrice) {
  if (sellingPrice <= buyingPrice) throw new Error('Selling price must exceed buying price')

  const { data, error } = await supabase
    .from('inventory')
    .update({ buying_price: buyingPrice, selling_price: sellingPrice })
    .eq('id', itemId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function addInventoryItem(item) {
  const { data, error } = await supabase
    .from('inventory')
    .insert([item])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── RESTOCK ───────────────────────────────────────────────────────────────

/**
 * Record a new stock arrival.
 * The DB trigger (add_stock_on_restock) will automatically:
 *   inventory.stock += quantity
 */
export async function recordRestock({ inventoryId, brandSnapshot, quantity, unitCost, invoiceNumber, supplier, note }) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('restocks')
    .insert([{
      inventory_id: inventoryId,
      brand_snapshot: brandSnapshot,
      quantity,
      unit_cost: unitCost,
      invoice_number: invoiceNumber || null,
      supplier: supplier || null,
      restocked_by: user.id,
      note: note || null
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchRestocks({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('restocks')
    .select(`*, profiles(full_name)`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// ─── SALES ─────────────────────────────────────────────────────────────────

/**
 * Record a sale.
 * The DB trigger (deduct_stock_on_sale) will automatically:
 *   1. Check inventory.stock >= quantity (throws if not)
 *   2. inventory.stock -= quantity
 */
export async function recordSale({ inventoryId, brandSnapshot, quantity, unitPrice, unitCost, note }) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('sales')
    .insert([{
      inventory_id: inventoryId,
      brand_snapshot: brandSnapshot,
      quantity,
      unit_price: unitPrice,
      unit_cost: unitCost,
      sold_by: user.id,
      note: note || null
    }])
    .select()
    .single()

  if (error) throw error  // "Insufficient stock" error surfaces here
  return data
}

export async function fetchSales({ date, limit = 100 } = {}) {
  let query = supabase
    .from('sales')
    .select(`*, profiles(full_name)`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (date) {
    // Filter by specific date (using Asia/Kolkata timezone)
    const start = `${date}T00:00:00+05:30`
    const end   = `${date}T23:59:59+05:30`
    query = query.gte('created_at', start).lte('created_at', end)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── REPORTS ───────────────────────────────────────────────────────────────

export async function fetchDailySummary({ months = 3 } = {}) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const { data, error } = await supabase
    .from('daily_sales_summary')
    .select('*')
    .gte('sale_date', since.toISOString().split('T')[0])
    .order('sale_date', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchLowStockAlerts() {
  const { data, error } = await supabase.from('low_stock_alerts').select('*')
  if (error) throw error
  return data
}

export async function fetchPriceHistory(inventoryId) {
  const { data, error } = await supabase
    .from('price_history')
    .select(`*, profiles(full_name)`)
    .eq('inventory_id', inventoryId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── REAL-TIME SUBSCRIPTIONS ───────────────────────────────────────────────

/**
 * Subscribe to live inventory changes (stock levels, prices).
 * Returns an unsubscribe function — call it on component unmount.
 *
 * Usage:
 *   const unsubscribe = subscribeToInventory((payload) => refetchInventory())
 *   return () => unsubscribe()
 */
export function subscribeToInventory(callback) {
  const channel = supabase
    .channel('inventory-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'restocks' }, callback)
    .subscribe()

  return () => supabase.removeChannel(channel)
}
