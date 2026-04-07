'use client'
// src/components/Sales.jsx
// POS Counter — fast sale entry with instant stock deduction via Supabase trigger.

import { useState, useEffect, useCallback } from 'react'
import { fetchInventory, fetchSales, recordSale } from '@/lib/supabaseClient'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function Sales() {
  const [inventory, setInventory]   = useState([])
  const [todaySales, setTodaySales] = useState([])
  const [form, setForm]             = useState({ itemId: '', quantity: '' })
  const [preview, setPreview]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage]       = useState(null)

  const loadData = useCallback(async () => {
    const [inv, sales] = await Promise.all([
      fetchInventory(),
      fetchSales({ date: todayIST() })
    ])
    setInventory(inv)
    setTodaySales(sales)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Live preview whenever form changes
  useEffect(() => {
    const item = inventory.find(i => i.id === parseInt(form.itemId))
    const qty  = parseInt(form.quantity)
    if (!item || !qty || qty <= 0) { setPreview(null); return }
    setPreview({
      item,
      qty,
      unitPrice:  item.selling_price,
      unitCost:   item.buying_price,
      total:      qty * item.selling_price,
      profit:     qty * (item.selling_price - item.buying_price),
      remaining:  item.stock - qty,
      insufficient: item.stock < qty
    })
  }, [form.itemId, form.quantity, inventory])

  function showMsg(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!preview) return
    if (preview.insufficient) {
      showMsg(`Only ${preview.item.stock} units in stock.`, 'error')
      return
    }

    setSubmitting(true)
    try {
      await recordSale({
        inventoryId:   preview.item.id,
        brandSnapshot: preview.item.brand,
        quantity:      preview.qty,
        unitPrice:     preview.unitPrice,
        unitCost:      preview.unitCost,
      })

      // Optimistic update — deduct from local inventory
      setInventory(prev => prev.map(i =>
        i.id === preview.item.id ? { ...i, stock: i.stock - preview.qty } : i
      ))

      // Refresh today's sales list
      const updated = await fetchSales({ date: todayIST() })
      setTodaySales(updated)

      showMsg(`Sale recorded! ${preview.item.brand} × ${preview.qty} = ${fmt(preview.total)}`)
      setForm({ itemId: '', quantity: '' })
    } catch (err) {
      // DB trigger throws "Insufficient stock" — surface it cleanly
      showMsg(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  const dayRevenue = todaySales.reduce((s, t) => s + Number(t.total_amount), 0)
  const dayProfit  = todaySales.reduce((s, t) => s + Number(t.profit), 0)

  // ── Export today's sales as CSV ───────────────────────────────────────────
  function exportTodayCSV() {
    const headers = ['Time', 'Item', 'Qty', 'Unit Price', 'Total', 'Profit', 'By']
    const rows = todaySales.map(t => [
      new Date(t.created_at).toLocaleTimeString('en-IN'),
      `"${t.brand_snapshot}"`, t.quantity,
      t.unit_price, t.total_amount, t.profit,
      `"${t.profiles?.full_name || ''}"`
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `sales-${todayIST()}.csv` })
    a.click()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales / POS Counter</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fast entry · Stock deducted instantly on submission</p>
        </div>
        <button onClick={exportTodayCSV} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
          Export Today's CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

        {/* ── Sale form ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">New Sale Entry</h2>

          {message && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
              message.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Select Brand *</label>
              <select
                value={form.itemId}
                onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              >
                <option value="">— Select brand —</option>
                {inventory.filter(i => i.stock > 0).map(i => (
                  <option key={i.id} value={i.id}>
                    {i.brand} — Stock: {i.stock} | {fmt(i.selling_price)}/unit
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Quantity *</label>
              <input
                type="number" min="1" required
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              />
            </div>

            {/* Live bill preview */}
            {preview && (
              <div className={`rounded-lg p-3 text-sm space-y-1 ${preview.insufficient ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex justify-between text-gray-500">
                  <span>Unit Price</span><span>{fmt(preview.unitPrice)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Quantity</span><span>{preview.qty} units</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                  <span>Total Amount</span><span>{fmt(preview.total)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Est. Profit</span><span>+{fmt(preview.profit)}</span>
                </div>
                <div className={`flex justify-between ${preview.insufficient ? 'text-red-600 font-medium' : preview.remaining < 10 ? 'text-amber-600' : 'text-gray-500'}`}>
                  <span>Stock After Sale</span>
                  <span>{preview.insufficient ? 'INSUFFICIENT STOCK' : `${preview.remaining} units left`}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || preview?.insufficient}
              className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#7B2D42' }}
            >
              {submitting ? 'Recording…' : 'Record Sale & Deduct Stock'}
            </button>
          </form>
        </div>

        {/* ── Today's summary + log ── */}
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Today's Revenue", value: fmt(dayRevenue) },
              { label: "Today's Profit",  value: fmt(dayProfit) },
              { label: 'Transactions',    value: todaySales.length },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
                <div className="text-lg font-semibold text-gray-900">{m.value}</div>
              </div>
            ))}
          </div>

          {/* Today's log */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-sm font-medium text-gray-700">Today's Sales Log</h2>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{todaySales.length} entries</span>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 sticky top-0 bg-white">
                    {['Time','Item','Qty','Total','Profit','By'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs text-gray-400 uppercase font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todaySales.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No sales recorded today</td></tr>
                  )}
                  {todaySales.map(t => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{t.brand_snapshot}</td>
                      <td className="px-3 py-2 text-gray-600">{t.quantity}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{fmt(t.total_amount)}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">+{fmt(t.profit)}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-400">{t.profiles?.full_name?.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
